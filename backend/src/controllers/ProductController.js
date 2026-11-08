import ProductService from "../services/ProductService.js";
import { sendResponse } from "../helpers/response.js";
import { clearCache } from "../middleware/cache.js";
import ErrorHandler from "../utils/errorHandler.js";
import * as XLSX from "xlsx";

const clearProductCache = async (id = null) => {
  const keys = [
    "/api/v1/products",
    "/api/v1/products/filter-options",
    "shk:products",
    "/api/v1/brands",
  ];
  if (id) {
    keys.push(`/api/v1/products/${id}`, `shk:product:id:${id}`);
  }
  await Promise.all(keys.map((key) => clearCache(key)));
};

export class ProductController {
  async getProducts(req, res, next) {
    try {
      const result = await ProductService.getProducts(req.query);
      return sendResponse(res, 200, true, "Products fetched successfully", {
        results: result.count,
        totalProducts: result.totalProducts,
        page: result.page,
        perPage: result.perPage,
        products: result.products,
      });
    } catch (error) {
      next(error);
    }
  }

  async getFilterOptions(req, res, next) {
    try {
      const options = await ProductService.getFilterOptions();
      return sendResponse(res, 200, true, "Filter options fetched successfully", options);
    } catch (error) {
      next(error);
    }
  }

  async getAdminProducts(req, res, next) {
    try {
      const result = await ProductService.getAdminProducts(req.query);
      return sendResponse(res, 200, true, "Admin products fetched successfully", result);
    } catch (error) {
      next(error);
    }
  }

  async getAdminProductStats(req, res, next) {
    try {
      const stats = await ProductService.getAdminProductStats();
      return sendResponse(res, 200, true, "Product statistics fetched successfully", { stats });
    } catch (error) {
      next(error);
    }
  }

  async getAdminProductById(req, res, next) {
    try {
      const product = await ProductService.getAdminProductById(req.params.id);
      return sendResponse(res, 200, true, "Product fetched successfully", { product });
    } catch (error) {
      next(error);
    }
  }

  async getProductById(req, res, next) {
    try {
      const product = await ProductService.getProductById(req.params.id);
      return sendResponse(res, 200, true, "Product details fetched successfully", { product });
    } catch (error) {
      next(error);
    }
  }

  async createProduct(req, res, next) {
    try {
      const userId = req.user ? req.user._id : null;
      const product = await ProductService.createProduct(req.body, userId);
      await clearProductCache(product._id);
      return sendResponse(res, 201, true, "Product created successfully", { product });
    } catch (error) {
      next(error);
    }
  }

  async updateProduct(req, res, next) {
    try {
      const product = await ProductService.updateProduct(req.params.id, req.body);
      await clearProductCache(req.params.id);
      return sendResponse(res, 200, true, "Product updated successfully", { product });
    } catch (error) {
      next(error);
    }
  }

  async deleteProduct(req, res, next) {
    try {
      await ProductService.deleteProduct(req.params.id);
      await clearProductCache(req.params.id);
      return sendResponse(res, 200, true, "Product deleted successfully");
    } catch (error) {
      next(error);
    }
  }

  async duplicateProduct(req, res, next) {
    try {
      const product = await ProductService.duplicateProduct(req.params.id);
      await clearProductCache(product._id);
      return sendResponse(res, 201, true, "Product duplicated successfully", { product });
    } catch (error) {
      next(error);
    }
  }

  async bulkUpdateProducts(req, res, next) {
    try {
      const result = await ProductService.bulkUpdateProducts(req.body);
      await clearProductCache();
      return sendResponse(res, 200, true, "Bulk product action completed", result);
    } catch (error) {
      next(error);
    }
  }

  async exportProducts(req, res, next) {
    try {
      const format = req.query.format === "xlsx" ? "xlsx" : "csv";
      const { rows } = await ProductService.exportProducts(req.query, format);

      const worksheet = XLSX.utils.json_to_sheet(rows);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Products");
      const buffer = XLSX.write(workbook, {
        bookType: format === "xlsx" ? "xlsx" : "csv",
        type: "buffer",
      });

      const filename = `delivix-products-${new Date().toISOString().slice(0, 10)}.${format}`;
      res.setHeader(
        "Content-Type",
        format === "xlsx"
          ? "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          : "text/csv; charset=utf-8"
      );
      res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
      return res.status(200).send(buffer);
    } catch (error) {
      next(error);
    }
  }

  async importProducts(req, res, next) {
    try {
      const rows = Array.isArray(req.body?.rows) ? req.body.rows : [];
      if (!rows.length) return next(new ErrorHandler("Upload a CSV or Excel file with at least one row", 400));

      const result = await ProductService.importProducts(rows);
      await clearProductCache();
      return sendResponse(res, 200, true, "Product import completed", result);
    } catch (error) {
      next(error);
    }
  }

  // --- Legacy review endpoints (kept for compatibility) ---
  async createProductReview(req, res, next) {
    try {
      const product = await ProductService.addProductReview(
        req.body.productId,
        req.body,
        req.user._id
      );
      return sendResponse(res, 200, true, "Review added successfully", { product });
    } catch (error) {
      next(error);
    }
  }

  async getProductReviews(req, res, next) {
    try {
      const reviews = await ProductService.getProductReviews(req.query.id);
      return sendResponse(res, 200, true, "Product reviews fetched successfully", { reviews });
    } catch (error) {
      next(error);
    }
  }

  async deleteReview(req, res, next) {
    try {
      const product = await ProductService.deleteProductReview(
        req.query.productId,
        req.query.id
      );
      return sendResponse(res, 200, true, "Review deleted successfully", { product });
    } catch (error) {
      next(error);
    }
  }

  // --- Visual search ---
  async visualSearchProducts(req, res, next) {
    try {
      const results = await ProductService.visualSearch(req.body.embedding);
      return sendResponse(res, 200, true, "Visual search matches fetched", {
        results: results.length,
        products: results,
      });
    } catch (error) {
      next(error);
    }
  }
}

export default new ProductController();
