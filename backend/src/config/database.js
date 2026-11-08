import mongoose from "mongoose";
import logger from "../utils/logger.js";

/**
 * Connect to MongoDB with production-grade pool and timeout options
 */
const LOCAL_URI = "mongodb://127.0.0.1:27017/delivix";

export const connectDB = async () => {
  const primaryUri = process.env.MONGODB_URI || LOCAL_URI;
  const allowFallback = process.env.ALLOW_LOCAL_MONGO_FALLBACK === "true";

  const options = {
    maxPoolSize: 50,
    minPoolSize: 10,
    serverSelectionTimeoutMS: Number(process.env.MONGO_SERVER_SELECTION_TIMEOUT_MS) || 3000,
    socketTimeoutMS: 45000,
    connectTimeoutMS: Number(process.env.MONGO_CONNECT_TIMEOUT_MS) || 4000,
  };

  try {
    const conn = await mongoose.connect(primaryUri, options);
    console.log(`MongoDB Connected: ${conn.connection.host}/${conn.connection.name}`);
    logger.info(`MongoDB connected to host: ${conn.connection.host}`);
    return conn;
  } catch (error) {
    console.error(`Primary MongoDB connection failed: ${error.message}`);
    if (allowFallback && primaryUri !== LOCAL_URI) {
      console.warn("Attempting local MongoDB fallback...");
      try {
        const fallbackConn = await mongoose.connect(LOCAL_URI, options);
        console.log(`MongoDB Connected via local fallback: ${fallbackConn.connection.host}/${fallbackConn.connection.name}`);
        logger.info(`MongoDB connected via fallback: ${fallbackConn.connection.host}`);
        return fallbackConn;
      } catch (fallbackError) {
        console.error("Local fallback MongoDB connection also failed:", fallbackError.message);
      }
    }
    logger.error("MongoDB connection failed", error);
    throw error;
  }
};

/**
 * Disconnect from MongoDB gracefully
 */
export const disconnectDB = async () => {
  try {
    await mongoose.disconnect();
    console.log("MongoDB Disconnected successfully");
    logger.info("MongoDB disconnected gracefully");
  } catch (error) {
    console.error("Error disconnecting MongoDB:", error.message);
    logger.error("MongoDB disconnect error", error);
  }
};

export default {
  connectDB,
  disconnectDB,
};
