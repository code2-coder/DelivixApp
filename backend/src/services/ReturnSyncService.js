import Return from "../models/return.js";
import {
  returnStatusForOrderStatus,
  shouldAdvanceReturnStatus,
} from "../utils/returnPolicy.js";

/**
 * Keep the granular Return documents aligned with the order status that an
 * admin selected. Every update is forward-only and idempotent, so the same
 * order action can be retried safely.
 */
export class ReturnSyncService {
  async syncForOrderStatus(order, orderStatus, { actor, note } = {}) {
    const mapping = returnStatusForOrderStatus(orderStatus);
    if (!mapping || !order?._id) return { updated: 0, status: null };

    const returns = await Return.find({ order: order._id });
    let updated = 0;

    for (const returnDoc of returns) {
      if (
        !shouldAdvanceReturnStatus(returnDoc.status, mapping.status, {
          returnType: returnDoc.returnType,
        })
      ) {
        continue;
      }

      returnDoc.status = mapping.status;
      returnDoc.timeline = returnDoc.timeline || [];
      returnDoc.timeline.push({
        status: mapping.status,
        message: note ? `${mapping.message} ${note}` : mapping.message,
      });

      if (mapping.status === "Approved" && actor?._id) {
        returnDoc.approvedBy = actor._id;
      }
      if (mapping.status === "Rejected") {
        returnDoc.adminRemarks = note || returnDoc.adminRemarks;
      }
      if (mapping.status === "Refund Completed" && actor?._id) {
        returnDoc.approvedBy = returnDoc.approvedBy || actor._id;
      }

      await returnDoc.save();
      updated += 1;
    }

    return { updated, status: mapping.status };
  }
}

export default new ReturnSyncService();
