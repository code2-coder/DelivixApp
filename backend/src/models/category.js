import mongoose from "mongoose";

const slugify = (value = "") =>
  value
    .toString()
    .toLowerCase()
    .trim()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

const categorySchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    slug: {
      type: String,
      unique: true,
      lowercase: true,
      trim: true,
    },
    parentCategory: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Category",
      default: null
    },
    // Legacy catalog records stored the parent in `parent`. Keep the field so
    // queries and older data continue to work alongside `parentCategory`.
    parent: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Category",
      default: null
    },
    image: {
      public_id: String,
      url: String
    }
  },
  { timestamps: true }
);

categorySchema.index({ name: 1, parentCategory: 1 });

// The database keeps a unique index on `slug`. Generate one for every category
// so creating categories never collides on a missing (null) slug.
categorySchema.pre("validate", async function () {
  if (this.slug || !this.name) return;

  const base = slugify(this.name) || `category-${this._id}`;
  let candidate = base;
  let suffix = 2;

  while (await this.constructor.exists({ slug: candidate, _id: { $ne: this._id } })) {
    candidate = `${base}-${suffix++}`;
  }

  this.slug = candidate;
});

export default mongoose.model("Category", categorySchema);
