import PriceRange from "../models/priceRange.js";

const defaultPriceRanges = [
  { min: 0, max: 500 },
  { min: 500, max: 1000 },
  { min: 1000, max: 2000 },
  { min: 2000, max: 3000 },
  { min: 3000, max: 4000 },
  { min: 4000, max: null }
];

export const seedPriceRanges = async () => {
  try {
    const count = await PriceRange.countDocuments();
    if (count === 0) {
      await PriceRange.insertMany(defaultPriceRanges);
      console.log("[Database] Seeded default price ranges");
    }
  } catch (error) {
    console.error("[Database] Error seeding default price ranges:", error);
  }
};
