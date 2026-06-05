import { useEffect, useState } from "react";

import AdminLayout from "@/layouts/AdminLayout";

import { supabase } from "@/lib/supabaseClient";

interface UserProfile {
  id: string;

  username: string;

  email: string;

  role: string;

  is_active: boolean;
}

export default function AdminUsers() {
  const [users, setUsers] = useState<UserProfile[]>([]);

  const [loading, setLoading] = useState(true);

  // FETCH USERS

  const fetchUsers = async () => {
    const { data, error } = await supabase

      .from("profiles")

      .select("*")

      .order("created_at", {
        ascending: false,
      });

    if (!error && data) {
      setUsers(data);
    }

    setLoading(false);
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  // TOGGLE USER ACTIVE STATUS

  const toggleUserStatus = async (id: string, currentStatus: boolean) => {
    await supabase

      .from("profiles")

      .update({
        is_active: !currentStatus,
      })

      .eq("id", id);

    fetchUsers();
  };

  // CHANGE ROLE

  const changeRole = async (id: string, role: string) => {
    await supabase

      .from("profiles")

      .update({
        role,
      })

      .eq("id", id);

    fetchUsers();
  };

  return (
    <AdminLayout>
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-green-900">User Management</h1>

        <p className="text-gray-600 mt-2">Manage platform users</p>
      </div>

      {/* TABLE */}

      <div className="bg-white rounded-2xl shadow-sm border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="text-left p-4">Username</th>

                <th className="text-left p-4">Email</th>

                <th className="text-left p-4">Role</th>

                <th className="text-left p-4">Status</th>

                <th className="text-left p-4">Actions</th>
              </tr>
            </thead>

            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={5} className="p-8 text-center">
                    Loading users...
                  </td>
                </tr>
              ) : (
                users.map((user) => (
                  <tr key={user.id} className="border-b">
                    <td className="p-4">{user.username}</td>

                    <td className="p-4">{user.email}</td>

                    <td className="p-4">
                      <select
                        value={user.role}
                        onChange={(e) => changeRole(user.id, e.target.value)}
                        className="border rounded-lg px-3 py-2"
                      >
                        <option value="buyer">Buyer</option>

                        <option value="seller">Seller</option>

                        <option value="admin">Admin</option>
                      </select>
                    </td>

                    <td className="p-4">
                      {user.is_active ? (
                        <span className="text-green-600 font-medium">
                          Active
                        </span>
                      ) : (
                        <span className="text-red-600 font-medium">
                          Blocked
                        </span>
                      )}
                    </td>

                    <td className="p-4">
                      <button
                        onClick={() =>
                          toggleUserStatus(user.id, user.is_active)
                        }
                        className={`px-4 py-2 rounded-lg text-white ${
                          user.is_active ? "bg-red-500" : "bg-green-600"
                        }`}
                      >
                        {user.is_active ? "Block" : "Activate"}
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </AdminLayout>
  );
}
