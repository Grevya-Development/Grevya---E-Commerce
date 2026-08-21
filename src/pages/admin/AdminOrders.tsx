import { useEffect, useMemo, useState } from "react";
import {
  CheckCircle2,
  CircleDollarSign,
  Eye,
  Filter,
  Mail,
  Package,
  RefreshCw,
  Search,
  SlidersHorizontal,
  Truck,
  UserRound,
  AlertCircle,
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

interface Order {
  id: string;
  user_id?: string | null;
  total_amount?: number | null;
  order_status?: string | null;
  payment_status?: string | null;
  tracking_number?: string | null;
  estimated_delivery?: string | null;
  created_at?: string | null;
  shipping_address?: any;
  payment_method?: string | null;
  transaction_reference?: string | null;
  internal_notes?: string | null;
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

interface ProductSummary {
  id: string;
  name?: string | null;
  image_url?: string | null;
}

const formatCurrency = (value?: number | null) =>
  `₹${Number(value || 0).toFixed(2)}`;

const formatStatus = (value?: string | null) =>
  (value || "pending").replace(/_/g, " ");

const getOrderStatusBadgeClass = (value?: string | null) => {
  const status = (value || "pending").toLowerCase();
  if (["delivered"].includes(status))
    return "bg-emerald-100 text-emerald-700 hover:bg-emerald-100";
  if (["shipped", "out for delivery", "processing"].includes(status))
    return "bg-sky-100 text-sky-700 hover:bg-sky-100";
  if (["cancelled", "refunded"].includes(status))
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
  const [deliveryInputs, setDeliveryInputs] = useState<
    Record<
      string,
      {
        estimated_delivery?: string | null;
        tracking_number?: string | null;
        payment_status?: string | null;
        order_status?: string | null;
      }
    >
  >({});
  const [savingDelivery, setSavingDelivery] = useState<string | null>(null);
  const [savingStatus, setSavingStatus] = useState(false);

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
    setLoading(true);
    setError(null);

    const { data, error: fetchError } = await supabase
      .from("orders")
      .select(
        "id,created_at,user_id,total_amount,payment_status,status,estimated_delivery,tracking_number,shipping_address,payment_method,payment_reference",
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
        transaction_reference: r.payment_reference,
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
  };

  useEffect(() => {
    fetchOrders();
  }, []);

  const filteredOrders = useMemo(() => {
    const term = search.trim().toLowerCase();
    return orders.filter((order) => {
      const matchesSearch = !term || [
        order.id, getCustomerName(order), getCustomer(order)?.email || "",
        getCustomer(order)?.phone || "", order.order_status || "", order.payment_status || "",
      ].join(" ").toLowerCase().includes(term);
      const matchesOrderStatus = orderStatusFilter === "all" || (order.order_status || "pending").toLowerCase() === orderStatusFilter;
      const matchesPaymentStatus = paymentStatusFilter === "all" || (order.payment_status || "pending").toLowerCase() === paymentStatusFilter;
      return matchesSearch && matchesOrderStatus && matchesPaymentStatus;
    });
  }, [orders, profilesById, search, orderStatusFilter, paymentStatusFilter]);

  const openOrderDetails = async (order: Order) => {
    setSelectedOrder(order);
    setDetailsLoading(true);
    setDetailsError(null);
    setDetailsLoaded(false);
    setSelectedItems([]);

    const { data, error: itemsError } = await supabase
      .from("order_items")
      .select("id,product_id,quantity,price")
      .eq("order_id", order.id)
      .order("created_at", { ascending: true });

    if (itemsError) {
      setDetailsError(itemsError.message);
      setDetailsLoaded(true);
    } else {
      const itemRows = (data as OrderItem[] | null) || [];
      const productIds = Array.from(
        new Set(itemRows.map((item) => item.product_id).filter(Boolean)),
      ) as string[];

      let productsById: Record<string, ProductSummary> = {};

      if (productIds.length) {
        const { data: productRows } = await supabase
          .from("products")
          .select("id,name,image_url")
          .in("id", productIds);

        productsById = ((productRows as ProductSummary[] | null) || []).reduce<
          Record<string, ProductSummary>
        >((acc, product) => {
          acc[String(product.id)] = product;
          return acc;
        }, {});
      }

      setSelectedItems(
        itemRows.map((item) => {
          const product = item.product_id
            ? productsById[String(item.product_id)]
            : undefined;

          return {
            ...item,
            product_name: product?.name || null,
            product_image: product?.image_url || null,
          };
        }),
      );
    }

    setDetailsLoaded(true);
    setDetailsLoading(false);
    // initialize delivery inputs for this order
    setDeliveryInputs((s) => ({
      ...s,
      [order.id]: {
        estimated_delivery: order.estimated_delivery || null,
        tracking_number: order.tracking_number || null,
      },
    }));
  };

  const saveDeliveryInfo = async () => {
    if (!selectedOrder) return;
    const orderId = selectedOrder.id;
    const inputs = deliveryInputs[orderId] || {};
    setSavingDelivery(orderId);
    try {
      const payload: any = {};
      if (inputs.estimated_delivery) {
        const d = new Date(inputs.estimated_delivery as string);
        if (!isNaN(d.getTime())) payload.estimated_delivery = d.toISOString();
        else payload.estimated_delivery = null;
      } else {
        payload.estimated_delivery = null;
      }
      payload.tracking_number = inputs.tracking_number || null;

      const { error } = await supabase
        .from("orders")
        .update(payload)
        .eq("id", orderId);
      if (error) throw error;

      toast({
        title: "Saved",
        description: "Delivery info updated",
        variant: "default",
      });
      // refresh orders list and selectedOrder
      await fetchOrders();
      const { data: refreshed } = await supabase
        .from("orders")
        .select(
          "id,created_at,user_id,total_amount,payment_status,status,estimated_delivery,tracking_number,shipping_address,payment_method,payment_reference",
        )
        .eq("id", orderId)
        .single();
      if (refreshed)
        setSelectedOrder({
          ...(refreshed as any),
          order_status: (refreshed as any).status,
          transaction_reference: (refreshed as any).payment_reference,
        } as Order);
    } catch (err: any) {
      console.error(err);
      toast({
        title: "Save failed",
        description: err?.message || "Unable to save",
        variant: "destructive",
      });
    } finally {
      setSavingDelivery(null);
    }
  };

  const updateOrderState = async () => {
    if (!selectedOrder) return;

    setSavingStatus(true);
    try {
      const nextPaymentStatus =
        deliveryInputs[selectedOrder.id]?.payment_status ||
        selectedOrder.payment_status ||
        "pending";
      const nextOrderStatus =
        deliveryInputs[selectedOrder.id]?.order_status ||
        selectedOrder.order_status ||
        "pending";

      const { error } = await supabase
        .from("orders")
        .update({
          payment_status: nextPaymentStatus,
          status: nextOrderStatus,
        })
        .eq("id", selectedOrder.id);

      if (error) throw error;

      toast({
        title: "Updated",
        description: "Order status and payment status saved",
        variant: "default",
      });

      await fetchOrders();
      const { data: refreshed } = await supabase
        .from("orders")
        .select(
          "id,created_at,user_id,total_amount,payment_status,status,estimated_delivery,tracking_number,shipping_address,payment_method,payment_reference",
        )
        .eq("id", selectedOrder.id)
        .single();
      if (refreshed)
        setSelectedOrder({
          ...(refreshed as any),
          order_status: (refreshed as any).status,
          transaction_reference: (refreshed as any).payment_reference,
        } as Order);
    } catch (err: any) {
      console.error(err);
      toast({
        title: "Update failed",
        description: err?.message || "Unable to update order state",
        variant: "destructive",
      });
    } finally {
      setSavingStatus(false);
    }
  };

  const exportOrders = () => {
    const rows = filteredOrders.map((order) => ({
      id: order.id,
      customer: getCustomerName(order),
      email: getCustomer(order)?.email || "",
      phone: getCustomer(order)?.phone || "",
      payment_status: formatStatus(order.payment_status),
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
  const paidRevenue = orders.filter((order) => (order.payment_status || "").toLowerCase() === "paid").reduce((sum, order) => sum + Number(order.total_amount || 0), 0);
  const activeOrders = orders.filter((order) => ["processing", "shipped", "out for delivery"].includes((order.order_status || "").toLowerCase())).length;
  const deliveredOrders = orders.filter((order) => (order.order_status || "").toLowerCase() === "delivered").length;
  const filtersActive = orderStatusFilter !== "all" || paymentStatusFilter !== "all";

  const clearFilters = () => {
    setSearch("");
    setOrderStatusFilter("all");
    setPaymentStatusFilter("all");
  };

  return (
    <AdminLayout>
      <div className="mx-auto max-w-[1500px] space-y-7">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.2em] text-[#A68D65]">Operations / Customer orders</p>
            <h1 className="text-4xl font-semibold text-[#33381C]">Order desk</h1>
            <p className="mt-2 text-sm text-[#5C5C54] md:text-base">
              Keep every order, payment, and delivery moving with confidence.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
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
          <div className="rounded-2xl border border-[#E7E0D4] bg-white p-5 shadow-[0_8px_24px_-18px_rgba(51,56,28,0.35)]"><div className="flex items-start justify-between"><div><p className="text-sm font-medium text-[#73736A]">Total orders</p><p className="mt-2 text-3xl font-semibold text-[#33381C]">{orders.length}</p></div><span className="rounded-xl bg-[#EEF0E5] p-2.5 text-[#4D5528]"><Package className="h-5 w-5" /></span></div><p className="mt-3 text-xs text-[#88877D]">All-time order volume</p></div>
          <div className="rounded-2xl border border-[#E7E0D4] bg-white p-5 shadow-[0_8px_24px_-18px_rgba(51,56,28,0.35)]"><div className="flex items-start justify-between"><div><p className="text-sm font-medium text-[#73736A]">Order value</p><p className="mt-2 text-3xl font-semibold text-[#33381C]">{formatCurrency(totalRevenue)}</p></div><span className="rounded-xl bg-[#F8EEDB] p-2.5 text-[#A66A12]"><CircleDollarSign className="h-5 w-5" /></span></div><p className="mt-3 text-xs text-[#88877D]">{formatCurrency(paidRevenue)} successfully paid</p></div>
          <div className="rounded-2xl border border-[#E7E0D4] bg-white p-5 shadow-[0_8px_24px_-18px_rgba(51,56,28,0.35)]"><div className="flex items-start justify-between"><div><p className="text-sm font-medium text-[#73736A]">In fulfillment</p><p className="mt-2 text-3xl font-semibold text-[#33381C]">{activeOrders}</p></div><span className="rounded-xl bg-[#E6F1F5] p-2.5 text-[#37748B]"><Truck className="h-5 w-5" /></span></div><p className="mt-3 text-xs text-[#88877D]">Processing, shipped, or out for delivery</p></div>
          <div className="rounded-2xl border border-[#E7E0D4] bg-white p-5 shadow-[0_8px_24px_-18px_rgba(51,56,28,0.35)]"><div className="flex items-start justify-between"><div><p className="text-sm font-medium text-[#73736A]">Delivered</p><p className="mt-2 text-3xl font-semibold text-[#33381C]">{deliveredOrders}</p></div><span className="rounded-xl bg-[#E8F3E7] p-2.5 text-[#4E8253]"><CheckCircle2 className="h-5 w-5" /></span></div><p className="mt-3 text-xs text-[#88877D]">{filteredOrders.length} orders in current view</p></div>
        </div>

        <div className="rounded-2xl border border-[#E7E0D4] bg-white p-3 shadow-[0_8px_24px_-18px_rgba(51,56,28,0.35)]"><div className="flex flex-col gap-3 xl:flex-row xl:items-center"><div className="relative min-w-0 flex-1"><Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#99978D]" /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search customer, order ID, email, or tracking number" className="w-full rounded-xl border border-transparent bg-[#F8F6F1] py-3 pl-10 pr-4 text-sm text-[#33381C] outline-none transition placeholder:text-[#A3A095] focus:border-[#CFC0A6] focus:bg-white focus:ring-4 focus:ring-[#F1ECE3]" /></div><div className="grid gap-2 sm:grid-cols-2 xl:flex"><label className="relative"><span className="sr-only">Filter fulfillment</span><select value={orderStatusFilter} onChange={(event) => setOrderStatusFilter(event.target.value)} className="h-11 w-full appearance-none rounded-xl border border-[#E7E0D4] bg-white py-2 pl-3 pr-9 text-sm font-medium text-[#5C5C54] outline-none focus:border-[#A68D65]"><option value="all">All fulfillment</option><option value="pending">Pending</option><option value="processing">Processing</option><option value="shipped">Shipped</option><option value="out for delivery">Out for delivery</option><option value="delivered">Delivered</option><option value="cancelled">Cancelled</option></select><SlidersHorizontal className="pointer-events-none absolute right-3 top-3 h-4 w-4 text-[#8C887D]" /></label><label className="relative"><span className="sr-only">Filter payment</span><select value={paymentStatusFilter} onChange={(event) => setPaymentStatusFilter(event.target.value)} className="h-11 w-full appearance-none rounded-xl border border-[#E7E0D4] bg-white py-2 pl-3 pr-9 text-sm font-medium text-[#5C5C54] outline-none focus:border-[#A68D65]"><option value="all">All payments</option><option value="pending">Pending payment</option><option value="paid">Paid</option><option value="failed">Failed</option><option value="refunded">Refunded</option></select><CircleDollarSign className="pointer-events-none absolute right-3 top-3 h-4 w-4 text-[#8C887D]" /></label></div>{filtersActive && <Button type="button" variant="ghost" size="sm" onClick={clearFilters} className="h-10 rounded-xl text-[#75684E] hover:bg-[#F8F5EE] hover:text-[#33381C]">Clear filters</Button>}</div></div>

        <div className="overflow-hidden rounded-2xl border border-[#E7E0D4] bg-white shadow-[0_8px_24px_-18px_rgba(51,56,28,0.35)]"><div className="flex flex-col gap-2 border-b border-[#EEE8DE] px-5 py-4 sm:flex-row sm:items-center sm:justify-between"><div><h2 className="font-sans text-base font-semibold text-[#33381C]">Order activity</h2><p className="mt-0.5 text-sm text-[#817D73]">{loading ? "Syncing your latest orders…" : `${filteredOrders.length} ${filteredOrders.length === 1 ? "order" : "orders"} displayed`}</p></div><div className="flex items-center gap-2 text-xs font-medium text-[#75684E]"><Filter className="h-3.5 w-3.5" />{filtersActive ? "Filtered view" : "All orders"}</div></div><div className="overflow-x-auto">
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
                            {getCustomer(order)?.email || "No email available"}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-4 text-sm capitalize text-slate-700">
                      <Badge
                        variant="outline"
                        className={`capitalize ${getPaymentStatusBadgeClass(order.payment_status)}`}
                      >
                        {formatStatus(order.payment_status)}
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
                      <Button variant="outline" size="sm" className="rounded-lg border-[#E4DCCF] bg-white text-[#4D5528] hover:bg-[#F8F5EE]">
                        <Eye className="h-4 w-4" />
                        View
                      </Button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table></div>
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
        <DialogContent className="max-h-[90vh] max-w-4xl overflow-y-auto">
          {selectedOrder && (
            <>
              <DialogHeader>
                <DialogTitle className="text-2xl">Order details</DialogTitle>
                <DialogDescription>
                  Complete customer, payment, and product summary.
                </DialogDescription>
              </DialogHeader>

              <div className="grid gap-4 md:grid-cols-3">
                <div className="rounded-xl border bg-slate-50 p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Customer
                  </p>
                  <div className="mt-3 flex items-start gap-3">
                    <UserRound className="mt-0.5 h-5 w-5 text-green-700" />
                    <div>
                      <p className="font-semibold text-slate-900">
                        {getCustomerName(selectedOrder)}
                      </p>
                      <p className="mt-1 text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
                        #{selectedOrder.id}
                      </p>
                      <p className="mt-1 text-sm text-slate-500">
                        {getCustomer(selectedOrder)?.email ||
                          "No email available"}
                      </p>
                      {getCustomer(selectedOrder)?.phone && (
                        <p className="mt-1 text-sm text-slate-500">
                          {getCustomer(selectedOrder)?.phone}
                        </p>
                      )}
                      <p className="mt-2 text-sm text-slate-500">
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

                <div className="rounded-xl border bg-slate-50 p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Payment
                  </p>
                  <p className="mt-3 text-2xl font-bold text-green-800">
                    {formatCurrency(selectedOrder.total_amount)}
                  </p>
                  <Badge
                    variant="outline"
                    className={`mt-2 capitalize ${getPaymentStatusBadgeClass(selectedOrder.payment_status)}`}
                  >
                    {formatStatus(selectedOrder.payment_status)}
                  </Badge>
                </div>

                <div className="rounded-xl border bg-slate-50 p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Fulfillment
                  </p>
                  <Badge
                    className={`mt-3 capitalize ${getOrderStatusBadgeClass(selectedOrder.order_status)}`}
                  >
                    {formatStatus(selectedOrder.order_status)}
                  </Badge>
                  <p className="mt-3 text-sm text-slate-500">
                    {formatOrderDate(selectedOrder.created_at, true)}
                  </p>
                  <div className="mt-4 space-y-2">
                    <label className="text-xs text-slate-500">
                      Payment status
                    </label>
                    <select
                      value={
                        deliveryInputs[selectedOrder.id]?.payment_status ||
                        selectedOrder.payment_status ||
                        "pending"
                      }
                      onChange={(e) =>
                        setDeliveryInputs((s) => ({
                          ...s,
                          [selectedOrder.id]: {
                            ...(s[selectedOrder.id] || {}),
                            payment_status: e.target.value,
                          },
                        }))
                      }
                      className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm"
                    >
                      <option value="pending">Pending</option>
                      <option value="paid">Paid</option>
                      <option value="failed">Failed</option>
                      <option value="refunded">Refunded</option>
                    </select>

                    <label className="text-xs text-slate-500">
                      Order status
                    </label>
                    <select
                      value={
                        deliveryInputs[selectedOrder.id]?.order_status ||
                        selectedOrder.order_status ||
                        "pending"
                      }
                      onChange={(e) =>
                        setDeliveryInputs((s) => ({
                          ...s,
                          [selectedOrder.id]: {
                            ...(s[selectedOrder.id] || {}),
                            order_status: e.target.value,
                          },
                        }))
                      }
                      className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm"
                    >
                      <option value="pending">Pending</option>
                      <option value="processing">Processing</option>
                      <option value="shipped">Shipped</option>
                      <option value="out for delivery">Out for delivery</option>
                      <option value="delivered">Delivered</option>
                      <option value="cancelled">Cancelled</option>
                    </select>

                    <label className="text-xs text-slate-500">
                      Estimated delivery
                    </label>
                    <input
                      type="date"
                      value={
                        deliveryInputs[selectedOrder.id]?.estimated_delivery ||
                        ""
                      }
                      onChange={(e) =>
                        setDeliveryInputs((s) => ({
                          ...s,
                          [selectedOrder.id]: {
                            ...(s[selectedOrder.id] || {}),
                            estimated_delivery: e.target.value,
                          },
                        }))
                      }
                      className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm"
                    />

                    <label className="text-xs text-slate-500">
                      Tracking number
                    </label>
                    <input
                      type="text"
                      placeholder="Enter tracking number"
                      value={
                        deliveryInputs[selectedOrder.id]?.tracking_number || ""
                      }
                      onChange={(e) =>
                        setDeliveryInputs((s) => ({
                          ...s,
                          [selectedOrder.id]: {
                            ...(s[selectedOrder.id] || {}),
                            tracking_number: e.target.value,
                          },
                        }))
                      }
                      className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm"
                    />

                    <div className="mt-2 flex flex-wrap gap-2">
                      <Button
                        onClick={saveDeliveryInfo}
                        disabled={Boolean(savingDelivery)}
                      >
                        {savingDelivery ? "Saving..." : "Save delivery info"}
                      </Button>
                      <Button
                        variant="outline"
                        onClick={updateOrderState}
                        disabled={Boolean(savingStatus)}
                      >
                        {savingStatus ? "Updating..." : "Update status"}
                      </Button>
                    </div>
                  </div>
                </div>
              </div>

              <div className="rounded-xl border">
                <div className="flex items-center justify-between border-b bg-slate-50 px-4 py-3">
                  <div>
                    <p className="font-semibold text-slate-900">Products</p>
                    <p className="text-sm text-slate-500">
                      {detailsLoading
                        ? "Loading line items..."
                        : detailsLoaded
                          ? `${selectedItems.length} line items`
                          : "0 line items"}
                    </p>
                  </div>
                  <Package className="h-5 w-5 text-slate-400" />
                </div>

                {detailsLoading ? (
                  <div className="flex items-center justify-center gap-3 p-8 text-sm text-slate-500">
                    <RefreshCw className="h-4 w-4 animate-spin" />
                    Loading order products...
                  </div>
                ) : detailsError ? (
                  <div className="space-y-3 p-8 text-center text-sm text-red-600">
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
                  <div className="p-8 text-center text-sm text-slate-500">
                    No items found for this order.
                  </div>
                ) : (
                  <div className="divide-y">
                    {selectedItems.map((item) => (
                      <div
                        key={item.id}
                        className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between"
                      >
                        <div className="flex items-center gap-3">
                          {item.product_image ? (
                            <img
                              src={item.product_image}
                              alt={item.product_name || "Product"}
                              className="h-14 w-14 rounded-lg object-cover"
                            />
                          ) : (
                            <div className="flex h-14 w-14 items-center justify-center rounded-lg bg-slate-100 text-slate-400">
                              <Package className="h-5 w-5" />
                            </div>
                          )}
                          <div>
                            <p className="font-medium text-slate-900">
                              {item.product_name || "Product"}
                            </p>
                            <p className="text-sm text-slate-500">
                              Qty {item.quantity || 0}
                            </p>
                          </div>
                        </div>
                        <div className="text-left sm:text-right">
                          <p className="font-semibold text-green-800">
                            {formatCurrency(item.price)}
                          </p>
                          <p className="text-xs text-slate-500">
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
    </AdminLayout>
  );
}
