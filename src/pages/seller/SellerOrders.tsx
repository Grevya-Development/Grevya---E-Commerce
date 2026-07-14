import { useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  Eye,
  MapPin,
  Package,
  Phone,
  RefreshCw,
  UserRound,
} from "lucide-react";
import SellerLayout from "@/layouts/SellerLayout";
import { supabase } from "@/lib/supabaseClient";
import { useAuth } from "@/context/AuthContext";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { formatOrderDate } from "@/lib/dateFormat";
import {
  allOrderStatusOptions,
  formatOrderStatus,
  formatPaymentStatus,
  getSellerNextStatuses,
  normalizeOrderStatus,
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
  payment_reference?: string | null;
}

interface OrderItem {
  id: string;
  order_id?: string | null;
  product_id?: string | null;
  product_name?: string | null;
  product_image?: string | null;
  quantity?: number | null;
  price?: number | null;
  created_at?: string | null;
  order_status?: string | null;
  payment_status?: string | null;
  tracking_number?: string | null;
  estimated_delivery?: string | null;
}

interface Profile {
  id: string;
  username?: string | null;
  full_name?: string | null;
  email?: string | null;
  phone?: string | null;
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

export default function SellerOrders() {
  const { user } = useAuth();

  const [orders, setOrders] = useState<Order[]>([]);
  const [orderItems, setOrderItems] = useState<OrderItem[]>([]);
  const [profilesById, setProfilesById] = useState<Record<string, Profile>>(
    {},
  );

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [selectedOrderItems, setSelectedOrderItems] = useState<OrderItem[]>([]);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [detailsError, setDetailsError] = useState<string | null>(null);

  const [deliveryInputs, setDeliveryInputs] = useState<
    Record<string, DeliveryInput>
  >({});

  const [savingDetails, setSavingDetails] = useState(false);

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

  const getOrderItemsForOrder = (orderId: string) =>
    orderItems.filter((item) => item.order_id === orderId);

  const fetchOrders = async (): Promise<Order[]> => {
    if (!user?.id) {
      setOrders([]);
      setOrderItems([]);
      setProfilesById({});
      setLoading(false);
      return [];
    }

    setLoading(true);
    setError(null);

    try {
      let data: any = null;
      let ordersError: any = null;

      const v2Result = await supabase.rpc("get_seller_order_items_v2");

      if (!v2Result.error) {
        data = v2Result.data;
      } else {
        const fallbackResult = await supabase.rpc("get_seller_order_items");
        data = fallbackResult.data;
        ordersError = fallbackResult.error;
      }

      if (ordersError) {
        const message = ordersError.message.includes("get_seller_order_items")
          ? "Seller order function is missing in Supabase. Run the seller order access SQL migration first."
          : ordersError.message;

        setError(message);
        setOrders([]);
        setOrderItems([]);
        return [];
      }

      const items = (data as OrderItem[]) || [];
      setOrderItems(items);

      const orderMap = new Map<string, Order>();

      items.forEach((item) => {
        if (item.order_id && !orderMap.has(item.order_id)) {
          orderMap.set(item.order_id, {
            id: item.order_id,
            order_status: item.order_status || "pending",
            payment_status: item.payment_status || "pending",
            tracking_number: item.tracking_number || null,
            estimated_delivery: item.estimated_delivery || null,
            created_at: item.created_at || null,
          });
        }
      });

      const uniqueOrders = Array.from(orderMap.values());

      if (uniqueOrders.length === 0) {
        setOrders([]);
        setProfilesById({});
        return [];
      }

      const orderIds = uniqueOrders.map((order) => order.id);

      const { data: fullOrders, error: fullOrdersError } = await supabase
        .from("orders")
        .select(
          "id,user_id,shipping_address,payment_status,order_status,tracking_number,estimated_delivery,created_at,total_amount",
        )
        .in("id", orderIds);

      if (fullOrdersError) throw fullOrdersError;

      const fullOrderMap = new Map(
        ((fullOrders as Order[] | null) || []).map((order) => [
          order.id,
          order,
        ]),
      );

      const enrichedOrders = uniqueOrders.map((order) => {
        const fullOrder = fullOrderMap.get(order.id);

        return {
          ...order,
          user_id: fullOrder?.user_id || null,
          total_amount: fullOrder?.total_amount || null,
          shipping_address: fullOrder?.shipping_address || null,
          payment_status: fullOrder?.payment_status || order.payment_status,
          order_status: fullOrder?.order_status || order.order_status || "pending",
          tracking_number: fullOrder?.tracking_number || order.tracking_number,
          estimated_delivery:
            fullOrder?.estimated_delivery || order.estimated_delivery,
          created_at: fullOrder?.created_at || order.created_at,
        };
      });

      setOrders(enrichedOrders);

      const customerIds = Array.from(
        new Set(
          enrichedOrders
            .map((order) => order.user_id)
            .filter(Boolean) as string[],
        ),
      );

      if (customerIds.length > 0) {
        const { data: profileRows, error: profileError } = await supabase
          .from("profiles")
          .select("id,username,full_name,email,phone")
          .in("id", customerIds);

        if (profileError) throw profileError;

        setProfilesById(
          ((profileRows as Profile[] | null) || []).reduce<
            Record<string, Profile>
          >((result, profile) => {
            result[profile.id] = profile;
            return result;
          }, {}),
        );
      } else {
        setProfilesById({});
      }

      return enrichedOrders;
    } catch (fetchError: any) {
      setError(fetchError.message || "Failed to fetch seller orders");
      setOrders([]);
      setOrderItems([]);
      return [];
    } finally {
      setLoading(false);
    }
  };

  const openOrderDetails = async (order: Order) => {
    setSelectedOrder(order);
    setSelectedOrderItems([]);
    setDetailsLoading(true);
    setDetailsError(null);

    try {
      const { data: fullOrder, error: orderError } = await supabase
        .from("orders")
        .select(
          "id,user_id,total_amount,order_status,payment_status,estimated_delivery,tracking_number,shipping_address,created_at",
        )
        .eq("id", order.id)
        .maybeSingle();

      if (orderError) throw orderError;

      const enrichedOrder: Order = {
        ...order,
        ...(fullOrder || {}),
        order_status:
          (fullOrder as Order | null)?.order_status ||
          order.order_status ||
          "pending",
        payment_status:
          (fullOrder as Order | null)?.payment_status ||
          order.payment_status ||
          "pending",
      };

      setSelectedOrder(enrichedOrder);

      if (!enrichedOrder.shipping_address && enrichedOrder.user_id) {
        const { data: addressRows } = await supabase
          .from("addresses")
          .select(
            "full_name,phone,address_line1,address_line_1,address_line2,address_line_2,city,state,pincode,postal_code,country,is_default,created_at",
          )
          .eq("user_id", enrichedOrder.user_id)
          .order("is_default", { ascending: false })
          .order("created_at", { ascending: false })
          .limit(1);

        if (Array.isArray(addressRows) && addressRows.length > 0) {
          const address: any = addressRows[0];

          setSelectedOrder((previous) =>
            previous
              ? {
                  ...previous,
                  shipping_address: {
                    full_name: address.full_name || null,
                    phone: address.phone || null,
                    line1:
                      address.address_line1 || address.address_line_1 || null,
                    line2:
                      address.address_line2 || address.address_line_2 || null,
                    city: address.city || null,
                    state: address.state || null,
                    pincode: address.pincode || address.postal_code || null,
                    country: address.country || null,
                  },
                }
              : previous,
          );
        }
      }

      setSelectedOrderItems(getOrderItemsForOrder(order.id));

      setDeliveryInputs((current) => ({
        ...current,
        [order.id]: {
          estimated_delivery: enrichedOrder.estimated_delivery || null,
          tracking_number: enrichedOrder.tracking_number || null,
          order_status: enrichedOrder.order_status || "pending",
        },
      }));
    } catch (openError: any) {
      setDetailsError(openError.message || "Failed to load order details");
    } finally {
      setDetailsLoading(false);
    }
  };

  const saveOrderDetails = async () => {
    if (!selectedOrder) return;

    setSavingDetails(true);
    setDetailsError(null);

    try {
      const inputs = deliveryInputs[selectedOrder.id] || {};

      const currentStatus = normalizeOrderStatus(selectedOrder.order_status);
      const requestedStatus = normalizeOrderStatus(
        inputs.order_status || selectedOrder.order_status,
      );

      if (requestedStatus !== currentStatus) {
        const { data, error: statusError } = await supabase.rpc(
          "update_order_status",
          {
            p_order_id: selectedOrder.id,
            p_new_status: requestedStatus,
            p_reason: null,
          },
        );

        if (statusError) throw statusError;

        const updatedOrder = Array.isArray(data) ? data[0] : data;

        if (updatedOrder?.order_status) {
          setSelectedOrder((previous) =>
            previous
              ? {
                  ...previous,
                  order_status: updatedOrder.order_status,
                }
              : previous,
          );
        }
      }

      const estimatedDelivery = inputs.estimated_delivery
        ? new Date(inputs.estimated_delivery)
        : null;

      if (estimatedDelivery && Number.isNaN(estimatedDelivery.getTime())) {
        throw new Error("Please enter a valid estimated delivery date.");
      }

      const { error: deliveryError } = await supabase
        .from("orders")
        .update({
          estimated_delivery: estimatedDelivery
            ? estimatedDelivery.toISOString()
            : null,
          tracking_number: inputs.tracking_number?.trim() || null,
        })
        .eq("id", selectedOrder.id);

      if (deliveryError) throw deliveryError;

      await fetchOrders();

      setSelectedOrder(null);
      setSelectedOrderItems([]);
    } catch (saveError: any) {
      setDetailsError(saveError.message || "Failed to save order details");
    } finally {
      setSavingDetails(false);
    }
  };

  useEffect(() => {
    fetchOrders();
  }, [user?.id]);

  const filteredOrders = useMemo(() => {
    const term = search.trim().toLowerCase();

    return orders.filter((order) => {
      const productNames = getOrderItemsForOrder(order.id)
        .map((item) => item.product_name || "")
        .join(" ");

      const searchMatch =
        !term ||
        [
          order.id,
          getCustomerName(order),
          getCustomer(order)?.phone || "",
          productNames,
        ]
          .join(" ")
          .toLowerCase()
          .includes(term);

      const statusMatch =
        !statusFilter ||
        normalizeOrderStatus(order.order_status) === statusFilter;

      return searchMatch && statusMatch;
    });
  }, [orders, orderItems, profilesById, search, statusFilter]);

  const totalRevenue = useMemo(
    () =>
      orderItems.reduce(
        (sum, item) =>
          sum + Number(item.price || 0) * Number(item.quantity || 0),
        0,
      ),
    [orderItems],
  );

  return (
    <SellerLayout>
      <div className="space-y-8 p-8">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <h1 className="text-3xl font-bold text-green-900">Orders</h1>
            <p className="mt-2 text-gray-600">
              Manage orders for your products, fulfillment status, and shipping.
            </p>
          </div>

          <Button
            type="button"
            onClick={fetchOrders}
            className="rounded-full bg-green-700 px-5 py-3 text-sm font-semibold text-white transition hover:bg-green-800"
          >
            <RefreshCw className="h-4 w-4" />
            Refresh
          </Button>
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

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search by Order ID, customer, phone, or product..."
            className="flex-1 rounded-full border border-slate-200 bg-white px-4 py-3 text-sm shadow-sm focus:border-emerald-300 focus:outline-none focus:ring-2 focus:ring-emerald-100"
          />

          <select
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value)}
            className="rounded-full border border-slate-200 bg-white px-4 py-3 text-sm shadow-sm focus:border-emerald-300 focus:outline-none focus:ring-2 focus:ring-emerald-100"
          >
            <option value="">All statuses</option>

            {allOrderStatusOptions.map((status) => (
              <option key={status} value={status}>
                {formatOrderStatus(status)}
              </option>
            ))}
          </select>
        </div>

        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <table className="min-w-full divide-y divide-slate-200">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-5 py-4 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Order
                </th>
                <th className="px-5 py-4 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Customer
                </th>
                <th className="px-5 py-4 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Product
                </th>
                <th className="px-5 py-4 text-center text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Qty
                </th>
                <th className="px-5 py-4 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Unit Price
                </th>
                <th className="px-5 py-4 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Line Total
                </th>
                <th className="px-5 py-4 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Payment
                </th>
                <th className="px-5 py-4 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Status
                </th>
                <th className="px-5 py-4 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Date
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
                    colSpan={10}
                    className="px-5 py-12 text-center text-sm text-slate-500"
                  >
                    Loading orders...
                  </td>
                </tr>
              ) : error ? (
                <tr>
                  <td
                    colSpan={10}
                    className="px-5 py-12 text-center text-sm text-red-600"
                  >
                    {error}
                  </td>
                </tr>
              ) : filteredOrders.length === 0 ? (
                <tr>
                  <td
                    colSpan={10}
                    className="px-5 py-12 text-center text-sm text-slate-500"
                  >
                    No orders found.
                  </td>
                </tr>
              ) : (
                filteredOrders.flatMap((order) => {
                  const items = getOrderItemsForOrder(order.id);

                  return items.map((item, index) => (
                    <tr
                      key={`${order.id}-${item.id}`}
                      className="hover:bg-slate-50"
                    >
                      {index === 0 && (
                        <td
                          rowSpan={items.length}
                          className="px-5 py-4 text-sm font-medium text-slate-900"
                        >
                          <div className="flex flex-col gap-1">
                            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400">
                              #{getShortOrderId(order.id)}
                            </p>
                            <p className="text-xs text-slate-500">
                              {formatOrderDate(order.created_at)}
                            </p>
                          </div>
                        </td>
                      )}

                      {index === 0 && (
                        <td
                          rowSpan={items.length}
                          className="px-5 py-4 text-sm text-slate-700"
                        >
                          <p className="font-medium text-slate-900">
                            {getCustomerName(order)}
                          </p>
                          <p className="mt-1 text-xs text-slate-500">
                            {getCustomer(order)?.phone || "—"}
                          </p>
                        </td>
                      )}

                      <td className="px-5 py-4 text-sm text-slate-700">
                        <div className="flex items-center gap-3">
                          {item.product_image ? (
                            <img
                              src={item.product_image}
                              alt={item.product_name || "Product"}
                              className="h-10 w-10 rounded-lg object-cover"
                            />
                          ) : (
                            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-100 text-slate-400">
                              <Package className="h-5 w-5" />
                            </div>
                          )}

                          <p className="font-medium text-slate-900">
                            {item.product_name || "Unknown product"}
                          </p>
                        </div>
                      </td>

                      <td className="px-5 py-4 text-center text-sm text-slate-700">
                        {item.quantity || 0}
                      </td>

                      <td className="px-5 py-4 text-right text-sm text-slate-700">
                        {formatCurrency(item.price)}
                      </td>

                      <td className="px-5 py-4 text-right text-sm font-semibold text-green-700">
                        {formatCurrency(
                          Number(item.price || 0) * Number(item.quantity || 0),
                        )}
                      </td>

                      {index === 0 && (
                        <td
                          rowSpan={items.length}
                          className="px-5 py-4 text-right text-sm"
                        >
                          <Badge
                            variant="outline"
                            className={`capitalize ${getPaymentStatusBadgeClass(
                              order.payment_status,
                            )}`}
                          >
                            {formatPaymentStatus(order.payment_status)}
                          </Badge>
                        </td>
                      )}

                      {index === 0 && (
                        <td
                          rowSpan={items.length}
                          className="px-5 py-4 text-right text-sm"
                        >
                          <Badge
                            className={`capitalize ${getOrderStatusBadgeClass(
                              order.order_status,
                            )}`}
                          >
                            {formatOrderStatus(order.order_status)}
                          </Badge>
                        </td>
                      )}

                      {index === 0 && (
                        <td
                          rowSpan={items.length}
                          className="px-5 py-4 text-right text-sm text-slate-600"
                        >
                          {formatOrderDate(order.created_at)}
                        </td>
                      )}

                      {index === 0 && (
                        <td
                          rowSpan={items.length}
                          className="px-5 py-4 text-right"
                        >
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => openOrderDetails(order)}
                          >
                            <Eye className="h-4 w-4" />
                            View
                          </Button>
                        </td>
                      )}
                    </tr>
                  ));
                })
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
            setSelectedOrderItems([]);
            setDetailsError(null);
          }
        }}
      >
        <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
          {selectedOrder && (
            <>
              <DialogHeader>
                <DialogTitle className="text-2xl">Order details</DialogTitle>
                <DialogDescription>
                  Manage fulfillment, tracking, and shipping information.
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
                        {formatCurrency(
                          selectedOrderItems.reduce(
                            (sum, item) =>
                              sum +
                              Number(item.price || 0) *
                                Number(item.quantity || 0),
                            0,
                          ),
                        )}
                      </p>
                    </div>
                  </div>

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
                          getSellerNextStatuses(selectedOrder.order_status)
                            .length === 0
                        }
                        className="mt-2 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm capitalize disabled:cursor-not-allowed disabled:bg-slate-100"
                      >
                        {(() => {
                          const currentStatus = normalizeOrderStatus(
                            selectedOrder.order_status,
                          );

                          const nextStatuses =
                            getSellerNextStatuses(currentStatus);

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

                      <p className="mt-1 text-xs text-slate-500">
                        Sellers can confirm, process, ship, or cancel only where
                        the workflow permits it. Courier/admin handles later
                        delivery stages.
                      </p>
                    </div>

                    <div>
                      <label className="text-xs font-medium text-slate-600">
                        Estimated Delivery
                      </label>

                      <input
                        type="date"
                        value={formatDateForInput(
                          deliveryInputs[selectedOrder.id]
                            ?.estimated_delivery ||
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

                    <div className="flex gap-2 pt-2">
                      <Button
                        onClick={saveOrderDetails}
                        disabled={savingDetails}
                        className="flex-1 bg-green-700 hover:bg-green-800"
                      >
                        {savingDetails ? "Saving..." : "Save Changes"}
                      </Button>

                      <Button
                        variant="outline"
                        onClick={() => setSelectedOrder(null)}
                        disabled={savingDetails}
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>

                  <div className="rounded-xl border">
                    <div className="border-b bg-slate-50 px-4 py-3">
                      <p className="font-semibold text-slate-900">
                        Products ({selectedOrderItems.length})
                      </p>
                    </div>

                    <div className="divide-y">
                      {selectedOrderItems.map((item) => (
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
                  </div>
                </div>
              )}
            </>
          )}
        </DialogContent>
      </Dialog>
    </SellerLayout>
  );
}