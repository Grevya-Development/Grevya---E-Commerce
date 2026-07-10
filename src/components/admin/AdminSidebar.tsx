import {
  LayoutDashboard,
  Users,
  Package,
  ShoppingCart,
  Bell,
  ClipboardCheck,
} from "lucide-react";
import { NavLink } from "react-router-dom";

const overviewLinks = [
  {
    label: "Admin Dashboard",
    icon: LayoutDashboard,
    path: "/admin/dashboard",
  },
  {
    label: "Notifications",
    icon: Bell,
    path: "/admin/notifications",
  },
];

const managementLinks = [
  {
    label: "Users & Accounts",
    icon: Users,
    path: "/admin/users",
  },
  {
    label: "Store Products",
    icon: Package,
    path: "/admin/products",
  },
  {
    label: "Customer Orders",
    icon: ShoppingCart,
    path: "/admin/orders",
  },
  {
    label: "Product Requests",
    icon: ClipboardCheck,
    path: "/admin/product-requests",
  },
];

export default function AdminSidebar() {
  return (
    <aside className="w-64 bg-[#F7EEE4] border-r border-[#A68D65]/15 hidden md:block shrink-0 shadow-xs">
      {/* LOGO AREA / TITLE */}
      <div className="h-16 flex items-center px-6 border-b border-[#A68D65]/15">
        <h2 className="font-serif text-lg font-bold text-[#33381C] tracking-wide">
          Admin Control
        </h2>
      </div>

      {/* LINKS */}
      <nav className="p-4 space-y-6">
        <div>
          <h3 className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest px-4 mb-2">
            Overview
          </h3>
          <div className="space-y-1">
            {overviewLinks.map((link) => {
              const Icon = link.icon;

              return (
                <NavLink
                  key={link.path}
                  to={link.path}
                  className={({ isActive }) =>
                    `flex items-center gap-3 px-4 py-2.5 rounded-xl transition-all duration-200 font-semibold text-xs tracking-wide group ${
                      isActive
                        ? "bg-[#33381C] text-white shadow-sm"
                        : "text-[#1D1E19]/70 hover:bg-[#33381C]/5 hover:text-[#33381C] hover:translate-x-0.5 transform"
                    }`
                  }
                >
                  <Icon size={15} className="group-hover:scale-105 transition-transform" />
                  <span>{link.label}</span>
                </NavLink>
              );
            })}
          </div>
        </div>

        <div>
          <h3 className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest px-4 mb-2">
            Management
          </h3>
          <div className="space-y-1">
            {managementLinks.map((link) => {
              const Icon = link.icon;

              return (
                <NavLink
                  key={link.path}
                  to={link.path}
                  className={({ isActive }) =>
                    `flex items-center gap-3 px-4 py-2.5 rounded-xl transition-all duration-200 font-semibold text-xs tracking-wide group ${
                      isActive
                        ? "bg-[#33381C] text-white shadow-sm"
                        : "text-[#1D1E19]/70 hover:bg-[#33381C]/5 hover:text-[#33381C] hover:translate-x-0.5 transform"
                    }`
                  }
                >
                  <Icon size={15} className="group-hover:scale-105 transition-transform" />
                  <span>{link.label}</span>
                </NavLink>
              );
            })}
          </div>
        </div>
      </nav>
    </aside>
  );
}
