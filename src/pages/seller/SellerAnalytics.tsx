import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import {
  Activity,
  AlertTriangle,
  BarChart3,
  CheckCircle2,
  Clock3,
  IndianRupee,
  Package,
  RefreshCw,
  ShoppingCart,
  Truck,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Link } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { useAuth } from "@/context/AuthContext";
import SellerLayout from "@/layouts/SellerLayout";
import { supabase } from "@/lib/supabaseClient";

type DateRange = 7 | 30 | 90;
type ProductRow = Record<string, unknown> & {
  id: string | number;
  name?: string | null;
};
type OrderItemRow = Record<string, unknown> & {
  id?: string | null;
  order_id?: string | null;
  product_id?: string | number | null;
  variant_id?: string | null;
  seller_id?: string | null;
  product_name?: string | null;
  quantity?: number | string | null;
  price?: number | string | null;
  discount?: number | string | null;
  created_at?: string | null;
  updated_at?: string | null;
  order_status?: string | null;
  status?: string | null;
  payment_status?: string | null;
  payment_method?: string | null;
  tracking_number?: string | null;
};

interface ProductMetric {
  id: string;
  name: string;
  status: string;
  stock: number;
  reorderPoint: number;
  unitsSold: number;
  revenue: number;
  isActive: boolean;
  createdAt: string | null;
  updatedAt: string | null;
}

interface SellerOrderMetric {
  id: string;
  status: string;
  paymentStatus: string;
  createdAt: string | null;
  updatedAt: string | null;
  itemCount: number;
  units: number;
  revenue: number;
  productNames: string[];
}

interface AnalyticsData {
  products: ProductMetric[];
  orders: SellerOrderMetric[];
}

const STATUS_COLORS: Record<string, string> = {
  pending: "#A6701A",
  confirmed: "#6488A7",
  processing: "#7F8E57",
  shipped: "#4B7651",
  in_transit: "#6A9A8E",
  out_for_delivery: "#5D8AAB",
  delivered: "#3F6B4A",
  cancelled: "#A23F2E",
  returned: "#92696A",
  refunded: "#8B5E83",
};

const EXCLUDED_ORDER_STATUSES = new Set([
  "cancelled",
  "refunded",
  "returned",
]);
const EXCLUDED_PAYMENT_STATUSES = new Set([
  "failed",
  "refund_processing",
  "refunded",
]);
const LOW_STOCK_FALLBACK = 10;

const currency = (value: number) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(value);

const numberValue = (value: unknown) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const normalizeStatus = (value: unknown) =>
  String(value || "pending")
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_");

const formatStatus = (value: string) =>
  value.replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());

const dateKey = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;

const formatDay = (value: string) =>
  new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "short",
  }).format(new Date(`${value}T12:00:00`));

const formatTimestamp = (value: string | null) =>
  value
    ? new Date(value).toLocaleString("en-IN", {
        day: "numeric",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "Time unavailable";

const isSchemaColumnError = (error: { code?: string; message?: string }) =>
  error.code === "42703" ||
  error.code === "PGRST204" ||
  error.message?.toLowerCase().includes("seller_id") === true;

async function fetchSellerProducts(sellerId: string) {
  const directResult = await supabase
    .from("products")
    .select("*")
    .eq("seller_id", sellerId)
    .order("name", { ascending: true });

  if (directResult.error && !isSchemaColumnError(directResult.error)) {
    throw directResult.error;
  }

  const { data: stores, error: storesError } = await supabase
    .from("stores")
    .select("id")
    .eq("seller_id", sellerId);

  if (storesError) throw storesError;
  const storeIds = (stores || []).map((store) => store.id as string);
  if (!storeIds.length) {
    return {
      rows: (directResult.data || []) as ProductRow[],
      realtimeFilters: directResult.error ? [] : [`seller_id=eq.${sellerId}`],
    };
  }

  const { data: storeProducts, error: storeProductsError } = await supabase
    .from("products")
    .select("*")
    .in("store_id", storeIds)
    .order("name", { ascending: true });

  if (storeProductsError) throw storeProductsError;
  const productById = new Map<string, ProductRow>();
  for (const product of [
    ...(directResult.data || []),
    ...(storeProducts || []),
  ] as ProductRow[]) {
    productById.set(String(product.id), product);
  }
  return {
    rows: [...productById.values()],
    realtimeFilters: [
      ...(directResult.error ? [] : [`seller_id=eq.${sellerId}`]),
      ...storeIds.map((storeId) => `store_id=eq.${storeId}`),
    ],
  };
}

function isRevenueEligible(order: SellerOrderMetric) {
  return (
    !EXCLUDED_ORDER_STATUSES.has(order.status) &&
    !EXCLUDED_PAYMENT_STATUSES.has(order.paymentStatus) &&
    ["paid", "captured"].includes(order.paymentStatus)
  );
}

function isUnitSaleEligible(order: SellerOrderMetric) {
  return (
    !EXCLUDED_ORDER_STATUSES.has(order.status) &&
    !["failed", "refunded", "refund_processing"].includes(order.paymentStatus)
  );
}

function MetricCard({
  label,
  value,
  note,
  icon: Icon,
  loading,
}: {
  label: string;
  value: string | number;
  note: string;
  icon: typeof Activity;
  loading: boolean;
}) {
  return (
    <article className="group rounded-3xl border border-[#A68D65]/15 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[10px] font-bold uppercase tracking-widest text-neutral-500">
            {label}
          </p>
          {loading ? (
            <div className="mt-3 h-8 w-20 animate-pulse rounded bg-[#F7EEE4]" />
          ) : (
            <p className="mt-3 font-serif text-3xl font-bold text-[#33381C]">
              {value}
            </p>
          )}
          <p className="mt-2 text-xs text-neutral-500">{note}</p>
        </div>
        <span className="rounded-2xl bg-[#F7EEE4] p-3 text-[#33381C] transition-colors group-hover:bg-[#33381C] group-hover:text-white">
          <Icon size={20} />
        </span>
      </div>
    </article>
  );
}

function ChartCard({
  title,
  children,
  contentClassName = "mt-5 h-64 min-w-0",
}: {
  title: string;
  children: ReactNode;
  contentClassName?: string;
}) {
  return (
    <section className="min-w-0 rounded-3xl border border-[#A68D65]/15 bg-white p-5 shadow-sm">
      <h2 className="font-serif text-lg font-bold text-[#33381C]">{title}</h2>
      <div className={contentClassName}>{children}</div>
    </section>
  );
}

function ChartEmpty({ message = "No sales data in this date range." }) {
  return (
    <div className="flex h-full items-center justify-center px-4 text-center text-sm text-neutral-500">
      {message}
    </div>
  );
}

export default function SellerAnalytics() {
  const { user } = useAuth();
  const [range, setRange] = useState<DateRange>(30);
  const [data, setData] = useState<AnalyticsData>({
    products: [],
    orders: [],
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<"unitsSold" | "revenue">("revenue");
  const [realtime, setRealtime] = useState(false);
  const [productRealtimeFilters, setProductRealtimeFilters] = useState<
    string[]
  >([]);
  const requestIdRef = useRef(0);
  const refreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchAnalytics = useCallback(async () => {
    if (!user?.id) {
      setData({ products: [], orders: [] });
      setLoading(false);
      setError(null);
      return;
    }

    const requestId = ++requestIdRef.current;
    setLoading(true);
    setError(null);

    try {
      const [{ rows: products, realtimeFilters }, itemsResult] =
        await Promise.all([
          fetchSellerProducts(user.id),
          supabase.rpc("get_seller_order_items_v2"),
        ]);

      if (itemsResult.error) throw itemsResult.error;

      const rawItems = (itemsResult.data || []) as OrderItemRow[];
      const productById = new Map(
        products.map((product) => [String(product.id), product]),
      );
      const ownedProductIds = new Set(productById.keys());

      const productIdsMissingDirectStock = products
        .filter((product) => product.stock == null)
        .map((product) => String(product.id));
      const variantToProduct = new Map<string, string>();
      const calculatedStock = new Map<
        string,
        { stock: number; reorderPoint: number }
      >();

      if (productIdsMissingDirectStock.length) {
        const { data: variants, error: variantsError } = await supabase
          .from("product_variants")
          .select(
            "id,product_id,is_active,inventory(quantity_on_hand,quantity_reserved,reorder_point)",
          )
          .in("product_id", productIdsMissingDirectStock)
          .eq("is_active", true);

        if (variantsError) throw variantsError;

        for (const variant of variants || []) {
          const productId = String(variant.product_id);
          const variantId = String(variant.id);
          variantToProduct.set(variantId, productId);

          const inventoryRows = Array.isArray(variant.inventory)
            ? variant.inventory
            : variant.inventory
              ? [variant.inventory]
              : [];
          const available = inventoryRows.reduce(
            (sum, inventory) =>
              sum +
              Math.max(
                0,
                numberValue(inventory.quantity_on_hand) -
                  numberValue(inventory.quantity_reserved),
              ),
            0,
          );
          const variantReorderPoint =
            inventoryRows.reduce(
              (sum, inventory) => sum + numberValue(inventory.reorder_point),
              0,
            ) || LOW_STOCK_FALLBACK;
          const previous = calculatedStock.get(productId);
          calculatedStock.set(productId, {
            stock: (previous?.stock || 0) + available,
            reorderPoint:
              (previous?.reorderPoint || 0) + variantReorderPoint,
          });
        }
      }

      const seenItemIds = new Set<string>();
      const ownedItems = rawItems.filter((item) => {
        if (item.id && seenItemIds.has(item.id)) return false;
        if (item.id) seenItemIds.add(item.id);
        const productId =
          item.product_id != null
            ? String(item.product_id)
            : item.variant_id
              ? variantToProduct.get(item.variant_id)
              : undefined;
        return (
          productId !== undefined &&
          ownedProductIds.has(productId) &&
          (!item.seller_id || item.seller_id === user.id)
        );
      });

      const groupedOrders = new Map<string, SellerOrderMetric>();
      for (const item of ownedItems) {
        if (!item.order_id) continue;
        const productId =
          item.product_id != null
            ? String(item.product_id)
            : item.variant_id
              ? variantToProduct.get(item.variant_id)
              : undefined;
        const product = productId ? productById.get(productId) : undefined;
        if (!productId || !product) continue;

        const status = normalizeStatus(item.order_status || item.status);
        const paymentStatus = normalizeStatus(item.payment_status);
        const order =
          groupedOrders.get(item.order_id) ||
          ({
            id: item.order_id,
            status,
            paymentStatus,
            createdAt: item.created_at || null,
            updatedAt: item.updated_at || null,
            itemCount: 0,
            units: 0,
            revenue: 0,
            productNames: [],
          } satisfies SellerOrderMetric);

        const quantity = Math.max(0, numberValue(item.quantity));
        const lineAmount = Math.max(
          0,
          numberValue(item.price) * quantity - numberValue(item.discount),
        );
        order.itemCount += 1;
        order.units += quantity;
        order.productNames.push(
          String(item.product_name || product.name || "Product"),
        );
        order.revenue += lineAmount;
        if (!order.createdAt && item.created_at) order.createdAt = item.created_at;
        if (item.updated_at) order.updatedAt = item.updated_at;
        if (item.order_status || item.status) {
          order.status = normalizeStatus(item.order_status || item.status);
        }
        if (item.payment_status) {
          order.paymentStatus = normalizeStatus(item.payment_status);
        }
        groupedOrders.set(item.order_id, order);
      }

      const orders = [...groupedOrders.values()].sort(
        (a, b) =>
          new Date(b.createdAt || 0).getTime() -
          new Date(a.createdAt || 0).getTime(),
      );

      const itemMetrics = new Map<
        string,
        { unitsSold: number; revenue: number }
      >();
      for (const item of ownedItems) {
        if (!item.order_id) continue;
        const order = groupedOrders.get(item.order_id);
        const productId =
          item.product_id != null
            ? String(item.product_id)
            : item.variant_id
              ? variantToProduct.get(item.variant_id)
              : undefined;
        if (!order || !productId) continue;

        const metric = itemMetrics.get(productId) || {
          unitsSold: 0,
          revenue: 0,
        };
        const quantity = Math.max(0, numberValue(item.quantity));
        if (isUnitSaleEligible(order)) metric.unitsSold += quantity;
        if (isRevenueEligible(order)) {
          metric.revenue += Math.max(
            0,
            numberValue(item.price) * quantity - numberValue(item.discount),
          );
        }
        itemMetrics.set(productId, metric);
      }

      const productMetrics = products.map((product) => {
        const id = String(product.id);
        const sales = itemMetrics.get(id) || { unitsSold: 0, revenue: 0 };
        const calculated = calculatedStock.get(id);
        const stock = Math.max(
          0,
          numberValue(product.stock ?? calculated?.stock ?? 0),
        );
        const status = normalizeStatus(
          product.product_status || product.status || "pending",
        );
        return {
          id,
          name: String(product.name || "Unnamed product"),
          status,
          stock,
          reorderPoint:
            numberValue(calculated?.reorderPoint) || LOW_STOCK_FALLBACK,
          unitsSold: sales.unitsSold,
          revenue: sales.revenue,
          isActive:
            status === "approved" &&
            product.is_hidden !== true &&
            product.is_active !== false,
          createdAt:
            typeof product.created_at === "string"
              ? product.created_at
              : null,
          updatedAt:
            typeof product.updated_at === "string"
              ? product.updated_at
              : null,
        };
      });

      if (requestId === requestIdRef.current) {
        setData({ products: productMetrics, orders });
        setProductRealtimeFilters((current) =>
          current.join("|") === realtimeFilters.join("|")
            ? current
            : realtimeFilters,
        );
      }
    } catch (fetchError) {
      console.error("[SellerAnalytics] Failed to load analytics:", fetchError);
      if (requestId === requestIdRef.current) {
        setError(
          fetchError instanceof Error
            ? fetchError.message
            : "Unable to load seller analytics.",
        );
      }
    } finally {
      if (requestId === requestIdRef.current) setLoading(false);
    }
  }, [user?.id]);

  const scheduleRefresh = useCallback(() => {
    if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
    refreshTimerRef.current = setTimeout(() => {
      void fetchAnalytics();
    }, 300);
  }, [fetchAnalytics]);

  useEffect(() => {
    void fetchAnalytics();
    if (!user?.id) return;

    const channels = [
      supabase
        .channel(`seller-analytics-items-${user.id}`)
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "order_items" },
          scheduleRefresh,
        ),
      supabase
        .channel(`seller-analytics-orders-${user.id}`)
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "orders" },
          scheduleRefresh,
        ),
      supabase
        .channel(`seller-analytics-inventory-${user.id}`)
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "inventory" },
          scheduleRefresh,
        ),
      supabase
        .channel(`seller-analytics-stores-${user.id}`)
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "stores",
            filter: `seller_id=eq.${user.id}`,
          },
          scheduleRefresh,
        ),
      ...productRealtimeFilters.map((filter, index) =>
        supabase
          .channel(`seller-analytics-products-${user.id}-${index}`)
          .on(
            "postgres_changes",
            {
              event: "*",
              schema: "public",
              table: "products",
              filter,
            },
            scheduleRefresh,
          ),
      ),
    ];

    const subscriptionStates = new Map<string, boolean>();
    for (const channel of channels) {
      channel.subscribe((status) => {
        subscriptionStates.set(channel.topic, status === "SUBSCRIBED");
        setRealtime(
          subscriptionStates.size === channels.length &&
            [...subscriptionStates.values()].every(Boolean),
        );
      });
    }

    return () => {
      if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
      for (const channel of channels) void supabase.removeChannel(channel);
    };
  }, [
    fetchAnalytics,
    productRealtimeFilters,
    scheduleRefresh,
    user?.id,
  ]);

  const activeProducts = useMemo(
    () => data.products.filter((product) => product.isActive),
    [data.products],
  );
  const lowStockProducts = useMemo(
    () =>
      activeProducts.filter(
        (product) => product.stock > 0 && product.stock <= product.reorderPoint,
      ),
    [activeProducts],
  );
  const outOfStockProducts = useMemo(
    () => activeProducts.filter((product) => product.stock <= 0),
    [activeProducts],
  );

  const rangeStart = useMemo(() => {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    start.setDate(start.getDate() - (range - 1));
    return start;
  }, [range]);

  const rangedOrders = useMemo(
    () =>
      data.orders.filter(
        (order) =>
          order.createdAt &&
          new Date(order.createdAt).getTime() >= rangeStart.getTime(),
      ),
    [data.orders, rangeStart],
  );

  const revenueData = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const dayRows = new Map<
      string,
      { day: string; revenue: number; orders: number }
    >();

    for (let offset = range - 1; offset >= 0; offset -= 1) {
      const day = new Date(today);
      day.setDate(today.getDate() - offset);
      const key = dateKey(day);
      dayRows.set(key, { day: key, revenue: 0, orders: 0 });
    }

    for (const order of rangedOrders) {
      if (!order.createdAt) continue;
      const key = dateKey(new Date(order.createdAt));
      const row = dayRows.get(key);
      if (!row) continue;
      row.orders += 1;
      if (isRevenueEligible(order)) row.revenue += order.revenue;
    }
    return [...dayRows.values()];
  }, [range, rangedOrders]);

  const statusData = useMemo(() => {
    const counts = new Map<string, number>();
    for (const order of rangedOrders) {
      counts.set(order.status, (counts.get(order.status) || 0) + 1);
    }
    return [...counts.entries()]
      .map(([status, count]) => ({
        status: formatStatus(status),
        value: count,
        color: STATUS_COLORS[status] || "#7F8E57",
      }))
      .sort((a, b) => b.value - a.value);
  }, [rangedOrders]);

  const summary = useMemo(() => {
    const counts = new Map<string, number>();
    for (const order of data.orders) {
      counts.set(order.status, (counts.get(order.status) || 0) + 1);
    }
    const revenue = rangedOrders.reduce(
      (sum, order) => sum + (isRevenueEligible(order) ? order.revenue : 0),
      0,
    );
    return {
      revenue,
      orderCount: data.orders.length,
      pending: counts.get("pending") || 0,
      confirmed: counts.get("confirmed") || 0,
      shipped:
        (counts.get("shipped") || 0) +
        (counts.get("in_transit") || 0) +
        (counts.get("out_for_delivery") || 0),
      delivered: counts.get("delivered") || 0,
    };
  }, [data.orders, rangedOrders]);

  const sortedProducts = useMemo(
    () =>
      [...data.products].sort((a, b) =>
        sortBy === "unitsSold"
          ? b.unitsSold - a.unitsSold || b.revenue - a.revenue
          : b.revenue - a.revenue || b.unitsSold - a.unitsSold,
      ),
    [data.products, sortBy],
  );

  const recentOrders = data.orders.slice(0, 8);
  const inventoryAlerts = useMemo(
    () =>
      [
        ...lowStockProducts.map((product) => ({
          id: `low-stock-${product.id}`,
          title: `${product.name} is running low`,
          detail: `${product.stock} available · reorder point ${product.reorderPoint}`,
          href: "/seller/products",
          icon: AlertTriangle,
        })),
        ...outOfStockProducts.map((product) => ({
          id: `out-of-stock-${product.id}`,
          title: `${product.name} is out of stock`,
          detail: "No available units",
          href: "/seller/products",
          icon: AlertTriangle,
        })),
      ]
        .slice(0, 8),
    [lowStockProducts, outOfStockProducts],
  );

  const cards = [
    {
      label: "Total Revenue",
      value: currency(summary.revenue),
      note: `Paid seller item sales · last ${range} days`,
      icon: IndianRupee,
    },
    {
      label: "Total Orders",
      value: summary.orderCount,
      note: "Unique orders containing your products",
      icon: ShoppingCart,
    },
    {
      label: "Pending Orders",
      value: summary.pending,
      note: "Current order status",
      icon: Clock3,
    },
    {
      label: "Confirmed Orders",
      value: summary.confirmed,
      note: "Current order status",
      icon: CheckCircle2,
    },
    {
      label: "Shipped Orders",
      value: summary.shipped,
      note: "Includes in-transit and out-for-delivery",
      icon: Truck,
    },
    {
      label: "Delivered Orders",
      value: summary.delivered,
      note: "Current order status",
      icon: Package,
    },
    {
      label: "Products Listed",
      value: activeProducts.length,
      note: "Approved, visible seller products",
      icon: Package,
    },
    {
      label: "Low-Stock Products",
      value: lowStockProducts.length,
      note: `At or below reorder point (${LOW_STOCK_FALLBACK} default)`,
      icon: AlertTriangle,
    },
  ];

  return (
    <SellerLayout>
      <div className="space-y-6">
        <header className="flex flex-col gap-4 rounded-3xl border border-[#A68D65]/15 bg-white p-5 shadow-sm sm:flex-row sm:items-center sm:justify-between sm:p-7">
          <div>
            <div className="mb-2 inline-flex items-center gap-2 rounded-full bg-[#E7E9DD] px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-[#33381C]">
              <Activity size={13} /> Live seller analytics
            </div>
            <h1 className="font-serif text-3xl font-bold text-[#33381C]">
              Seller Workspace
            </h1>
            <p className="mt-1 text-sm text-neutral-500">
              Live sales, order, product, and inventory insights for your store.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <span
              className={`inline-flex items-center gap-2 rounded-full px-3 py-2 text-xs font-bold tracking-wider ${
                realtime
                  ? "bg-[#E5F0E3] text-[#3F6B4A]"
                  : "bg-neutral-100 text-neutral-500"
              }`}
            >
              <span
                className={`h-2 w-2 rounded-full ${
                  realtime ? "animate-pulse bg-emerald-500" : "bg-neutral-400"
                }`}
              />
              {realtime ? "LIVE" : "REFRESH"}
            </span>
            <Button
              type="button"
              variant="outline"
              onClick={() => void fetchAnalytics()}
              disabled={loading}
              className="h-10 gap-2 rounded-xl border-[#33381C]/20 text-[#33381C] hover:bg-[#F7EEE4]"
            >
              <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
              Refresh
            </Button>
          </div>
        </header>

        <div className="flex flex-wrap gap-2" aria-label="Analytics date range">
          {([7, 30, 90] as const).map((days) => (
            <button
              key={days}
              type="button"
              onClick={() => setRange(days)}
              aria-pressed={range === days}
              className={`rounded-xl px-4 py-2 text-xs font-bold transition ${
                range === days
                  ? "bg-[#33381C] text-white shadow-sm"
                  : "border border-[#A68D65]/20 bg-white text-neutral-600 hover:bg-[#F7EEE4]"
              }`}
            >
              Last {days} days
            </button>
          ))}
        </div>

        {error ? (
          <div
            role="alert"
            className="rounded-3xl border border-rose-200 bg-rose-50 p-6 text-rose-800"
          >
            <p className="font-semibold">Unable to load seller analytics</p>
            <p className="mt-1 text-sm">{error}</p>
            <Button
              type="button"
              onClick={() => void fetchAnalytics()}
              className="mt-4 rounded-xl bg-[#A23F2E] text-white hover:bg-[#8D3426]"
            >
              Retry
            </Button>
          </div>
        ) : (
          <>
            <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {cards.map((card) => (
                <MetricCard
                  key={card.label}
                  {...card}
                  loading={loading}
                />
              ))}
            </section>

            {!loading &&
            data.orders.length === 0 &&
            activeProducts.length === 0 ? (
              <div className="rounded-3xl border border-dashed border-[#A68D65]/35 bg-white px-6 py-16 text-center">
                <Package className="mx-auto h-10 w-10 text-[#A68D65]" />
                <h2 className="mt-4 font-serif text-xl font-bold text-[#33381C]">
                  Your analytics will appear here
                </h2>
                <p className="mx-auto mt-2 max-w-lg text-sm text-neutral-500">
                  Add products to your store to start tracking inventory and
                  sales performance.
                </p>
                <Button
                  asChild
                  className="mt-5 rounded-xl bg-[#33381C] hover:bg-[#4D5528]"
                >
                  <Link to="/seller/add-product">Add a product</Link>
                </Button>
              </div>
            ) : (
              <>
                {!loading && data.orders.length === 0 && (
                  <div className="rounded-2xl border border-dashed border-[#A68D65]/35 bg-white p-5 text-sm text-neutral-600">
                    No seller orders or sales yet. Your sales charts, product
                    performance, and order activity will populate when a
                    customer places an order containing your products.
                  </div>
                )}
                <div className="grid min-w-0 grid-cols-1 gap-5 xl:grid-cols-2">
                <ChartCard title="Revenue Overview">
                  {revenueData.some((row) => row.revenue > 0) ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={revenueData}>
                        <CartesianGrid
                          stroke="#EEE7DD"
                          vertical={false}
                        />
                        <XAxis
                          dataKey="day"
                          tickFormatter={formatDay}
                          minTickGap={20}
                          tick={{ fontSize: 11 }}
                        />
                        <YAxis
                          tickFormatter={(value: number) => currency(value)}
                          width={76}
                          tick={{ fontSize: 10 }}
                        />
                        <Tooltip
                          labelFormatter={(value) => formatDay(String(value))}
                          formatter={(value: number) => [
                            currency(value),
                            "Revenue",
                          ]}
                        />
                        <Line
                          type="monotone"
                          dataKey="revenue"
                          name="Revenue"
                          stroke="#3F6B4A"
                          strokeWidth={3}
                          dot={false}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  ) : (
                    <ChartEmpty message="No paid sales in this date range." />
                  )}
                </ChartCard>

                <ChartCard title="Orders Over Time">
                  {revenueData.some((row) => row.orders > 0) ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={revenueData}>
                        <CartesianGrid
                          stroke="#EEE7DD"
                          vertical={false}
                        />
                        <XAxis
                          dataKey="day"
                          tickFormatter={formatDay}
                          minTickGap={20}
                          tick={{ fontSize: 11 }}
                        />
                        <YAxis
                          allowDecimals={false}
                          tick={{ fontSize: 11 }}
                        />
                        <Tooltip
                          labelFormatter={(value) => formatDay(String(value))}
                        />
                        <Bar
                          dataKey="orders"
                          name="Orders"
                          fill="#A6701A"
                          radius={[6, 6, 0, 0]}
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <ChartEmpty />
                  )}
                </ChartCard>

                <ChartCard title="Order Status Distribution">
                  {statusData.length ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={statusData}
                          dataKey="value"
                          nameKey="status"
                          innerRadius={55}
                          outerRadius={88}
                          paddingAngle={3}
                        >
                          {statusData.map((status) => (
                            <Cell key={status.status} fill={status.color} />
                          ))}
                        </Pie>
                        <Tooltip />
                      </PieChart>
                    </ResponsiveContainer>
                  ) : (
                    <ChartEmpty />
                  )}
                </ChartCard>

                <ChartCard title="Inventory Insights">
                  <div className="grid h-full grid-cols-2 gap-3">
                    {[
                      {
                        label: "Active products",
                        value: activeProducts.length,
                        color: "text-[#33381C]",
                      },
                      {
                        label: "Low stock",
                        value: lowStockProducts.length,
                        color: "text-amber-700",
                      },
                      {
                        label: "Out of stock",
                        value: outOfStockProducts.length,
                        color: "text-rose-700",
                      },
                      {
                        label: "Best seller",
                        value:
                          [...data.products].sort(
                            (a, b) => b.unitsSold - a.unitsSold,
                          )[0]?.name || "No sales yet",
                        color: "text-emerald-700",
                      },
                    ].map((item) => (
                      <div
                        key={item.label}
                        className="flex min-w-0 flex-col justify-center rounded-2xl bg-[#F8F4EC] p-4"
                      >
                        <p className="text-xs font-semibold text-neutral-500">
                          {item.label}
                        </p>
                        <p
                          className={`mt-2 break-words font-serif text-2xl font-bold ${item.color}`}
                        >
                          {item.value}
                        </p>
                      </div>
                    ))}
                  </div>
                </ChartCard>

                <section className="min-w-0 overflow-hidden rounded-3xl border border-[#A68D65]/15 bg-white p-5 shadow-sm xl:col-span-2">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <h2 className="font-serif text-lg font-bold text-[#33381C]">
                        Product Performance
                      </h2>
                      <p className="mt-1 text-xs text-neutral-500">
                        Sales and inventory for your products only.
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-neutral-500">Sort by</span>
                      {(
                        [
                          ["revenue", "Revenue"],
                          ["unitsSold", "Units sold"],
                        ] as const
                      ).map(([value, label]) => (
                        <button
                          key={value}
                          type="button"
                          onClick={() => setSortBy(value)}
                          aria-pressed={sortBy === value}
                          className={`rounded-lg px-3 py-2 text-xs font-semibold ${
                            sortBy === value
                              ? "bg-[#33381C] text-white"
                              : "border border-[#A68D65]/20 text-neutral-600 hover:bg-[#F7EEE4]"
                          }`}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="mt-4 overflow-x-auto">
                    <table className="w-full min-w-[650px] text-left text-sm">
                      <thead>
                        <tr className="border-b border-[#A68D65]/15 text-[10px] uppercase tracking-widest text-neutral-500">
                          <th className="px-3 py-3 font-bold">Product</th>
                          <th className="px-3 py-3 font-bold">Units sold</th>
                          <th className="px-3 py-3 font-bold">Revenue</th>
                          <th className="px-3 py-3 font-bold">Stock</th>
                          <th className="px-3 py-3 font-bold">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#A68D65]/10">
                        {loading ? (
                          <tr>
                            <td
                              colSpan={5}
                              className="px-3 py-12 text-center text-neutral-500"
                            >
                              Loading product performance…
                            </td>
                          </tr>
                        ) : sortedProducts.length ? (
                          sortedProducts.map((product) => (
                            <tr key={product.id} className="hover:bg-[#FBF9F4]">
                              <td className="px-3 py-3">
                                <Link
                                  to="/seller/products"
                                  className="font-semibold text-[#33381C] hover:underline"
                                >
                                  {product.name}
                                </Link>
                              </td>
                              <td className="px-3 py-3 text-neutral-700">
                                {product.unitsSold}
                              </td>
                              <td className="px-3 py-3 font-semibold text-[#33381C]">
                                {currency(product.revenue)}
                              </td>
                              <td
                                className={`px-3 py-3 ${
                                  product.stock <= 0
                                    ? "font-semibold text-rose-700"
                                    : product.stock <= product.reorderPoint
                                      ? "font-semibold text-amber-700"
                                      : "text-neutral-700"
                                }`}
                              >
                                {product.stock}
                              </td>
                              <td className="px-3 py-3">
                                <span className="rounded-full bg-[#E7E9DD] px-2.5 py-1 text-[10px] font-bold capitalize text-[#33381C]">
                                  {formatStatus(product.status)}
                                </span>
                              </td>
                            </tr>
                          ))
                        ) : (
                          <tr>
                            <td
                              colSpan={5}
                              className="px-3 py-12 text-center text-neutral-500"
                            >
                              No products have been listed yet.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </section>

                <ChartCard
                  title="Recent Orders"
                  contentClassName="mt-4 max-h-72 min-w-0 overflow-y-auto overscroll-contain"
                >
                  {loading ? (
                    <div className="space-y-3">
                      {Array.from({ length: 4 }).map((_, index) => (
                        <div
                          key={index}
                          className="h-12 animate-pulse rounded-xl bg-[#F7EEE4]"
                        />
                      ))}
                    </div>
                  ) : recentOrders.length ? (
                    <div className="divide-y divide-[#A68D65]/10">
                      {recentOrders.map((order) => (
                        <Link
                          key={order.id}
                          to="/seller/orders"
                          className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0"
                        >
                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold text-[#33381C]">
                              Order #{order.id.slice(0, 8)}
                            </p>
                            <p className="mt-1 truncate text-xs text-neutral-500">
                              {order.productNames.slice(0, 2).join(", ")}
                              {order.productNames.length > 2 ? "…" : ""}
                            </p>
                          </div>
                          <div className="shrink-0 text-right">
                            <span className="rounded-full bg-[#E7E9DD] px-2 py-1 text-[10px] font-bold capitalize text-[#33381C]">
                              {formatStatus(order.status)}
                            </span>
                            <p className="mt-1 text-xs text-neutral-500">
                              {formatTimestamp(order.createdAt)}
                            </p>
                          </div>
                        </Link>
                      ))}
                    </div>
                  ) : (
                    <ChartEmpty message="No orders containing your products yet." />
                  )}
                </ChartCard>

                <ChartCard
                  title="Inventory Alerts"
                  contentClassName="mt-4 max-h-72 min-w-0 overflow-y-auto overscroll-contain"
                >
                  {loading ? (
                    <div className="space-y-3">
                      {Array.from({ length: 4 }).map((_, index) => (
                        <div
                          key={index}
                          className="h-12 animate-pulse rounded-xl bg-[#F7EEE4]"
                        />
                      ))}
                    </div>
                  ) : inventoryAlerts.length ? (
                    <div className="divide-y divide-[#A68D65]/10">
                      {inventoryAlerts.map((item) => {
                        const Icon = item.icon;
                        return (
                          <Link
                            key={item.id}
                            to={item.href}
                            className="flex items-center gap-3 py-3 first:pt-0 last:pb-0"
                          >
                            <span className="rounded-xl bg-[#F7EEE4] p-2 text-[#33381C]">
                              <Icon size={15} />
                            </span>
                            <span className="min-w-0 flex-1">
                              <span className="block truncate text-sm font-semibold text-[#33381C]">
                                {item.title}
                              </span>
                              <span className="mt-0.5 block truncate text-xs text-neutral-500">
                                {item.detail}
                              </span>
                            </span>
                            <BarChart3
                              size={15}
                              className="shrink-0 text-neutral-400"
                            />
                          </Link>
                        );
                      })}
                    </div>
                  ) : (
                    <ChartEmpty message="No low-stock or out-of-stock products." />
                  )}
                </ChartCard>
                </div>
              </>
            )}
          </>
        )}
      </div>
    </SellerLayout>
  );
}
