// export default function AdminDashboard() {
//   return (
//     <div className="p-8">
//       <h1 className="text-3xl font-bold">Admin Dashboard</h1>

//       <p className="mt-4 text-gray-600">Welcome Admin</p>
//     </div>
//   );
// }

import { Users, Package, ShoppingCart, DollarSign } from "lucide-react";

import AdminLayout from "@/layouts/AdminLayout";

const stats = [
  {
    title: "Total Users",
    value: "120",
    icon: Users,
  },

  {
    title: "Products",
    value: "45",
    icon: Package,
  },

  {
    title: "Orders",
    value: "89",
    icon: ShoppingCart,
  },

  {
    title: "Revenue",
    value: "$12,400",
    icon: DollarSign,
  },
];

export default function AdminDashboard() {
  return (
    <AdminLayout>
      {/* HEADER */}

      <div className="mb-8">
        <h1 className="text-3xl font-bold text-green-900">Admin Dashboard</h1>

        <p className="text-gray-600 mt-2">Welcome back, Admin</p>
      </div>

      {/* STATS */}

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
        {stats.map((stat) => {
          const Icon = stat.icon;

          return (
            <div
              key={stat.title}
              className="bg-white rounded-2xl shadow-sm border p-6"
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
    </AdminLayout>
  );
}
