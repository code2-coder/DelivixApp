import Product from "../models/product.js";
import Category from "../models/category.js";
import User from "../models/User.js";
import bcrypt from "bcryptjs";

const categoriesData = [
  { name: "Laptops", image: { public_id: "cat_laptops", url: "https://images.unsplash.com/photo-1562907550-096d3bf9b25c?auto=format&fit=crop&w=900&q=85" } },
  { name: "Audio", image: { public_id: "cat_audio", url: "https://images.unsplash.com/photo-1599669454699-248893623440?auto=format&fit=crop&w=900&q=85" } },
  { name: "Accessories", image: { public_id: "cat_accessories", url: "https://images.unsplash.com/photo-1646944505531-6a2670fda084?auto=format&fit=crop&w=900&q=85" } },
  { name: "Security", image: { public_id: "cat_security", url: "https://images.unsplash.com/photo-1698934689061-1ebbf2c3c3dc?auto=format&fit=crop&w=900&q=85" } },
  { name: "Mobile", image: { public_id: "cat_mobile", url: "https://images.unsplash.com/photo-1504610926078-a1611febcad3?auto=format&fit=crop&w=900&q=85" } },
  { name: "Displays", image: { public_id: "cat_displays", url: "https://images.unsplash.com/photo-1546435770-a3e426bf472b?auto=format&fit=crop&w=1400&q=85" } },
];

const productsData = [
  {
    name: "AeroBook Pro 14",
    categoryName: "Laptops",
    price: 1299,
    description: "Exceptional performance in an impossibly refined form. Built for focused work, creative flow and everything after.",
    images: [{ public_id: "img_aerobook", url: "https://images.unsplash.com/photo-1562907550-096d3bf9b25c?auto=format&fit=crop&w=900&q=85" }],
    badge: "NEW",
    homeSection: "New Arrival",
    ratings: 4.8,
    stock: 25,
    features: ["14-inch Liquid Retina XDR", "32GB Unified Memory", "Up to 22 hours battery life"],
  },
  {
    name: "Studio Wireless H1",
    categoryName: "Audio",
    price: 249,
    description: "Designed for deep focus with active noise cancellation, custom acoustic drivers, and all-day comfort.",
    images: [{ public_id: "img_studio_h1", url: "https://images.unsplash.com/photo-1599669454699-248893623440?auto=format&fit=crop&w=900&q=85" }],
    badge: "−17%",
    homeSection: "Best Seller",
    ratings: 4.9,
    stock: 40,
    features: ["Active Noise Cancellation", "Transparency mode", "Spatial Audio with dynamic head tracking"],
  },
  {
    name: "Form Mechanical 75",
    categoryName: "Accessories",
    price: 149,
    description: "Compact 75% layout mechanical keyboard with custom tuned switches, gasket mount and hot-swappable PCB.",
    images: [{ public_id: "img_form_mech", url: "https://images.unsplash.com/photo-1646944505531-6a2670fda084?auto=format&fit=crop&w=900&q=85" }],
    homeSection: "Trending Product",
    ratings: 4.7,
    stock: 35,
    features: ["Gasket mounted design", "Hot-swappable switches", "Wireless 2.4GHz + Bluetooth"],
  },
  {
    name: "Vision Secure C4",
    categoryName: "Security",
    price: 189,
    description: "Smart 4K security camera with night vision, local storage, encrypted video feeds, and instant motion alerts.",
    images: [{ public_id: "img_vision_c4", url: "https://images.unsplash.com/photo-1698934689061-1ebbf2c3c3dc?auto=format&fit=crop&w=900&q=85" }],
    badge: "BESTSELLER",
    homeSection: "Best Seller",
    ratings: 4.8,
    stock: 15,
    features: ["4K HDR sensor", "Color night vision", "Encrypted local & cloud storage"],
  },
  {
    name: "Precision Mouse M2",
    categoryName: "Accessories",
    price: 79,
    description: "Ergonomic precision wireless mouse with multi-device connectivity, magnetic scroll wheel, and ultra-quiet clicks.",
    images: [{ public_id: "img_precision_m2", url: "https://images.unsplash.com/photo-1621570555371-f3e91dafbb5d?auto=format&fit=crop&w=900&q=85" }],
    homeSection: "Trending Product",
    ratings: 4.6,
    stock: 50,
    features: ["MagSpeed electromagnetic scrolling", "4000 DPI sensor", "USB-C quick charge"],
  },
  {
    name: "Sound Pods S2",
    categoryName: "Audio",
    price: 129,
    description: "Truly wireless earbuds with spatial audio, dynamic drivers, crystal clear voice calling, and IPX5 water resistance.",
    images: [{ public_id: "img_sound_pods", url: "https://images.unsplash.com/photo-1621570555334-66a1f48e48eb?auto=format&fit=crop&w=900&q=85" }],
    badge: "SALE",
    homeSection: "Trending Product",
    ratings: 4.7,
    stock: 60,
    features: ["IPX5 water resistance", "Wireless charging case", "36-hour total playback"],
  },
  {
    name: "Everyday Smart One",
    categoryName: "Mobile",
    price: 699,
    description: "Flagship performance, stunning OLED display, and all-day battery life in a minimalist aerospace aluminum frame.",
    images: [{ public_id: "img_smart_one", url: "https://images.unsplash.com/photo-1504610926078-a1611febcad3?auto=format&fit=crop&w=900&q=85" }],
    badge: "NEW",
    homeSection: "New Arrival",
    ratings: 4.8,
    stock: 20,
    features: ["120Hz ProMotion display", "Triple camera system", "5G capable"],
  },
  {
    name: "Arc Display 27",
    categoryName: "Displays",
    price: 429,
    description: "27-inch 4K UHD IPS display with USB-C 90W power delivery, ultra-thin bezels, and color-accurate calibration.",
    images: [{ public_id: "img_arc_display", url: "https://images.unsplash.com/photo-1546435770-a3e426bf472b?auto=format&fit=crop&w=1400&q=85" }],
    homeSection: "Best Seller",
    ratings: 4.9,
    stock: 18,
    features: ["4K UHD 3840x2160 resolution", "90W USB-C charging", "99% sRGB color gamut"],
  },
];

export const seedProducts = async () => {
  try {
    // 1. Ensure an admin exists for product ownership. Credentials must come
    // from the environment; never ship a default administrator password.
    let adminUser = await User.findOne({ role: "admin" });
    const adminEmail = String(process.env.ADMIN_EMAIL || "").trim().toLowerCase();
    const adminPassword = String(process.env.ADMIN_PASSWORD || "");

    if (!adminUser && adminEmail && adminPassword) {
      const hashedPassword = await bcrypt.hash(adminPassword, 10);
      adminUser = await User.create({
        name: process.env.ADMIN_NAME || "Administrator",
        email: adminEmail,
        password: hashedPassword,
        role: "admin",
        isVerified: true,
      });
      console.log(`[Database] Created administrator account: ${adminEmail}`);
    }

    if (!adminUser) {
      console.warn(
        "[Database] No administrator account found. Set ADMIN_EMAIL and ADMIN_PASSWORD (and restart) to seed the catalog."
      );
      return;
    }

    // 2. Ensure Categories exist
    const categoryMap = {};
    for (const cat of categoriesData) {
      let existing = await Category.findOne({ name: cat.name });
      if (!existing) {
        existing = await Category.create(cat);
      }
      categoryMap[cat.name] = existing._id;
    }

    // 3. Check if products exist
    const count = await Product.countDocuments();
    if (count === 0) {
      const docsToInsert = productsData.map((item) => ({
        name: item.name,
        price: item.price,
        description: item.description,
        category: categoryMap[item.categoryName],
        images: item.images,
        seller: "DELIVIX",
        stock: item.stock,
        status: "published",
        homeSection: item.homeSection || "",
        ratings: item.ratings || 4.8,
        numOfReviews: 124,
        features: item.features || [],
        user: adminUser._id,
      }));

      await Product.insertMany(docsToInsert);
      console.log(`[Database] Successfully seeded ${docsToInsert.length} Delivix products into MongoDB!`);
    } else {
      console.log(`[Database] MongoDB already contains ${count} products. Skipping seeding.`);
    }
  } catch (error) {
    console.error("[Database] Error seeding Delivix products:", error.message);
  }
};

export default seedProducts;
