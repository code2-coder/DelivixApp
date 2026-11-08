import express from "express";
import { getExchangeRates, convertPrice } from "../controllers/currencyController.js";
import { cacheMiddleware } from "../middleware/cache.js";

const router = express.Router();

router.get("/currency/rates", cacheMiddleware(3600), getExchangeRates);
router.post("/currency/convert", convertPrice);

export default router;
