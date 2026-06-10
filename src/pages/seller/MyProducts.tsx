import { useEffect, useMemo, useState, useRef } from "react";
import { Eye, Trash2 } from "lucide-react";

import SellerLayout from "@/layouts/SellerLayout";
import { supabase } from "@/lib/supabaseClient";
import { useAuthStore } from "@/store/authStore";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface Product {
  id: string;
  name: string;
  price: number;
  stock: number;
  category?: string | null;
  description?: string | null;
  image_url?: string | null;
  product_status?: string | null;
  is_featured: boolean;
  is_hidden: boolean;
}

export default function MyProducts() {
  const { user } = useAuthStore();
  const channelRef = useRef<any[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [deletingProductId, setDeletingProductId] = useState<string | null>(
    null,
  );

  const fetchProducts = async () => {
    if (!user?.id) return;

    const { data, error } = await supabase
      .from("products")
      .select(
        "id,name,price,stock,category,description,image_url,product_status,is_featured,is_hidden",
      )
      .eq("seller_id", user.id)
      .order("name", {
        ascending: false,
      });

    if (!error && data) {
      setProducts(data as Product[]);
    }

    setLoading(false);
  };

  useEffect(() => {
    fetchProducts();
  }, [user]);

  // Subscribe to realtime changes for this seller's products
  useEffect(() => {
    if (!user?.id) return;

    // remove any existing channels first (defensive)
    channelRef.current.forEach((ch) => supabase.removeChannel(ch));
    channelRef.current = [];

    const productsChannel = supabase
      .channel(`seller-products-${user.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "products",
          filter: `seller_id=eq.${user.id}`,
        },
        () => {
          fetchProducts();
        },
      )
      .subscribe();

    channelRef.current = [productsChannel];

    return () => {
      channelRef.current.forEach((ch) => supabase.removeChannel(ch));
      channelRef.current = [];
    };
  }, [user]);

  const deleteProduct = async (productId: string) => {
    const confirmDelete = window.confirm("Delete this product?");
    if (!confirmDelete) return;

    setDeletingProductId(productId);
    const { error } = await supabase
      .from("products")
      .delete()
      .eq("id", productId);

    if (error) {
      alert(error.message);
      setDeletingProductId(null);
      return;
    }

    await fetchProducts();
    setDeletingProductId(null);
  };

  // We can reuse feature/hide controls later if needed.
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [viewModalOpen, setViewModalOpen] = useState(false);

  const placeholderImage =
    "https://images.unsplash.com/photo-1512436991641-6745cdb1723f?auto=format&fit=crop&w=800&q=80";

  const filteredProducts = useMemo(
    () =>
      products.filter((product) =>
        product.name.toLowerCase().includes(searchQuery.trim().toLowerCase()),
      ),
    [products, searchQuery],
  );

  const featuredCount = products.filter(
    (product) => product.is_featured,
  ).length;
  const hiddenCount = products.filter((product) => product.is_hidden).length;
  const visibleCount = products.filter((product) => !product.is_hidden).length;

  if (loading) {
    return (
      <div className="p-8 text-center text-gray-600">Loading products...</div>
    );
  }

  return (
    <SellerLayout>
      <div className="p-8">
        <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <h1 className="text-3xl font-bold text-green-900">My Products</h1>
            <p className="mt-2 text-gray-600 max-w-2xl">
              Manage your inventory, track stock, and view approval status for
              your active products.
            </p>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <input
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Search products..."
              className="w-full rounded-full border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 shadow-sm focus:border-emerald-300 focus:outline-none focus:ring-2 focus:ring-emerald-100 sm:w-72"
            />
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-4 mb-8">
          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <p className="text-sm font-medium text-slate-500">Total</p>
            <p className="mt-4 text-4xl font-semibold text-slate-900">
              {products.length}
            </p>
            <p className="mt-2 text-sm text-slate-500">
              {products.length} active products
            </p>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <p className="text-sm font-medium text-slate-500">Featured</p>
            <p className="mt-4 text-4xl font-semibold text-emerald-700">
              {featuredCount}
            </p>
            <p className="mt-2 text-sm text-slate-500">
              {featuredCount} products
            </p>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <p className="text-sm font-medium text-slate-500">Visible</p>
            <p className="mt-4 text-4xl font-semibold text-emerald-700">
              {visibleCount}
            </p>
            <p className="mt-2 text-sm text-slate-500">
              {visibleCount} products
            </p>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <p className="text-sm font-medium text-slate-500">Hidden</p>
            <p className="mt-4 text-4xl font-semibold text-orange-500">
              {hiddenCount}
            </p>
            <p className="mt-2 text-sm text-slate-500">
              {hiddenCount} products
            </p>
          </div>
        </div>

        <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
          <div className="flex flex-col gap-4 border-b border-slate-100 bg-slate-50 px-6 py-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-base font-semibold text-slate-900">
                Product list
              </p>
              <p className="text-sm text-slate-500">
                {filteredProducts.length} products shown
              </p>
            </div>
            <div className="rounded-full bg-emerald-50 px-3 py-1 text-sm font-medium text-emerald-700">
              Updated live
            </div>
          </div>

          {filteredProducts.length === 0 ? (
            <div className="px-6 py-12 text-center text-sm text-slate-500">
              No products match your search.
            </div>
          ) : (
            <div className="grid gap-4 p-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3">
              {filteredProducts.map((product) => (
                <div
                  key={product.id}
                  className="group flex h-full flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm transition duration-300 hover:-translate-y-1 hover:shadow-2xl"
                >
                  <div className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:gap-6">
                    <div className="flex h-28 w-full items-center justify-center overflow-hidden rounded-3xl border border-slate-200 bg-slate-100 sm:w-28">
                      <img
                        src={product.image_url || placeholderImage}
                        alt={product.name}
                        onError={(event) => {
                          event.currentTarget.src = placeholderImage;
                        }}
                        className="h-full w-full object-cover"
                      />
                    </div>

                    <div className="flex-1">
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div>
                          <h3 className="text-lg font-semibold text-slate-900">
                            {product.name}
                          </h3>
                          <p className="mt-1 text-sm text-slate-500">
                            {product.category || "Uncategorized"}
                          </p>
                        </div>
                        <span
                          className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${
                            product.product_status === "approved"
                              ? "bg-emerald-100 text-emerald-700"
                              : "bg-orange-100 text-orange-700"
                          }`}
                        >
                          {product.product_status === "approved"
                            ? "Approved"
                            : "Pending"}
                        </span>
                      </div>

                      <p className="mt-3 text-sm leading-6 text-slate-600 line-clamp-3">
                        {product.description ||
                          "No description provided for this product."}
                      </p>
                    </div>
                  </div>

                  <div className="border-t border-slate-100 px-4 py-4 sm:px-5">
                    <div className="grid gap-3 sm:grid-cols-3">
                      <div className="rounded-2xl bg-slate-50 p-3 text-xs">
                        <p className="text-[10px] uppercase tracking-[0.16em] text-slate-500">
                          Price
                        </p>
                        <p className="mt-2 text-lg font-semibold text-slate-900">
                          ₹{product.price}
                        </p>
                      </div>
                      <div className="rounded-2xl bg-slate-50 p-3 text-xs">
                        <p className="text-[10px] uppercase tracking-[0.16em] text-slate-500">
                          Stock
                        </p>
                        <p className="mt-2 text-lg font-semibold text-slate-900">
                          {product.stock}
                        </p>
                      </div>
                      <div className="rounded-2xl bg-slate-50 p-3 text-xs">
                        <p className="text-[10px] uppercase tracking-[0.16em] text-slate-500">
                          Visibility
                        </p>
                        <span
                          className={`inline-flex rounded-full px-2 py-1 text-[11px] font-semibold ${
                            product.is_hidden
                              ? "bg-red-100 text-red-700"
                              : "bg-emerald-100 text-emerald-700"
                          }`}
                        >
                          {product.is_hidden ? "Hidden" : "Visible"}
                        </span>
                      </div>
                    </div>

                    <div className="mt-4 flex gap-3">
                      <button
                        onClick={() => {
                          setSelectedProduct(product);
                          setViewModalOpen(true);
                        }}
                        className="flex-1 inline-flex items-center justify-center gap-2 rounded-full bg-emerald-500 px-4 py-3 text-sm font-semibold text-white transition hover:bg-emerald-600"
                      >
                        <Eye size={16} />
                        View
                      </button>
                      <button
                        disabled={deletingProductId === product.id}
                        onClick={() => deleteProduct(product.id)}
                        className="flex-1 inline-flex items-center justify-center gap-2 rounded-full bg-red-500 px-4 py-3 text-sm font-semibold text-white transition hover:bg-red-600 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        <Trash2 size={16} />
                        {deletingProductId === product.id
                          ? "Deleting..."
                          : "Delete"}
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <Dialog open={viewModalOpen} onOpenChange={setViewModalOpen}>
          <DialogContent className="max-w-4xl">
            <DialogHeader className="pb-0">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <DialogTitle className="text-2xl font-semibold text-slate-900">
                    {selectedProduct?.name}
                  </DialogTitle>
                  <p className="mt-2 text-sm text-slate-500">
                    {selectedProduct?.category || "Uncategorized"}
                  </p>
                </div>
              </div>
            </DialogHeader>

            {selectedProduct && (
              <div className="grid gap-6 lg:grid-cols-[1.3fr_0.9fr]">
                <div className="overflow-hidden rounded-[2rem] bg-slate-100 shadow-sm">
                  <img
                    src={selectedProduct.image_url || placeholderImage}
                    alt={selectedProduct.name}
                    className="h-full w-full min-h-[360px] object-cover"
                    onError={(e) => {
                      e.currentTarget.src = placeholderImage;
                    }}
                  />
                </div>

                <div className="space-y-5">
                  <div className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-sm">
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="space-y-2">
                        <p className="text-xs uppercase tracking-[0.25em] text-slate-400">
                          Status
                        </p>
                        <span
                          className={`inline-flex rounded-full px-3 py-1 text-sm font-semibold ${
                            
                            selectedProduct.product_status === "approved"
                              ? "bg-emerald-100 text-emerald-700"
                              : "bg-orange-100 text-orange-700"
                          }`}
                        >
                          {
                          selectedProduct.product_status === "approved"
                            ? "Approved"
                            : "Pending"}
                        </span>
                      </div>

                      <div className="space-y-2">
                        <p className="text-xs uppercase tracking-[0.25em] text-slate-400">
                          Visibility
                        </p>
                        <span
                          className={`inline-flex rounded-full px-3 py-1 text-sm font-semibold ${
                            selectedProduct.is_hidden
                              ? "bg-red-100 text-red-700"
                              : "bg-emerald-100 text-emerald-700"
                          }`}
                        >
                          {selectedProduct.is_hidden ? "Hidden" : "Visible"}
                        </span>
                      </div>
                    </div>

                    <div className="mt-5 grid gap-4 sm:grid-cols-2">
                      <div className="rounded-2xl bg-slate-50 p-4">
                        <p className="text-xs uppercase tracking-[0.22em] text-slate-400">
                          Price
                        </p>
                        <p className="mt-3 text-3xl font-semibold text-emerald-700">
                          ₹{selectedProduct.price}
                        </p>
                      </div>
                      <div className="rounded-2xl bg-slate-50 p-4">
                        <p className="text-xs uppercase tracking-[0.22em] text-slate-400">
                          Stock
                        </p>
                        <p className="mt-3 text-3xl font-semibold text-slate-900">
                          {selectedProduct.stock} units
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-sm">
                    <p className="text-sm font-medium text-slate-700">
                      Description
                    </p>
                    <p className="mt-3 text-slate-600 leading-7">
                      {selectedProduct.description ||
                        "No description provided for this product."}
                    </p>
                  </div>

                  <div className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-sm">
                    <p className="text-xs uppercase tracking-[0.22em] text-slate-400">
                      Category
                    </p>
                    <p className="mt-3 text-lg font-semibold text-slate-900">
                      {selectedProduct.category || "Uncategorized"}
                    </p>
                  </div>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </SellerLayout>
  );
}
