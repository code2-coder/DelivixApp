import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import toast from "react-hot-toast";
import * as XLSX from "xlsx";
import {
  AlertTriangle,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Copy,
  Download,
  Eye,
  EyeOff,
  FileSpreadsheet,
  Image as ImageIcon,
  Layers,
  Loader2,
  Package,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Star,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import {
  bulkUpdateProducts,
  createProduct,
  deleteProduct,
  duplicateProduct,
  exportProducts,
  fetchAdminProductById,
  fetchAdminProductPage,
  fetchBrands,
  importProducts,
  toggleProductFeatured,
  updateProduct,
  updateProductStatus,
  type AdminProductQuery,
  type AdminProductsResult,
  type AdminProductStats,
  type BrandItem,
  type CategoryItem,
  type ProductItem,
} from "../../services/api";
import { formatPrice } from "../../utils/currency";
import { formatReturnPolicy } from "../../utils/product";
import ProductEditor from "./ProductEditor";
import "./ProductsAdmin.css";

type ProductsAdminProps = {
  categories: CategoryItem[];
  onProductsChanged?: () => void;
};

type ConfirmState =
  | { kind: "delete"; product: ProductItem }
  | { kind: "bulk-delete"; ids: string[] };

const EMPTY_STATS: AdminProductStats = {
  totalProducts: 0,
  activeProducts: 0,
  draftProducts: 0,
  scheduledProducts: 0,
  outOfStockProducts: 0,
  lowStockProducts: 0,
  featuredProducts: 0,
  totalVariants: 0,
  hiddenProducts: 0,
};

const EMPTY_RESULT: AdminProductsResult = {
  products: [],
  totalProducts: 0,
  page: 1,
  perPage: 20,
  totalPages: 1,
  stats: EMPTY_STATS,
};

const idOf = (product: ProductItem) => String(product.id);

const statusOf = (product: ProductItem) => {
  if (product.status === "draft") return "Draft";
  if (product.status === "scheduled") return "Scheduled";
  if (product.status === "archived") return "Archived";
  if (product.visibility === "hidden") return "Hidden";
  return "Published";
};

const statusTone = (product: ProductItem) => {
  const status = statusOf(product);
  if (status === "Published") return "is-live";
  if (status === "Scheduled") return "is-scheduled";
  if (status === "Archived") return "is-archived";
  if (status === "Hidden") return "is-hidden";
  return "is-draft";
};

const variantStockOf = (product: ProductItem) =>
  (product.variants || []).reduce((total, variant) => {
    if ((variant.sizes || []).length) {
      return total + (variant.sizes || []).reduce((sum, size) => sum + (size.stock || 0), 0);
    }
    return total + (variant.stock || 0);
  }, 0);

const effectiveStock = (product: ProductItem) => {
  if ((product.variants || []).length) return variantStockOf(product);
  if ((product.sizes || []).length) {
    return (product.sizes || []).reduce((sum, size) => sum + (size.stock || 0), 0);
  }
  return product.stock || 0;
};

const discountOf = (product: ProductItem) => {
  const compare = product.old || product.mrp || 0;
  if (!compare || compare <= product.price) return 0;
  return Math.round(((compare - product.price) / compare) * 100);
};

const formatDate = (value?: string) => {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
};

const downloadBlob = (blob: Blob, filename: string) => {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
};

const mediaUrl = (entry: any) =>
  typeof entry === "string" ? entry : entry?.url || "";

export default function ProductsAdmin({ categories, onProductsChanged }: ProductsAdminProps) {
  const [query, setQuery] = useState<AdminProductQuery>({
    page: 1,
    limit: 20,
    sort: "newest",
  });
  const [searchInput, setSearchInput] = useState("");
  const [result, setResult] = useState<AdminProductsResult>(EMPTY_RESULT);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  const [brands, setBrands] = useState<BrandItem[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [actionId, setActionId] = useState<string | null>(null);
  const [bulkBusy, setBulkBusy] = useState<string | null>(null);

  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState<ProductItem | null>(null);
  const [saving, setSaving] = useState(false);

  const [viewing, setViewing] = useState<ProductItem | null>(null);
  const [viewLoading, setViewLoading] = useState(false);

  const [confirmState, setConfirmState] = useState<ConfirmState | null>(null);
  const [confirmBusy, setConfirmBusy] = useState(false);

  const [exporting, setExporting] = useState<"csv" | "xlsx" | null>(null);

  const [importOpen, setImportOpen] = useState(false);
  const [importRows, setImportRows] = useState<Record<string, any>[]>([]);
  const [importFileName, setImportFileName] = useState("");
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<{
    created: { id: string; name: string }[];
    failed: { row: number; name: string; reason: string }[];
    total: number;
  } | null>(null);
  const importInputRef = useRef<HTMLInputElement>(null);
  const selectAllRef = useRef<HTMLInputElement>(null);

  const refresh = useCallback(() => setReloadKey((key) => key + 1), []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetchAdminProductPage(query)
      .then((data) => {
        if (!cancelled) setResult(data);
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Could not load the product catalogue");
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
    let cancelled = false;
    fetchBrands(true)
      .then((list) => {
        if (!cancelled) setBrands(list);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

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

  const products = result.products;
  const stats = result.stats || EMPTY_STATS;
  const allSelected = products.length > 0 && products.every((product) => selected.includes(idOf(product)));
  const selectedOnPage = products.filter((product) => selected.includes(idOf(product))).length;

  useEffect(() => {
    if (selectAllRef.current) {
      selectAllRef.current.indeterminate = selectedOnPage > 0 && !allSelected;
    }
  }, [selectedOnPage, allSelected]);

  const mainCategories = useMemo(
    () => categories.filter((category) => !category.parentCategory),
    [categories]
  );

  const applyFilter = (patch: Partial<AdminProductQuery>) =>
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
      setSelected((current) => current.filter((id) => !products.some((product) => idOf(product) === id)));
    } else {
      setSelected((current) => [
        ...new Set([...current, ...products.map((product) => idOf(product))]),
      ]);
    }
  };

  const openCreate = () => {
    setEditing(null);
    setEditorOpen(true);
  };

  const openEdit = async (product: ProductItem) => {
    setActionId(idOf(product));
    try {
      const full = await fetchAdminProductById(product.id);
      setEditing(full || product);
      setEditorOpen(true);
    } catch {
      setEditing(product);
      setEditorOpen(true);
    } finally {
      setActionId(null);
    }
  };

  const openView = async (product: ProductItem) => {
    setViewing(product);
    setViewLoading(true);
    try {
      const full = await fetchAdminProductById(product.id);
      if (full) setViewing(full);
    } catch {
      // The row already carries enough information for a useful preview.
    } finally {
      setViewLoading(false);
    }
  };

  const handleSave = async (payload: Record<string, any>) => {
    setSaving(true);
    try {
      if (editing) {
        const updated = await updateProduct(editing.id, payload);
        toast.success(`Updated “${updated.name}”`);
      } else {
        const created = await createProduct(payload);
        toast.success(`Created “${created.name}”`);
        setSearchInput("");
        setQuery({ page: 1, limit: 20, sort: "newest" });
      }
      setEditorOpen(false);
      setEditing(null);
      refresh();
      onProductsChanged?.();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save the product");
      throw err;
    } finally {
      setSaving(false);
    }
  };

  const handleDuplicate = async (product: ProductItem) => {
    setActionId(idOf(product));
    try {
      const created = await duplicateProduct(product.id);
      toast.success(`Duplicated as “${created.name}”`);
      refresh();
      onProductsChanged?.();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not duplicate the product");
    } finally {
      setActionId(null);
    }
  };

  const handleFeature = async (product: ProductItem) => {
    setActionId(idOf(product));
    try {
      const updated = await toggleProductFeatured(product.id, !product.isFeatured);
      toast.success(updated.isFeatured ? "Added to featured products" : "Removed from featured products");
      refresh();
      onProductsChanged?.();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not update the featured flag");
    } finally {
      setActionId(null);
    }
  };

  const handlePublishToggle = async (product: ProductItem) => {
    setActionId(idOf(product));
    const nextStatus = statusOf(product) === "Published" ? "draft" : "published";
    try {
      await updateProductStatus(product.id, nextStatus);
      toast.success(nextStatus === "published" ? "Product published" : "Product moved to drafts");
      refresh();
      onProductsChanged?.();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not change the product status");
    } finally {
      setActionId(null);
    }
  };

  const runBulk = async (action: "publish" | "draft" | "feature" | "unfeature" | "hide" | "show") => {
    if (!selected.length) return;
    setBulkBusy(action);
    try {
      const outcome = await bulkUpdateProducts(selected, action);
      toast.success(`${outcome.modified} product${outcome.modified === 1 ? "" : "s"} updated`);
      setSelected([]);
      refresh();
      onProductsChanged?.();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Bulk action failed");
    } finally {
      setBulkBusy(null);
    }
  };

  const performConfirm = async () => {
    if (!confirmState) return;
    setConfirmBusy(true);
    try {
      if (confirmState.kind === "delete") {
        const ok = await deleteProduct(confirmState.product.id);
        if (!ok) throw new Error("The server rejected the delete request");
        toast.success(`Deleted “${confirmState.product.name}”`);
      } else {
        const outcome = await bulkUpdateProducts(confirmState.ids, "delete");
        toast.success(`${outcome.modified} product${outcome.modified === 1 ? "" : "s"} deleted`);
        setSelected([]);
      }
      setConfirmState(null);
      refresh();
      onProductsChanged?.();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not delete the product");
    } finally {
      setConfirmBusy(false);
    }
  };

  const handleExport = async (format: "csv" | "xlsx") => {
    setExporting(format);
    try {
      const blob = await exportProducts(query, format);
      downloadBlob(blob, `delivix-products-${new Date().toISOString().slice(0, 10)}.${format}`);
      toast.success(`Exported the current catalogue as ${format.toUpperCase()}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not export products");
    } finally {
      setExporting(null);
    }
  };

  const handleImportFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: "array" });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json<Record<string, any>>(sheet, { defval: "" });
      if (!rows.length) {
        toast.error("That spreadsheet has no data rows");
        return;
      }
      setImportRows(rows);
      setImportFileName(file.name);
      setImportResult(null);
    } catch {
      toast.error("Could not read that spreadsheet. Use CSV, XLSX or XLS.");
    } finally {
      event.target.value = "";
    }
  };

  const runImport = async () => {
    if (!importRows.length) return;
    setImporting(true);
    try {
      const outcome = await importProducts(importRows);
      setImportResult(outcome);
      if (outcome.created.length) {
        toast.success(`${outcome.created.length} product${outcome.created.length === 1 ? "" : "s"} imported`);
        refresh();
        onProductsChanged?.();
      } else {
        toast.error("No products could be imported");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Import failed");
    } finally {
      setImporting(false);
    }
  };

  const downloadTemplate = () => {
    const sheet = XLSX.utils.json_to_sheet([
      {
        name: "Example Product",
        sku: "DLV-EXAMPLE-001",
        category: "Accessories",
        brand: "Delivix",
        price: 999,
        mrp: 1299,
        stock: 25,
        description: "A short description of the product.",
        shortDescription: "Card copy",
        tags: "premium, new",
      },
    ]);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, sheet, "Products");
    XLSX.writeFile(workbook, "delivix-product-import-template.xlsx");
  };

  const closeImport = () => {
    if (importing) return;
    setImportOpen(false);
    setImportRows([]);
    setImportFileName("");
    setImportResult(null);
  };

  const start = result.totalProducts === 0 ? 0 : (result.page - 1) * result.perPage + 1;
  const end = Math.min(result.totalProducts, start + products.length - 1);

  return (
    <div className="admin-tab-view ap-admin">
      <div className="ap-head">
        <div>
          <p className="eyebrow" style={{ margin: 0 }}>Catalogue operations</p>
          <h3>Products</h3>
          <span>
            {stats.totalProducts} product{stats.totalProducts === 1 ? "" : "s"} · {stats.totalVariants} variant
            {stats.totalVariants === 1 ? "" : "s"} · {stats.hiddenProducts} hidden
          </span>
        </div>
        <div className="ap-head__actions">
          <button type="button" className="ap-btn ap-btn--ghost" onClick={refresh} disabled={loading}>
            {loading ? <Loader2 size={15} className="ap-spin" /> : <RefreshCw size={15} />}
            Refresh
          </button>
          <button type="button" className="ap-btn ap-btn--ghost" onClick={() => setImportOpen(true)}>
            <Upload size={15} /> Import
          </button>
          <button
            type="button"
            className="ap-btn ap-btn--ghost"
            onClick={() => handleExport("csv")}
            disabled={exporting !== null}
          >
            {exporting === "csv" ? <Loader2 size={15} className="ap-spin" /> : <Download size={15} />}
            CSV
          </button>
          <button
            type="button"
            className="ap-btn ap-btn--ghost"
            onClick={() => handleExport("xlsx")}
            disabled={exporting !== null}
          >
            {exporting === "xlsx" ? <Loader2 size={15} className="ap-spin" /> : <FileSpreadsheet size={15} />}
            Excel
          </button>
          <button type="button" className="ap-btn ap-btn--primary" onClick={openCreate}>
            <Plus size={15} /> New product
          </button>
        </div>
      </div>

      <div className="stat-grid ap-stats">
        <StatCard icon={<Package size={15} />} label="Total products" value={stats.totalProducts} hint="Across the full catalogue" />
        <StatCard icon={<CheckCircle2 size={15} />} label="Published" value={stats.activeProducts} hint={`${stats.hiddenProducts} hidden from storefront`} tone="good" />
        <StatCard icon={<Layers size={15} />} label="Drafts" value={stats.draftProducts} hint="Not visible to customers" />
        <StatCard icon={<RefreshCw size={15} />} label="Scheduled" value={stats.scheduledProducts} hint="Publishing automatically" />
        <StatCard icon={<AlertTriangle size={15} />} label="Low stock" value={stats.lowStockProducts} hint="At or below threshold" tone="warn" />
        <StatCard icon={<X size={15} />} label="Out of stock" value={stats.outOfStockProducts} hint="Needs replenishment" tone="warn" />
        <StatCard icon={<Star size={15} />} label="Featured" value={stats.featuredProducts} hint="Highlighted in storefront" />
        <StatCard icon={<Layers size={15} />} label="Variants" value={stats.totalVariants} hint="Colour and size combinations" />
      </div>

      <div className="admin-filters-bar ap-filters">
        <div className="admin-search-box">
          <Search size={16} />
          <input
            type="search"
            placeholder="Search name, SKU, brand or barcode…"
            value={searchInput}
            onChange={(event) => setSearchInput(event.target.value)}
            aria-label="Search products"
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
            <option value="published">Published</option>
            <option value="draft">Draft</option>
            <option value="scheduled">Scheduled</option>
            <option value="archived">Archived</option>
          </select>

          <select
            value={query.category || "all"}
            onChange={(event) => applyFilter({ category: event.target.value })}
            aria-label="Filter by category"
          >
            <option value="all">All categories</option>
            {mainCategories.map((category) => (
              <option key={category.id} value={category.name}>{category.name}</option>
            ))}
          </select>

          <select
            value={query.brand || "all"}
            onChange={(event) => applyFilter({ brand: event.target.value })}
            aria-label="Filter by brand"
          >
            <option value="all">All brands</option>
            {brands.map((brand) => (
              <option key={brand.id} value={brand.name}>{brand.name}</option>
            ))}
          </select>

          <select
            value={query.stockStatus || "all"}
            onChange={(event) => applyFilter({ stockStatus: event.target.value })}
            aria-label="Filter by stock"
          >
            <option value="all">All stock</option>
            <option value="in">In stock</option>
            <option value="low">Low stock</option>
            <option value="out">Out of stock</option>
          </select>

          <select
            value={query.sort || "newest"}
            onChange={(event) => setQuery((current) => ({ ...current, sort: event.target.value, page: 1 }))}
            aria-label="Sort products"
          >
            <option value="newest">Newest first</option>
            <option value="oldest">Oldest first</option>
            <option value="updated">Recently updated</option>
            <option value="name_asc">Name A–Z</option>
            <option value="name_desc">Name Z–A</option>
            <option value="price_asc">Price low to high</option>
            <option value="price_desc">Price high to low</option>
            <option value="stock_asc">Stock low to high</option>
            <option value="stock_desc">Stock high to low</option>
            <option value="rating">Top rated</option>
            <option value="popular">Most reviewed</option>
          </select>

          <label className="ap-check">
            <input
              type="checkbox"
              checked={query.featured === true}
              onChange={(event) => applyFilter({ featured: event.target.checked ? true : undefined })}
            />
            <span>Featured</span>
          </label>

          <button type="button" className="ap-reset" onClick={clearFilters}>
            Reset
          </button>
        </div>
      </div>

      {selected.length > 0 && (
        <div className="ap-bulk">
          <strong>{selected.length} selected</strong>
          <div className="ap-bulk__actions">
            <button type="button" onClick={() => runBulk("publish")} disabled={bulkBusy !== null}>
              {bulkBusy === "publish" ? <Loader2 size={13} className="ap-spin" /> : <Check size={13} />} Publish
            </button>
            <button type="button" onClick={() => runBulk("draft")} disabled={bulkBusy !== null}>
              {bulkBusy === "draft" ? <Loader2 size={13} className="ap-spin" /> : <Pencil size={13} />} Draft
            </button>
            <button type="button" onClick={() => runBulk("feature")} disabled={bulkBusy !== null}>
              <Star size={13} /> Feature
            </button>
            <button type="button" onClick={() => runBulk("unfeature")} disabled={bulkBusy !== null}>
              <Star size={13} /> Unfeature
            </button>
            <button type="button" onClick={() => runBulk("hide")} disabled={bulkBusy !== null}>
              <EyeOff size={13} /> Hide
            </button>
            <button type="button" onClick={() => runBulk("show")} disabled={bulkBusy !== null}>
              <Eye size={13} /> Show
            </button>
            <button
              type="button"
              className="is-danger"
              onClick={() => setConfirmState({ kind: "bulk-delete", ids: [...selected] })}
              disabled={bulkBusy !== null}
            >
              <Trash2 size={13} /> Delete
            </button>
            <button type="button" className="ap-bulk__clear" onClick={() => setSelected([])}>
              Clear
            </button>
          </div>
        </div>
      )}

      <section className="ap-table-wrap">
        {loading ? (
          <div className="ap-skeleton" aria-label="Loading products">
            {[1, 2, 3, 4, 5, 6].map((row) => (
              <div className="ap-skeleton__row" key={row}>
                <span /><span /><span /><span /><span /><span />
              </div>
            ))}
          </div>
        ) : error ? (
          <div className="ap-empty">
            <AlertTriangle size={26} />
            <strong>Could not load the catalogue</strong>
            <p>{error}</p>
            <button type="button" className="ap-btn ap-btn--primary" onClick={refresh}>Try again</button>
          </div>
        ) : products.length === 0 ? (
          <div className="ap-empty">
            <Search size={26} />
            <strong>No products match these filters</strong>
            <p>Adjust the search or filters, or create a new product to get started.</p>
            <div>
              <button type="button" className="ap-btn ap-btn--ghost" onClick={clearFilters}>Reset filters</button>
              <button type="button" className="ap-btn ap-btn--primary" onClick={openCreate}>
                <Plus size={14} /> New product
              </button>
            </div>
          </div>
        ) : (
          <>
            <div className="ap-table" role="table" aria-label="Product catalogue">
              <div className="ap-table__head" role="row">
                <span className="ap-checkbox">
                  <input
                    ref={selectAllRef}
                    type="checkbox"
                    checked={allSelected}
                    onChange={toggleAll}
                    aria-label="Select all products on this page"
                  />
                </span>
                <span>Product</span>
                <span>Status</span>
                <span>Pricing</span>
                <span>Inventory</span>
                <span>Performance</span>
                <span>Actions</span>
              </div>

              {products.map((product) => {
                const stock = effectiveStock(product);
                const compare = product.old || product.mrp || 0;
                const discount = discountOf(product);
                const busy = actionId === idOf(product);
                const variantCount = (product.variants || []).length;
                const sizeCount = (product.sizes || []).length;
                return (
                  <div
                    className={`ap-row ${selected.includes(idOf(product)) ? "is-selected" : ""}`}
                    role="row"
                    key={idOf(product)}
                  >
                    <span className="ap-checkbox">
                      <input
                        type="checkbox"
                        checked={selected.includes(idOf(product))}
                        onChange={() => toggleSelected(idOf(product))}
                        aria-label={`Select ${product.name}`}
                      />
                    </span>

                    <span className="ap-product">
                      {product.image ? (
                        <img src={product.image} alt="" loading="lazy" />
                      ) : (
                        <span className="ap-product__placeholder"><ImageIcon size={18} /></span>
                      )}
                      <span className="ap-product__body">
                        <button type="button" onClick={() => openView(product)} className="ap-product__name">
                          {product.name}
                        </button>
                        <small>
                          {product.sku || product.barcode || `ID ${String(product.id).slice(-8)}`}
                          {product.brand ? ` · ${product.brand}` : ""}
                          {product.category ? ` · ${product.category}` : ""}
                        </small>
                        <small className="ap-product__dates">
                          Created {formatDate(product.createdAt)} · Updated {formatDate(product.updatedAt)}
                        </small>
                        <span className="ap-product__flags">
                          {product.isFeatured && <em className="is-featured"><Star size={10} /> Featured</em>}
                          {product.isNewArrival && <em>New</em>}
                          {product.isBestSeller && <em>Best seller</em>}
                          {product.isTrending && <em>Trending</em>}
                        </span>
                      </span>
                    </span>

                    <span>
                      <span className={`ap-status ${statusTone(product)}`}>
                        <i />
                        {statusOf(product)}
                      </span>
                      {product.status === "scheduled" && (
                        <small className="ap-sub">Publishes automatically</small>
                      )}
                    </span>

                    <span className="ap-price">
                      <strong>{formatPrice(product.price)}</strong>
                      {compare > product.price && <del>{formatPrice(compare)}</del>}
                      {discount > 0 && <em>{discount}% off</em>}
                    </span>

                    <span className="ap-stock">
                      <span className={`ap-stock__dot ${stock <= 0 ? "is-out" : stock <= (product.minStockLevel || 5) ? "is-low" : "is-in"}`} />
                      <strong>{stock}</strong>
                      <small>
                        {variantCount
                          ? `${variantCount} colour${variantCount === 1 ? "" : "s"}`
                          : sizeCount
                            ? `${sizeCount} size${sizeCount === 1 ? "" : "s"}`
                            : "Single option"}
                      </small>
                    </span>

                    <span className="ap-performance">
                      <span className="ap-rating">
                        <Star size={12} />
                        <strong>{(product.ratings || 0).toFixed(1)}</strong>
                        <small>({product.numOfReviews || 0})</small>
                      </span>
                      <small>{variantCount + sizeCount > 0 ? `${variantCount + sizeCount} options` : "No variants"}</small>
                    </span>

                    <span className="ap-actions">
                      <button type="button" className="ap-icon-btn" onClick={() => openView(product)} title="View product" aria-label={`View ${product.name}`}>
                        <Eye size={14} />
                      </button>
                      <button type="button" className="ap-icon-btn" onClick={() => openEdit(product)} disabled={busy} title="Edit product" aria-label={`Edit ${product.name}`}>
                        {busy ? <Loader2 size={14} className="ap-spin" /> : <Pencil size={14} />}
                      </button>
                      <button type="button" className="ap-icon-btn" onClick={() => handleDuplicate(product)} disabled={busy} title="Duplicate product" aria-label={`Duplicate ${product.name}`}>
                        <Copy size={14} />
                      </button>
                      <button
                        type="button"
                        className={`ap-icon-btn ${product.isFeatured ? "is-active" : ""}`}
                        onClick={() => handleFeature(product)}
                        disabled={busy}
                        title={product.isFeatured ? "Remove from featured" : "Mark as featured"}
                        aria-label={product.isFeatured ? `Unfeature ${product.name}` : `Feature ${product.name}`}
                      >
                        <Star size={14} fill={product.isFeatured ? "currentColor" : "none"} />
                      </button>
                      <button
                        type="button"
                        className="ap-icon-btn"
                        onClick={() => handlePublishToggle(product)}
                        disabled={busy}
                        title={statusOf(product) === "Published" ? "Move to drafts" : "Publish product"}
                        aria-label={statusOf(product) === "Published" ? `Unpublish ${product.name}` : `Publish ${product.name}`}
                      >
                        {statusOf(product) === "Published" ? <EyeOff size={14} /> : <CheckCircle2 size={14} />}
                      </button>
                      <button
                        type="button"
                        className="ap-icon-btn is-danger"
                        onClick={() => setConfirmState({ kind: "delete", product })}
                        disabled={busy}
                        title="Delete product"
                        aria-label={`Delete ${product.name}`}
                      >
                        <Trash2 size={14} />
                      </button>
                    </span>
                  </div>
                );
              })}
            </div>

            <div className="ap-pagination">
              <span>
                Showing {start}–{end} of {result.totalProducts}
              </span>
              <div>
                <button
                  type="button"
                  onClick={() => setQuery((current) => ({ ...current, page: Math.max(1, (current.page || 1) - 1) }))}
                  disabled={(result.page || 1) <= 1}
                  aria-label="Previous page"
                >
                  <ChevronLeft size={15} />
                </button>
                <span>Page {result.page} of {result.totalPages || 1}</span>
                <button
                  type="button"
                  onClick={() => setQuery((current) => ({ ...current, page: Math.min(result.totalPages || 1, (current.page || 1) + 1) }))}
                  disabled={(result.page || 1) >= (result.totalPages || 1)}
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
          <div className="admin-modal ap-view" onClick={(event) => event.stopPropagation()}>
            <div className="admin-modal__header">
              <div>
                <p className="eyebrow" style={{ margin: 0 }}>Product preview</p>
                <h2>{viewing.name}</h2>
              </div>
              <button type="button" className="icon-button" onClick={() => setViewing(null)} aria-label="Close preview">
                <X size={18} />
              </button>
            </div>

            {viewLoading ? (
              <div className="ap-view__loading"><Loader2 size={20} className="ap-spin" /> Loading full product details…</div>
            ) : (
              <div className="ap-view__body">
                <div className="ap-view__gallery">
                  {((viewing.images && viewing.images.length ? viewing.images : [{ url: viewing.image }]) || [])
                    .map(mediaUrl)
                    .filter(Boolean)
                    .slice(0, 6)
                    .map((url, index) => (
                      <img key={`${url}-${index}`} src={url} alt={`${viewing.name} ${index + 1}`} />
                    ))}
                  {!(viewing.images || []).length && !viewing.image && (
                    <span className="ap-view__noimage"><ImageIcon size={28} /> No media</span>
                  )}
                </div>

                <div className="ap-view__summary">
                  <div className="ap-view__badges">
                    <span className={`ap-status ${statusTone(viewing)}`}><i />{statusOf(viewing)}</span>
                    {viewing.isFeatured && <span className="ap-chip"><Star size={11} /> Featured</span>}
                    {viewing.isNewArrival && <span className="ap-chip">New arrival</span>}
                    {viewing.isBestSeller && <span className="ap-chip">Best seller</span>}
                    {viewing.isTrending && <span className="ap-chip">Trending</span>}
                  </div>
                  <p className="ap-view__copy">{viewing.shortDescription || viewing.description || "No description provided."}</p>
                  <dl className="ap-view__facts">
                    <div><dt>SKU</dt><dd>{viewing.sku || "—"}</dd></div>
                    <div><dt>Barcode</dt><dd>{viewing.barcode || "—"}</dd></div>
                    <div><dt>Brand</dt><dd>{viewing.brand || "—"}</dd></div>
                    <div><dt>Category</dt><dd>{viewing.category || "—"}</dd></div>
                    <div><dt>Subcategory</dt><dd>{viewing.subcategory || "—"}</dd></div>
                    <div><dt>Created</dt><dd>{formatDate(viewing.createdAt)}</dd></div>
                    <div><dt>Price</dt><dd>{formatPrice(viewing.price)}{viewing.old ? ` (MRP ${formatPrice(viewing.old)})` : ""}</dd></div>
                    <div><dt>Stock</dt><dd>{effectiveStock(viewing)} units</dd></div>
                  </dl>
                  {(viewing.tags || []).length > 0 && (
                    <div className="ap-view__tags">
                      {(viewing.tags || []).map((tag) => <span key={tag}>{tag}</span>)}
                    </div>
                  )}
                </div>

                {(viewing.highlights || viewing.features || []).length > 0 && (
                  <section className="ap-view__section">
                    <h4>Highlights</h4>
                    <ul className="ap-view__highlights">
                      {(viewing.highlights?.length ? viewing.highlights : viewing.features || []).map((item) => (
                        <li key={item}><Check size={13} /> {item}</li>
                      ))}
                    </ul>
                  </section>
                )}

                <section className="ap-view__section">
                  <h4>Variants &amp; sizes</h4>
                  {(viewing.variants || []).length > 0 ? (
                    <div className="ap-view__variants">
                      {(viewing.variants || []).map((variant) => (
                        <div className="ap-view__variant" key={variant.variantName}>
                          <span className="ap-view__swatch" style={{ backgroundColor: variant.colorHex || "#d4d4d8" }} />
                          <strong>{variant.colorName || variant.variantName}</strong>
                          <span>{variant.sku || "No SKU"}</span>
                          <span>{formatPrice(variant.price || viewing.price)}</span>
                          <span>
                            {(variant.sizes || []).length
                              ? `${(variant.sizes || []).length} sizes · ${(variant.sizes || []).reduce((sum, size) => sum + (size.stock || 0), 0)} in stock`
                              : `${variant.stock || 0} in stock`}
                          </span>
                          <em className={variant.isActive === false ? "is-off" : "is-on"}>
                            {variant.isActive === false ? "Inactive" : "Active"}
                          </em>
                        </div>
                      ))}
                    </div>
                  ) : (viewing.sizes || []).length > 0 ? (
                    <div className="ap-view__variants">
                      {(viewing.sizes || []).map((size) => (
                        <div className="ap-view__variant" key={size.size}>
                          <strong>{size.size}</strong>
                          <span>{size.sku || "No SKU"}</span>
                          <span>{formatPrice(size.price || viewing.price)}</span>
                          <span>{size.stock || 0} in stock</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="ap-view__muted">This product is sold as a single option.</p>
                  )}
                </section>

                {(viewing.specifications || []).length > 0 && (
                  <section className="ap-view__section">
                    <h4>Specifications</h4>
                    <table className="ap-view__specs">
                      <tbody>
                        {(viewing.specifications || []).map((spec) => (
                          <tr key={`${spec.label}-${spec.value}`}>
                            <th scope="row">{spec.label}</th>
                            <td>{spec.value}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </section>
                )}

                <section className="ap-view__section">
                  <h4>Shipping &amp; after-sales</h4>
                  <dl className="ap-view__facts ap-view__facts--wide">
                    <div><dt>Delivery estimate</dt><dd>{viewing.estimatedDeliveryDays ? `${viewing.estimatedDeliveryDays} days` : "—"}</dd></div>
                    <div><dt>Weight</dt><dd>{viewing.shipping?.weight ? `${viewing.shipping.weight} g` : "—"}</dd></div>
                    <div><dt>Return policy</dt><dd>{formatReturnPolicy(viewing.returnPolicy, "—")}</dd></div>
                    <div><dt>Warranty</dt><dd>{viewing.warranty || "—"}</dd></div>
                  </dl>
                </section>
              </div>
            )}

            <div className="ap-view__footer">
              <button type="button" className="ap-btn ap-btn--ghost" onClick={() => setViewing(null)}>Close</button>
              <button
                type="button"
                className="ap-btn ap-btn--primary"
                onClick={() => {
                  const target = viewing;
                  setViewing(null);
                  if (target) openEdit(target);
                }}
              >
                <Pencil size={14} /> Edit product
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
                <p className="eyebrow" style={{ color: "#dc2626", margin: 0 }}>Confirm removal</p>
                <h2>
                  {confirmState.kind === "delete"
                    ? "Delete this product?"
                    : `Delete ${confirmState.ids.length} products?`}
                </h2>
              </div>
              <button type="button" className="icon-button" onClick={() => setConfirmState(null)} disabled={confirmBusy} aria-label="Close">
                <X size={18} />
              </button>
            </div>

            <div className="ap-confirm">
              {confirmState.kind === "delete" ? (
                <>
                  {confirmState.product.image && <img src={confirmState.product.image} alt="" />}
                  <div>
                    <strong>{confirmState.product.name}</strong>
                    <p>
                      This permanently removes the product, its variants and its media. Existing orders keep their
                      historical line items.
                    </p>
                  </div>
                </>
              ) : (
                <div>
                  <strong>{confirmState.ids.length} selected products</strong>
                  <p>This permanently removes every selected product and its variants. This cannot be undone.</p>
                </div>
              )}
            </div>

            <div className="ap-confirm__actions">
              <button type="button" className="ap-btn ap-btn--ghost" onClick={() => setConfirmState(null)} disabled={confirmBusy}>
                Cancel
              </button>
              <button type="button" className="ap-btn ap-btn--danger" onClick={performConfirm} disabled={confirmBusy}>
                {confirmBusy ? <Loader2 size={14} className="ap-spin" /> : <Trash2 size={14} />}
                {confirmBusy ? "Deleting…" : "Yes, delete"}
              </button>
            </div>
          </div>
        </div>
      )}

      {importOpen && (
        <div className="admin-modal-backdrop" onClick={closeImport}>
          <div className="admin-modal ap-import" onClick={(event) => event.stopPropagation()}>
            <div className="admin-modal__header">
              <div>
                <p className="eyebrow" style={{ margin: 0 }}>Bulk catalogue</p>
                <h2>Import products</h2>
              </div>
              <button type="button" className="icon-button" onClick={closeImport} disabled={importing} aria-label="Close import">
                <X size={18} />
              </button>
            </div>

            <div className="ap-import__body">
              <label className="ap-import__drop">
                <Upload size={26} />
                <strong>{importFileName || "Choose a CSV, XLSX or XLS file"}</strong>
                <span>Columns are matched to product fields. SKUs must be unique.</span>
                <input
                  ref={importInputRef}
                  type="file"
                  accept=".csv,.xlsx,.xls"
                  onChange={handleImportFile}
                  disabled={importing}
                />
              </label>

              <div className="ap-import__actions">
                <button type="button" className="ap-btn ap-btn--ghost" onClick={downloadTemplate}>
                  <Download size={14} /> Download template
                </button>
                <button type="button" className="ap-btn ap-btn--ghost" onClick={() => importInputRef.current?.click()} disabled={importing}>
                  <Upload size={14} /> Choose file
                </button>
              </div>

              {importRows.length > 0 && !importResult && (
                <div className="ap-import__preview">
                  <strong>{importRows.length} rows ready to import</strong>
                  <div>
                    {importRows.slice(0, 5).map((row, index) => (
                      <span key={index}>
                        {String(row.name || row.title || row["Product name"] || `Row ${index + 2}`)}
                        {row.price ? ` · ${formatPrice(Number(row.price) || 0)}` : ""}
                      </span>
                    ))}
                    {importRows.length > 5 && <span>+{importRows.length - 5} more</span>}
                  </div>
                </div>
              )}

              {importResult && (
                <div className="ap-import__result">
                  <div className="ap-import__summary">
                    <span className="is-good"><CheckCircle2 size={15} /> {importResult.created.length} created</span>
                    <span className={importResult.failed.length ? "is-bad" : ""}>
                      <AlertTriangle size={15} /> {importResult.failed.length} failed
                    </span>
                    <span>{importResult.total} rows processed</span>
                  </div>
                  {importResult.failed.length > 0 && (
                    <div className="ap-import__failures">
                      {importResult.failed.slice(0, 8).map((failure) => (
                        <span key={`${failure.row}-${failure.name}`}>
                          Row {failure.row}: {failure.name || "Unnamed"} — {failure.reason}
                        </span>
                      ))}
                      {importResult.failed.length > 8 && (
                        <span>+{importResult.failed.length - 8} more failures</span>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="ap-confirm__actions">
              <button type="button" className="ap-btn ap-btn--ghost" onClick={closeImport} disabled={importing}>
                {importResult ? "Done" : "Cancel"}
              </button>
              <button
                type="button"
                className="ap-btn ap-btn--primary"
                onClick={runImport}
                disabled={!importRows.length || importing || Boolean(importResult && !importResult.failed.length)}
              >
                {importing ? <Loader2 size={14} className="ap-spin" /> : <Upload size={14} />}
                {importing ? "Importing…" : `Import ${importRows.length || ""}`}
              </button>
            </div>
          </div>
        </div>
      )}

      <ProductEditor
        open={editorOpen}
        product={editing}
        categories={categories}
        brands={brands}
        saving={saving}
        onClose={() => {
          if (saving) return;
          setEditorOpen(false);
          setEditing(null);
        }}
        onSave={handleSave}
      />
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
