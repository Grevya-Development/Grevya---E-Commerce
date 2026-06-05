import AdminLayout from "@/layouts/AdminLayout";

export default function AdminSettings() {
  return (
    <AdminLayout>
      <h1 className="text-3xl font-bold text-green-900">
        Settings
      </h1>

      <p className="text-gray-600 mt-2">
        Admin settings panel
      </p>
    </AdminLayout>
  );
}