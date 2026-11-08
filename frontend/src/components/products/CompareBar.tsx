import { useMemo, useState } from "react";
import type { ProductItem } from "../../services/api";
import { formatPrice } from "../../utils/currency";
import { useProductExperience } from "./ProductExperienceContext";

const SPEC_LIMIT = 5;

const StarRow = ({ rating }: { rating: number }) => (
  <span className="cmp-stars" aria-label={`${rating || 0} out of 5 stars`}>
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
);

const specValue = (product: ProductItem, label: string) => {
  const match = (product.specifications || []).find(
    (spec) => spec.label.toLowerCase() === label.toLowerCase()
  );
  return match?.value || "—";
};

export default function CompareBar() {
  const experience = useProductExperience();
  const [open, setOpen] = useState(false);
  const products = experience.compareProducts;

  const specLabels = useMemo(() => {
    const labels: string[] = [];
    products.forEach((product) => {
      (product.specifications || []).forEach((spec) => {
        if (
          spec.label &&
          !labels.some((label) => label.toLowerCase() === spec.label.toLowerCase())
        ) {
          labels.push(spec.label);
        }
      });
    });
    return labels.slice(0, SPEC_LIMIT);
  }, [products]);

  if (!products.length) return null;

  const cheapest = Math.min(...products.map((product) => product.price || 0));
  const bestRated = Math.max(...products.map((product) => product.ratings || 0));

  return (
    <>
      <div className="cmp-tray" role="region" aria-label="Product comparison tray">
        <div className="cmp-tray__inner">
          <div className="cmp-tray__head">
            <span className="cmp-tray__eyebrow">Compare</span>
            <strong>
              {products.length} of 4 selected
            </strong>
          </div>
          <div className="cmp-tray__items">
            {products.map((product) => (
              <div className="cmp-tray__item" key={product.id}>
                <img src={product.image} alt={product.name} />
                <div>
                  <span>{product.name}</span>
                  <strong>{formatPrice(product.price)}</strong>
                </div>
                <button
                  type="button"
                  onClick={() => experience.removeCompare(product.id)}
                  aria-label={`Remove ${product.name} from comparison`}
                  title="Remove"
                >
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="m6 6 12 12M18 6 6 18" />
                  </svg>
                </button>
              </div>
            ))}
          </div>
          <div className="cmp-tray__actions">
            <button type="button" className="cmp-tray__clear" onClick={experience.clearCompare}>
              Clear
            </button>
            <button
              type="button"
              className="cmp-tray__open"
              onClick={() => setOpen(true)}
              disabled={products.length < 2}
              title={products.length < 2 ? "Select at least two products" : "Compare selected products"}
            >
              Compare now
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                <path d="M5 12h14M14 7l5 5-5 5" />
              </svg>
            </button>
          </div>
        </div>
      </div>

      {open && (
        <div className="cmp-modal-backdrop" role="dialog" aria-modal="true" aria-label="Product comparison" onClick={() => setOpen(false)}>
          <div className="cmp-modal" onClick={(event) => event.stopPropagation()}>
            <div className="cmp-modal__header">
              <div>
                <p className="eyebrow">Side by side</p>
                <h2>Compare products</h2>
              </div>
              <button type="button" className="cmp-modal__close" onClick={() => setOpen(false)} aria-label="Close comparison">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                  <path d="m6 6 12 12M18 6 6 18" />
                </svg>
              </button>
            </div>

            <div className="cmp-modal__body">
              <div className="cmp-grid" style={{ gridTemplateColumns: `140px repeat(${products.length}, minmax(190px, 1fr))` }}>
                <div className="cmp-grid__label cmp-grid__label--empty" />
                {products.map((product) => (
                  <div className="cmp-col-head" key={`head-${product.id}`}>
                    <img src={product.image} alt={product.name} />
                    <button type="button" onClick={() => experience.removeCompare(product.id)} aria-label={`Remove ${product.name}`}>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="m6 6 12 12M18 6 6 18" />
                      </svg>
                    </button>
                    <span>{product.brand || "Delivix"}</span>
                    <strong>{product.name}</strong>
                    <button
                      type="button"
                      className="cmp-col-head__link"
                      onClick={() => {
                        setOpen(false);
                        experience.openProduct(product.id);
                      }}
                    >
                      View details
                    </button>
                  </div>
                ))}

                <div className="cmp-grid__label">Price</div>
                {products.map((product) => (
                  <div className={`cmp-cell ${product.price === cheapest ? "is-best" : ""}`} key={`price-${product.id}`}>
                    <strong>{formatPrice(product.price)}</strong>
                    {product.old && product.old > product.price && <del>{formatPrice(product.old)}</del>}
                    {product.price === cheapest && <span className="cmp-best">Lowest price</span>}
                  </div>
                ))}

                <div className="cmp-grid__label">Rating</div>
                {products.map((product) => (
                  <div className={`cmp-cell ${product.ratings === bestRated && bestRated > 0 ? "is-best" : ""}`} key={`rating-${product.id}`}>
                    <StarRow rating={product.ratings || 0} />
                    <span>
                      {product.ratings ? product.ratings.toFixed(1) : "New"} · {product.numOfReviews || 0} reviews
                    </span>
                  </div>
                ))}

                <div className="cmp-grid__label">Availability</div>
                {products.map((product) => (
                  <div className="cmp-cell" key={`stock-${product.id}`}>
                    <span className={`cmp-stock ${product.stock && product.stock > 0 ? "is-in" : "is-out"}`}>
                      {product.stock && product.stock > 0 ? `In stock (${product.stock})` : "Out of stock"}
                    </span>
                  </div>
                ))}

                <div className="cmp-grid__label">Brand</div>
                {products.map((product) => (
                  <div className="cmp-cell" key={`brand-${product.id}`}>{product.brand || "Delivix"}</div>
                ))}

                <div className="cmp-grid__label">Category</div>
                {products.map((product) => (
                  <div className="cmp-cell" key={`cat-${product.id}`}>{product.category}</div>
                ))}

                <div className="cmp-grid__label">Colours</div>
                {products.map((product) => (
                  <div className="cmp-cell" key={`colors-${product.id}`}>
                    <div className="cmp-swatches">
                      {(product.variants || []).filter((variant) => variant.isActive !== false).map((variant) => (
                        <span
                          key={variant.variantName}
                          title={variant.colorName || variant.variantName}
                          style={{ backgroundColor: variant.colorHex || "#d4d4d8" }}
                        />
                      ))}
                      {!(product.variants || []).length && <span className="cmp-muted">—</span>}
                    </div>
                  </div>
                ))}

                <div className="cmp-grid__label">Sizes</div>
                {products.map((product) => {
                  const sizes = [
                    ...(product.sizes || []).map((size) => size.size),
                    ...(product.variants || []).flatMap((variant) => (variant.sizes || []).map((size) => size.size)),
                  ].filter((size, index, list) => list.indexOf(size) === index);
                  return (
                    <div className="cmp-cell" key={`sizes-${product.id}`}>
                      {sizes.length ? sizes.join(" · ") : <span className="cmp-muted">One size</span>}
                    </div>
                  );
                })}

                {specLabels.map((label) => (
                  <div className="cmp-grid__label" key={`label-${label}`}>{label}</div>
                ))}
                {specLabels.map((label) =>
                  products.map((product) => (
                    <div className="cmp-cell" key={`spec-${label}-${product.id}`}>
                      {specValue(product, label)}
                    </div>
                  ))
                )}

                <div className="cmp-grid__label">Warranty</div>
                {products.map((product) => (
                  <div className="cmp-cell" key={`warranty-${product.id}`}>
                    {product.warranty || "—"}
                  </div>
                ))}

                <div className="cmp-grid__label cmp-grid__label--sticky">Action</div>
                {products.map((product) => (
                  <div className="cmp-cell cmp-cell--action" key={`action-${product.id}`}>
                    <button
                      type="button"
                      className="cmp-add"
                      onClick={() => {
                        experience.addToCart(product.id);
                        experience.removeCompare(product.id);
                      }}
                      disabled={!product.stock || product.stock <= 0}
                    >
                      Add to bag
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
