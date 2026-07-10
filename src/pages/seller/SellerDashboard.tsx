import { useCallback, useEffect, useRef, useState } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import {
  Package,
  CheckCircle2,
  Clock,
  ShoppingCart,
  IndianRupee,
  Loader2,
  AlertTriangle,
  ArrowUpRight,
} from "lucide-react";
import { useNavigate } from "react-router-dom";

import { supabase } from "@/lib/supabaseClient";
import { useAuth } from "@/context/AuthContext";
import SellerLayout from "@/layouts/SellerLayout";

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
      className="inline-flex rounded-full px-3 py-0.5 text-[10px] font-bold uppercase tracking-wider"
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
    <div className="relative overflow-hidden rounded-3xl border border-[#A68D65]/15 bg-white p-6 shadow-2xs transition-all hover:shadow-md hover:-translate-y-0.5 group">
      <div
        className="absolute left-0 top-0 bottom-0 w-1.5"
        style={{ backgroundColor: accentColor }}
      />
      <div className="flex items-start justify-between">
        <div>
          <p className="text-[10px] font-bold text-neutral-500 uppercase tracking-wider">
            {label}
          </p>
          <h2 className="mt-2 text-3xl font-serif font-bold text-[#33381C]">
            {loading ? "..." : value}
          </h2>
        </div>
        <div className="rounded-2xl p-3 bg-[#F7EEE4] text-[#33381C] group-hover:bg-[#33381C] group-hover:text-white transition-colors duration-300">
          {icon}
        </div>
      </div>
    </div>
  );
}

export default function SellerDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
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
      return;
    }

    setLoading(true);
    setError("");

    try {
      // 1. Fetch products count
      const { data: products, error: prodErr } = await supabase
        .from("products")
        .select("id, product_status")
        .eq("seller_id", user.id);

      if (prodErr) throw prodErr;

      const total = products?.length || 0;
      const approved =
        products?.filter((p) => p.product_status === "approved").length || 0;
      const pending =
        products?.filter((p) => p.product_status === "pending").length || 0;

      setTotalProducts(total);
      setApprovedProducts(approved);
      setPendingProducts(pending);

      // 2. Fetch order items via RPC
      const { data: orderItems, error: rpcErr } = await supabase.rpc(
        "get_seller_order_items_v2"
      );

      if (rpcErr) {
        console.warn("RPC fetch failed, using fallback empty state", rpcErr);
        setTotalOrders(0);
        setRevenue(0);
        setRecentOrders([]);
      } else {
        const items = (orderItems as OrderItem[]) || [];

        // Count unique orders containing seller's products
        const uniqueOrders = new Set(items.map((i) => i.order_id).filter(Boolean));
        setTotalOrders(uniqueOrders.size);

        // Sum revenue of seller's products
        const totalRevenue = items.reduce(
          (sum, item) => sum + (item.price || 0) * (item.quantity || 1),
          0
        );
        setRevenue(totalRevenue);

        // Get latest 5 recent order items
        const sorted = [...items].sort(
          (a, b) =>
            new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        );
        setRecentOrders(sorted.slice(0, 5));
      }
    } catch (err: any) {
      setError(err.message || "Failed to load dashboard data");
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
        fetchDashboardData
      )
      .subscribe();

    const ordersChannel = supabase
      .channel(`seller-order-items-${user.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "order_items" },
        fetchDashboardData
      )
      .subscribe();

    const ordersTableChannel = supabase
      .channel(`seller-orders-${user.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "orders" },
        fetchDashboardData
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
      <div className="space-y-8">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="font-serif text-3xl font-bold text-[#33381C]">
              Seller Workspace
            </h1>
            <p className="text-neutral-500 mt-1 text-sm">
              Manage your products, monitor customer orders, and track your metrics.
            </p>
          </div>

          <button
            type="button"
            onClick={() => setLive((v) => !v)}
            className="rounded-full border border-[#A68D65]/20 bg-white py-1.5 px-4 text-xs font-semibold shadow-2xs hover:bg-[#F7EEE4] transition-colors cursor-pointer w-fit"
            style={{ color: "#33381C" }}
          >
            <span className="inline-flex items-center gap-2">
              <span
                className="h-2 w-2 rounded-full animate-pulse"
                style={{ backgroundColor: live ? "#22c55e" : "#9ca3af" }}
              />
              {live ? "Live Stream Active" : "Stream Suspended"}
            </span>
          </button>
        </div>

        {error && (
          <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-xs text-red-700">
            {error}
          </div>
        )}

        {/* Actionable items / Attention banner */}
        {!loading && pendingProducts > 0 && (
          <div className="flex items-start gap-4 p-5 bg-amber-50/50 border border-amber-200/60 rounded-3xl animate-fade-in">
            <div className="p-3 bg-amber-100 rounded-2xl text-amber-700">
              <AlertTriangle size={20} />
            </div>
            <div className="flex-1 space-y-1">
              <h3 className="font-serif font-bold text-neutral-800 text-sm">
                Products Awaiting Approval
              </h3>
              <p className="text-neutral-500 text-xs">
                You have <span className="font-bold text-[#33381C]">{pendingProducts}</span> products currently pending verification. Once approved, they will go live instantly.
              </p>
            </div>
            <button
              onClick={() => navigate("/seller/pending-products")}
              className="flex items-center gap-1.5 text-xs font-bold text-[#33381C] hover:text-[#33381C]/80 border border-[#33381C]/25 bg-white px-4.5 py-2 rounded-2xl transition-all shadow-2xs self-center"
            >
              <span>View Approvals</span>
              <ArrowUpRight size={14} />
            </button>
          </div>
        )}

        {/* Grouped Statistics Sections */}
        <div className="space-y-8">
          <div>
            <h2 className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest mb-3.5">
              Sales & Transactions Overview
            </h2>
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
              <StatCard
                label="Completed Orders"
                value={totalOrders}
                icon={<ShoppingCart size={18} />}
                accentColor="#bfdbfe"
                loading={loading}
              />
              <StatCard
                label="Gross Revenues"
                value={formatINR(revenue)}
                icon={<IndianRupee size={18} />}
                accentColor="#fbcfe8"
                loading={loading}
              />
            </div>
          </div>

          <div>
            <h2 className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest mb-3.5">
              Inventory & Catalog Status
            </h2>
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
              <StatCard
                label="Total Products Listed"
                value={totalProducts}
                icon={<Package size={18} />}
                accentColor="#d9f99d"
                loading={loading}
              />
              <StatCard
                label="Approved & Live"
                value={approvedProducts}
                icon={<CheckCircle2 size={18} />}
                accentColor="#bbf7d0"
                loading={loading}
              />
              <StatCard
                label="Pending Catalog Approvals"
                value={pendingProducts}
                icon={<Clock size={18} />}
                accentColor="#fed7aa"
                loading={loading}
              />
            </div>
          </div>
        </div>

        {/* Recent orders table */}
        <div className="mt-8 pt-4">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="font-serif text-xl font-bold text-[#33381C]">
                Recent Orders
              </h2>
              <p className="text-neutral-500 text-xs mt-0.5">
                The latest 5 orders requesting fulfillment.
              </p>
            </div>
          </div>

          <div className="overflow-hidden rounded-3xl border border-[#A68D65]/15 bg-white shadow-2xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#F7EEE4] text-[#33381C] uppercase font-bold tracking-wider border-b border-[#A68D65]/15">
                  <tr>
                    <th className="p-4">Product Name</th>
                    <th className="p-4">Quantity</th>
                    <th className="p-4">Unit Price</th>
                    <th className="p-4">Placed Date</th>
                    <th className="p-4">Shipment Status</th>
                    <th className="p-4">Last Updated</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#A68D65]/10 font-medium">
                  {loading ? (
                    <tr>
                      <td className="p-8 text-center text-neutral-500" colSpan={6}>
                        <div className="flex justify-center items-center gap-2">
                          <Loader2 className="h-4 w-4 animate-spin text-[#33381C]" />
                          Updating transaction records...
                        </div>
                      </td>
                    </tr>
                  ) : recentOrders.length === 0 ? (
                    <tr>
                      <td className="p-8 text-center text-neutral-400" colSpan={6}>
                        No transaction records found for your products.
                      </td>
                    </tr>
                  ) : (
                    recentOrders.map((order) => (
                      <tr
                        key={order.id}
                        className="hover:bg-neutral-50/50 transition-colors"
                      >
                        <td className="p-4 font-bold text-neutral-800">
                          {order.product_name}
                        </td>
                        <td className="p-4 text-neutral-600">{order.quantity}</td>
                        <td className="p-4 text-neutral-800 font-bold">
                          {formatINR(order.price)}
                        </td>
                        <td className="p-4 text-neutral-600">
                          {formatDate(order.created_at)}
                        </td>
                        <td className="p-4">
                          <StatusBadge status={order.order_status} />
                        </td>
                        <td className="p-4 text-neutral-500 text-[11px]">
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
      </div>
    </SellerLayout>
  );
}
