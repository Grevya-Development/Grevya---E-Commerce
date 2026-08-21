import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Activity,
  BarChart3,
  CheckCircle2,
  Clock3,
  IndianRupee,
  Package,
  RefreshCw,
  ShoppingCart,
  Store,
  Users,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import AdminLayout from "@/layouts/AdminLayout";
import { supabase } from "@/lib/supabaseClient";

type DateRange = "today" | "7d" | "30d" | "all";
type RecordRow = { created_at?: string | null; total_amount?: number | null; status?: string | null; product_status?: string | null; role?: string | null; name?: string | null };

const ranges: { value: DateRange; label: string }[] = [
  { value: "today", label: "Today" }, { value: "7d", label: "7 Days" },
  { value: "30d", label: "30 Days" }, { value: "all", label: "All Time" },
];
const orderStatuses = ["pending", "confirmed", "processing", "shipped", "in transit", "out for delivery", "delivered", "cancelled", "returned"];
const statusColors = ["#A6701A", "#6488A7", "#7F8E57", "#4B7651", "#6A9A8E", "#5D8AAB", "#3F6B4A", "#A23F2E", "#92696A"];

const rangeStart = (range: DateRange) => {
  if (range === "all") return null;
  const start = new Date();
  if (range === "today") start.setHours(0, 0, 0, 0);
  else start.setDate(start.getDate() - (range === "7d" ? 6 : 29));
  return start.toISOString();
};
const dayLabel = (value?: string | null) => value ? new Intl.DateTimeFormat("en-IN", { month: "short", day: "numeric" }).format(new Date(value)) : "Unknown";
const currency = (value: number) => new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(value);

function ChartEmpty() { return <div className="flex h-64 items-center justify-center text-sm text-neutral-500">No historical data available yet.</div>; }
function ChartShell({ title, children }: { title: string; children: React.ReactNode }) { return <section className="rounded-3xl border border-[#A68D65]/15 bg-white p-5 shadow-sm"><h2 className="font-serif text-lg font-bold text-[#33381C]">{title}</h2><div className="mt-5 h-64">{children}</div></section>; }

export default function AdminAnalytics() {
  const [range, setRange] = useState<DateRange>("30d");
  const [rows, setRows] = useState<{ orders: RecordRow[]; profiles: RecordRow[]; products: RecordRow[] }>({ orders: [], profiles: [], products: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAnalytics = useCallback(async () => {
    setLoading(true); setError(null);
    const start = rangeStart(range);
    const withRange = <T,>(query: T & { gte: (field: string, value: string) => T }) => start ? query.gte("created_at", start) : query;
    try {
      const [ordersResult, profilesResult, productsResult] = await Promise.all([
        withRange(supabase.from("orders").select("created_at,total_amount,status")).order("created_at", { ascending: true }),
        withRange(supabase.from("profiles").select("created_at,role")).order("created_at", { ascending: true }),
        withRange(supabase.from("products").select("created_at,name,product_status")).order("created_at", { ascending: true }),
      ]);
      const resultError = ordersResult.error || profilesResult.error || productsResult.error;
      if (resultError) throw resultError;
      setRows({ orders: ordersResult.data || [], profiles: profilesResult.data || [], products: productsResult.data || [] });
    } catch (fetchError) {
      console.error("Failed to load analytics:", fetchError);
      setError(fetchError instanceof Error ? fetchError.message : "Unable to load analytics data.");
    } finally { setLoading(false); }
  }, [range]);

  useEffect(() => {
    fetchAnalytics();
    const channel = supabase.channel("admin-analytics-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "profiles" }, fetchAnalytics)
      .on("postgres_changes", { event: "*", schema: "public", table: "products" }, fetchAnalytics)
      .on("postgres_changes", { event: "*", schema: "public", table: "orders" }, fetchAnalytics)
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [fetchAnalytics]);

  const metrics = useMemo(() => {
    const revenue = rows.orders.reduce((total, order) => total + Number(order.total_amount || 0), 0);
    return { revenue, orders: rows.orders.length, users: rows.profiles.length, sellers: rows.profiles.filter((p) => p.role === "seller").length, approved: rows.products.filter((p) => p.product_status === "approved").length, pending: rows.products.filter((p) => p.product_status === "pending").length };
  }, [rows]);
  const revenueData = useMemo(() => Object.values(rows.orders.reduce<Record<string, { date: string; revenue: number; orders: number }>>((acc, order) => { const key = dayLabel(order.created_at); acc[key] ||= { date: key, revenue: 0, orders: 0 }; acc[key].revenue += Number(order.total_amount || 0); acc[key].orders += 1; return acc; }, {})), [rows.orders]);
  const userData = useMemo(() => Object.values(rows.profiles.reduce<Record<string, { date: string; users: number; sellers: number }>>((acc, profile) => { const key = dayLabel(profile.created_at); acc[key] ||= { date: key, users: 0, sellers: 0 }; acc[key].users += 1; if (profile.role === "seller") acc[key].sellers += 1; return acc; }, {})), [rows.profiles]);
  const moderationData = useMemo(() => ["approved", "pending", "rejected"].map((status) => ({ name: status, value: rows.products.filter((p) => p.product_status === status).length })), [rows.products]);
  const distributionData = useMemo(() => orderStatuses.map((status) => ({ name: status, value: rows.orders.filter((o) => (o.status || "pending").toLowerCase() === status).length })).filter((item) => item.value > 0), [rows.orders]);
  const activities = useMemo(() => [
    ...rows.orders.map((row) => ({ kind: "order", text: `New order ${currency(Number(row.total_amount || 0))}`, time: row.created_at, status: row.status || "pending" })),
    ...rows.profiles.map((row) => ({ kind: row.role === "seller" ? "seller" : "user", text: row.role === "seller" ? "New seller registered" : "New user registered", time: row.created_at, status: row.role || "user" })),
    ...rows.products.map((row) => ({ kind: "product", text: `${row.name || "Product"} submitted`, time: row.created_at, status: row.product_status || "pending" })),
  ].sort((a, b) => new Date(b.time || 0).getTime() - new Date(a.time || 0).getTime()).slice(0, 8), [rows]);
  const cards = [{ label: "Total Revenue", value: currency(metrics.revenue), note: "Order value in selected period", icon: IndianRupee }, { label: "Total Orders", value: metrics.orders, note: "Orders created in selected period", icon: ShoppingCart }, { label: "Total Users", value: metrics.users, note: "Accounts registered in selected period", icon: Users }, { label: "Total Sellers", value: metrics.sellers, note: "Seller accounts registered", icon: Store }, { label: "Approved Products", value: metrics.approved, note: "Approved product submissions", icon: CheckCircle2 }, { label: "Pending Requests", value: metrics.pending, note: "Products awaiting review", icon: Clock3 }];

  return <AdminLayout><div className="space-y-6">
    <header className="flex flex-col gap-4 rounded-3xl border border-[#A68D65]/15 bg-white p-5 shadow-sm sm:flex-row sm:items-center sm:justify-between sm:p-7">
      <div><div className="mb-2 inline-flex items-center gap-2 rounded-full bg-[#E7E9DD] px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-[#33381C]"><Activity size={13} /> Marketplace intelligence</div><h1 className="font-serif text-3xl font-bold text-[#33381C]">Live Analytics</h1><p className="mt-1 text-sm text-neutral-500">Real-time insights into your marketplace performance.</p></div>
      <div className="flex items-center gap-3"><span className="inline-flex items-center gap-2 rounded-full bg-[#E5F0E3] px-3 py-2 text-xs font-bold tracking-wider text-[#3F6B4A]"><span className="relative flex h-2.5 w-2.5"><span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-70"/><span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500"/></span>LIVE</span><button onClick={fetchAnalytics} disabled={loading} className="inline-flex h-10 items-center gap-2 rounded-xl border border-[#33381C]/20 px-3 text-sm font-bold text-[#33381C] transition hover:bg-[#F7EEE4] disabled:opacity-50"><RefreshCw size={16} className={loading ? "animate-spin" : ""}/>Refresh</button></div>
    </header>
    <div className="flex flex-wrap gap-2">{ranges.map((item) => <button key={item.value} onClick={() => setRange(item.value)} className={`rounded-xl px-4 py-2 text-xs font-bold transition ${range === item.value ? "bg-[#33381C] text-white shadow-sm" : "border border-[#A68D65]/20 bg-white text-neutral-600 hover:bg-[#F7EEE4]"}`}>{item.label}</button>)}</div>
    {error ? <div className="rounded-3xl border border-rose-200 bg-rose-50 p-6 text-rose-800"><p className="font-semibold">Unable to load analytics</p><p className="mt-1 text-sm">{error}</p><button onClick={fetchAnalytics} className="mt-4 rounded-xl bg-[#A23F2E] px-4 py-2 text-sm font-bold text-white">Retry</button></div> : <>
      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">{loading ? Array.from({ length: 6 }).map((_, i) => <div key={i} className="h-36 animate-pulse rounded-3xl border border-[#A68D65]/15 bg-white"/>) : cards.map((card) => { const Icon = card.icon; return <article key={card.label} className="group rounded-3xl border border-[#A68D65]/15 bg-white p-5 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md"><div className="flex items-start justify-between"><div><p className="text-[10px] font-bold uppercase tracking-widest text-neutral-500">{card.label}</p><p className="mt-3 font-serif text-3xl font-bold text-[#33381C]">{card.value}</p><p className="mt-2 text-xs text-neutral-500">{card.note}</p></div><span className="rounded-2xl bg-[#F7EEE4] p-3 text-[#33381C] transition-colors group-hover:bg-[#33381C] group-hover:text-white"><Icon size={20}/></span></div></article>; })}</section>
      {!loading && rows.orders.length + rows.profiles.length + rows.products.length === 0 ? <div className="rounded-3xl border border-dashed border-[#A68D65]/35 bg-white py-16 text-center text-sm text-neutral-500">No analytics data available yet.</div> : <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
        <ChartShell title="Revenue Overview">{revenueData.length ? <ResponsiveContainer width="100%" height="100%"><LineChart data={revenueData}><CartesianGrid stroke="#EEE7DD" vertical={false}/><XAxis dataKey="date" tick={{ fontSize: 11 }}/><YAxis tick={{ fontSize: 11 }}/><Tooltip formatter={(value: number) => currency(value)}/><Line type="monotone" dataKey="revenue" stroke="#3F6B4A" strokeWidth={3} dot={false}/></LineChart></ResponsiveContainer> : <ChartEmpty/>}</ChartShell>
        <ChartShell title="Orders Overview">{revenueData.length ? <ResponsiveContainer width="100%" height="100%"><BarChart data={revenueData}><CartesianGrid stroke="#EEE7DD" vertical={false}/><XAxis dataKey="date" tick={{ fontSize: 11 }}/><YAxis allowDecimals={false} tick={{ fontSize: 11 }}/><Tooltip/><Bar dataKey="orders" fill="#A6701A" radius={[6,6,0,0]}/></BarChart></ResponsiveContainer> : <ChartEmpty/>}</ChartShell>
        <ChartShell title="Marketplace Users">{userData.length ? <ResponsiveContainer width="100%" height="100%"><LineChart data={userData}><CartesianGrid stroke="#EEE7DD" vertical={false}/><XAxis dataKey="date" tick={{ fontSize: 11 }}/><YAxis allowDecimals={false} tick={{ fontSize: 11 }}/><Tooltip/><Legend/><Line type="monotone" dataKey="users" stroke="#3F6B4A" strokeWidth={3}/><Line type="monotone" dataKey="sellers" stroke="#A6701A" strokeWidth={3}/></LineChart></ResponsiveContainer> : <ChartEmpty/>}</ChartShell>
        <ChartShell title="Product Moderation">{moderationData.some((item) => item.value) ? <ResponsiveContainer width="100%" height="100%"><BarChart data={moderationData}><CartesianGrid stroke="#EEE7DD" vertical={false}/><XAxis dataKey="name" tick={{ fontSize: 11 }}/><YAxis allowDecimals={false} tick={{ fontSize: 11 }}/><Tooltip/><Bar dataKey="value" radius={[6,6,0,0]}>{moderationData.map((_, index) => <Cell key={index} fill={statusColors[index]}/>)}</Bar></BarChart></ResponsiveContainer> : <ChartEmpty/>}</ChartShell>
        <ChartShell title="Order Status Distribution">{distributionData.length ? <ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={distributionData} dataKey="value" nameKey="name" innerRadius={52} outerRadius={85} paddingAngle={3}>{distributionData.map((_, index) => <Cell key={index} fill={statusColors[index % statusColors.length]}/>)}</Pie><Tooltip/><Legend wrapperStyle={{ fontSize: 11 }}/></PieChart></ResponsiveContainer> : <ChartEmpty/>}</ChartShell>
        <section className="rounded-3xl border border-[#A68D65]/15 bg-white p-5 shadow-sm"><h2 className="font-serif text-lg font-bold text-[#33381C]">Recent Activity</h2><div className="mt-4 divide-y divide-[#A68D65]/10">{activities.length ? activities.map((item, index) => <div key={`${item.kind}-${item.time}-${index}`} className="flex items-center gap-3 py-3"><span className="rounded-xl bg-[#F7EEE4] p-2 text-[#33381C]"><BarChart3 size={15}/></span><div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold text-[#33381C]">{item.text}</p><p className="mt-0.5 text-xs text-neutral-500">{item.time ? new Date(item.time).toLocaleString("en-IN") : "Time unavailable"}</p></div><span className="rounded-full bg-[#E7E9DD] px-2 py-1 text-[10px] font-bold capitalize text-[#33381C]">{item.status}</span></div>) : <p className="py-16 text-center text-sm text-neutral-500">No recent activity available yet.</p>}</div></section>
      </div>}</>}
  </div></AdminLayout>;
}
