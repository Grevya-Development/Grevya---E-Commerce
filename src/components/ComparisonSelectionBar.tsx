import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { X } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { Button } from "@/components/ui/button";
import { useComparisonStore } from "@/store/useComparisonStore";

interface SelectionProduct {
  id: number;
  name: string;
  image_url: string | null;
}

const ComparisonSelectionBar = () => {
  const selectedIds = useComparisonStore((state) => state.selectedIds);
  const removeProduct = useComparisonStore((state) => state.removeProduct);
  const clearProducts = useComparisonStore((state) => state.clearProducts);
  const [products, setProducts] = useState<SelectionProduct[]>([]);
  const [loading, setLoading] = useState(false);
  const [fetchFailed, setFetchFailed] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    let isCurrent = true;

    if (selectedIds.length === 0) {
      setProducts([]);
      setLoading(false);
      setFetchFailed(false);
      return () => {
        isCurrent = false;
      };
    }

    const loadProducts = async () => {
      setLoading(true);
      setFetchFailed(false);
      const { data, error } = await supabase
        .from("products")
        .select("id, name, image_url")
        .in("id", selectedIds);

      if (!isCurrent) return;
      if (error) {
        console.error("Comparison selection fetch error:", error);
        setProducts([]);
        setFetchFailed(true);
      } else {
        setProducts((data || []) as SelectionProduct[]);
      }
      setLoading(false);
    };

    void loadProducts();
    return () => {
      isCurrent = false;
    };
  }, [selectedIds]);

  if (selectedIds.length === 0) return null;

  const productById = new Map(products.map((product) => [product.id, product]));
  const canCompare = selectedIds.length >= 2;

  return (
    <aside
      aria-label="Product comparison selection"
      aria-live="polite"
      className="fixed inset-x-3 bottom-24 z-50 mx-auto max-w-5xl rounded-2xl border border-[#A68D65]/30 bg-[#F7EEE4]/95 p-3 shadow-2xl backdrop-blur-xl md:bottom-5 md:px-5"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <p className="mb-2 text-xs font-bold text-[#33381C]">
            Compare products <span className="text-[#A68D65]">({selectedIds.length}/3)</span>
          </p>
          <ul className="flex gap-2 overflow-x-auto pb-1">
            {selectedIds.map((id) => {
              const product = productById.get(id);
              return (
                <li
                  key={id}
                  className="flex min-w-0 shrink-0 items-center gap-2 rounded-xl border border-[#A68D65]/20 bg-white/80 py-1.5 pl-1.5 pr-2"
                >
                  {product?.image_url ? (
                    <img
                      src={product.image_url}
                      alt=""
                      className="h-9 w-9 rounded-lg object-cover"
                    />
                  ) : (
                    <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#F1ECE3] text-[10px] text-[#5C5C54]">
                      {loading ? "…" : "—"}
                    </span>
                  )}
                  <span className="max-w-28 truncate text-xs font-semibold text-[#1D1E19] sm:max-w-40">
                    {product?.name ||
                      (loading ? "Loading…" : `Product #${id} unavailable`)}
                  </span>
                  <button
                    type="button"
                    onClick={() => removeProduct(id)}
                    aria-label={`Remove ${product?.name || "product"} from comparison`}
                    className="rounded-full p-1 text-[#5C5C54] hover:bg-[#F1ECE3] hover:text-[#33381C] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#33381C]"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </li>
              );
            })}
          </ul>
          {fetchFailed && (
            <p
              role="status"
              className="mt-2 text-[11px] text-[#5C5C54]"
            >
              Product names could not be loaded. Your selection is still saved.
            </p>
          )}
        </div>
        <div className="flex shrink-0 items-center justify-end gap-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={clearProducts}
            className="text-xs text-[#5C5C54] hover:text-[#33381C]"
          >
            Clear all
          </Button>
          <Button
            type="button"
            size="sm"
            disabled={!canCompare}
            onClick={() => navigate("/compare")}
            className="bg-[#33381C] text-[#F7EEE4] hover:bg-[#262A14]"
          >
            Compare now
          </Button>
        </div>
      </div>
      {!canCompare && (
        <p className="mt-1 text-right text-[11px] text-[#5C5C54]">
          Add one more product to compare.
        </p>
      )}
    </aside>
  );
};

export default ComparisonSelectionBar;
