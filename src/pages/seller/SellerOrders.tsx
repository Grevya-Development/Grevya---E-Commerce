import { useEffect, useMemo, useState } from "react";
import SellerLayout from "@/layouts/SellerLayout";
import { supabase } from "@/lib/supabaseClient";
import { useAuthStore } from "@/store/authStore";

interface OrderItem {
  id: string;
  product_name: string;
  quantity: number;
  price: number;
  created_at: string;
}

export default function SellerOrders() {
  const { user } = useAuthStore();

  const [orders, setOrders] = useState<OrderItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  const fetchOrders = async () => {
    if (!user) return;

    setLoading(true);

    const { data: products } = await supabase
      .from("products")
      .select("id")
      .eq("seller_id", user.id);

    if (!products) {
      setOrders([]);
      setLoading(false);
      return;
    }

    const productIds = products.map((p) => p.id);
    if (productIds.length === 0) {
      setOrders([]);
      setLoading(false);
      return;
    }

    const { data } = await supabase
      .from("order_items")
      .select("*")
      .in("product_id", productIds)
      .order("created_at", { ascending: false });

    setOrders(data || []);
    setLoading(false);
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
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {loading ? (
                <tr>
                  <td
                    colSpan={4}
                    className="px-6 py-12 text-center text-sm text-slate-500"
                  >
                    Loading orders...
                  </td>
                </tr>
              ) : filteredOrders.length === 0 ? (
                <tr>
                  <td
                    colSpan={4}
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
