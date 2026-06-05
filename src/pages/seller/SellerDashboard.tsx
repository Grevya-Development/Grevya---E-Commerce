export default function SellerDashboard() {
  return (
    <div className="p-8">
      <h1 className="text-3xl font-bold text-green-900">Seller Dashboard</h1>

      <p className="mt-2 text-gray-600">Manage your products and orders</p>

      <div className="grid md:grid-cols-3 gap-6 mt-8">
        <div className="bg-white p-6 rounded-xl shadow">
          <h3 className="text-lg font-semibold">My Products</h3>

          <p className="text-gray-500 mt-2">View and manage products</p>
        </div>

        <div className="bg-white p-6 rounded-xl shadow">
          <h3 className="text-lg font-semibold">Add Product</h3>

          <p className="text-gray-500 mt-2">Create new product</p>
        </div>

        <div className="bg-white p-6 rounded-xl shadow">
          <h3 className="text-lg font-semibold">Orders</h3>

          <p className="text-gray-500 mt-2">Track customer orders</p>
        </div>
      </div>
    </div>
  );
}
