import mongoose from "mongoose";



const productSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      maxLength: [200, "Product title cannot exceed 200 characters"],
    },
    basePrice: {
      type: Number,
    },
    brand: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Brand",
    },
    brandName: {
      type: String,
      trim: true,
      default: "",
    },
    manufacturer: {
      type: String,
      trim: true,
      default: "",
    },
    modelNumber: {
      type: String,
      trim: true,
      default: "",
    },
    mrp: {
      type: Number,
    },
    discountPercentage: {
      type: Number,
    },
    sku: {
      type: String,
      trim: true,
    },
    barcode: {
      type: String,
      trim: true,
    },
    costPrice: {
      type: Number,
    },
    purchasePrice: {
      type: Number,
    },
    minStockLevel: {
      type: Number,
      default: 5,
    },
    maxStockLevel: {
      type: Number,
      default: 100,
    },
    maxPurchaseQuantity: {
      type: Number,
      min: 1,
      default: 10,
    },
    reservedStock: {
      type: Number,
      default: 0,
    },
    incomingStock: {
      type: Number,
      default: 0,
    },
    damagedStock: {
      type: Number,
      default: 0,
    },
    warehouseLocation: {
      type: String,
      default: "Main Warehouse (Zone A)",
    },
    shelfBin: {
      type: String,
      default: "",
    },
    batchNumber: {
      type: String,
    },
    expiryDate: {
      type: Date,
    },
    manufacturingDate: {
      type: Date,
    },
    supplier: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Supplier",
    },

    name: {
      type: String,
      required: [true, "Please enter product name"],
      maxLength: [200, "Product name cannot exceed 200 characters"],
    },
    slug: {
      type: String,
      unique: true,
      sparse: true,
      lowercase: true,
      trim: true,
    },
    price: {
      type: Number,
      required: [true, "Please enter product price"],
      min: [0, "Product price cannot be negative"],
    },
    description: {
      type: String,
      required: [true, "Please enter product description"],
    },
    shortDescription: {
      type: String,
      trim: true,
      maxLength: [500, "Short description cannot exceed 500 characters"],
      default: "",
    },
    subcategory: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Category",
    },
    tags: {
      type: [String],
      default: [],
    },
    highlights: {
      type: [String],
      default: [],
    },
    specifications: {
      type: [
        {
          label: { type: String, required: true, trim: true },
          value: { type: String, required: true, trim: true },
        },
      ],
      default: [],
    },
    taxRate: {
      type: Number,
      default: 0,
      min: 0,
    },
    taxIncluded: {
      type: Boolean,
      default: true,
    },
    hsnCode: {
      type: String,
      trim: true,
      default: "",
    },
    shipping: {
      weight: { type: Number, default: 0 },
      length: { type: Number, default: 0 },
      width: { type: Number, default: 0 },
      height: { type: Number, default: 0 },
      shippingClass: { type: String, default: "Standard" },
      deliveryInfo: { type: String, default: "" },
    },
    seo: {
      title: { type: String, default: "" },
      metaDescription: { type: String, default: "" },
      keywords: { type: [String], default: [] },
      socialImage: { type: String, default: "" },
      canonicalUrl: { type: String, default: "" },
    },
    collections: {
      type: [String],
      default: [],
    },
    freeShipping: {
      type: Boolean,
      default: false,
    },
    visibility: {
      type: String,
      enum: ["public", "hidden"],
      default: "public",
    },
    isFeatured: {
      type: Boolean,
      default: false,
    },
    isNewArrival: {
      type: Boolean,
      default: false,
    },
    isBestSeller: {
      type: Boolean,
      default: false,
    },
    isTrending: {
      type: Boolean,
      default: false,
    },
    returnPolicy: {
      type: String,
      default: "",
    },
    warranty: {
      type: String,
      default: "",
    },
    careInstructions: {
      type: String,
      default: "",
    },
    saleStartDate: {
      type: Date,
    },
    saleEndDate: {
      type: Date,
    },
    manageStock: {
      type: Boolean,
      default: true,
    },
    allowBackorder: {
      type: Boolean,
      default: false,
    },
    estimatedDeliveryDays: {
      type: Number,
      default: 3,
      min: 0,
    },
    has360View: {
      type: Boolean,
      default: false,
    },
    images360: {
      type: [String],
      default: [],
    },
    moreDetails: {
      type: String,
    },
    ratings: {
      type: Number,
      default: 0,
    },
    images: [
      {
        public_id: {
          type: String,
          required: true,
        },
        alt: {
          type: String,
          trim: true,
          default: "",
        },
        url: {
          type: String,
          required: true,
        },
      },
    ],
    videos: [
      {
        public_id: {
          type: String,
        },
        url: {
          type: String,
        },
      }
    ],
    category: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Category",
    },
    productType: {
      type: String, // Rings, Earrings, Pendants, etc.
    },
    style: {
      type: String,
    },
    earringStyle: {
      type: String,
    },
    nosepinStyle: {
      type: String,
    },
    pendantStyle: {
      type: String,
    },
    ringStyle: {
      type: String,
    },
    material: {
      type: String, // Diamond, Solitaire, Gold, Gemstone
    },
    metalColor: {
      type: String, // Yellow, Rose, White
    },
    purity: {
      type: String, // 14 KT, 18 KT, 22 KT
    },
    metalTypeColor: {
      type: String, // e.g. 14 KT Yellow Gold
    },
    // Extended Product Specifications
    metal: {
      type: String, // e.g. Gold, Silver, Copper
    },
    stoneType: {
      type: String, // e.g. Diamond, Ruby, Emerald
    },
    finish: {
      type: String, // e.g. Matte, Polished, Oxidised
    },
    color: {
      type: String, // e.g. Gold-Tone, Silver-Tone, Rose Gold
    },
    theme: {
      type: String, // e.g. Floral, Geometric, Traditional
    },
    pattern: {
      type: String, // e.g. Lotus, Paisley, Abstract
    },
    shape: {
      type: String, // e.g. Round, Oval, Square
    },
    weight: {
      type: String, // e.g. 12g, 50g (string to allow units)
    },
    dimensions: {
      type: String, // e.g. 2.5cm x 1cm
    },
    handmade: {
      type: Boolean,
      default: false,
    },
    countryOfOrigin: {
      type: String,
      default: "India",
    },
    availableInStore: {
      type: Boolean,
      default: false,
    },
    readyToShip: {
      type: Boolean,
      default: false,
    },
    onSale: {
      type: Boolean,
      default: false,
    },

    visualEmbedding: {
      type: [Number],
      select: false,
    },
    seller: {
      type: String,
      default: "Delivix",
    },
    stock: {
      type: Number,
      default: 25,
    },
    features: {
      type: [String],
      default: [],
    },
    homeSection: {
      type: String,
      default: "",
    },
    publishAt: {
      type: Date,
    },
    variantAttributes: [
      {
        name: { type: String, trim: true },
        values: { type: [String], default: [] },
      },
    ],
    variants: [
      {
        variantName: { type: String },
        colorName: { type: String, trim: true, default: "" },
        title: { type: String },
        sku: { type: String, trim: true },
        barcode: { type: String },
        price: { type: Number, min: 0 },
        mrp: { type: Number, min: 0 },
        costPrice: { type: Number },
        stock: { type: Number, default: 0, min: 0 },
        reservedStock: { type: Number, default: 0 },
        incomingStock: { type: Number, default: 0 },
        minStockLevel: { type: Number, default: 5 },
        maxStockLevel: { type: Number, default: 100 },
        attributes: { type: mongoose.Schema.Types.Mixed },
        isDefault: { type: Boolean, default: false },
        isActive: { type: Boolean, default: true },
        colorHex: { type: String },
        skuPrefix: { type: String },
        images: [
          {
            public_id: { type: String, required: true },
            alt: { type: String, trim: true, default: "" },
            url: { type: String, required: true }
          }
        ],
        videos: [
          {
            public_id: { type: String, required: true },
            url: { type: String, required: true }
          }
        ],
        sizes: [
          {
            size: { type: String, required: true },
            price: { type: Number, required: true },
            comparePrice: { type: Number },
            stock: { type: Number, required: true, default: 0 },
            sku: { type: String },
            weight: { type: Number },
            barcode: { type: String },
            status: { type: String, enum: ["Active", "Draft"], default: "Active" }
          }
        ]
      }
    ],
    sizes: [
      {
        size: { type: String, required: true },
        price: { type: Number, required: true },
        comparePrice: { type: Number },
        stock: { type: Number, required: true, default: 0 },
        sku: { type: String },
        weight: { type: Number },
        barcode: { type: String },
        status: { type: String, enum: ["Active", "Draft"], default: "Active" }
      }
    ],
    numOfReviews: {
      type: Number,
      default: 0,
    },
    reviews: [
      {
        user: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
          required: true,
        },
        rating: {
          type: Number,
          required: true,
        },
        comment: {
          type: String,
          required: true,
        },
      },
    ],
    status: {
      type: String,
      enum: ["draft", "published", "scheduled", "archived"],
      default: "draft",
      required: [true, "Product status is required"],
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
  },
  { timestamps: true }
);

// ── Performance Indexes ──────────────────────────────────────────────────────
// Category + price for sorted category browsing
productSchema.index({ category: 1, price: 1 });
productSchema.index({ brand: 1 });
productSchema.index({ subcategory: 1 });
productSchema.index({ isFeatured: 1, status: 1 });
productSchema.index({ tags: 1 });
// Individual field indexes for filter combinations
productSchema.index({ price: 1 });
productSchema.index({ status: 1 });
productSchema.index({ material: 1 });
productSchema.index({ stoneType: 1 });
productSchema.index({ color: 1 });
productSchema.index({ stock: 1 });
productSchema.index({ homeSection: 1 });
productSchema.index({ createdAt: -1 });
productSchema.index({ ratings: -1 });
productSchema.index({ numOfReviews: -1 });
// Compound: status + category (most common shop query)
productSchema.index({ status: 1, category: 1, price: 1 });
// Text index for keyword search across name, material, stoneType, color
productSchema.index({ name: 'text', material: 'text', stoneType: 'text', color: 'text' });

export default mongoose.model("Product", productSchema);
