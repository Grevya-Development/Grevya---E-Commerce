import AdminLayout from "@/layouts/AdminLayout";

export default function AdminOrders() {
  return (
    <AdminLayout>
      <h1 className="text-3xl font-bold text-green-900">
        Orders
      </h1>

      <p className="text-gray-600 mt-2">
        View and manage customer orders
      </p>
    </AdminLayout>
  );
}