import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import toast from "react-hot-toast";
import {
  checkReviewEligibility,
  fetchProductReviewSummary,
  fetchProductReviews,
  reportReview,
  submitProductReview,
  toggleReviewHelpful,
  uploadReviewMedia,
  type ProductImage,
  type ReviewItem,
  type ReviewSummary,
} from "../../services/api";

interface ProductReviewsProps {
  productId: string | number;
  productName: string;
  onReviewCountChange?: (count: number, average: number) => void;
}

const EMPTY_SUMMARY: ReviewSummary = {
  averageRating: 0,
  totalRatings: 0,
  totalReviews: 0,
  distribution: [5, 4, 3, 2, 1].map((stars) => ({ stars, count: 0, percentage: 0 })),
};

const formatDate = (value?: string) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
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

const Stars = ({ value, size = 14 }: { value: number; size?: number }) => (
  <span className="prv-stars" aria-label={`${value} out of 5 stars`}>
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

const readFileAsDataUrl = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("Could not read the selected file"));
    reader.readAsDataURL(file);
  });

export default function ProductReviews({
  productId,
  productName,
  onReviewCountChange,
}: ProductReviewsProps) {
  const [summary, setSummary] = useState<ReviewSummary>(EMPTY_SUMMARY);
  const [reviews, setReviews] = useState<ReviewItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalReviews, setTotalReviews] = useState(0);
  const [sort, setSort] = useState("newest");
  const [ratingFilter, setRatingFilter] = useState<number | null>(null);
  const [hasPhotos, setHasPhotos] = useState(false);
  const [hasVideos, setHasVideos] = useState(false);
  const [verifiedOnly, setVerifiedOnly] = useState(false);
  const [keyword, setKeyword] = useState("");
  const [keywordInput, setKeywordInput] = useState("");

  const [lightbox, setLightbox] = useState<string | null>(null);
  const [reportingId, setReportingId] = useState<string | null>(null);
  const [reportReason, setReportReason] = useState("");
  const [reporting, setReporting] = useState(false);

  const [writeOpen, setWriteOpen] = useState(false);
  const [checkingEligibility, setCheckingEligibility] = useState(false);
  const [eligibility, setEligibility] = useState<{
    eligible: boolean;
    reason?: string;
    message?: string;
    review?: ReviewItem;
  } | null>(null);

  const [rating, setRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [title, setTitle] = useState("");
  const [comment, setComment] = useState("");
  const [images, setImages] = useState<ProductImage[]>([]);
  const [videos, setVideos] = useState<ProductImage[]>([]);
  const [uploading, setUploading] = useState<"image" | "video" | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);

  const loadSummary = useCallback(async () => {
    try {
      const data = await fetchProductReviewSummary(productId);
      setSummary({ ...EMPTY_SUMMARY, ...data });
      onReviewCountChange?.(data.totalReviews || 0, data.averageRating || 0);
    } catch {
      setSummary(EMPTY_SUMMARY);
    }
  }, [productId, onReviewCountChange]);

  const loadReviews = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchProductReviews(productId, {
        page,
        limit: 6,
        rating: ratingFilter || undefined,
        sort,
        hasPhotos,
        hasVideos,
        isVerified: verifiedOnly,
        keyword: keyword || undefined,
      });
      setReviews(data.reviews || []);
      setTotalPages(data.totalPages || 1);
      setTotalReviews(data.totalReviews || 0);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load reviews");
    } finally {
      setLoading(false);
    }
  }, [productId, page, ratingFilter, sort, hasPhotos, hasVideos, verifiedOnly, keyword]);

  useEffect(() => {
    loadSummary();
  }, [loadSummary]);

  useEffect(() => {
    loadReviews();
  }, [loadReviews]);

  useEffect(() => {
    setPage(1);
  }, [ratingFilter, sort, hasPhotos, hasVideos, verifiedOnly, keyword]);

  useEffect(() => {
    if (!lightbox) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setLightbox(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [lightbox]);

  const distribution = summary.distribution?.length
    ? summary.distribution
    : EMPTY_SUMMARY.distribution;

  const eligibleReason = useMemo(() => {
    if (!eligibility || eligibility.eligible) return "";
    if (eligibility.reason === "already_reviewed") {
      return "You have already reviewed this product. Thank you for sharing your experience.";
    }
    if (eligibility.reason === "no_purchase") {
      return "Reviews are open to verified buyers. Once your order is delivered you can share your experience here.";
    }
    return eligibility.message || "You are not eligible to review this product yet.";
  }, [eligibility]);

  const openReviewForm = async () => {
    setWriteOpen(true);
    setFormError(null);
    setCheckingEligibility(true);
    setEligibility(null);
    try {
      const result = await checkReviewEligibility(productId);
      setEligibility(result);
    } catch (err) {
      setEligibility({
        eligible: false,
        reason: "auth",
        message:
          err instanceof Error && /unauthor|login|token|not authorized/i.test(err.message)
            ? "Please sign in to your account to write a review."
            : "We could not verify your purchase. Please sign in and try again.",
      });
    } finally {
      setCheckingEligibility(false);
    }
  };

  const closeReviewForm = () => {
    if (submitting || uploading) return;
    setWriteOpen(false);
    setRating(0);
    setTitle("");
    setComment("");
    setImages([]);
    setVideos([]);
    setFormError(null);
  };

  const handleUpload = async (file: File, type: "image" | "video") => {
    const isImage = type === "image";
    if (isImage && !["image/jpeg", "image/png", "image/webp", "image/jpg"].includes(file.type)) {
      toast.error("Images must be JPG, PNG or WEBP");
      return;
    }
    if (!isImage && !["video/mp4", "video/quicktime"].includes(file.type)) {
      toast.error("Videos must be MP4 or MOV");
      return;
    }
    if (isImage && file.size > 5 * 1024 * 1024) {
      toast.error("Images must be smaller than 5MB");
      return;
    }
    if (!isImage && file.size > 30 * 1024 * 1024) {
      toast.error("Videos must be smaller than 30MB");
      return;
    }
    if (isImage && images.length >= 10) {
      toast.error("You can add up to 10 images");
      return;
    }
    if (!isImage && videos.length >= 2) {
      toast.error("You can add up to 2 videos");
      return;
    }

    setUploading(type);
    try {
      const dataUrl = await readFileAsDataUrl(file);
      const media = await uploadReviewMedia(dataUrl, type);
      if (media) {
        if (isImage) setImages((current) => [...current, media]);
        else setVideos((current) => [...current, media]);
        toast.success(`${isImage ? "Image" : "Video"} added`);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(null);
      if (imageInputRef.current) imageInputRef.current.value = "";
      if (videoInputRef.current) videoInputRef.current.value = "";
    }
  };

  const submitReview = async () => {
    if (!rating) {
      setFormError("Please select a star rating");
      return;
    }
    if (comment.trim().length < 3) {
      setFormError("Please write a few words about the product");
      return;
    }
    setSubmitting(true);
    setFormError(null);
    try {
      await submitProductReview({
        productId,
        rating,
        title: title.trim() || undefined,
        comment: comment.trim(),
        images,
        videos,
      });
      toast.success("Review submitted — it will appear after moderation");
      closeReviewForm();
      setPage(1);
      await Promise.all([loadSummary(), loadReviews()]);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Could not submit your review");
    } finally {
      setSubmitting(false);
    }
  };

  const handleHelpful = async (review: ReviewItem) => {
    try {
      const result = await toggleReviewHelpful(review._id);
      setReviews((current) =>
        current.map((entry) =>
          entry._id === review._id ? { ...entry, helpfulCount: result.helpfulCount } : entry
        )
      );
      toast.success(result.voted ? "Marked as helpful" : "Vote removed");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not register your vote");
    }
  };

  const submitReport = async () => {
    if (!reportingId) return;
    if (!reportReason.trim()) {
      toast.error("Please tell us why you are reporting this review");
      return;
    }
    setReporting(true);
    try {
      await reportReview(reportingId, reportReason.trim());
      toast.success("Report sent to our moderation team");
      setReportingId(null);
      setReportReason("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not report review");
    } finally {
      setReporting(false);
    }
  };

  return (
    <section className="prv" aria-label={`Reviews for ${productName}`}>
      <div className="prv-head">
        <div>
          <p className="eyebrow">Verified experiences</p>
          <h2>Customer reviews</h2>
        </div>
        <button type="button" className="prv-write" onClick={openReviewForm}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
            <path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
          </svg>
          Write a review
        </button>
      </div>

      <div className="prv-layout">
        <aside className="prv-summary">
          <div className="prv-summary__score">
            <strong>
              {summary.totalReviews > 0 ? summary.averageRating.toFixed(1) : "—"}
            </strong>
            <div>
              {summary.totalReviews > 0 && <Stars value={summary.averageRating} size={16} />}
              <span>
                {summary.totalReviews > 0
                  ? `Based on ${summary.totalReviews} ${summary.totalReviews === 1 ? "review" : "reviews"}`
                  : "No customer reviews yet"}
              </span>
            </div>
          </div>

          <div className="prv-distribution">
            {distribution.map((row) => (
              <button
                key={row.stars}
                type="button"
                className={`prv-dist-row ${ratingFilter === row.stars ? "is-active" : ""}`}
                onClick={() => setRatingFilter(ratingFilter === row.stars ? null : row.stars)}
                aria-label={`Filter by ${row.stars} star reviews`}
              >
                <span>{row.stars}★</span>
                <span className="prv-dist-bar">
                  <i style={{ width: `${row.percentage}%` }} />
                </span>
                <span>{row.count}</span>
              </button>
            ))}
          </div>

          <div className="prv-summary__meta">
            <span>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="m5 13 4 4L19 7" />
              </svg>
              Verified buyers only
            </span>
            <span>Moderated for authenticity</span>
          </div>
        </aside>

        <div className="prv-list">
          <div className="prv-toolbar">
            <div className="prv-rating-chips">
              <button
                type="button"
                className={ratingFilter === null ? "is-active" : ""}
                onClick={() => setRatingFilter(null)}
              >
                All
              </button>
              {[5, 4, 3, 2, 1].map((star) => (
                <button
                  key={star}
                  type="button"
                  className={ratingFilter === star ? "is-active" : ""}
                  onClick={() => setRatingFilter(ratingFilter === star ? null : star)}
                >
                  {star}★
                </button>
              ))}
            </div>

            <div className="prv-toolbar__right">
              <label className="prv-toggle">
                <input type="checkbox" checked={hasPhotos} onChange={(event) => setHasPhotos(event.target.checked)} />
                <span>With photos</span>
              </label>
              <label className="prv-toggle">
                <input type="checkbox" checked={hasVideos} onChange={(event) => setHasVideos(event.target.checked)} />
                <span>With video</span>
              </label>
              <label className="prv-toggle">
                <input type="checkbox" checked={verifiedOnly} onChange={(event) => setVerifiedOnly(event.target.checked)} />
                <span>Verified</span>
              </label>
              <select value={sort} onChange={(event) => setSort(event.target.value)} aria-label="Sort reviews">
                <option value="newest">Newest</option>
                <option value="helpful">Most helpful</option>
                <option value="highest">Highest rated</option>
                <option value="lowest">Lowest rated</option>
                <option value="featured">Featured</option>
              </select>
            </div>
          </div>

          <form
            className="prv-search"
            onSubmit={(event) => {
              event.preventDefault();
              setKeyword(keywordInput.trim());
            }}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
              <circle cx="11" cy="11" r="7" />
              <path d="m20 20-3.2-3.2" />
            </svg>
            <input
              type="search"
              value={keywordInput}
              onChange={(event) => setKeywordInput(event.target.value)}
              placeholder="Search reviews"
              aria-label="Search reviews"
            />
            {keyword && (
              <button type="button" onClick={() => { setKeyword(""); setKeywordInput(""); }}>
                Clear
              </button>
            )}
            <button type="submit">Search</button>
          </form>

          {loading ? (
            <div className="prv-skeleton" aria-label="Loading reviews">
              {[1, 2, 3].map((item) => (
                <div className="prv-skeleton__row" key={item}>
                  <span />
                  <span />
                  <span />
                </div>
              ))}
            </div>
          ) : error ? (
            <div className="prv-empty">
              <p>{error}</p>
              <button type="button" onClick={loadReviews}>Try again</button>
            </div>
          ) : reviews.length === 0 ? (
            <div className="prv-empty">
              <div className="prv-empty__icon">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
                  <path d="M21 11.5a8.4 8.4 0 0 1-9 8.4 8.5 8.5 0 0 1-3.8-.9L3 21l2-4.8a8.4 8.4 0 1 1 16-4.7Z" />
                </svg>
              </div>
              <strong>No reviews yet</strong>
              <p>
                {ratingFilter || hasPhotos || hasVideos || verifiedOnly || keyword
                  ? "No reviews match these filters. Try clearing them."
                  : "Be the first verified buyer to share an experience with this product."}
              </p>
              <button type="button" onClick={openReviewForm}>Write a review</button>
            </div>
          ) : (
            <>
              <div className="prv-cards">
                {reviews.map((review) => {
                  const reviewerName = review.user?.name || "Delivix customer";
                  return (
                    <article className="prv-card" key={review._id}>
                      <div className="prv-card__head">
                        <div className="prv-avatar">{initials(reviewerName)}</div>
                        <div className="prv-card__who">
                          <strong>{reviewerName}</strong>
                          <span>
                            {formatDate(review.createdAt)}
                            {review.isVerifiedPurchase && (
                              <em>
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4">
                                  <path d="m5 13 4 4L19 7" />
                                </svg>
                                Verified purchase
                              </em>
                            )}
                          </span>
                        </div>
                        <div className="prv-card__rating">
                          <Stars value={review.rating} />
                          {review.isFeatured && <span className="prv-featured">Featured</span>}
                        </div>
                      </div>

                      {review.title && <h4>{review.title}</h4>}
                      <p className="prv-comment">{review.comment}</p>

                      {(review.images?.length || review.videos?.length) ? (
                        <div className="prv-media">
                          {(review.images || []).map((image) => (
                            <button
                              type="button"
                              key={image.public_id || image.url}
                              onClick={() => setLightbox(image.url)}
                              aria-label="Open review image"
                            >
                              <img src={image.url} alt="Review attachment" loading="lazy" />
                            </button>
                          ))}
                          {(review.videos || []).map((video) => (
                            <div className="prv-media__video" key={video.public_id || video.url}>
                              <video src={video.url} controls preload="metadata" />
                            </div>
                          ))}
                        </div>
                      ) : null}

                      {review.adminReply?.comment && (
                        <div className="prv-reply">
                          <strong>Response from Delivix</strong>
                          <p>{review.adminReply.comment}</p>
                          {review.adminReply.repliedAt && <span>{formatDate(review.adminReply.repliedAt)}</span>}
                        </div>
                      )}

                      <div className="prv-card__foot">
                        <button
                          type="button"
                          className="prv-helpful"
                          onClick={() => handleHelpful(review)}
                        >
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
                            <path d="M7 10v11H4a1 1 0 0 1-1-1v-9a1 1 0 0 1 1-1h3Zm0 0 4-7a2 2 0 0 1 2 2v4h5.2a2 2 0 0 1 2 2.4l-1.4 7A2 2 0 0 1 16.8 21H7" />
                          </svg>
                          Helpful{review.helpfulCount ? ` (${review.helpfulCount})` : ""}
                        </button>
                        <button
                          type="button"
                          className="prv-report"
                          onClick={() => {
                            setReportingId(review._id);
                            setReportReason("");
                          }}
                        >
                          Report
                        </button>
                      </div>
                    </article>
                  );
                })}
              </div>

              {totalPages > 1 && (
                <div className="prv-pagination">
                  <button
                    type="button"
                    disabled={page <= 1}
                    onClick={() => setPage((current) => Math.max(1, current - 1))}
                  >
                    Previous
                  </button>
                  <span>Page {page} of {totalPages} · {totalReviews} reviews</span>
                  <button
                    type="button"
                    disabled={page >= totalPages}
                    onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
                  >
                    Next
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {lightbox && (
        <div className="prv-lightbox" role="dialog" aria-modal="true" onClick={() => setLightbox(null)}>
          <button type="button" onClick={() => setLightbox(null)} aria-label="Close image">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
              <path d="m6 6 12 12M18 6 6 18" />
            </svg>
          </button>
          <img src={lightbox} alt="Review attachment enlarged" onClick={(event) => event.stopPropagation()} />
        </div>
      )}

      {reportingId && (
        <div className="prv-modal-backdrop" role="dialog" aria-modal="true" aria-label="Report review" onClick={() => setReportingId(null)}>
          <div className="prv-modal prv-modal--small" onClick={(event) => event.stopPropagation()}>
            <div className="prv-modal__head">
              <div>
                <p className="eyebrow">Community safety</p>
                <h3>Report this review</h3>
              </div>
              <button type="button" onClick={() => setReportingId(null)} aria-label="Close">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                  <path d="m6 6 12 12M18 6 6 18" />
                </svg>
              </button>
            </div>
            <p className="prv-modal__copy">
              Tell us what is wrong with this review. Our moderation team will review it.
            </p>
            <textarea
              value={reportReason}
              onChange={(event) => setReportReason(event.target.value)}
              maxLength={500}
              rows={4}
              placeholder="e.g. Spam, offensive language, or not a genuine purchase"
            />
            <div className="prv-modal__actions">
              <button type="button" className="is-ghost" onClick={() => setReportingId(null)}>Cancel</button>
              <button type="button" onClick={submitReport} disabled={reporting}>
                {reporting ? "Sending…" : "Submit report"}
              </button>
            </div>
          </div>
        </div>
      )}

      {writeOpen && (
        <div className="prv-modal-backdrop" role="dialog" aria-modal="true" aria-label="Write a review" onClick={closeReviewForm}>
          <div className="prv-modal" onClick={(event) => event.stopPropagation()}>
            <div className="prv-modal__head">
              <div>
                <p className="eyebrow">Share your experience</p>
                <h3>Review {productName}</h3>
              </div>
              <button type="button" onClick={closeReviewForm} aria-label="Close review form">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                  <path d="m6 6 12 12M18 6 6 18" />
                </svg>
              </button>
            </div>

            {checkingEligibility ? (
              <div className="prv-modal__loading">
                <span />
                Checking your purchase…
              </div>
            ) : !eligibility?.eligible ? (
              <div className="prv-modal__notice">
                <strong>Review not available</strong>
                <p>{eligibleReason}</p>
                {eligibility?.review && (
                  <div className="prv-modal__existing">
                    <Stars value={eligibility.review.rating} />
                    {eligibility.review.title && <strong>{eligibility.review.title}</strong>}
                    <p>{eligibility.review.comment}</p>
                  </div>
                )}
                <button type="button" onClick={closeReviewForm}>Close</button>
              </div>
            ) : (
              <>
                <div className="prv-form">
                  <div className="prv-form__field">
                    <label>Your rating</label>
                    <div className="prv-rating-input" onMouseLeave={() => setHoverRating(0)}>
                      {[1, 2, 3, 4, 5].map((star) => (
                        <button
                          key={star}
                          type="button"
                          onMouseEnter={() => setHoverRating(star)}
                          onClick={() => setRating(star)}
                          aria-label={`${star} star${star > 1 ? "s" : ""}`}
                        >
                          <svg
                            width="28"
                            height="28"
                            viewBox="0 0 24 24"
                            fill={star <= (hoverRating || rating) ? "currentColor" : "none"}
                            stroke="currentColor"
                            strokeWidth="1.4"
                          >
                            <path d="m12 2 3.1 6.3 6.9 1-5 4.9 1.2 6.8-6.2-3.2L5.8 21 7 14.2 2 9.3l6.9-1L12 2Z" />
                          </svg>
                        </button>
                      ))}
                      <span>{rating ? `${rating} of 5` : "Select a rating"}</span>
                    </div>
                  </div>

                  <div className="prv-form__field">
                    <label htmlFor="prv-title">Review title <span>Optional</span></label>
                    <input
                      id="prv-title"
                      type="text"
                      value={title}
                      onChange={(event) => setTitle(event.target.value)}
                      maxLength={150}
                      placeholder="Sum up your experience"
                    />
                  </div>

                  <div className="prv-form__field">
                    <label htmlFor="prv-comment">Your review</label>
                    <textarea
                      id="prv-comment"
                      value={comment}
                      onChange={(event) => setComment(event.target.value)}
                      maxLength={4000}
                      rows={5}
                      placeholder="What did you like or dislike? How did you use the product?"
                    />
                    <small>{comment.length}/4000</small>
                  </div>

                  <div className="prv-form__field">
                    <label>Photos and videos <span>Optional</span></label>
                    <div className="prv-upload">
                      <button
                        type="button"
                        onClick={() => imageInputRef.current?.click()}
                        disabled={uploading !== null}
                      >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
                          <rect x="3" y="4" width="18" height="16" rx="2" />
                          <circle cx="9" cy="10" r="2" />
                          <path d="m21 16-5-5L5 20" />
                        </svg>
                        {uploading === "image" ? "Uploading…" : "Add photos"}
                      </button>
                      <button
                        type="button"
                        onClick={() => videoInputRef.current?.click()}
                        disabled={uploading !== null}
                      >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
                          <rect x="2" y="5" width="14" height="14" rx="2" />
                          <path d="m22 8-6 4 6 4V8Z" />
                        </svg>
                        {uploading === "video" ? "Uploading…" : "Add video"}
                      </button>
                      <input
                        ref={imageInputRef}
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        hidden
                        onChange={(event) => {
                          const file = event.target.files?.[0];
                          if (file) handleUpload(file, "image");
                        }}
                      />
                      <input
                        ref={videoInputRef}
                        type="file"
                        accept="video/mp4,video/quicktime"
                        hidden
                        onChange={(event) => {
                          const file = event.target.files?.[0];
                          if (file) handleUpload(file, "video");
                        }}
                      />
                    </div>

                    {(images.length > 0 || videos.length > 0) && (
                      <div className="prv-upload-preview">
                        {images.map((image) => (
                          <div key={image.public_id || image.url}>
                            <img src={image.url} alt="Selected review attachment" />
                            <button
                              type="button"
                              onClick={() => setImages((current) => current.filter((entry) => entry !== image))}
                              aria-label="Remove image"
                            >
                              ×
                            </button>
                          </div>
                        ))}
                        {videos.map((video) => (
                          <div key={video.public_id || video.url}>
                            <video src={video.url} muted />
                            <button
                              type="button"
                              onClick={() => setVideos((current) => current.filter((entry) => entry !== video))}
                              aria-label="Remove video"
                            >
                              ×
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {formError && <p className="prv-form__error">{formError}</p>}
                </div>

                <div className="prv-modal__actions">
                  <button type="button" className="is-ghost" onClick={closeReviewForm} disabled={submitting}>
                    Cancel
                  </button>
                  <button type="button" onClick={submitReview} disabled={submitting || uploading !== null}>
                    {submitting ? "Submitting…" : "Submit review"}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
