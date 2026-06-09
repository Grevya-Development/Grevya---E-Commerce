import { useCallback, useEffect, useRef, useState } from "react";

import { supabase } from "@/lib/supabaseClient";
import { useAuthStore } from "@/store/authStore";
import SellerLayout from "@/layouts/SellerLayout";

interface SellerProduct {
  id: string;
  product_status?: string | null;
  is_approved?: boolean | null;
}

interface OrderItem {
  id: string;
  product_id: string;
  product_name: string;
  quantity: number;
  price: number;
  created_at: string;
}

export default function SellerDashboard() {
  const { user } = useAuthStore();
  const [totalProducts, setTotalProducts] = useState(0);
  const [approvedProducts, setApprovedProducts] = useState(0);
  const [pendingProducts, setPendingProducts] = useState(0);
  const [totalOrders, setTotalOrders] = useState(0);
  const [revenue, setRevenue] = useState(0);
  const [recentOrders, setRecentOrders] = useState<OrderItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [live, setLive] = useState(true);
  const channelRef = useRef<any[]>([]);

  const fetchDashboardData = useCallback(async () => {
    if (!user?.id) {
      setTotalProducts(0);
      setApprovedProducts(0);
      setPendingProducts(0);
      setTotalOrders(0);
      setRevenue(0);
      setRecentOrders([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError("");

    try {
      const { data: products, error: productsError } = await supabase
        .from("products")
        .select("id,product_status,is_approved")
        .eq("seller_id", user.id);

      if (productsError) throw productsError;

      const sellerProducts = (products as SellerProduct[]) || [];
      setTotalProducts(sellerProducts.length);

      const approvedCount = sellerProducts.filter(
        (product) =>
          product.is_approved === true || product.product_status === "approved",
      ).length;
      setApprovedProducts(approvedCount);
      setPendingProducts(sellerProducts.length - approvedCount);

      const productIds = sellerProducts.map((product) => product.id);
      if (productIds.length === 0) {
        setTotalOrders(0);
        setRevenue(0);
        setRecentOrders([]);
        return;
      }

      const { data: orderItems, error: ordersError } = await supabase
        .from("order_items")
        .select("id,product_id,product_name,quantity,price,created_at")
        .in("product_id", productIds);

      if (ordersError) throw ordersError;

      const orders = orderItems || [];
      const sortedOrders = [...orders].sort(
        (a, b) =>
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
      );

      setTotalOrders(orders.length);
      setRevenue(
        orders.reduce(
          (sum, order) =>
            sum + Number(order.price || 0) * Number(order.quantity || 0),
          0,
        ),
      );
      setRecentOrders(sortedOrders.slice(0, 5));
    } catch (fetchError) {
      setError(
        fetchError instanceof Error
          ? fetchError.message
          : "Failed to load dashboard analytics",
      );
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  useEffect(() => {
    if (!user?.id) return;

    // If live analytics disabled, ensure channels are removed
    if (!live) {
      channelRef.current.forEach((channel) => supabase.removeChannel(channel));
      channelRef.current = [];
      return;
    }

    // remove previous channels (defensive) then create subscriptions
    channelRef.current.forEach((channel) => supabase.removeChannel(channel));
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
        fetchDashboardData,
      )
      .subscribe();

    const ordersChannel = supabase
      .channel(`seller-order-items-${user.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "order_items",
        },
        fetchDashboardData,
      )
      .subscribe();

    channelRef.current = [productsChannel, ordersChannel];

    return () => {
      channelRef.current.forEach((channel) => supabase.removeChannel(channel));
      channelRef.current = [];
    };
  }, [fetchDashboardData, user?.id, live]);

  return (
    <SellerLayout>
      <div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold text-green-900">
              Seller Dashboard
            </h1>
            <p className="mt-2 text-gray-600">
              Manage your products and orders
            </p>
          </div>

          <button
            type="button"
            onClick={() => setLive((v) => !v)}
            className={
              `rounded-full border px-4 py-2 text-sm font-medium shadow-sm ` +
              (live
                ? "border-green-200 bg-white text-green-800"
                : "border-gray-200 bg-white text-gray-600")
            }
          >
            {live ? "Live analytics" : "Analytics paused"}
          </button>
        </div>

        {error && (
          <div className="mt-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        <div className="mt-8 grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-5">
          <div className="rounded-xl border border-green-100 bg-white p-6 shadow-sm">
            <p className="text-sm font-medium text-gray-500">Total Products</p>
            <h2 className="mt-3 text-4xl font-bold text-green-700">
              {loading ? "..." : totalProducts}
            </h2>
          </div>
          <div className="rounded-xl border border-green-100 bg-white p-6 shadow-sm">
            <p className="text-sm font-medium text-gray-500">Approved</p>
            <h2 className="mt-3 text-4xl font-bold text-green-700">
              {loading ? "..." : approvedProducts}
            </h2>
          </div>
          <div className="rounded-xl border border-green-100 bg-white p-6 shadow-sm">
            <p className="text-sm font-medium text-gray-500">
              Pending Approval
            </p>
            <h2 className="mt-3 text-4xl font-bold text-orange-500">
              {loading ? "..." : pendingProducts}
            </h2>
          </div>
          <div className="rounded-xl border border-green-100 bg-white p-6 shadow-sm">
            <p className="text-sm font-medium text-gray-500">Total Orders</p>
            <h2 className="mt-3 text-4xl font-bold text-blue-600">
              {loading ? "..." : totalOrders}
            </h2>
          </div>
          <div className="rounded-xl border border-green-100 bg-white p-6 shadow-sm">
            <p className="text-sm font-medium text-gray-500">Revenue</p>
            <h2 className="mt-3 text-4xl font-bold text-purple-600">
              {loading ? "..." : `₹${revenue}`}
            </h2>
          </div>
        </div>

        <div className="mt-10">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-2xl font-semibold text-green-900">
              Recent Orders
            </h2>
            <p className="text-sm text-gray-500">Latest 5 order items</p>
          </div>

          <div className="overflow-hidden rounded-xl border border-green-100 bg-white shadow-sm">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="p-4 text-left text-sm font-semibold text-green-950">
                    Product
                  </th>
                  <th className="p-4 text-left text-sm font-semibold text-green-950">
                    Quantity
                  </th>
                  <th className="p-4 text-left text-sm font-semibold text-green-950">
                    Price
                  </th>
                  <th className="p-4 text-left text-sm font-semibold text-green-950">
                    Date
                  </th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td className="p-6 text-center text-gray-500" colSpan={4}>
                      Loading dashboard...
                    </td>
                  </tr>
                ) : recentOrders.length === 0 ? (
                  <tr>
                    <td className="p-6 text-center text-gray-500" colSpan={4}>
                      No recent orders yet.
                    </td>
                  </tr>
                ) : (
                  recentOrders.map((order) => (
                    <tr key={order.id} className="border-t border-green-50">
                      <td className="p-4 font-medium text-green-950">
                        {order.product_name}
                      </td>
                      <td className="p-4 text-green-950">{order.quantity}</td>
                      <td className="p-4 text-green-950">₹{order.price}</td>
                      <td className="p-4 text-green-950">
                        {new Date(order.created_at).toLocaleDateString("en-IN")}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </SellerLayout>
  );
}
