import { useCallback, useEffect, useRef, useState } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";

import { supabase } from "@/lib/supabaseClient";
import { useAuth } from "@/context/AuthContext";
import SellerLayout from "@/layouts/SellerLayout";

interface SellerProduct {
  id: string;
  product_status?: string | null;
}
interface OrderItem {
  id: string;
  order_id?: string;
  product_id: string;
  product_name: string;
  quantity: number;
  price: number;
  created_at: string;
  order_status?: string | null;
  payment_status?: string | null;
  updated_at?: string | null;
  estimated_delivery?: string | null;
  tracking_number?: string | null;
}

export default function SellerDashboard() {
  const { user } = useAuth();
  const [totalProducts, setTotalProducts] = useState(0);
  const [approvedProducts, setApprovedProducts] = useState(0);
  const [pendingProducts, setPendingProducts] = useState(0);
  const [totalOrders, setTotalOrders] = useState(0);
  const [revenue, setRevenue] = useState(0);
  const [recentOrders, setRecentOrders] = useState<OrderItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [live, setLive] = useState(true);
  const channelRef = useRef<RealtimeChannel[]>([]);

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
        .select("id,product_status")
        .eq("seller_id", user.id);

      if (productsError) throw productsError;

      const sellerProducts = (products as SellerProduct[]) || [];
      setTotalProducts(sellerProducts.length);

      const approvedCount = sellerProducts.filter(
        (product) => product.product_status === "approved",
      ).length;
      setApprovedProducts(approvedCount);
      setPendingProducts(sellerProducts.length - approvedCount);

      const { data: orderItems, error: ordersError } = await supabase.rpc(
        "get_seller_order_items",
      );

      if (ordersError) throw ordersError;

      const orders = ((orderItems as OrderItem[]) || []).filter((order) =>
        sellerProducts.some((product) => product.id === order.product_id),
      );
      // fetch corresponding orders rows to pick up order-level fields (status, updated_at)
      const orderIds = Array.from(
        new Set(orders.map((o) => o.order_id).filter(Boolean)),
      ) as string[];
      let ordersById: Record<string, any> = {};
      if (orderIds.length) {
        const { data: orderRows } = await supabase
          .from("orders")
          .select(
            "id,order_status,updated_at,estimated_delivery,tracking_number",
          )
          .in("id", orderIds);

        ordersById = ((orderRows as any[] | null) || []).reduce(
          (acc, r) => {
            acc[String(r.id)] = r;
            return acc;
          },
          {} as Record<string, any>,
        );
      }

      const merged = orders.map((o) => ({
        ...o,
        ...(ordersById[String(o.order_id)] || {}),
      }));
      const sortedOrders = [...orders].sort(
        (a, b) =>
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
      );

      setTotalOrders(merged.length);
      setRevenue(
        merged.reduce(
          (sum, order) =>
            sum + Number(order.price || 0) * Number(order.quantity || 0),
          0,
        ),
      );
      setRecentOrders(merged.slice(0, 5));
    } catch (fetchError) {
      const message =
        fetchError instanceof Error
          ? fetchError.message
          : "Failed to load dashboard analytics";

      setError(
        message.includes("get_seller_order_items")
          ? "Seller order function is missing in Supabase. Run supabase/fix-seller-orders-rls.sql in the Supabase SQL Editor, then refresh this page."
          : message,
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

    const ordersTableChannel = supabase
      .channel(`seller-orders-${user.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "orders",
        },
        fetchDashboardData,
      )
      .subscribe();

    channelRef.current = [productsChannel, ordersChannel, ordersTableChannel];

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
                  <th className="p-4 text-left text-sm font-semibold text-green-950">
                    Status
                  </th>
                  <th className="p-4 text-left text-sm font-semibold text-green-950">
                    Updated
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
                      <td className="p-4 text-green-950 capitalize">
                        {order.order_status || "-"}
                      </td>
                      <td className="p-4 text-green-950">
                        {order.updated_at
                          ? new Date(order.updated_at).toLocaleString("en-IN")
                          : "-"}
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
