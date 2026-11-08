import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { ProductItem } from "../../services/api";
import type { CartSelection } from "../../utils/cart";

type AddToCart = (id: string | number, options?: Omit<CartSelection, "productId"> & { quantity?: number }) => void;

interface ProductExperienceValue {
  products: ProductItem[];
  wished: (string | number)[];
  quickViewProduct: ProductItem | null;
  compareProducts: ProductItem[];
  compareIds: string[];
  openQuickView: (product: ProductItem) => void;
  closeQuickView: () => void;
  toggleWish: (id: string | number) => void;
  addToCart: AddToCart;
  buyNow: AddToCart;
  openProduct: (id: string | number) => void;
  toggleCompare: (product: ProductItem) => void;
  removeCompare: (id: string | number) => void;
  clearCompare: () => void;
  isCompared: (id: string | number) => boolean;
}

const ProductExperienceContext = createContext<ProductExperienceValue | null>(null);

interface ProviderProps {
  products: ProductItem[];
  wished: (string | number)[];
  onToggleWish: (id: string | number) => void;
  onAddToCart: AddToCart;
  onBuyNow: AddToCart;
  onOpenProduct: (id: string | number) => void;
  children: ReactNode;
}

const readCompareIds = (): string[] => {
  try {
    const raw = localStorage.getItem("delivix_compare");
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.map(String).slice(0, 4) : [];
  } catch {
    return [];
  }
};

export function ProductExperienceProvider({
  products,
  wished,
  onToggleWish,
  onAddToCart,
  onBuyNow,
  onOpenProduct,
  children,
}: ProviderProps) {
  const [quickViewProduct, setQuickViewProduct] = useState<ProductItem | null>(null);
  const [compareIds, setCompareIds] = useState<string[]>(readCompareIds);

  useEffect(() => {
    try {
      localStorage.setItem("delivix_compare", JSON.stringify(compareIds));
    } catch {
      // localStorage may be unavailable in private mode.
    }
  }, [compareIds]);

  const compareProducts = useMemo(() => {
    const byId = new Map(products.map((product) => [String(product.id), product]));
    return compareIds.map((id) => byId.get(id)).filter((product): product is ProductItem => Boolean(product));
  }, [compareIds, products]);

  const toggleCompare = useCallback((product: ProductItem) => {
    const id = String(product.id);
    setCompareIds((current) => {
      if (current.includes(id)) return current.filter((entry) => entry !== id);
      if (current.length >= 4) return current;
      return [...current, id];
    });
  }, []);

  const removeCompare = useCallback((id: string | number) => {
    setCompareIds((current) => current.filter((entry) => entry !== String(id)));
  }, []);

  const value = useMemo<ProductExperienceValue>(
    () => ({
      products,
      wished,
      quickViewProduct,
      compareProducts,
      compareIds,
      openQuickView: (product) => setQuickViewProduct(product),
      closeQuickView: () => setQuickViewProduct(null),
      toggleWish: onToggleWish,
      addToCart: onAddToCart,
      buyNow: onBuyNow,
      openProduct: onOpenProduct,
      toggleCompare,
      removeCompare,
      clearCompare: () => setCompareIds([]),
      isCompared: (id) => compareIds.includes(String(id)),
    }),
    [products, wished, quickViewProduct, compareProducts, compareIds, onToggleWish, onAddToCart, onBuyNow, onOpenProduct, toggleCompare, removeCompare]
  );

  return (
    <ProductExperienceContext.Provider value={value}>{children}</ProductExperienceContext.Provider>
  );
}

export function useProductExperience(): ProductExperienceValue {
  const context = useContext(ProductExperienceContext);
  if (!context) {
    throw new Error("useProductExperience must be used inside ProductExperienceProvider");
  }
  return context;
}
