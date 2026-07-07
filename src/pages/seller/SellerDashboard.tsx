import { useCallback, useEffect, useRef, useState } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import {
  Package,
  CheckCircle2,
  Clock,
  ShoppingCart,
  IndianRupee,
} from "lucide-react";

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
  product_image?: string | null;
  quantity: number;
  price: number;
  created_at: string;
  order_status?: string | null;
  payment_status?: string | null;
  updated_at?: string | null;
  estimated_delivery?: string | null;
  tracking_number?: string | null;
}

// Brand colors as hex — used inline so they can never be purged/cached out
// by the Tailwind build, unlike utility classes.
const COLORS = {
  green900: "#14532d",
  green700: "#15803d",
  amber500: "#f59e0b",
  amberBg: "#fff7ed",
  amberBorder: "#fde68a",
};

const formatINR = (value: number) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(value);

const formatDate = (value?: string | null) => {
  if (!value) return "-";
  return new Date(value).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};

const STATUS_STYLES: Record<string, { bg: string; text: string }> = {
  pending: { bg: "#fff7ed", text: "#b45309" },
  confirmed: { bg: "#eff6ff", text: "#1d4ed8" },
  processing: { bg: "#eef2ff", text: "#4338ca" },
  shipped: { bg: "#ecfeff", text: "#0e7490" },
  delivered: { bg: "#f0fdf4", text: "#15803d" },
  cancelled: { bg: "#fef2f2", text: "#b91c1c" },
};

function StatusBadge({ status }: { status?: string | null }) {
  const key = (status || "").toLowerCase();
  const style = STATUS_STYLES[key] || { bg: "#f3f4f6", text: "#374151" };
  return (
    <span
      className="inline-flex rounded-full px-3 py-1 text-xs font-semibold capitalize"
      style={{ backgroundColor: style.bg, color: style.text }}
    >
      {status || "-"}
    </span>
  );
}

interface StatCardProps {
  label: string;
  value: React.ReactNode;
  icon: React.ReactNode;
  accentColor: string;
  loading: boolean;
}

function StatCard({ label, value, icon, accentColor, loading }: StatCardProps) {
  return (
    <div className="relative overflow-hidden rounded-xl border border-slate-200 bg-white p-6 shadow-sm transition-shadow hover:shadow-md">
      <div
        className="absolute left-0 top-0 h-full w-1"
        style={{ backgroundColor: accentColor }}
      />
      <div className="flex items-start justify-between">
        <p className="text-sm font-medium text-gray-500">{label}</p>
        <div
          className="rounded-lg p-2"
          style={{ backgroundColor: `${accentColor}1A`, color: accentColor }}
        >
          {icon}
        </div>
      </div>
      <h2 className="mt-3 text-4xl font-bold text-gray-900">
        {loading ? "..." : value}
      </h2>
    </div>
  );
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

      // Fetch product images for the products referenced in these order items
      const productIds = Array.from(
        new Set(merged.map((m) => m.product_id).filter(Boolean)),
      ) as string[];

      let productsById: Record<
        string,
        { id: string; name?: string; image_url?: string }
      > = {};
      if (productIds.length) {
        const { data: productRows } = await supabase
          .from("products")
          .select("id,name,image_url")
          .in("id", productIds);

        productsById = ((productRows as any[] | null) || []).reduce(
          (acc, p) => {
            acc[String(p.id)] = p;
            return acc;
          },
          {} as Record<string, any>,
        );
      }

      // Attach product image and normalized name to each merged order item
      const mergedWithImages = merged.map((item) => {
        const prod = item.product_id
          ? productsById[String(item.product_id)]
          : undefined;
        return {
          ...item,
          product_name: item.product_name || prod?.name || null,
          product_image: item.product_image || prod?.image_url || null,
        };
      });

      // Sort the MERGED list (with order-level fields attached), newest first.
      const sortedMerged = [...merged].sort(
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
      // Use the sorted order but map to the version that includes images
      const sortedWithImages = sortedMerged
        .map((s) => mergedWithImages.find((m) => m.id === s.id) || s)
        .filter(Boolean);

      setRecentOrders(sortedWithImages.slice(0, 5));
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

    if (!live) {
      channelRef.current.forEach((channel) => supabase.removeChannel(channel));
      channelRef.current = [];
      return;
    }

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
        { event: "*", schema: "public", table: "order_items" },
        fetchDashboardData,
      )
      .subscribe();

    const ordersTableChannel = supabase
      .channel(`seller-orders-${user.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "orders" },
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
            <h1 className="text-3xl font-bold text-gray-900">
              Seller Dashboard
            </h1>
            <p className="mt-2 text-gray-600">
              Manage your products and orders
            </p>
          </div>

          <button
            type="button"
            onClick={() => setLive((v) => !v)}
            className="rounded-full border px-4 py-2 text-sm font-medium shadow-sm transition-colors"
            style={
              live
                ? {
                    borderColor: "#bbf7d0",
                    backgroundColor: "#fff",
                    color: COLORS.green900,
                  }
                : {
                    borderColor: "#e5e7eb",
                    backgroundColor: "#fff",
                    color: "#4b5563",
                  }
            }
          >
            <span className="inline-flex items-center gap-2">
              <span
                className="h-2 w-2 rounded-full"
                style={{ backgroundColor: live ? "#22c55e" : "#9ca3af" }}
              />
              {live ? "Live analytics" : "Analytics paused"}
            </span>
          </button>
        </div>

        {error && (
          <div className="mt-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        <div className="mt-8 grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-5">
          <StatCard
            label="Total Products"
            value={totalProducts}
            icon={<Package size={18} />}
            accentColor="#000000"
            loading={loading}
          />
          <StatCard
            label="Approved"
            value={approvedProducts}
            icon={<CheckCircle2 size={18} />}
            accentColor="#000000"
            loading={loading}
          />
          <StatCard
            label="Pending Approval"
            value={pendingProducts}
            icon={<Clock size={18} />}
            accentColor="#000000"
            loading={loading}
          />
          <StatCard
            label="Total Orders"
            value={totalOrders}
            icon={<ShoppingCart size={18} />}
            accentColor="#000000"
            loading={loading}
          />
          <StatCard
            label="Revenue"
            value={formatINR(revenue)}
            icon={<IndianRupee size={18} />}
            accentColor="#000000"
            loading={loading}
          />
        </div>

        <div className="mt-10">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-2xl font-semibold text-gray-900">
              Recent Orders
            </h2>
            <p className="text-sm text-gray-500">Latest 5 order items</p>
          </div>

          <div className="overflow-hidden rounded-xl border border-green-100 bg-white shadow-sm">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="p-4 text-left text-sm font-semibold text-gray-900">
                    Product
                  </th>
                  <th className="p-4 text-left text-sm font-semibold text-gray-900">
                    Quantity
                  </th>
                  <th className="p-4 text-left text-sm font-semibold text-gray-900">
                    Price
                  </th>
                  <th className="p-4 text-left text-sm font-semibold text-gray-900">
                    Date
                  </th>
                  <th className="p-4 text-left text-sm font-semibold text-gray-900">
                    Status
                  </th>
                  <th className="p-4 text-left text-sm font-semibold text-gray-900">
                    Updated
                  </th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td className="p-6 text-center text-gray-500" colSpan={6}>
                      Loading dashboard...
                    </td>
                  </tr>
                ) : recentOrders.length === 0 ? (
                  <tr>
                    <td className="p-6 text-center text-gray-500" colSpan={6}>
                      No recent orders yet.
                    </td>
                  </tr>
                ) : (
                  recentOrders.map((order) => (
                    <tr key={order.id} className="border-t border-slate-100">
                      <td className="p-4 font-medium text-gray-900">
                        <div className="flex items-center">
                          <img
                            src={order.product_image || "/placeholder.svg"}
                            alt={order.product_name || "product"}
                            className="h-12 w-12 rounded-md object-cover bg-muted"
                          />
                          <span className="ml-4">{order.product_name}</span>
                        </div>
                      </td>
                      <td className="p-4 text-gray-900">{order.quantity}</td>
                      <td className="p-4 text-gray-900">
                        {formatINR(order.price)}
                      </td>
                      <td className="p-4 text-gray-900">
                        {formatDate(order.created_at)}
                      </td>
                      <td className="p-4">
                        <StatusBadge status={order.order_status} />
                      </td>
                      <td className="p-4 text-gray-900">
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
