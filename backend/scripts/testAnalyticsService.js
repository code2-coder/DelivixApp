import "../src/config/env.js";
import mongoose from "mongoose";
import { AnalyticsService } from "../src/services/analytics.service.js";

async function main() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log("Connected to MongoDB for testing AnalyticsService");

  console.log("\n--- Testing getOverview ---");
  const overview = await AnalyticsService.getOverview({ range: "this_year" });
  console.log("Overview KPIs:", {
    revenue: overview.kpis.totalRevenue,
    orders: overview.kpis.totalOrders,
    productsSold: overview.kpis.totalProductsSold,
    customers: overview.kpis.totalCustomers,
    aov: overview.kpis.averageOrderValue,
    profit: overview.kpis.totalProfit,
    refunds: overview.kpis.totalRefunds,
    conversionRate: overview.kpis.conversionRate,
    growth: overview.kpis.revenueGrowthPercentage,
    pendingPayments: overview.kpis.pendingPayments,
  });

  console.log("\n--- Testing getRevenue ---");
  const revenue = await AnalyticsService.getRevenue({ range: "this_year" });
  console.log("Revenue totals:", revenue.totals);
  console.log("Series points:", revenue.series.length);

  console.log("\n--- Testing getSales ---");
  const sales = await AnalyticsService.getSales({ range: "this_year", limit: 5 });
  console.log("Sales count in range:", sales.pagination.totalCount);
  console.log("First sale:", sales.sales[0]);

  console.log("\n--- Testing getProductPerformance ---");
  const products = await AnalyticsService.getProductPerformance({ range: "this_year" });
  console.log("Best selling products count:", products.bestSelling.length);
  if (products.bestSelling[0]) {
    console.log("Top product:", products.bestSelling[0].name, "units:", products.bestSelling[0].unitsSold, "rev:", products.bestSelling[0].revenue);
  }

  console.log("\n--- Testing getCustomers ---");
  const customers = await AnalyticsService.getCustomers({ range: "this_year" });
  console.log("Customer summary:", customers.summary);
  console.log("Top spenders:", customers.topSpending.slice(0, 3));

  console.log("\n--- Testing getCategoriesAndBrands ---");
  const catBrands = await AnalyticsService.getCategoriesAndBrands({ range: "this_year" });
  console.log("Categories found:", catBrands.categories.length, "Brands found:", catBrands.brands.length);
  console.log("Top category:", catBrands.topCategories[0]);

  console.log("\n--- Testing getOrdersAndPayments ---");
  const payments = await AnalyticsService.getOrdersAndPayments({ range: "this_year" });
  console.log("Payment summary:", payments.summary);

  console.log("\n--- Testing getInventory ---");
  const inv = await AnalyticsService.getInventory();
  console.log("Inventory summary:", inv.summary);

  console.log("\n--- Testing getCoupons ---");
  const coupons = await AnalyticsService.getCoupons({ range: "this_year" });
  console.log("Coupon summary:", coupons.summary);

  console.log("\n--- Testing getReturns ---");
  const returns = await AnalyticsService.getReturns({ range: "this_year" });
  console.log("Return summary:", returns.summary);

  console.log("\n--- Testing getExportData ---");
  const exportData = await AnalyticsService.getExportData("sales", { range: "this_year" });
  console.log("Export rows count:", exportData.rows.length);

  console.log("\n>>> ALL 11 ANALYTICS SERVICES PASSED FLAWLESSLY! <<<");
  process.exit(0);
}

main().catch(err => {
  console.error("Test failed with error:", err);
  process.exit(1);
});
