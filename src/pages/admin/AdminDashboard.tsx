import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Users,
  Package,
  ShoppingCart,
  DollarSign,
  UserCheck,
  Clock,
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
    orders: 0,
    revenue: 0,
  });

  const [loading, setLoading] = useState(true);

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
        orders: orders || 0,
        revenue,
      });
    } catch (err) {
      console.error(err);
    }

    setLoading(false);
  };

  useEffect(() => {
    fetchStats();

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

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const dashboardStats = [
    {
      title: "Total Users",
      value: stats.users,
      icon: Users,
      route: "/admin/users",
    },
    {
      title: "Total Sellers",
      value: stats.sellers,
      icon: UserCheck,
      route: "/admin/users",
    },
    {
      title: "Approved Products",
      value: stats.approvedProducts,
      icon: Package,
      route: "/admin/products",
    },
    {
      title: "Pending Requests",
      value: stats.pendingProducts,
      icon: Clock,
      route: "/admin/product-requests",
    },
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
  ];

  return (
    <AdminLayout>
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-green-900">Admin Dashboard</h1>

        <p className="text-gray-600 mt-2">Real-Time Platform Analytics</p>
      </div>

      {loading ? (
        <p>Loading...</p>
      ) : (
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
                hover:bg-green-50/30"
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
      )}
    </AdminLayout>
  );
}
