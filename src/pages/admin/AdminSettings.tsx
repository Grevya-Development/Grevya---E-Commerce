import {
  Settings,
  Store,
  Shield,
  Bell,
  Palette,
  Database,
} from "lucide-react";

import AdminLayout from "@/layouts/AdminLayout";

export default function AdminSettings() {
  return (
    <AdminLayout>
      <div className="space-y-8">

        {/* Header */}
        <div>
          <h1 className="text-4xl font-bold text-green-900">
            Settings
          </h1>

          <p className="text-gray-500 mt-2">
            Manage platform configuration, security and branding.
          </p>
        </div>

        {/* Store Settings */}
        <div className="bg-white rounded-2xl shadow-sm border p-6">
          <div className="flex items-center gap-3 mb-6">
            <Store className="text-green-700" />
            <h2 className="text-xl font-semibold">
              Store Configuration
            </h2>
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            <input
              placeholder="Store Name"
              className="border rounded-lg p-3"
            />

            <input
              placeholder="Support Email"
              className="border rounded-lg p-3"
            />

            <input
              placeholder="Support Phone"
              className="border rounded-lg p-3"
            />

            <input
              placeholder="Store Address"
              className="border rounded-lg p-3"
            />

            <input
              placeholder="Currency (INR)"
              className="border rounded-lg p-3"
            />

            <input
              placeholder="Tax Percentage"
              className="border rounded-lg p-3"
            />
          </div>
        </div>

        {/* Platform Controls */}
        <div className="bg-white rounded-2xl shadow-sm border p-6">
          <div className="flex items-center gap-3 mb-6">
            <Settings className="text-green-700" />
            <h2 className="text-xl font-semibold">
              Platform Controls
            </h2>
          </div>

          <div className="space-y-4">
            <label className="flex justify-between items-center">
              <span>Allow Seller Registration</span>
              <input type="checkbox" defaultChecked />
            </label>

            <label className="flex justify-between items-center">
              <span>Require Product Approval</span>
              <input type="checkbox" defaultChecked />
            </label>

            <label className="flex justify-between items-center">
              <span>Allow Customer Reviews</span>
              <input type="checkbox" defaultChecked />
            </label>

            <label className="flex justify-between items-center">
              <span>Maintenance Mode</span>
              <input type="checkbox" />
            </label>
          </div>
        </div>

        {/* Security */}
        <div className="bg-white rounded-2xl shadow-sm border p-6">
          <div className="flex items-center gap-3 mb-6">
            <Shield className="text-green-700" />
            <h2 className="text-xl font-semibold">
              Security
            </h2>
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            <input
              type="password"
              placeholder="New Password"
              className="border rounded-lg p-3"
            />

            <input
              type="password"
              placeholder="Confirm Password"
              className="border rounded-lg p-3"
            />
          </div>

          <button className="mt-4 bg-green-600 hover:bg-green-700 text-white px-6 py-3 rounded-lg">
            Update Password
          </button>
        </div>

        {/* Notifications */}
        <div className="bg-white rounded-2xl shadow-sm border p-6">
          <div className="flex items-center gap-3 mb-6">
            <Bell className="text-green-700" />
            <h2 className="text-xl font-semibold">
              Notifications
            </h2>
          </div>

          <div className="space-y-4">
            <label className="flex justify-between items-center">
              <span>New Order Alerts</span>
              <input type="checkbox" defaultChecked />
            </label>

            <label className="flex justify-between items-center">
              <span>Product Approval Requests</span>
              <input type="checkbox" defaultChecked />
            </label>

            <label className="flex justify-between items-center">
              <span>Low Stock Alerts</span>
              <input type="checkbox" defaultChecked />
            </label>

            <label className="flex justify-between items-center">
              <span>Seller Registration Alerts</span>
              <input type="checkbox" defaultChecked />
            </label>
          </div>
        </div>

        {/* Branding */}
        <div className="bg-white rounded-2xl shadow-sm border p-6">
          <div className="flex items-center gap-3 mb-6">
            <Palette className="text-green-700" />
            <h2 className="text-xl font-semibold">
              Branding
            </h2>
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            <input
              type="file"
              className="border rounded-lg p-3"
            />

            <input
              type="color"
              className="h-12 rounded-lg border"
            />
          </div>
        </div>

        {/* System Information */}
        <div className="bg-white rounded-2xl shadow-sm border p-6">
          <div className="flex items-center gap-3 mb-6">
            <Database className="text-green-700" />
            <h2 className="text-xl font-semibold">
              System Information
            </h2>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">

            <div className="bg-gray-50 rounded-xl p-4">
              <p className="text-gray-500 text-sm">
                Environment
              </p>
              <h3 className="font-bold mt-2">
                Production
              </h3>
            </div>

            <div className="bg-gray-50 rounded-xl p-4">
              <p className="text-gray-500 text-sm">
                Database
              </p>
              <h3 className="font-bold mt-2 text-green-600">
                Connected
              </h3>
            </div>

            <div className="bg-gray-50 rounded-xl p-4">
              <p className="text-gray-500 text-sm">
                Version
              </p>
              <h3 className="font-bold mt-2">
                v1.0.0
              </h3>
            </div>

            <div className="bg-gray-50 rounded-xl p-4">
              <p className="text-gray-500 text-sm">
                Last Backup
              </p>
              <h3 className="font-bold mt-2">
                Today
              </h3>
            </div>

          </div>
        </div>

        <div className="flex justify-end">
          <button className="bg-green-700 hover:bg-green-800 text-white px-8 py-3 rounded-xl font-semibold">
            Save Changes
          </button>
        </div>

      </div>
    </AdminLayout>
  );
}