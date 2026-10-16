import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowLeft,
  Check,
  Image as ImageIcon,
  ShoppingCart,
  Star,
  X,
} from "lucide-react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/use-toast";
import { useCartStore } from "@/store/useCartStore";
import { useComparisonStore } from "@/store/useComparisonStore";
import { getProductStockDetails, type ProductStockDetails } from "@/lib/stock";
import { getReviewStatsByProductId, type ReviewRatingRow } from "@/lib/reviewStats";
import { supabase } from "@/lib/supabaseClient";

interface CatalogProduct {
  id: number;
  name: string;
  price: number;
  description?: string | null;
  stock?: number | null;
  category?: string | null;
  image_url?: string | null;
}

interface ProductVariant {
  id: string;
  product_id: number;
  sku: string | null;
  price: number | null;
  compare_at_price: number | null;
  weight_grams: number | null;
  attributes: Record<string, unknown> | null;
}

interface ComparisonEntry {
  product: CatalogProduct;
  variants: ProductVariant[];
  stock: ProductStockDetails | null;
  averageRating: number;
  reviewCount: number;
}

const money = (amount: number) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(amount);

const numberOrNull = (value: unknown): number | null => {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const quantityLabel = (variant: ProductVariant) => {
  const attributes = Object.entries(variant.attributes || {})
    .filter(([, value]) =>
      ["string", "number"].includes(typeof value) && String(value).trim(),
    )
    .map(([key, value]) => `${key}: ${String(value)}`);
  const weight = numberOrNull(variant.weight_grams);
  if (weight !== null && weight > 0) {
    attributes.push(
      weight >= 1000
        ? `${Number((weight / 1000).toFixed(2))} kg`
        : `${weight} g`,
    );
  }
  return attributes.length > 0
    ? attributes.join(" · ")
    : "Variant details not available";
};

const measuredQuantityLabel = (variant: ProductVariant) => {
  const weight = numberOrNull(variant.weight_grams);
  if (weight === null || weight <= 0) return null;
  return weight >= 1000
    ? `${Number((weight / 1000).toFixed(2))} kg`
    : `${weight} g`;
};

const ProductComparison = () => {
  const selectedIds = useComparisonStore((state) => state.selectedIds);
  const removeProduct = useComparisonStore((state) => state.removeProduct);
  const addItem = useCartStore((state) => state.addItem);
  const [entries, setEntries] = useState<Map<number, ComparisonEntry>>(
    () => new Map(),
  );
  const [selectedVariants, setSelectedVariants] = useState<
    Record<number, string>
  >({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);

  useEffect(() => {
    let isCurrent = true;

    if (selectedIds.length < 2) {
      setEntries(new Map());
      setLoading(false);
      setError(null);
      return () => {
        isCurrent = false;
      };
    }

    const loadComparison = async () => {
      setLoading(true);
      setError(null);

      try {
        const [productsResult, variantsResult, reviewsResult] =
          await Promise.all([
            supabase
              .from("products")
              .select("*")
              .in("id", selectedIds)
              .eq("product_status", "approved")
              .eq("is_hidden", false),
            supabase
              .from("product_variants")
              .select(
                "id, product_id, sku, price, compare_at_price, weight_grams, attributes",
              )
              .in("product_id", selectedIds)
              .eq("is_active", true),
            supabase
              .from("reviews")
              .select("product_id, rating")
              .in("product_id", selectedIds),
          ]);

        if (productsResult.error) throw productsResult.error;
        if (variantsResult.error) throw variantsResult.error;
        if (reviewsResult.error) throw reviewsResult.error;

        const products = (productsResult.data || []) as CatalogProduct[];
        const variants = (variantsResult.data || []) as ProductVariant[];
        const reviewStats = getReviewStatsByProductId(
          (reviewsResult.data || []) as ReviewRatingRow[],
        );
        const stockResults = await Promise.allSettled(
          products.map((product) => getProductStockDetails(product.id)),
        );

        if (!isCurrent) return;

        const nextEntries = new Map<number, ComparisonEntry>();
        products.forEach((product, index) => {
          const review = reviewStats.get(product.id);
          const stockResult = stockResults[index];
          nextEntries.set(product.id, {
            product,
            variants: variants.filter(
              (variant) => variant.product_id === product.id,
            ),
            stock:
              stockResult.status === "fulfilled" ? stockResult.value : null,
            averageRating: review?.averageRating ?? 0,
            reviewCount: review?.reviewCount ?? 0,
          });
          if (stockResult.status === "rejected") {
            console.error(
              `Stock fetch error for comparison product ${product.id}:`,
              stockResult.reason,
            );
          }
        });

        setEntries(nextEntries);
        setSelectedVariants((current) => {
          const next = { ...current };
          products.forEach((product, index) => {
            const productVariants = variants.filter(
              (variant) => variant.product_id === product.id,
            );
            if (!productVariants.some((variant) => variant.id === next[product.id])) {
              const stockVariants =
                stockResults[index].status === "fulfilled"
                  ? stockResults[index].value.variants
                  : [];
              const matchingStockVariant = stockVariants.find((stockVariant) =>
                productVariants.some(
                  (variant) => variant.id === stockVariant.id,
                ),
              );
              const defaultVariant = matchingStockVariant
                ? productVariants.find(
                    (variant) => variant.id === matchingStockVariant.id,
                  )
                : productVariants[0];
              if (defaultVariant) {
                next[product.id] = defaultVariant.id;
              } else {
                delete next[product.id];
              }
            }
          });
          return next;
        });
      } catch (fetchError: unknown) {
        if (!isCurrent) return;
        console.error("Product comparison fetch error:", fetchError);
        setError(
          fetchError instanceof Error
            ? fetchError.message
            : "Could not load the selected products.",
        );
      } finally {
        if (isCurrent) setLoading(false);
      }
    };

    void loadComparison();
    return () => {
      isCurrent = false;
    };
  }, [retryCount, selectedIds]);

  const columns = useMemo(
    () => selectedIds.map((id) => entries.get(id) ?? null),
    [entries, selectedIds],
  );

  const comparableUnitPrices = columns.map((entry) => {
    if (!entry || entry.variants.length !== 1) return null;
    const variant = entry.variants[0];
    const weight = numberOrNull(variant.weight_grams);
    const variantPrice = numberOrNull(variant.price);
    const productPrice = numberOrNull(entry.product.price);
    if (
      weight === null ||
      weight <= 0 ||
      productPrice === null ||
      variantPrice === null ||
      Math.abs(productPrice - variantPrice) >= 0.01
    ) {
      return null;
    }
    return (productPrice / weight) * 100;
  });
  const availableUnitPrices = comparableUnitPrices.filter(
    (price): price is number => price !== null,
  );
  const canCompareUnitPrices =
    availableUnitPrices.length >= 2 &&
    availableUnitPrices.length === comparableUnitPrices.length;
  const lowestUnitPrice = canCompareUnitPrices
    ? Math.min(...availableUnitPrices)
    : null;
  const productPrices = columns.map((entry) =>
    entry ? numberOrNull(entry.product.price) : null,
  );
  const availableProductPrices = productPrices.filter(
    (price): price is number => price !== null,
  );
  const lowestProductPrice =
    availableProductPrices.length >= 2 &&
    availableProductPrices.length === productPrices.length
      ? Math.min(...availableProductPrices)
    : null;

  const getStockLabel = (entry: ComparisonEntry | null, id: number) => {
    if (!entry?.stock) return "Not available";
    if (entry.stock.variants.length > 0) {
      const variantId = selectedVariants[id];
      if (entry.stock.variants.length > 1 && !variantId) {
        return "Choose a variant";
      }
      const variant =
        entry.stock.variants.find((item) => item.id === variantId) ||
        (entry.stock.variants.length === 1 ? entry.stock.variants[0] : null);
      if (!variant) return "Not available";
      return variant.stock > 0
        ? `In stock (${variant.stock})`
        : "Out of stock";
    }
    return entry.stock.productStock > 0
      ? `In stock (${entry.stock.productStock})`
      : "Out of stock";
  };

  const addToCart = async (entry: ComparisonEntry | null, id: number) => {
    if (!entry) return;
    const variant = entry.variants.find(
      (item) => item.id === selectedVariants[id],
    );
    const product = entry.product;
    const result = await addItem(
      {
        id: product.id,
        variant_id: variant?.id,
        sku: variant?.sku || undefined,
        name: product.name,
        price: Number(product.price),
        rating: entry.averageRating,
        image: product.image_url || "",
        category: product.category || "general",
        slug: product.name.toLowerCase().replace(/\s+/g, "-"),
      },
      1,
    );

    if (!result.ok) {
      toast({
        title: "Stock limit reached",
        description: result.availableStock
          ? `Only ${result.availableStock} units are available.`
          : "This product is out of stock.",
        variant: "destructive",
      });
      return;
    }
    toast({
      title: "Added to cart",
      description: `${product.name} added to your cart`,
    });
  };

  const rows = [
    {
      label: "Current price",
      value: (entry: ComparisonEntry | null) => {
        const price = entry ? numberOrNull(entry.product.price) : null;
        return price === null ? "Not available" : money(price);
      },
    },
    {
      label: "Original price",
      value: (entry: ComparisonEntry | null) => {
        if (!entry || entry.variants.length !== 1) return "Not available";
        const originalPrice = numberOrNull(
          entry.variants[0].compare_at_price,
        );
        const variantPrice = numberOrNull(entry.variants[0].price);
        const currentPrice = numberOrNull(entry.product.price);
        return originalPrice !== null &&
          currentPrice !== null &&
          variantPrice !== null &&
          Math.abs(currentPrice - variantPrice) < 0.01 &&
          originalPrice > currentPrice
          ? `${money(originalPrice)} (${Math.round(
              ((originalPrice - currentPrice) / originalPrice) * 100,
            )}% off)`
          : "Not available";
      },
    },
    {
      label: "Quantity / size",
      value: (entry: ComparisonEntry | null) =>
        entry && entry.variants.some((variant) => measuredQuantityLabel(variant))
          ? entry.variants
              .map(measuredQuantityLabel)
              .filter((label): label is string => label !== null)
              .join("; ")
          : "Not available",
    },
    {
      label: "Unit price",
      value: (_entry: ComparisonEntry | null, index: number) => {
        const price = comparableUnitPrices[index];
        return price === null
          ? "Not available"
          : `${money(price)} / 100 g`;
      },
    },
    {
      label: "Category",
      value: (entry: ComparisonEntry | null) =>
        entry?.product.category || "Not available",
    },
    {
      label: "Ingredients",
      value: () => "Not available",
    },
    {
      label: "Description",
      value: (entry: ComparisonEntry | null) =>
        entry?.product.description?.trim() || "Not available",
    },
    {
      label: "Rating",
      value: (entry: ComparisonEntry | null) =>
        entry && entry.reviewCount > 0
          ? `${entry.averageRating.toFixed(1)} / 5`
          : entry
            ? "No reviews yet"
            : "Not available",
    },
    {
      label: "Reviews",
      value: (entry: ComparisonEntry | null) =>
        entry ? String(entry.reviewCount) : "Not available",
    },
    {
      label: "Availability",
      value: (entry: ComparisonEntry | null, index: number) =>
        getStockLabel(entry, selectedIds[index]),
    },
    {
      label: "Variants",
      value: (entry: ComparisonEntry | null) =>
        entry && entry.variants.length > 0
          ? entry.variants.map(quantityLabel).join("; ")
          : "Not available",
    },
  ];

  const comparableRowValues = rows.map((row) =>
    columns.map((entry, index) => row.value(entry, index)),
  );

  return (
    <div className="flex min-h-screen flex-col bg-[#F7EEE4]/40">
      <Navbar />
      <main className="flex-grow px-4 pb-28 pt-8 md:pb-20">
        <div className="mx-auto max-w-7xl">
          <Link
            to="/products"
            className="mb-5 inline-flex items-center gap-2 text-sm font-semibold text-[#5C5C54] hover:text-[#33381C]"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to products
          </Link>

          <header className="mb-6">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#A68D65]">
              Grevya Naturals
            </p>
            <h1 className="mt-1 font-serif text-3xl font-bold text-[#1D1E19] md:text-4xl">
              Product comparison
            </h1>
            <p className="mt-2 max-w-2xl text-sm text-[#5C5C54]">
              Compare real product details side by side. Availability is checked
              against current catalog stock.
            </p>
          </header>

          {selectedIds.length < 2 ? (
            <section className="rounded-2xl border border-[#A68D65]/20 bg-white p-8 text-center shadow-sm">
              <h2 className="font-serif text-xl font-bold text-[#33381C]">
                {selectedIds.length === 0
                  ? "Choose products to compare"
                  : "Choose one more product"}
              </h2>
              <p className="mx-auto my-3 max-w-lg text-sm text-[#5C5C54]">
                Select two or three products from the catalog. Your selection
                stays saved as you browse.
              </p>
              <Button asChild className="bg-[#33381C] text-[#F7EEE4] hover:bg-[#262A14]">
                <Link to="/products">Browse products</Link>
              </Button>
            </section>
          ) : loading ? (
            <div
              role="status"
              className="rounded-2xl border border-[#A68D65]/20 bg-white p-10 text-center text-[#5C5C54]"
            >
              Loading your comparison…
            </div>
          ) : error ? (
            <section
              role="alert"
              className="rounded-2xl border border-red-200 bg-white p-8 text-center"
            >
              <h2 className="font-serif text-xl font-bold text-[#33381C]">
                Could not load this comparison
              </h2>
              <p className="my-3 text-sm text-[#5C5C54]">{error}</p>
              <Button
                type="button"
                onClick={() => setRetryCount((count) => count + 1)}
                className="bg-[#33381C] text-[#F7EEE4] hover:bg-[#262A14]"
              >
                Try again
              </Button>
            </section>
          ) : (
            <div className="overflow-x-auto rounded-2xl border border-[#A68D65]/20 bg-white shadow-sm">
              <table className="w-full min-w-[780px] table-fixed border-collapse text-left">
                <thead>
                  <tr>
                    <th
                      scope="col"
                      className="w-36 border-b border-[#A68D65]/20 bg-[#F7EEE4]/70 p-3 align-top text-xs font-bold uppercase tracking-wide text-[#5C5C54] md:w-48 md:p-4"
                    >
                      Compare
                    </th>
                    {columns.map((entry, index) => {
                      const id = selectedIds[index];
                      const product = entry?.product;
                      const slug = product?.name
                        .toLowerCase()
                        .replace(/\s+/g, "-");
                      const category = product?.category || "general";
                      const variants = entry?.variants || [];
                      const selectedVariantId = selectedVariants[id];
                      return (
                        <th
                          key={id}
                          scope="col"
                          className="w-[280px] border-b border-l border-[#A68D65]/20 p-3 align-top md:w-[340px] md:p-4"
                        >
                          <div className="mb-3 flex items-start justify-between gap-2">
                            <div className="flex min-w-0 items-center gap-3">
                              {product?.image_url ? (
                                <img
                                  src={product.image_url}
                                  alt={product.name}
                                  className="h-16 w-16 shrink-0 rounded-xl bg-[#F7EEE4] object-cover md:h-20 md:w-20"
                                />
                              ) : (
                                <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-xl bg-[#F1ECE3] text-[#A68D65] md:h-20 md:w-20">
                                  <ImageIcon aria-hidden="true" />
                                </span>
                              )}
                              <span className="min-w-0">
                                {product ? (
                                  <Link
                                    to={`/products/${category}/${slug}`}
                                    state={{ productId: product.id }}
                                    className="line-clamp-2 font-serif text-base font-bold text-[#1D1E19] hover:text-[#33381C] md:text-lg"
                                  >
                                    {product.name}
                                  </Link>
                                ) : (
                                  <span className="font-serif text-base font-bold text-[#5C5C54]">
                                    Product unavailable
                                  </span>
                                )}
                                {product && (
                                  <Link
                                    to={`/products/${category}/${slug}`}
                                    state={{ productId: product.id }}
                                    className="mt-1 inline-block text-xs font-bold text-[#6E7540] underline underline-offset-2"
                                  >
                                    View product
                                  </Link>
                                )}
                              </span>
                            </div>
                            <button
                              type="button"
                              onClick={() => removeProduct(id)}
                              aria-label={`Remove ${product?.name || "product"} from comparison`}
                              className="rounded-full p-1.5 text-[#5C5C54] hover:bg-[#F1ECE3] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#33381C]"
                            >
                              <X className="h-4 w-4" />
                            </button>
                          </div>

                          {variants.length > 1 && (
                            <label className="mb-3 block text-left text-xs font-semibold text-[#5C5C54]">
                              Add to cart variant
                              <select
                                value={selectedVariantId || ""}
                                onChange={(event) =>
                                  setSelectedVariants((current) => ({
                                    ...current,
                                    [id]: event.target.value,
                                  }))
                                }
                                className="mt-1 block w-full rounded-lg border border-[#A68D65]/30 bg-white px-2 py-2 text-sm text-[#1D1E19] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#33381C]"
                              >
                                {variants.map((variant) => (
                                  <option key={variant.id} value={variant.id}>
                                    {quantityLabel(variant)}
                                  </option>
                                ))}
                              </select>
                            </label>
                          )}

                          <Button
                            type="button"
                            size="sm"
                            disabled={
                              !entry ||
                              numberOrNull(entry.product.price) === null ||
                              getStockLabel(entry, id) === "Out of stock" ||
                              getStockLabel(entry, id) === "Not available"
                            }
                            onClick={() => void addToCart(entry, id)}
                            className="w-full bg-[#33381C] text-[#F7EEE4] hover:bg-[#262A14]"
                          >
                            <ShoppingCart className="mr-2 h-4 w-4" />
                            Add to cart
                          </Button>
                        </th>
                      );
                    })}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, rowIndex) => {
                    const values = comparableRowValues[rowIndex];
                    const differentValues = new Set(values).size > 1;
                    return (
                      <tr key={row.label} className="border-b border-[#A68D65]/15 last:border-b-0">
                        <th
                          scope="row"
                          className="bg-[#F7EEE4]/50 p-3 text-xs font-bold text-[#33381C] md:p-4 md:text-sm"
                        >
                          {row.label}
                        </th>
                        {values.map((value, index) => {
                          const isLowestPrice =
                            row.label === "Current price" &&
                            lowestProductPrice !== null &&
                            productPrices[index] === lowestProductPrice;
                          const isLowestUnitPrice =
                            row.label === "Unit price" &&
                            canCompareUnitPrices &&
                            comparableUnitPrices[index] === lowestUnitPrice;
                          return (
                            <td
                              key={selectedIds[index]}
                              className={`border-l border-[#A68D65]/15 p-3 align-top text-sm leading-relaxed text-[#1D1E19] md:p-4 ${
                                differentValues ? "bg-[#F7EEE4]/35" : ""
                              }`}
                            >
                              {row.label === "Rating" &&
                              columns[index]?.reviewCount ? (
                                <span
                                  className="inline-flex items-center gap-1.5"
                                  aria-label={`${columns[index].averageRating.toFixed(
                                    1,
                                  )} out of 5 stars`}
                                >
                                  <span className="inline-flex items-center">
                                    {Array.from({ length: 5 }, (_, starIndex) => (
                                      <Star
                                        key={starIndex}
                                        className={`h-4 w-4 ${
                                          starIndex <
                                          Math.floor(
                                            columns[index]!.averageRating,
                                          )
                                            ? "fill-[#A68D65] text-[#A68D65]"
                                            : "text-[#A68D65]/50"
                                        }`}
                                      />
                                    ))}
                                  </span>
                                  <span>{value}</span>
                                </span>
                              ) : (
                                <span>{value}</span>
                              )}
                              {(isLowestPrice || isLowestUnitPrice) && (
                                <span className="ml-2 inline-flex items-center gap-1 rounded-full bg-[#E9EDDA] px-2 py-0.5 text-[10px] font-bold text-[#33381C]">
                                  <Check className="h-3 w-3" />
                                  Lowest {isLowestPrice ? "price" : "unit price"}
                                </span>
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {columns.some((entry) => entry === null) && (
                <p className="border-t border-[#A68D65]/15 bg-[#F7EEE4]/50 p-3 text-xs text-[#5C5C54]">
                  A selected product is no longer available in the catalog.
                  Remove it above to continue with current products.
                </p>
              )}
            </div>
          )}
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default ProductComparison;
