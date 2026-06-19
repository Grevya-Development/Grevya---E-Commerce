import { useEffect, useMemo, useState } from "react";
import SellerLayout from "@/layouts/SellerLayout";
import { supabase } from "@/lib/supabaseClient";
import { useAuth } from "@/context/AuthContext";

interface OrderItem {
  id: string;
  order_id?: string;
  product_id?: string;
  product_name: string;
  quantity: number;
  price: number;
  created_at: string;
  order_status?: string | null;
  payment_status?: string | null;
  tracking_number?: string | null;
  estimated_delivery?: string | null;
}

const orderStatusOptions = [
  "pending",
  "confirmed",
  "processing",
  "shipped",
  "out_for_delivery",
  "delivered",
  "cancelled",
];

const formatStatus = (status?: string | null) =>
  (status || "pending").replace(/_/g, " ");

export default function SellerOrders() {
  const { user } = useAuth();

  const [orders, setOrders] = useState<OrderItem[]>([]);
  const [editingOrderId, setEditingOrderId] = useState<string | null>(null);
  const [deliveryInputs, setDeliveryInputs] = useState<
    Record<
      string,
      { estimated_delivery?: string | null; tracking_number?: string | null }
    >
  >({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [updatingOrderId, setUpdatingOrderId] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  const fetchOrders = async () => {
    setError(null);

    if (!user?.id) {
      setOrders([]);
      setLoading(false);
      return;
    }

    setLoading(true);

    const { data, error: ordersError } = await supabase.rpc(
      "get_seller_order_items",
    );

    if (ordersError) {
      const message = ordersError.message.includes("get_seller_order_items")
        ? "Seller order function is missing in Supabase. Run supabase/fix-seller-orders-rls.sql in the Supabase SQL Editor, then refresh this page."
        : ordersError.message;
      setError(message);
      setOrders([]);
      setLoading(false);
      return;
    }

    setOrders((data as OrderItem[]) || []);
    setLoading(false);
  };

  const updateOrderStatus = async (
    orderId: string | undefined,
    status: string,
  ) => {
    if (!orderId) return;

    setUpdatingOrderId(orderId);
    setError(null);

    const { error: updateError } = await supabase.rpc(
      "update_seller_order_status",
      {
        target_order_id: orderId,
        next_status: status,
      },
    );

    if (updateError) {
      const message = updateError.message.includes("update_seller_order_status")
        ? "Seller status update function is missing in Supabase. Run supabase/fix-seller-orders-rls.sql in the Supabase SQL Editor, then refresh this page."
        : updateError.message;
      setError(message);
      setUpdatingOrderId(null);
      return;
    }

    // optimistic update
    setOrders((current) =>
      current.map((order) =>
        order.order_id === orderId ? { ...order, order_status: status } : order,
      ),
    );
    setUpdatingOrderId(null);
    fetchOrders();
  };

  const startEdit = (order: OrderItem) => {
    setEditingOrderId(order.order_id || null);
    setDeliveryInputs((s) => ({
      ...s,
      [order.order_id || ""]: {
        estimated_delivery: order.estimated_delivery || null,
        tracking_number: order.tracking_number || null,
      },
    }));
  };

  const cancelEdit = () => {
    setEditingOrderId(null);
  };

  const saveDeliveryInfo = async (orderId?: string) => {
    if (!orderId) return;
    const inputs = deliveryInputs[orderId] || {};
    setError(null);
    try {
      const updatePayload: any = {};
      if (inputs.estimated_delivery) {
        // normalize to ISO string
        const d = new Date(inputs.estimated_delivery);
        if (!isNaN(d.getTime()))
          updatePayload.estimated_delivery = d.toISOString();
      } else {
        updatePayload.estimated_delivery = null;
      }
      updatePayload.tracking_number = inputs.tracking_number || null;

      const { error: updateError } = await supabase
        .from("orders")
        .update(updatePayload)
        .eq("id", orderId);

      if (updateError) throw updateError;

      setOrders((current) =>
        current.map((o) =>
          o.order_id === orderId
            ? {
                ...o,
                estimated_delivery: updatePayload.estimated_delivery,
                tracking_number: updatePayload.tracking_number,
              }
            : o,
        ),
      );

      setEditingOrderId(null);
    } catch (err: any) {
      setError(err.message || "Failed to update order delivery info");
    }
  };

  useEffect(() => {
    fetchOrders();
  }, [user]);

  const filteredOrders = useMemo(
    () =>
      orders.filter((order) =>
        order.product_name.toLowerCase().includes(search.toLowerCase().trim()),
      ),
    [orders, search],
  );

  const totalRevenue = useMemo(
    () =>
      orders.reduce(
        (sum, order) => sum + Number(order.price) * Number(order.quantity),
        0,
      ),
    [orders],
  );

  const averageOrderValue = useMemo(
    () => (orders.length ? totalRevenue / orders.length : 0),
    [orders.length, totalRevenue],
  );

  return (
    <SellerLayout>
      <div className="p-8">
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold text-green-900">Seller Orders</h1>
            <p className="text-gray-600 mt-2">
              Orders received for your products
            </p>
          </div>
          <div className="flex items-center gap-3">
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search product"
              className="w-full max-w-sm rounded-full border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 shadow-sm focus:border-emerald-300 focus:outline-none focus:ring-2 focus:ring-emerald-100"
            />
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <div className="rounded-3xl border border-green-100 bg-white p-6 shadow-sm">
            <p className="text-sm font-medium text-gray-500">Total Orders</p>
            <p className="mt-3 text-4xl font-semibold text-green-900">
              {orders.length}
            </p>
            <p className="mt-2 text-sm text-gray-500">
              All orders for your products
            </p>
          </div>
          <div className="rounded-3xl border border-green-100 bg-white p-6 shadow-sm">
            <p className="text-sm font-medium text-gray-500">Total Revenue</p>
            <p className="mt-3 text-4xl font-semibold text-purple-600">
              ₹{totalRevenue}
            </p>
            <p className="mt-2 text-sm text-gray-500">
              Revenue generated from orders
            </p>
          </div>
          <div className="rounded-3xl border border-green-100 bg-white p-6 shadow-sm">
            <p className="text-sm font-medium text-gray-500">
              Avg. Order Value
            </p>
            <p className="mt-3 text-4xl font-semibold text-blue-600">
              ₹{averageOrderValue.toFixed(0)}
            </p>
            <p className="mt-2 text-sm text-gray-500">
              Average value per order
            </p>
          </div>
        </div>

        <div className="mt-8 overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
          <table className="min-w-full divide-y divide-slate-200">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-6 py-4 text-left text-sm font-semibold uppercase tracking-[0.12em] text-slate-500">
                  Product
                </th>
                <th className="px-6 py-4 text-center text-sm font-semibold uppercase tracking-[0.12em] text-slate-500">
                  Quantity
                </th>
                <th className="px-6 py-4 text-right text-sm font-semibold uppercase tracking-[0.12em] text-slate-500">
                  Price
                </th>
                <th className="px-6 py-4 text-right text-sm font-semibold uppercase tracking-[0.12em] text-slate-500">
                  Date
                </th>
                <th className="px-6 py-4 text-right text-sm font-semibold uppercase tracking-[0.12em] text-slate-500">
                  Status
                </th>
                <th className="px-6 py-4 text-right text-sm font-semibold uppercase tracking-[0.12em] text-slate-500">
                  Estimated
                </th>
                <th className="px-6 py-4 text-right text-sm font-semibold uppercase tracking-[0.12em] text-slate-500">
                  Tracking
                </th>
                <th className="px-6 py-4 text-right text-sm font-semibold uppercase tracking-[0.12em] text-slate-500">
                  Action
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {loading ? (
                <tr>
                  <td
                    colSpan={5}
                    className="px-6 py-12 text-center text-sm text-slate-500"
                  >
                    Loading orders...
                  </td>
                </tr>
              ) : error ? (
                <tr>
                  <td
                    colSpan={5}
                    className="px-6 py-12 text-center text-sm text-red-600"
                  >
                    {error}
                  </td>
                </tr>
              ) : filteredOrders.length === 0 ? (
                <tr>
                  <td
                    colSpan={5}
                    className="px-6 py-12 text-center text-sm text-slate-500"
                  >
                    No orders match the current search.
                  </td>
                </tr>
              ) : (
                filteredOrders.map((order) => (
                  <tr
                    key={order.id}
                    className="hover:bg-slate-50 transition-colors"
                  >
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-slate-900">
                      {order.product_name}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center text-sm text-slate-700">
                      {order.quantity}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-slate-700">
                      ₹{order.price}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-slate-700">
                      {new Date(order.created_at).toLocaleDateString("en-IN")}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-slate-700">
                      <select
                        value={order.order_status || "pending"}
                        disabled={updatingOrderId === order.order_id}
                        onChange={(event) =>
                          updateOrderStatus(order.order_id, event.target.value)
                        }
                        className="rounded-full border border-slate-200 bg-white px-3 py-2 text-sm capitalize text-slate-700 shadow-sm outline-none transition focus:border-emerald-300 focus:ring-2 focus:ring-emerald-100 disabled:cursor-wait disabled:opacity-60"
                      >
                        {orderStatusOptions.map((status) => (
                          <option key={status} value={status}>
                            {formatStatus(status)}
                          </option>
                        ))}
                      </select>
                    </td>

                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-slate-700">
                      {order.estimated_delivery
                        ? new Date(order.estimated_delivery).toLocaleDateString(
                            "en-IN",
                          )
                        : "-"}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-slate-700">
                      {order.tracking_number || "-"}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-slate-700">
                      {editingOrderId === order.order_id ? (
                        <div className="flex items-center justify-end gap-2">
                          <input
                            type="date"
                            value={
                              (deliveryInputs[order.order_id || ""]
                                ?.estimated_delivery || "") as string
                            }
                            onChange={(e) =>
                              setDeliveryInputs((s) => ({
                                ...s,
                                [order.order_id || ""]: {
                                  ...(s[order.order_id || ""] || {}),
                                  estimated_delivery: e.target.value,
                                },
                              }))
                            }
                            className="rounded-full border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700"
                          />
                          <input
                            type="text"
                            placeholder="Tracking #"
                            value={
                              deliveryInputs[order.order_id || ""]
                                ?.tracking_number || ""
                            }
                            onChange={(e) =>
                              setDeliveryInputs((s) => ({
                                ...s,
                                [order.order_id || ""]: {
                                  ...(s[order.order_id || ""] || {}),
                                  tracking_number: e.target.value,
                                },
                              }))
                            }
                            className="rounded-full border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700"
                          />
                          <button
                            onClick={() => saveDeliveryInfo(order.order_id)}
                            className="rounded-full bg-green-800 px-3 py-2 text-sm text-white"
                          >
                            Save
                          </button>
                          <button
                            onClick={cancelEdit}
                            className="rounded-full border border-slate-200 px-3 py-2 text-sm"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => startEdit(order)}
                            className="rounded-full border border-slate-200 px-3 py-2 text-sm"
                          >
                            Edit
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </SellerLayout>
  );
}
