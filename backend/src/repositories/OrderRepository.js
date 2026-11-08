import { BaseRepository } from "./BaseRepository.js";
import Order from "../models/order.js";

export class OrderRepository extends BaseRepository {
  constructor() {
    super(Order);
  }

  async findByUserId(userId, options = {}) {
    return this.find({ user: userId }, options);
  }

  async findAdminOrders(options = {}) {
    return this.find({}, options);
  }
}

export default new OrderRepository();
