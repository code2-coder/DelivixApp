import mongoose from "mongoose";
import User from "../models/User.js";
import Order from "../models/order.js";
import { ApiError } from "../utils/ApiError.js";

const CUSTOMER_ROLE_CRITERIA = { role: { $in: ["user", "customer"] } };
const HIGH_VALUE_THRESHOLD = Number(process.env.HIGH_VALUE_CUSTOMER_THRESHOLD) || 5000;
const INACTIVE_DAYS = 90;

const startOfDaysAgo = (days) => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - days);
  return d;
};

const buildPagination = (page, limit, total) => {
  const pages = Math.ceil(total / limit) || 1;
  return {
    page,
    limit,
    total,
    pages,
    hasNext: page < pages,
    hasPrev: page > 1,
  };
};

export class CustomerService {
  /**
   * Get high-level summary statistics for customer dashboard
   */
  async getCustomerStats() {
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const [
      totalRegistered,
      activeCustomers,
      blockedOrSuspended,
      inactiveCustomers,
      newCustomersThisMonth,
      deliveredUserIds,
      pendingUserIds,
      spendingAgg,
    ] = await Promise.all([
      User.countDocuments(CUSTOMER_ROLE_CRITERIA),
      User.countDocuments({
        ...CUSTOMER_ROLE_CRITERIA,
        status: { $in: ["active", null] }, // null defaults to active
      }),
      User.countDocuments({
        ...CUSTOMER_ROLE_CRITERIA,
        status: { $in: ["blocked", "suspended"] },
      }),
      User.countDocuments({
        ...CUSTOMER_ROLE_CRITERIA,
        status: "inactive",
      }),
      User.countDocuments({
        ...CUSTOMER_ROLE_CRITERIA,
        createdAt: { $gte: startOfMonth },
      }),
      Order.distinct("user", { orderStatus: "Delivered" }),
      Order.distinct("user", {
        orderStatus: {
          $in: ["Pending", "Confirmed", "Processing", "Packed", "Shipped", "Out for Delivery"],
        },
      }),
      Order.aggregate([
        {
          $match: {
            paymentStatus: { $in: ["Paid", "Partially Refunded", "Refund Pending"] },
          },
        },
        {
          $group: {
            _id: null,
            totalRevenue: {
              $sum: {
                $subtract: [
                  "$totalAmount",
                  {
                    $sum: {
                      $map: {
                        input: {
                          $filter: {
                            input: { $ifNull: ["$refunds", []] },
                            as: "rf",
                            cond: { $eq: ["$$rf.status", "Completed"] },
                          },
                        },
                        as: "rf",
                        in: { $ifNull: ["$$rf.amount", 0] },
                      },
                    },
                  },
                ],
              },
            },
          },
        },
      ]),
    ]);

    // Count how many of the order-holding users are legitimate customers
    const [customersWithCompletedOrders, customersWithPendingOrders] = await Promise.all([
      User.countDocuments({
        ...CUSTOMER_ROLE_CRITERIA,
        _id: { $in: deliveredUserIds },
      }),
      User.countDocuments({
        ...CUSTOMER_ROLE_CRITERIA,
        _id: { $in: pendingUserIds },
      }),
    ]);

    const totalRevenue = Math.max(0, Math.round(spendingAgg[0]?.totalRevenue || 0));
    const averageOrderValue =
      customersWithCompletedOrders > 0
        ? Math.round(totalRevenue / customersWithCompletedOrders)
        : 0;

    return {
      totalRegistered,
      activeCustomers,
      newCustomersThisMonth,
      customersWithCompletedOrders,
      customersWithPendingOrders,
      blockedCustomers: blockedOrSuspended,
      inactiveCustomers,
      totalRevenue,
      averageOrderValue,
      highValueThreshold: HIGH_VALUE_THRESHOLD,
    };
  }

  /**
   * Search, filter, sort and paginate customers using aggregation
   */
  async getAllCustomers(query = {}) {
    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(query.limit) || 20));

    const pipeline = this._buildCustomerPipeline(query);

    // Facet for paginated data and total count
    pipeline.push({
      $facet: {
        data: [{ $skip: (page - 1) * limit }, { $limit: limit }],
        totalCount: [{ $count: "count" }],
      },
    });

    const [result] = await User.aggregate(pipeline);
    const total = result.totalCount[0]?.count || 0;
    const customers = (result.data || []).map((c) => ({
      ...c,
      status: c.status || "active",
      totalOrders: c.totalOrders || 0,
      totalSpent: c.totalSpent || 0,
      completedOrders: c.completedOrders || 0,
      pendingOrders: c.pendingOrders || 0,
    }));

    return {
      customers,
      pagination: buildPagination(page, limit, total),
      highValueThreshold: HIGH_VALUE_THRESHOLD,
    };
  }

  /**
   * Retrieve single customer details including order history and metrics
   */
  async getCustomerDetails(customerId) {
    if (!mongoose.Types.ObjectId.isValid(customerId)) {
      throw ApiError.badRequest("Invalid customer ID format");
    }

    const user = await User.findOne({
      _id: customerId,
      ...CUSTOMER_ROLE_CRITERIA,
    })
      .select("-password -emailVerificationOTP -emailVerificationOTPExpires -resetPasswordToken -resetPasswordExpires -refreshToken")
      .lean();

    if (!user) {
      throw ApiError.notFound("Customer not found");
    }

    // Fetch all orders for this customer sorted newest first
    const orders = await Order.find({ user: customerId })
      .sort({ createdAt: -1 })
      .select(
        "orderNumber orderStatus paymentStatus paymentMethod totalAmount orderItems shippingInfo createdAt deliveredAt refunds"
      )
      .lean();

    // Compute accurate purchase metrics
    let totalSpent = 0;
    let completedOrders = 0;
    let pendingOrders = 0;
    let cancelledOrders = 0;

    const pendingStatuses = [
      "Pending",
      "Confirmed",
      "Processing",
      "Packed",
      "Shipped",
      "Out for Delivery",
    ];
    const cancelledStatuses = ["Cancelled", "Refunded", "Return Rejected"];

    for (const order of orders) {
      if (order.orderStatus === "Delivered") {
        completedOrders += 1;
      }
      if (pendingStatuses.includes(order.orderStatus)) {
        pendingOrders += 1;
      }
      if (cancelledStatuses.includes(order.orderStatus)) {
        cancelledOrders += 1;
      }

      // Check if order was paid and not cancelled
      const isPaid = ["Paid", "Partially Refunded", "Refund Pending"].includes(
        order.paymentStatus
      );
      const isCodDelivered =
        order.paymentMethod === "COD" && order.orderStatus === "Delivered";

      if (isPaid || isCodDelivered) {
        const completedRefunds = (order.refunds || [])
          .filter((r) => r.status === "Completed")
          .reduce((sum, r) => sum + (Number(r.amount) || 0), 0);
        totalSpent += Math.max(0, (Number(order.totalAmount) || 0) - completedRefunds);
      }
    }

    const totalOrders = orders.length;
    const averageOrderValue =
      completedOrders > 0
        ? Math.round(totalSpent / completedOrders)
        : totalOrders > 0
        ? Math.round(totalSpent / totalOrders)
        : 0;

    const lastOrderDate = orders[0]?.createdAt || null;

    return {
      customer: {
        ...user,
        status: user.status || "active",
      },
      metrics: {
        totalOrders,
        completedOrders,
        pendingOrders,
        cancelledOrders,
        totalSpent: Math.round(totalSpent),
        averageOrderValue,
        lastOrderDate,
      },
      orders,
      addresses: user.addresses || [],
      adminNotes: (user.adminNotes || []).sort(
        (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
      ),
      statusHistory: (user.statusHistory || []).sort(
        (a, b) => new Date(b.changedAt) - new Date(a.changedAt)
      ),
    };
  }

  /**
   * Update permitted customer profile fields
   */
  async updateCustomer(customerId, updateData, adminUser) {
    if (!mongoose.Types.ObjectId.isValid(customerId)) {
      throw ApiError.badRequest("Invalid customer ID format");
    }

    const user = await User.findOne({
      _id: customerId,
      ...CUSTOMER_ROLE_CRITERIA,
    });

    if (!user) {
      throw ApiError.notFound("Customer not found");
    }

    const permitted = ["name", "phoneNumber", "altPhoneNumber", "isVerified", "status"];
    const statusChanged = updateData.status && updateData.status !== user.status;

    for (const key of permitted) {
      if (updateData[key] !== undefined) {
        user[key] = updateData[key];
      }
    }

    if (statusChanged) {
      user.statusHistory.push({
        status: updateData.status,
        reason: updateData.reason || "Profile updated by admin",
        changedBy: adminUser?._id,
        changedByName: adminUser?.name || "Administrator",
        changedAt: new Date(),
      });
    }

    await user.save();

    return this.getCustomerDetails(customerId);
  }

  /**
   * Update customer account status (active, inactive, suspended, blocked)
   */
  async updateCustomerStatus(customerId, status, reason, adminUser) {
    if (!mongoose.Types.ObjectId.isValid(customerId)) {
      throw ApiError.badRequest("Invalid customer ID format");
    }

    const validStatuses = ["active", "inactive", "suspended", "blocked"];
    if (!validStatuses.includes(status)) {
      throw ApiError.badRequest(
        `Invalid status. Allowed values: ${validStatuses.join(", ")}`
      );
    }

    const user = await User.findOne({
      _id: customerId,
      ...CUSTOMER_ROLE_CRITERIA,
    });

    if (!user) {
      throw ApiError.notFound("Customer not found");
    }

    const previousStatus = user.status || "active";
    user.status = status;
    user.statusHistory.push({
      status,
      reason: reason || `Status changed from ${previousStatus} to ${status}`,
      changedBy: adminUser?._id,
      changedByName: adminUser?.name || "Administrator",
      changedAt: new Date(),
    });

    await user.save();

    return {
      customerId: user._id,
      previousStatus,
      status: user.status,
      statusHistory: user.statusHistory,
    };
  }

  /**
   * Add internal administrator note
   */
  async addAdminNote(customerId, noteText, adminUser) {
    if (!mongoose.Types.ObjectId.isValid(customerId)) {
      throw ApiError.badRequest("Invalid customer ID format");
    }

    const user = await User.findOne({
      _id: customerId,
      ...CUSTOMER_ROLE_CRITERIA,
    });

    if (!user) {
      throw ApiError.notFound("Customer not found");
    }

    const newNote = {
      note: noteText.trim(),
      addedBy: adminUser?._id,
      addedByName: adminUser?.name || "Administrator",
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    user.adminNotes.push(newNote);
    await user.save();

    return user.adminNotes[user.adminNotes.length - 1];
  }

  /**
   * Delete internal administrator note
   */
  async deleteAdminNote(customerId, noteId) {
    if (
      !mongoose.Types.ObjectId.isValid(customerId) ||
      !mongoose.Types.ObjectId.isValid(noteId)
    ) {
      throw ApiError.badRequest("Invalid ID format");
    }

    const user = await User.findOne({
      _id: customerId,
      ...CUSTOMER_ROLE_CRITERIA,
    });

    if (!user) {
      throw ApiError.notFound("Customer not found");
    }

    const noteIndex = user.adminNotes.findIndex((n) => n._id.toString() === noteId.toString());
    if (noteIndex === -1) {
      throw ApiError.notFound("Admin note not found");
    }

    user.adminNotes.splice(noteIndex, 1);
    await user.save();

    return { success: true, message: "Note deleted successfully" };
  }

  /**
   * Fetch paginated orders for a specific customer
   */
  async getCustomerOrders(customerId, query = {}) {
    if (!mongoose.Types.ObjectId.isValid(customerId)) {
      throw ApiError.badRequest("Invalid customer ID format");
    }

    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.min(50, Math.max(1, Number(query.limit) || 10));

    const filter = { user: customerId };
    if (query.status && query.status !== "All") {
      filter.orderStatus = query.status;
    }

    const [orders, total] = await Promise.all([
      Order.find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .select(
          "orderNumber orderStatus paymentStatus paymentMethod totalAmount orderItems shippingInfo createdAt deliveredAt refunds"
        )
        .lean(),
      Order.countDocuments(filter),
    ]);

    return {
      orders,
      pagination: buildPagination(page, limit, total),
    };
  }

  /**
   * Export filtered customers to CSV format
   */
  async exportCustomers(query = {}) {
    const pipeline = this._buildCustomerPipeline(query);
    // Limit export to max 5000 records to prevent memory exhaustion
    pipeline.push({ $limit: 5000 });

    const customers = await User.aggregate(pipeline);

    const escapeCsv = (val) => {
      if (val === null || val === undefined) return '""';
      const str = String(val).replace(/"/g, '""');
      return `"${str}"`;
    };

    const headers = [
      "Customer ID",
      "Name",
      "Email",
      "Phone",
      "Account Status",
      "Email Verified",
      "Registration Date",
      "Total Orders",
      "Completed Orders",
      "Pending Orders",
      "Total Spent (INR)",
      "Last Order Date",
    ];

    const rows = customers.map((c) => [
      escapeCsv(c._id),
      escapeCsv(c.name),
      escapeCsv(c.email),
      escapeCsv(c.phoneNumber || c.altPhoneNumber || "N/A"),
      escapeCsv(c.status || "active"),
      escapeCsv(c.isVerified ? "Yes" : "No"),
      escapeCsv(c.createdAt ? new Date(c.createdAt).toISOString().slice(0, 10) : "N/A"),
      escapeCsv(c.totalOrders || 0),
      escapeCsv(c.completedOrders || 0),
      escapeCsv(c.pendingOrders || 0),
      escapeCsv(Math.round(c.totalSpent || 0)),
      escapeCsv(c.lastOrderDate ? new Date(c.lastOrderDate).toISOString().slice(0, 10) : "Never"),
    ]);

    const csvContent = [headers.join(","), ...rows.map((r) => r.join(","))].join("\r\n");

    return csvContent;
  }

  /**
   * Construct the aggregation pipeline for filtering, searching, and sorting
   */
  _buildCustomerPipeline(query) {
    const pipeline = [];

    // Base match: only customers
    const baseMatch = { ...CUSTOMER_ROLE_CRITERIA };

    // Registration date range filter
    if (query.dateFrom || query.dateTo) {
      baseMatch.createdAt = {};
      if (query.dateFrom) {
        const from = new Date(query.dateFrom);
        if (!isNaN(from.getTime())) baseMatch.createdAt.$gte = from;
      }
      if (query.dateTo) {
        const to = new Date(query.dateTo);
        if (!isNaN(to.getTime())) {
          to.setHours(23, 59, 59, 999);
          baseMatch.createdAt.$lte = to;
        }
      }
    }

    pipeline.push({ $match: baseMatch });

    // Lookup orders to compute lifetime spending and orders
    pipeline.push({
      $lookup: {
        from: "orders",
        localField: "_id",
        foreignField: "user",
        as: "orders",
      },
    });

    // Compute order metrics per customer
    pipeline.push({
      $addFields: {
        status: { $ifNull: ["$status", "active"] },
        totalOrders: { $size: "$orders" },
        completedOrders: {
          $size: {
            $filter: {
              input: "$orders",
              as: "o",
              cond: { $eq: ["$$o.orderStatus", "Delivered"] },
            },
          },
        },
        pendingOrders: {
          $size: {
            $filter: {
              input: "$orders",
              as: "o",
              cond: {
                $in: [
                  "$$o.orderStatus",
                  [
                    "Pending",
                    "Confirmed",
                    "Processing",
                    "Packed",
                    "Shipped",
                    "Out for Delivery",
                  ],
                ],
              },
            },
          },
        },
        lastOrderDate: { $max: "$orders.createdAt" },
        totalSpent: {
          $round: [
            {
              $sum: {
                $map: {
                  input: {
                    $filter: {
                      input: "$orders",
                      as: "o",
                      cond: {
                        $or: [
                          {
                            $in: [
                              "$$o.paymentStatus",
                              ["Paid", "Partially Refunded", "Refund Pending"],
                            ],
                          },
                          {
                            $and: [
                              { $eq: ["$$o.paymentMethod", "COD"] },
                              { $eq: ["$$o.orderStatus", "Delivered"] },
                            ],
                          },
                        ],
                      },
                    },
                  },
                  as: "vo",
                  in: {
                    $max: [
                      0,
                      {
                        $subtract: [
                          { $ifNull: ["$$vo.totalAmount", 0] },
                          {
                            $sum: {
                              $map: {
                                input: {
                                  $filter: {
                                    input: { $ifNull: ["$$vo.refunds", []] },
                                    as: "rf",
                                    cond: { $eq: ["$$rf.status", "Completed"] },
                                  },
                                },
                                as: "rf",
                                in: { $ifNull: ["$$rf.amount", 0] },
                              },
                            },
                          },
                        ],
                      },
                    ],
                  },
                },
              },
            },
            0,
          ],
        },
      },
    });

    // Remove full orders list to reduce memory overhead
    pipeline.push({
      $project: {
        orders: 0,
        password: 0,
        emailVerificationOTP: 0,
        emailVerificationOTPExpires: 0,
        resetPasswordToken: 0,
        resetPasswordExpires: 0,
        refreshToken: 0,
      },
    });

    // Post-calculation filters (Search, Status, Segment, Spending, Order Count)
    const postMatch = {};

    // 1. Text Search across name, email, phone, or customer ID
    if (query.search && String(query.search).trim()) {
      const term = String(query.search).trim();
      const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const regex = new RegExp(escaped, "i");

      const searchOr = [
        { name: regex },
        { email: regex },
        { phoneNumber: regex },
        { altPhoneNumber: regex },
      ];

      if (mongoose.Types.ObjectId.isValid(term)) {
        searchOr.push({ _id: new mongoose.Types.ObjectId(term) });
      }

      postMatch.$or = searchOr;
    }

    // 2. Status filter
    if (query.status && query.status !== "All") {
      const normStatus = String(query.status).toLowerCase();
      if (normStatus === "active") {
        postMatch.status = { $in: ["active", null] };
      } else {
        postMatch.status = normStatus;
      }
    }

    // 3. Segment filter
    if (query.segment && query.segment !== "All" && query.segment !== "all") {
      const seg = String(query.segment).toLowerCase();
      const thirtyDaysAgo = startOfDaysAgo(30);
      const ninetyDaysAgo = startOfDaysAgo(INACTIVE_DAYS);

      if (seg === "new") {
        postMatch.createdAt = { $gte: thirtyDaysAgo };
      } else if (seg === "repeat") {
        postMatch.totalOrders = { $gte: 2 };
      } else if (seg === "high_value" || seg === "high-value") {
        const threshold = Number(query.minSpent) || HIGH_VALUE_THRESHOLD;
        postMatch.totalSpent = { $gte: threshold };
      } else if (seg === "no_orders" || seg === "zero_orders") {
        postMatch.totalOrders = 0;
      } else if (seg === "inactive") {
        postMatch.$or = [
          { status: "inactive" },
          { lastOrderDate: { $lt: ninetyDaysAgo } },
          { $and: [{ totalOrders: 0 }, { createdAt: { $lt: ninetyDaysAgo } }] },
        ];
      }
    }

    // 4. Order Count filter
    if (query.orderCount && query.orderCount !== "All") {
      const oc = String(query.orderCount).trim();
      if (oc === "0") {
        postMatch.totalOrders = 0;
      } else if (oc === "1-5") {
        postMatch.totalOrders = { $gte: 1, $lte: 5 };
      } else if (oc === "6-20") {
        postMatch.totalOrders = { $gte: 6, $lte: 20 };
      } else if (oc === "20+") {
        postMatch.totalOrders = { $gt: 20 };
      }
    }

    // 5. Spending Range filter
    if (query.minSpent !== undefined && query.minSpent !== "") {
      const min = Number(query.minSpent);
      if (!isNaN(min)) {
        postMatch.totalSpent = postMatch.totalSpent || {};
        postMatch.totalSpent.$gte = min;
      }
    }
    if (query.maxSpent !== undefined && query.maxSpent !== "") {
      const max = Number(query.maxSpent);
      if (!isNaN(max)) {
        postMatch.totalSpent = postMatch.totalSpent || {};
        postMatch.totalSpent.$lte = max;
      }
    }

    if (Object.keys(postMatch).length > 0) {
      pipeline.push({ $match: postMatch });
    }

    // Sorting
    const sortField = this._resolveSort(query.sort);
    pipeline.push({ $sort: sortField });

    return pipeline;
  }

  _resolveSort(sortKey) {
    switch (sortKey) {
      case "oldest":
        return { createdAt: 1 };
      case "orders_desc":
        return { totalOrders: -1, createdAt: -1 };
      case "orders_asc":
        return { totalOrders: 1, createdAt: -1 };
      case "spending_desc":
        return { totalSpent: -1, createdAt: -1 };
      case "spending_asc":
        return { totalSpent: 1, createdAt: -1 };
      case "name_asc":
        return { name: 1 };
      case "name_desc":
        return { name: -1 };
      case "newest":
      default:
        return { createdAt: -1 };
    }
  }
}

export default new CustomerService();
