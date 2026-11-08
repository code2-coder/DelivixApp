import catchAsyncErrors from "../middleware/catchAsyncErrors.js";
import ErrorHandler from "../utils/errorHandler.js";
import Settings from "../models/settings.js";
import { clearCache } from "../middleware/cache.js";

// Initialize settings on first call
const initSettings = async () => {
    let settings = await Settings.findOne();
    if (!settings) {
        settings = await Settings.create({});
    }
    return settings;
};

//
// 📊 GET SETTINGS
//
export const getSettings = catchAsyncErrors(async (req, res, next) => {
    let settings = await Settings.findOne();

    if (!settings) {
        settings = await initSettings();
    }

    res.status(200).json({
        success: true,
        settings,
    });
});

//
// 👑 ADMIN: UPDATE SETTINGS
//
export const updateSettings = catchAsyncErrors(async (req, res, next) => {
    const {
        australiaShipping,
        packaging,
        packagingText,
        defaultCurrency,
        taxRate,
        isAustraliaEnabled,
        isIndiaEnabled,
        australiaCurrency,
    } = req.body;

    let settings = await Settings.findOne();

    if (!settings) {
        settings = await initSettings();
    }

    // Update shipping settings
    if (australiaShipping) {
        if (australiaShipping.standardShippingPrice !== undefined) {
            settings.australiaShipping.standardShippingPrice =
                australiaShipping.standardShippingPrice;
        }
        if (australiaShipping.expressShippingPrice !== undefined) {
            settings.australiaShipping.expressShippingPrice =
                australiaShipping.expressShippingPrice;
        }
        if (australiaShipping.freeShippingThreshold !== undefined) {
            settings.australiaShipping.freeShippingThreshold =
                australiaShipping.freeShippingThreshold;
        }
    }

    // Update packaging settings
    if (packaging) {
        if (packaging.exquisitePackagingPrice !== undefined) {
            settings.packaging.exquisitePackagingPrice =
                packaging.exquisitePackagingPrice;
        }
        if (packaging.standardPackagingName !== undefined) {
            settings.packaging.standardPackagingName = packaging.standardPackagingName;
        }
        if (packaging.exquisitePackagingName !== undefined) {
            settings.packaging.exquisitePackagingName =
                packaging.exquisitePackagingName;
        }
    }

    // Update packaging text
    if (packagingText) {
        if (packagingText.productPageText !== undefined) {
            settings.packagingText.productPageText = packagingText.productPageText;
        }
        if (packagingText.shippingInfoText !== undefined) {
            settings.packagingText.shippingInfoText = packagingText.shippingInfoText;
        }
        if (packagingText.faqText !== undefined) {
            settings.packagingText.faqText = packagingText.faqText;
        }
        if (packagingText.checkoutText !== undefined) {
            settings.packagingText.checkoutText = packagingText.checkoutText;
        }
    }

    // Update global settings
    if (defaultCurrency !== undefined) {
        settings.defaultCurrency = defaultCurrency;
    }
    if (taxRate !== undefined) {
        settings.taxRate = taxRate;
    }
    if (isAustraliaEnabled !== undefined) {
        settings.isAustraliaEnabled = isAustraliaEnabled;
    }
    if (isIndiaEnabled !== undefined) {
        settings.isIndiaEnabled = isIndiaEnabled;
    }
    if (australiaCurrency !== undefined) {
        settings.australiaCurrency = australiaCurrency;
    }

    await settings.save();

    clearCache("/api/v1/settings");
    clearCache("/api/v1/settings/packaging-options");
    clearCache("/api/v1/settings/packaging-text");
    clearCache("shk:settings");

    res.status(200).json({
        success: true,
        settings,
    });
});

//
// 📊 GET SHIPPING COST
//
export const getShippingCost = catchAsyncErrors(async (req, res, next) => {
    const payload = req.method === "GET" ? req.query : req.body;
    const country = payload.country;
    const shippingMethod = payload.shippingMethod || "standard";
    const orderTotal = Number(payload.orderTotal);

    if (!country || Number.isNaN(orderTotal)) {
        return next(
            new ErrorHandler(
                "Country and orderTotal are required",
                400
            )
        );
    }

    let settings = await Settings.findOne();
    if (!settings) {
        settings = await initSettings();
    }

    let shippingAmount = 0;

    if (country.toLowerCase() === "australia") {
        if (shippingMethod === "express") {
            shippingAmount = Math.round(settings.australiaShipping.expressShippingPrice);
        } else {
            // Standard shipping
            if (orderTotal >= settings.australiaShipping.freeShippingThreshold) {
                shippingAmount = 0; // FREE
            } else {
                shippingAmount = Math.round(settings.australiaShipping.standardShippingPrice);
            }
        }
    } else if (country.toLowerCase() === "india") {
        if (shippingMethod === "express") {
            shippingAmount = 14.95; // Default express shipping for India (in AUD base)
        } else {
            shippingAmount = 0; // Standard shipping is FREE for India
        }
    } else {
        // Default for other countries (can be extended)
        shippingAmount = 15; // Default international shipping
    }

    res.status(200).json({
        success: true,
        country,
        orderTotal,
        shippingMethod,
        shippingAmount,
        isFreeShipping: shippingAmount === 0,
        freeShippingThreshold: settings.australiaShipping.freeShippingThreshold,
    });
});

//
// 📦 GET PACKAGING OPTIONS
//
export const getPackagingOptions = catchAsyncErrors(async (req, res, next) => {
    let settings = await Settings.findOne();
    if (!settings) {
        settings = await initSettings();
    }

    const options = [
        {
            id: "standard",
            name: settings.packaging.standardPackagingName,
            price: 0,
            description: "Included with every purchase",
        },
        {
            id: "exquisite",
            name: settings.packaging.exquisitePackagingName,
            price: settings.packaging.exquisitePackagingPrice,
            description: "Premium luxury gift box with decorative presentation",
        },
    ];

    res.status(200).json({
        success: true,
        packagingOptions: options,
    });
});

//
// 📝 GET PACKAGING TEXT (for display on pages)
//
export const getPackagingText = catchAsyncErrors(async (req, res, next) => {
    const { page } = req.query; // "product", "shipping", "faq", "checkout"

    let settings = await Settings.findOne();
    if (!settings) {
        settings = await initSettings();
    }

    let text = settings.packagingText.productPageText;

    if (page === "shipping") {
        text = settings.packagingText.shippingInfoText;
    } else if (page === "faq") {
        text = settings.packagingText.faqText;
    } else if (page === "checkout") {
        text = settings.packagingText.checkoutText;
    }

    res.status(200).json({
        success: true,
        page: page || "product",
        text,
    });
});
