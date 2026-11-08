import mongoose from "mongoose";

const settingsSchema = new mongoose.Schema(
    {
        // Australia Shipping Settings
        australiaShipping: {
            standardShippingPrice: {
                type: Number,
                default: 9.95,
                description: "Standard shipping cost in AUD",
            },
            expressShippingPrice: {
                type: Number,
                default: 14.95,
                description: "Express shipping cost in AUD",
            },
            freeShippingThreshold: {
                type: Number,
                default: 99,
                description: "Order total threshold for free standard shipping in AUD",
            },
        },

        // Packaging Options
        packaging: {
            exquisitePackagingPrice: {
                type: Number,
                default: 5,
                description: "Price for exquisite gift packaging in AUD",
            },
            standardPackagingName: {
                type: String,
                default: "Standard Shreeharikripa Presentation Sachet",
            },
            exquisitePackagingName: {
                type: String,
                default: "Exquisite Gift Packaging",
            },
        },

        // Packaging Text (displayed on product pages)
        packagingText: {
            productPageText: {
                type: String,
                default: "Every piece arrives in our signature Shreeharikripa presentation sachet.",
            },
            shippingInfoText: {
                type: String,
                default: "Every piece arrives in our signature Shreeharikripa presentation sachet.",
            },
            faqText: {
                type: String,
                default: "Every piece arrives in our signature Shreeharikripa presentation sachet.",
            },
            checkoutText: {
                type: String,
                default: "Every piece arrives in our signature Shreeharikripa presentation sachet.",
            },
        },

        // Global Settings
        defaultCurrency: {
            type: String,
            default: "AUD",
        },
        taxRate: {
            type: Number,
            default: 0.1, // 10% tax
        },
        isAustraliaEnabled: {
            type: Boolean,
            default: true,
        },
        isIndiaEnabled: {
            type: Boolean,
            default: true,
        },
        australiaCurrency: {
            type: String,
            default: "AUD",
        },
    },
    { timestamps: true }
);

export default mongoose.model("Settings", settingsSchema);
