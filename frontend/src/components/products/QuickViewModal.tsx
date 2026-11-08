import { useEffect, useMemo, useState } from "react";
import type { ProductItem } from "../../services/api";
import { findProductOption } from "../../utils/cart";
import { formatPrice } from "../../utils/currency";
import { useProductExperience } from "./ProductExperienceContext";

export default function QuickViewModal() {
  const experience = useProductExperience();
  const product = experience.quickViewProduct;
  const [selectedVariantName, setSelectedVariantName] = useState("");
  const [selectedSize, setSelectedSize] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [activeImage, setActiveImage] = useState("");

  const activeVariants = useMemo(
    () => (product?.variants || []).filter((variant) => variant.isActive !== false),
    [product]
  );
  const hasVariants = activeVariants.length > 0;
  const selectedVariant = activeVariants.find(
    (variant) =>
      variant.variantName === selectedVariantName || variant.colorName === selectedVariantName
  );
  const availableSizes = hasVariants ? selectedVariant?.sizes || [] : product?.sizes || [];

  useEffect(() => {
    if (!product) return;
    setQuantity(1);
    setActiveImage(product.image);
    if (hasVariants) {
      const firstVariant =
        activeVariants.find((variant) => (variant.sizes || []).some((size) => (size.stock || 0) > 0)) ||
        activeVariants[0];
      setSelectedVariantName(firstVariant?.variantName || "");
      const firstSize =
        (firstVariant?.sizes || []).find((size) => (size.stock || 0) > 0) || firstVariant?.sizes?.[0];
      setSelectedSize(firstSize?.size || "");
      setActiveImage(firstVariant?.images?.[0]?.url || product.image);
    } else {
      const firstSize =
        (product.sizes || []).find((size) => (size.stock || 0) > 0) || product.sizes?.[0];
      setSelectedVariantName("");
      setSelectedSize(firstSize?.size || "");
    }
  }, [product, hasVariants, activeVariants]);

  useEffect(() => {
    if (!product) return;
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") experience.closeQuickView();
    };
    document.addEventListener("keydown", handleKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", handleKey);
      document.body.style.overflow = "";
    };
  }, [product, experience]);

  if (!product) return null;

  const selection = {
    size: selectedSize || undefined,
    variantName: hasVariants ? selectedVariantName || undefined : undefined,
  };
  const resolved = findProductOption(product, selection);
  const price = resolved.price || product.price;
  const comparePrice = resolved.option?.comparePrice || selectedVariant?.mrp || product.old;
  const requiresSize = (product.sizes || []).length > 0 || (selectedVariant?.sizes || []).length > 0;
  const canAdd = Boolean(selectedVariantName || !hasVariants) && (!requiresSize || Boolean(selectedSize)) && resolved.stock > 0;

  const gallery = [
    ...(selectedVariant?.images || []).map((image) => image.url),
    ...(product.images || []).map((image) => image.url),
    product.image,
  ].filter((url, index, list) => Boolean(url) && list.indexOf(url) === index);

  const handleVariantSelect = (variantName: string) => {
    const variant = activeVariants.find(
      (entry) => entry.variantName === variantName || entry.colorName === variantName
    );
    setSelectedVariantName(variantName);
    const firstSize =
      (variant?.sizes || []).find((size) => (size.stock || 0) > 0) || variant?.sizes?.[0];
    setSelectedSize(firstSize?.size || "");
    setActiveImage(variant?.images?.[0]?.url || product.image);
    setQuantity(1);
  };

  const add = (buyNow = false) => {
    if (!canAdd) return;
    const options = { ...selection, quantity };
    if (buyNow) {
      experience.buyNow(product.id, options);
      experience.closeQuickView();
      return;
    }
    experience.addToCart(product.id, options);
    experience.closeQuickView();
  };

  return (
    <div className="qv-backdrop" role="dialog" aria-modal="true" aria-label={`Quick view: ${product.name}`} onClick={experience.closeQuickView}>
      <div className="qv-modal" onClick={(event) => event.stopPropagation()}>
        <button type="button" className="qv-close" onClick={experience.closeQuickView} aria-label="Close quick view">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
            <path d="m6 6 12 12M18 6 6 18" />
          </svg>
        </button>

        <div className="qv-gallery">
          <div className="qv-gallery__main">
            <img src={activeImage || undefined} alt={product.name} />
            {product.discountPercentage ? (
              <span className="qv-discount">{product.discountPercentage}% off</span>
            ) : null}
          </div>
          {gallery.length > 1 && (
            <div className="qv-gallery__thumbs">
              {gallery.slice(0, 5).map((url, index) => (
                <button
                  key={`${url}-${index}`}
                  type="button"
                  className={activeImage === url ? "is-active" : ""}
                  onClick={() => setActiveImage(url)}
                >
                  <img src={url} alt={`${product.name} view ${index + 1}`} />
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="qv-info">
          <p className="qv-brand">{product.brand || "Delivix"} <span>·</span> {product.category}</p>
          <h2>{product.name}</h2>

          <div className="qv-rating">
            <span className="qv-stars">
              {[1, 2, 3, 4, 5].map((star) => (
                <svg key={star} width="13" height="13" viewBox="0 0 24 24" fill={star <= Math.round(product.ratings || 0) ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.5">
                  <path d="m12 2 3.1 6.3 6.9 1-5 4.9 1.2 6.8-6.2-3.2L5.8 21 7 14.2 2 9.3l6.9-1L12 2Z" />
                </svg>
              ))}
            </span>
            <span>{product.ratings ? product.ratings.toFixed(1) : "New"}</span>
            <button type="button" onClick={() => { experience.closeQuickView(); experience.openProduct(product.id); }}>
              {product.numOfReviews || 0} reviews
            </button>
          </div>

          <div className="qv-price">
            <strong>{formatPrice(price)}</strong>
            {comparePrice && comparePrice > price && <del>{formatPrice(comparePrice)}</del>}
            {comparePrice && comparePrice > price && (
              <span>Save {formatPrice(comparePrice - price)}</span>
            )}
          </div>

          <p className="qv-desc">{product.shortDescription || product.description}</p>

          {hasVariants && (
            <div className="qv-option">
              <div className="qv-option__label">
                <strong>Colour</strong>
                <span>{selectedVariant?.colorName || selectedVariantName}</span>
              </div>
              <div className="qv-swatches">
                {activeVariants.map((variant) => (
                  <button
                    key={variant.variantName}
                    type="button"
                    className={`qv-swatch ${selectedVariantName === variant.variantName ? "is-active" : ""} ${(variant.stock || 0) <= 0 ? "is-unavailable" : ""}`}
                    onClick={() => handleVariantSelect(variant.variantName)}
                    title={`${variant.colorName || variant.variantName}${(variant.stock || 0) <= 0 ? " — out of stock" : ""}`}
                  >
                    <span style={{ backgroundColor: variant.colorHex || "#d4d4d8" }} />
                    {variant.colorName || variant.variantName}
                  </button>
                ))}
              </div>
            </div>
          )}

          {availableSizes.length > 0 && (
            <div className="qv-option">
              <div className="qv-option__label">
                <strong>Size</strong>
                <span>{selectedSize || "Select a size"}</span>
              </div>
              <div className="qv-sizes">
                {availableSizes.map((size) => (
                  <button
                    key={size.size}
                    type="button"
                    className={selectedSize === size.size ? "is-active" : ""}
                    disabled={(size.stock || 0) <= 0}
                    onClick={() => setSelectedSize(size.size)}
                  >
                    {size.size}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="qv-stock-row">
            <span className={`qv-stock ${resolved.stock <= 0 ? "is-out" : resolved.stock <= (product.minStockLevel || 5) ? "is-low" : "is-in"}`}>
              <i /> {resolved.stock <= 0 ? "Out of stock" : resolved.stock <= (product.minStockLevel || 5) ? `Only ${resolved.stock} left` : "In stock"}
            </span>
            <span className="qv-sku">SKU: {selectedVariant?.sku || product.sku || "—"}</span>
          </div>

          <div className="qv-buy">
            <div className="qv-qty">
              <button type="button" onClick={() => setQuantity((value) => Math.max(1, value - 1))} aria-label="Decrease quantity">−</button>
              <span>{quantity}</span>
              <button type="button" onClick={() => setQuantity((value) => Math.min(resolved.stock || 1, value + 1))} aria-label="Increase quantity">+</button>
            </div>
            <button type="button" className="qv-add" disabled={!canAdd} onClick={() => add(false)}>
              {resolved.stock <= 0 ? "Out of stock" : requiresSize && !selectedSize ? "Select a size" : "Add to bag"}
            </button>
            <button type="button" className="qv-buy-now" disabled={!canAdd} onClick={() => add(true)}>
              Buy now
            </button>
            <button
              type="button"
              className={`qv-wish ${experience.wished.some((id) => String(id) === String(product.id)) ? "is-active" : ""}`}
              onClick={() => experience.toggleWish(product.id)}
              aria-label="Toggle wishlist"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill={experience.wished.some((id) => String(id) === String(product.id)) ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.7">
                <path d="M20.8 4.6a5.4 5.4 0 0 0-7.6 0L12 5.8l-1.2-1.2a5.4 5.4 0 0 0-7.6 7.6L12 21l8.8-8.8a5.4 5.4 0 0 0 0-7.6Z" />
              </svg>
            </button>
          </div>

          <button
            type="button"
            className="qv-view-details"
            onClick={() => {
              experience.closeQuickView();
              experience.openProduct(product.id);
            }}
          >
            View full details
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
              <path d="M5 12h14M14 7l5 5-5 5" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
