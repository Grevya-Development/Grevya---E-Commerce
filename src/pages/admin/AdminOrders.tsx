import { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  ChevronRight,
  CircleDollarSign,
  Download,
  History,
  Mail,
  MapPin,
  Package,
  PackagePlus,
  Phone,
  RefreshCw,
  Search,
  Truck,
  X,
} from "lucide-react";
import AdminLayout from "@/layouts/AdminLayout";
import { supabase } from "@/lib/supabaseClient";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { formatOrderDate } from "@/lib/dateFormat";
import {
  getValidOrderStatuses,
  getValidPaymentStatuses,
  ORDER_STATUS_LABELS,
  PAYMENT_STATUS_LABELS,
  isTrackingNumberRequired,
  isValidPaymentTransition,
  getOrderStatusDescription,
  type OrderStatus,
  type PaymentStatus,
  type OrderStatusHistoryEntry,
} from "@/lib/orderStateMachine";
import { updateOrderStatus, getOrderWithHistory } from "@/lib/orderService";

/* -------------------------------------------------------------------------- */
/*  Types                                                                      */
/* -------------------------------------------------------------------------- */

interface Order {
  id: string;
  user_id?: string | null;
  total_amount?: number | null;
  order_status?: string | null;
  payment_status?: string | null;
  tracking_number?: string | null;
  estimated_delivery?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  shipping_address?: any;
  payment_method?: string | null;
  transaction_reference?: string | null;
  internal_notes?: string | null;
  history?: OrderStatusHistoryEntry[];
}

interface Profile {
  id: string;
  username?: string | null;
  full_name?: string | null;
  email?: string | null;
  phone?: string | null;
}

interface OrderItem {
  id: string;
  product_id?: string | null;
  product_name?: string | null;
  product_image?: string | null;
  quantity?: number | null;
  price?: number | null;
}

/* -------------------------------------------------------------------------- */
/*  Helpers                                                                    */
/* -------------------------------------------------------------------------- */

const formatCurrency = (value?: number | null) =>
  `₹${Number(value || 0).toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

const formatDateInputValue = (value?: string | null) => {
  if (!value) return "";
  if (/^\d{4}-\d{2}-\d{2}/.test(value)) return value.slice(0, 10);

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : date.toISOString().slice(0, 10);
};

const formatStatus = (value?: string | null) =>
  (value || "pending").replace(/_/g, " ");

const normalizeStatus = (value?: string | null) =>
  (value || "pending").toLowerCase().replace(/[\s-]+/g, "_");

const FULFILLMENT_STATUSES = [
  "processing",
  "shipped",
  "in_transit",
  "out_for_delivery",
];

const formatPaymentMethod = (value?: string | null) => {
  if (!value) return "Payment method unavailable";
  if (value.toLowerCase() === "cod") return "Cash on delivery";
  const text = value.replace(/_/g, " ");
  return text.charAt(0).toUpperCase() + text.slice(1);
};

const csvCell = (value: string | number | null | undefined) =>
  `"${String(value ?? "").replace(/"/g, '""')}"`;

type Tone = "success" | "info" | "danger" | "warn";

const TONES: Record<Tone, { dot: string; text: string; bg: string }> = {
  success: {
    dot: "bg-emerald-500",
    text: "text-emerald-800",
    bg: "bg-emerald-50",
  },
  info: { dot: "bg-sky-500", text: "text-sky-800", bg: "bg-sky-50" },
  danger: { dot: "bg-rose-500", text: "text-rose-800", bg: "bg-rose-50" },
  warn: { dot: "bg-amber-500", text: "text-amber-800", bg: "bg-amber-50" },
};

const getOrderTone = (value?: string | null): Tone => {
  const status = normalizeStatus(value);
  if (status === "delivered") return "success";
  if (["confirmed", ...FULFILLMENT_STATUSES].includes(status)) return "info";
  if (["cancelled", "refunded", "returned"].includes(status)) return "danger";
  return "warn";
};

const getPaymentTone = (value?: string | null): Tone => {
  const status = normalizeStatus(value);
  if (status === "paid") return "success";
  if (["failed", "refunded"].includes(status)) return "danger";
  return "warn";
};

const getEffectivePaymentStatus = (order: Order): PaymentStatus => {
  if (
    order.payment_method?.toLowerCase() === "cod" &&
    order.order_status?.toLowerCase() === "delivered"
  ) {
    return "paid";
  }

  return (order.payment_status || "pending") as PaymentStatus;
};

const getShortOrderId = (id?: string | null) => {
  if (!id) return "—";
  return id.slice(0, 8);
};

/* -------------------------------------------------------------------------- */
/*  Small presentational pieces                                                */
/* -------------------------------------------------------------------------- */

function StatusPill({ label, tone }: { label: string; tone: Tone }) {
  const t = TONES[tone];
  return (
    <span
      className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-medium capitalize ${t.bg} ${t.text}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${t.dot}`} />
      {label}
    </span>
  );
}

function TransitionButton({
  label,
  onClick,
  disabled,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="group inline-flex items-center gap-1.5 rounded-lg border border-[#E2DBCD] bg-white px-3 py-1.5 text-xs font-medium text-[#3F4723] transition hover:border-[#4D5528] hover:bg-[#4D5528] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#A68D65] disabled:pointer-events-none disabled:opacity-50"
    >
      {label}
      <ArrowRight className="h-3 w-3 opacity-60 transition group-hover:opacity-100" />
    </button>
  );
}

const fieldClass =
  "w-full rounded-lg border border-[#E2DBCD] bg-white px-3 py-2 text-sm text-[#2B2F18] outline-none transition placeholder:text-[#B3AFA3] focus:border-[#A68D65] focus:ring-4 focus:ring-[#A68D65]/15";

const surfaceClass =
  "rounded-2xl border border-[#ECE6DA] bg-white shadow-[0_1px_2px_rgba(43,47,24,0.04)]";

/* -------------------------------------------------------------------------- */
/*  Page                                                                       */
/* -------------------------------------------------------------------------- */

export default function AdminOrders() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [profilesById, setProfilesById] = useState<Record<string, Profile>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [orderStatusFilter, setOrderStatusFilter] = useState("all");
  const [paymentStatusFilter, setPaymentStatusFilter] = useState("all");
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [selectedItems, setSelectedItems] = useState<OrderItem[]>([]);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [detailsError, setDetailsError] = useState<string | null>(null);
  const [detailsLoaded, setDetailsLoaded] = useState(false);
  const [validOrderStatuses, setValidOrderStatuses] = useState<string[]>([]);
  const [validPaymentStatuses, setValidPaymentStatuses] = useState<string[]>(
    [],
  );
  const [selectedOrderStatus, setSelectedOrderStatus] = useState<string | null>(
    null,
  );
  const [selectedPaymentStatus, setSelectedPaymentStatus] = useState<
    string | null
  >(null);
  const [trackingNumber, setTrackingNumber] = useState("");
  const [estimatedDelivery, setEstimatedDelivery] = useState("");
  const [savingStatus, setSavingStatus] = useState(false);
  const [confirmDialog, setConfirmDialog] = useState<{
    open: boolean;
    action: "order" | "payment" | null;
    newStatus: string;
    reason: string;
  }>({
    open: false,
    action: null,
    newStatus: "",
    reason: "",
  });
  const [showHistory, setShowHistory] = useState(false);
  const refreshInFlight = useRef<Promise<void> | null>(null);

  const { toast } = useToast();

  const getCustomer = (order: Order) =>
    order.user_id ? profilesById[order.user_id] : undefined;

  const getCustomerName = (order: Order) => {
    const profile = getCustomer(order);
    return (
      profile?.full_name ||
      profile?.username ||
      profile?.email?.split("@")[0] ||
      "Guest customer"
    );
  };

  const fetchOrders = async () => {
    if (refreshInFlight.current) {
      await refreshInFlight.current;
      return;
    }

    const refresh = (async () => {
      setLoading(true);
      setError(null);

      const { data, error: fetchError } = await supabase
        .from("orders")
        .select(
          "id,created_at,updated_at,user_id,total_amount,payment_status,status,estimated_delivery,tracking_number,shipping_address,payment_method",
        )
        .order("created_at", { ascending: false });

      if (fetchError) {
        setError(fetchError.message);
        setOrders([]);
      } else {
        const orderRows = (data as any[] | null) || [];
        const mapped = orderRows.map((r) => ({
          ...r,
          order_status: r.status,
        }));
        setOrders(mapped as Order[]);

        const userIds = Array.from(
          new Set(orderRows.map((order) => order.user_id).filter(Boolean)),
        ) as string[];

        if (userIds.length) {
          const { data: profileRows } = await supabase
            .from("profiles")
            .select("id,username,full_name,email,phone")
            .in("id", userIds);

          setProfilesById(
            ((profileRows as Profile[] | null) || []).reduce<
              Record<string, Profile>
            >((acc, profile) => {
              acc[profile.id] = profile;
              return acc;
            }, {}),
          );
        } else {
          setProfilesById({});
        }
      }

      setLoading(false);
    })();

    refreshInFlight.current = refresh;
    try {
      await refresh;
    } finally {
      refreshInFlight.current = null;
    }
  };

  useEffect(() => {
    fetchOrders();
    let refreshTimer: number | undefined;

    const channel = supabase
      .channel("admin-orders-realtime")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "orders",
        },
        () => {
          window.clearTimeout(refreshTimer);
          refreshTimer = window.setTimeout(() => {
            void fetchOrders();
          }, 250);
        },
      )
      .subscribe();

    return () => {
      window.clearTimeout(refreshTimer);
      supabase.removeChannel(channel);
    };
  }, []);

  const filteredOrders = useMemo(() => {
    const term = search.trim().toLowerCase();
    return orders.filter((order) => {
      const matchesSearch =
        !term ||
        [
          order.id,
          getCustomerName(order),
          getCustomer(order)?.email || "",
          getCustomer(order)?.phone || "",
          order.order_status || "",
          order.payment_status || "",
          order.tracking_number || "",
        ]
          .join(" ")
          .toLowerCase()
          .includes(term);
      const matchesOrderStatus =
        orderStatusFilter === "all" ||
        (orderStatusFilter === "fulfillment"
          ? FULFILLMENT_STATUSES.includes(normalizeStatus(order.order_status))
          : normalizeStatus(order.order_status) === orderStatusFilter);
      const matchesPaymentStatus =
        paymentStatusFilter === "all" ||
        getEffectivePaymentStatus(order) === paymentStatusFilter;
      return matchesSearch && matchesOrderStatus && matchesPaymentStatus;
    });
  }, [orders, profilesById, search, orderStatusFilter, paymentStatusFilter]);

  const openOrderDetails = async (order: Order) => {
    setSelectedOrder(order);
    setDetailsLoading(true);
    setDetailsError(null);
    setDetailsLoaded(false);
    setSelectedItems([]);
    setShowHistory(false);
    setSelectedOrderStatus(null);
    setSelectedPaymentStatus(null);
    setValidOrderStatuses(
      getValidOrderStatuses((order.order_status as OrderStatus) || "pending"),
    );
    setValidPaymentStatuses(
      getValidPaymentStatuses(
        getEffectivePaymentStatus(order),
        order.payment_method,
        order.order_status,
      ),
    );
    setTrackingNumber(order.tracking_number || "");
    setEstimatedDelivery(formatDateInputValue(order.estimated_delivery));

    // Load order items
    const { data, error: itemsError } = await supabase
      .from("order_items")
      .select("id,product_name,product_image,quantity,price")
      .eq("order_id", order.id)
      .order("created_at", { ascending: true });

    if (itemsError) {
      setDetailsError(itemsError.message);
      setDetailsLoaded(true);
    } else {
      const itemRows = (data as OrderItem[] | null) || [];
      setSelectedItems(itemRows);
    }

    // Load order with history
    const orderWithHistory = await getOrderWithHistory(order.id);
    if (orderWithHistory) {
      setSelectedOrder(orderWithHistory as Order);
      setEstimatedDelivery(
        formatDateInputValue(orderWithHistory.estimated_delivery),
      );
      setValidOrderStatuses(
        getValidOrderStatuses(
          (orderWithHistory.order_status as OrderStatus) || "pending",
        ),
      );
      setValidPaymentStatuses(
        getValidPaymentStatuses(
          getEffectivePaymentStatus(orderWithHistory as Order),
          orderWithHistory.payment_method,
          orderWithHistory.order_status,
        ),
      );
    }

    setDetailsLoaded(true);
    setDetailsLoading(false);
  };

  const handleStatusChangeClick = (
    action: "order" | "payment",
    newStatus: string,
  ) => {
    // Show confirmation dialog
    setConfirmDialog({
      open: true,
      action,
      newStatus,
      reason: "",
    });
  };

  const confirmStatusChange = async () => {
    if (!selectedOrder) return;

    const { action, newStatus, reason } = confirmDialog;
    if (
      action === "payment" &&
      !isValidPaymentTransition(
        getEffectivePaymentStatus(selectedOrder),
        newStatus,
        selectedOrder.payment_method,
        selectedOrder.order_status,
      )
    ) {
      toast({
        title: "Invalid payment transition",
        description:
          "That payment status is no longer available for this order.",
        variant: "destructive",
      });
      return;
    }
    setSavingStatus(true);

    try {
      const result = await updateOrderStatus(selectedOrder.id, {
        newOrderStatus:
          action === "order" ? (newStatus as OrderStatus) : undefined,
        newPaymentStatus:
          action === "payment" ? (newStatus as PaymentStatus) : undefined,
        trackingNumber:
          action === "order" && isTrackingNumberRequired(newStatus)
            ? trackingNumber
            : undefined,
        estimatedDelivery:
          estimatedDelivery && action === "order"
            ? estimatedDelivery
            : undefined,
      });

      if (result.success) {
        // Refresh order details
        const updatedOrder = await getOrderWithHistory(selectedOrder.id);
        if (updatedOrder) {
          setSelectedOrder(updatedOrder as Order);
          // Recalculate valid transitions
          const newOrderStatus =
            (updatedOrder.order_status as OrderStatus) || "pending";
          const newPaymentStatus = getEffectivePaymentStatus(
            updatedOrder as Order,
          );
          setValidOrderStatuses(getValidOrderStatuses(newOrderStatus));
          setValidPaymentStatuses(
            getValidPaymentStatuses(
              newPaymentStatus,
              updatedOrder.payment_method,
              newOrderStatus,
            ),
          );
        }

        // Refresh orders list
        await fetchOrders();
      } else {
        toast({
          title: "Error",
          description: result.message,
          variant: "destructive",
        });
      }
    } catch (err: any) {
      console.error(err);
      toast({
        title: "Error",
        description: err.message || "An error occurred",
        variant: "destructive",
      });
    } finally {
      setSavingStatus(false);
      setConfirmDialog({
        open: false,
        action: null,
        newStatus: "",
        reason: "",
      });
    }
  };

  const exportOrders = () => {
    const headers = [
      "Order ID",
      "Customer",
      "Email",
      "Phone",
      "Payment Status",
      "Order Status",
      "Total",
      "Created",
      "Estimated Delivery",
      "Tracking",
    ];

    const rows = filteredOrders.map((order) =>
      [
        order.id,
        getCustomerName(order),
        getCustomer(order)?.email || "",
        getCustomer(order)?.phone || "",
        formatStatus(getEffectivePaymentStatus(order)),
        formatStatus(order.order_status),
        Number(order.total_amount || 0).toFixed(2),
        formatOrderDate(order.created_at),
        formatOrderDate(order.estimated_delivery),
        order.tracking_number || "",
      ]
        .map(csvCell)
        .join(","),
    );

    const csv = [headers.map(csvCell).join(","), ...rows].join("\n");

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "admin-orders.csv";
    link.click();
    URL.revokeObjectURL(url);
  };

  /* ------------------------------ Derived stats ----------------------------- */

  const totalRevenue = orders.reduce(
    (sum, order) => sum + Number(order.total_amount || 0),
    0,
  );
  const paidRevenue = orders
    .filter((order) => getEffectivePaymentStatus(order) === "paid")
    .reduce((sum, order) => sum + Number(order.total_amount || 0), 0);
  const activeOrders = orders.filter((order) =>
    FULFILLMENT_STATUSES.includes(normalizeStatus(order.order_status)),
  ).length;
  const deliveredOrders = orders.filter(
    (order) => normalizeStatus(order.order_status) === "delivered",
  ).length;
  const newOrders = orders.filter(
    (order) => normalizeStatus(order.order_status) === "pending",
  ).length;
  const filtersActive =
    orderStatusFilter !== "all" || paymentStatusFilter !== "all";

  const clearFilters = () => {
    setSearch("");
    setOrderStatusFilter("all");
    setPaymentStatusFilter("all");
  };

  const activateMetric = (orderStatus: string, paymentStatus = "all") => {
    setSearch("");
    setOrderStatusFilter(orderStatus);
    setPaymentStatusFilter(paymentStatus);
  };

  const stats = [
    {
      key: "all",
      label: "All orders",
      value: String(orders.length),
      hint: "Every order placed",
      icon: Package,
      order: "all",
      payment: "all",
    },
    {
      key: "paid",
      label: "Order value",
      value: formatCurrency(totalRevenue),
      hint: `${formatCurrency(paidRevenue)} collected`,
      icon: CircleDollarSign,
      order: "all",
      payment: "paid",
    },
    {
      key: "fulfillment",
      label: "In fulfillment",
      value: String(activeOrders),
      hint: "Processing, shipped or on the way",
      icon: Truck,
      order: "fulfillment",
      payment: "all",
    },
    {
      key: "delivered",
      label: "Delivered",
      value: String(deliveredOrders),
      hint: `${filteredOrders.length} in current view`,
      icon: CheckCircle2,
      order: "delivered",
      payment: "all",
    },
  ];

  /* ------------------------------ Dialog helpers ---------------------------- */

  const shippingAddressText = (order: Order) =>
    order.shipping_address
      ? [
          order.shipping_address.line1,
          order.shipping_address.line2,
          order.shipping_address.city,
          order.shipping_address.state,
          order.shipping_address.pincode,
          order.shipping_address.country,
        ]
          .filter(Boolean)
          .join(", ") || "No shipping address on file"
      : "No shipping address on file";

  const closeConfirm = () =>
    setConfirmDialog({
      open: false,
      action: null,
      newStatus: "",
      reason: "",
    });

  /* --------------------------------- Render --------------------------------- */

  return (
    <AdminLayout>
      <div className="mx-auto max-w-[1400px] space-y-8">
        {/* Header */}
        <header className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
          <div>
            <h1 className="font-serif text-4xl font-semibold tracking-tight text-[#2B2F18]">
              Orders
            </h1>
            <p className="mt-2 max-w-md text-[15px] leading-relaxed text-[#6F6C61]">
              Follow each order from payment to doorstep.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => activateMetric("pending")}
              aria-label={`View ${newOrders} new orders`}
              className="h-10 gap-2 rounded-lg border-[#E2DBCD] bg-white px-4 text-sm font-medium text-[#3F4723] shadow-none hover:bg-[#FAF8F3]"
            >
              <PackagePlus className="h-4 w-4" />
              New orders
              <span className="ml-0.5 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-[#2B2F18] px-1.5 text-[11px] font-semibold text-white">
                {newOrders}
              </span>
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={exportOrders}
              className="h-10 gap-2 rounded-lg border-[#E2DBCD] bg-white px-4 text-sm font-medium text-[#3F4723] shadow-none hover:bg-[#FAF8F3]"
            >
              <Download className="h-4 w-4" />
              Export CSV
            </Button>
            <Button
              type="button"
              onClick={fetchOrders}
              className="h-10 gap-2 rounded-lg bg-[#2B2F18] px-4 text-sm font-medium text-white shadow-none hover:bg-[#4D5528]"
            >
              <RefreshCw
                className={`h-4 w-4 ${loading ? "animate-spin" : ""}`}
              />
              Refresh
            </Button>
          </div>
        </header>

        {/* Summary strip — also works as quick filters */}
        <section
          aria-label="Order summary"
          className={`${surfaceClass} grid grid-cols-2 gap-px overflow-hidden bg-[#ECE6DA] xl:grid-cols-4`}
        >
          {stats.map((stat) => {
            const Icon = stat.icon;
            const active =
              !search &&
              orderStatusFilter === stat.order &&
              paymentStatusFilter === stat.payment;
            return (
              <button
                key={stat.key}
                type="button"
                onClick={() => activateMetric(stat.order, stat.payment)}
                aria-pressed={active}
                className={`group relative bg-white px-6 py-5 text-left transition focus-visible:z-10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#A68D65] ${
                  active
                    ? "bg-[#FAF8F3] shadow-[inset_0_-2px_0_#4D5528]"
                    : "hover:bg-[#FCFBF8]"
                }`}
              >
                <span className="flex items-center justify-between text-[#7A776C]">
                  <span className="text-sm">{stat.label}</span>
                  <Icon className="h-4 w-4 text-[#A68D65]" />
                </span>
                <span className="mt-3 block font-serif text-[1.75rem] font-semibold leading-none tracking-tight text-[#2B2F18] tabular-nums">
                  {stat.value}
                </span>
                <span className="mt-2 block text-xs text-[#8A8678]">
                  {stat.hint}
                </span>
              </button>
            );
          })}
        </section>

        {/* Table with integrated toolbar */}
        <section className={`${surfaceClass} overflow-hidden`}>
          <div className="flex flex-col gap-3 border-b border-[#ECE6DA] p-4 lg:flex-row lg:items-center">
            <div className="relative min-w-0 flex-1">
              <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#A3A095]" />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search by customer, order ID, email or tracking number"
                aria-label="Search orders"
                className="h-10 w-full rounded-lg border border-transparent bg-[#F6F3EC] pl-10 pr-4 text-sm text-[#2B2F18] outline-none transition placeholder:text-[#A3A095] focus:border-[#D9CFBC] focus:bg-white focus:ring-4 focus:ring-[#A68D65]/15"
              />
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <select
                value={orderStatusFilter}
                onChange={(event) => setOrderStatusFilter(event.target.value)}
                aria-label="Filter by fulfillment status"
                className="h-10 rounded-lg border border-[#E2DBCD] bg-white px-3 text-sm text-[#4A4A42] outline-none transition focus:border-[#A68D65] focus:ring-4 focus:ring-[#A68D65]/15"
              >
                <option value="all">All fulfillment</option>
                <option value="fulfillment">In fulfillment</option>
                <option value="pending">Pending</option>
                <option value="confirmed">Confirmed</option>
                <option value="processing">Processing</option>
                <option value="shipped">Shipped</option>
                <option value="in_transit">In transit</option>
                <option value="out_for_delivery">Out for delivery</option>
                <option value="delivered">Delivered</option>
                <option value="cancelled">Cancelled</option>
                <option value="returned">Returned</option>
              </select>
              <select
                value={paymentStatusFilter}
                onChange={(event) => setPaymentStatusFilter(event.target.value)}
                aria-label="Filter by payment status"
                className="h-10 rounded-lg border border-[#E2DBCD] bg-white px-3 text-sm text-[#4A4A42] outline-none transition focus:border-[#A68D65] focus:ring-4 focus:ring-[#A68D65]/15"
              >
                <option value="all">All payments</option>
                <option value="pending">Pending payment</option>
                <option value="paid">Paid</option>
                <option value="failed">Failed</option>
                <option value="refunded">Refunded</option>
              </select>
              {(filtersActive || search) && (
                <button
                  type="button"
                  onClick={clearFilters}
                  className="inline-flex h-10 items-center gap-1.5 rounded-lg px-3 text-sm text-[#75684E] transition hover:bg-[#F6F3EC] hover:text-[#2B2F18] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#A68D65]"
                >
                  <X className="h-3.5 w-3.5" />
                  Clear
                </button>
              )}
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[1040px] text-sm">
              <thead>
                <tr className="border-b border-[#ECE6DA] text-left text-xs font-medium text-[#8A8678]">
                  <th className="px-6 py-3 font-medium">Customer</th>
                  <th className="px-4 py-3 font-medium">Payment</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">Placed</th>
                  <th className="px-4 py-3 font-medium">Expected</th>
                  <th className="px-4 py-3 font-medium">Tracking</th>
                  <th className="px-4 py-3 text-right font-medium">Total</th>
                  <th className="w-12 px-4 py-3">
                    <span className="sr-only">Open</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F1EDE4]">
                {loading && orders.length === 0 ? (
                  <tr>
                    <td
                      colSpan={8}
                      className="px-6 py-16 text-center text-sm text-[#8A8678]"
                    >
                      Loading orders…
                    </td>
                  </tr>
                ) : error ? (
                  <tr>
                    <td
                      colSpan={8}
                      className="px-6 py-16 text-center text-sm text-rose-600"
                    >
                      {error}
                    </td>
                  </tr>
                ) : filteredOrders.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-6 py-16 text-center">
                      <p className="font-medium text-[#2B2F18]">
                        No orders match these filters
                      </p>
                      <p className="mt-1 text-sm text-[#8A8678]">
                        Try a different search or clear the filters.
                      </p>
                    </td>
                  </tr>
                ) : (
                  filteredOrders.map((order) => (
                    <tr
                      key={order.id}
                      tabIndex={0}
                      onClick={() => openOrderDetails(order)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          openOrderDetails(order);
                        }
                      }}
                      className="group cursor-pointer transition-colors hover:bg-[#FCFBF8] focus-visible:bg-[#FAF8F3] focus-visible:outline-none"
                    >
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#EEF0E5] text-sm font-semibold text-[#4D5528]">
                            {getCustomerName(order).slice(0, 1).toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <p className="truncate font-medium text-[#2B2F18]">
                              {getCustomerName(order)}
                            </p>
                            <p className="mt-0.5 flex items-center gap-1.5 truncate text-xs text-[#8A8678]">
                              <span className="font-mono">
                                #{getShortOrderId(order.id)}
                              </span>
                              <span className="text-[#CFC9BB]">/</span>
                              <span className="truncate">
                                {getCustomer(order)?.email ||
                                  "No email available"}
                              </span>
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        <StatusPill
                          label={formatStatus(getEffectivePaymentStatus(order))}
                          tone={getPaymentTone(
                            getEffectivePaymentStatus(order),
                          )}
                        />
                      </td>
                      <td className="px-4 py-4">
                        <StatusPill
                          label={formatStatus(order.order_status)}
                          tone={getOrderTone(order.order_status)}
                        />
                      </td>
                      <td className="whitespace-nowrap px-4 py-4 text-[#5C5A50]">
                        {formatOrderDate(order.created_at)}
                      </td>
                      <td className="whitespace-nowrap px-4 py-4 text-[#5C5A50]">
                        {formatOrderDate(order.estimated_delivery)}
                      </td>
                      <td className="px-4 py-4 font-mono text-xs text-[#5C5A50]">
                        {order.tracking_number || (
                          <span className="text-[#CFC9BB]">—</span>
                        )}
                      </td>
                      <td className="whitespace-nowrap px-4 py-4 text-right font-semibold tabular-nums text-[#2B2F18]">
                        {formatCurrency(order.total_amount)}
                      </td>
                      <td className="px-4 py-4 text-right">
                        <ChevronRight className="inline h-4 w-4 text-[#CFC9BB] transition group-hover:translate-x-0.5 group-hover:text-[#4D5528]" />
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-between border-t border-[#ECE6DA] bg-[#FCFBF8] px-6 py-3 text-xs text-[#8A8678]">
            <span>
              {loading
                ? "Syncing latest orders…"
                : `Showing ${filteredOrders.length} of ${orders.length} ${orders.length === 1 ? "order" : "orders"}`}
            </span>
            {filtersActive && <span>Filters applied</span>}
          </div>
        </section>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Order details                                                       */}
      {/* ------------------------------------------------------------------ */}
      <Dialog
        open={Boolean(selectedOrder)}
        onOpenChange={(open) => {
          if (!open) {
            setSelectedOrder(null);
            setSelectedItems([]);
            setDetailsError(null);
          }
        }}
      >
        <DialogContent className="max-h-[92vh] max-w-5xl gap-0 overflow-y-auto rounded-2xl border-[#ECE6DA] bg-white p-0 shadow-2xl">
          {selectedOrder && (
            <>
              <DialogHeader className="space-y-0 border-b border-[#ECE6DA] px-6 py-6 text-left sm:px-8">
                <div className="flex flex-col gap-4 pr-8 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <DialogTitle className="font-serif text-3xl font-semibold tracking-tight text-[#2B2F18]">
                      Order #{getShortOrderId(selectedOrder.id)}
                    </DialogTitle>
                    <DialogDescription className="mt-1.5 text-sm text-[#7A776C]">
                      Placed {formatOrderDate(selectedOrder.created_at)}
                    </DialogDescription>
                    <p
                      className="mt-2 max-w-full truncate font-mono text-xs text-[#A3A095]"
                      title={selectedOrder.id}
                    >
                      {selectedOrder.id}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <StatusPill
                      label={
                        ORDER_STATUS_LABELS[
                          selectedOrder.order_status as OrderStatus
                        ] || formatStatus(selectedOrder.order_status)
                      }
                      tone={getOrderTone(selectedOrder.order_status)}
                    />
                    <StatusPill
                      label={formatStatus(
                        getEffectivePaymentStatus(selectedOrder),
                      )}
                      tone={getPaymentTone(
                        getEffectivePaymentStatus(selectedOrder),
                      )}
                    />
                  </div>
                </div>
              </DialogHeader>

              <div className="grid lg:grid-cols-[minmax(0,1fr)_340px]">
                {/* Left: customer + items */}
                <div className="min-w-0 space-y-8 px-6 py-6 sm:px-8">
                  <section>
                    <h3 className="text-sm font-semibold text-[#2B2F18]">
                      Customer
                    </h3>
                    <div className="mt-4 flex items-start gap-4">
                      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#EEF0E5] text-base font-semibold text-[#4D5528]">
                        {getCustomerName(selectedOrder)
                          .slice(0, 1)
                          .toUpperCase()}
                      </div>
                      <div className="min-w-0 flex-1 space-y-2 text-sm text-[#6F6C61]">
                        <p className="break-words text-base font-medium text-[#2B2F18]">
                          {getCustomerName(selectedOrder)}
                        </p>
                        <p className="flex items-start gap-2">
                          <Mail className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#A68D65]" />
                          <span className="min-w-0 break-words">
                            {getCustomer(selectedOrder)?.email ||
                              "No email available"}
                          </span>
                        </p>
                        {getCustomer(selectedOrder)?.phone && (
                          <p className="flex items-start gap-2">
                            <Phone className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#A68D65]" />
                            <span className="break-words">
                              {getCustomer(selectedOrder)?.phone}
                            </span>
                          </p>
                        )}
                        <p className="flex items-start gap-2 leading-5">
                          <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#A68D65]" />
                          <span className="min-w-0 [overflow-wrap:anywhere]">
                            {shippingAddressText(selectedOrder)}
                          </span>
                        </p>
                      </div>
                    </div>
                  </section>

                  <section>
                    <div className="flex items-baseline justify-between">
                      <h3 className="text-sm font-semibold text-[#2B2F18]">
                        Items
                      </h3>
                      <p className="text-xs text-[#8A8678]">
                        {detailsLoading
                          ? "Loading…"
                          : detailsLoaded
                            ? `${selectedItems.length} ${selectedItems.length === 1 ? "line item" : "line items"}`
                            : ""}
                      </p>
                    </div>

                    <div className="mt-3 overflow-hidden rounded-xl border border-[#ECE6DA]">
                      {detailsLoading ? (
                        <div className="flex items-center justify-center gap-3 p-10 text-sm text-[#8A8678]">
                          <RefreshCw className="h-4 w-4 animate-spin" />
                          Loading items…
                        </div>
                      ) : detailsError ? (
                        <div className="space-y-3 p-10 text-center text-sm text-rose-600">
                          <div className="flex items-center justify-center gap-2">
                            <AlertCircle className="h-4 w-4" />
                            <span>{detailsError}</span>
                          </div>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() =>
                              selectedOrder && openOrderDetails(selectedOrder)
                            }
                          >
                            Try again
                          </Button>
                        </div>
                      ) : selectedItems.length === 0 ? (
                        <div className="p-10 text-center text-sm text-[#8A8678]">
                          This order has no items.
                        </div>
                      ) : (
                        <>
                          <ul className="divide-y divide-[#F1EDE4]">
                            {selectedItems.map((item) => (
                              <li
                                key={item.id}
                                className="flex items-center justify-between gap-4 px-4 py-4"
                              >
                                <div className="flex min-w-0 items-center gap-3">
                                  {item.product_image ? (
                                    <img
                                      src={item.product_image}
                                      alt={item.product_name || "Product"}
                                      className="h-14 w-14 shrink-0 rounded-lg border border-[#ECE6DA] object-cover"
                                    />
                                  ) : (
                                    <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-lg border border-[#ECE6DA] bg-[#F6F3EC] text-[#B3AFA3]">
                                      <Package className="h-5 w-5" />
                                    </div>
                                  )}
                                  <div className="min-w-0">
                                    <p className="truncate font-medium text-[#2B2F18]">
                                      {item.product_name || "Product"}
                                    </p>
                                    <p className="mt-0.5 text-sm text-[#8A8678] tabular-nums">
                                      {item.quantity || 0} ×{" "}
                                      {formatCurrency(item.price)}
                                    </p>
                                  </div>
                                </div>
                                <p className="shrink-0 font-semibold tabular-nums text-[#2B2F18]">
                                  {formatCurrency(
                                    Number(item.price || 0) *
                                      Number(item.quantity || 0),
                                  )}
                                </p>
                              </li>
                            ))}
                          </ul>
                          <div className="flex items-center justify-between border-t border-[#ECE6DA] bg-[#FAF8F3] px-4 py-3.5">
                            <span className="text-sm text-[#6F6C61]">
                              Order total
                            </span>
                            <span className="font-serif text-xl font-semibold tabular-nums text-[#2B2F18]">
                              {formatCurrency(selectedOrder.total_amount)}
                            </span>
                          </div>
                        </>
                      )}
                    </div>
                  </section>
                </div>

                {/* Right: status & shipping controls */}
                <aside className="min-w-0 space-y-6 border-t border-[#ECE6DA] bg-[#FAF8F3] px-6 py-6 lg:border-l lg:border-t-0">
                  <section>
                    <h3 className="text-sm font-semibold text-[#2B2F18]">
                      Payment
                    </h3>
                    <p className="mt-2 font-serif text-3xl font-semibold tracking-tight tabular-nums text-[#2B2F18]">
                      {formatCurrency(selectedOrder.total_amount)}
                    </p>
                    <p className="mt-1 text-sm text-[#7A776C]">
                      {formatPaymentMethod(selectedOrder.payment_method)}
                    </p>
                    {validPaymentStatuses.length > 0 && (
                      <div className="mt-4">
                        <p className="text-xs text-[#8A8678]">Update payment</p>
                        <div className="mt-2 flex flex-wrap gap-2">
                          {validPaymentStatuses.map((status) => (
                            <TransitionButton
                              key={status}
                              label={
                                PAYMENT_STATUS_LABELS[
                                  status as PaymentStatus
                                ] || formatStatus(status)
                              }
                              onClick={() =>
                                handleStatusChangeClick("payment", status)
                              }
                              disabled={savingStatus}
                            />
                          ))}
                        </div>
                      </div>
                    )}
                  </section>

                  <hr className="border-[#ECE6DA]" />

                  <section>
                    <h3 className="text-sm font-semibold text-[#2B2F18]">
                      Fulfillment
                    </h3>
                    <p className="mt-1.5 text-sm leading-relaxed text-[#7A776C]">
                      {getOrderStatusDescription(selectedOrder.order_status)}
                    </p>
                    {validOrderStatuses.length > 0 && (
                      <div className="mt-4">
                        <p className="text-xs text-[#8A8678]">Move order to</p>
                        <div className="mt-2 flex flex-wrap gap-2">
                          {validOrderStatuses.map((status) => (
                            <TransitionButton
                              key={status}
                              label={
                                ORDER_STATUS_LABELS[status as OrderStatus] ||
                                formatStatus(status)
                              }
                              onClick={() =>
                                handleStatusChangeClick("order", status)
                              }
                              disabled={savingStatus}
                            />
                          ))}
                        </div>
                      </div>
                    )}
                  </section>

                  <hr className="border-[#ECE6DA]" />

                  <section className="space-y-4">
                    <h3 className="text-sm font-semibold text-[#2B2F18]">
                      Shipping details
                    </h3>
                    <div>
                      <label
                        htmlFor="tracking-number"
                        className="text-xs text-[#8A8678]"
                      >
                        Tracking number
                      </label>
                      <input
                        id="tracking-number"
                        type="text"
                        placeholder="Enter tracking number"
                        value={trackingNumber}
                        onChange={(e) => setTrackingNumber(e.target.value)}
                        className={`${fieldClass} mt-1.5`}
                      />
                    </div>

                    {selectedOrder.order_status?.toLowerCase() !==
                      "delivered" && (
                      <div>
                        <label
                          htmlFor="estimated-delivery"
                          className="text-xs text-[#8A8678]"
                        >
                          Expected delivery
                        </label>
                        <input
                          id="estimated-delivery"
                          type="date"
                          value={estimatedDelivery}
                          onChange={(e) => setEstimatedDelivery(e.target.value)}
                          className={`${fieldClass} mt-1.5`}
                        />
                      </div>
                    )}

                    <button
                      type="button"
                      onClick={() => setShowHistory(true)}
                      className="inline-flex items-center gap-2 rounded-lg py-1 text-sm text-[#6F6C61] transition hover:text-[#2B2F18] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#A68D65]"
                    >
                      <History className="h-4 w-4" />
                      View status history
                    </button>
                  </section>
                </aside>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* ------------------------------------------------------------------ */}
      {/* Status history                                                      */}
      {/* ------------------------------------------------------------------ */}
      <Dialog open={showHistory} onOpenChange={setShowHistory}>
        <DialogContent className="max-h-[85vh] overflow-y-auto rounded-2xl border-[#ECE6DA] bg-white sm:max-w-xl">
          <DialogHeader className="border-b border-[#ECE6DA] pb-4 text-left">
            <DialogTitle className="font-serif text-2xl font-semibold text-[#2B2F18]">
              Status history
            </DialogTitle>
            <DialogDescription className="text-[#7A776C]">
              Every change to order #{getShortOrderId(selectedOrder?.id)},
              newest first.
            </DialogDescription>
          </DialogHeader>

          {selectedOrder?.history && selectedOrder.history.length > 0 ? (
            <ol className="relative ml-2 space-y-6 py-2">
              <span className="absolute bottom-3 left-[5px] top-3 w-px bg-[#E5DFD2]" />
              {selectedOrder.history.map((entry) => (
                <li key={entry.id} className="relative pl-8">
                  <span className="absolute left-0 top-1.5 h-[11px] w-[11px] rounded-full border-2 border-white bg-[#4D5528] ring-1 ring-[#CFC9BB]" />
                  <div className="flex flex-col gap-0.5 sm:flex-row sm:items-baseline sm:justify-between sm:gap-4">
                    <p className="font-medium capitalize text-[#2B2F18]">
                      {ORDER_STATUS_LABELS[entry.status as OrderStatus] ||
                        formatStatus(entry.status)}
                    </p>
                    <p className="shrink-0 text-xs text-[#8A8678]">
                      {formatOrderDate(entry.created_at)}
                    </p>
                  </div>
                  <p className="mt-1 text-sm text-[#6F6C61]">
                    {entry.notes || "Status updated"}
                  </p>
                  <p className="mt-1 text-xs text-[#A3A095]">
                    By {entry.changed_by_name || "Unknown"}
                  </p>
                </li>
              ))}
            </ol>
          ) : (
            <div className="rounded-xl border border-dashed border-[#E2DBCD] bg-[#FAF8F3] p-8 text-center text-sm text-[#8A8678]">
              No status changes have been recorded for this order yet.
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ------------------------------------------------------------------ */}
      {/* Confirm status change                                               */}
      {/* ------------------------------------------------------------------ */}
      <Dialog
        open={confirmDialog.open}
        onOpenChange={(open) => {
          if (!open) closeConfirm();
        }}
      >
        <DialogContent className="rounded-2xl border-[#ECE6DA] bg-white sm:max-w-md">
          <DialogHeader className="text-left">
            <DialogTitle className="font-serif text-2xl font-semibold text-[#2B2F18]">
              Confirm change
            </DialogTitle>
            <DialogDescription className="text-[#7A776C]">
              This updates the{" "}
              {confirmDialog.action === "order" ? "order" : "payment"} status
              and is recorded in the order history.
            </DialogDescription>
          </DialogHeader>

          {selectedOrder && (
            <div className="space-y-4 py-2">
              <div className="flex items-center justify-between gap-3 rounded-xl bg-[#FAF8F3] px-4 py-3.5 text-sm">
                <span className="font-medium text-[#6F6C61]">
                  {confirmDialog.action === "order"
                    ? ORDER_STATUS_LABELS[
                        selectedOrder.order_status as OrderStatus
                      ] || formatStatus(selectedOrder.order_status)
                    : PAYMENT_STATUS_LABELS[
                        getEffectivePaymentStatus(selectedOrder)
                      ] || formatStatus(selectedOrder.payment_status)}
                </span>
                <ArrowRight className="h-4 w-4 shrink-0 text-[#A68D65]" />
                <span className="font-semibold text-[#2B2F18]">
                  {confirmDialog.action === "order"
                    ? ORDER_STATUS_LABELS[
                        confirmDialog.newStatus as OrderStatus
                      ] || formatStatus(confirmDialog.newStatus)
                    : PAYMENT_STATUS_LABELS[
                        confirmDialog.newStatus as PaymentStatus
                      ] || formatStatus(confirmDialog.newStatus)}
                </span>
              </div>

              <div>
                <label
                  htmlFor="status-reason"
                  className="text-sm font-medium text-[#4A4A42]"
                >
                  Reason{" "}
                  <span className="font-normal text-[#A3A095]">(optional)</span>
                </label>
                <textarea
                  id="status-reason"
                  value={confirmDialog.reason}
                  onChange={(e) =>
                    setConfirmDialog((prev) => ({
                      ...prev,
                      reason: e.target.value,
                    }))
                  }
                  placeholder="Add a note for your team"
                  className={`${fieldClass} mt-2 resize-none`}
                  rows={3}
                />
              </div>

              {isTrackingNumberRequired(confirmDialog.newStatus) &&
                confirmDialog.action === "order" &&
                !trackingNumber && (
                  <div className="flex gap-2.5 rounded-xl border border-amber-200 bg-amber-50 p-3">
                    <AlertCircle className="h-5 w-5 shrink-0 text-amber-600" />
                    <p className="text-sm text-amber-900">
                      Add a tracking number before marking this order as{" "}
                      {formatStatus(confirmDialog.newStatus)}.
                    </p>
                  </div>
                )}
            </div>
          )}

          <div className="flex gap-3">
            <Button
              variant="outline"
              className="h-10 rounded-lg border-[#E2DBCD] bg-white text-[#3F4723] shadow-none hover:bg-[#FAF8F3]"
              onClick={closeConfirm}
              disabled={savingStatus}
            >
              Cancel
            </Button>
            <Button
              className="h-10 flex-1 rounded-lg bg-[#2B2F18] text-white shadow-none hover:bg-[#4D5528]"
              onClick={confirmStatusChange}
              disabled={
                savingStatus ||
                (isTrackingNumberRequired(confirmDialog.newStatus) &&
                  confirmDialog.action === "order" &&
                  !trackingNumber)
              }
            >
              {savingStatus ? "Saving…" : "Confirm change"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}
