import { useEffect, useState, useRef } from "react";
import { AlertTriangle } from "lucide-react";
import { useNavigate } from "react-router-dom";
import {
  Users,
  Package,
  ShoppingCart,
  DollarSign,
  UserCheck,
  Clock,
  Play,
  Pause,
} from "lucide-react";

import AdminLayout from "@/layouts/AdminLayout";
import { supabase } from "@/lib/supabaseClient";

export default function AdminDashboard() {
  const navigate = useNavigate();

  const [stats, setStats] = useState({
    users: 0,
    sellers: 0,
    approvedProducts: 0,
    pendingProducts: 0,
    lowStockProducts: 0,
    orders: 0,
    revenue: 0,
  });

  const [loading, setLoading] = useState(true);
  const [isRealtimeOn, setIsRealtimeOn] = useState(true);
  const channelRef = useRef<any>(null);
  const [lowStockProducts, setLowStockProducts] = useState<any[]>([]);

  const fetchStats = async () => {
    try {
      const { count: users } = await supabase
        .from("profiles")
        .select("*", { count: "exact", head: true });

      const { count: sellers } = await supabase
        .from("profiles")
        .select("*", { count: "exact", head: true })
        .eq("role", "seller");

      const { count: approvedProducts } = await supabase
        .from("products")
        .select("*", { count: "exact", head: true })
        .eq("product_status", "approved");

      const { count: pendingProducts } = await supabase
        .from("products")
        .select("*", { count: "exact", head: true })
        .eq("product_status", "pending");

      const { count: lowStockProducts } = await supabase
        .from("products")
        .select("*", { count: "exact", head: true })
        .lte("stock", 5)
        .eq("product_status", "approved");

      const { data: lowStockData } = await supabase
        .from("products")
        .select("id, name, stock")
        .lte("stock", 5)
        .eq("product_status", "approved")
        .order("stock", { ascending: true });

      setLowStockProducts(lowStockData || []);

      const { count: orders } = await supabase
        .from("orders")
        .select("*", { count: "exact", head: true });

      const { data: orderData } = await supabase
        .from("orders")
        .select("total_amount");

      const revenue =
        orderData?.reduce((sum, order) => sum + (order.total_amount || 0), 0) ||
        0;

      setStats({
        users: users || 0,
        sellers: sellers || 0,
        approvedProducts: approvedProducts || 0,
        pendingProducts: pendingProducts || 0,
        lowStockProducts: lowStockProducts || 0,
        orders: orders || 0,
        revenue,
      });
    } catch (err) {
      console.error(err);
    }

    setLoading(false);
  };

  // initial fetch and cleanup on unmount
  useEffect(() => {
    fetchStats();

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // manage realtime subscription when `isRealtimeOn` changes
  useEffect(() => {
    const subscribe = () => {
      const channel = supabase
        .channel("dashboard-realtime")
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "profiles",
          },
          () => fetchStats(),
        )
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "products",
          },
          () => fetchStats(),
        )
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "orders",
          },
          () => fetchStats(),
        )
        .subscribe();

      channelRef.current = channel;
    };

    if (isRealtimeOn) {
      // subscribe
      subscribe();
    } else {
      // unsubscribe
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    }

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isRealtimeOn]);

  const totalProducts = stats.approvedProducts + stats.pendingProducts;

  const dashboardStats = [
    {
      title: "Total Users",
      value: stats.users,
      icon: Users,
      route: "/admin/users",
    },
    {
      title: "Total Products",
      value: totalProducts,
      icon: Package,
      route: "/admin/products",
    },
    {
      title: "Total Sellers",
      value: stats.sellers,
      icon: UserCheck,
      route: "/admin/users",
    },
    ...(stats.lowStockProducts > 0
      ? [
          {
            title: "Low Stock",
            value: stats.lowStockProducts,
            icon: AlertTriangle,
            route: "/admin/products",
          },
        ]
      : []),
    {
      title: "Orders",
      value: stats.orders,
      icon: ShoppingCart,
      route: "/admin/orders",
    },
    {
      title: "Revenue",
      value: `₹${stats.revenue}`,
      icon: DollarSign,
      route: "/admin/orders",
    },
    {
      title: "Pending Requests",
      value: stats.pendingProducts,
      icon: Clock,
      route: "/admin/product-requests",
    },
  ];

  return (
    <AdminLayout>
      <div className="mb-8 flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold text-green-900">Admin Dashboard</h1>

          <p className="text-gray-600 mt-2">Real-Time Platform Analytics</p>
        </div>

        <div>
          <button
            onClick={() => setIsRealtimeOn((v) => !v)}
            className={`inline-flex items-center gap-2 px-3 py-1.5 border rounded-full text-sm font-medium shadow-sm focus:outline-none 
              ${isRealtimeOn ? "bg-green-50 border-green-200 text-green-700 hover:bg-green-100" : "bg-gray-50 border-gray-200 text-gray-700 hover:bg-gray-100"}`}
          >
            {isRealtimeOn ? <Pause size={16} /> : <Play size={16} />}

            <span>{isRealtimeOn ? "Live analytics" : "Paused"}</span>
          </button>
        </div>
      </div>

      {loading ? (
        <p>Loading...</p>
      ) : (
        <>
          {/* Dashboard Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            {dashboardStats.map((stat) => {
              const Icon = stat.icon;

              return (
                <div
                  key={stat.title}
                  onClick={() => navigate(stat.route)}
                  className="
              bg-white
              rounded-2xl
              shadow-sm
              border
              p-6
              cursor-pointer
              transition-all
              duration-300
              hover:shadow-xl
              hover:-translate-y-2
              hover:border-green-500
              hover:bg-green-50/30
            "
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-gray-500 text-sm">{stat.title}</p>

                      <h2 className="text-3xl font-bold mt-2 text-gray-900">
                        {stat.value}
                      </h2>
                    </div>

                    <div className="bg-green-100 text-green-700 p-4 rounded-xl">
                      <Icon size={28} />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {lowStockProducts.length > 0 && (
            <div className="mt-8 bg-white rounded-2xl border shadow-sm p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-semibold text-red-600">
                  ⚠ Low Stock Alerts
                </h2>

                <button
                  onClick={() => navigate("/admin/products")}
                  className="text-green-700 font-medium hover:underline"
                >
                  View Products
                </button>
              </div>

              <div className="space-y-3">
                {lowStockProducts.map((product) => (
                  <div
                    key={product.id}
                    className="flex items-center justify-between border rounded-lg p-4"
                  >
                    <div>
                      <h3 className="font-medium text-gray-900">
                        {product.name}
                      </h3>

                      <p className="text-sm text-gray-500">
                        Product needs restocking
                      </p>
                    </div>

                    <span className="bg-red-100 text-red-700 px-3 py-1 rounded-full text-sm font-semibold">
                      {product.stock} left
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </AdminLayout>
  );
}
