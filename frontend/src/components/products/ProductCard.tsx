import { useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import type { ProductItem, ProductVariant } from "../../services/api";
import { findProductOption } from "../../utils/cart";
import { formatPrice } from "../../utils/currency";
import { useProductExperience } from "./ProductExperienceContext";

interface ProductCardProps {
  product: ProductItem;
  wished: boolean;
  onWish: () => void;
  onAdd: (options?: { size?: string; variantName?: string; quantity?: number }) => void;
  onOpen: () => void;
  compact?: boolean;
}

const StarRating = ({ rating, count }: { rating: number; count: number }) => (
  <div className="pcard-rating" aria-label={`${rating || 0} out of 5 stars`}>
    <span className="pcard-rating__stars" aria-hidden="true">
      {[1, 2, 3, 4, 5].map((star) => (
        <svg
          key={star}
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill={star <= Math.round(rating) ? "currentColor" : "none"}
          stroke="currentColor"
          strokeWidth="1.6"
        >
          <path d="m12 2 3.1 6.3 6.9 1-5 4.9 1.2 6.8-6.2-3.2L5.8 21 7 14.2 2 9.3l6.9-1L12 2Z" />
        </svg>
      ))}
    </span>
    <span>{rating ? rating.toFixed(1) : "New"}</span>
    {count > 0 && <span className="pcard-rating__count">({count})</span>}
  </div>
);

export default function ProductCard({
  product,
  wished,
  onWish,
  onAdd,
  onOpen,
  compact = false,
}: ProductCardProps) {
  const experience = useProductExperience();
  const [selectedVariantName, setSelectedVariantName] = useState("");
  const [selectedSize, setSelectedSize] = useState("");
  const [added, setAdded] = useState(false);
  const [adding, setAdding] = useState(false);

  const activeVariants = useMemo(
    () => (product.variants || []).filter((variant) => variant.isActive !== false),
    [product.variants]
  );
  const hasVariants = activeVariants.length > 0;
  const hasRootSizes = (product.sizes || []).length > 0;

  const selectedVariant = useMemo<ProductVariant | undefined>(
    () =>
      activeVariants.find(
        (variant) =>
          variant.variantName === selectedVariantName || variant.colorName === selectedVariantName
      ),
    [activeVariants, selectedVariantName]
  );

  const availableSizes = useMemo(
    () => (hasVariants ? selectedVariant?.sizes || [] : product.sizes || []),
    [hasVariants, selectedVariant, product.sizes]
  );

  useEffect(() => {
    setSelectedVariantName("");
    setSelectedSize("");
    setAdded(false);
  }, [product.id]);

  useEffect(() => {
    if (hasVariants) {
      const firstVariant =
        activeVariants.find((variant) =>
          (variant.sizes || []).some((size) => (size.stock || 0) > 0)
        ) || activeVariants[0];
      setSelectedVariantName(firstVariant?.variantName || "");
      const firstSize =
        (firstVariant?.sizes || []).find((size) => (size.stock || 0) > 0) ||
        firstVariant?.sizes?.[0];
      setSelectedSize(firstSize?.size || "");
    } else if (hasRootSizes) {
      const firstSize =
        (product.sizes || []).find((size) => (size.stock || 0) > 0) || product.sizes?.[0];
      setSelectedSize(firstSize?.size || "");
    }
  }, [product.id, hasVariants, hasRootSizes, activeVariants, product.sizes]);

  const selection = {
    size: selectedSize || undefined,
    variantName: hasVariants ? selectedVariantName || undefined : undefined,
  };
  const resolved = findProductOption(product, selection);
  const price = resolved.price || product.price;
  const comparePrice = resolved.option?.comparePrice || selectedVariant?.mrp || product.old || product.mrp;
  const discount =
    comparePrice && comparePrice > price
      ? Math.round(((comparePrice - price) / comparePrice) * 100)
      : product.discountPercentage || 0;

  const requiresSize = hasRootSizes || (selectedVariant?.sizes || []).length > 0;
  const canAdd = hasVariants
    ? Boolean(selectedVariantName) && (!requiresSize || Boolean(selectedSize)) && resolved.stock > 0
    : hasRootSizes
      ? Boolean(selectedSize) && resolved.stock > 0
      : resolved.stock > 0;

  const stock = resolved.stock;
  const lowStockThreshold = product.minStockLevel || product.lowStockThreshold || 5;
  const stockLabel = stock <= 0 ? "Out of stock" : stock <= lowStockThreshold ? "Low stock" : "In stock";
  const stockClass = stock <= 0 ? "is-out" : stock <= lowStockThreshold ? "is-low" : "is-in";

  const selectedVariantImages = selectedVariant?.images || [];
  const baseImage = selectedVariantImages[0]?.url || product.image;
  const hoverImage =
    selectedVariantImages[1]?.url ||
    product.hoverImage ||
    (product.images || [])[1]?.url ||
    baseImage;
  const colors = useMemo(() => {
    if (!hasVariants) return [];
    return activeVariants.map((variant) => ({
      name: variant.variantName,
      label: variant.colorName || variant.variantName,
      hex: variant.colorHex || "#d4d4d8",
      available:
        (variant.stock ?? (variant.sizes || []).reduce((total, size) => total + (size.stock || 0), 0)) > 0,
    }));
  }, [activeVariants, hasVariants]);

  const badges = useMemo(() => {
    const list: { label: string; tone: string }[] = [];
    if (discount > 0) list.push({ label: `${discount}% OFF`, tone: "discount" });
    if (product.isNewArrival || product.badge === "NEW") list.push({ label: "New", tone: "new" });
    if (product.isBestSeller || product.badge === "BESTSELLER") list.push({ label: "Best seller", tone: "best" });
    if (product.isTrending || product.badge === "TRENDING") list.push({ label: "Trending", tone: "trending" });
    if (product.isFeatured || product.badge === "FEATURED") list.push({ label: "Featured", tone: "featured" });
    if (!list.length && product.badge) list.push({ label: product.badge, tone: "default" });
    return list.slice(0, 1);
  }, [discount, product.badge, product.isBestSeller, product.isFeatured, product.isNewArrival, product.isTrending]);

  const handleAdd = () => {
    if (!canAdd) {
      experience.openQuickView(product);
      return;
    }
    const options = {
      ...selection,
      quantity: 1,
    };
    if (adding) return;
    setAdding(true);
    onAdd(options);
    setAdded(true);
    toast.success(`${product.name} added to bag`);
    window.setTimeout(() => {
      setAdded(false);
      setAdding(false);
    }, 800);
  };

  return (
    <article
      className={`pcard ${compact ? "pcard--compact" : ""} ${stock <= 0 ? "pcard--out" : ""}`}
    >
      <div className="pcard-media" onClick={onOpen} role="button" tabIndex={0} onKeyDown={(event) => event.key === "Enter" && onOpen()}>
        <img
          className="pcard-media__primary"
          src={baseImage || undefined}
          alt={product.name}
          loading="lazy"
          decoding="async"
        />
        {hoverImage !== baseImage && (
          <img
            className="pcard-media__hover"
            src={hoverImage}
            alt=""
            aria-hidden="true"
            loading="lazy"
            decoding="async"
          />
        )}

        <div className="pcard-badges">
          {badges.map((badge) => (
            <span key={`${badge.tone}-${badge.label}`} className={`pcard-badge pcard-badge--${badge.tone}`}>
              {badge.label}
            </span>
          ))}
        </div>

        <div className="pcard-media__actions">
          <button
            type="button"
            className="pcard-icon-btn"
            onClick={(event) => {
              event.stopPropagation();
              experience.openQuickView(product);
            }}
            aria-label="Quick view"
            title="Quick view"
          >
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
              <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
              <circle cx="12" cy="12" r="3" />
            </svg>
          </button>
          <button
            type="button"
            className={`pcard-icon-btn ${experience.isCompared(product.id) ? "is-active" : ""}`}
            onClick={(event) => {
              event.stopPropagation();
              experience.toggleCompare(product);
            }}
            aria-label="Compare product"
            title="Compare product"
          >
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
              <path d="M4 7h10M4 12h16M4 17h7" />
              <path d="m17 4 3 3-3 3M20 20l-3-3 3-3" />
            </svg>
          </button>
        </div>

        {(stock <= 0 || stock <= lowStockThreshold) && (
          <span className={`pcard-stock ${stockClass}`}>
            <i /> {stockLabel}
          </span>
        )}
      </div>

      <div className="pcard-body">
        <div className="pcard-meta">
          <span>{product.brand || "Delivix"}</span>
        </div>

        <h3 className="pcard-title" onClick={onOpen}>
          {product.name}
        </h3>

        {((product.ratings || 0) > 0 || (product.numOfReviews || product.reviewCount || 0) > 0) && (
          <StarRating
            rating={product.ratings || 0}
            count={product.numOfReviews || product.reviewCount || 0}
          />
        )}

        <div className="pcard-price">
          <strong>{formatPrice(price)}</strong>
          {comparePrice && comparePrice > price && <del>{formatPrice(comparePrice)}</del>}
          {discount > 0 && <span className="pcard-save">{discount}% off</span>}
        </div>

        {(colors.length > 0 || availableSizes.length > 0) && (
          <div className="pcard-options">
            {colors.length > 0 && (
              <div className="pcard-colors" aria-label="Available colours">
                {colors.slice(0, 4).map((color) => (
                  <button
                    key={color.name}
                    type="button"
                    className={`pcard-swatch ${selectedVariantName === color.name ? "is-selected" : ""} ${color.available ? "" : "is-unavailable"}`}
                    style={{ backgroundColor: color.hex }}
                    onClick={(event) => {
                      event.stopPropagation();
                      if (hasVariants) {
                        const variant = activeVariants.find(
                          (entry) => entry.variantName === color.name || entry.colorName === color.name
                        );
                        setSelectedVariantName(color.name);
                        const firstSize =
                          (variant?.sizes || []).find((size) => (size.stock || 0) > 0) ||
                          variant?.sizes?.[0];
                        setSelectedSize(firstSize?.size || "");
                      }
                    }}
                    title={`${color.label}${color.available ? "" : " — out of stock"}`}
                    aria-label={`${color.label}${selectedVariantName === color.name ? ", selected" : ""}${color.available ? "" : ", out of stock"}`}
                  />
                ))}
                {colors.length > 4 && (
                  <button
                    type="button"
                    className="pcard-colors__more"
                    onClick={(event) => {
                      event.stopPropagation();
                      experience.openQuickView(product);
                    }}
                    aria-label={`View ${colors.length - 4} more colours`}
                    title={`View ${colors.length - 4} more colours`}
                  >
                    +{colors.length - 4}
                  </button>
                )}
              </div>
            )}

            {availableSizes.length > 0 && (
              <div className="pcard-sizes" aria-label="Available sizes">
                {availableSizes.slice(0, 5).map((size) => (
                  <button
                    key={size.size}
                    type="button"
                    className={`pcard-size ${selectedSize === size.size ? "is-selected" : ""}`}
                    disabled={(size.stock || 0) <= 0}
                    onClick={(event) => {
                      event.stopPropagation();
                      setSelectedSize(size.size);
                    }}
                    title={(size.stock || 0) <= 0 ? `${size.size} — out of stock` : size.size}
                  >
                    {size.size}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        <div className="pcard-actions">
          <button
            type="button"
            className="pcard-add"
            disabled={stock <= 0 || adding}
            aria-busy={adding}
            onClick={(event) => {
              event.stopPropagation();
              handleAdd(false);
            }}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true">
              <path d="M5 8h14l1 13H4L5 8Z" />
              <path d="M9 8a3 3 0 0 1 6 0" />
            </svg>
            <span>{added ? "Added" : requiresSize && !selectedSize ? "Choose options" : stock <= 0 ? "Sold out" : adding ? "Adding…" : "Add to bag"}</span>
          </button>
          <button
            type="button"
            className={`pcard-wish ${wished ? "is-active" : ""}`}
            onClick={(event) => {
              event.stopPropagation();
              onWish();
            }}
            aria-label={wished ? "Remove from wishlist" : "Add to wishlist"}
            aria-pressed={wished}
            title={wished ? "Remove from wishlist" : "Add to wishlist"}
          >
            <svg width="17" height="17" viewBox="0 0 24 24" fill={wished ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.7" aria-hidden="true">
              <path d="M20.8 4.6a5.4 5.4 0 0 0-7.6 0L12 5.8l-1.2-1.2a5.4 5.4 0 0 0-7.6 7.6L12 21l8.8-8.8a5.4 5.4 0 0 0 0-7.6Z" />
            </svg>
          </button>
        </div>
      </div>
    </article>
  );
}
