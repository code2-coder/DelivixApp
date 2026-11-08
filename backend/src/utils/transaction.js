import mongoose from "mongoose";

const TRANSACTION_UNSUPPORTED_MESSAGES = [
  "Transaction numbers are only allowed on a replica set member or mongos",
  "Transactions are not supported",
  "This MongoDB deployment does not support retryable writes",
];

const isTransactionUnsupported = (error) =>
  error?.code === 20 ||
  error?.codeName === "IllegalOperation" ||
  TRANSACTION_UNSUPPORTED_MESSAGES.some((message) =>
    String(error?.message || "").includes(message)
  );

/**
 * Run a unit of work inside a MongoDB transaction when the deployment supports
 * it (Atlas / replica set). Local standalone MongoDB falls back to the same
 * callback without a session; callers must therefore keep compensating logic
 * for the fallback path.
 */
export const withTransaction = async (work) => {
  const session = await mongoose.startSession();
  try {
    let result;
    await session.withTransaction(async () => {
      result = await work(session);
    });
    return result;
  } catch (error) {
    if (isTransactionUnsupported(error)) {
      return work(null);
    }
    throw error;
  } finally {
    await session.endSession();
  }
};

export default { withTransaction };
