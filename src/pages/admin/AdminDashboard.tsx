import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Users,
  Package,
  ShoppingCart,
  IndianRupee,
  UserCheck,
  Clock,
  ArrowUpRight,
  AlertTriangle,
  CheckCircle2,
  Activity,
} from "lucide-react";

import AdminLayout from "@/layouts/AdminLayout";
import { supabase } from "@/lib/supabaseClient";

export default function AdminDashboard() {
  const navigate = useNavigate();

  const [stats, setStats] = useState({
    users: 0,
    sellers: 0,
    approvedProducts: 0,
    pendingProducts: 0,
    orders: 0,
    revenue: 0,
  });

  const [loading, setLoading] = useState(true);

  const fetchStats = async () => {
    try {
      const { count: users } = await supabase
        .from("profiles")
        .select("*", { count: "exact", head: true });

      const { count: sellers } = await supabase
        .from("profiles")
        .select("*", { count: "exact", head: true })
        .eq("role", "seller");

      const { count: approvedProducts } = await supabase
        .from("products")
        .select("*", { count: "exact", head: true })
        .eq("product_status", "approved");

      const { count: pendingProducts } = await supabase
        .from("products")
        .select("*", { count: "exact", head: true })
        .eq("product_status", "pending");

      const { count: orders } = await supabase
        .from("orders")
        .select("*", { count: "exact", head: true });

      const { data: orderData } = await supabase
        .from("orders")
        .select("total_amount");

      const revenue =
        orderData?.reduce((sum, order) => sum + (order.total_amount || 0), 0) ||
        0;

      setStats({
        users: users || 0,
        sellers: sellers || 0,
        approvedProducts: approvedProducts || 0,
        pendingProducts: pendingProducts || 0,
        orders: orders || 0,
        revenue,
      });
    } catch (err) {
      console.error(err);
    }

    setLoading(false);
  };

  useEffect(() => {
    fetchStats();

    const channel = supabase
      .channel("dashboard-realtime")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "profiles",
        },
        () => fetchStats(),
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "products",
        },
        () => fetchStats(),
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "orders",
        },
        () => fetchStats(),
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 0,
    }).format(val);
  };

  return (
    <AdminLayout>
      <div className="space-y-8">
        {/* Header section */}
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="font-serif text-3xl font-bold text-[#33381C]">
              Admin Control Panel
            </h1>
            <p className="text-neutral-500 mt-1 text-sm">
              Operational governance, vendor requests, and marketplace
              performance metrics.
            </p>
          </div>
          <button
            type="button"
            onClick={() => navigate("/admin/analytics")}
            aria-label="Open live marketplace analytics"
            className="group inline-flex w-full items-center gap-3 rounded-2xl border border-[#33381C]/20 bg-white px-4 py-3 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:border-[#33381C]/40 hover:shadow-md md:w-auto"
          >
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#E7E9DD] text-[#33381C] transition-colors group-hover:bg-[#33381C] group-hover:text-white">
              <Activity size={18} />
            </span>
            <span className="min-w-0">
              <span className="flex items-center gap-2 text-sm font-bold text-[#33381C]">
                Live Analytics
                <span className="rounded-full bg-[#E5F0E3] px-1.5 py-0.5 text-[9px] font-bold tracking-wider text-[#3F6B4A]">LIVE</span>
              </span>
              <span className="mt-0.5 block text-xs text-neutral-500">Real-time marketplace insights</span>
            </span>
            <span className="relative ml-auto flex h-2.5 w-2.5 md:ml-1" aria-hidden="true">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-70" />
              <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500" />
            </span>
          </button>
        </div>

        {/* Operational Alerts / Attention required */}
        {!loading && stats.pendingProducts > 0 && (
          <div className="flex items-start gap-4 p-5 bg-amber-50/50 border border-amber-200/60 rounded-3xl animate-fade-in">
            <div className="p-3 bg-amber-100 rounded-2xl text-amber-700">
              <AlertTriangle size={20} />
            </div>
            <div className="flex-1 space-y-1">
              <h3 className="font-serif font-bold text-neutral-800 text-sm">
                Attention Required: Pending Vendor Request Requests
              </h3>
              <p className="text-neutral-500 text-xs">
                There are currently{" "}
                <span className="font-bold text-[#33381C]">
                  {stats.pendingProducts}
                </span>{" "}
                products awaiting catalog authorization.
              </p>
            </div>
            <button
              onClick={() => navigate("/admin/product-requests")}
              className="flex items-center gap-1.5 text-xs font-bold text-[#33381C] hover:text-[#33381C]/80 border border-[#33381C]/25 bg-white px-4.5 py-2 rounded-2xl transition-all shadow-2xs self-center"
            >
              <span>Review Requests</span>
              <ArrowUpRight size={14} />
            </button>
          </div>
        )}

        {/* Segmented stats grids */}
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[...Array(6)].map((_, idx) => (
              <div
                key={idx}
                className="bg-white border border-[#A68D65]/15 rounded-3xl p-6 h-36 flex flex-col justify-between animate-pulse"
              >
                <div className="flex justify-between items-start">
                  <div className="h-4 bg-neutral-100 rounded-md w-28" />
                  <div className="h-10 w-10 bg-neutral-100 rounded-xl" />
                </div>
                <div className="h-8 bg-neutral-100 rounded-md w-20" />
              </div>
            ))}
          </div>
        ) : (
          <div className="space-y-8">
            {/* Group 1: Marketplace Transactions & Financials */}
            <div>
              <h2 className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest mb-3.5">
                Financials & Transactions
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div
                  onClick={() => navigate("/admin/orders")}
                  className="bg-white border border-[#A68D65]/15 rounded-3xl p-6 cursor-pointer transition-all hover:shadow-md hover:-translate-y-0.5 group relative overflow-hidden flex items-start justify-between"
                >
                  <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-pink-200" />
                  <div className="space-y-2">
                    <p className="text-neutral-500 text-xs font-bold uppercase tracking-wider">
                      Gross Marketplace Revenue
                    </p>
                    <h3 className="text-4xl md:text-[2.2rem] font-serif font-bold text-[#33381C] leading-none">
                      {formatCurrency(stats.revenue)}
                    </h3>
                  </div>
                  <div className="bg-[#F7EEE4] text-[#33381C] p-3 rounded-2xl group-hover:bg-[#33381C] group-hover:text-white transition-colors duration-300">
                    <IndianRupee size={20} />
                  </div>
                </div>

                <div
                  onClick={() => navigate("/admin/orders")}
                  className="bg-white border border-[#A68D65]/15 rounded-3xl p-6 cursor-pointer transition-all hover:shadow-md hover:-translate-y-0.5 group relative overflow-hidden flex items-start justify-between"
                >
                  <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-purple-250" />
                  <div className="space-y-2">
                    <p className="text-neutral-500 text-xs font-bold uppercase tracking-wider">
                      Completed Orders
                    </p>
                    <h3 className="text-4xl md:text-[2.2rem] font-serif font-bold text-[#33381C] leading-none">
                      {stats.orders}
                    </h3>
                  </div>
                  <div className="bg-[#F7EEE4] text-[#33381C] p-3 rounded-2xl group-hover:bg-[#33381C] group-hover:text-white transition-colors duration-300">
                    <ShoppingCart size={20} />
                  </div>
                </div>
              </div>
            </div>

            {/* Group 2: User Growth & Registry */}
            <div>
              <h2 className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest mb-3.5">
                Marketplace Users & Accounts
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div
                  onClick={() => navigate("/admin/users")}
                  className="bg-white border border-[#A68D65]/15 rounded-3xl p-6 cursor-pointer transition-all hover:shadow-md hover:-translate-y-0.5 group relative overflow-hidden flex items-start justify-between"
                >
                  <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-green-200" />
                  <div className="space-y-2">
                    <p className="text-neutral-500 text-xs font-bold uppercase tracking-wider">
                      Total Accounts Registered
                    </p>
                    <h3 className="text-4xl md:text-[2.2rem] font-serif font-bold text-[#33381C] leading-none">
                      {stats.users}
                    </h3>
                  </div>
                  <div className="bg-[#F7EEE4] text-[#33381C] p-3 rounded-2xl group-hover:bg-[#33381C] group-hover:text-white transition-colors duration-300">
                    <Users size={20} />
                  </div>
                </div>

                <div
                  onClick={() => navigate("/admin/users")}
                  className="bg-white border border-[#A68D65]/15 rounded-3xl p-6 cursor-pointer transition-all hover:shadow-md hover:-translate-y-0.5 group relative overflow-hidden flex items-start justify-between"
                >
                  <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-blue-200" />
                  <div className="space-y-2">
                    <p className="text-neutral-500 text-xs font-bold uppercase tracking-wider">
                      Registered Shop Sellers
                    </p>
                    <h3 className="text-4xl md:text-[2.2rem] font-serif font-bold text-[#33381C] leading-none">
                      {stats.sellers}
                    </h3>
                  </div>
                  <div className="bg-[#F7EEE4] text-[#33381C] p-3 rounded-2xl group-hover:bg-[#33381C] group-hover:text-white transition-colors duration-300">
                    <UserCheck size={20} />
                  </div>
                </div>
              </div>
            </div>

            {/* Group 3: Products Catalog & Compliance Audit */}
            <div>
              <h2 className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest mb-3.5">
                Compliance & Catalog Audit
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div
                  onClick={() => navigate("/admin/products")}
                  className="bg-white border border-[#A68D65]/15 rounded-3xl p-6 cursor-pointer transition-all hover:shadow-md hover:-translate-y-0.5 group relative overflow-hidden flex items-start justify-between"
                >
                  <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-yellow-200" />
                  <div className="space-y-2">
                    <p className="text-neutral-500 text-xs font-bold uppercase tracking-wider">
                      Approved Catalog Products
                    </p>
                    <h3 className="text-4xl md:text-[2.2rem] font-serif font-bold text-[#33381C] leading-none">
                      {stats.approvedProducts}
                    </h3>
                  </div>
                  <div className="bg-[#F7EEE4] text-[#33381C] p-3 rounded-2xl group-hover:bg-[#33381C] group-hover:text-white transition-colors duration-300">
                    <Package size={20} />
                  </div>
                </div>

                <div
                  onClick={() => navigate("/admin/product-requests")}
                  className="bg-white border border-[#A68D65]/15 rounded-3xl p-6 cursor-pointer transition-all hover:shadow-md hover:-translate-y-0.5 group relative overflow-hidden flex items-start justify-between"
                >
                  <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-orange-200" />
                  <div className="space-y-2">
                    <p className="text-neutral-500 text-xs font-bold uppercase tracking-wider">
                      Pending Approval Requests
                    </p>
                    <h3 className="text-4xl md:text-[2.2rem] font-serif font-bold text-[#33381C] leading-none">
                      {stats.pendingProducts}
                    </h3>
                  </div>
                  <div className="bg-[#F7EEE4] text-[#33381C] p-3 rounded-2xl group-hover:bg-[#33381C] group-hover:text-white transition-colors duration-300">
                    <Clock size={20} />
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
