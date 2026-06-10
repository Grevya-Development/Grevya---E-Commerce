import { useEffect, useMemo, useRef, useState } from "react";
import SellerLayout from "@/layouts/SellerLayout";
import { supabase } from "@/lib/supabaseClient";
import { useAuthStore } from "@/store/authStore";

interface PendingProduct {
  id: string;
  name: string;
  category: string | null;
  price: number;
  stock: number;
  product_status?: string | null;
  created_at?: string | null;
}

export default function PendingProducts() {
  const { user } = useAuthStore();
  const channelRef = useRef<any[]>([]);
  const [products, setProducts] = useState<PendingProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [deletingProductId, setDeletingProductId] = useState<string | null>(
    null,
  );

  const fetchPendingProducts = async () => {
    if (!user?.id) return;

    setLoading(true);
    setError(null);

    const { data, error } = await supabase
      .from("products")
      .select(
        "id,name,category,price,stock,product_status,created_at",
      )
      .eq("seller_id", user.id)
      .order("created_at", { ascending: false });

    if (error) {
      setError(error.message);
      setProducts([]);
    } else {
      const allProducts = (data as PendingProduct[]) || [];
      const pendingProducts = allProducts.filter(
        (product) => product.product_status !== "approved",
      );
      setProducts(pendingProducts);
    }

    setLoading(false);
  };

  const deleteProduct = async (productId: string) => {
    const confirmDelete = window.confirm("Delete this pending product?");
    if (!confirmDelete) return;

    setDeletingProductId(productId);
    const { error } = await supabase
      .from("products")
      .delete()
      .eq("id", productId);
    setDeletingProductId(null);

    if (error) {
      setError(error.message);
      return;
    }

    fetchPendingProducts();
  };

  useEffect(() => {
    fetchPendingProducts();
  }, [user]);

  useEffect(() => {
    if (!user?.id) return;

    channelRef.current.forEach((channel) => supabase.removeChannel(channel));
    channelRef.current = [];

    const productsChannel = supabase
      .channel(`pending-products-${user.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "products",
          filter: `seller_id=eq.${user.id}`,
        },
        () => {
          fetchPendingProducts();
        },
      )
      .subscribe();

    channelRef.current = [productsChannel];

    return () => {
      channelRef.current.forEach((channel) => supabase.removeChannel(channel));
      channelRef.current = [];
    };
  }, [user]);

  const filteredProducts = useMemo(
    () =>
      products.filter((product) =>
        [product.name, product.category ?? ""]
          .join(" ")
          .toLowerCase()
          .includes(search.toLowerCase().trim()),
      ),
    [products, search],
  );

  return (
    <SellerLayout>
      <div className="p-8">
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold text-green-900">
              Pending Products
            </h1>
            <p className="mt-2 text-gray-600">
              Review the products that are waiting for approval.
            </p>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search pending products"
              className="w-full max-w-sm rounded-full border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 shadow-sm focus:border-emerald-300 focus:outline-none focus:ring-2 focus:ring-emerald-100"
            />
            <button
              type="button"
              onClick={fetchPendingProducts}
              className="rounded-full bg-green-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-green-700"
            >
              Refresh
            </button>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-3 mb-6">
          <div className="rounded-3xl border border-green-100 bg-white p-6 shadow-sm">
            <p className="text-sm font-medium text-gray-500">
              Pending listings
            </p>
            <p className="mt-3 text-4xl font-semibold text-green-900">
              {products.length}
            </p>
            <p className="mt-2 text-sm text-gray-500">
              Products awaiting approval.
            </p>
          </div>
          <div className="rounded-3xl border border-green-100 bg-white p-6 shadow-sm">
            <p className="text-sm font-medium text-gray-500">Search results</p>
            <p className="mt-3 text-4xl font-semibold text-blue-600">
              {filteredProducts.length}
            </p>
            <p className="mt-2 text-sm text-gray-500">
              Matching pending products.
            </p>
          </div>
          <div className="rounded-3xl border border-green-100 bg-white p-6 shadow-sm">
            <p className="text-sm font-medium text-gray-500">Latest request</p>
            <p className="mt-3 text-4xl font-semibold text-purple-600">
              {products[0]?.name ?? "—"}
            </p>
            <p className="mt-2 text-sm text-gray-500">
              Most recently created pending item.
            </p>
          </div>
        </div>

        <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
          <table className="min-w-full divide-y divide-slate-200">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-6 py-4 text-left text-sm font-semibold uppercase tracking-[0.12em] text-slate-500">
                  Product
                </th>
                <th className="px-6 py-4 text-left text-sm font-semibold uppercase tracking-[0.12em] text-slate-500">
                  Category
                </th>
                <th className="px-6 py-4 text-center text-sm font-semibold uppercase tracking-[0.12em] text-slate-500">
                  Stock
                </th>
                <th className="px-6 py-4 text-right text-sm font-semibold uppercase tracking-[0.12em] text-slate-500">
                  Price
                </th>
                <th className="px-6 py-4 text-right text-sm font-semibold uppercase tracking-[0.12em] text-slate-500">
                  Requested
                </th>
                <th className="px-6 py-4 text-right text-sm font-semibold uppercase tracking-[0.12em] text-slate-500">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {loading ? (
                <tr>
                  <td
                    colSpan={6}
                    className="px-6 py-12 text-center text-sm text-slate-500"
                  >
                    Loading pending products...
                  </td>
                </tr>
              ) : error ? (
                <tr>
                  <td
                    colSpan={6}
                    className="px-6 py-12 text-center text-sm text-red-600"
                  >
                    {error}
                  </td>
                </tr>
              ) : filteredProducts.length === 0 ? (
                <tr>
                  <td
                    colSpan={6}
                    className="px-6 py-12 text-center text-sm text-slate-500"
                  >
                    No pending products found.
                  </td>
                </tr>
              ) : (
                filteredProducts.map((product) => (
                  <tr
                    key={product.id}
                    className="hover:bg-slate-50 transition-colors"
                  >
                    <td className="px-6 py-4 text-sm font-medium text-slate-900">
                      {product.name}
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-700">
                      {product.category || "Uncategorized"}
                    </td>
                    <td className="px-6 py-4 text-center text-sm text-slate-700">
                      {product.stock}
                    </td>
                    <td className="px-6 py-4 text-right text-sm text-slate-700">
                      ₹{product.price}
                    </td>
                    <td className="px-6 py-4 text-right text-sm text-slate-700">
                      {product.created_at
                        ? new Date(product.created_at).toLocaleDateString(
                            "en-IN",
                          )
                        : "Pending"}
                    </td>
                    <td className="px-6 py-4 text-right text-sm">
                      <button
                        onClick={() => deleteProduct(product.id)}
                        disabled={deletingProductId === product.id}
                        className="inline-flex items-center justify-center rounded-full bg-red-500 px-3 py-2 text-xs font-semibold text-white transition hover:bg-red-600 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {deletingProductId === product.id
                          ? "Deleting…"
                          : "Delete"}
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </SellerLayout>
  );
}
