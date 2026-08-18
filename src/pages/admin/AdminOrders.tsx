import { useEffect, useMemo, useState } from "react";
import {
  Eye,
  Mail,
  Package,
  RefreshCw,
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
    if (!term) return orders;

    return orders.filter((order) =>
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
        .includes(term),
    );
  }, [orders, profilesById, search]);

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

  return (
    <AdminLayout>
      <div className="space-y-8">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <h1 className="text-3xl font-bold text-green-900">Orders</h1>
            <p className="text-gray-600 mt-2">
              View customer orders, payment status, and fulfillment status.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={exportOrders}
              className="rounded-full border-green-200 bg-white px-5 py-3 text-sm font-semibold text-green-700 hover:bg-green-50"
            >
              Export CSV
            </Button>
            <Button
              type="button"
              onClick={fetchOrders}
              className="rounded-full bg-green-700 px-5 py-3 text-sm font-semibold text-white transition hover:bg-green-800"
            >
              <RefreshCw className="h-4 w-4" />
              Refresh
            </Button>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <div className="rounded-2xl border border-green-100 bg-white p-5 shadow-sm">
            <p className="text-sm font-medium text-gray-500">Total Orders</p>
            <p className="mt-3 text-3xl font-semibold text-green-900">
              {orders.length}
            </p>
          </div>
          <div className="rounded-2xl border border-green-100 bg-white p-5 shadow-sm">
            <p className="text-sm font-medium text-gray-500">Revenue</p>
            <p className="mt-3 text-3xl font-semibold text-green-700">
              {formatCurrency(totalRevenue)}
            </p>
          </div>
          <div className="rounded-2xl border border-green-100 bg-white p-5 shadow-sm">
            <p className="text-sm font-medium text-gray-500">Shown</p>
            <p className="mt-3 text-3xl font-semibold text-blue-600">
              {filteredOrders.length}
            </p>
          </div>
        </div>

        <input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search by customer name, email, phone, payment, or status..."
          className="w-full rounded-full border border-slate-200 bg-white px-4 py-3 text-sm shadow-sm focus:border-emerald-300 focus:outline-none focus:ring-2 focus:ring-emerald-100"
        />

        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <table className="min-w-full divide-y divide-slate-200">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-5 py-4 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Customer
                </th>
                <th className="px-5 py-4 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Payment
                </th>
                <th className="px-5 py-4 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Status
                </th>
                <th className="px-5 py-4 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Total
                </th>
                <th className="px-5 py-4 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Date
                </th>
                <th className="px-5 py-4 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Estimated
                </th>
                <th className="px-5 py-4 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Tracking
                </th>
                <th className="px-5 py-4 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Details
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td
                    colSpan={8}
                    className="px-5 py-12 text-center text-sm text-slate-500"
                  >
                    Loading orders...
                  </td>
                </tr>
              ) : error ? (
                <tr>
                  <td
                    colSpan={8}
                    className="px-5 py-12 text-center text-sm text-red-600"
                  >
                    {error}
                  </td>
                </tr>
              ) : filteredOrders.length === 0 ? (
                <tr>
                  <td
                    colSpan={8}
                    className="px-5 py-12 text-center text-sm text-slate-500"
                  >
                    No orders found.
                  </td>
                </tr>
              ) : (
                filteredOrders.map((order) => (
                  <tr
                    key={order.id}
                    className="cursor-pointer hover:bg-slate-50"
                    onClick={() => openOrderDetails(order)}
                  >
                    <td className="px-5 py-4 text-sm">
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-green-100 text-sm font-semibold text-green-800">
                          {getCustomerName(order).slice(0, 1).toUpperCase()}
                        </div>
                        <div>
                          <p className="font-medium text-slate-900">
                            {getCustomerName(order)}
                          </p>
                          <p className="mt-1 text-[11px] font-medium uppercase tracking-wide text-slate-400">
                            {getShortOrderId(order.id)}
                          </p>
                          <p className="mt-1 flex items-center gap-1 text-xs text-slate-500">
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
                    <td className="px-5 py-4 text-right text-sm font-semibold text-green-700">
                      {formatCurrency(order.total_amount)}
                    </td>
                    <td className="px-5 py-4 text-right text-sm text-slate-600">
                      {formatOrderDate(order.created_at)}
                    </td>
                    <td className="px-5 py-4 text-right text-sm text-slate-600">
                      {formatOrderDate(order.estimated_delivery)}
                    </td>
                    <td className="px-5 py-4 text-right text-sm text-slate-600">
                      {order.tracking_number || "-"}
                    </td>
                    <td className="px-5 py-4 text-right">
                      <Button variant="outline" size="sm">
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
