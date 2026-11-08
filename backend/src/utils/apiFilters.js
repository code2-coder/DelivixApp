class APIFilters {
  constructor(query, queryStr = {}) {
    this.query = query;
    this.queryStr = queryStr;
    this._andClauses = [];
  }

  // 🔍 SEARCH — regex across all searchable text fields
  search() {
    if (this.queryStr.keyword) {
      const keyword = String(this.queryStr.keyword).trim();
      if (!keyword) return this;
      const regex = new RegExp(keyword.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");

      const searchOrBlock = [
        { name: { $regex: regex } },
        { title: { $regex: regex } },
        { description: { $regex: regex } },
        { shortDescription: { $regex: regex } },
        { sku: { $regex: regex } },
        { barcode: { $regex: regex } },
        { brandName: { $regex: regex } },
        { tags: { $regex: regex } },
        { features: { $regex: regex } },
        { highlights: { $regex: regex } },
        { material: { $regex: regex } },
        { color: { $regex: regex } },
        { stoneType: { $regex: regex } },
        { "variants.variantName": { $regex: regex } },
        { "variants.colorName": { $regex: regex } },
        { "variants.sku": { $regex: regex } },
        { "variants.sizes.sku": { $regex: regex } },
        { "sizes.sku": { $regex: regex } },
      ];

      if (Array.isArray(this.queryStr.matchedCategories) && this.queryStr.matchedCategories.length) {
        searchOrBlock.push({ category: { $in: this.queryStr.matchedCategories } });
      }
      if (Array.isArray(this.queryStr.resolvedBrandIds) && this.queryStr.resolvedBrandIds.length) {
        searchOrBlock.push({ brand: { $in: this.queryStr.resolvedBrandIds } });
      }

      this._andClauses.push({ $or: searchOrBlock });
    }
    return this;
  }

  // 🎯 FILTERS
  filters() {
    const filterObj = {};

    // ── Price ───────────────────────────────────────────────────────────────
    const priceGte = this.queryStr["price[gte]"] ?? this.queryStr.minPrice;
    const priceLte = this.queryStr["price[lte]"] ?? this.queryStr.maxPrice;
    if (priceGte !== undefined || priceLte !== undefined) {
      const buildRange = () => {
        const range = {};
        if (priceGte !== undefined && priceGte !== "") range.$gte = Number(priceGte);
        if (priceLte !== undefined && priceLte !== "") range.$lte = Number(priceLte);
        return range;
      };
      this._andClauses.push({
        $or: [
          { price: buildRange() },
          { "variants.price": buildRange() },
          { "sizes.price": buildRange() },
          { "variants.sizes.price": buildRange() },
        ],
      });
    }

    // ── Category (already resolved to ObjectIds by the service) ─────────────
    if (Array.isArray(this.queryStr.resolvedCategoryIds)) {
      filterObj.category = { $in: this.queryStr.resolvedCategoryIds };
    }
    if (Array.isArray(this.queryStr.resolvedSubcategoryIds)) {
      filterObj.subcategory = { $in: this.queryStr.resolvedSubcategoryIds };
    }

    // ── Brand (already resolved to ObjectIds by the service) ────────────────
    if (Array.isArray(this.queryStr.resolvedBrandIds)) {
      filterObj.brand = { $in: this.queryStr.resolvedBrandIds };
    }

    // ── Materials / stone types ─────────────────────────────────────────────
    if (this.queryStr.materials) {
      const materials = String(this.queryStr.materials)
        .split(",")
        .map((value) => value.trim())
        .filter(Boolean);
      if (materials.length) {
        filterObj.material = {
          $in: materials.map((value) => new RegExp(`^${value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, "i")),
        };
      }
    }

    if (this.queryStr.stoneTypes) {
      const stoneTypes = String(this.queryStr.stoneTypes)
        .split(",")
        .map((value) => value.trim())
        .filter(Boolean);
      if (stoneTypes.length) {
        filterObj.stoneType = {
          $in: stoneTypes.map(
            (value) => new RegExp(`^${value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, "i")
          ),
        };
      }
    }

    // ── Colours (root colour name or any colour variant) ───────────────────
    if (this.queryStr.colors) {
      const colors = String(this.queryStr.colors)
        .split(",")
        .map((value) => value.trim())
        .filter(Boolean);
      if (colors.length) {
        const colorRegexes = colors.map(
          (value) => new RegExp(`^${value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, "i")
        );
        this._andClauses.push({
          $or: [
            { color: { $in: colorRegexes } },
            { "variants.colorName": { $in: colorRegexes } },
            { "variants.colorHex": { $in: colors.map((value) => value.toUpperCase()) } },
          ],
        });
      }
    }

    // ── Sizes (root sizes OR variant sizes) ─────────────────────────────────
    if (this.queryStr.sizes) {
      const sizes = String(this.queryStr.sizes)
        .split(",")
        .map((value) => value.trim())
        .filter(Boolean);
      if (sizes.length) {
        this._andClauses.push({
          $or: [{ "variants.sizes.size": { $in: sizes } }, { "sizes.size": { $in: sizes } }],
        });
      }
    }

    // ── Merchandising flags ─────────────────────────────────────────────────
    if (this.queryStr.homeSection) {
      const homeSections = String(this.queryStr.homeSection)
        .split(",")
        .map((value) => value.trim())
        .filter(Boolean);
      if (homeSections.length) filterObj.homeSection = { $in: homeSections };
    }

    if (this.queryStr.featured === "true") filterObj.isFeatured = true;
    if (this.queryStr.newArrival === "true") filterObj.isNewArrival = true;
    if (this.queryStr.bestSeller === "true") filterObj.isBestSeller = true;
    if (this.queryStr.trending === "true") filterObj.isTrending = true;
    if (this.queryStr.onSale === "true") filterObj.onSale = true;

    // ── Tags ────────────────────────────────────────────────────────────────
    if (this.queryStr.tags) {
      const tags = String(this.queryStr.tags)
        .split(",")
        .map((value) => value.trim())
        .filter(Boolean);
      if (tags.length) filterObj.tags = { $in: tags };
    }

    // ── Rating ──────────────────────────────────────────────────────────────
    if (this.queryStr.rating !== undefined && this.queryStr.rating !== "") {
      const rating = Number(this.queryStr.rating);
      if (Number.isFinite(rating)) filterObj.ratings = { $gte: rating };
    }

    // ── Stock ───────────────────────────────────────────────────────────────
    if (this.queryStr.inStock === "true") {
      this._andClauses.push({
        $or: [
          { stock: { $gt: 0 } },
          { "sizes.stock": { $gt: 0 } },
          { "variants.stock": { $gt: 0 } },
          { "variants.sizes.stock": { $gt: 0 } },
        ],
      });
    }
    if (this.queryStr.inStock === "false" || this.queryStr.outOfStock === "true") {
      this._andClauses.push({
        $and: [
          { $or: [{ stock: { $lte: 0 } }, { stock: { $exists: false } }] },
          { "sizes.stock": { $not: { $gt: 0 } } },
          { "variants.stock": { $not: { $gt: 0 } } },
          { "variants.sizes.stock": { $not: { $gt: 0 } } },
        ],
      });
    }

    // ── Merge all clauses ───────────────────────────────────────────────────
    const allClauses = [];
    if (Object.keys(filterObj).length > 0) allClauses.push(filterObj);
    allClauses.push(...this._andClauses);

    if (allClauses.length > 0) {
      this.query = this.query.find({ $and: allClauses });
    }

    return this;
  }

  // 🔀 SORTING
  sort() {
    const sortMap = {
      featured: { isFeatured: -1, homeSection: -1, createdAt: -1 },
      newest: { createdAt: -1 },
      oldest: { createdAt: 1 },
      price_asc: { price: 1 },
      price_desc: { price: -1 },
      best_seller: { isBestSeller: -1, numOfReviews: -1, ratings: -1 },
      rating: { ratings: -1, numOfReviews: -1 },
      popular: { numOfReviews: -1, ratings: -1 },
      discount: { discountPercentage: -1 },
      name_asc: { name: 1 },
      name_desc: { name: -1 },
      updated: { updatedAt: -1 },
    };

    const sortKey = this.queryStr.sort || "newest";
    this.query = this.query.sort(sortMap[sortKey] || sortMap.newest);
    return this;
  }

  // 📄 PAGINATION — safe defaults, max 100 per page
  pagination(defaultPerPage = 12) {
    const currentPage = Math.max(1, Number(this.queryStr.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(this.queryStr.limit) || defaultPerPage));
    const skip = limit * (currentPage - 1);
    this.query = this.query.limit(limit).skip(skip);
    return this;
  }
}

export default APIFilters;
