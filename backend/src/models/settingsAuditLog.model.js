import mongoose from "mongoose";

const settingsAuditLogSchema = new mongoose.Schema(
  {
    section: {
      type: String,
      required: true,
      trim: true,
    },
    action: {
      type: String,
      enum: ["UPDATE", "RESET", "BACKUP_CREATE", "BACKUP_RESTORE", "TEST_TRIGGER"],
      default: "UPDATE",
    },
    performedBy: {
      userId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
      name: { type: String, default: "Administrator" },
      email: { type: String, default: "" },
    },
    ipAddress: {
      type: String,
      default: "",
    },
    changesSummary: {
      type: String,
      default: "",
    },
  },
  { timestamps: true }
);

export default mongoose.model("SettingsAuditLog", settingsAuditLogSchema);

