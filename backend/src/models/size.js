import mongoose from "mongoose";

const sizeSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Please enter size name"],
      unique: true,
      trim: true,
    },
    type: {
      type: String,
      default: "General",
    }
  },
  { timestamps: true }
);

export default mongoose.model("Size", sizeSchema);
