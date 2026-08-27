import { useEffect, useMemo, useState, useRef } from "react";
import { Eye, Trash2, Pencil, Plus, Minus, Save } from "lucide-react";
import type { RealtimeChannel } from "@supabase/supabase-js";

import SellerLayout from "@/layouts/SellerLayout";
import { supabase } from "@/lib/supabaseClient";
import { useAuth } from "@/context/AuthContext";
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
  const { user } = useAuth();

  const channelRef = useRef<RealtimeChannel[]>([]);

  const [products, setProducts] = useState<Product[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(true);

  const [deletingProductId, setDeletingProductId] = useState<string | null>(
    null,
  );

  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [editModalOpen, setEditModalOpen] = useState(false);

  const [stockToAdd, setStockToAdd] = useState("0");
  const [savingProductId, setSavingProductId] = useState<string | null>(null);

  /*
   * Stock update feedback
   *
   * These replace browser alert() messages.
   */
  const [stockUpdateMessage, setStockUpdateMessage] = useState("");
  const [stockUpdateError, setStockUpdateError] = useState("");

  /*
   * Product view modal
   */
  const [selectedProduct, setSelectedProduct] =
    useState<Product | null>(null);

  const [viewModalOpen, setViewModalOpen] = useState(false);

  const placeholderImage =
    "https://images.unsplash.com/photo-1512436991641-6745cdb1723f?auto=format&fit=crop&w=800&q=80";

  /*
   * Fetch seller products
   */
  const fetchProducts = async () => {
    if (!user?.id) {
      setProducts([]);
      setLoading(false);
      return;
    }

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

  /*
   * Initial product fetch
   */
  useEffect(() => {
    fetchProducts();
  }, [user]);

  /*
   * Subscribe to realtime product changes
   */
  useEffect(() => {
    if (!user?.id) return;

    /*
     * Remove any existing channels first.
     */
    channelRef.current.forEach((channel) => {
      supabase.removeChannel(channel);
    });

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
      channelRef.current.forEach((channel) => {
        supabase.removeChannel(channel);
      });

      channelRef.current = [];
    };
  }, [user]);

  /*
   * Delete product
   */
  const deleteProduct = async (productId: string) => {
    const confirmDelete = window.confirm("Delete this product?");

    if (!confirmDelete) return;

    setDeletingProductId(productId);

    const { error } = await supabase
      .from("products")
      .delete()
      .eq("id", productId);

    if (error) {
      window.alert(error.message);
      setDeletingProductId(null);
      return;
    }

    await fetchProducts();

    setDeletingProductId(null);
  };

  /*
   * Open Edit Product modal
   */
  const openEditProduct = (product: Product) => {
    setEditingProduct(product);
    setStockToAdd("0");

    /*
     * Clear old feedback every time
     * the Edit modal is opened.
     */
    setStockUpdateMessage("");
    setStockUpdateError("");

    setEditModalOpen(true);
  };

  /*
   * Close Edit Product modal
   */
  const closeEditProduct = () => {
    /*
     * Don't allow closing while update is running.
     */
    if (savingProductId) return;

    setEditModalOpen(false);
    setEditingProduct(null);
    setStockToAdd("0");

    setStockUpdateMessage("");
    setStockUpdateError("");
  };

  /*
   * Increase/decrease amount of stock to add
   */
  const addStock = (amount: number) => {
    setStockToAdd((current) => {
      const currentAmount = Number.parseInt(current, 10);

      const safeCurrent = Number.isFinite(currentAmount)
        ? currentAmount
        : 0;

      return String(Math.max(0, safeCurrent + amount));
    });

    /*
     * Clear validation error once user changes input.
     */
    setStockUpdateError("");
  };

  /*
   * Update product stock
   */
  const updateProductStock = async () => {
    if (!user?.id || !editingProduct) return;

    /*
     * Clear previous feedback before starting a new update.
     */
    setStockUpdateMessage("");
    setStockUpdateError("");

    const amount = Number.parseInt(stockToAdd, 10);

    /*
     * Validate input.
     */
    if (!Number.isInteger(amount) || amount < 0) {
      setStockUpdateError(
        "Please enter a valid stock quantity.",
      );
      return;
    }

    /*
     * Don't allow zero update.
     */
    if (amount === 0) {
      setStockUpdateError(
        "Enter the number of units you want to add.",
      );
      return;
    }

    /*
     * Start loading state.
     */
    setSavingProductId(editingProduct.id);

    try {
      /*
       * Existing stock + newly received stock.
       */
      const newStock = editingProduct.stock + amount;

      const { data, error } = await supabase
        .from("products")
        .update({
          stock: newStock,
        })
        .eq("id", editingProduct.id)
        .eq("seller_id", user.id)
        .select(
          "id,name,price,stock,category,description,image_url,product_status,is_featured,is_hidden",
        )
        .single();

      if (error) {
        throw error;
      }

      const updatedProduct = data as Product;

      /*
       * Update product list immediately.
       */
      setProducts((currentProducts) =>
        currentProducts.map((product) =>
          product.id === updatedProduct.id
            ? updatedProduct
            : product,
        ),
      );

      /*
       * Update currently opened Edit Product modal.
       */
      setEditingProduct(updatedProduct);

      /*
       * Reset amount to add.
       */
      setStockToAdd("0");

      /*
       * Show success message INSIDE the modal.
       *
       * No window.alert().
       */
      setStockUpdateMessage(
        `Stock updated successfully. New stock: ${updatedProduct.stock} units.`,
      );

      /*
       * Make sure any previous error is removed.
       */
      setStockUpdateError("");
    } catch (error: unknown) {
      /*
       * Convert Supabase/unknown error safely.
       */
      const message =
        error instanceof Error
          ? error.message
          : "Failed to update product stock.";

      /*
       * Show error INSIDE modal.
       *
       * No window.alert().
       */
      setStockUpdateError(message);

      setStockUpdateMessage("");
    } finally {
      /*
       * IMPORTANT:
       *
       * This changes:
       *
       * Updating...
       *
       * back to:
       *
       * Update Stock
       */
      setSavingProductId(null);
    }
  };

  /*
   * Search products
   */
  const filteredProducts = useMemo(
    () =>
      products.filter((product) =>
        product.name
          .toLowerCase()
          .includes(searchQuery.trim().toLowerCase()),
      ),
    [products, searchQuery],
  );

  /*
   * Dashboard counts
   */
  const featuredCount = products.filter(
    (product) => product.is_featured,
  ).length;

  const hiddenCount = products.filter(
    (product) => product.is_hidden,
  ).length;

  const visibleCount = products.filter(
    (product) => !product.is_hidden,
  ).length;

  /*
   * Loading state
   */
  if (loading) {
    return (
      <div className="p-8 text-center text-gray-600">
        Loading products...
      </div>
    );
  }

  return (
    <SellerLayout>
      <div className="p-8">
        {/* =========================================================
            PAGE HEADER
        ========================================================= */}
        <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <h1 className="text-3xl font-bold text-green-900">
              My Products
            </h1>

            <p className="mt-2 max-w-2xl text-gray-600">
              Manage your inventory, track stock, and view approval
              status for your active products.
            </p>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <input
              value={searchQuery}
              onChange={(event) =>
                setSearchQuery(event.target.value)
              }
              placeholder="Search products..."
              className="w-full rounded-full border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 shadow-sm focus:border-emerald-300 focus:outline-none focus:ring-2 focus:ring-emerald-100 sm:w-72"
            />
          </div>
        </div>

        {/* =========================================================
            STATISTICS
        ========================================================= */}
        <div className="mb-8 grid gap-4 md:grid-cols-4">
          {/* Total */}
          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <p className="text-sm font-medium text-slate-500">
              Total
            </p>

            <p className="mt-4 text-4xl font-semibold text-slate-900">
              {products.length}
            </p>

            <p className="mt-2 text-sm text-slate-500">
              {products.length} active products
            </p>
          </div>

          {/* Featured */}
          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <p className="text-sm font-medium text-slate-500">
              Featured
            </p>

            <p className="mt-4 text-4xl font-semibold text-emerald-700">
              {featuredCount}
            </p>

            <p className="mt-2 text-sm text-slate-500">
              {featuredCount} products
            </p>
          </div>

          {/* Visible */}
          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <p className="text-sm font-medium text-slate-500">
              Visible
            </p>

            <p className="mt-4 text-4xl font-semibold text-emerald-700">
              {visibleCount}
            </p>

            <p className="mt-2 text-sm text-slate-500">
              {visibleCount} products
            </p>
          </div>

          {/* Hidden */}
          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <p className="text-sm font-medium text-slate-500">
              Hidden
            </p>

            <p className="mt-4 text-4xl font-semibold text-orange-500">
              {hiddenCount}
            </p>

            <p className="mt-2 text-sm text-slate-500">
              {hiddenCount} products
            </p>
          </div>
        </div>

        {/* =========================================================
            PRODUCT LIST
        ========================================================= */}
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
                  {/* Product top */}
                  <div className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:gap-6">
                    <div className="flex h-28 w-full items-center justify-center overflow-hidden rounded-3xl border border-slate-200 bg-slate-100 sm:w-28">
                      <img
                        src={
                          product.image_url ||
                          placeholderImage
                        }
                        alt={product.name}
                        onError={(event) => {
                          event.currentTarget.src =
                            placeholderImage;
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
                            {product.category ||
                              "Uncategorized"}
                          </p>
                        </div>

                        <span
                          className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${
                            product.product_status ===
                            "approved"
                              ? "bg-emerald-100 text-emerald-700"
                              : product.product_status ===
                                  "rejected"
                                ? "bg-red-100 text-red-700"
                                : "bg-orange-100 text-orange-700"
                          }`}
                        >
                          {product.product_status ===
                          "approved"
                            ? "Approved"
                            : product.product_status ===
                                "rejected"
                              ? "Rejected"
                              : "Pending"}
                        </span>
                      </div>

                      <p className="mt-3 line-clamp-3 text-sm leading-6 text-slate-600">
                        {product.description ||
                          "No description provided for this product."}
                      </p>
                    </div>
                  </div>

                  {/* Product information */}
                  <div className="border-t border-slate-100 px-4 py-4 sm:px-5">
                    <div className="grid gap-3 sm:grid-cols-3">
                      {/* Price */}
                      <div className="rounded-2xl bg-slate-50 p-3 text-xs">
                        <p className="text-[10px] uppercase tracking-[0.16em] text-slate-500">
                          Price
                        </p>

                        <p className="mt-2 text-lg font-semibold text-slate-900">
                          ₹{product.price}
                        </p>
                      </div>

                      {/* Stock */}
                      <div className="rounded-2xl bg-slate-50 p-3 text-xs">
                        <p className="text-[10px] uppercase tracking-[0.16em] text-slate-500">
                          Stock
                        </p>

                        <p className="mt-2 text-lg font-semibold text-slate-900">
                          {product.stock}
                        </p>
                      </div>

                      {/* Visibility */}
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
                          {product.is_hidden
                            ? "Hidden"
                            : "Visible"}
                        </span>
                      </div>
                    </div>

                    {/* Buttons */}
                    <div className="mt-4 flex gap-3">
                      {/* View */}
                      <button
                        onClick={() => {
                          setSelectedProduct(product);
                          setViewModalOpen(true);
                        }}
                        className="inline-flex flex-1 items-center justify-center gap-2 rounded-full bg-emerald-500 px-4 py-3 text-sm font-semibold text-white transition hover:bg-emerald-600"
                      >
                        <Eye size={16} />
                        View
                      </button>

                      {/* Edit */}
                      <button
                        onClick={() =>
                          openEditProduct(product)
                        }
                        className="inline-flex flex-1 items-center justify-center gap-2 rounded-full border border-[#33381C]/20 bg-[#F7EEE4] px-4 py-3 text-sm font-semibold text-[#33381C] transition hover:bg-[#33381C] hover:text-white"
                      >
                        <Pencil size={16} />
                        Edit
                      </button>

                      {/* Delete */}
                      <button
                        disabled={
                          deletingProductId === product.id
                        }
                        onClick={() =>
                          deleteProduct(product.id)
                        }
                        className="inline-flex flex-1 items-center justify-center gap-2 rounded-full bg-red-500 px-4 py-3 text-sm font-semibold text-white transition hover:bg-red-600 disabled:cursor-not-allowed disabled:opacity-60"
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

        {/* =========================================================
            EDIT PRODUCT MODAL
        ========================================================= */}
        <Dialog
          open={editModalOpen}
          onOpenChange={(open) => {
            if (!open) {
              closeEditProduct();
            }
          }}
        >
          <DialogContent className="max-w-xl rounded-3xl border-slate-200 bg-[#F7EEE4]">
            <DialogHeader>
              <DialogTitle className="text-2xl font-semibold text-[#33381C]">
                Edit Product
              </DialogTitle>

              <p className="text-sm text-slate-500">
                Update the inventory for{" "}
                {editingProduct?.name || "this product"}.
              </p>
            </DialogHeader>

            {editingProduct && (
              <div className="space-y-5">
                {/* =================================================
                    PRODUCT INFORMATION
                ================================================= */}
                <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                  <div className="flex items-center gap-4">
                    <div className="h-16 w-16 overflow-hidden rounded-2xl bg-slate-100">
                      <img
                        src={
                          editingProduct.image_url ||
                          placeholderImage
                        }
                        alt={editingProduct.name}
                        className="h-full w-full object-cover"
                        onError={(event) => {
                          event.currentTarget.src =
                            placeholderImage;
                        }}
                      />
                    </div>

                    <div className="min-w-0">
                      <h3 className="truncate text-lg font-semibold text-slate-900">
                        {editingProduct.name}
                      </h3>

                      <p className="mt-1 text-sm text-slate-500">
                        {editingProduct.category ||
                          "Uncategorized"}
                      </p>
                    </div>
                  </div>
                </div>

                {/* =================================================
                    STOCK UPDATE SECTION
                ================================================= */}
                <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                  {/* Current stock */}
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-400">
                        Current Stock
                      </p>

                      <p className="mt-2 text-3xl font-semibold text-[#33381C]">
                        {editingProduct.stock}{" "}
                        <span className="text-base font-medium text-slate-500">
                          units
                        </span>
                      </p>
                    </div>

                    <div className="rounded-2xl bg-emerald-50 p-3 text-emerald-700">
                      <Plus size={22} />
                    </div>
                  </div>

                  {/* Add Stock */}
                  <div className="mt-6">
                    <label
                      htmlFor="stock-to-add"
                      className="text-sm font-semibold text-slate-700"
                    >
                      Add Stock
                    </label>

                    <div className="mt-2 flex items-center gap-2">
                      {/* Minus */}
                      <button
                        type="button"
                        onClick={() => addStock(-1)}
                        disabled={
                          Number.parseInt(
                            stockToAdd,
                            10,
                          ) <= 0
                        }
                        className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                        aria-label="Decrease stock to add"
                      >
                        <Minus size={18} />
                      </button>

                      {/* Input */}
                      <input
                        id="stock-to-add"
                        type="number"
                        min="0"
                        step="1"
                        value={stockToAdd}
                        onChange={(event) => {
                          const value =
                            event.target.value;

                          if (
                            value === "" ||
                            /^\d+$/.test(value)
                          ) {
                            setStockToAdd(value);

                            /*
                             * Remove error when user
                             * starts correcting input.
                             */
                            setStockUpdateError("");
                          }
                        }}
                        className="h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 text-center text-lg font-semibold text-slate-900 outline-none transition focus:border-emerald-400 focus:bg-white focus:ring-2 focus:ring-emerald-100"
                        placeholder="0"
                      />

                      {/* Plus */}
                      <button
                        type="button"
                        onClick={() => addStock(1)}
                        className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-700 transition hover:bg-slate-50"
                        aria-label="Increase stock to add"
                      >
                        <Plus size={18} />
                      </button>
                    </div>

                    <p className="mt-2 text-xs text-slate-500">
                      Enter the number of new units received.
                      Existing stock will not be replaced.
                    </p>
                  </div>

                  {/* New stock preview */}
                  <div className="mt-5 rounded-2xl bg-slate-50 p-4">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-slate-500">
                        New stock after update
                      </span>

                      <span className="text-xl font-bold text-emerald-700">
                        {editingProduct.stock +
                          (Number.parseInt(
                            stockToAdd,
                            10,
                          ) || 0)}{" "}
                        units
                      </span>
                    </div>
                  </div>

                  {/* =================================================
                      SUCCESS MESSAGE
                  ================================================= */}
                  {stockUpdateMessage && (
                    <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3">
                      <div className="flex items-start gap-3">
                        {/* Check icon */}
                        <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-sm font-bold text-white">
                          ✓
                        </div>

                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-emerald-800">
                            Stock Updated
                          </p>

                          <p className="mt-1 text-sm text-emerald-700">
                            {stockUpdateMessage}
                          </p>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* =================================================
                      ERROR MESSAGE
                  ================================================= */}
                  {stockUpdateError && (
                    <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3">
                      <div className="flex items-start gap-3">
                        {/* Error icon */}
                        <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-red-600 text-sm font-bold text-white">
                          !
                        </div>

                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-red-800">
                            Update Failed
                          </p>

                          <p className="mt-1 text-sm text-red-700">
                            {stockUpdateError}
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* =================================================
                    MODAL BUTTONS
                ================================================= */}
                <div className="flex gap-3">
                  {/* Cancel */}
                  <button
                    type="button"
                    onClick={closeEditProduct}
                    disabled={
                      savingProductId === editingProduct.id
                    }
                    className="flex-1 rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    Cancel
                  </button>

                  {/* Update Stock */}
                  <button
                    type="button"
                    onClick={updateProductStock}
                    disabled={
                      savingProductId === editingProduct.id ||
                      Number.parseInt(stockToAdd, 10) <= 0
                    }
                    className="inline-flex flex-1 items-center justify-center gap-2 rounded-2xl bg-[#33381C] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#252a14] disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <Save size={17} />

                    {savingProductId === editingProduct.id
                      ? "Updating..."
                      : "Update Stock"}
                  </button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* =========================================================
            VIEW PRODUCT MODAL
        ========================================================= */}
        <Dialog
          open={viewModalOpen}
          onOpenChange={setViewModalOpen}
        >
          <DialogContent className="max-w-4xl">
            <DialogHeader className="pb-0">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <DialogTitle className="text-2xl font-semibold text-slate-900">
                    {selectedProduct?.name}
                  </DialogTitle>

                  <p className="mt-2 text-sm text-slate-500">
                    {selectedProduct?.category ||
                      "Uncategorized"}
                  </p>
                </div>
              </div>
            </DialogHeader>

            {selectedProduct && (
              <div className="grid gap-6 lg:grid-cols-[1.3fr_0.9fr]">
                {/* Product image */}
                <div className="overflow-hidden rounded-[2rem] bg-slate-100 shadow-sm">
                  <img
                    src={
                      selectedProduct.image_url ||
                      placeholderImage
                    }
                    alt={selectedProduct.name}
                    className="h-full w-full min-h-[360px] object-cover"
                    onError={(event) => {
                      event.currentTarget.src =
                        placeholderImage;
                    }}
                  />
                </div>

                {/* Product details */}
                <div className="space-y-5">
                  {/* Status / visibility / price / stock */}
                  <div className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-sm">
                    <div className="grid gap-4 sm:grid-cols-2">
                      {/* Status */}
                      <div className="space-y-2">
                        <p className="text-xs uppercase tracking-[0.25em] text-slate-400">
                          Status
                        </p>

                        <span
                          className={`inline-flex rounded-full px-3 py-1 text-sm font-semibold ${
                            selectedProduct.product_status ===
                            "approved"
                              ? "bg-emerald-100 text-emerald-700"
                              : selectedProduct.product_status ===
                                  "rejected"
                                ? "bg-red-100 text-red-700"
                                : "bg-orange-100 text-orange-700"
                          }`}
                        >
                          {selectedProduct.product_status ===
                          "approved"
                            ? "Approved"
                            : selectedProduct.product_status ===
                                "rejected"
                              ? "Rejected"
                              : "Pending"}
                        </span>
                      </div>

                      {/* Visibility */}
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
                          {selectedProduct.is_hidden
                            ? "Hidden"
                            : "Visible"}
                        </span>
                      </div>
                    </div>

                    {/* Price / stock */}
                    <div className="mt-5 grid gap-4 sm:grid-cols-2">
                      {/* Price */}
                      <div className="rounded-2xl bg-slate-50 p-4">
                        <p className="text-xs uppercase tracking-[0.22em] text-slate-400">
                          Price
                        </p>

                        <p className="mt-3 text-3xl font-semibold text-emerald-700">
                          ₹{selectedProduct.price}
                        </p>
                      </div>

                      {/* Stock */}
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

                  {/* Description */}
                  <div className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-sm">
                    <p className="text-sm font-medium text-slate-700">
                      Description
                    </p>

                    <p className="mt-3 leading-7 text-slate-600">
                      {selectedProduct.description ||
                        "No description provided for this product."}
                    </p>
                  </div>

                  {/* Category */}
                  <div className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-sm">
                    <p className="text-xs uppercase tracking-[0.22em] text-slate-400">
                      Category
                    </p>

                    <p className="mt-3 text-lg font-semibold text-slate-900">
                      {selectedProduct.category ||
                        "Uncategorized"}
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