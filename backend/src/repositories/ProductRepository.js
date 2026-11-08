import { BaseRepository } from "./BaseRepository.js";
import Product from "../models/product.js";

export class ProductRepository extends BaseRepository {
  constructor() {
    super(Product);
  }

  async findWithFilters(filters = {}, options = {}) {
    return this.find(filters, options);
  }

  async findWithVisualEmbeddings(options = {}) {
    const defaultOptions = {
      select: "+visualEmbedding name price description images video category ratings stock numOfReviews status",
      populate: { path: "category", select: "name" },
      lean: true,
      ...options
    };
    return this.find({ 
      visualEmbedding: { $exists: true, $ne: [] },
      status: { $ne: "draft" }
    }, defaultOptions);
  }

  async addReview(productId, review) {
    return this.model.findByIdAndUpdate(
      productId,
      {
        $push: { reviews: review },
        $inc: { numOfReviews: 1 }
      },
      { new: true }
    ).exec();
  }

  async removeReview(productId, reviewId) {
    return this.model.findByIdAndUpdate(
      productId,
      {
        $pull: { reviews: { _id: reviewId } },
        $inc: { numOfReviews: -1 }
      },
      { new: true }
    ).exec();
  }
}

export default new ProductRepository();
