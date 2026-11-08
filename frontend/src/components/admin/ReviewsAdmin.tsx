import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import toast from "react-hot-toast";
import {
  AlertTriangle,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Eye,
  Flag,
  Image as ImageIcon,
  Loader2,
  MessageSquare,
  Pencil,
  RefreshCw,
  Search,
  Star,
  ThumbsUp,
  Trash2,
  X,
} from "lucide-react";
import {
  bulkReviewAction,
  deleteReview,
  fetchAdminReviews,
  removeReviewMedia,
  replyToReview,
  updateReview,
  type AdminReviewQuery,
  type AdminReviewStats,
  type ProductImage,
  type ReviewItem,
} from "../../services/api";
import { formatPrice } from "../../utils/currency";

type ReviewsAdminProps = {
  products: { id: string | number; name: string }[];
  onReviewsChanged?: () => void;
};

type ConfirmState =
  | { kind: "delete"; review: ReviewItem }
  | { kind: "bulk-delete"; ids: string[] }
  | { kind: "media"; review: ReviewItem; publicId: string; mediaType: "image" | "video" };

const EMPTY_STATS: AdminReviewStats = {
  total: 0,
  pending: 0,
  approved: 0,
  rejected: 0,
  featured: 0,
  reported: 0,
  averageRating: 0,
};

const formatDate = (value?: string) => {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
};

const initials = (name?: string) =>
  (name || "Customer")
    .split(" ")
    .map((part) => part[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();

const mediaUrl = (entry: any) =>
  typeof entry === "string" ? entry : entry?.url || "";

const reviewProduct = (review: ReviewItem) =>
  review.product && typeof review.product === "object" ? review.product : null;

const productName = (review: ReviewItem) => {
  const product = reviewProduct(review);
  return product?.name || product?.title || "Deleted product";
};

const productImage = (review: ReviewItem) => {
  const product = reviewProduct(review);
  const first = Array.isArray(product?.images) ? product.images[0] : product?.image;
  return mediaUrl(first);
};

const statusTone = (status: ReviewItem["status"]) => {
  if (status === "Approved") return "is-approved";
  if (status === "Rejected") return "is-rejected";
  return "is-pending";
};

const Stars = ({ value, size = 13 }: { value: number; size?: number }) => (
  <span className="arv-stars" aria-label={`${value} out of 5 stars`}>
    {[1, 2, 3, 4, 5].map((star) => (
      <svg
        key={star}
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill={star <= Math.round(value) ? "currentColor" : "none"}
        stroke="currentColor"
        strokeWidth="1.6"
      >
        <path d="m12 2 3.1 6.3 6.9 1-5 4.9 1.2 6.8-6.2-3.2L5.8 21 7 14.2 2 9.3l6.9-1L12 2Z" />
      </svg>
    ))}
  </span>
);

export default function ReviewsAdmin({ products, onReviewsChanged }: ReviewsAdminProps) {
  const [query, setQuery] = useState<AdminReviewQuery>({ page: 1, limit: 20, sort: "newest" });
  const [searchInput, setSearchInput] = useState("");
  const [reviews, setReviews] = useState<ReviewItem[]>([]);
  const [stats, setStats] = useState<AdminReviewStats>(EMPTY_STATS);
  const [totalReviews, setTotalReviews] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  const [selected, setSelected] = useState<string[]>([]);
  const [actionId, setActionId] = useState<string | null>(null);
  const [bulkBusy, setBulkBusy] = useState<string | null>(null);

  const [viewing, setViewing] = useState<ReviewItem | null>(null);
  const [lightbox, setLightbox] = useState<{ type: "image" | "video"; url: string } | null>(null);

  const [replyTarget, setReplyTarget] = useState<ReviewItem | null>(null);
  const [replyComment, setReplyComment] = useState("");
  const [replyBusy, setReplyBusy] = useState(false);
  const [replyError, setReplyError] = useState<string | null>(null);

  const [editTarget, setEditTarget] = useState<ReviewItem | null>(null);
  const [editForm, setEditForm] = useState({
    rating: 5,
    title: "",
    comment: "",
    status: "Pending" as ReviewItem["status"],
    isFeatured: false,
  });
  const [editBusy, setEditBusy] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  const [confirmState, setConfirmState] = useState<ConfirmState | null>(null);
  const [confirmBusy, setConfirmBusy] = useState(false);
  const selectAllRef = useRef<HTMLInputElement>(null);

  const refresh = useCallback(() => setReloadKey((key) => key + 1), []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetchAdminReviews(query)
      .then((data) => {
        if (cancelled) return;
        setReviews(data.reviews || []);
        setTotalReviews(data.totalReviews || 0);
        setTotalPages(data.totalPages || 1);
        setStats({ ...EMPTY_STATS, ...(data.stats || {}) });
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Could not load reviews");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [query, reloadKey]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const keyword = searchInput.trim();
      setQuery((current) => {
        if ((current.keyword || "") === keyword) return current;
        return { ...current, keyword: keyword || undefined, page: 1 };
      });
    }, 400);
    return () => window.clearTimeout(timer);
  }, [searchInput]);

  const allSelected = reviews.length > 0 && reviews.every((review) => selected.includes(review._id));
  const selectedOnPage = reviews.filter((review) => selected.includes(review._id)).length;

  useEffect(() => {
    if (selectAllRef.current) {
      selectAllRef.current.indeterminate = selectedOnPage > 0 && !allSelected;
    }
  }, [selectedOnPage, allSelected]);

  const productOptions = useMemo(
    () => products.filter((product) => /^[a-f0-9]{24}$/i.test(String(product.id))),
    [products]
  );

  const applyFilter = (patch: Partial<AdminReviewQuery>) =>
    setQuery((current) => ({ ...current, ...patch, page: 1 }));

  const clearFilters = () => {
    setSearchInput("");
    setQuery({ page: 1, limit: 20, sort: "newest" });
  };

  const toggleSelected = (id: string) =>
    setSelected((current) =>
      current.includes(id) ? current.filter((entry) => entry !== id) : [...current, id]
    );

  const toggleAll = () => {
    if (allSelected) {
      setSelected((current) => current.filter((id) => !reviews.some((review) => review._id === id)));
    } else {
      setSelected((current) => [...new Set([...current, ...reviews.map((review) => review._id)])]);
    }
  };

  const openView = (review: ReviewItem) => setViewing(review);

  const changeStatus = async (review: ReviewItem, status: ReviewItem["status"]) => {
    setActionId(review._id);
    try {
      await updateReview(review._id, { status });
      toast.success(`Review ${status.toLowerCase()}`);
      setViewing((current) => (current && current._id === review._id ? { ...current, status } : current));
      refresh();
      onReviewsChanged?.();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not update the review");
    } finally {
      setActionId(null);
    }
  };

  const featureReview = async (review: ReviewItem) => {
    setActionId(review._id);
    try {
      const updated = await updateReview(review._id, { isFeatured: !review.isFeatured });
      toast.success(updated.isFeatured ? "Review featured" : "Review removed from featured");
      setViewing((current) =>
        current && current._id === review._id ? { ...current, isFeatured: !review.isFeatured } : current
      );
      refresh();
      onReviewsChanged?.();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not update the featured flag");
    } finally {
      setActionId(null);
    }
  };

  const runBulk = async (action: "approve" | "reject" | "pending" | "feature" | "unfeature") => {
    if (!selected.length) return;
    setBulkBusy(action);
    try {
      await bulkReviewAction(selected, action);
      toast.success(`${selected.length} review${selected.length === 1 ? "" : "s"} updated`);
      setSelected([]);
      refresh();
      onReviewsChanged?.();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Bulk review action failed");
    } finally {
      setBulkBusy(null);
    }
  };

  const openReply = (review: ReviewItem) => {
    setReplyTarget(review);
    setReplyComment(review.adminReply?.comment || "");
    setReplyError(null);
  };

  const saveReply = async () => {
    if (!replyTarget) return;
    if (replyComment.trim().length < 2) {
      setReplyError("Write a reply before saving.");
      return;
    }
    setReplyBusy(true);
    setReplyError(null);
    try {
      const updated = await replyToReview(replyTarget._id, replyComment.trim());
      toast.success("Reply published");
      setReplyTarget(null);
      setViewing((current) => (current && current._id === replyTarget._id ? updated : current));
      refresh();
      onReviewsChanged?.();
    } catch (err) {
      setReplyError(err instanceof Error ? err.message : "Could not save the reply");
    } finally {
      setReplyBusy(false);
    }
  };

  const openEdit = (review: ReviewItem) => {
    setEditTarget(review);
    setEditForm({
      rating: review.rating || 5,
      title: review.title || "",
      comment: review.comment || "",
      status: review.status || "Pending",
      isFeatured: Boolean(review.isFeatured),
    });
    setEditError(null);
  };

  const saveEdit = async () => {
    if (!editTarget) return;
    if (editForm.comment.trim().length < 3) {
      setEditError("The review needs at least a few words.");
      return;
    }
    if (editForm.rating < 1 || editForm.rating > 5) {
      setEditError("Rating must be between 1 and 5.");
      return;
    }
    setEditBusy(true);
    setEditError(null);
    try {
      const updated = await updateReview(editTarget._id, {
        rating: editForm.rating,
        title: editForm.title.trim(),
        comment: editForm.comment.trim(),
        status: editForm.status,
        isFeatured: editForm.isFeatured,
      });
      toast.success("Review updated");
      setEditTarget(null);
      setViewing((current) => (current && current._id === editTarget._id ? updated : current));
      refresh();
      onReviewsChanged?.();
    } catch (err) {
      setEditError(err instanceof Error ? err.message : "Could not update the review");
    } finally {
      setEditBusy(false);
    }
  };

  const performConfirm = async () => {
    if (!confirmState) return;
    setConfirmBusy(true);
    try {
      if (confirmState.kind === "delete") {
        await deleteReview(confirmState.review._id);
        toast.success("Review deleted");
        setViewing((current) => (current && current._id === confirmState.review._id ? null : current));
      } else if (confirmState.kind === "bulk-delete") {
        await bulkReviewAction(confirmState.ids, "delete");
        toast.success(`${confirmState.ids.length} review${confirmState.ids.length === 1 ? "" : "s"} deleted`);
        setSelected([]);
      } else {
        await removeReviewMedia(confirmState.review._id, confirmState.publicId, confirmState.mediaType);
        toast.success("Attachment removed");
        setViewing((current) => {
          if (!current || current._id !== confirmState.review._id) return current;
          const key = confirmState.mediaType === "image" ? "images" : "videos";
          return {
            ...current,
            [key]: (current[key] || []).filter((item) => item.public_id !== confirmState.publicId),
          };
        });
      }
      setConfirmState(null);
      refresh();
      onReviewsChanged?.();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "The review action failed");
    } finally {
      setConfirmBusy(false);
    }
  };

  const start = totalReviews === 0 ? 0 : ((query.page || 1) - 1) * (query.limit || 20) + 1;
  const end = Math.min(totalReviews, start + reviews.length - 1);

  return (
    <div className="admin-tab-view arv-admin">
      <div className="ap-head">
        <div>
          <p className="eyebrow" style={{ margin: 0 }}>Community &amp; trust</p>
          <h3>Reviews</h3>
          <span>
            {stats.total} review{stats.total === 1 ? "" : "s"} · {stats.pending} awaiting moderation ·{" "}
            {stats.reported} reported
          </span>
        </div>
        <div className="ap-head__actions">
          <button type="button" className="ap-btn ap-btn--ghost" onClick={refresh} disabled={loading}>
            {loading ? <Loader2 size={15} className="ap-spin" /> : <RefreshCw size={15} />}
            Refresh
          </button>
          <button
            type="button"
            className={`ap-btn ap-btn--ghost ${query.reported ? "is-active" : ""}`}
            onClick={() => applyFilter({ reported: query.reported ? undefined : true })}
          >
            <Flag size={15} /> Reported {stats.reported > 0 ? `(${stats.reported})` : ""}
          </button>
        </div>
      </div>

      <div className="stat-grid arv-stats">
        <StatCard icon={<MessageSquare size={15} />} label="Total reviews" value={stats.total} hint="All submitted reviews" />
        <StatCard icon={<AlertTriangle size={15} />} label="Pending" value={stats.pending} hint="Awaiting moderation" tone="warn" />
        <StatCard icon={<CheckCircle2 size={15} />} label="Approved" value={stats.approved} hint="Live on product pages" tone="good" />
        <StatCard icon={<X size={15} />} label="Rejected" value={stats.rejected} hint="Hidden from customers" />
        <StatCard icon={<Star size={15} />} label="Featured" value={stats.featured} hint="Highlighted reviews" />
        <StatCard icon={<Flag size={15} />} label="Reported" value={stats.reported} hint="Needs a closer look" tone="warn" />
        <StatCard
          icon={<ThumbsUp size={15} />}
          label="Average rating"
          value={stats.averageRating ? stats.averageRating.toFixed(1) : "0.0"}
          hint="Across every review"
        />
      </div>

      <div className="admin-filters-bar arv-filters">
        <div className="admin-search-box">
          <Search size={16} />
          <input
            type="search"
            placeholder="Search review title or text…"
            value={searchInput}
            onChange={(event) => setSearchInput(event.target.value)}
            aria-label="Search reviews"
          />
          {searchInput && (
            <button type="button" className="icon-button" onClick={() => setSearchInput("")} aria-label="Clear search">
              <X size={14} />
            </button>
          )}
        </div>

        <div className="admin-filter-selects">
          <select
            value={query.status || "all"}
            onChange={(event) => applyFilter({ status: event.target.value })}
            aria-label="Filter by status"
          >
            <option value="all">All statuses</option>
            <option value="Pending">Pending</option>
            <option value="Approved">Approved</option>
            <option value="Rejected">Rejected</option>
          </select>

          <select
            value={query.rating || "all"}
            onChange={(event) =>
              applyFilter({ rating: event.target.value === "all" ? undefined : Number(event.target.value) })
            }
            aria-label="Filter by rating"
          >
            <option value="all">All ratings</option>
            {[5, 4, 3, 2, 1].map((rating) => (
              <option key={rating} value={rating}>{rating} stars</option>
            ))}
          </select>

          <select
            value={query.product || "all"}
            onChange={(event) => applyFilter({ product: event.target.value })}
            aria-label="Filter by product"
          >
            <option value="all">All products</option>
            {productOptions.map((product) => (
              <option key={String(product.id)} value={String(product.id)}>{product.name}</option>
            ))}
          </select>

          <select
            value={query.sort || "newest"}
            onChange={(event) => setQuery((current) => ({ ...current, sort: event.target.value, page: 1 }))}
            aria-label="Sort reviews"
          >
            <option value="newest">Newest first</option>
            <option value="oldest">Oldest first</option>
            <option value="highest">Highest rated</option>
            <option value="lowest">Lowest rated</option>
            <option value="helpful">Most helpful</option>
            <option value="reported">Most reported</option>
          </select>

          <label className="ap-check">
            <input
              type="checkbox"
              checked={query.featured === true}
              onChange={(event) => applyFilter({ featured: event.target.checked ? true : undefined })}
            />
            <span>Featured</span>
          </label>

          <label className="ap-check">
            <input
              type="checkbox"
              checked={query.reported === true}
              onChange={(event) => applyFilter({ reported: event.target.checked ? true : undefined })}
            />
            <span>Reported</span>
          </label>

          <button type="button" className="ap-reset" onClick={clearFilters}>Reset</button>
        </div>
      </div>

      {selected.length > 0 && (
        <div className="ap-bulk">
          <strong>{selected.length} selected</strong>
          <div className="ap-bulk__actions">
            <button type="button" onClick={() => runBulk("approve")} disabled={bulkBusy !== null}>
              {bulkBusy === "approve" ? <Loader2 size={13} className="ap-spin" /> : <Check size={13} />} Approve
            </button>
            <button type="button" onClick={() => runBulk("reject")} disabled={bulkBusy !== null}>
              <X size={13} /> Reject
            </button>
            <button type="button" onClick={() => runBulk("pending")} disabled={bulkBusy !== null}>
              <AlertTriangle size={13} /> Pending
            </button>
            <button type="button" onClick={() => runBulk("feature")} disabled={bulkBusy !== null}>
              <Star size={13} /> Feature
            </button>
            <button type="button" onClick={() => runBulk("unfeature")} disabled={bulkBusy !== null}>
              <Star size={13} /> Unfeature
            </button>
            <button
              type="button"
              className="is-danger"
              onClick={() => setConfirmState({ kind: "bulk-delete", ids: [...selected] })}
              disabled={bulkBusy !== null}
            >
              <Trash2 size={13} /> Delete
            </button>
            <button type="button" className="ap-bulk__clear" onClick={() => setSelected([])}>Clear</button>
          </div>
        </div>
      )}

      <section className="ap-table-wrap">
        {loading ? (
          <div className="ap-skeleton" aria-label="Loading reviews">
            {[1, 2, 3, 4, 5].map((row) => (
              <div className="ap-skeleton__row" key={row}>
                <span /><span /><span /><span /><span /><span />
              </div>
            ))}
          </div>
        ) : error ? (
          <div className="ap-empty">
            <AlertTriangle size={26} />
            <strong>Could not load reviews</strong>
            <p>{error}</p>
            <button type="button" className="ap-btn ap-btn--primary" onClick={refresh}>Try again</button>
          </div>
        ) : reviews.length === 0 ? (
          <div className="ap-empty">
            <MessageSquare size={26} />
            <strong>No reviews match these filters</strong>
            <p>Try clearing the filters, or wait for customers to share their experience.</p>
            <div>
              <button type="button" className="ap-btn ap-btn--ghost" onClick={clearFilters}>Reset filters</button>
            </div>
          </div>
        ) : (
          <>
            <div className="ap-table arv-table" role="table" aria-label="Review moderation">
              <div className="ap-table__head arv-table__head" role="row">
                <span className="ap-checkbox">
                  <input
                    ref={selectAllRef}
                    type="checkbox"
                    checked={allSelected}
                    onChange={toggleAll}
                    aria-label="Select all reviews on this page"
                  />
                </span>
                <span>Reviewer</span>
                <span>Rating</span>
                <span>Review</span>
                <span>Status</span>
                <span>Engagement</span>
                <span>Actions</span>
              </div>

              {reviews.map((review) => {
                const name = review.user?.name || "Delivix customer";
                const image = productImage(review);
                const busy = actionId === review._id;
                const mediaCount = (review.images?.length || 0) + (review.videos?.length || 0);
                return (
                  <div
                    className={`ap-row arv-row ${selected.includes(review._id) ? "is-selected" : ""}`}
                    role="row"
                    key={review._id}
                  >
                    <span className="ap-checkbox">
                      <input
                        type="checkbox"
                        checked={selected.includes(review._id)}
                        onChange={() => toggleSelected(review._id)}
                        aria-label={`Select review by ${name}`}
                      />
                    </span>

                    <span className="arv-who">
                      <span className="arv-avatar">{initials(name)}</span>
                      <span>
                        <strong>{name}</strong>
                        <small>{review.user?.email || "Customer"}</small>
                        <em>
                          {image && <img src={image} alt="" />}
                          {productName(review)}
                        </em>
                        <span>{formatDate(review.createdAt)}</span>
                      </span>
                    </span>

                    <span className="arv-rating">
                      <Stars value={review.rating} />
                      <strong>{review.rating}.0</strong>
                      {review.isVerifiedPurchase && <em className="arv-verified">Verified</em>}
                    </span>

                    <span className="arv-content">
                      <button type="button" onClick={() => openView(review)}>
                        {review.title ? <strong>{review.title}</strong> : <strong>Review</strong>}
                        <p>{review.comment}</p>
                      </button>
                      <span className="arv-media-count">
                        {mediaCount > 0 && <span><ImageIcon size={11} /> {mediaCount} attachment{mediaCount === 1 ? "" : "s"}</span>}
                        {review.isFeatured && <span className="is-featured"><Star size={11} /> Featured</span>}
                        {review.adminReply?.comment && <span><MessageSquare size={11} /> Replied</span>}
                      </span>
                    </span>

                    <span>
                      <span className={`arv-status ${statusTone(review.status)}`}>
                        <i />
                        {review.status}
                      </span>
                      {(review.reportsCount || 0) > 0 && (
                        <small className="arv-reported"><Flag size={10} /> {review.reportsCount} report{(review.reportsCount || 0) === 1 ? "" : "s"}</small>
                      )}
                    </span>

                    <span className="arv-engagement">
                      <span><ThumbsUp size={12} /> {review.helpfulCount || 0} helpful</span>
                      <span className={review.reportsCount ? "is-warn" : ""}><Flag size={12} /> {review.reportsCount || 0} reports</span>
                      <span>{mediaCount} media</span>
                    </span>

                    <span className="ap-actions arv-actions">
                      <button
                        type="button"
                        className="ap-icon-btn is-approve"
                        onClick={() => changeStatus(review, "Approved")}
                        disabled={busy || review.status === "Approved"}
                        title="Approve review"
                        aria-label={`Approve review by ${name}`}
                      >
                        <Check size={14} />
                      </button>
                      <button
                        type="button"
                        className="ap-icon-btn is-danger"
                        onClick={() => changeStatus(review, "Rejected")}
                        disabled={busy || review.status === "Rejected"}
                        title="Reject review"
                        aria-label={`Reject review by ${name}`}
                      >
                        <X size={14} />
                      </button>
                      <button
                        type="button"
                        className={`ap-icon-btn ${review.isFeatured ? "is-active" : ""}`}
                        onClick={() => featureReview(review)}
                        disabled={busy}
                        title={review.isFeatured ? "Unfeature review" : "Feature review"}
                        aria-label={review.isFeatured ? `Unfeature review by ${name}` : `Feature review by ${name}`}
                      >
                        <Star size={14} fill={review.isFeatured ? "currentColor" : "none"} />
                      </button>
                      <button type="button" className="ap-icon-btn" onClick={() => openReply(review)} disabled={busy} title="Reply" aria-label={`Reply to ${name}`}>
                        <MessageSquare size={14} />
                      </button>
                      <button type="button" className="ap-icon-btn" onClick={() => openEdit(review)} disabled={busy} title="Edit review" aria-label={`Edit review by ${name}`}>
                        <Pencil size={14} />
                      </button>
                      <button
                        type="button"
                        className="ap-icon-btn is-danger"
                        onClick={() => setConfirmState({ kind: "delete", review })}
                        disabled={busy}
                        title="Delete review"
                        aria-label={`Delete review by ${name}`}
                      >
                        <Trash2 size={14} />
                      </button>
                    </span>
                  </div>
                );
              })}
            </div>

            <div className="ap-pagination">
              <span>Showing {start}–{end} of {totalReviews}</span>
              <div>
                <button
                  type="button"
                  onClick={() => setQuery((current) => ({ ...current, page: Math.max(1, (current.page || 1) - 1) }))}
                  disabled={(query.page || 1) <= 1}
                  aria-label="Previous page"
                >
                  <ChevronLeft size={15} />
                </button>
                <span>Page {query.page || 1} of {totalPages || 1}</span>
                <button
                  type="button"
                  onClick={() => setQuery((current) => ({ ...current, page: Math.min(totalPages || 1, (current.page || 1) + 1) }))}
                  disabled={(query.page || 1) >= (totalPages || 1)}
                  aria-label="Next page"
                >
                  <ChevronRight size={15} />
                </button>
              </div>
            </div>
          </>
        )}
      </section>

      {viewing && (
        <div className="admin-modal-backdrop" onClick={() => setViewing(null)}>
          <div className="admin-modal arv-view" onClick={(event) => event.stopPropagation()}>
            <div className="admin-modal__header">
              <div>
                <p className="eyebrow" style={{ margin: 0 }}>Review detail</p>
                <h2>{viewing.title || `Review by ${viewing.user?.name || "customer"}`}</h2>
              </div>
              <button type="button" className="icon-button" onClick={() => setViewing(null)} aria-label="Close review">
                <X size={18} />
              </button>
            </div>

            <div className="arv-view__body">
              <div className="arv-view__meta">
                <span className="arv-avatar">{initials(viewing.user?.name)}</span>
                <div>
                  <strong>{viewing.user?.name || "Delivix customer"}</strong>
                  <span>{viewing.user?.email || "Customer"}</span>
                  <small>{formatDate(viewing.createdAt)} · {productName(viewing)}</small>
                </div>
                <span className={`arv-status ${statusTone(viewing.status)}`}><i />{viewing.status}</span>
              </div>

              <div className="arv-view__rating">
                <Stars value={viewing.rating} size={17} />
                <strong>{viewing.rating}.0</strong>
                {viewing.isVerifiedPurchase && <em className="arv-verified">Verified purchase</em>}
                {viewing.isFeatured && <em className="arv-featured"><Star size={11} /> Featured</em>}
              </div>

              <p className="arv-view__comment">{viewing.comment}</p>

              {((viewing.images || []).length > 0 || (viewing.videos || []).length > 0) && (
                <div className="arv-view__media">
                  {(viewing.images || []).map((image: ProductImage) => (
                    <div key={image.public_id || image.url}>
                      <button type="button" onClick={() => setLightbox({ type: "image", url: image.url })}>
                        <img src={image.url} alt="Review attachment" />
                      </button>
                      {image.public_id && (
                        <button
                          type="button"
                          className="arv-media-remove"
                          onClick={() =>
                            setConfirmState({
                              kind: "media",
                              review: viewing,
                              publicId: image.public_id || "",
                              mediaType: "image",
                            })
                          }
                          title="Remove image"
                          aria-label="Remove review image"
                        >
                          <Trash2 size={12} />
                        </button>
                      )}
                    </div>
                  ))}
                  {(viewing.videos || []).map((video: ProductImage) => (
                    <div key={video.public_id || video.url}>
                      <button type="button" onClick={() => setLightbox({ type: "video", url: video.url })}>
                        <video src={video.url} muted preload="metadata" />
                      </button>
                      {video.public_id && (
                        <button
                          type="button"
                          className="arv-media-remove"
                          onClick={() =>
                            setConfirmState({
                              kind: "media",
                              review: viewing,
                              publicId: video.public_id || "",
                              mediaType: "video",
                            })
                          }
                          title="Remove video"
                          aria-label="Remove review video"
                        >
                          <Trash2 size={12} />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}

              <div className="arv-view__signals">
                <span><ThumbsUp size={13} /> {viewing.helpfulCount || 0} found this helpful</span>
                <span className={viewing.reportsCount ? "is-warn" : ""}><Flag size={13} /> {viewing.reportsCount || 0} reports</span>
                <span><ImageIcon size={13} /> {(viewing.images?.length || 0) + (viewing.videos?.length || 0)} attachments</span>
              </div>

              {viewing.adminReply?.comment && (
                <div className="arv-view__reply">
                  <strong>Delivix response</strong>
                  <p>{viewing.adminReply.comment}</p>
                  {viewing.adminReply.repliedAt && <span>{formatDate(viewing.adminReply.repliedAt)}</span>}
                </div>
              )}
            </div>

            <div className="arv-view__footer">
              <button type="button" className="ap-btn ap-btn--ghost" onClick={() => setViewing(null)}>Close</button>
              <button type="button" className="ap-btn ap-btn--ghost" onClick={() => openReply(viewing)}>
                <MessageSquare size={14} /> Reply
              </button>
              <button type="button" className="ap-btn ap-btn--ghost" onClick={() => openEdit(viewing)}>
                <Pencil size={14} /> Edit
              </button>
              <button
                type="button"
                className="ap-btn ap-btn--primary"
                onClick={() => changeStatus(viewing, viewing.status === "Approved" ? "Rejected" : "Approved")}
              >
                {viewing.status === "Approved" ? <X size={14} /> : <Check size={14} />}
                {viewing.status === "Approved" ? "Reject" : "Approve"}
              </button>
            </div>
          </div>
        </div>
      )}

      {replyTarget && (
        <div className="admin-modal-backdrop" onClick={() => !replyBusy && setReplyTarget(null)}>
          <div className="admin-modal admin-modal--small" onClick={(event) => event.stopPropagation()}>
            <div className="admin-modal__header">
              <div>
                <p className="eyebrow" style={{ margin: 0 }}>Public response</p>
                <h2>Reply to review</h2>
              </div>
              <button type="button" className="icon-button" onClick={() => setReplyTarget(null)} disabled={replyBusy} aria-label="Close reply">
                <X size={18} />
              </button>
            </div>

            <div className="arv-reply-context">
              <Stars value={replyTarget.rating} />
              <strong>{replyTarget.title || "Customer review"}</strong>
              <p>{replyTarget.comment}</p>
              <span>by {replyTarget.user?.name || "Delivix customer"} · {productName(replyTarget)}</span>
            </div>

            <label className="ap-field">
              <span>Your reply</span>
              <textarea
                rows={5}
                value={replyComment}
                onChange={(event) => setReplyComment(event.target.value)}
                maxLength={1000}
                placeholder="Thank the customer and address their feedback…"
              />
              <small>{replyComment.length}/1000</small>
            </label>

            {replyError && <p className="ap-form-error">{replyError}</p>}

            <div className="ap-confirm__actions">
              <button type="button" className="ap-btn ap-btn--ghost" onClick={() => setReplyTarget(null)} disabled={replyBusy}>
                Cancel
              </button>
              <button type="button" className="ap-btn ap-btn--primary" onClick={saveReply} disabled={replyBusy}>
                {replyBusy ? <Loader2 size={14} className="ap-spin" /> : <MessageSquare size={14} />}
                {replyBusy ? "Saving…" : "Publish reply"}
              </button>
            </div>
          </div>
        </div>
      )}

      {editTarget && (
        <div className="admin-modal-backdrop" onClick={() => !editBusy && setEditTarget(null)}>
          <div className="admin-modal arv-edit" onClick={(event) => event.stopPropagation()}>
            <div className="admin-modal__header">
              <div>
                <p className="eyebrow" style={{ margin: 0 }}>Moderation</p>
                <h2>Edit review</h2>
              </div>
              <button type="button" className="icon-button" onClick={() => setEditTarget(null)} disabled={editBusy} aria-label="Close editor">
                <X size={18} />
              </button>
            </div>

            <div className="arv-edit__grid">
              <label className="ap-field">
                <span>Rating</span>
                <select
                  value={editForm.rating}
                  onChange={(event) => setEditForm((current) => ({ ...current, rating: Number(event.target.value) }))}
                >
                  {[5, 4, 3, 2, 1].map((rating) => (
                    <option key={rating} value={rating}>{rating} stars</option>
                  ))}
                </select>
              </label>

              <label className="ap-field">
                <span>Status</span>
                <select
                  value={editForm.status}
                  onChange={(event) =>
                    setEditForm((current) => ({ ...current, status: event.target.value as ReviewItem["status"] }))
                  }
                >
                  <option value="Pending">Pending</option>
                  <option value="Approved">Approved</option>
                  <option value="Rejected">Rejected</option>
                </select>
              </label>

              <label className="ap-field ap-field--wide">
                <span>Title</span>
                <input
                  value={editForm.title}
                  onChange={(event) => setEditForm((current) => ({ ...current, title: event.target.value }))}
                  maxLength={150}
                  placeholder="Review title"
                />
              </label>

              <label className="ap-field ap-field--wide">
                <span>Review text</span>
                <textarea
                  rows={6}
                  value={editForm.comment}
                  onChange={(event) => setEditForm((current) => ({ ...current, comment: event.target.value }))}
                  maxLength={4000}
                  placeholder="Review text"
                />
                <small>{editForm.comment.length}/4000</small>
              </label>

              <label className="ap-check ap-check--chip ap-field--wide">
                <input
                  type="checkbox"
                  checked={editForm.isFeatured}
                  onChange={(event) => setEditForm((current) => ({ ...current, isFeatured: event.target.checked }))}
                />
                <span>Feature this review</span>
              </label>
            </div>

            {editError && <p className="ap-form-error">{editError}</p>}

            <div className="ap-confirm__actions">
              <button type="button" className="ap-btn ap-btn--ghost" onClick={() => setEditTarget(null)} disabled={editBusy}>
                Cancel
              </button>
              <button type="button" className="ap-btn ap-btn--primary" onClick={saveEdit} disabled={editBusy}>
                {editBusy ? <Loader2 size={14} className="ap-spin" /> : <Check size={14} />}
                {editBusy ? "Saving…" : "Save changes"}
              </button>
            </div>
          </div>
        </div>
      )}

      {confirmState && (
        <div className="admin-modal-backdrop" onClick={() => !confirmBusy && setConfirmState(null)}>
          <div className="admin-modal admin-modal--small" onClick={(event) => event.stopPropagation()}>
            <div className="admin-modal__header">
              <div>
                <p className="eyebrow" style={{ color: "#dc2626", margin: 0 }}>Confirm action</p>
                <h2>
                  {confirmState.kind === "delete"
                    ? "Delete this review?"
                    : confirmState.kind === "bulk-delete"
                      ? `Delete ${confirmState.ids.length} reviews?`
                      : "Remove this attachment?"}
                </h2>
              </div>
              <button type="button" className="icon-button" onClick={() => setConfirmState(null)} disabled={confirmBusy} aria-label="Close">
                <X size={18} />
              </button>
            </div>

            <div className="ap-confirm">
              <div>
                <strong>
                  {confirmState.kind === "delete"
                    ? confirmState.review.title || `Review by ${confirmState.review.user?.name || "customer"}`
                    : confirmState.kind === "bulk-delete"
                      ? `${confirmState.ids.length} selected reviews`
                      : `${confirmState.mediaType === "image" ? "Image" : "Video"} attachment`}
                </strong>
                <p>
                  {confirmState.kind === "media"
                    ? "The attachment is removed from Cloudinary and from this review. The review itself stays live."
                    : "This permanently removes the review from the catalogue. This cannot be undone."}
                </p>
              </div>
            </div>

            <div className="ap-confirm__actions">
              <button type="button" className="ap-btn ap-btn--ghost" onClick={() => setConfirmState(null)} disabled={confirmBusy}>
                Cancel
              </button>
              <button type="button" className="ap-btn ap-btn--danger" onClick={performConfirm} disabled={confirmBusy}>
                {confirmBusy ? <Loader2 size={14} className="ap-spin" /> : <Trash2 size={14} />}
                {confirmBusy ? "Working…" : confirmState.kind === "media" ? "Remove attachment" : "Yes, delete"}
              </button>
            </div>
          </div>
        </div>
      )}

      {lightbox && (
        <div className="arv-lightbox" role="dialog" aria-modal="true" onClick={() => setLightbox(null)}>
          <button type="button" onClick={() => setLightbox(null)} aria-label="Close media">
            <X size={22} />
          </button>
          {lightbox.type === "image" ? (
            <img src={lightbox.url} alt="Review attachment enlarged" onClick={(event) => event.stopPropagation()} />
          ) : (
            <video src={lightbox.url} controls autoPlay onClick={(event) => event.stopPropagation()} />
          )}
        </div>
      )}
    </div>
  );
}

function StatCard({
  label,
  value,
  hint,
  icon,
  tone,
}: {
  label: string;
  value: string | number;
  hint?: string;
  icon: ReactNode;
  tone?: "warn" | "good";
}) {
  return (
    <article className={`stat-card${tone ? ` stat-card--${tone}` : ""}`}>
      <div className="stat-card__head">
        <p>{label}</p>
        <span className="stat-card__icon">{icon}</span>
      </div>
      <strong>{value}</strong>
      {hint && <span>{hint}</span>}
    </article>
  );
}
