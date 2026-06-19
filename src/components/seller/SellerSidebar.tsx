import {
  Home,
  LayoutDashboard,
  Package,
  PlusCircle,
  ShoppingCart,
  Clock,
} from "lucide-react";

import { NavLink } from "react-router-dom";

const links = [
  {
    label: "Home",
    icon: Home,
    path: "/",
  },
  {
    label: "Dashboard",
    icon: LayoutDashboard,
    path: "/seller/dashboard",
  },

  {
    label: "My Products",
    icon: Package,
    path: "/seller/products",
  },

  {
    label: "Add Product",
    icon: PlusCircle,
    path: "/seller/add-product",
  },

  {
    label: "Orders",
    icon: ShoppingCart,
    path: "/seller/orders",
  },

  {
    label: "Pending Approvals",
    icon: Clock,
    path: "/seller/pending-products",
  },
];

export default function SellerSidebar() {
  return (
    <aside className="w-64 bg-white border-r shadow-sm">
      <div className="h-20 flex items-center px-6 border-b">
        <h1 className="text-2xl font-bold text-green-800">Seller Panel</h1>
      </div>

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
