import Product from "../models/product.js";
import InventoryTransaction from "../models/inventoryTransaction.js";
import { resolveInventoryTarget } from "../utils/inventoryTarget.js";

const ledgerKey = (orderId, itemId, action) => `${orderId}:${itemId}:${action}`;

const withSession = (query, session) => (session ? query.session(session) : query);

const applyDelta = async ({ product, target, quantity, direction, session }) => {
  const delta = direction === "decrement" ? -quantity : quantity;
  const options = session ? { session } : {};

  if (target.kind === "product") {
    const query =
      direction === "decrement"
        ? { _id: product._id, stock: { $gte: quantity } }
        : { _id: product._id };
    const result = await Product.updateOne(
      query,
      { $inc: { stock: delta } },
      options
    );
    return result.modifiedCount > 0;
  }

  if (target.kind === "size") {
    const query =
      direction === "decrement"
        ? {
            _id: product._id,
            sizes: { $elemMatch: { size: target.size, stock: { $gte: quantity } } },
          }
        : { _id: product._id, "sizes.size": target.size };
    const result = await Product.updateOne(
      query,
      { $inc: { "sizes.$.stock": delta } },
      options
    );
    return result.modifiedCount > 0;
  }

  if (target.kind === "variantSize") {
    const query =
      direction === "decrement"
        ? {
            _id: product._id,
            variants: {
              $elemMatch: {
                variantName: target.variantName,
                sizes: {
                  $elemMatch: { size: target.size, stock: { $gte: quantity } },
                },
              },
            },
          }
        : {
            _id: product._id,
            "variants.variantName": target.variantName,
            "variants.sizes.size": target.size,
          };
    const result = await Product.updateOne(
      query,
      { $inc: { "variants.$[v].sizes.$[s].stock": delta } },
      {
        ...options,
        arrayFilters: [
          { "v.variantName": target.variantName },
          { "s.size": target.size },
        ],
      }
    );
    return result.modifiedCount > 0;
  }

  return false;
};

const createLedgerEntry = async ({ orderId, item, action, reason, actor, session }) => {
  const key = ledgerKey(orderId, item._id, action);
  const existing = await withSession(InventoryTransaction.findOne({ key }), session);
  if (existing) return { created: false, entry: existing };

  try {
    const [entry] = await InventoryTransaction.create(
      [
        {
          key,
          order: orderId,
          orderItemId: item._id,
          product: item.product,
          variantName: item.variantName,
          size: item.size,
          sku: item.sku || item.variantSku,
          quantity: item.quantity,
          action,
          reason: reason || "",
          performedBy: actor?._id,
        },
      ],
      session ? { session } : {}
    );
    return { created: true, entry };
  } catch (error) {
    if (error?.code === 11000) {
      const entry = await withSession(InventoryTransaction.findOne({ key }), session);
      return { created: false, entry };
    }
    throw error;
  }
};

export class InventoryService {
  /**
   * Reserve stock when an order is placed. Stock is removed from the sellable
   * pool immediately so two shoppers can never buy the last unit.
   */
  async reserveItems({ orderId, items, actor, session, reason = "Order placed" }) {
    for (const item of items) {
      const existing = await withSession(
        InventoryTransaction.findOne({
          key: ledgerKey(orderId, item._id, "reserve"),
        }),
        session
      );
      if (existing) continue;

      const product = await withSession(Product.findById(item.product), session);
      if (!product) {
        throw new Error(`Product ${item.name || item.product} is no longer available`);
      }
      const target = resolveInventoryTarget(product, item);
      if (!target.ok) {
        throw new Error(target.reason);
      }
      if (target.stock < item.quantity) {
        throw new Error(
          `Only ${Math.max(0, target.stock)} unit(s) of ${product.name} are available`
        );
      }

      const { created } = await createLedgerEntry({
        orderId,
        item,
        action: "reserve",
        reason,
        actor,
        session,
      });
      if (!created) continue;

      const adjusted = await applyDelta({
        product,
        target,
        quantity: item.quantity,
        direction: "decrement",
        session,
      });

      if (!adjusted) {
        // Compensate the ledger entry when stock changed between read/write.
        await withSession(
          InventoryTransaction.deleteOne({
            key: ledgerKey(orderId, item._id, "reserve"),
          }),
          session
        );
        throw new Error(
          `Insufficient stock for ${product.name}. Please refresh your bag and try again.`
        );
      }
    }
  }

  /**
   * Mark a reservation as physically deducted/packed. Stock was already
   * removed at reservation time, so this is an audit transition only.
   */
  async markDeducted({ orderId, items, actor, session, reason = "Order packed" }) {
    for (const item of items) {
      const reserve = await withSession(
        InventoryTransaction.findOne({
          key: ledgerKey(orderId, item._id, "reserve"),
        }),
        session
      );

      if (!reserve) {
        // Legacy orders were never reserved. Deduct at packing time instead.
        const product = await withSession(Product.findById(item.product), session);
        if (product) {
          const target = resolveInventoryTarget(product, item);
          if (target.ok) {
            await applyDelta({
              product,
              target,
              quantity: item.quantity,
              direction: "decrement",
              session,
            });
          }
        }
      }

      await createLedgerEntry({
        orderId,
        item,
        action: "deduct",
        reason,
        actor,
        session,
      });
    }
  }

  /**
   * Return reserved/deducted stock exactly once. Used for cancellations and
   * completed returns.
   */
  async restoreItems({ orderId, items, actor, session, reason = "Order cancelled" }) {
    for (const item of items) {
      const restored = await withSession(
        InventoryTransaction.findOne({
          key: ledgerKey(orderId, item._id, "restore"),
        }),
        session
      );
      if (restored) continue;

      const reserve = await withSession(
        InventoryTransaction.findOne({
          key: ledgerKey(orderId, item._id, "reserve"),
        }),
        session
      );
      // Legacy orders were deducted at packing time without a reservation
      // ledger entry. Restore those lines too, still exactly once per order
      // line thanks to the unique "restore" ledger key.
      const deduction = reserve
        ? null
        : await withSession(
            InventoryTransaction.findOne({
              key: ledgerKey(orderId, item._id, "deduct"),
            }),
            session
          );
      if (!reserve && !deduction) continue;

      const product = await withSession(Product.findById(item.product), session);
      if (!product) continue;
      const target = resolveInventoryTarget(product, item);
      if (!target.ok) continue;

      await applyDelta({
        product,
        target,
        quantity: item.quantity,
        direction: "increment",
        session,
      });

      await createLedgerEntry({
        orderId,
        item,
        action: "restore",
        reason,
        actor,
        session,
      });
    }
  }

  async getOrderLedger(orderId) {
    return InventoryTransaction.find({ order: orderId })
      .sort({ createdAt: 1 })
      .lean();
  }
}

export default new InventoryService();
