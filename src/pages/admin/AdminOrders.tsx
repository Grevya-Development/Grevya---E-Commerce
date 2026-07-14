import { useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  Eye,
  Mail,
  MapPin,
  Package,
  Phone,
  RefreshCw,
  UserRound,
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
  allOrderStatusOptions,
  formatOrderStatus,
  formatPaymentStatus,
  getAdminNextStatuses,
  normalizeOrderStatus,
  normalizePaymentStatus,
} from "@/lib/orderStatus";

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
  order_id?: string | null;
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

interface DeliveryInput {
  estimated_delivery?: string | null;
  tracking_number?: string | null;
  order_status?: string | null;
}

const formatCurrency = (value?: number | null) =>
  `₹${Number(value || 0).toFixed(2)}`;

const formatDateForInput = (value?: string | null) => {
  if (!value) return "";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "";

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
};

const getOrderStatusBadgeClass = (value?: string | null) => {
  const status = normalizeOrderStatus(value);

  if (status === "delivered") {
    return "bg-emerald-100 text-emerald-700 hover:bg-emerald-100";
  }

  if (
    ["processing", "shipped", "in_transit", "out_for_delivery"].includes(
      status,
    )
  ) {
    return "bg-sky-100 text-sky-700 hover:bg-sky-100";
  }

  if (["cancelled", "returned"].includes(status)) {
    return "bg-rose-100 text-rose-700 hover:bg-rose-100";
  }

  return "bg-amber-100 text-amber-700 hover:bg-amber-100";
};

const getPaymentStatusBadgeClass = (value?: string | null) => {
  const status = (value || "pending").toLowerCase().replace(/\s+/g, "_");

  if (status === "paid") {
    return "bg-emerald-100 text-emerald-700 hover:bg-emerald-100";
  }

  if (status === "refund_processing") {
    return "bg-orange-100 text-orange-700 hover:bg-orange-100";
  }

  if (["failed", "refunded"].includes(status)) {
    return "bg-rose-100 text-rose-700 hover:bg-rose-100";
  }

  return "bg-amber-100 text-amber-700 hover:bg-amber-100";
};

const getShortOrderId = (id?: string | null) => {
  if (!id) return "—";
  return `${id.slice(0, 8)}…`;
};

const parseShipping = (shipping: any) => {
  if (!shipping) return null;

  return {
    full_name:
      shipping.full_name ||
      shipping.name ||
      shipping.firstName ||
      shipping.first_name ||
      null,
    phone: shipping.phone || shipping.mobile || null,
    line1:
      shipping.address_line1 ||
      shipping.address_line_1 ||
      shipping.line1 ||
      shipping.address ||
      shipping.address_line ||
      null,
    line2:
      shipping.address_line2 ||
      shipping.address_line_2 ||
      shipping.line2 ||
      shipping.address_extra ||
      null,
    city: shipping.city || null,
    state: shipping.state || null,
    pincode:
      shipping.pincode ||
      shipping.postal_code ||
      shipping.postcode ||
      shipping.pin ||
      null,
    country: shipping.country || null,
  };
};

export default function AdminOrders() {
  const { toast } = useToast();

  const [orders, setOrders] = useState<Order[]>([]);
  const [profilesById, setProfilesById] = useState<Record<string, Profile>>(
    {},
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [paymentFilter, setPaymentFilter] = useState("");

  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [selectedItems, setSelectedItems] = useState<OrderItem[]>([]);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [detailsError, setDetailsError] = useState<string | null>(null);

  const [deliveryInputs, setDeliveryInputs] = useState<
    Record<string, DeliveryInput>
  >({});

  const [savingDelivery, setSavingDelivery] = useState(false);
  const [savingStatus, setSavingStatus] = useState(false);

  const [refundReason, setRefundReason] = useState("");
  const [processingRefund, setProcessingRefund] = useState(false);

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

    try {
      const { data, error: fetchError } = await supabase
        .from("orders")
        .select(
          "id,created_at,user_id,total_amount,payment_status,order_status,estimated_delivery,tracking_number,shipping_address,payment_method,payment_reference",
        )
        .order("created_at", { ascending: false });

      if (fetchError) throw fetchError;

      const orderRows = (data as any[] | null) || [];

      const mappedOrders: Order[] = orderRows.map((order) => ({
        ...order,
        order_status: order.order_status || "pending",
        payment_status: order.payment_status || "pending",
        transaction_reference: order.payment_reference || null,
      }));

      setOrders(mappedOrders);

      const userIds = Array.from(
        new Set(orderRows.map((order) => order.user_id).filter(Boolean)),
      ) as string[];

      if (userIds.length === 0) {
        setProfilesById({});
        return;
      }

      const { data: profileRows, error: profileError } = await supabase
        .from("profiles")
        .select("id,username,full_name,email,phone")
        .in("id", userIds);

      if (profileError) throw profileError;

      setProfilesById(
        ((profileRows as Profile[] | null) || []).reduce<
          Record<string, Profile>
        >((result, profile) => {
          result[profile.id] = profile;
          return result;
        }, {}),
      );
    } catch (fetchError: any) {
      setError(fetchError.message || "Failed to load orders");
      setOrders([]);
      setProfilesById({});
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders();
  }, []);

  const getOrderItems = async (orderId: string): Promise<OrderItem[]> => {
    const { data: itemRows, error: itemError } = await supabase
      .from("order_items")
      .select("id,order_id,product_id,product_name,product_image,quantity,price")
      .eq("order_id", orderId);

    if (itemError) throw itemError;

    const items = (itemRows as OrderItem[] | null) || [];

    const missingProductDetails = items.filter(
      (item) => (!item.product_name || !item.product_image) && item.product_id,
    );

    if (missingProductDetails.length === 0) return items;

    const productIds = Array.from(
      new Set(
        missingProductDetails
          .map((item) => item.product_id)
          .filter(Boolean) as string[],
      ),
    );

    const { data: productRows } = await supabase
      .from("products")
      .select("id,name,image_url")
      .in("id", productIds);

    const productMap = new Map(
      ((productRows as ProductSummary[] | null) || []).map((product) => [
        product.id,
        product,
      ]),
    );

    return items.map((item) => {
      const product = item.product_id
        ? productMap.get(item.product_id)
        : undefined;

      return {
        ...item,
        product_name: item.product_name || product?.name || null,
        product_image: item.product_image || product?.image_url || null,
      };
    });
  };

  const openOrderDetails = async (order: Order) => {
    setSelectedOrder(order);
    setSelectedItems([]);
    setDetailsLoading(true);
    setDetailsError(null);
    setRefundReason("");

    try {
      const { data: fullOrder, error: orderError } = await supabase
        .from("orders")
        .select(
          "id,created_at,user_id,total_amount,payment_status,order_status,estimated_delivery,tracking_number,shipping_address,payment_method,payment_reference",
        )
        .eq("id", order.id)
        .single();

      if (orderError) throw orderError;

      const enrichedOrder: Order = {
        ...(fullOrder as any),
        order_status: (fullOrder as any).order_status || "pending",
        payment_status: (fullOrder as any).payment_status || "pending",
        transaction_reference: (fullOrder as any).payment_reference || null,
      };

      setSelectedOrder(enrichedOrder);

      const items = await getOrderItems(order.id);
      setSelectedItems(items);

      setDeliveryInputs((current) => ({
        ...current,
        [order.id]: {
          estimated_delivery: enrichedOrder.estimated_delivery || null,
          tracking_number: enrichedOrder.tracking_number || null,
          order_status: enrichedOrder.order_status || "pending",
        },
      }));
    } catch (openError: any) {
      setDetailsError(openError.message || "Unable to load order details");
    } finally {
      setDetailsLoading(false);
    }
  };

  const saveDeliveryInfo = async () => {
    if (!selectedOrder) return;

    setSavingDelivery(true);

    try {
      const inputs = deliveryInputs[selectedOrder.id] || {};

      const estimatedDate = inputs.estimated_delivery
        ? new Date(inputs.estimated_delivery)
        : null;

      if (estimatedDate && Number.isNaN(estimatedDate.getTime())) {
        throw new Error("Please enter a valid estimated delivery date.");
      }

      const { error: updateError } = await supabase
        .from("orders")
        .update({
          estimated_delivery: estimatedDate ? estimatedDate.toISOString() : null,
          tracking_number: inputs.tracking_number?.trim() || null,
        })
        .eq("id", selectedOrder.id);

      if (updateError) throw updateError;

      toast({
        title: "Saved",
        description: "Tracking and estimated delivery information updated.",
      });

      await fetchOrders();

      setSelectedOrder((previous) =>
        previous
          ? {
              ...previous,
              estimated_delivery: estimatedDate
                ? estimatedDate.toISOString()
                : null,
              tracking_number: inputs.tracking_number?.trim() || null,
            }
          : previous,
      );
    } catch (saveError: any) {
      toast({
        title: "Save failed",
        description: saveError.message || "Unable to update delivery details.",
        variant: "destructive",
      });
    } finally {
      setSavingDelivery(false);
    }
  };

  const updateOrderState = async () => {
    if (!selectedOrder) return;

    const currentStatus = normalizeOrderStatus(selectedOrder.order_status);
    const nextStatus = normalizeOrderStatus(
      deliveryInputs[selectedOrder.id]?.order_status ||
        selectedOrder.order_status,
    );

    if (currentStatus === nextStatus) {
      toast({
        title: "No status change",
        description: "Choose a different order status first.",
        variant: "destructive",
      });
      return;
    }

    const allowedNextStatuses = getAdminNextStatuses(currentStatus);

    if (!allowedNextStatuses.includes(nextStatus)) {
      toast({
        title: "Invalid status update",
        description: `This order cannot move from ${formatOrderStatus(
          currentStatus,
        )} to ${formatOrderStatus(nextStatus)}.`,
        variant: "destructive",
      });
      return;
    }

    setSavingStatus(true);

    try {
      const { data, error: statusError } = await supabase.rpc(
        "update_order_status",
        {
          p_order_id: selectedOrder.id,
          p_new_status: nextStatus,
          p_reason: null,
        },
      );

      if (statusError) throw statusError;

      const updatedOrder = Array.isArray(data) ? data[0] : data;
      const finalStatus = updatedOrder?.order_status || nextStatus;

      toast({
        title: "Order updated",
        description: `Order moved to ${formatOrderStatus(finalStatus)}.`,
      });

      setSelectedOrder((previous) =>
        previous
          ? {
              ...previous,
              order_status: finalStatus,
            }
          : previous,
      );

      setDeliveryInputs((previous) => ({
        ...previous,
        [selectedOrder.id]: {
          ...(previous[selectedOrder.id] || {}),
          order_status: finalStatus,
        },
      }));

      await fetchOrders();
    } catch (statusError: any) {
      toast({
        title: "Update failed",
        description:
          statusError.message || "Unable to update the order status.",
        variant: "destructive",
      });
    } finally {
      setSavingStatus(false);
    }
  };

  const processRefund = async () => {
    if (!selectedOrder) return;

    if (normalizePaymentStatus(selectedOrder.payment_status) !== "paid") {
      toast({
        title: "Refund unavailable",
        description: "Only paid orders can enter refund processing.",
        variant: "destructive",
      });
      return;
    }

    if (!refundReason.trim()) {
      toast({
        title: "Refund reason required",
        description: "Enter the reason before starting the refund.",
        variant: "destructive",
      });
      return;
    }

    setProcessingRefund(true);

    try {
      const { data, error: refundError } = await supabase.rpc(
        "update_payment_status",
        {
          p_order_id: selectedOrder.id,
          p_new_status: "refund_processing",
          p_reason: refundReason.trim(),
        },
      );

      if (refundError) throw refundError;

      const updatedOrder = Array.isArray(data) ? data[0] : data;
      const finalPaymentStatus =
        updatedOrder?.payment_status || "refund_processing";

      toast({
        title: "Refund started",
        description:
          "The payment status is now Refund in progress. The gateway callback will mark it refunded after completion.",
      });

      setSelectedOrder((previous) =>
        previous
          ? {
              ...previous,
              payment_status: finalPaymentStatus,
            }
          : previous,
      );

      setRefundReason("");
      await fetchOrders();
    } catch (refundError: any) {
      toast({
        title: "Refund failed",
        description:
          refundError.message || "Unable to start refund processing.",
        variant: "destructive",
      });
    } finally {
      setProcessingRefund(false);
    }
  };

  const filteredOrders = useMemo(() => {
    const term = search.trim().toLowerCase();

    return orders.filter((order) => {
      const customer = getCustomer(order);

      const searchMatch =
        !term ||
        [
          order.id,
          customer?.full_name || "",
          customer?.username || "",
          customer?.email || "",
          customer?.phone || "",
          order.payment_status || "",
          order.order_status || "",
          order.tracking_number || "",
        ]
          .join(" ")
          .toLowerCase()
          .includes(term);

      const statusMatch =
        !statusFilter ||
        normalizeOrderStatus(order.order_status) === statusFilter;

      const paymentMatch =
        !paymentFilter ||
        normalizeOrderStatus(order.payment_status) === paymentFilter;

      return searchMatch && statusMatch && paymentMatch;
    });
  }, [orders, profilesById, search, statusFilter, paymentFilter]);

  const exportOrders = () => {
    const rows = filteredOrders.map((order) => ({
      id: order.id,
      customer: getCustomerName(order),
      email: getCustomer(order)?.email || "",
      phone: getCustomer(order)?.phone || "",
      payment_status: formatPaymentStatus(order.payment_status),
      order_status: formatOrderStatus(order.order_status),
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
            <p className="mt-2 text-gray-600">
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

        <div className="flex flex-col gap-3 lg:flex-row">
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search by customer, email, phone, order, payment, or status..."
            className="flex-1 rounded-full border border-slate-200 bg-white px-4 py-3 text-sm shadow-sm focus:border-emerald-300 focus:outline-none focus:ring-2 focus:ring-emerald-100"
          />

          <select
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value)}
            className="rounded-full border border-slate-200 bg-white px-4 py-3 text-sm shadow-sm"
          >
            <option value="">All order statuses</option>
            {allOrderStatusOptions.map((status) => (
              <option key={status} value={status}>
                {formatOrderStatus(status)}
              </option>
            ))}
          </select>

          <select
            value={paymentFilter}
            onChange={(event) => setPaymentFilter(event.target.value)}
            className="rounded-full border border-slate-200 bg-white px-4 py-3 text-sm shadow-sm"
          >
            <option value="">All payment statuses</option>
            <option value="pending">Pending</option>
            <option value="paid">Paid</option>
            <option value="failed">Failed</option>
            <option value="refund_processing">Refund in progress</option>
            <option value="refunded">Refunded</option>
          </select>
        </div>

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
                  Order Status
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

                    <td className="px-5 py-4 text-sm">
                      <Badge
                        variant="outline"
                        className={`capitalize ${getPaymentStatusBadgeClass(
                          order.payment_status,
                        )}`}
                      >
                        {formatPaymentStatus(order.payment_status)}
                      </Badge>
                    </td>

                    <td className="px-5 py-4 text-sm">
                      <Badge
                        className={`capitalize ${getOrderStatusBadgeClass(
                          order.order_status,
                        )}`}
                      >
                        {formatOrderStatus(order.order_status)}
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
                      {order.tracking_number || "—"}
                    </td>

                    <td className="px-5 py-4 text-right">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={(event) => {
                          event.stopPropagation();
                          openOrderDetails(order);
                        }}
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

      <Dialog
        open={Boolean(selectedOrder)}
        onOpenChange={(open) => {
          if (!open) {
            setSelectedOrder(null);
            setSelectedItems([]);
            setDetailsError(null);
            setRefundReason("");
          }
        }}
      >
        <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
          {selectedOrder && (
            <>
              <DialogHeader>
                <DialogTitle className="text-2xl">Order details</DialogTitle>
                <DialogDescription>
                  Manage fulfillment, delivery information, and refund processing.
                </DialogDescription>
              </DialogHeader>

              {detailsLoading ? (
                <div className="flex items-center justify-center gap-3 p-8 text-sm text-slate-500">
                  <RefreshCw className="h-4 w-4 animate-spin" />
                  Loading order details...
                </div>
              ) : detailsError ? (
                <div className="space-y-3 p-8 text-center text-sm text-red-600">
                  <div className="flex items-center justify-center gap-2">
                    <AlertCircle className="h-4 w-4" />
                    <span>{detailsError}</span>
                  </div>
                </div>
              ) : (
                <div className="space-y-6">
                  <div className="rounded-xl border bg-slate-50 p-4">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Shipping Information
                    </p>

                    <div className="mt-3 space-y-3">
                      <div className="flex items-start gap-3">
                        <UserRound className="mt-0.5 h-5 w-5 text-green-700" />

                        <div>
                          <p className="font-semibold text-slate-900">
                            {getCustomerName(selectedOrder)}
                          </p>

                          {getCustomer(selectedOrder)?.phone && (
                            <p className="mt-1 flex items-center gap-2 text-sm text-slate-600">
                              <Phone className="h-4 w-4" />
                              {getCustomer(selectedOrder)?.phone}
                            </p>
                          )}
                        </div>
                      </div>

                      {selectedOrder.shipping_address ? (
                        (() => {
                          const shipping = parseShipping(
                            selectedOrder.shipping_address,
                          );

                          if (!shipping) {
                            return (
                              <p className="text-sm text-slate-500">
                                No shipping address on file.
                              </p>
                            );
                          }

                          return (
                            <div className="flex items-start gap-3">
                              <MapPin className="mt-0.5 h-5 w-5 text-green-700" />

                              <div>
                                {shipping.full_name && (
                                  <p className="font-semibold text-slate-900">
                                    {shipping.full_name}
                                  </p>
                                )}

                                <p className="text-sm text-slate-900">
                                  {[shipping.line1, shipping.line2]
                                    .filter(Boolean)
                                    .join(", ")}
                                </p>

                                <p className="mt-1 text-sm text-slate-600">
                                  {[shipping.city, shipping.state, shipping.pincode]
                                    .filter(Boolean)
                                    .join(", ")}
                                </p>

                                {shipping.country && (
                                  <p className="mt-1 text-sm text-slate-600">
                                    {shipping.country}
                                  </p>
                                )}

                                {shipping.phone && (
                                  <p className="mt-1 flex items-center gap-2 text-sm text-slate-600">
                                    <Phone className="h-4 w-4" />
                                    {shipping.phone}
                                  </p>
                                )}
                              </div>
                            </div>
                          );
                        })()
                      ) : (
                        <p className="text-sm text-slate-500">
                          No shipping address on file.
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="rounded-xl border bg-slate-50 p-4">
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                        Payment Status
                      </p>

                      <Badge
                        variant="outline"
                        className={`mt-3 capitalize ${getPaymentStatusBadgeClass(
                          selectedOrder.payment_status,
                        )}`}
                      >
                        {formatPaymentStatus(selectedOrder.payment_status)}
                      </Badge>
                    </div>

                    <div className="rounded-xl border bg-slate-50 p-4">
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                        Total
                      </p>

                      <p className="mt-3 text-2xl font-bold text-green-800">
                        {formatCurrency(selectedOrder.total_amount)}
                      </p>
                    </div>
                  </div>

                  {normalizePaymentStatus(selectedOrder.payment_status) === "paid" && (
                    <div className="space-y-3 rounded-xl border border-orange-200 bg-orange-50 p-4">
                      <div>
                        <p className="font-semibold text-orange-900">
                          Process Refund
                        </p>

                        <p className="mt-1 text-xs text-orange-700">
                          This changes payment status to Refund in progress. It
                          does not mark the refund as completed.
                        </p>
                      </div>

                      <textarea
                        value={refundReason}
                        onChange={(event) => setRefundReason(event.target.value)}
                        placeholder="Enter refund reason..."
                        className="min-h-24 w-full rounded-md border border-orange-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-200"
                      />

                      <Button
                        type="button"
                        onClick={processRefund}
                        disabled={processingRefund || !refundReason.trim()}
                        className="bg-orange-600 hover:bg-orange-700"
                      >
                        {processingRefund
                          ? "Starting refund..."
                          : "Start Refund Processing"}
                      </Button>
                    </div>
                  )}

                  <div className="space-y-3 rounded-xl border bg-slate-50 p-4">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Fulfillment
                    </p>

                    <div>
                      <label className="text-xs font-medium text-slate-600">
                        Order Status
                      </label>

                      <select
                        value={
                          deliveryInputs[selectedOrder.id]?.order_status ||
                          selectedOrder.order_status ||
                          "pending"
                        }
                        onChange={(event) =>
                          setDeliveryInputs((current) => ({
                            ...current,
                            [selectedOrder.id]: {
                              ...(current[selectedOrder.id] || {}),
                              order_status: event.target.value,
                            },
                          }))
                        }
                        disabled={
                          getAdminNextStatuses(selectedOrder.order_status)
                            .length === 0
                        }
                        className="mt-2 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm capitalize disabled:cursor-not-allowed disabled:bg-slate-100"
                      >
                        {(() => {
                          const currentStatus = normalizeOrderStatus(
                            selectedOrder.order_status,
                          );

                          const nextStatuses =
                            getAdminNextStatuses(currentStatus);

                          return (
                            <>
                              <option value={currentStatus}>
                                Current: {formatOrderStatus(currentStatus)}
                              </option>

                              {nextStatuses.map((status) => (
                                <option key={status} value={status}>
                                  Move to: {formatOrderStatus(status)}
                                </option>
                              ))}
                            </>
                          );
                        })()}
                      </select>
                    </div>

                    <div>
                      <label className="text-xs font-medium text-slate-600">
                        Estimated Delivery
                      </label>

                      <input
                        type="date"
                        value={formatDateForInput(
                          deliveryInputs[selectedOrder.id]?.estimated_delivery ||
                            selectedOrder.estimated_delivery,
                        )}
                        onChange={(event) =>
                          setDeliveryInputs((current) => ({
                            ...current,
                            [selectedOrder.id]: {
                              ...(current[selectedOrder.id] || {}),
                              estimated_delivery: event.target.value,
                            },
                          }))
                        }
                        className="mt-2 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm"
                      />
                    </div>

                    <div>
                      <label className="text-xs font-medium text-slate-600">
                        Tracking Number
                      </label>

                      <input
                        type="text"
                        placeholder="Enter tracking number"
                        value={
                          deliveryInputs[selectedOrder.id]?.tracking_number ||
                          ""
                        }
                        onChange={(event) =>
                          setDeliveryInputs((current) => ({
                            ...current,
                            [selectedOrder.id]: {
                              ...(current[selectedOrder.id] || {}),
                              tracking_number: event.target.value,
                            },
                          }))
                        }
                        className="mt-2 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm"
                      />
                    </div>

                    <div className="flex flex-wrap gap-2 pt-2">
                      <Button
                        onClick={saveDeliveryInfo}
                        disabled={savingDelivery}
                        className="bg-green-700 hover:bg-green-800"
                      >
                        {savingDelivery ? "Saving..." : "Save Delivery Details"}
                      </Button>

                      <Button
                        variant="outline"
                        onClick={updateOrderState}
                        disabled={
                          savingStatus ||
                          normalizeOrderStatus(
                            deliveryInputs[selectedOrder.id]?.order_status ||
                              selectedOrder.order_status,
                          ) === normalizeOrderStatus(selectedOrder.order_status)
                        }
                      >
                        {savingStatus ? "Updating..." : "Update Order Status"}
                      </Button>

                      <Button
                        variant="outline"
                        onClick={() => setSelectedOrder(null)}
                        disabled={savingDelivery || savingStatus}
                      >
                        Close
                      </Button>
                    </div>
                  </div>

                  <div className="rounded-xl border">
                    <div className="border-b bg-slate-50 px-4 py-3">
                      <p className="font-semibold text-slate-900">
                        Products ({selectedItems.length})
                      </p>
                    </div>

                    {selectedItems.length === 0 ? (
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
                                {formatCurrency(
                                  Number(item.price || 0) *
                                    Number(item.quantity || 0),
                                )}
                              </p>

                              <p className="text-xs text-slate-500">
                                {formatCurrency(item.price)} × {item.quantity}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </>
          )}
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}