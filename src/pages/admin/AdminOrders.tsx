import { useEffect, useMemo, useState } from "react";
import AdminLayout from "@/layouts/AdminLayout";
import { supabase } from "@/lib/supabaseClient";

interface Order {
  id: string;
  user_id?: string | null;
  total_amount?: number | null;
  status?: string | null;
  payment_method?: string | null;
  created_at?: string | null;
  delivery_info?: {
    fullName?: string;
    email?: string;
    phone?: string;
    city?: string;
    state?: string;
  } | null;
}

const formatCurrency = (value?: number | null) =>
  `₹${Number(value || 0).toFixed(2)}`;

export default function AdminOrders() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  const fetchOrders = async () => {
    setLoading(true);
    setError(null);

    const { data, error: fetchError } = await supabase
      .from("orders")
      .select("*")
      .order("created_at", { ascending: false });

    if (fetchError) {
      setError(fetchError.message);
      setOrders([]);
    } else {
      setOrders((data as Order[] | null) || []);
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
        order.user_id || "",
        order.status || "",
        order.payment_method || "",
        order.delivery_info?.fullName || "",
        order.delivery_info?.email || "",
        order.delivery_info?.phone || "",
      ]
        .join(" ")
        .toLowerCase()
        .includes(term),
    );
  }, [orders, search]);

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
              View customer orders, payment methods, and delivery contacts.
            </p>
          </div>
          <button
            type="button"
            onClick={fetchOrders}
            className="rounded-full bg-green-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-green-700"
          >
            Refresh
          </button>
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
          placeholder="Search orders by customer, email, phone, status..."
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
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={5} className="px-5 py-12 text-center text-sm text-slate-500">
                    Loading orders...
                  </td>
                </tr>
              ) : error ? (
                <tr>
                  <td colSpan={5} className="px-5 py-12 text-center text-sm text-red-600">
                    {error}
                  </td>
                </tr>
              ) : filteredOrders.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-5 py-12 text-center text-sm text-slate-500">
                    No orders found.
                  </td>
                </tr>
              ) : (
                filteredOrders.map((order) => (
                  <tr key={order.id} className="hover:bg-slate-50">
                    <td className="px-5 py-4 text-sm">
                      <p className="font-medium text-slate-900">
                        {order.delivery_info?.fullName || "Customer"}
                      </p>
                      <p className="mt-1 text-xs text-slate-500">
                        {order.delivery_info?.email || order.user_id || order.id}
                      </p>
                      {order.delivery_info?.phone && (
                        <p className="mt-1 text-xs text-slate-500">
                          {order.delivery_info.phone}
                        </p>
                      )}
                    </td>
                    <td className="px-5 py-4 text-sm capitalize text-slate-700">
                      {order.payment_method || "Unknown"}
                    </td>
                    <td className="px-5 py-4 text-sm">
                      <span className="inline-flex rounded-full bg-orange-100 px-3 py-1 text-xs font-semibold capitalize text-orange-700">
                        {order.status || "pending"}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-right text-sm font-semibold text-green-700">
                      {formatCurrency(order.total_amount)}
                    </td>
                    <td className="px-5 py-4 text-right text-sm text-slate-600">
                      {order.created_at
                        ? new Date(order.created_at).toLocaleDateString("en-IN")
                        : "Unknown"}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </AdminLayout>
  );
}
