import { useEffect, useState } from "react";
import ProductCard, { type ProductProps } from "@/components/ProductCard";
import { getProductStockDetails } from "@/lib/stock";
import {
  getReviewStatsByProductId,
  type ReviewRatingRow,
} from "@/lib/reviewStats";
import { supabase } from "@/lib/supabaseClient";
import { useRecentlyViewedStore } from "@/store/useRecentlyViewedStore";

interface RecentCatalogProduct {
  id: number;
  name: string;
  price: number;
  category?: string | null;
  image_url?: string | null;
}

interface RecentlyViewedProductsProps {
  excludeProductId?: number;
}

const RecentlyViewedProducts = ({
  excludeProductId,
}: RecentlyViewedProductsProps) => {
  const entries = useRecentlyViewedStore((state) => state.entries);
  const [products, setProducts] = useState<ProductProps[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const productIdKey = entries
    .map((entry) => entry.productId)
    .filter((id) => id !== excludeProductId)
    .slice(0, 10)
    .join(",");

  useEffect(() => {
    let isCurrent = true;
    const productIds = productIdKey
      ? productIdKey.split(",").map(Number)
      : [];

    if (productIds.length === 0) {
      setProducts([]);
      setLoading(false);
      setError(false);
      return () => {
        isCurrent = false;
      };
    }

    const loadProducts = async () => {
      setLoading(true);
      setError(false);

      try {
        const { data, error: productsError } = await supabase
          .from("products")
          .select("id, name, price, category, image_url")
          .in("id", productIds)
          .eq("product_status", "approved")
          .eq("is_hidden", false);
        if (productsError) throw productsError;

        const catalogProducts = (data || []) as RecentCatalogProduct[];
        if (catalogProducts.length === 0) {
          if (isCurrent) setProducts([]);
          return;
        }

        const validProductIds = catalogProducts.map((product) => product.id);
        const { data: reviewRows, error: reviewsError } = await supabase
          .from("reviews")
          .select("product_id, rating")
          .in("product_id", validProductIds);
        if (reviewsError) throw reviewsError;

        const reviewStats = getReviewStatsByProductId(
          (reviewRows || []) as ReviewRatingRow[],
        );
        const stockResults = await Promise.allSettled(
          catalogProducts.map((product) => getProductStockDetails(product.id)),
        );
        if (!isCurrent) return;

        const formatted = catalogProducts
          .map((product, index) => {
            const stockResult = stockResults[index];
            if (stockResult.status === "rejected") {
              console.error(
                `Recently viewed stock fetch error for product ${product.id}:`,
                stockResult.reason,
              );
            }
            const selectedVariant =
              stockResult.status === "fulfilled"
                ? stockResult.value.variants[0]
                : undefined;
            const stats = reviewStats.get(product.id);

            return {
              id: product.id,
              variant_id: selectedVariant?.id,
              sku: selectedVariant?.sku,
              stock:
                selectedVariant?.stock ??
                (stockResult.status === "fulfilled"
                  ? stockResult.value.productStock
                  : undefined),
              name: product.name,
              price: Number(product.price),
              rating: stats?.averageRating ?? 0,
              reviewCount: stats?.reviewCount ?? 0,
              image: product.image_url || "",
              category: product.category || "general",
              slug: product.name.toLowerCase().replace(/\s+/g, "-"),
            } satisfies ProductProps;
          })
          .sort(
            (a, b) =>
              productIds.indexOf(a.id) - productIds.indexOf(b.id),
          );

        setProducts(formatted);
      } catch (fetchError) {
        console.error("Recently viewed products fetch error:", fetchError);
        if (isCurrent) {
          setProducts([]);
          setError(true);
        }
      } finally {
        if (isCurrent) setLoading(false);
      }
    };

    void loadProducts();
    return () => {
      isCurrent = false;
    };
  }, [productIdKey, excludeProductId]);

  if (!loading && products.length === 0 && !error) return null;

  return (
    <section
      aria-labelledby="recently-viewed-heading"
      className="mt-16 border-t border-neutral-200 pt-12"
    >
      <div className="container mx-auto max-w-7xl px-4">
        <div className="mb-6">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#A68D65]">
            Pick up where you left off
          </p>
          <h2
            id="recently-viewed-heading"
            className="mt-1 font-serif text-2xl font-bold text-[#1D1E19] md:text-3xl"
          >
            Recently Viewed Products
          </h2>
        </div>

        {loading ? (
          <p role="status" className="py-8 text-sm text-neutral-500">
            Loading recently viewed products…
          </p>
        ) : error ? (
          <p role="status" className="py-4 text-sm text-neutral-500">
            Recently viewed products could not be loaded right now.
          </p>
        ) : products.length > 0 ? (
          <div className="flex snap-x snap-mandatory gap-4 overflow-x-auto pb-4">
            {products.map((product) => (
              <div
                key={product.id}
                className="w-[min(72vw,15rem)] shrink-0 snap-start sm:w-64"
              >
                <ProductCard {...product} />
              </div>
            ))}
          </div>
        ) : null}
      </div>
    </section>
  );
};

export default RecentlyViewedProducts;
