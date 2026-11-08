import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ProductImage, ProductItem, ProductOption, ProductVariant } from "../../services/api";
import { findProductOption } from "../../utils/cart";
import { formatPrice } from "../../utils/currency";
import { formatReturnPolicy } from "../../utils/product";
import ProductCard from "./ProductCard";
import ProductReviews from "./ProductReviews";

type DetailPageTarget = "home" | "shop" | "cart" | "checkout" | "product" | "wishlist";

interface ProductDetailPageProps {
  product: ProductItem;
  relatedProducts: ProductItem[];
  wished: (string | number)[];
  onToggleWish: (id: string | number) => void;
  onAddToCart: (
    id: string | number,
    options?: { quantity?: number; size?: string; variantName?: string }
  ) => void;
  onBuyNow: (
    id: string | number,
    options?: { quantity?: number; size?: string; variantName?: string }
  ) => void;
  setPage: (page: DetailPageTarget) => void;
  onOpenProduct: (id: string | number) => void;
  onOpenCategory: (category: string) => void;
}

type GalleryMedia = { type: "image" | "video"; url: string };
type DetailTab = "description" | "specs" | "shipping" | "reviews";

const Stars = ({ value, size = 14 }: { value: number; size?: number }) => (
  <span className="pd-stars" aria-label={`${value} out of 5 stars`}>
    {[1, 2, 3, 4, 5].map((star) => (
      <svg
        key={star}
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill={star <= Math.round(value) ? "currentColor" : "none"}
        stroke="currentColor"
        strokeWidth="1.5"
      >
        <path d="m12 2 3.1 6.3 6.9 1-5 4.9 1.2 6.8-6.2-3.2L5.8 21 7 14.2 2 9.3l6.9-1L12 2Z" />
      </svg>
    ))}
  </span>
);

const deliveryDate = (days: number) => {
  const date = new Date();
  date.setDate(date.getDate() + Math.max(1, days || 3));
  return date.toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" });
};

const uniqueByUrl = (items: ProductImage[]) =>
  items.filter((item, index, list) => item?.url && list.findIndex((entry) => entry?.url === item.url) === index);

export default function ProductDetailPage({
  product,
  relatedProducts,
  wished,
  onToggleWish,
  onAddToCart,
  onBuyNow,
  setPage,
  onOpenProduct,
  onOpenCategory,
}: ProductDetailPageProps) {
  const activeVariants = useMemo(
    () => (product.variants || []).filter((variant) => variant.isActive !== false),
    [product.variants]
  );
  const hasVariants = activeVariants.length > 0;
  const hasRootSizes = (product.sizes || []).length > 0;

  const [selectedVariantName, setSelectedVariantName] = useState("");
  const [selectedSize, setSelectedSize] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [added, setAdded] = useState(false);
  const [tab, setTab] = useState<DetailTab>("description");
  const [activeMedia, setActiveMedia] = useState("");
  const [zoom, setZoom] = useState<{ active: boolean; x: number; y: number }>({
    active: false,
    x: 50,
    y: 50,
  });
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [viewer360, setViewer360] = useState(false);
  const [frame360, setFrame360] = useState(0);
  const drag360 = useRef<{ startX: number; startFrame: number } | null>(null);
  const [reviewStats, setReviewStats] = useState({
    count: product.numOfReviews || 0,
    average: product.ratings || 0,
  });

  const selectedVariant = useMemo<ProductVariant | undefined>(
    () =>
      activeVariants.find(
        (variant) =>
          variant.variantName === selectedVariantName || variant.colorName === selectedVariantName
      ),
    [activeVariants, selectedVariantName]
  );

  const availableSizes = useMemo<ProductOption[]>(
    () => (hasVariants ? selectedVariant?.sizes || [] : product.sizes || []),
    [hasVariants, selectedVariant, product.sizes]
  );

  useEffect(() => {
    setQuantity(1);
    setAdded(false);
    setTab("description");
    setActiveMedia("");
    setZoom({ active: false, x: 50, y: 50 });
    setLightboxIndex(null);
    setViewer360(false);
    setFrame360(0);
    setReviewStats({ count: product.numOfReviews || 0, average: product.ratings || 0 });

    if (hasVariants) {
      const firstVariant =
        activeVariants.find((variant) => (variant.stock || 0) > 0) || activeVariants[0];
      setSelectedVariantName(firstVariant?.variantName || "");
      const firstSize =
        (firstVariant?.sizes || []).find((size) => (size.stock || 0) > 0) ||
        firstVariant?.sizes?.[0];
      setSelectedSize(firstSize?.size || "");
    } else if (hasRootSizes) {
      setSelectedVariantName("");
      const firstSize =
        (product.sizes || []).find((size) => (size.stock || 0) > 0) || product.sizes?.[0];
      setSelectedSize(firstSize?.size || "");
    } else {
      setSelectedVariantName("");
      setSelectedSize("");
    }
  }, [product.id, hasVariants, hasRootSizes, activeVariants, product.sizes, product.numOfReviews, product.ratings]);

  const selection = {
    size: selectedSize || undefined,
    variantName: hasVariants ? selectedVariantName || undefined : undefined,
  };
  const resolved = findProductOption(product, selection);
  const price = resolved.price || product.price;
  const comparePrice =
    resolved.option?.comparePrice || selectedVariant?.mrp || product.old || product.mrp;
  const discount =
    comparePrice && comparePrice > price
      ? Math.round(((comparePrice - price) / comparePrice) * 100)
      : product.discountPercentage || 0;

  const requiresSize = hasRootSizes || (selectedVariant?.sizes || []).length > 0;
  const stock = resolved.stock;
  const canAdd = hasVariants
    ? Boolean(selectedVariantName) && (!requiresSize || Boolean(selectedSize)) && stock > 0
    : hasRootSizes
      ? Boolean(selectedSize) && stock > 0
      : stock > 0;
  const lowStockThreshold = product.minStockLevel || product.lowStockThreshold || 5;

  const sku =
    resolved.option?.sku || selectedVariant?.sku || product.sku || String(product.id).slice(-8).toUpperCase();

  const hasReturnPolicy = Boolean(product.returnPolicy);
  const returnPolicy = formatReturnPolicy(product.returnPolicy, "Easy returns");

  const gallery: GalleryMedia[] = useMemo(() => {
    const images = uniqueByUrl([
      ...(selectedVariant?.images || []),
      ...(product.images || []),
    ]);
    const videos = uniqueByUrl(product.videos || []);
    return [
      ...images.map((image) => ({ type: "image" as const, url: image.url })),
      ...videos.map((video) => ({ type: "video" as const, url: video.url })),
    ];
  }, [selectedVariant, product.images, product.videos]);

  useEffect(() => {
    if (!gallery.length) {
      setActiveMedia(product.image || "");
      return;
    }
    setActiveMedia((current) =>
      current && gallery.some((media) => media.url === current) ? current : gallery[0].url
    );
  }, [gallery, product.image]);

  const activeIndex = Math.max(
    0,
    gallery.findIndex((media) => media.url === activeMedia)
  );
  const activeGalleryItem = gallery[activeIndex] || gallery[0];

  const showLightbox = (index: number) => {
    if (gallery[index]?.type === "video") {
      setActiveMedia(gallery[index].url);
      return;
    }
    setLightboxIndex(index);
  };

  const moveLightbox = useCallback(
    (direction: number) => {
      if (lightboxIndex === null) return;
      const imageItems = gallery
        .map((media, index) => ({ media, index }))
        .filter((entry) => entry.media.type === "image");
      const currentPosition = imageItems.findIndex((entry) => entry.index === lightboxIndex);
      if (currentPosition === -1) return;
      const nextPosition = (currentPosition + direction + imageItems.length) % imageItems.length;
      setLightboxIndex(imageItems[nextPosition].index);
    },
    [gallery, lightboxIndex]
  );

  useEffect(() => {
    if (lightboxIndex === null) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setLightboxIndex(null);
      if (event.key === "ArrowRight") moveLightbox(1);
      if (event.key === "ArrowLeft") moveLightbox(-1);
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [lightboxIndex, moveLightbox]);

  const handleVariantSelect = (variant: ProductVariant) => {
    setSelectedVariantName(variant.variantName);
    const firstSize =
      (variant.sizes || []).find((size) => (size.stock || 0) > 0) || variant.sizes?.[0];
    setSelectedSize(firstSize?.size || "");
    setQuantity(1);
    const variantImage = variant.images?.[0]?.url;
    if (variantImage) setActiveMedia(variantImage);
  };

  const handleAdd = (buyNow = false) => {
    if (!canAdd) return;
    const options = { ...selection, quantity };
    if (buyNow) {
      onBuyNow(product.id, options);
      return;
    }
    onAddToCart(product.id, options);
    setAdded(true);
    window.setTimeout(() => setAdded(false), 1600);
  };

  const related = useMemo(() => {
    const others = relatedProducts.filter((entry) => String(entry.id) !== String(product.id));
    const sameCategory = others.filter(
      (entry) => entry.category?.toLowerCase() === product.category?.toLowerCase()
    );
    const rest = others.filter((entry) => !sameCategory.includes(entry));
    return [...sameCategory, ...rest].slice(0, 4);
  }, [relatedProducts, product.id, product.category]);

  const highlights = product.highlights?.length ? product.highlights : product.features || [];
  const reviewCount = reviewStats.count;
  const detailTabs: { key: DetailTab; label: string; index: string }[] = [
    { key: "description", label: "Description", index: "01" },
    { key: "specs", label: "Specifications", index: "02" },
    { key: "shipping", label: "Shipping & returns", index: "03" },
    { key: "reviews", label: "Reviews", index: "04" },
  ];
  const isWished = wished.some((id) => String(id) === String(product.id));
  const frames360 = product.images360 || [];
  const canView360 = Boolean(product.has360View) && frames360.length > 1;

  const startDrag360 = (clientX: number) => {
    drag360.current = { startX: clientX, startFrame: frame360 };
  };
  const moveDrag360 = (clientX: number) => {
    if (!drag360.current || frames360.length < 2) return;
    const delta = clientX - drag360.current.startX;
    const steps = Math.round(delta / 18);
    const next = (drag360.current.startFrame + steps + frames360.length * 4) % frames360.length;
    setFrame360(next);
  };

  return (
    <main className="page pd-page">
      <div className="container">
        <nav className="breadcrumbs" aria-label="Breadcrumb">
          <button type="button" onClick={() => setPage("home")}>Home</button>
          <span className="sep">/</span>
          <button type="button" onClick={() => setPage("shop")}>Shop</button>
          <span className="sep">/</span>
          <button type="button" onClick={() => onOpenCategory(product.category)}>{product.category}</button>
          <span className="sep">/</span>
          <span aria-current="page">{product.name}</span>
        </nav>

        <div className="pd-layout">
          <section className="pd-gallery" aria-label="Product gallery">
            <div
              className={`pd-gallery__stage ${zoom.active ? "is-zoomed" : ""}`}
              onMouseEnter={() => setZoom((current) => ({ ...current, active: true }))}
              onMouseLeave={() => setZoom({ active: false, x: 50, y: 50 })}
              onMouseMove={(event) => {
                const bounds = event.currentTarget.getBoundingClientRect();
                setZoom({
                  active: true,
                  x: ((event.clientX - bounds.left) / bounds.width) * 100,
                  y: ((event.clientY - bounds.top) / bounds.height) * 100,
                });
              }}
            >
              {activeGalleryItem?.type === "video" ? (
                <video src={activeGalleryItem.url} controls playsInline preload="metadata" />
              ) : (
                <img
                  src={activeGalleryItem?.url || product.image || undefined}
                  alt={product.name}
                  style={
                    zoom.active
                      ? { transform: "scale(1.9)", transformOrigin: `${zoom.x}% ${zoom.y}%` }
                      : undefined
                  }
                />
              )}

              <div className="pd-gallery__badges">
                {discount > 0 && <span className="pd-badge pd-badge--sale">{discount}% off</span>}
                {product.isNewArrival && <span className="pd-badge">New arrival</span>}
                {product.isBestSeller && <span className="pd-badge">Best seller</span>}
                {product.isTrending && <span className="pd-badge">Trending</span>}
                {product.isFeatured && <span className="pd-badge">Featured</span>}
              </div>

              <div className="pd-gallery__tools">
                {activeGalleryItem?.type === "image" && (
                  <button
                    type="button"
                    onClick={() => showLightbox(activeIndex)}
                    aria-label="Open fullscreen gallery"
                    title="Fullscreen"
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                      <path d="M8 3H3v5M16 3h5v5M8 21H3v-5M16 21h5v-5" />
                    </svg>
                  </button>
                )}
                {canView360 && (
                  <button
                    type="button"
                    onClick={() => setViewer360(true)}
                    className="pd-gallery__360"
                    title="View in 360°"
                  >
                    360°
                  </button>
                )}
              </div>

              {activeGalleryItem?.type === "image" && (
                <span className="pd-gallery__zoomhint">Hover to zoom · Click to expand</span>
              )}
            </div>

            <div className="pd-gallery__thumbs">
              {gallery.map((media, index) => (
                <button
                  key={`${media.type}-${media.url}`}
                  type="button"
                  className={activeMedia === media.url ? "is-active" : ""}
                  onClick={() => {
                    setActiveMedia(media.url);
                    if (media.type === "image") setLightboxIndex(null);
                  }}
                  aria-label={media.type === "video" ? "Play product video" : `View image ${index + 1}`}
                >
                  {media.type === "video" ? (
                    <>
                      <video src={media.url} muted preload="metadata" />
                      <span className="pd-thumb-play">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                          <path d="m8 5 11 7-11 7V5Z" />
                        </svg>
                      </span>
                    </>
                  ) : (
                    <img src={media.url} alt={`${product.name} view ${index + 1}`} loading="lazy" />
                  )}
                </button>
              ))}
              {canView360 && (
                <button
                  type="button"
                  className="pd-thumb-360"
                  onClick={() => setViewer360(true)}
                  aria-label="Open 360 degree view"
                >
                  <span>360°</span>
                  <small>View</small>
                </button>
              )}
            </div>
          </section>

          <section className="pd-info" aria-label="Product information">
            <p className="pd-brandline">
              <span>{product.brand || "Delivix"}</span>
              {product.category && (
                <>
                  <i />
                  <button type="button" onClick={() => onOpenCategory(product.category)}>
                    {product.category}
                  </button>
                </>
              )}
              {product.subcategory && (
                <>
                  <i />
                  <button type="button" onClick={() => onOpenCategory(product.subcategory || "")}>
                    {product.subcategory}
                  </button>
                </>
              )}
            </p>

            <h1>{product.name}</h1>

            <div className="pd-rating-row">
              {reviewCount > 0 ? (
                <>
                  <Stars value={reviewStats.average} />
                  <strong>{reviewStats.average.toFixed(1)}</strong>
                  <button type="button" onClick={() => setTab("reviews")}>
                    {reviewCount} {reviewCount === 1 ? "review" : "reviews"}
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  className="pd-rating-row__empty"
                  onClick={() => setTab("reviews")}
                >
                  Be the first to review
                </button>
              )}
              <span className="pd-sku">SKU {sku}</span>
            </div>

            <div className="pd-price">
              <strong>{formatPrice(price)}</strong>
              {comparePrice && comparePrice > price && <del>{formatPrice(comparePrice)}</del>}
              {discount > 0 && <span className="pd-price__save">You save {formatPrice((comparePrice || 0) - price)} ({discount}%)</span>}
            </div>
            <p className="pd-tax">
              {product.taxRate
                ? product.taxIncluded
                  ? `Inclusive of ${product.taxRate}% GST`
                  : `Plus ${product.taxRate}% GST calculated at checkout`
                : "Tax calculated at checkout"}
            </p>

            {product.shortDescription && <p className="pd-short">{product.shortDescription}</p>}

            {highlights.length > 0 && (
              <ul className="pd-highlights">
                {highlights.slice(0, 5).map((highlight) => (
                  <li key={highlight}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4">
                      <path d="m5 13 4 4L19 7" />
                    </svg>
                    {highlight}
                  </li>
                ))}
              </ul>
            )}

            {hasVariants && (
              <div className="pd-option">
                <div className="pd-option__head">
                  <strong>Colour</strong>
                  <span>{selectedVariant?.colorName || selectedVariantName || "Select a colour"}</span>
                </div>
                <div className="pd-swatches">
                  {activeVariants.map((variant) => (
                    <button
                      key={variant.variantName}
                      type="button"
                      className={`pd-swatch ${selectedVariantName === variant.variantName ? "is-active" : ""} ${(variant.stock || 0) <= 0 ? "is-unavailable" : ""}`}
                      onClick={() => handleVariantSelect(variant)}
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
              <div className="pd-option">
                <div className="pd-option__head">
                  <strong>{hasVariants ? "Size" : "Choose a size"}</strong>
                  <span>{selectedSize || "Select a size"}</span>
                </div>
                <div className="pd-sizes">
                  {availableSizes.map((size) => (
                    <button
                      key={size.size}
                      type="button"
                      className={selectedSize === size.size ? "is-active" : ""}
                      disabled={(size.stock || 0) <= 0}
                      onClick={() => {
                        setSelectedSize(size.size);
                        setQuantity(1);
                      }}
                      title={(size.stock || 0) <= 0 ? `${size.size} — out of stock` : `${size.size} — ${size.stock || 0} available`}
                    >
                      {size.size}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="pd-stockline">
              <span className={`pd-stock ${stock <= 0 ? "is-out" : stock <= lowStockThreshold ? "is-low" : "is-in"}`}>
                <i />
                {stock <= 0 ? "Out of stock" : stock <= lowStockThreshold ? `Low stock — only ${stock} left` : "In stock & ready to ship"}
              </span>
              <span className="pd-delivery">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
                  <path d="M3 7h11v9H3zM14 10h4l3 3v3h-7z" />
                  <circle cx="7" cy="18" r="1.7" />
                  <circle cx="17" cy="18" r="1.7" />
                </svg>
                Delivery by <strong>{deliveryDate(product.estimatedDeliveryDays || 3)}</strong>
              </span>
            </div>

            <div className="pd-buyrow">
              <div className="pd-qty" aria-label="Quantity">
                <button
                  type="button"
                  onClick={() => setQuantity((value) => Math.max(1, value - 1))}
                  disabled={quantity <= 1}
                  aria-label="Decrease quantity"
                >
                  −
                </button>
                <span>{quantity}</span>
                <button
                  type="button"
                  onClick={() => setQuantity((value) => Math.min(stock || 1, value + 1))}
                  disabled={quantity >= stock}
                  aria-label="Increase quantity"
                >
                  +
                </button>
              </div>

              <button
                type="button"
                className="pd-add"
                disabled={!canAdd}
                onClick={() => handleAdd(false)}
              >
                {added ? "Added to bag ✓" : stock <= 0 ? "Out of stock" : requiresSize && !selectedSize ? "Select a size" : "Add to bag"}
              </button>

              <button
                type="button"
                className="pd-buynow"
                disabled={!canAdd}
                onClick={() => handleAdd(true)}
              >
                Buy now
              </button>

              <button
                type="button"
                className={`pd-wish ${isWished ? "is-active" : ""}`}
                onClick={() => onToggleWish(product.id)}
                aria-label={isWished ? "Remove from wishlist" : "Add to wishlist"}
                title={isWished ? "Remove from wishlist" : "Add to wishlist"}
              >
                <svg width="19" height="19" viewBox="0 0 24 24" fill={isWished ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.7">
                  <path d="M20.8 4.6a5.4 5.4 0 0 0-7.6 0L12 5.8l-1.2-1.2a5.4 5.4 0 0 0-7.6 7.6L12 21l8.8-8.8a5.4 5.4 0 0 0 0-7.6Z" />
                </svg>
              </button>
            </div>

            <div className="pd-trust">
              <div>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
                  <path d="M12 3 4 6v6c0 5 3.4 8.4 8 9 4.6-.6 8-4 8-9V6l-8-3Z" />
                  <path d="m9 12 2 2 4-4" />
                </svg>
                <span>
                  <strong>Secure checkout</strong>
                  Encrypted payments
                </span>
              </div>
              <div>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
                  <path d="M3 7h11v9H3zM14 10h4l3 3v3h-7z" />
                  <circle cx="7" cy="18" r="1.7" />
                  <circle cx="17" cy="18" r="1.7" />
                </svg>
                <span>
                  <strong>Complimentary delivery</strong>
                  On every order
                </span>
              </div>
              <div>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
                  <path d="M3 12a9 9 0 1 0 3-6.7L3 8" />
                  <path d="M3 3v5h5" />
                </svg>
                <span>
                  <strong>{returnPolicy}</strong>
                  {hasReturnPolicy ? "See policy below" : "Within 7 days"}
                </span>
              </div>
            </div>

            {product.tags && product.tags.length > 0 && (
              <div className="pd-tags">
                {product.tags.slice(0, 8).map((tag) => (
                  <span key={tag}>{tag}</span>
                ))}
              </div>
            )}
          </section>
        </div>

        <section className="pd-tabs">
          <div className="pd-tabs__heading">
            <p className="eyebrow">Product guide</p>
            <h2>Everything you need to know</h2>
            <p>Explore product details, delivery information and real customer feedback.</p>
          </div>
          <div className="pd-tabs__nav" role="tablist" aria-label="Product details">
            {detailTabs.map(({ key, label, index }) => (
              <button
                key={key}
                type="button"
                role="tab"
                aria-selected={tab === key}
                aria-controls="pd-panel"
                aria-label={key === "reviews" ? `${label}, ${reviewCount} reviews` : label}
                className={tab === key ? "is-active" : ""}
                onKeyDown={(event) => {
                  if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
                  event.preventDefault();
                  const buttons = event.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>('[role="tab"]');
                  if (!buttons?.length) return;
                  const currentIndex = Array.from(buttons).indexOf(event.currentTarget);
                  const nextIndex =
                    event.key === "Home"
                      ? 0
                      : event.key === "End"
                        ? buttons.length - 1
                        : (currentIndex + (event.key === "ArrowRight" ? 1 : -1) + buttons.length) % buttons.length;
                  buttons[nextIndex].focus();
                  buttons[nextIndex].click();
                }}
                onClick={() => setTab(key)}
                id={`pd-tab-${key}`}
              >
                <span className="pd-tabs__index" aria-hidden="true">{index}</span>
                <span>{label}</span>
                {key === "reviews" && <span className="pd-tabs__count">{reviewCount}</span>}
              </button>
            ))}
          </div>

          <div
            className="pd-tabs__panel"
            id="pd-panel"
            role="tabpanel"
            aria-labelledby={`pd-tab-${tab}`}
            tabIndex={0}
          >
            {tab === "description" && (
              <div className="pd-description">
                <div>
                  <p className="eyebrow pd-description__eyebrow">Product overview</p>
                  <h2>About this product</h2>
                  <p className="pd-description__lead">
                    {product.description || product.shortDescription || "A detailed product description will be available soon."}
                  </p>
                  {product.careInstructions && (
                    <>
                      <h3>Care instructions</h3>
                      <p>{product.careInstructions}</p>
                    </>
                  )}
                </div>
                <aside>
                  <h3>At a glance</h3>
                  <dl>
                    {product.brand && (
                      <>
                        <dt>Brand</dt>
                        <dd>{product.brand}</dd>
                      </>
                    )}
                    {product.category && (
                      <>
                        <dt>Category</dt>
                        <dd>{product.category}</dd>
                      </>
                    )}
                    {product.subcategory && (
                      <>
                        <dt>Subcategory</dt>
                        <dd>{product.subcategory}</dd>
                      </>
                    )}
                    {product.productType && (
                      <>
                        <dt>Type</dt>
                        <dd>{product.productType}</dd>
                      </>
                    )}
                    {product.material && (
                      <>
                        <dt>Material</dt>
                        <dd>{product.material}</dd>
                      </>
                    )}
                    <dt>SKU</dt>
                    <dd>{sku}</dd>
                  </dl>
                </aside>
              </div>
            )}

            {tab === "specs" && (
              <div className="pd-specs">
                {(product.specifications || []).length > 0 ? (
                  <>
                    <div className="pd-specs__intro">
                      <p className="eyebrow">Product details</p>
                      <h2>Technical specifications</h2>
                      <p>Key information to help you compare and choose with confidence.</p>
                    </div>
                    <table>
                      <tbody>
                        {(product.specifications || []).map((spec, index) => (
                          <tr key={`${spec.label}-${spec.value}`}>
                            <th scope="row"><span>{String(index + 1).padStart(2, "0")}</span>{spec.label}</th>
                            <td>{spec.value}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </>
                ) : (
                  <div className="pd-empty">
                    <span className="pd-empty__icon" aria-hidden="true">
                      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
                        <path d="M5 4h14v16H5zM8 8h8M8 12h8M8 16h4" />
                      </svg>
                    </span>
                    <p className="eyebrow">Specifications</p>
                    <strong>Details are being prepared</strong>
                    <p>We’ll add the technical specifications for this product as soon as they’re available.</p>
                  </div>
                )}
              </div>
            )}

            {tab === "shipping" && (
              <div className="pd-shipping">
                <div className="pd-shipping__grid">
                  <article>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
                      <path d="M3 7h11v9H3zM14 10h4l3 3v3h-7z" />
                      <circle cx="7" cy="18" r="1.7" />
                      <circle cx="17" cy="18" r="1.7" />
                    </svg>
                    <h3>Delivery</h3>
                    <p>
                      Estimated delivery by <strong>{deliveryDate(product.estimatedDeliveryDays || 3)}</strong>.
                      {product.freeShipping
                        ? " Free shipping on this item."
                        : " Shipping charges are shown at checkout."}
                    </p>
                    {product.shipping?.deliveryInfo && <p>{product.shipping.deliveryInfo}</p>}
                  </article>
                  <article>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
                      <path d="M3 12a9 9 0 1 0 3-6.7L3 8" />
                      <path d="M3 3v5h5" />
                    </svg>
                    <h3>Returns & refunds</h3>
                    <p>{hasReturnPolicy ? returnPolicy : "Return information is not listed for this product. Contact support before ordering."}</p>
                  </article>
                  <article>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
                      <path d="M12 3 4 6v6c0 5 3.4 8.4 8 9 4.6-.6 8-4 8-9V6l-8-3Z" />
                      <path d="m9 12 2 2 4-4" />
                    </svg>
                    <h3>Warranty</h3>
                    <p>{product.warranty || "Warranty information is not listed for this product."}</p>
                  </article>
                </div>
                {product.shipping && (product.shipping.weight || product.shipping.length) ? (
                  <div className="pd-shipping__specs">
                    <h3>Shipping dimensions</h3>
                    <dl>
                      {product.shipping.weight ? (<><dt>Weight</dt><dd>{product.shipping.weight} g</dd></>) : null}
                      {product.shipping.length ? (<><dt>Length</dt><dd>{product.shipping.length} cm</dd></>) : null}
                      {product.shipping.width ? (<><dt>Width</dt><dd>{product.shipping.width} cm</dd></>) : null}
                      {product.shipping.height ? (<><dt>Height</dt><dd>{product.shipping.height} cm</dd></>) : null}
                      {product.shipping.shippingClass ? (<><dt>Shipping class</dt><dd>{product.shipping.shippingClass}</dd></>) : null}
                    </dl>
                  </div>
                ) : null}
              </div>
            )}

            {tab === "reviews" && (
              <ProductReviews
                productId={product.id}
                productName={product.name}
                onReviewCountChange={(count, average) => setReviewStats({ count, average })}
              />
            )}
          </div>
        </section>

        {related.length > 0 && (
          <section className="pd-related">
            <div className="pd-related__head">
              <div>
                <p className="eyebrow">Complete the setup</p>
                <h2>You may also like</h2>
              </div>
              <button type="button" onClick={() => setPage("shop")}>View all products</button>
            </div>
            <div className="product-grid">
              {related.map((entry) => (
                <ProductCard
                  key={entry.id}
                  product={entry}
                  wished={wished.some((id) => String(id) === String(entry.id))}
                  onWish={() => onToggleWish(entry.id)}
                  onAdd={(options) => onAddToCart(entry.id, options)}
                  onOpen={() => onOpenProduct(entry.id)}
                />
              ))}
            </div>
          </section>
        )}
      </div>

      {lightboxIndex !== null && gallery[lightboxIndex]?.type === "image" && (
        <div className="pd-lightbox" role="dialog" aria-modal="true" aria-label="Fullscreen product image">
          <button type="button" className="pd-lightbox__close" onClick={() => setLightboxIndex(null)} aria-label="Close fullscreen gallery">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
              <path d="m6 6 12 12M18 6 6 18" />
            </svg>
          </button>
          <button type="button" className="pd-lightbox__nav pd-lightbox__nav--prev" onClick={() => moveLightbox(-1)} aria-label="Previous image">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
              <path d="m15 6-6 6 6 6" />
            </svg>
          </button>
          <img src={gallery[lightboxIndex].url} alt={`${product.name} enlarged`} />
          <button type="button" className="pd-lightbox__nav pd-lightbox__nav--next" onClick={() => moveLightbox(1)} aria-label="Next image">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
              <path d="m9 6 6 6-6 6" />
            </svg>
          </button>
          <div className="pd-lightbox__count">
            {gallery.filter((media) => media.type === "image").findIndex((media) => media.url === gallery[lightboxIndex].url) + 1}
            {" / "}
            {gallery.filter((media) => media.type === "image").length}
          </div>
        </div>
      )}

      {viewer360 && frames360.length > 0 && (
        <div className="pd-lightbox pd-lightbox--360" role="dialog" aria-modal="true" aria-label="360 degree product view">
          <button type="button" className="pd-lightbox__close" onClick={() => setViewer360(false)} aria-label="Close 360 view">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
              <path d="m6 6 12 12M18 6 6 18" />
            </svg>
          </button>
          <div
            className="pd-360"
            onPointerDown={(event) => startDrag360(event.clientX)}
            onPointerMove={(event) => moveDrag360(event.clientX)}
            onPointerUp={() => { drag360.current = null; }}
            onPointerLeave={() => { drag360.current = null; }}
          >
            <img src={frames360[frame360 % frames360.length]} alt={`${product.name} 360 view frame ${frame360 + 1}`} draggable={false} />
            <div className="pd-360__controls">
              <button
                type="button"
                onClick={() => setFrame360((current) => (current - 1 + frames360.length) % frames360.length)}
                aria-label="Rotate left"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                  <path d="m15 6-6 6 6 6" />
                </svg>
              </button>
              <span>Drag to rotate · {frame360 + 1}/{frames360.length}</span>
              <button
                type="button"
                onClick={() => setFrame360((current) => (current + 1) % frames360.length)}
                aria-label="Rotate right"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                  <path d="m9 6 6 6-6 6" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
