import {
  LayoutDashboard,
  Users,
  Package,
  ShoppingCart,
  Bell,
  Settings,
} from "lucide-react";

import { NavLink } from "react-router-dom";

const links = [
  {
    label: "Dashboard",
    icon: LayoutDashboard,
    path: "/admin/dashboard",
  },

  {
    label: "Users",
    icon: Users,
    path: "/admin/users",
  },

  {
    label: "Products",
    icon: Package,
    path: "/admin/products",
  },

  {
    label: "Orders",
    icon: ShoppingCart,
    path: "/admin/orders",
  },

  {
    label: "Notifications",
    icon: Bell,
    path: "/admin/notifications",
  },

  {
    label: "Settings",
    icon: Settings,
    path: "/admin/settings",
  },
];

export default function AdminSidebar() {
  return (
    <aside className="w-64 bg-white border-r shadow-sm">
      {/* LOGO */}

      <div className="h-20 flex items-center px-6 border-b">
        <h1 className="text-2xl font-bold text-green-800">Admin Panel</h1>
      </div>

      {/* LINKS */}

      <nav className="p-4 space-y-2">
        {links.map((link) => {
          const Icon = link.icon;

          return (
            <NavLink
              key={link.path}
              to={link.path}
              className={({ isActive }) =>
                `flex items-center gap-3 px-4 py-3 rounded-lg transition font-medium ${
                  isActive
                    ? "bg-green-100 text-green-800"
                    : "text-gray-700 hover:bg-gray-100"
                }`
              }
            >
              <Icon size={20} />

              {link.label}
            </NavLink>
          );
        })}
      </nav>
    </aside>
  );
}
