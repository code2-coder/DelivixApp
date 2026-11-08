import mongoose from "mongoose";

const backupHistorySchema = new mongoose.Schema(
  {
    backupName: {
      type: String,
      required: true,
      trim: true,
    },
    backupType: {
      type: String,
      enum: ["manual", "scheduled", "export"],
      default: "manual",
    },
    status: {
      type: String,
      enum: ["completed", "failed", "in_progress"],
      default: "completed",
    },
    fileSizeKb: {
      type: Number,
      default: 0,
    },
    totalCollections: {
      type: Number,
      default: 0,
    },
    totalDocuments: {
      type: Number,
      default: 0,
    },
    collectionsIncluded: [{ type: String }],
    triggeredBy: {
      type: String,
      default: "System Administrator",
    },
    backupData: {
      type: String, // JSON snapshot payload
      default: "",
    },
    notes: {
      type: String,
      default: "",
    },
  },
  { timestamps: true }
);

export default mongoose.model("BackupHistory", backupHistorySchema);

