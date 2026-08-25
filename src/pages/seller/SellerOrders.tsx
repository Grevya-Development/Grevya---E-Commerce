import { useEffect, useMemo, useState } from "react";
import {
  Eye,
  Package,
  RefreshCw,
  UserRound,
  AlertCircle,
  MapPin,
  Phone,
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

interface Order {
  id: string;
  user_id?: string | null;
  total_amount?: number | null;
  status?: string | null;
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

// Statuses a seller can set (not Delivered or Out For Delivery, as those are courier/tracking domain)
const sellerAllowedStatuses = [
  "pending",
  "confirmed",
  "processing",
  "shipped",
  "in_transit",
  "out_for_delivery",
  "delivered",
];

const allStatusOptions = [
  "pending",
  "confirmed",
  "processing",
  "shipped",
  "in_transit",
  "out_for_delivery",
  "delivered",
  "cancelled",
  "refunded",
  "returned",
];

const formatStatus = (status?: string | null) =>
  (status || "pending").replace(/_/g, " ");

const formatCurrency = (value?: number | null) =>
  `₹${Number(value || 0).toFixed(2)}`;

const getOrderStatusBadgeClass = (value?: string | null) => {
  const status = (value || "pending").toLowerCase();
  if (["delivered"].includes(status))
    return "bg-emerald-100 text-emerald-700 hover:bg-emerald-100";
  if (["shipped", "out for delivery", "processing"].includes(status))
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

const getShortOrderId = (id?: string | null) => {
  if (!id) return "—";
  return `${id.slice(0, 8)}…`;
};

export default function SellerOrders() {
  const { user } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [orderItems, setOrderItems] = useState<OrderItem[]>([]);
  const [profilesById, setProfilesById] = useState<Record<string, Profile>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [selectedOrderItems, setSelectedOrderItems] = useState<OrderItem[]>([]);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [detailsError, setDetailsError] = useState<string | null>(null);
  const [deliveryInputs, setDeliveryInputs] = useState<
    Record<
      string,
      {
        estimated_delivery?: string | null;
        tracking_number?: string | null;
        order_status?: string | null;
      }
    >
  >({});
  const [savingDetails, setSavingDetails] = useState(false);

  const fetchOrders = async () => {
    if (!user?.id) {
      setOrders([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Fetch orders via RPC for seller-filtered view. Try v2 (includes
      // user_id + shipping_address) and fall back to the original RPC
      // if v2 is not available.
      let data: any = null;
      let ordersError: any = null;
      try {
        const res = await supabase.rpc("get_seller_order_items_v2");
        data = res.data;
        ordersError = res.error;
        if (ordersError) {
          // try original name as fallback
          const res2 = await supabase.rpc("get_seller_order_items");
          data = res2.data;
          ordersError = res2.error;
        }
      } catch (rpcErr) {
        // final fallback to original RPC
        const res2 = await supabase.rpc("get_seller_order_items");
        data = res2.data;
        ordersError = res2.error;
      }

      if (ordersError) {
        const msg = ordersError.message.includes("get_seller_order_items")
          ? "Seller order function is missing in Supabase. Run supabase/fix-seller-orders-rls.sql in the Supabase SQL Editor."
          : ordersError.message;
        setError(msg);
        setOrders([]);
        setOrderItems([]);
        setLoading(false);
        return;
      }

      const items = (data as OrderItem[]) || [];
      setOrderItems(items);

      // Extract unique orders from items
      const orderMap = new Map<string, Order>();
      items.forEach((item) => {
        if (item.order_id && !orderMap.has(item.order_id)) {
          orderMap.set(item.order_id, {
            id: item.order_id,
            order_status: item.order_status || null,
            payment_status: item.payment_status || null,
            tracking_number: item.tracking_number || null,
            estimated_delivery: item.estimated_delivery || null,
            created_at: item.created_at || null,
          });
        }
      });

      const uniqueOrders = Array.from(orderMap.values());
      setOrders(uniqueOrders);

      // Fetch customer profiles for all unique user_ids
      const userIds = Array.from(
        new Set(items.map((item) => item.order_id).filter(Boolean)),
      ) as string[];

      if (userIds.length > 0) {
        // Get full order details including user_id and shipping address
        const { data: orderData } = await supabase
          .from("orders")
          .select("id,user_id,shipping_address,payment_status,status")
          .in("id", userIds);

        const orderLookup = new Map(
          ((orderData as any[]) || []).map((o) => [o.id, o]),
        );

        // Merge full order details
        const enrichedOrders = uniqueOrders.map((o) => {
          const fullOrder = orderLookup.get(o.id);
          return {
            ...o,
            user_id: fullOrder?.user_id,
            shipping_address: fullOrder?.shipping_address,
            payment_status: fullOrder?.payment_status || o.payment_status,
            // `orders.status` is the canonical order status.
            // The RPC can return a stale `order_status` from order_items,
            // so keep both fields synchronized with the current orders row.
            status: fullOrder?.status || o.order_status || "pending",
            order_status: fullOrder?.status || o.order_status || "pending",
          };
        });
        setOrders(enrichedOrders as Order[]);

        // Get unique user IDs
        const userIdsToFetch = Array.from(
          new Set(enrichedOrders.map((o) => o.user_id).filter(Boolean)),
        ) as string[];

        if (userIdsToFetch.length > 0) {
          const { data: profileRows } = await supabase
            .from("profiles")
            .select("id,username,full_name,email,phone")
            .in("id", userIdsToFetch);

          setProfilesById(
            ((profileRows as Profile[] | null) || []).reduce<
              Record<string, Profile>
            >((acc, profile) => {
              acc[profile.id] = profile;
              return acc;
            }, {}),
          );
        }
      }
    } catch (err: any) {
      setError(err.message || "Failed to fetch orders");
    } finally {
      setLoading(false);
    }
  };

  const openOrderDetails = async (order: Order) => {
    setSelectedOrder(order);
    setDetailsLoading(true);
    setDetailsError(null);

    try {
      // Get full order details including shipping address
      const { data: fullOrder, error: orderError } = await supabase
        .from("orders")
        .select(
          "id,user_id,status,payment_status,estimated_delivery,tracking_number,shipping_address,created_at",
        )
        .eq("id", order.id)
        .maybeSingle();

      if (orderError && !fullOrder) throw orderError;

      const enriched: Order = {
        ...order,
        ...((fullOrder as any) || {}),
        order_status:
          (fullOrder as any)?.status || order.order_status || order.status,
        status: (fullOrder as any)?.status || order.status,
        payment_status:
          (fullOrder as any)?.payment_status || order.payment_status,
        created_at: (fullOrder as any)?.created_at || order.created_at,
        tracking_number:
          (fullOrder as any)?.tracking_number || order.tracking_number,
        estimated_delivery:
          (fullOrder as any)?.estimated_delivery || order.estimated_delivery,
        shipping_address:
          (fullOrder as any)?.shipping_address || order.shipping_address,
      };
      setSelectedOrder(enriched);

      // If shipping payload missing on the order, attempt to fetch the
      // customer's saved address as a fallback so sellers still see a
      // name and address when available.
      if (!enriched.shipping_address && (enriched as any).user_id) {
        try {
          const uid = (enriched as any).user_id;
          const { data: addrRows, error: addrErr } = await supabase
            .from("addresses")
            .select(
              "id,full_name,phone,address_line1,address_line_1,address_line2,address_line_2,landmark,city,state,pincode,postal_code,country,is_default,created_at",
            )
            .eq("user_id", uid)
            .order("is_default", { ascending: false })
            .order("created_at", { ascending: false })
            .limit(1);

          if (!addrErr && Array.isArray(addrRows) && addrRows.length > 0) {
            const a: any = addrRows[0];
            const shippingFromAddr = {
              full_name: a.full_name || null,
              phone: a.phone || null,
              line1: a.address_line1 || a.address_line_1 || null,
              line2: a.address_line2 || a.address_line_2 || null,
              city: a.city || null,
              state: a.state || null,
              pincode: a.pincode || a.postal_code || null,
              country: a.country || null,
            };

            setSelectedOrder((prev) =>
              prev ? { ...prev, shipping_address: shippingFromAddr } : prev,
            );
          }
        } catch (err) {
          console.warn("SellerOrders: fallback address lookup failed", err);
        }
      }

      // Get order items
      const items = orderItems.filter((item) => item.order_id === order.id);
      setSelectedOrderItems(items);

      // Initialize delivery inputs
      setDeliveryInputs((s) => ({
        ...s,
        [order.id]: {
          estimated_delivery: enriched.estimated_delivery || null,
          tracking_number: enriched.tracking_number || null,
          order_status: enriched.order_status || null,
        },
      }));
    } catch (err: any) {
      setDetailsError(err.message || "Failed to load order details");
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
      const updatePayload: any = {};

      // Update estimated delivery
      if (inputs.estimated_delivery) {
        const d = new Date(inputs.estimated_delivery as string);
        if (!isNaN(d.getTime())) {
          updatePayload.estimated_delivery = d.toISOString();
        }
      } else {
        updatePayload.estimated_delivery = null;
      }

      updatePayload.tracking_number = inputs.tracking_number || null;

      // Update status (write to `status` column, not `order_status`)
      if (inputs.order_status) {
        updatePayload.status = inputs.order_status;
      }

      const { error: updateError } = await supabase
        .from("orders")
        .update(updatePayload)
        .eq("id", selectedOrder.id);

      if (updateError) throw updateError;

      // Update local state
      setOrders((current) =>
        current.map((o) =>
          o.id === selectedOrder.id
            ? {
                ...o,
                // Keep the UI's canonical status fields synchronized.
                // The table renders `order_status` first.
                order_status: inputs.order_status || o.order_status || o.status,
                status: inputs.order_status || o.status || o.order_status,
                estimated_delivery: updatePayload.estimated_delivery,
                tracking_number: updatePayload.tracking_number,
              }
            : o,
        ),
      );

      setSelectedOrder(null);
      setSelectedOrderItems([]);
      await fetchOrders();
    } catch (err: any) {
      setDetailsError(err.message || "Failed to save order details");
    } finally {
      setSavingDetails(false);
    }
  };

  useEffect(() => {
    fetchOrders();
  }, [user]);

  const filteredOrders = useMemo(() => {
    const term = search.trim().toLowerCase();
    return orders.filter((order) => {
      // Filter by search term (Order ID, customer, phone, product)
      const searchMatch =
        !term ||
        [
          order.id,
          getCustomerName(order),
          getCustomer(order)?.phone || "",
          selectedOrderItems
            .filter((item) => item.order_id === order.id)
            .map((item) => item.product_name)
            .join(" "),
        ]
          .join(" ")
          .toLowerCase()
          .includes(term);

      // Filter by status
      const statusMatch =
        !statusFilter ||
        (order.status || order.order_status || "pending")
          .toLowerCase()
          .includes(statusFilter.toLowerCase());

      return searchMatch && statusMatch;
    });
  }, [orders, search, statusFilter, selectedOrderItems, profilesById]);

  const totalRevenue = useMemo(
    () =>
      orderItems.reduce(
        (sum, item) =>
          sum + Number(item.price || 0) * Number(item.quantity || 0),
        0,
      ),
    [orderItems],
  );

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

  const parseShipping = (s: any) => {
    if (!s) return null;
    const full_name = s.full_name || s.name || s.firstName || s.first_name || null;
    const phone = s.phone || s.mobile || null;
    const line1 = s.address_line1 || s.address_line_1 || s.line1 || s.address || s.address_line || null;
    const line2 = s.address_line2 || s.address_line_2 || s.line2 || s.address_extra || null;
    const city = s.city || null;
    const state = s.state || null;
    const pincode = s.pincode || s.postal_code || s.postcode || s.pin || null;
    const country = s.country || null;
    return { full_name, phone, line1, line2, city, state, pincode, country };
  };

  // Get all items for an order
  const getOrderItemsForOrder = (orderId: string) =>
    orderItems.filter((item) => item.order_id === orderId);

  return (
    <SellerLayout>
      <div className="space-y-8 p-8">
        {/* Header */}
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <h1 className="text-3xl font-bold text-green-900">Orders</h1>
            <p className="mt-2 text-gray-600">
              Manage orders for your products, fulfillment status, and shipping
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

        {/* Stats */}
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

        {/* Filters and Search */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by Order ID, customer, phone, or product..."
            className="flex-1 rounded-full border border-slate-200 bg-white px-4 py-3 text-sm shadow-sm focus:border-emerald-300 focus:outline-none focus:ring-2 focus:ring-emerald-100"
          />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="rounded-full border border-slate-200 bg-white px-4 py-3 text-sm shadow-sm focus:border-emerald-300 focus:outline-none focus:ring-2 focus:ring-emerald-100"
          >
            <option value="">All statuses</option>
            {allStatusOptions.map((status) => (
              <option key={status} value={status}>
                {formatStatus(status)}
              </option>
            ))}
          </select>
        </div>

        {/* Orders Table */}
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
                filteredOrders.map((order) =>
                  getOrderItemsForOrder(order.id).map((item, idx) => (
                    <tr
                      key={`${order.id}-${idx}`}
                      className="hover:bg-slate-50"
                    >
                      {/* Order ID (only on first row per order) */}
                      {idx === 0 && (
                        <td
                          rowSpan={getOrderItemsForOrder(order.id).length}
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

                      {/* Customer (only on first row per order) */}
                      {idx === 0 && (
                        <td
                          rowSpan={getOrderItemsForOrder(order.id).length}
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

                      {/* Product */}
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

                      {/* Quantity */}
                      <td className="px-5 py-4 text-center text-sm text-slate-700">
                        {item.quantity}
                      </td>

                      {/* Unit Price */}
                      <td className="px-5 py-4 text-right text-sm text-slate-700">
                        {formatCurrency(item.price)}
                      </td>

                      {/* Line Total */}
                      <td className="px-5 py-4 text-right text-sm font-semibold text-green-700">
                        {formatCurrency(
                          Number(item.price || 0) * Number(item.quantity || 0),
                        )}
                      </td>

                      {/* Payment Status (only on first row per order) */}
                      {idx === 0 && (
                        <td
                          rowSpan={getOrderItemsForOrder(order.id).length}
                          className="px-5 py-4 text-right text-sm"
                        >
                          <Badge
                            variant="outline"
                            className={`capitalize ${getPaymentStatusBadgeClass(order.payment_status)}`}
                          >
                            {formatStatus(order.payment_status)}
                          </Badge>
                        </td>
                      )}

                      {/* Order Status (only on first row per order) */}
                      {idx === 0 && (
                        <td
                          rowSpan={getOrderItemsForOrder(order.id).length}
                          className="px-5 py-4 text-right text-sm"
                        >
                          <Badge
                            className={`capitalize ${getOrderStatusBadgeClass(order.status || order.order_status)}`}
                          >
                            {formatStatus(order.status || order.order_status)}
                          </Badge>
                        </td>
                      )}

                      {/* Date (only on first row per order) */}
                      {idx === 0 && (
                        <td
                          rowSpan={getOrderItemsForOrder(order.id).length}
                          className="px-5 py-4 text-right text-sm text-slate-600"
                        >
                          {formatOrderDate(order.created_at)}
                        </td>
                      )}

                      {/* View Details Button (only on first row per order) */}
                      {idx === 0 && (
                        <td
                          rowSpan={getOrderItemsForOrder(order.id).length}
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
                  )),
                )
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Order Details Modal */}
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
                  Manage fulfillment, tracking, and shipping information
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
                  {/* Customer & Shipping Info */}
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
                          const s = parseShipping(selectedOrder.shipping_address);
                          if (!s) return (
                            <p className="text-sm text-slate-500">No shipping address on file</p>
                          );
                          return (
                            <div className="flex items-start gap-3">
                              <MapPin className="mt-0.5 h-5 w-5 text-green-700" />
                              <div>
                                {s.full_name && (
                                  <p className="font-semibold text-slate-900">{s.full_name}</p>
                                )}
                                <p className="text-sm text-slate-900">
                                  {[s.line1, s.line2].filter(Boolean).join(", ")}
                                </p>
                                <p className="mt-1 text-sm text-slate-600">
                                  {[s.city, s.state, s.pincode].filter(Boolean).join(", ")}
                                </p>
                                {s.country && (
                                  <p className="mt-1 text-sm text-slate-600">{s.country}</p>
                                )}
                                {s.phone && (
                                  <p className="mt-1 flex items-center gap-2 text-sm text-slate-600">
                                    <Phone className="h-4 w-4" />
                                    {s.phone}
                                  </p>
                                )}
                              </div>
                            </div>
                          );
                        })()
                      ) : (
                        <p className="text-sm text-slate-500">No shipping address on file</p>
                      )}
                    </div>
                  </div>

                  {/* Order Status & Payment */}
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="rounded-xl border bg-slate-50 p-4">
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                        Payment Status
                      </p>
                      <Badge
                        variant="outline"
                        className={`mt-3 capitalize ${getPaymentStatusBadgeClass(selectedOrder.payment_status)}`}
                      >
                        {formatStatus(selectedOrder.payment_status)}
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

                  {/* Fulfillment Controls */}
                  <div className="rounded-xl border bg-slate-50 p-4 space-y-3">
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
                          selectedOrder.status ||
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
                        className="mt-2 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm capitalize"
                      >
                        {sellerAllowedStatuses.map((status) => (
                          <option key={status} value={status}>
                            {formatStatus(status)}
                          </option>
                        ))}
                      </select>
                     <p className="mt-1 text-xs text-slate-500">
                      Update the fulfillment status as the order progresses.
                      </p>
                    </div>

                    <div>
                      <label className="text-xs font-medium text-slate-600">
                        Estimated Delivery
                      </label>
                      <input
                        type="date"
                        value={
                          (deliveryInputs[selectedOrder.id]
                            ?.estimated_delivery || "") as string
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
                        onChange={(e) =>
                          setDeliveryInputs((s) => ({
                            ...s,
                            [selectedOrder.id]: {
                              ...(s[selectedOrder.id] || {}),
                              tracking_number: e.target.value,
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

                  {/* Order Items */}
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
                                Qty {item.quantity}
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