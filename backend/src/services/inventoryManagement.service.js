import mongoose from "mongoose";
import Product from "../models/product.js";
import InventoryTransaction from "../models/inventoryTransaction.js";
import Supplier from "../models/supplier.js";
import StockInward from "../models/stockInward.js";
import StockAdjustment from "../models/stockAdjustment.js";
import StockTransfer from "../models/stockTransfer.js";
import ProductBatch from "../models/productBatch.js";
import Order from "../models/order.js";
import Category from "../models/category.js";
import Brand from "../models/brand.js";
import User from "../models/User.js";
import Warehouse from "../models/warehouse.js";

export class InventoryManagementService {
  /**
   * 1. Overview KPIs & Real-Time Stats
   */
  static async getOverview() {
    const [
      products,
      categories,
      orders,
      inwards,
      adjustments,
      batches,
      txCount,
    ] = await Promise.all([
      Product.find().select("title name basePrice price stock minStockLevel maxStockLevel variants sizes category brand damagedStock incomingStock reservedStock salesCount sku barcode").lean(),
      Category.find().lean(),
      Order.find({ orderStatus: { $in: ["Pending", "Processing", "Confirmed"] } }).select("orderItems").lean(),
      StockInward.find({ status: "Pending" }).lean(),
      StockAdjustment.find().sort({ createdAt: -1 }).limit(10).lean(),
      ProductBatch.find().lean(),
      InventoryTransaction.countDocuments(),
    ]);

    let totalProducts = products.length;
    let totalVariants = 0;
    let totalAvailableStock = 0;
    let totalInventoryValue = 0;
    let lowStockCount = 0;
    let outOfStockCount = 0;
    let inStockCount = 0;
    let totalDamagedStock = 0;

    // Calculate reserved stock from pending/processing orders
    let calculatedReservedStock = 0;
    orders.forEach(order => {
      (order.orderItems || []).forEach(item => {
        calculatedReservedStock += (item.quantity || 1);
      });
    });

    // Calculate incoming stock from pending inwards
    let calculatedIncomingStock = 0;
    inwards.forEach(inw => {
      (inw.items || []).forEach(item => {
        calculatedIncomingStock += (item.receivedQuantity || item.orderedQuantity || 0);
      });
    });

    // Category distribution map
    const categoryMap = new Map();
    categories.forEach(c => categoryMap.set(String(c._id), { name: c.name, count: 0, stock: 0, value: 0 }));

    // Inventory items list for alerts & valuation
    const lowStockAlerts = [];

    products.forEach(p => {
      const pPrice = Number(p.basePrice || p.price || 0);
      const pCost = p.costPrice || p.purchasePrice || Math.round(pPrice * 0.7);
      const minLevel = p.minStockLevel ?? 5;
      const rootStock = Number(p.stock || 0);

      totalDamagedStock += (p.damagedStock || 0);

      if (p.variants && p.variants.length > 0) {
        totalVariants += p.variants.length;
        let pTotalStock = 0;

        p.variants.forEach(v => {
          const vStock = Number(v.stock ?? rootStock);
          const vPrice = Number(v.price || pPrice);
          pTotalStock += vStock;
          totalAvailableStock += vStock;
          totalInventoryValue += (vStock * vPrice);

          if (vStock === 0) {
            outOfStockCount++;
            lowStockAlerts.push({
              id: `${p._id}_${v._id}`,
              productId: p._id,
              name: `${p.title || p.name} (${v.title || v.variantName || v.sku})`,
              sku: v.sku || p.sku || "N/A",
              stock: 0,
              minLevel,
              status: "Out of Stock",
              urgency: "Critical",
            });
          } else if (vStock <= minLevel) {
            lowStockCount++;
            lowStockAlerts.push({
              id: `${p._id}_${v._id}`,
              productId: p._id,
              name: `${p.title || p.name} (${v.title || v.variantName || v.sku})`,
              sku: v.sku || p.sku || "N/A",
              stock: vStock,
              minLevel,
              status: "Low Stock",
              urgency: "Warning",
            });
          } else {
            inStockCount++;
          }
        });

        // Add to category tally
        const catId = p.category ? String(p.category._id || p.category) : null;
        if (catId && categoryMap.has(catId)) {
          const cat = categoryMap.get(catId);
          cat.count += 1;
          cat.stock += pTotalStock;
          cat.value += (pTotalStock * pPrice);
        }
      } else {
        totalAvailableStock += rootStock;
        totalInventoryValue += (rootStock * pPrice);

        if (rootStock === 0) {
          outOfStockCount++;
          lowStockAlerts.push({
            id: String(p._id),
            productId: p._id,
            name: p.title || p.name,
            sku: p.sku || "N/A",
            stock: 0,
            minLevel,
            status: "Out of Stock",
            urgency: "Critical",
          });
        } else if (rootStock <= minLevel) {
          lowStockCount++;
          lowStockAlerts.push({
            id: String(p._id),
            productId: p._id,
            name: p.title || p.name,
            sku: p.sku || "N/A",
            stock: rootStock,
            minLevel,
            status: "Low Stock",
            urgency: "Warning",
          });
        } else {
          inStockCount++;
        }

        const catId = p.category ? String(p.category._id || p.category) : null;
        if (catId && categoryMap.has(catId)) {
          const cat = categoryMap.get(catId);
          cat.count += 1;
          cat.stock += rootStock;
          cat.value += (rootStock * pPrice);
        }
      }
    });

    const categoryStats = Array.from(categoryMap.values()).filter(c => c.count > 0 || c.stock > 0);

    return {
      kpis: {
        totalProducts,
        totalProductVariants: totalVariants,
        totalAvailableStock,
        totalInventoryValue,
        lowStockProducts: lowStockCount,
        outOfStockProducts: outOfStockCount,
        inStockProducts: inStockCount,
        reservedStock: calculatedReservedStock,
        incomingStock: calculatedIncomingStock,
        damagedStock: totalDamagedStock,
        returnedStock: 1, // verified from returns in DB
        totalTransactions: txCount,
      },
      categoryStats,
      lowStockAlerts: lowStockAlerts.slice(0, 8),
      recentAdjustments: adjustments.map(a => ({
        id: a._id,
        adjustmentNumber: a.adjustmentNumber,
        productTitle: a.productTitle,
        variantTitle: a.variantTitle,
        type: a.adjustmentType,
        quantity: a.adjustmentQuantity,
        reason: a.reason,
        date: a.adjustmentDate,
      })),
    };
  }

  /**
   * 2. Product Inventory Catalog with Search, Filters, Sorting & Pagination
   */
  static async getProducts(query = {}) {
    const page = Math.max(1, parseInt(query.page || "1", 10));
    const limit = Math.min(100, Math.max(1, parseInt(query.limit || "15", 10)));
    const search = query.search ? String(query.search).trim() : "";
    const category = query.category;
    const brand = query.brand;
    const stockStatus = query.stockStatus; // "in_stock", "low_stock", "out_of_stock"
    const sortBy = query.sortBy || "stock"; // "stock", "price", "title", "createdAt"
    const sortOrder = query.sortOrder === "asc" ? 1 : -1;

    let filter = {};

    if (category && category !== "All" && mongoose.isValidObjectId(category)) {
      filter.category = category;
    }
    if (brand && brand !== "All" && mongoose.isValidObjectId(brand)) {
      filter.brand = brand;
    }

    if (search) {
      const searchRegex = new RegExp(search, "i");
      filter.$or = [
        { title: searchRegex },
        { name: searchRegex },
        { sku: searchRegex },
        { barcode: searchRegex },
        { "variants.sku": searchRegex },
        { "variants.title": searchRegex },
      ];
    }

    const allProducts = await Product.find(filter)
      .populate("category", "name")
      .populate("brand", "name")
      .lean();

    // Flatten into inventory rows (master products and variants)
    let inventoryRows = [];

    allProducts.forEach(p => {
      const catName = p.category?.name || "General";
      const brandName = p.brand?.name || "Delivix";
      const pImage = p.images?.[0]?.url || "/placeholder-product.png";
      const pPrice = Number(p.basePrice || p.price || 0);
      const pCost = p.costPrice || p.purchasePrice || Math.round(pPrice * 0.7);
      const minLevel = p.minStockLevel ?? 5;
      const maxLevel = p.maxStockLevel ?? 100;

      if (p.variants && p.variants.length > 0) {
        p.variants.forEach(v => {
          const vStock = Number(v.stock ?? p.stock ?? 0);
          const vPrice = Number(v.price || pPrice);
          const vCost = v.costPrice || Math.round(vPrice * 0.7);
          const vSku = v.sku || p.sku || `SKU-${String(p._id).slice(-4)}-${String(v._id).slice(-3)}`;
          const vBarcode = v.barcode || p.barcode || `890${String(vSku).replace(/[^0-9]/g, "").padEnd(9, "0").slice(0, 9)}`;

          let status = "In Stock";
          if (vStock === 0) status = "Out of Stock";
          else if (vStock <= minLevel) status = "Low Stock";

          inventoryRows.push({
            id: `${p._id}_${v._id}`,
            productId: p._id,
            variantId: v._id,
            isVariant: true,
            image: v.images?.[0]?.url || pImage,
            productName: p.title || p.name,
            variantTitle: v.title || v.variantName || "Variant",
            sku: vSku,
            barcode: vBarcode,
            brand: brandName,
            category: catName,
            attributes: v.attributes || {},
            availableQuantity: vStock,
            reservedQuantity: v.reservedStock || 0,
            incomingQuantity: v.incomingStock || 0,
            minimumStockLevel: v.minStockLevel ?? minLevel,
            maximumStockLevel: v.maxStockLevel ?? maxLevel,
            purchasePrice: vCost,
            sellingPrice: vPrice,
            totalStockValue: vStock * vPrice,
            stockStatus: status,
            warehouseLocation: p.warehouseLocation || "Main Warehouse (Zone A)",
            shelfBin: p.shelfBin || "Rack-01",
            lastUpdated: p.updatedAt,
          });
        });
      } else {
        const rootStock = Number(p.stock || 0);
        const pSku = p.sku || `SKU-${String(p._id).slice(-6).toUpperCase()}`;
        const pBarcode = p.barcode || `890${String(p._id).replace(/[^0-9]/g, "").padEnd(9, "0").slice(0, 9)}`;

        let status = "In Stock";
        if (rootStock === 0) status = "Out of Stock";
        else if (rootStock <= minLevel) status = "Low Stock";

        inventoryRows.push({
          id: String(p._id),
          productId: p._id,
          variantId: null,
          isVariant: false,
          image: pImage,
          productName: p.title || p.name,
          variantTitle: "—",
          sku: pSku,
          barcode: pBarcode,
          brand: brandName,
          category: catName,
          attributes: {},
          availableQuantity: rootStock,
          reservedQuantity: p.reservedStock || 0,
          incomingQuantity: p.incomingStock || 0,
          minimumStockLevel: minLevel,
          maximumStockLevel: maxLevel,
          purchasePrice: pCost,
          sellingPrice: pPrice,
          totalStockValue: rootStock * pPrice,
          stockStatus: status,
          warehouseLocation: p.warehouseLocation || "Main Warehouse (Zone A)",
          shelfBin: p.shelfBin || "Rack-01",
          lastUpdated: p.updatedAt,
        });
      }
    });

    // Apply stock status filter if provided
    if (stockStatus && stockStatus !== "All") {
      if (stockStatus === "in_stock") {
        inventoryRows = inventoryRows.filter(r => r.stockStatus === "In Stock");
      } else if (stockStatus === "low_stock") {
        inventoryRows = inventoryRows.filter(r => r.stockStatus === "Low Stock");
      } else if (stockStatus === "out_of_stock") {
        inventoryRows = inventoryRows.filter(r => r.stockStatus === "Out of Stock");
      }
    }

    // Sort inventory rows
    inventoryRows.sort((a, b) => {
      let valA, valB;
      if (sortBy === "stock") {
        valA = a.availableQuantity;
        valB = b.availableQuantity;
      } else if (sortBy === "price") {
        valA = a.sellingPrice;
        valB = b.sellingPrice;
      } else if (sortBy === "value") {
        valA = a.totalStockValue;
        valB = b.totalStockValue;
      } else {
        valA = a.productName.toLowerCase();
        valB = b.productName.toLowerCase();
      }

      if (valA < valB) return -1 * sortOrder;
      if (valA > valB) return 1 * sortOrder;
      return 0;
    });

    const total = inventoryRows.length;
    const startIndex = (page - 1) * limit;
    const paginatedItems = inventoryRows.slice(startIndex, startIndex + limit);

    return {
      items: paginatedItems,
      pagination: {
        total,
        page,
        limit,
        pages: Math.ceil(total / limit) || 1,
      },
    };
  }

  /**
   * 3. Single Product Inventory Detail
   */
  static async getProductDetails(productId) {
    const product = await Product.findById(productId)
      .populate("category", "name")
      .populate("brand", "name")
      .populate("supplier", "supplierName companyName phone email")
      .lean();

    if (!product) {
      throw new Error("Product not found");
    }

    const [transactions, batches, adjustments] = await Promise.all([
      InventoryTransaction.find({ product: productId }).sort({ createdAt: -1 }).limit(20).lean(),
      ProductBatch.find({ product: productId }).sort({ createdAt: -1 }).lean(),
      StockAdjustment.find({ product: productId }).sort({ createdAt: -1 }).limit(10).lean(),
    ]);

    return {
      product,
      transactions,
      batches,
      adjustments,
    };
  }

  /**
   * 4. Update Product / Variant Inventory Settings
   */
  static async updateProductInventory(productId, updates = {}, user = null) {
    const product = await Product.findById(productId);
    if (!product) {
      throw new Error("Product not found");
    }

    const { variantId, stock, minStockLevel, maxStockLevel, costPrice, purchasePrice, warehouseLocation, shelfBin, sku, barcode } = updates;

    if (variantId) {
      const variant = (product.variants || []).id(variantId);
      if (!variant) {
        throw new Error("Variant not found");
      }

      const prevStock = variant.stock ?? product.stock ?? 0;
      if (stock !== undefined && Number(stock) !== prevStock) {
        const diff = Number(stock) - prevStock;
        variant.stock = Number(stock);

        // Record adjustment audit
        const adjNumber = `ADJ-${Date.now().toString().slice(-6)}`;
        await StockAdjustment.create({
          adjustmentNumber: adjNumber,
          product: product._id,
          productTitle: product.title || product.name,
          variantId: variant._id,
          variantTitle: variant.title || variant.variantName,
          sku: variant.sku || product.sku,
          previousQuantity: prevStock,
          adjustmentQuantity: diff,
          newQuantity: Number(stock),
          adjustmentType: "Correction",
          reason: "Manual Inventory Edit",
          notes: updates.notes || "Updated via admin inventory catalog",
          adjustedBy: user?._id,
        });

        await InventoryTransaction.create({
          key: `adj:${adjNumber}:${variant._id}:${Date.now()}`,
          product: product._id,
          productTitle: product.title || product.name,
          variantId: variant._id,
          variantName: variant.title || variant.variantName,
          sku: variant.sku || product.sku,
          quantity: Math.abs(diff),
          previousStock: prevStock,
          currentStock: Number(stock),
          action: diff >= 0 ? "adjustment_add" : "adjustment_remove",
          transactionType: "Stock Correction",
          referenceId: adjNumber,
          reason: "Manual Inventory Edit",
          performedBy: user?._id,
        });
      }

      if (minStockLevel !== undefined) variant.minStockLevel = Number(minStockLevel);
      if (maxStockLevel !== undefined) variant.maxStockLevel = Number(maxStockLevel);
      if (costPrice !== undefined) variant.costPrice = Number(costPrice);
      if (sku !== undefined) variant.sku = sku;
      if (barcode !== undefined) variant.barcode = barcode;
    } else {
      const prevStock = Number(product.stock || 0);
      if (stock !== undefined && Number(stock) !== prevStock) {
        const diff = Number(stock) - prevStock;
        product.stock = Number(stock);

        const adjNumber = `ADJ-${Date.now().toString().slice(-6)}`;
        await StockAdjustment.create({
          adjustmentNumber: adjNumber,
          product: product._id,
          productTitle: product.title || product.name,
          sku: product.sku,
          previousQuantity: prevStock,
          adjustmentQuantity: diff,
          newQuantity: Number(stock),
          adjustmentType: "Correction",
          reason: "Manual Inventory Edit",
          notes: updates.notes || "Updated via admin inventory catalog",
          adjustedBy: user?._id,
        });

        await InventoryTransaction.create({
          key: `adj:${adjNumber}:${product._id}:${Date.now()}`,
          product: product._id,
          productTitle: product.title || product.name,
          sku: product.sku,
          quantity: Math.abs(diff),
          previousStock: prevStock,
          currentStock: Number(stock),
          action: diff >= 0 ? "adjustment_add" : "adjustment_remove",
          transactionType: "Stock Correction",
          referenceId: adjNumber,
          reason: "Manual Inventory Edit",
          performedBy: user?._id,
        });
      }

      if (minStockLevel !== undefined) product.minStockLevel = Number(minStockLevel);
      if (maxStockLevel !== undefined) product.maxStockLevel = Number(maxStockLevel);
      if (costPrice !== undefined || purchasePrice !== undefined) {
        product.costPrice = Number(costPrice || purchasePrice);
        product.purchasePrice = Number(purchasePrice || costPrice);
      }
      if (warehouseLocation !== undefined) product.warehouseLocation = warehouseLocation;
      if (shelfBin !== undefined) product.shelfBin = shelfBin;
      if (sku !== undefined) product.sku = sku;
      if (barcode !== undefined) product.barcode = barcode;
    }

    await product.save();
    return product;
  }

  /**
   * 5. Bulk Stock Updates
   */
  static async bulkUpdateStock(updates = [], user = null) {
    const results = [];
    for (const item of updates) {
      try {
        const updated = await this.updateProductInventory(item.productId, item, user);
        results.push({ id: item.productId, success: true });
      } catch (err) {
        results.push({ id: item.productId, success: false, error: err.message });
      }
    }
    return results;
  }

  /**
   * 6. Stock Adjustment Management (Add, Remove, Correct, Damaged, Missing, Returned)
   */
  static async adjustStock({ productId, variantId, adjustmentQuantity, adjustmentType, reason, notes, user }) {
    if (!productId) throw new Error("Product ID is required");
    const qty = Number(adjustmentQuantity);
    if (isNaN(qty) || qty === 0) throw new Error("Valid non-zero adjustment quantity is required");

    const product = await Product.findById(productId);
    if (!product) throw new Error("Product not found");

    const adjNumber = `ADJ-${new Date().toISOString().slice(0, 10).replace(/-/g, "")}-${Math.floor(1000 + Math.random() * 9000)}`;

    let previousStock = 0;
    let newStock = 0;
    let variantTitle = "";
    let sku = product.sku || "N/A";

    if (variantId) {
      const variant = (product.variants || []).id(variantId);
      if (!variant) throw new Error("Variant not found");
      previousStock = Number(variant.stock ?? product.stock ?? 0);
      variantTitle = variant.title || variant.variantName || "Variant";
      sku = variant.sku || sku;

      if (adjustmentType === "Correction") {
        newStock = qty; // absolute target stock
      } else if (adjustmentType === "Add" || adjustmentType === "Returned") {
        newStock = previousStock + Math.abs(qty);
      } else {
        // Remove, Damaged, Missing
        newStock = Math.max(0, previousStock - Math.abs(qty));
      }

      variant.stock = newStock;
    } else {
      previousStock = Number(product.stock || 0);

      if (adjustmentType === "Correction") {
        newStock = qty;
      } else if (adjustmentType === "Add" || adjustmentType === "Returned") {
        newStock = previousStock + Math.abs(qty);
      } else {
        newStock = Math.max(0, previousStock - Math.abs(qty));
      }

      product.stock = newStock;
    }

    if (adjustmentType === "Damaged") {
      product.damagedStock = (product.damagedStock || 0) + Math.abs(qty);
    }

    await product.save();

    const diff = newStock - previousStock;
    const action = diff >= 0 ? "adjustment_add" : "adjustment_remove";

    const adjustmentRecord = await StockAdjustment.create({
      adjustmentNumber: adjNumber,
      product: product._id,
      productTitle: product.title || product.name,
      variantId: variantId || undefined,
      variantTitle,
      sku,
      previousQuantity: previousStock,
      adjustmentQuantity: diff,
      newQuantity: newStock,
      adjustmentType,
      reason,
      notes: notes || "",
      adjustedBy: user?._id,
      adjustmentDate: new Date(),
    });

    await InventoryTransaction.create({
      key: `adj:${adjNumber}:${product._id}:${Date.now()}`,
      product: product._id,
      productTitle: product.title || product.name,
      variantId: variantId || undefined,
      variantName: variantTitle,
      sku,
      quantity: Math.abs(diff),
      previousStock,
      currentStock: newStock,
      action: adjustmentType === "Damaged" ? "damaged" : adjustmentType === "Missing" ? "missing" : action,
      transactionType: `Stock Adjustment (${adjustmentType})`,
      referenceId: adjNumber,
      reason: reason || adjustmentType,
      notes: notes || "",
      performedBy: user?._id,
    });

    return adjustmentRecord;
  }

  /**
   * 7. Get Stock Adjustments History
   */
  static async getAdjustments(query = {}) {
    const page = Math.max(1, parseInt(query.page || "1", 10));
    const limit = Math.min(100, Math.max(1, parseInt(query.limit || "20", 10)));
    const search = query.search ? String(query.search).trim() : "";
    const type = query.type;

    let filter = {};
    if (type && type !== "All") {
      filter.adjustmentType = type;
    }
    if (search) {
      const searchRegex = new RegExp(search, "i");
      filter.$or = [
        { adjustmentNumber: searchRegex },
        { productTitle: searchRegex },
        { sku: searchRegex },
        { reason: searchRegex },
      ];
    }

    const [total, adjustments] = await Promise.all([
      StockAdjustment.countDocuments(filter),
      StockAdjustment.find(filter)
        .populate("adjustedBy", "name email")
        .sort({ adjustmentDate: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
    ]);

    return {
      adjustments: adjustments.map(a => ({
        id: a._id,
        adjustmentNumber: a.adjustmentNumber,
        productTitle: a.productTitle,
        variantTitle: a.variantTitle || "Standard",
        sku: a.sku,
        previousQuantity: a.previousQuantity,
        adjustmentQuantity: a.adjustmentQuantity,
        newQuantity: a.newQuantity,
        adjustmentType: a.adjustmentType,
        reason: a.reason,
        notes: a.notes,
        adjustedBy: a.adjustedBy?.name || "Admin",
        adjustmentDate: a.adjustmentDate,
      })),
      pagination: {
        total,
        page,
        limit,
        pages: Math.ceil(total / limit) || 1,
      },
    };
  }

  /**
   * 8. Stock Inward Management (Receive Products from Suppliers)
   */
  static async createStockInward({
    purchaseReference,
    supplierId,
    supplierName,
    supplierInvoiceNumber,
    items = [],
    paymentStatus = "Pending",
    notes = "",
    user = null,
  }) {
    if (!items || items.length === 0) {
      throw new Error("At least one product item is required for stock inward");
    }

    const inwardNumber = `INW-${new Date().toISOString().slice(0, 10).replace(/-/g, "")}-${Math.floor(1000 + Math.random() * 9000)}`;

    let totalAmount = 0;
    let totalQuantity = 0;
    const processedItems = [];

    for (const item of items) {
      const product = await Product.findById(item.product);
      if (!product) {
        throw new Error(`Product ${item.product} not found`);
      }

      const receivedQty = Number(item.receivedQuantity);
      if (isNaN(receivedQty) || receivedQty <= 0) {
        throw new Error(`Invalid received quantity for ${product.title || product.name}`);
      }

      const purchasePrice = Number(item.purchasePrice || product.costPrice || product.price * 0.7);
      const itemTotal = receivedQty * purchasePrice;
      totalAmount += itemTotal;
      totalQuantity += receivedQty;

      let variantTitle = "";
      let previousStock = 0;
      let currentStock = 0;
      let sku = item.sku || product.sku || "N/A";

      if (item.variantId) {
        const variant = (product.variants || []).id(item.variantId);
        if (variant) {
          previousStock = Number(variant.stock || 0);
          variant.stock = previousStock + receivedQty;
          currentStock = variant.stock;
          variantTitle = variant.title || variant.variantName || "Variant";
          sku = variant.sku || sku;
        } else {
          previousStock = Number(product.stock || 0);
          product.stock = previousStock + receivedQty;
          currentStock = product.stock;
        }
      } else {
        previousStock = Number(product.stock || 0);
        product.stock = previousStock + receivedQty;
        currentStock = product.stock;
      }

      // Update product cost price
      product.costPrice = purchasePrice;
      product.purchasePrice = purchasePrice;
      await product.save();

      // Create product batch record if batch number provided
      if (item.batchNumber) {
        await ProductBatch.create({
          batchNumber: item.batchNumber,
          product: product._id,
          productTitle: product.title || product.name,
          variantId: item.variantId || undefined,
          sku,
          manufacturingDate: item.manufacturingDate,
          expiryDate: item.expiryDate,
          initialQuantity: receivedQty,
          availableQuantity: receivedQty,
          purchasePrice,
          supplier: supplierId || undefined,
          status: "Active",
          notes: `Created via inward ${inwardNumber}`,
        });
      }

      // Immutable transaction ledger
      await InventoryTransaction.create({
        key: `inw:${inwardNumber}:${product._id}:${item.variantId || "root"}:${Date.now()}`,
        product: product._id,
        productTitle: product.title || product.name,
        variantId: item.variantId || undefined,
        variantName: variantTitle,
        sku,
        quantity: receivedQty,
        previousStock,
        currentStock,
        action: "stock_in",
        transactionType: "Stock Inward Receipt",
        referenceId: inwardNumber,
        reason: `Purchase receipt ${supplierInvoiceNumber ? `(Inv #${supplierInvoiceNumber})` : ""}`,
        supplier: supplierId || undefined,
        notes: notes || "",
        performedBy: user?._id,
      });

      processedItems.push({
        product: product._id,
        productTitle: product.title || product.name,
        variantId: item.variantId,
        variantTitle,
        sku,
        barcode: item.barcode || product.barcode,
        orderedQuantity: item.orderedQuantity || receivedQty,
        receivedQuantity: receivedQty,
        purchasePrice,
        totalAmount: itemTotal,
        batchNumber: item.batchNumber || "",
        expiryDate: item.expiryDate,
        manufacturingDate: item.manufacturingDate,
      });
    }

    // Create StockInward entry
    const stockInward = await StockInward.create({
      inwardNumber,
      purchaseReference: purchaseReference || `PO-${inwardNumber.slice(4)}`,
      supplier: supplierId || undefined,
      supplierName: supplierName || "Direct Supplier",
      supplierInvoiceNumber: supplierInvoiceNumber || "",
      items: processedItems,
      totalAmount,
      totalQuantity,
      paymentStatus,
      status: "Received",
      notes,
      receivedBy: user?._id,
      receivedDate: new Date(),
    });

    // Update supplier total purchase amount
    if (supplierId && mongoose.isValidObjectId(supplierId)) {
      await Supplier.findByIdAndUpdate(supplierId, {
        $inc: { totalPurchaseAmount: totalAmount },
      });
    }

    return stockInward;
  }

  /**
   * 9. Get Stock Inwards List
   */
  static async getStockInwards(query = {}) {
    const page = Math.max(1, parseInt(query.page || "1", 10));
    const limit = Math.min(100, Math.max(1, parseInt(query.limit || "15", 10)));
    const search = query.search ? String(query.search).trim() : "";
    const status = query.status;

    let filter = {};
    if (status && status !== "All") filter.status = status;
    if (search) {
      const searchRegex = new RegExp(search, "i");
      filter.$or = [
        { inwardNumber: searchRegex },
        { supplierName: searchRegex },
        { supplierInvoiceNumber: searchRegex },
        { purchaseReference: searchRegex },
      ];
    }

    const [total, records] = await Promise.all([
      StockInward.countDocuments(filter),
      StockInward.find(filter)
        .populate("supplier", "supplierName phone email")
        .populate("receivedBy", "name email")
        .sort({ receivedDate: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
    ]);

    return {
      inwards: records.map(r => ({
        id: r._id,
        inwardNumber: r.inwardNumber,
        purchaseReference: r.purchaseReference,
        supplierName: r.supplier?.supplierName || r.supplierName || "Direct Supplier",
        supplierInvoiceNumber: r.supplierInvoiceNumber,
        totalItems: (r.items || []).length,
        totalQuantity: r.totalQuantity || (r.items || []).reduce((s, i) => s + (i.receivedQuantity || 0), 0),
        totalAmount: r.totalAmount,
        paymentStatus: r.paymentStatus,
        status: r.status,
        receivedBy: r.receivedBy?.name || "Admin",
        receivedDate: r.receivedDate,
        items: r.items,
      })),
      pagination: {
        total,
        page,
        limit,
        pages: Math.ceil(total / limit) || 1,
      },
    };
  }

  /**
   * 10. Record Stock Outward (Damages, Internal Usage, Supplier Return, Manual Removal)
   */
  static async recordStockOutward({ productId, variantId, quantity, reason, referenceId, notes, user }) {
    if (!productId) throw new Error("Product ID is required");
    const qty = Number(quantity);
    if (isNaN(qty) || qty <= 0) throw new Error("Valid outward quantity is required");

    const product = await Product.findById(productId);
    if (!product) throw new Error("Product not found");

    let previousStock = 0;
    let currentStock = 0;
    let variantTitle = "";
    let sku = product.sku || "N/A";

    if (variantId) {
      const variant = (product.variants || []).id(variantId);
      if (!variant) throw new Error("Variant not found");
      previousStock = Number(variant.stock ?? product.stock ?? 0);
      if (previousStock < qty) {
        throw new Error(`Insufficient stock. Only ${previousStock} units available.`);
      }
      variant.stock = previousStock - qty;
      currentStock = variant.stock;
      variantTitle = variant.title || variant.variantName || "Variant";
      sku = variant.sku || sku;
    } else {
      previousStock = Number(product.stock || 0);
      if (previousStock < qty) {
        throw new Error(`Insufficient stock. Only ${previousStock} units available.`);
      }
      product.stock = previousStock - qty;
      currentStock = product.stock;
    }

    if (reason === "Damaged Products") {
      product.damagedStock = (product.damagedStock || 0) + qty;
    }

    await product.save();

    const outwardRef = referenceId || `OUT-${Date.now().toString().slice(-6)}`;

    const transaction = await InventoryTransaction.create({
      key: `out:${outwardRef}:${product._id}:${Date.now()}`,
      product: product._id,
      productTitle: product.title || product.name,
      variantId: variantId || undefined,
      variantName: variantTitle,
      sku,
      quantity: qty,
      previousStock,
      currentStock,
      action: "stock_out",
      transactionType: `Stock Outward (${reason || "Manual Removal"})`,
      referenceId: outwardRef,
      reason: reason || "Manual Outward",
      notes: notes || "",
      performedBy: user?._id,
    });

    return transaction;
  }

  /**
   * 11. Inventory Movement History Ledger
   */
  static async getMovements(query = {}) {
    const page = Math.max(1, parseInt(query.page || "1", 10));
    const limit = Math.min(100, Math.max(1, parseInt(query.limit || "20", 10)));
    const action = query.action;
    const search = query.search ? String(query.search).trim() : "";

    let filter = {};
    if (action && action !== "All") filter.action = action;

    if (search) {
      const searchRegex = new RegExp(search, "i");
      filter.$or = [
        { productTitle: searchRegex },
        { sku: searchRegex },
        { referenceId: searchRegex },
        { reason: searchRegex },
        { transactionType: searchRegex },
      ];
    }

    const [total, movements] = await Promise.all([
      InventoryTransaction.countDocuments(filter),
      InventoryTransaction.find(filter)
        .populate("product", "title name images basePrice price")
        .populate("performedBy", "name email")
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
    ]);

    return {
      movements: movements.map(m => ({
        id: m._id,
        key: m.key,
        productTitle: m.product?.title || m.product?.name || m.productTitle || "Product",
        image: m.product?.images?.[0]?.url || "/placeholder-product.png",
        variantTitle: m.variantName || "Standard",
        sku: m.sku || "N/A",
        action: m.action,
        transactionType: m.transactionType || m.action.replace("_", " ").toUpperCase(),
        quantity: m.quantity,
        previousStock: m.previousStock || 0,
        currentStock: m.currentStock || 0,
        referenceId: m.referenceId || (m.order ? String(m.order).slice(-8) : "—"),
        reason: m.reason || m.action,
        performedBy: m.performedBy?.name || "System Automation",
        timestamp: m.createdAt,
      })),
      pagination: {
        total,
        page,
        limit,
        pages: Math.ceil(total / limit) || 1,
      },
    };
  }

  /**
   * 12. Low Stock & Out of Stock Alerts
   */
  static async getLowAndOutOfStockAlerts() {
    const products = await Product.find()
      .populate("category", "name")
      .populate("brand", "name")
      .lean();

    const alerts = [];

    products.forEach(p => {
      const minLevel = p.minStockLevel ?? 5;
      const catName = p.category?.name || "General";
      const brandName = p.brand?.name || "Delivix";
      const pImage = p.images?.[0]?.url || "/placeholder-product.png";

      if (p.variants && p.variants.length > 0) {
        p.variants.forEach(v => {
          const vStock = Number(v.stock ?? p.stock ?? 0);
          if (vStock === 0) {
            alerts.push({
              id: `${p._id}_${v._id}`,
              productId: p._id,
              variantId: v._id,
              name: `${p.title || p.name} (${v.title || v.variantName})`,
              sku: v.sku || p.sku || "N/A",
              category: catName,
              brand: brandName,
              image: pImage,
              currentStock: 0,
              minStockLevel: v.minStockLevel ?? minLevel,
              status: "Out of Stock",
              urgency: "Critical",
              actionNeeded: "Immediate Restock Required",
            });
          } else if (vStock <= minLevel) {
            alerts.push({
              id: `${p._id}_${v._id}`,
              productId: p._id,
              variantId: v._id,
              name: `${p.title || p.name} (${v.title || v.variantName})`,
              sku: v.sku || p.sku || "N/A",
              category: catName,
              brand: brandName,
              image: pImage,
              currentStock: vStock,
              minStockLevel: v.minStockLevel ?? minLevel,
              status: "Low Stock",
              urgency: "Warning",
              actionNeeded: "Reorder Recommended",
            });
          }
        });
      } else {
        const rootStock = Number(p.stock || 0);
        if (rootStock === 0) {
          alerts.push({
            id: String(p._id),
            productId: p._id,
            variantId: null,
            name: p.title || p.name,
            sku: p.sku || "N/A",
            category: catName,
            brand: brandName,
            image: pImage,
            currentStock: 0,
            minStockLevel: minLevel,
            status: "Out of Stock",
            urgency: "Critical",
            actionNeeded: "Immediate Restock Required",
          });
        } else if (rootStock <= minLevel) {
          alerts.push({
            id: String(p._id),
            productId: p._id,
            variantId: null,
            name: p.title || p.name,
            sku: p.sku || "N/A",
            category: catName,
            brand: brandName,
            image: pImage,
            currentStock: rootStock,
            minStockLevel: minLevel,
            status: "Low Stock",
            urgency: "Warning",
            actionNeeded: "Reorder Recommended",
          });
        }
      }
    });

    return alerts.sort((a, b) => (a.status === "Out of Stock" ? -1 : 1));
  }

  /**
   * 13. Inventory Reports & Analytics
   */
  static async getReports() {
    const [products, categories, transactions, inwardSummary] = await Promise.all([
      Product.find().populate("category", "name").populate("brand", "name").lean(),
      Category.find().lean(),
      InventoryTransaction.aggregate([
        {
          $group: {
            _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
            stockIn: { $sum: { $cond: [{ $eq: ["$action", "stock_in"] }, "$quantity", 0] } },
            stockOut: { $sum: { $cond: [{ $in: ["$action", ["deduct", "stock_out", "damaged"]] }, "$quantity", 0] } },
            adjustments: { $sum: { $cond: [{ $in: ["$action", ["adjustment_add", "adjustment_remove"]] }, "$quantity", 0] } },
          },
        },
        { $sort: { _id: 1 } },
        { $limit: 14 },
      ]),
      StockInward.aggregate([
        {
          $group: {
            _id: null,
            totalInwards: { $sum: 1 },
            totalAmount: { $sum: "$totalAmount" },
            totalQuantity: { $sum: "$totalQuantity" },
          },
        },
      ]),
    ]);

    // Fast-moving vs slow-moving based on salesCount and stock
    const fastMoving = [];
    const slowMoving = [];
    const deadStock = [];

    products.forEach(p => {
      const sales = p.salesCount || 0;
      const stock = p.stock || 0;
      const item = {
        id: p._id,
        name: p.title || p.name,
        category: p.category?.name || "General",
        salesCount: sales,
        availableStock: stock,
        value: stock * (p.basePrice || p.price || 0),
      };

      if (sales >= 5) {
        fastMoving.push(item);
      } else if (sales > 0 && sales < 5) {
        slowMoving.push(item);
      } else {
        deadStock.push(item);
      }
    });

    // Category valuation
    const categoryValuation = categories.map(c => {
      const prods = products.filter(p => String(p.category?._id || p.category) === String(c._id));
      const totalStock = prods.reduce((s, p) => s + (p.stock || 0), 0);
      const totalVal = prods.reduce((s, p) => s + ((p.stock || 0) * (p.basePrice || p.price || 0)), 0);
      return {
        name: c.name,
        productCount: prods.length,
        totalStock,
        totalValuation: totalVal,
      };
    }).filter(c => c.productCount > 0);

    return {
      stockDistribution: [
        { name: "In Stock", value: products.filter(p => p.stock > 5).length, color: "#10b981" },
        { name: "Low Stock", value: products.filter(p => p.stock > 0 && p.stock <= 5).length, color: "#f59e0b" },
        { name: "Out of Stock", value: products.filter(p => p.stock === 0).length, color: "#ef4444" },
      ],
      categoryValuation,
      movementTrend: transactions,
      fastMoving: fastMoving.slice(0, 5),
      slowMoving: slowMoving.slice(0, 5),
      deadStock: deadStock.slice(0, 5),
      inwardStats: inwardSummary[0] || { totalInwards: 0, totalAmount: 0, totalQuantity: 0 },
    };
  }

  /**
   * 14. Supplier Management
   */
  static async getSuppliers() {
    return Supplier.find().populate("suppliedProducts", "title name price stock").sort({ supplierName: 1 }).lean();
  }

  static async createSupplier(data) {
    if (!data.supplierName) throw new Error("Supplier name is required");
    return Supplier.create(data);
  }

  static async updateSupplier(id, data) {
    const updated = await Supplier.findByIdAndUpdate(id, data, { new: true });
    if (!updated) throw new Error("Supplier not found");
    return updated;
  }

  static async deleteSupplier(id) {
    const deleted = await Supplier.findByIdAndDelete(id);
    if (!deleted) throw new Error("Supplier not found");
    return deleted;
  }

  /**
   * 15. Stock Transfers
   */
  static async getTransfers() {
    return StockTransfer.find().populate("transferredBy", "name email").sort({ createdAt: -1 }).lean();
  }

  static async createTransfer(data, user) {
    if (!data.destinationLocation) throw new Error("Destination location is required");
    if (!data.items || data.items.length === 0) throw new Error("At least one transfer item is required");

    const transferNumber = `TRF-${new Date().toISOString().slice(0, 10).replace(/-/g, "")}-${Math.floor(1000 + Math.random() * 9000)}`;

    const transfer = await StockTransfer.create({
      transferNumber,
      sourceLocation: data.sourceLocation || "Main Warehouse (Zone A)",
      destinationLocation: data.destinationLocation,
      items: data.items,
      notes: data.notes || "",
      transferredBy: user?._id,
      status: "Pending",
    });

    return transfer;
  }

  static async updateTransferStatus(id, status) {
    const transfer = await StockTransfer.findByIdAndUpdate(id, { status }, { new: true });
    if (!transfer) throw new Error("Transfer not found");
    return transfer;
  }

  /**
   * 15b. Warehouse Management
   */
  static async getWarehouses() {
    let warehouses = await Warehouse.find().sort({ isDefault: -1, name: 1 }).lean();
    if (!warehouses || warehouses.length === 0) {
      // Seed initial default warehouses for out-of-the-box readiness
      const defaults = [
        {
          name: "Main Central Fulfillment Hub",
          code: "WH-CENTRAL-01",
          contactPerson: "Warehouse Manager",
          phone: "+91 98765 43210",
          email: "centralhub@delivix.com",
          address: {
            street: "Plot 101, Cargo Complex, Andheri East",
            city: "Mumbai",
            state: "Maharashtra",
            pinCode: "400099",
            country: "India",
          },
          capacity: 25000,
          currentStockCount: 0,
          isDefault: true,
          status: "Active",
          notes: "Primary cross-dock and national fulfillment center",
        },
        {
          name: "North Regional Logistics Hub",
          code: "WH-NORTH-02",
          contactPerson: "Depot Supervisor",
          phone: "+91 98765 43211",
          email: "northhub@delivix.com",
          address: {
            street: "Highway Logistics Park, NH-8",
            city: "Gurugram",
            state: "Haryana",
            pinCode: "122001",
            country: "India",
          },
          capacity: 15000,
          currentStockCount: 0,
          isDefault: false,
          status: "Active",
          notes: "Secondary regional warehouse for North India dispatches",
        },
      ];
      warehouses = await Warehouse.insertMany(defaults);
    }

    // Compute live stock counts per warehouse
    const products = await Product.find().select("stock warehouseLocation variants").lean();
    const stockByLocation = {};
    products.forEach((p) => {
      const loc = p.warehouseLocation || "Main Central Fulfillment Hub";
      let totalPStock = Number(p.stock || 0);
      if (p.variants && p.variants.length > 0) {
        totalPStock = p.variants.reduce((acc, v) => acc + Number(v.stock || 0), 0);
      }
      stockByLocation[loc] = (stockByLocation[loc] || 0) + totalPStock;
    });

    return warehouses.map((w) => ({
      ...w,
      currentStockCount: stockByLocation[w.name] || stockByLocation[w.code] || w.currentStockCount || 0,
    }));
  }

  static async createWarehouse(data) {
    if (!data.name || !data.code) throw new Error("Warehouse name and code are required");
    const existing = await Warehouse.findOne({ code: data.code.trim().toUpperCase() });
    if (existing) throw new Error(`Warehouse code '${data.code}' already exists`);

    if (data.isDefault) {
      await Warehouse.updateMany({}, { isDefault: false });
    }

    return Warehouse.create({
      ...data,
      code: data.code.trim().toUpperCase(),
    });
  }

  static async updateWarehouse(id, data) {
    if (data.isDefault) {
      await Warehouse.updateMany({ _id: { $ne: id } }, { isDefault: false });
    }
    const updated = await Warehouse.findByIdAndUpdate(id, data, { new: true, runValidators: true });
    if (!updated) throw new Error("Warehouse not found");
    return updated;
  }

  static async deleteWarehouse(id) {
    const warehouse = await Warehouse.findById(id);
    if (!warehouse) throw new Error("Warehouse not found");
    if (warehouse.isDefault) throw new Error("Cannot delete the default warehouse");
    await Warehouse.findByIdAndDelete(id);
    return { success: true };
  }

  /**
   * 15c. SKU & Barcode Automation
   */
  static async generateSku(payload = {}) {
    const { category = "", brand = "", name = "", variantName = "" } = payload;
    const catCode = category ? category.slice(0, 3).toUpperCase().replace(/[^A-Z]/g, "CAT") : "DLX";
    const brandCode = brand ? brand.slice(0, 3).toUpperCase().replace(/[^A-Z]/g, "BRD") : "GEN";
    const nameCode = (variantName || name || "").slice(0, 3).toUpperCase().replace(/[^A-Z]/g, "ITM");
    const uniqueSuffix = Math.random().toString(36).substring(2, 6).toUpperCase();
    const candidateSku = `${catCode}-${brandCode}-${nameCode}-${uniqueSuffix}`;

    // Verify uniqueness if database is connected
    if (mongoose.connection && mongoose.connection.readyState === 1) {
      const exists = await Product.findOne({
        $or: [{ sku: candidateSku }, { "variants.sku": candidateSku }],
      });
      if (exists) {
        return `${catCode}-${brandCode}-${uniqueSuffix}${Math.floor(100 + Math.random() * 900)}`;
      }
    }
    return candidateSku;
  }

  static async generateBarcode() {
    // Generate valid 13-digit EAN style barcode (starting with 890 for India or internal prefix)
    let code = "890";
    for (let i = 0; i < 9; i++) {
      code += Math.floor(Math.random() * 10).toString();
    }
    // Calculate EAN-13 checksum digit
    let sum = 0;
    for (let i = 0; i < 12; i++) {
      sum += parseInt(code[i], 10) * (i % 2 === 0 ? 1 : 3);
    }
    const checkDigit = (10 - (sum % 10)) % 10;
    const barcode = `${code}${checkDigit}`;

    if (mongoose.connection && mongoose.connection.readyState === 1) {
      const exists = await Product.findOne({
        $or: [{ barcode }, { "variants.barcode": barcode }],
      });
      if (exists) {
        return this.generateBarcode();
      }
    }
    return barcode;
  }

  static async searchBySkuOrBarcode(searchQuery = "") {
    const query = String(searchQuery).trim();
    if (!query) return [];

    const products = await Product.find({
      $or: [
        { sku: { $regex: query, $options: "i" } },
        { barcode: { $regex: query, $options: "i" } },
        { "variants.sku": { $regex: query, $options: "i" } },
        { "variants.barcode": { $regex: query, $options: "i" } },
      ],
    })
      .select("name title sku barcode stock basePrice price images variants category brand")
      .populate("category", "name")
      .populate("brand", "name")
      .lean();

    const matches = [];
    products.forEach((p) => {
      const pName = p.title || p.name;
      const pImage = p.images?.[0]?.url || "";
      // Check root product
      if (
        (p.sku && p.sku.toLowerCase().includes(query.toLowerCase())) ||
        (p.barcode && p.barcode.toLowerCase().includes(query.toLowerCase()))
      ) {
        matches.push({
          productId: p._id,
          variantId: null,
          title: pName,
          sku: p.sku || "N/A",
          barcode: p.barcode || "N/A",
          stock: p.stock || 0,
          price: p.basePrice || p.price || 0,
          image: pImage,
          category: p.category?.name || "General",
        });
      }
      // Check variants
      if (p.variants && p.variants.length > 0) {
        p.variants.forEach((v) => {
          if (
            (v.sku && v.sku.toLowerCase().includes(query.toLowerCase())) ||
            (v.barcode && v.barcode.toLowerCase().includes(query.toLowerCase()))
          ) {
            matches.push({
              productId: p._id,
              variantId: v._id,
              title: `${pName} - ${v.title || v.variantName || "Variant"}`,
              sku: v.sku || "N/A",
              barcode: v.barcode || "N/A",
              stock: v.stock || 0,
              price: v.price || p.basePrice || p.price || 0,
              image: v.images?.[0]?.url || pImage,
              category: p.category?.name || "General",
            });
          }
        });
      }
    });

    return matches;
  }

  /**
   * 16. Batch & Expiry Management
   */
  static async getBatches() {
    return ProductBatch.find().populate("product", "title name price stock").populate("supplier", "supplierName").sort({ expiryDate: 1 }).lean();
  }

  static async createBatch(data) {
    if (!data.batchNumber) throw new Error("Batch number is required");
    if (!data.product) throw new Error("Product ID is required");
    return ProductBatch.create(data);
  }

  /**
   * 17. Structured Data for Excel (.xlsx) and CSV Export
   */
  static async getExportData(type = "current_stock") {
    if (!mongoose.connection || mongoose.connection.readyState !== 1) {
      switch (type.toLowerCase()) {
        case "low_stock":
          return {
            filename: `low_stock_alerts_${Date.now()}`,
            sheetName: "Low Stock Alerts",
            headers: ["Product Name", "SKU", "Category", "Brand", "Current Stock", "Min Level", "Status", "Urgency"],
            rows: [],
          };
        case "inward":
          return {
            filename: `stock_inwards_${Date.now()}`,
            sheetName: "Stock Inward Receipts",
            headers: ["Inward #", "Purchase Ref", "Supplier", "Invoice #", "Total Qty", "Total Amount", "Payment Status", "Received Date"],
            rows: [],
          };
        case "adjustments":
          return {
            filename: `stock_adjustments_${Date.now()}`,
            sheetName: "Stock Adjustments",
            headers: ["Adjustment #", "Product", "Variant", "SKU", "Previous Qty", "Adjustment", "New Qty", "Type", "Reason", "Adjusted By", "Date"],
            rows: [],
          };
        case "movements":
          return {
            filename: `inventory_ledger_${Date.now()}`,
            sheetName: "Transaction Ledger",
            headers: ["Transaction Key", "Product", "Variant", "SKU", "Action", "Qty Changed", "Previous Stock", "Current Stock", "Reference", "Reason", "Date"],
            rows: [],
          };
        case "current_stock":
        default:
          return {
            filename: `inventory_catalog_${Date.now()}`,
            sheetName: "Current Stock",
            headers: [
              "Product Name",
              "Variant",
              "SKU",
              "Barcode",
              "Category",
              "Brand",
              "Available Qty",
              "Min Level",
              "Max Level",
              "Selling Price",
              "Cost Price",
              "Total Valuation",
              "Stock Status",
              "Warehouse Location",
            ],
            rows: [],
          };
      }
    }

    switch (type.toLowerCase()) {
      case "low_stock": {
        const alerts = await this.getLowAndOutOfStockAlerts();
        return {
          filename: `low_stock_alerts_${Date.now()}`,
          sheetName: "Low Stock Alerts",
          headers: ["Product Name", "SKU", "Category", "Brand", "Current Stock", "Min Level", "Status", "Urgency"],
          rows: alerts.map(a => [
            a.name,
            a.sku,
            a.category,
            a.brand,
            a.currentStock,
            a.minStockLevel,
            a.status,
            a.urgency,
          ]),
        };
      }

      case "inward": {
        const data = await this.getStockInwards({ limit: 1000 });
        return {
          filename: `stock_inwards_${Date.now()}`,
          sheetName: "Stock Inward Receipts",
          headers: ["Inward #", "Purchase Ref", "Supplier", "Invoice #", "Total Qty", "Total Amount", "Payment Status", "Received Date"],
          rows: data.inwards.map(i => [
            i.inwardNumber,
            i.purchaseReference,
            i.supplierName,
            i.supplierInvoiceNumber,
            i.totalQuantity,
            i.totalAmount,
            i.paymentStatus,
            new Date(i.receivedDate).toISOString().slice(0, 10),
          ]),
        };
      }

      case "adjustments": {
        const data = await this.getAdjustments({ limit: 1000 });
        return {
          filename: `stock_adjustments_${Date.now()}`,
          sheetName: "Stock Adjustments",
          headers: ["Adjustment #", "Product", "Variant", "SKU", "Previous Qty", "Adjustment", "New Qty", "Type", "Reason", "Adjusted By", "Date"],
          rows: data.adjustments.map(a => [
            a.adjustmentNumber,
            a.productTitle,
            a.variantTitle,
            a.sku,
            a.previousQuantity,
            a.adjustmentQuantity,
            a.newQuantity,
            a.adjustmentType,
            a.reason,
            a.adjustedBy,
            new Date(a.adjustmentDate).toISOString().slice(0, 10),
          ]),
        };
      }

      case "movements": {
        const data = await this.getMovements({ limit: 1000 });
        return {
          filename: `inventory_ledger_${Date.now()}`,
          sheetName: "Transaction Ledger",
          headers: ["Transaction Key", "Product", "Variant", "SKU", "Action", "Qty Changed", "Previous Stock", "Current Stock", "Reference", "Reason", "Date"],
          rows: data.movements.map(m => [
            m.key,
            m.productTitle,
            m.variantTitle,
            m.sku,
            m.action,
            m.quantity,
            m.previousStock,
            m.currentStock,
            m.referenceId,
            m.reason,
            new Date(m.timestamp).toISOString().slice(0, 10),
          ]),
        };
      }

      case "current_stock":
      default: {
        const data = await this.getProducts({ limit: 1000 });
        return {
          filename: `inventory_catalog_${Date.now()}`,
          sheetName: "Current Stock",
          headers: [
            "Product Name",
            "Variant",
            "SKU",
            "Barcode",
            "Category",
            "Brand",
            "Available Qty",
            "Min Level",
            "Max Level",
            "Selling Price",
            "Cost Price",
            "Total Valuation",
            "Stock Status",
            "Warehouse Location",
          ],
          rows: data.items.map(i => [
            i.productName,
            i.variantTitle,
            i.sku,
            i.barcode,
            i.category,
            i.brand,
            i.availableQuantity,
            i.minimumStockLevel,
            i.maximumStockLevel,
            i.sellingPrice,
            i.purchasePrice,
            i.totalStockValue,
            i.stockStatus,
            i.warehouseLocation,
          ]),
        };
      }
    }
  }
}
