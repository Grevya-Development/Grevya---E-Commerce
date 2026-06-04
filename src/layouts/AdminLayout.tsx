import { ReactNode } from "react";

import AdminSidebar from "@/components/admin/AdminSidebar";

interface Props {
  children: ReactNode;
}

export default function AdminLayout({ children }: Props) {
  return (
    <div className="min-h-screen flex bg-[#f5f7fa]">
      {/* SIDEBAR */}

      <AdminSidebar />

      {/* MAIN CONTENT */}

      <main className="flex-1 p-8 overflow-y-auto">{children}</main>
    </div>
  );
}
