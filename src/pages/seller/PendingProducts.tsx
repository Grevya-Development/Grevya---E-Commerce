import { useEffect, useMemo, useRef, useState } from "react";
import SellerLayout from "@/layouts/SellerLayout";
import { supabase } from "@/lib/supabaseClient";
import { useAuth } from "@/context/AuthContext";
import type { RealtimeChannel } from "@supabase/supabase-js";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

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
  const { user } = useAuth();
  const channelRef = useRef<RealtimeChannel[]>([]);
  const [products, setProducts] = useState<PendingProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [deletingProductId, setDeletingProductId] = useState<string | null>(
    null,
  );
  const [rejectionMap, setRejectionMap] = useState<Record<string, string>>({});
  const [rejectDetailOpen, setRejectDetailOpen] = useState(false);
  const [selectedRejectMessage, setSelectedRejectMessage] = useState("");

  const fetchPendingProducts = async () => {
    if (!user?.id) {
      setProducts([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    const { data, error } = await supabase
      .from("products")
      .select("id,name,category,price,stock,product_status,created_at")
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

    // load recent notifications for this seller to extract rejection reasons.
    try {
      const { data: notifData } = await supabase
        .from("notifications")
        .select("id,message,created_at")
        .eq("user_id", user?.id)
        .order("created_at", { ascending: false })
        .limit(200);

      const map: Record<string, string> = {};
      const items = (notifData as { id: string; message: string }[]) || [];
      const re = /product_rejection::([^)\]]+)/i;
      items.forEach((n) => {
        const m = n.message || "";
        const match = m.match(re);
        if (match && match[1]) {
          const pid = match[1];
          // message text without the marker
          const text = m.replace(/\s*\[product_rejection::[^\]]+\]\s*$/, "");
          map[pid] = text;
        }
      });
      setRejectionMap(map);
    } catch (e) {
      // ignore notification fetch errors for now
      console.warn("Failed to fetch rejection notifications:", e);
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
                      <div className="flex items-center justify-end gap-2">
                        {product.product_status === "rejected" && (
                          <>
                            <span className="inline-flex rounded-full px-3 py-1 text-xs font-semibold bg-red-100 text-red-700">
                              Rejected
                            </span>
                            <button
                              onClick={() => {
                                const msg =
                                  rejectionMap[product.id] ||
                                  "No details provided.";
                                setSelectedRejectMessage(msg);
                                setRejectDetailOpen(true);
                              }}
                              className="inline-flex items-center justify-center rounded-full border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-sm hover:bg-slate-50"
                            >
                              View reason
                            </button>
                          </>
                        )}

                        <button
                          onClick={() => deleteProduct(product.id)}
                          disabled={deletingProductId === product.id}
                          className="inline-flex items-center justify-center rounded-full bg-red-500 px-3 py-2 text-xs font-semibold text-white transition hover:bg-red-600 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {deletingProductId === product.id
                            ? "Deleting…"
                            : "Delete"}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <Dialog
          open={rejectDetailOpen}
          onOpenChange={(open) => {
            setRejectDetailOpen(open);
            if (!open) setSelectedRejectMessage("");
          }}
        >
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Rejection details</DialogTitle>
              <DialogDescription>
                Reason provided by the admin for rejection.
              </DialogDescription>
            </DialogHeader>
            <div className="py-2">
              <p className="text-sm text-gray-800 whitespace-pre-wrap">
                {selectedRejectMessage}
              </p>
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => {
                  setRejectDetailOpen(false);
                  setSelectedRejectMessage("");
                }}
              >
                Close
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </SellerLayout>
  );
}
