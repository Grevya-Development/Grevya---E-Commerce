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

  const averageOrderValue = orders.length ? totalRevenue / orders.length : 0;

  return (
    <AdminLayout>
      <div className="p-8">
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold text-green-900">Admin Orders</h1>
            <p className="text-gray-600 mt-2">
              Manage all customer orders and review payment status.
            </p>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search customer, email, phone, status..."
              className="w-full max-w-sm rounded-full border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 shadow-sm focus:border-emerald-300 focus:outline-none focus:ring-2 focus:ring-emerald-100"
            />
            <button
              type="button"
              onClick={fetchOrders}
              className="inline-flex items-center justify-center rounded-full bg-green-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-green-700"
            >
              Refresh
            </button>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <div className="rounded-3xl border border-green-100 bg-white p-6 shadow-sm">
            <p className="text-sm font-medium text-gray-500">Total Orders</p>
            <p className="mt-3 text-4xl font-semibold text-green-900">
              {orders.length}
            </p>
            <p className="mt-2 text-sm text-gray-500">
              Total orders placed on the platform
            </p>
          </div>
          <div className="rounded-3xl border border-green-100 bg-white p-6 shadow-sm">
            <p className="text-sm font-medium text-gray-500">Revenue</p>
            <p className="mt-3 text-4xl font-semibold text-purple-600">
              {formatCurrency(totalRevenue)}
            </p>
            <p className="mt-2 text-sm text-gray-500">
              Total value from all orders
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
                  Customer
                </th>
                <th className="px-6 py-4 text-left text-sm font-semibold uppercase tracking-[0.12em] text-slate-500">
                  Payment
                </th>
                <th className="px-6 py-4 text-left text-sm font-semibold uppercase tracking-[0.12em] text-slate-500">
                  Status
                </th>
                <th className="px-6 py-4 text-right text-sm font-semibold uppercase tracking-[0.12em] text-slate-500">
                  Total
                </th>
                <th className="px-6 py-4 text-right text-sm font-semibold uppercase tracking-[0.12em] text-slate-500">
                  Date
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
                      {order.delivery_info?.fullName || "Customer"}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-700 capitalize">
                      {order.payment_method || "unknown"}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <span className="inline-flex rounded-full bg-orange-100 px-3 py-1 text-xs font-semibold capitalize text-orange-700">
                        {order.status || "pending"}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-semibold text-green-700">
                      {formatCurrency(order.total_amount)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-slate-700">
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
