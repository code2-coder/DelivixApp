import Order from "../models/order.js";
import Product from "../models/product.js";
import User from "../models/User.js";
import { sendResponse } from "../helpers/response.js";
import { asyncHandler } from "../utils/asyncHandler.js";

const LOW_STOCK_THRESHOLD = Number(process.env.LOW_STOCK_THRESHOLD) || 5;
const CANCELLED_STATES = ["Cancelled", "Returned", "Refunded"];

const startOfDaysAgo = (days) => {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  d.setUTCDate(d.getUTCDate() - days);
  return d;
};

/**
 * GET /api/v1/admin/dashboard/stats
 * Aggregated, real-data statistics for the admin overview.
 */
export const getDashboardStats = asyncHandler(async (req, res) => {
  const trendDays = Math.min(Math.max(Number(req.query.days) || 14, 1), 90);
  const since = startOfDaysAgo(trendDays - 1);

  const [
    orderAgg,
    statusBreakdown,
    salesOverview,
    bestSellers,
    recentOrders,
    latestCustomers,
    lowStockProducts,
    productAgg,
    totalCustomers,
  ] = await Promise.all([
    Order.aggregate([
      { $match: { orderStatus: { $nin: CANCELLED_STATES } } },
      {
        $group: {
          _id: null,
          totalRevenue: { $sum: "$totalAmount" },
          totalOrders: { $sum: 1 },
        },
      },
    ]),
    Order.aggregate([{ $group: { _id: "$orderStatus", count: { $sum: 1 } } }]),
    Order.aggregate([
      { $match: { createdAt: { $gte: since }, orderStatus: { $nin: CANCELLED_STATES } } },
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
          revenue: { $sum: "$totalAmount" },
          orders: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]),
    Order.aggregate([
      { $match: { orderStatus: { $nin: CANCELLED_STATES } } },
      { $unwind: "$orderItems" },
      {
        $group: {
          _id: "$orderItems.product",
          name: { $first: "$orderItems.name" },
          image: { $first: "$orderItems.image" },
          unitsSold: { $sum: "$orderItems.quantity" },
          revenue: { $sum: { $multiply: ["$orderItems.price", "$orderItems.quantity"] } },
        },
      },
      { $sort: { unitsSold: -1 } },
      { $limit: 5 },
    ]),
    Order.find({})
      .sort({ createdAt: -1 })
      .limit(6)
      .populate("user", "name email")
      .select("shippingInfo.fullName user totalAmount orderStatus paymentMethod createdAt")
      .lean(),
    User.find({ role: { $in: ["user", "customer"] } })
      .sort({ createdAt: -1 })
      .limit(6)
      .select("name email createdAt isVerified status")
      .lean(),
    Product.find({ stock: { $lte: LOW_STOCK_THRESHOLD } })
      .sort({ stock: 1 })
      .limit(8)
      .select("name stock price images category status")
      .lean(),
    Product.aggregate([
      {
        $group: {
          _id: null,
          total: { $sum: 1 },
          outOfStock: { $sum: { $cond: [{ $lte: ["$stock", 0] }, 1, 0] } },
          lowStock: {
            $sum: { $cond: [{ $and: [{ $gt: ["$stock", 0] }, { $lte: ["$stock", LOW_STOCK_THRESHOLD] }] }, 1, 0] },
          },
          totalStock: { $sum: "$stock" },
        },
      },
    ]),
    User.countDocuments({ role: { $in: ["user", "customer"] } }),
  ]);

  const totals = orderAgg[0] || { totalRevenue: 0, totalOrders: 0 };
  const products = productAgg[0] || { total: 0, outOfStock: 0, lowStock: 0, totalStock: 0 };

  const statusMap = {};
  statusBreakdown.forEach((s) => {
    statusMap[s._id || "Unknown"] = s.count;
  });
  const pendingOrders =
    (statusMap.Pending || 0) +
    (statusMap.Confirmed || 0) +
    (statusMap.Processing || 0) +
    (statusMap.Packed || 0);

  // Fill the trend series so charts render a continuous axis
  const trendIndex = {};
  salesOverview.forEach((d) => {
    trendIndex[d._id] = d;
  });
  const salesTrend = [];
  for (let i = trendDays - 1; i >= 0; i--) {
    const d = startOfDaysAgo(i);
    const key = d.toISOString().slice(0, 10);
    salesTrend.push({
      date: key,
      revenue: trendIndex[key]?.revenue || 0,
      orders: trendIndex[key]?.orders || 0,
    });
  }

  return sendResponse(res, 200, true, "Dashboard statistics fetched successfully", {
    stats: {
      totalRevenue: Math.round(totals.totalRevenue || 0),
      totalOrders: totals.totalOrders || 0,
      totalProducts: products.total || 0,
      totalCustomers: totalCustomers || 0,
      pendingOrders,
      deliveredOrders: statusMap.Delivered || 0,
      lowStockCount: products.lowStock || 0,
      outOfStockCount: products.outOfStock || 0,
      totalStock: products.totalStock || 0,
    },
    statusBreakdown: statusMap,
    salesTrend,
    bestSellers,
    recentOrders,
    latestCustomers,
    lowStockProducts,
    lowStockThreshold: LOW_STOCK_THRESHOLD,
    trendDays,
  });
});

export default { getDashboardStats };
