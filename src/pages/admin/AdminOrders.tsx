import {
  type KeyboardEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  CheckCircle2,
  CircleDollarSign,
  CalendarDays,
  ClipboardCheck,
  CreditCard,
  Eye,
  Filter,
  Hash,
  Mail,
  MapPin,
  Package,
  PackagePlus,
  RefreshCw,
  Search,
  SlidersHorizontal,
  Truck,
  UserRound,
  AlertCircle,
  History,
} from "lucide-react";
import AdminLayout from "@/layouts/AdminLayout";
import { supabase } from "@/lib/supabaseClient";
import { Badge } from "@/components/ui/badge";
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

const formatCurrency = (value?: number | null) =>
  `₹${Number(value || 0).toFixed(2)}`;

const formatDateInputValue = (value?: string | null) => {
  if (!value) return "";
  if (/^\d{4}-\d{2}-\d{2}/.test(value)) return value.slice(0, 10);

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : date.toISOString().slice(0, 10);
};

const formatStatus = (value?: string | null) =>
  (value || "pending").replace(/_/g, " ");

const getOrderStatusBadgeClass = (value?: string | null) => {
  const status = (value || "pending").toLowerCase();
  if (["delivered"].includes(status))
    return "bg-emerald-100 text-emerald-700 hover:bg-emerald-100";
  if (
    ["shipped", "in_transit", "out_for_delivery", "processing"].includes(status)
  )
    return "bg-sky-100 text-sky-700 hover:bg-sky-100";
  if (["cancelled", "refunded", "returned"].includes(status))
    return "bg-rose-100 text-rose-700 hover:bg-rose-100";
  return "bg-amber-100 text-amber-700 hover:bg-amber-100";
};

const getPaymentStatusBadgeClass = (value?: string | null) => {
  const status = (value || "pending").toLowerCase();
  if (["paid"].includes(status))
    return "bg-emerald-100 text-emerald-700 hover:bg-emerald-100";
  if (["failed", "refunded"].includes(status))
    return "bg-rose-100 text-rose-700 hover:bg-rose-100";
  return "bg-amber-100 text-amber-700 hover:bg-amber-100";
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
  return `${id.slice(0, 8)}…`;
};

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
        ]
          .join(" ")
          .toLowerCase()
          .includes(term);
      const matchesOrderStatus =
        orderStatusFilter === "all" ||
        (orderStatusFilter === "fulfillment"
          ? ["processing", "shipped", "out for delivery"].includes(
              (order.order_status || "").toLowerCase(),
            )
          : (order.order_status || "pending").toLowerCase() ===
            orderStatusFilter);
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
    const rows = filteredOrders.map((order) => ({
      id: order.id,
      customer: getCustomerName(order),
      email: getCustomer(order)?.email || "",
      phone: getCustomer(order)?.phone || "",
      payment_status: formatStatus(getEffectivePaymentStatus(order)),
      order_status: formatStatus(order.order_status),
      total_amount: formatCurrency(order.total_amount),
      created_at: formatOrderDate(order.created_at),
      estimated_delivery: formatOrderDate(order.estimated_delivery),
      tracking_number: order.tracking_number || "",
    }));

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

    const csv = [headers.join(",")]
      .concat(
        rows.map((row) =>
          [
            row.id,
            `"${row.customer}"`,
            `"${row.email}"`,
            `"${row.phone}"`,
            row.payment_status,
            row.order_status,
            row.total_amount,
            row.created_at,
            row.estimated_delivery,
            row.tracking_number,
          ].join(","),
        ),
      )
      .join("\n");

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "admin-orders.csv";
    link.click();
    URL.revokeObjectURL(url);
  };

  const totalRevenue = orders.reduce(
    (sum, order) => sum + Number(order.total_amount || 0),
    0,
  );
  const paidRevenue = orders
    .filter((order) => getEffectivePaymentStatus(order) === "paid")
    .reduce((sum, order) => sum + Number(order.total_amount || 0), 0);
  const activeOrders = orders.filter((order) =>
    ["processing", "shipped", "out for delivery"].includes(
      (order.order_status || "").toLowerCase(),
    ),
  ).length;
  const deliveredOrders = orders.filter(
    (order) => (order.order_status || "").toLowerCase() === "delivered",
  ).length;
  const newOrders = orders.filter(
    (order) => (order.order_status || "pending").toLowerCase() === "pending",
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

  const handleMetricKeyDown = (
    event: KeyboardEvent<HTMLDivElement>,
    orderStatus: string,
    paymentStatus = "all",
  ) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      activateMetric(orderStatus, paymentStatus);
    }
  };

  return (
    <AdminLayout>
      <div className="mx-auto max-w-[1500px] space-y-7">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.2em] text-[#A68D65]">
              Operations / Customer orders
            </p>
            <h1 className="text-4xl font-semibold text-[#33381C]">
              Order desk
            </h1>
            <p className="mt-2 text-sm text-[#5C5C54] md:text-base">
              Keep every order, payment, and delivery moving with confidence.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setOrderStatusFilter("pending")}
              title="View new orders"
              aria-label={`View ${newOrders} new orders`}
              className="relative rounded-xl border-[#DED4C4] bg-white px-4 py-3 text-sm font-semibold text-[#4D5528] shadow-sm hover:bg-[#F8F5EE]"
            >
              <PackagePlus className="h-4 w-4" />
              <span>New orders</span>
              <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-[#E9B949] px-1.5 text-[11px] font-bold text-[#33381C]">
                {newOrders}
              </span>
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={exportOrders}
              className="rounded-xl border-[#DED4C4] bg-white px-5 py-3 text-sm font-semibold text-[#4D5528] shadow-sm hover:bg-[#F8F5EE]"
            >
              Export CSV
            </Button>
            <Button
              type="button"
              onClick={fetchOrders}
              className="rounded-xl bg-[#33381C] px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-[#4D5528]"
            >
              <RefreshCw className="h-4 w-4" />
              Refresh
            </Button>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <div
            role="button"
            tabIndex={0}
            onClick={() => activateMetric("all")}
            onKeyDown={(event) => handleMetricKeyDown(event, "all")}
            title="View all orders"
            className="cursor-pointer rounded-2xl border border-[#E7E0D4] bg-white p-5 shadow-[0_8px_24px_-18px_rgba(51,56,28,0.35)] transition hover:-translate-y-0.5 hover:border-[#CFC0A6] hover:shadow-md focus:outline-none focus:ring-2 focus:ring-[#A68D65]"
          >
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm font-medium text-[#73736A]">
                  Total orders
                </p>
                <p className="mt-2 text-3xl font-semibold text-[#33381C]">
                  {orders.length}
                </p>
              </div>
              <span className="rounded-xl bg-[#EEF0E5] p-2.5 text-[#4D5528]">
                <Package className="h-5 w-5" />
              </span>
            </div>
            <p className="mt-3 text-xs text-[#88877D]">All-time order volume</p>
          </div>
          <div
            role="button"
            tabIndex={0}
            onClick={() => activateMetric("all", "paid")}
            onKeyDown={(event) => handleMetricKeyDown(event, "all", "paid")}
            title="View paid orders"
            className="cursor-pointer rounded-2xl border border-[#E7E0D4] bg-white p-5 shadow-[0_8px_24px_-18px_rgba(51,56,28,0.35)] transition hover:-translate-y-0.5 hover:border-[#CFC0A6] hover:shadow-md focus:outline-none focus:ring-2 focus:ring-[#A68D65]"
          >
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm font-medium text-[#73736A]">
                  Order value
                </p>
                <p className="mt-2 text-3xl font-semibold text-[#33381C]">
                  {formatCurrency(totalRevenue)}
                </p>
              </div>
              <span className="rounded-xl bg-[#F8EEDB] p-2.5 text-[#A66A12]">
                <CircleDollarSign className="h-5 w-5" />
              </span>
            </div>
            <p className="mt-3 text-xs text-[#88877D]">
              {formatCurrency(paidRevenue)} successfully paid
            </p>
          </div>
          <div
            role="button"
            tabIndex={0}
            onClick={() => activateMetric("fulfillment")}
            onKeyDown={(event) => handleMetricKeyDown(event, "fulfillment")}
            title="View orders in fulfillment"
            className="cursor-pointer rounded-2xl border border-[#E7E0D4] bg-white p-5 shadow-[0_8px_24px_-18px_rgba(51,56,28,0.35)] transition hover:-translate-y-0.5 hover:border-[#CFC0A6] hover:shadow-md focus:outline-none focus:ring-2 focus:ring-[#A68D65]"
          >
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm font-medium text-[#73736A]">
                  In fulfillment
                </p>
                <p className="mt-2 text-3xl font-semibold text-[#33381C]">
                  {activeOrders}
                </p>
              </div>
              <span className="rounded-xl bg-[#E6F1F5] p-2.5 text-[#37748B]">
                <Truck className="h-5 w-5" />
              </span>
            </div>
            <p className="mt-3 text-xs text-[#88877D]">
              Processing, shipped, or out for delivery
            </p>
          </div>
          <div
            role="button"
            tabIndex={0}
            onClick={() => activateMetric("delivered")}
            onKeyDown={(event) => handleMetricKeyDown(event, "delivered")}
            title="View delivered orders"
            className="cursor-pointer rounded-2xl border border-[#E7E0D4] bg-white p-5 shadow-[0_8px_24px_-18px_rgba(51,56,28,0.35)] transition hover:-translate-y-0.5 hover:border-[#CFC0A6] hover:shadow-md focus:outline-none focus:ring-2 focus:ring-[#A68D65]"
          >
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm font-medium text-[#73736A]">Delivered</p>
                <p className="mt-2 text-3xl font-semibold text-[#33381C]">
                  {deliveredOrders}
                </p>
              </div>
              <span className="rounded-xl bg-[#E8F3E7] p-2.5 text-[#4E8253]">
                <CheckCircle2 className="h-5 w-5" />
              </span>
            </div>
            <p className="mt-3 text-xs text-[#88877D]">
              {filteredOrders.length} orders in current view
            </p>
          </div>
        </div>

        <div className="rounded-2xl border border-[#E7E0D4] bg-white p-3 shadow-[0_8px_24px_-18px_rgba(51,56,28,0.35)]">
          <div className="flex flex-col gap-3 xl:flex-row xl:items-center">
            <div className="relative min-w-0 flex-1">
              <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#99978D]" />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search customer, order ID, email, or tracking number"
                className="w-full rounded-xl border border-transparent bg-[#F8F6F1] py-3 pl-10 pr-4 text-sm text-[#33381C] outline-none transition placeholder:text-[#A3A095] focus:border-[#CFC0A6] focus:bg-white focus:ring-4 focus:ring-[#F1ECE3]"
              />
            </div>
            <div className="grid gap-2 sm:grid-cols-2 xl:flex">
              <label className="relative">
                <span className="sr-only">Filter fulfillment</span>
                <select
                  value={orderStatusFilter}
                  onChange={(event) => setOrderStatusFilter(event.target.value)}
                  className="h-11 w-full appearance-none rounded-xl border border-[#E7E0D4] bg-white py-2 pl-3 pr-9 text-sm font-medium text-[#5C5C54] outline-none focus:border-[#A68D65]"
                >
                  <option value="all">All fulfillment</option>
                  <option value="fulfillment">In fulfillment</option>
                  <option value="pending">Pending</option>
                  <option value="confirmed">Confirmed</option>
                  <option value="processing">Processing</option>
                  <option value="shipped">Shipped</option>
                  <option value="in_transit">In Transit</option>
                  <option value="out_for_delivery">Out for delivery</option>
                  <option value="delivered">Delivered</option>
                  <option value="cancelled">Cancelled</option>
                  <option value="returned">Returned</option>
                </select>
                <SlidersHorizontal className="pointer-events-none absolute right-3 top-3 h-4 w-4 text-[#8C887D]" />
              </label>
              <label className="relative">
                <span className="sr-only">Filter payment</span>
                <select
                  value={paymentStatusFilter}
                  onChange={(event) =>
                    setPaymentStatusFilter(event.target.value)
                  }
                  className="h-11 w-full appearance-none rounded-xl border border-[#E7E0D4] bg-white py-2 pl-3 pr-9 text-sm font-medium text-[#5C5C54] outline-none focus:border-[#A68D65]"
                >
                  <option value="all">All payments</option>
                  <option value="pending">Pending payment</option>
                  <option value="paid">Paid</option>
                  <option value="failed">Failed</option>
                  <option value="refunded">Refunded</option>
                </select>
                <CircleDollarSign className="pointer-events-none absolute right-3 top-3 h-4 w-4 text-[#8C887D]" />
              </label>
            </div>
            {filtersActive && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={clearFilters}
                className="h-10 rounded-xl text-[#75684E] hover:bg-[#F8F5EE] hover:text-[#33381C]"
              >
                Clear filters
              </Button>
            )}
          </div>
        </div>

        <div className="overflow-hidden rounded-2xl border border-[#E7E0D4] bg-white shadow-[0_8px_24px_-18px_rgba(51,56,28,0.35)]">
          <div className="flex flex-col gap-2 border-b border-[#EEE8DE] px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="font-sans text-base font-semibold text-[#33381C]">
                Order activity
              </h2>
              <p className="mt-0.5 text-sm text-[#817D73]">
                {loading
                  ? "Syncing your latest orders…"
                  : `${filteredOrders.length} ${filteredOrders.length === 1 ? "order" : "orders"} displayed`}
              </p>
            </div>
            <div className="flex items-center gap-2 text-xs font-medium text-[#75684E]">
              <Filter className="h-3.5 w-3.5" />
              {filtersActive ? "Filtered view" : "All orders"}
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-[1120px] w-full divide-y divide-[#EEE8DE]">
              <thead className="bg-[#FCFBF8]">
                <tr>
                  <th className="px-5 py-4 text-left text-[11px] font-bold uppercase tracking-[0.12em] text-[#827D72]">
                    Customer & order
                  </th>
                  <th className="px-5 py-4 text-left text-[11px] font-bold uppercase tracking-[0.12em] text-[#827D72]">
                    Payment
                  </th>
                  <th className="px-5 py-4 text-left text-[11px] font-bold uppercase tracking-[0.12em] text-[#827D72]">
                    Status
                  </th>
                  <th className="px-5 py-4 text-right text-[11px] font-bold uppercase tracking-[0.12em] text-[#827D72]">
                    Total
                  </th>
                  <th className="px-5 py-4 text-right text-[11px] font-bold uppercase tracking-[0.12em] text-[#827D72]">
                    Date
                  </th>
                  <th className="px-5 py-4 text-right text-[11px] font-bold uppercase tracking-[0.12em] text-[#827D72]">
                    Estimated
                  </th>
                  <th className="px-5 py-4 text-right text-[11px] font-bold uppercase tracking-[0.12em] text-[#827D72]">
                    Tracking
                  </th>
                  <th className="px-5 py-4 text-right text-[11px] font-bold uppercase tracking-[0.12em] text-[#827D72]">
                    Details
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F0ECE5]">
                {loading ? (
                  <tr>
                    <td
                      colSpan={8}
                      className="px-5 py-12 text-center text-sm text-[#817D73]"
                    >
                      Loading orders...
                    </td>
                  </tr>
                ) : error ? (
                  <tr>
                    <td
                      colSpan={8}
                      className="px-5 py-12 text-center text-sm text-rose-600"
                    >
                      {error}
                    </td>
                  </tr>
                ) : filteredOrders.length === 0 ? (
                  <tr>
                    <td
                      colSpan={8}
                      className="px-5 py-12 text-center text-sm text-[#817D73]"
                    >
                      No orders found.
                    </td>
                  </tr>
                ) : (
                  filteredOrders.map((order) => (
                    <tr
                      key={order.id}
                      className="cursor-pointer transition-colors hover:bg-[#FCFBF8]"
                      onClick={() => openOrderDetails(order)}
                    >
                      <td className="px-5 py-4 text-sm">
                        <div className="flex items-center gap-3">
                          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#EEF0E5] text-sm font-semibold text-[#4D5528]">
                            {getCustomerName(order).slice(0, 1).toUpperCase()}
                          </div>
                          <div>
                            <p className="font-semibold text-[#33381C]">
                              {getCustomerName(order)}
                            </p>
                            <p className="mt-1 text-[11px] font-semibold uppercase tracking-wide text-[#A09B90]">
                              Order #{getShortOrderId(order.id)}
                            </p>
                            <p className="mt-1 flex items-center gap-1 text-xs text-[#817D73]">
                              <Mail className="h-3.5 w-3.5" />
                              {getCustomer(order)?.email ||
                                "No email available"}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-4 text-sm capitalize text-slate-700">
                        <Badge
                          variant="outline"
                          className={`capitalize ${getPaymentStatusBadgeClass(getEffectivePaymentStatus(order))}`}
                        >
                          {formatStatus(getEffectivePaymentStatus(order))}
                        </Badge>
                      </td>
                      <td className="px-5 py-4 text-sm">
                        <Badge
                          className={`capitalize ${getOrderStatusBadgeClass(order.order_status)}`}
                        >
                          {formatStatus(order.order_status)}
                        </Badge>
                      </td>
                      <td className="px-5 py-4 text-right text-sm font-semibold text-[#4D5528]">
                        {formatCurrency(order.total_amount)}
                      </td>
                      <td className="px-5 py-4 text-right text-sm text-[#625F57]">
                        {formatOrderDate(order.created_at)}
                      </td>
                      <td className="px-5 py-4 text-right text-sm text-[#625F57]">
                        {formatOrderDate(order.estimated_delivery)}
                      </td>
                      <td className="px-5 py-4 text-right text-sm font-medium text-[#625F57]">
                        {order.tracking_number || "-"}
                      </td>
                      <td className="px-5 py-4 text-right">
                        <Button
                          variant="outline"
                          size="sm"
                          className="rounded-lg border-[#E4DCCF] bg-white text-[#4D5528] hover:bg-[#F8F5EE]"
                        >
                          <Eye className="h-4 w-4" />
                          View
                        </Button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

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
        <DialogContent className="max-h-[92vh] max-w-5xl overflow-y-auto border-[#E7E0D4] bg-[#FBF7F0] p-0 shadow-2xl">
          {selectedOrder && (
            <>
              <DialogHeader className="border-b border-[#E8E1D6] px-6 pb-5 pt-6 sm:px-8">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <div className="mb-2 flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.16em] text-[#7B8064]">
                      <ClipboardCheck className="h-4 w-4" />
                      Order workspace
                    </div>
                    <DialogTitle className="text-3xl text-[#2D311C]">
                      Order details
                    </DialogTitle>
                    <DialogDescription className="mt-1 text-[#777467]">
                      Review the customer, payment, and fulfillment record.
                    </DialogDescription>
                  </div>
                  <div className="rounded-xl border border-[#E5DDCE] bg-white/70 px-4 py-3 sm:text-right">
                    <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.16em] text-[#9A9589] sm:justify-end">
                      <Hash className="h-3.5 w-3.5" /> Order reference
                    </p>
                    <p className="mt-1 max-w-[220px] truncate font-mono text-xs text-[#4C5230]">
                      {selectedOrder.id}
                    </p>
                  </div>
                </div>
              </DialogHeader>

              <div className="grid gap-4 overflow-hidden px-6 pt-6 pb-6 sm:px-8 md:grid-cols-3">
                <div className="rounded-2xl border border-[#E5E8E3] bg-[#F5F7F5] p-5">
                  <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#7B8064]">
                    Customer
                  </p>
                  <div className="mt-3 flex items-start gap-3">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#E4E9DF] text-[#4D5528]">
                      <UserRound className="h-4 w-4" />
                    </div>
                    <div>
                      <p className="font-semibold text-[#303526]">
                        {getCustomerName(selectedOrder)}
                      </p>
                      <p className="mt-2 flex items-center gap-1.5 text-sm text-[#777D70]">
                        <Mail className="h-3.5 w-3.5" />
                        {getCustomer(selectedOrder)?.email ||
                          "No email available"}
                      </p>
                      {getCustomer(selectedOrder)?.phone && (
                        <p className="mt-1 text-sm text-[#777D70]">
                          {getCustomer(selectedOrder)?.phone}
                        </p>
                      )}
                      <p className="mt-3 flex items-start gap-1.5 text-sm leading-5 text-[#777D70]">
                        <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                        {selectedOrder.shipping_address
                          ? [
                              selectedOrder.shipping_address.line1,
                              selectedOrder.shipping_address.line2,
                              selectedOrder.shipping_address.city,
                              selectedOrder.shipping_address.state,
                              selectedOrder.shipping_address.pincode,
                              selectedOrder.shipping_address.country,
                            ]
                              .filter(Boolean)
                              .join(", ") || "No shipping address on file"
                          : "No shipping address on file"}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="overflow-hidden rounded-2xl border border-[#E8E5D9] bg-[#F8F7F1] p-5">
                  <p className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.14em] text-[#7B8064]">
                    <CreditCard className="h-4 w-4" />
                    Payment
                  </p>
                  <p className="mt-5 text-3xl font-semibold tracking-tight text-[#343A20]">
                    {formatCurrency(selectedOrder.total_amount)}
                  </p>
                  <Badge
                    variant="outline"
                    className={`mt-3 rounded-full px-3 py-1 capitalize ${getPaymentStatusBadgeClass(getEffectivePaymentStatus(selectedOrder))}`}
                  >
                    {formatStatus(getEffectivePaymentStatus(selectedOrder))}
                  </Badge>
                  <p className="mt-5 text-xs text-[#8C897E]">
                    {selectedOrder.payment_method ||
                      "Payment method unavailable"}
                  </p>
                </div>

                <div className="max-h-[550px] overflow-y-auto rounded-2xl border border-[#E5E8E3] bg-[#F5F7F5] p-5">
                  <p className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.14em] text-[#7B8064]">
                    <Truck className="h-4 w-4" />
                    Fulfillment & Shipping
                  </p>

                  {/* Order Status Section */}
                  <div className="mt-4 space-y-3 border-b border-[#E0E5DE] pb-4">
                    <div>
                      <p className="text-xs font-semibold text-[#777D70]">
                        Current Order Status
                      </p>
                      <div className="mt-2 flex items-center gap-2">
                        <Badge
                          className={`rounded-full px-3 py-1 capitalize ${getOrderStatusBadgeClass(
                            selectedOrder.order_status,
                          )}`}
                        >
                          {ORDER_STATUS_LABELS[
                            selectedOrder.order_status as OrderStatus
                          ] || formatStatus(selectedOrder.order_status)}
                        </Badge>
                      </div>
                      <p className="mt-1 text-xs text-[#888880]">
                        {getOrderStatusDescription(selectedOrder.order_status)}
                      </p>
                    </div>

                    {validOrderStatuses.length > 0 && (
                      <div>
                        <p className="text-xs font-semibold text-[#777D70]">
                          Change Order Status
                        </p>
                        <div className="mt-2 grid min-w-0 grid-cols-1 gap-2 xl:grid-cols-2">
                          {validOrderStatuses.map((status) => (
                            <Button
                              key={status}
                              variant="outline"
                              className="h-auto min-h-10 min-w-0 whitespace-normal break-words px-2 text-center text-xs leading-4 rounded-lg border-[#DADFD6] bg-white text-[#4D5528] hover:bg-[#EEF2EB]"
                              onClick={() =>
                                handleStatusChangeClick("order", status)
                              }
                              disabled={savingStatus}
                            >
                              →{" "}
                              {ORDER_STATUS_LABELS[status as OrderStatus] ||
                                formatStatus(status)}
                            </Button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Payment Status Section */}
                  <div className="mt-4 space-y-3 border-b border-[#E0E5DE] pb-4">
                    <div>
                      <p className="text-xs font-semibold text-[#777D70]">
                        Current Payment Status
                      </p>
                      <div className="mt-2">
                        <Badge
                          variant="outline"
                          className={`rounded-full px-3 py-1 capitalize ${getPaymentStatusBadgeClass(
                            getEffectivePaymentStatus(selectedOrder),
                          )}`}
                        >
                          {PAYMENT_STATUS_LABELS[
                            getEffectivePaymentStatus(selectedOrder)
                          ] || formatStatus(selectedOrder.payment_status)}
                        </Badge>
                      </div>
                    </div>

                    {validPaymentStatuses.length > 0 && (
                      <div>
                        <p className="text-xs font-semibold text-[#777D70]">
                          Change Payment Status
                        </p>
                        <div className="mt-2 grid min-w-0 grid-cols-1 gap-2 xl:grid-cols-2">
                          {validPaymentStatuses.map((status) => (
                            <Button
                              key={status}
                              variant="outline"
                              className="h-auto min-h-10 min-w-0 whitespace-normal break-words px-2 text-center text-xs leading-4 rounded-lg border-[#DADFD6] bg-white text-[#4D5528] hover:bg-[#EEF2EB]"
                              onClick={() =>
                                handleStatusChangeClick("payment", status)
                              }
                              disabled={savingStatus}
                            >
                              →{" "}
                              {PAYMENT_STATUS_LABELS[status as PaymentStatus] ||
                                formatStatus(status)}
                            </Button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Shipping Details Section */}
                  <div className="mt-4 space-y-3">
                    <label className="text-[11px] font-semibold text-[#777D70]">
                      Tracking Number
                    </label>
                    <input
                      type="text"
                      placeholder="Enter tracking number"
                      value={trackingNumber}
                      onChange={(e) => setTrackingNumber(e.target.value)}
                      className="w-full rounded-xl border border-[#DDE3DA] bg-white px-3 py-2.5 text-sm text-[#343A20] outline-none transition placeholder:text-[#B0AEA7] focus:border-[#7B8064] focus:ring-2 focus:ring-[#DDE7D7]"
                    />

                    {selectedOrder.order_status?.toLowerCase() !==
                      "delivered" && (
                      <>
                        <label className="text-[11px] font-semibold text-[#777D70]">
                          Estimated Delivery
                        </label>
                        <input
                          type="date"
                          value={estimatedDelivery}
                          onChange={(e) => setEstimatedDelivery(e.target.value)}
                          className="w-full rounded-xl border border-[#DDE3DA] bg-white px-3 py-2.5 text-sm text-[#343A20] outline-none transition focus:border-[#7B8064] focus:ring-2 focus:ring-[#DDE7D7]"
                        />
                      </>
                    )}

                    <Button
                      variant="ghost"
                      size="sm"
                      className="flex items-center gap-2 text-[#777D70] hover:bg-[#E8EBE6] hover:text-[#4D5528]"
                      onClick={() => setShowHistory(true)}
                    >
                      <History className="h-4 w-4" />
                      Show Status History
                    </Button>
                  </div>
                </div>
              </div>

              <div className="overflow-hidden rounded-2xl border border-[#E5DDCE] bg-white shadow-sm">
                <div className="flex items-center justify-between border-b border-[#EEE8DE] bg-[#F8F5EE] px-5 py-4">
                  <div>
                    <p className="flex items-center gap-2 font-semibold text-[#303526]">
                      <Package className="h-4 w-4 text-[#7B8064]" />
                      Products
                    </p>
                    <p className="mt-1 text-sm text-[#8A877C]">
                      {detailsLoading
                        ? "Loading line items..."
                        : detailsLoaded
                          ? `${selectedItems.length} line items`
                          : "0 line items"}
                    </p>
                  </div>
                </div>

                {detailsLoading ? (
                  <div className="flex items-center justify-center gap-3 p-10 text-sm text-[#8A877C]">
                    <RefreshCw className="h-4 w-4 animate-spin" />
                    Loading order products...
                  </div>
                ) : detailsError ? (
                  <div className="space-y-3 p-10 text-center text-sm text-red-600">
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
                      Retry
                    </Button>
                  </div>
                ) : selectedItems.length === 0 ? (
                  <div className="p-10 text-center text-sm text-[#8A877C]">
                    No items found for this order.
                  </div>
                ) : (
                  <div className="divide-y divide-[#F0ECE5]">
                    {selectedItems.map((item) => (
                      <div
                        key={item.id}
                        className="flex flex-col gap-4 p-5 transition-colors hover:bg-[#FCFBF8] sm:flex-row sm:items-center sm:justify-between"
                      >
                        <div className="flex items-center gap-3">
                          {item.product_image ? (
                            <img
                              src={item.product_image}
                              alt={item.product_name || "Product"}
                              className="h-16 w-16 rounded-xl border border-[#E8E1D6] object-cover"
                            />
                          ) : (
                            <div className="flex h-16 w-16 items-center justify-center rounded-xl border border-[#E8E1D6] bg-[#F8F5EE] text-[#AAA497]">
                              <Package className="h-5 w-5" />
                            </div>
                          )}
                          <div>
                            <p className="font-semibold text-[#303526]">
                              {item.product_name || "Product"}
                            </p>
                            <p className="mt-1 text-sm text-[#8A877C]">
                              Qty {item.quantity || 0}
                            </p>
                          </div>
                        </div>
                        <div className="text-left sm:text-right">
                          <p className="font-semibold text-[#4D5528]">
                            {formatCurrency(item.price)}
                          </p>
                          <p className="mt-1 text-xs text-[#9A9589]">
                            Line total{" "}
                            {formatCurrency(
                              Number(item.price || 0) *
                                Number(item.quantity || 0),
                            )}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={showHistory} onOpenChange={setShowHistory}>
        <DialogContent className="max-h-[85vh] overflow-y-auto border-[#E7E0D4] bg-[#FBF7F0] sm:max-w-2xl">
          <DialogHeader className="border-b border-[#E8E1D6] pb-4">
            <DialogTitle className="flex items-center gap-2 text-[#2D311C]">
              <History className="h-5 w-5 text-[#7B8064]" />
              Order Status History
            </DialogTitle>
            <DialogDescription className="text-[#777467]">
              Timeline for order #{getShortOrderId(selectedOrder?.id)}
            </DialogDescription>
          </DialogHeader>

          {selectedOrder?.history && selectedOrder.history.length > 0 ? (
            <div className="relative py-2">
              <div className="absolute bottom-6 left-[15px] top-6 w-px bg-[#D8DED2]" />
              <div className="space-y-6">
                {selectedOrder.history.map((entry, idx) => (
                  <div key={entry.id} className="relative flex gap-4">
                    <div className="z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-4 border-[#FBF7F0] bg-[#7B8064] text-xs font-bold text-white">
                      {selectedOrder.history.length - idx}
                    </div>
                    <div className="min-w-0 flex-1 rounded-xl border border-[#E5E8E3] bg-white p-4 shadow-sm">
                      <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
                        <p className="font-semibold capitalize text-[#303526]">
                          {ORDER_STATUS_LABELS[entry.status as OrderStatus] ||
                            formatStatus(entry.status)}
                        </p>
                        <p className="shrink-0 text-xs text-[#8A877C]">
                          {formatOrderDate(entry.created_at)}
                        </p>
                      </div>
                      <p className="mt-2 text-sm text-[#777D70]">
                        {entry.notes || "Status updated"}
                      </p>
                      <p className="mt-2 text-xs text-[#A09B90]">
                        Updated by {entry.changed_by_name || "Unknown"}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-[#D8DED2] bg-white p-8 text-center text-sm text-[#8A877C]">
              No status history is available for this order yet.
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Confirmation Dialog for Status Changes */}
      <Dialog
        open={confirmDialog.open}
        onOpenChange={(open) => {
          if (!open) {
            setConfirmDialog({
              open: false,
              action: null,
              newStatus: "",
              reason: "",
            });
          }
        }}
      >
        <DialogContent className="sm:max-w-md border-[#E7E0D4] bg-[#FBF7F0]">
          <DialogHeader>
            <DialogTitle className="text-[#2D311C]">
              Confirm Status Change
            </DialogTitle>
            <DialogDescription className="text-[#777467]">
              Are you sure you want to change this{" "}
              {confirmDialog.action === "order" ? "order" : "payment"} status?
            </DialogDescription>
          </DialogHeader>

          {selectedOrder && (
            <div className="space-y-4 py-4">
              <div className="rounded-lg bg-[#F5F7F5] p-4">
                <p className="text-xs font-semibold text-[#777D70]">
                  {confirmDialog.action === "order"
                    ? "Order Status"
                    : "Payment Status"}
                </p>
                <p className="mt-2 font-semibold text-[#303526]">
                  {confirmDialog.action === "order"
                    ? ORDER_STATUS_LABELS[
                        selectedOrder.order_status as OrderStatus
                      ] || formatStatus(selectedOrder.order_status)
                    : PAYMENT_STATUS_LABELS[
                        getEffectivePaymentStatus(selectedOrder)
                      ] || formatStatus(selectedOrder.payment_status)}
                  {" → "}
                  {confirmDialog.action === "order"
                    ? ORDER_STATUS_LABELS[
                        confirmDialog.newStatus as OrderStatus
                      ] || formatStatus(confirmDialog.newStatus)
                    : PAYMENT_STATUS_LABELS[
                        confirmDialog.newStatus as PaymentStatus
                      ] || formatStatus(confirmDialog.newStatus)}
                </p>
              </div>

              <div>
                <label className="text-sm font-semibold text-[#777D70]">
                  Reason (optional)
                </label>
                <textarea
                  value={confirmDialog.reason}
                  onChange={(e) =>
                    setConfirmDialog((prev) => ({
                      ...prev,
                      reason: e.target.value,
                    }))
                  }
                  placeholder="Enter reason for this status change..."
                  className="mt-2 w-full rounded-xl border border-[#DDE3DA] bg-white px-3 py-2.5 text-sm text-[#343A20] outline-none transition placeholder:text-[#B0AEA7] focus:border-[#7B8064] focus:ring-2 focus:ring-[#DDE7D7]"
                  rows={3}
                />
              </div>

              {isTrackingNumberRequired(confirmDialog.newStatus) &&
                confirmDialog.action === "order" &&
                !trackingNumber && (
                  <div className="flex gap-2 rounded-lg border border-amber-300 bg-amber-50 p-3">
                    <AlertCircle className="h-5 w-5 shrink-0 text-amber-600" />
                    <p className="text-sm text-amber-800">
                      Tracking number is required for{" "}
                      {formatStatus(confirmDialog.newStatus)} status.
                    </p>
                  </div>
                )}
            </div>
          )}

          <div className="flex gap-3">
            <Button
              variant="outline"
              className="rounded-xl border-[#DADFD6] bg-white text-[#4D5528] hover:bg-[#EEF2EB]"
              onClick={() =>
                setConfirmDialog({
                  open: false,
                  action: null,
                  newStatus: "",
                  reason: "",
                })
              }
              disabled={savingStatus}
            >
              Cancel
            </Button>
            <Button
              className="flex-1 rounded-xl bg-[#353D1E] text-white shadow-sm hover:bg-[#4D5528]"
              onClick={confirmStatusChange}
              disabled={
                savingStatus ||
                (isTrackingNumberRequired(confirmDialog.newStatus) &&
                  confirmDialog.action === "order" &&
                  !trackingNumber)
              }
            >
              {savingStatus ? "Updating..." : "Confirm Change"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}
