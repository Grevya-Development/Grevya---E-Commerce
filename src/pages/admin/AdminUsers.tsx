import { useEffect, useMemo, useState } from "react";

import AdminLayout from "@/layouts/AdminLayout";

import { supabase } from "@/lib/supabaseClient";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";

import { useToast } from "@/hooks/use-toast";

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
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const perPage = 10;
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<UserProfile | null>(null);
  const [pendingAction, setPendingAction] = useState<"toggle" | "none">(
    "none"
  );

  const { toast } = useToast();

  // FETCH USERS
  const fetchUsers = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      if (data) setUsers(data as UserProfile[]);
    } catch (err) {
      toast({ title: "Failed to load users", description: String(err) });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  // Client-side filtered and paginated users
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return users;
    return users.filter(
      (u) =>
        u.username?.toLowerCase().includes(q) ||
        u.email?.toLowerCase().includes(q)
    );
  }, [users, search]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / perPage));
  const pageItems = useMemo(() => {
    const start = (page - 1) * perPage;
    return filtered.slice(start, start + perPage);
  }, [filtered, page]);

  useEffect(() => {
    if (page > totalPages) setPage(1);
  }, [totalPages]);

  // TOGGLE USER ACTIVE STATUS (with confirmation)
  const requestToggleUser = (user: UserProfile) => {
    setSelectedUser(user);
    setPendingAction("toggle");
    setModalOpen(true);
  };

  const confirmToggle = async () => {
    if (!selectedUser) return;
    setModalOpen(false);
    const id = selectedUser.id;
    const current = selectedUser.is_active;
    try {
      const { error } = await supabase
        .from("profiles")
        .update({ is_active: !current })
        .eq("id", id);
      if (error) throw error;
      toast({
        title: `User ${selectedUser.username}`,
        description: current ? "User blocked" : "User activated",
      });
      fetchUsers();
    } catch (err) {
      toast({ title: "Action failed", description: String(err) });
    } finally {
      setSelectedUser(null);
      setPendingAction("none");
    }
  };

  
  // CHANGE ROLE with optimistic feedback
  const changeRole = async (id: string, role: string) => {
    try {
      const { error } = await supabase.from("profiles").update({ role }).eq("id", id);
      if (error) throw error;
      toast({ title: "Role updated", description: `Role set to ${role}` });
      fetchUsers();
    } catch (err) {
      toast({ title: "Failed to update role", description: String(err) });
    }
  };

  return (
    <AdminLayout>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-green-900">User Management</h1>
          <p className="text-gray-600 mt-2">Manage platform users</p>
        </div>

        <div className="flex items-center gap-4">
          <div className="text-sm text-muted-foreground">
            {loading ? "Loading..." : `${filtered.length} users`}
          </div>

          <input
            placeholder="Search by username or email"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className="border rounded-lg px-3 py-2"
          />
        </div>
      </div>

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
              ) : pageItems.length === 0 ? (
                <tr>
                  <td colSpan={5} className="p-8 text-center text-gray-500">
                    No users found.
                  </td>
                </tr>
              ) : (
                pageItems.map((user) => (
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
                        <span className="text-green-600 font-medium">Active</span>
                      ) : (
                        <span className="text-red-600 font-medium">Blocked</span>
                      )}
                    </td>
                    <td className="p-4">
                      <button
                        onClick={() => requestToggleUser(user)}
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

        {/* Pagination */}
        <div className="flex items-center justify-between p-4 border-t">
          <div className="text-sm text-muted-foreground">
            Page {page} of {totalPages}
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="px-3 py-1 border rounded disabled:opacity-50"
            >
              Prev
            </button>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="px-3 py-1 border rounded disabled:opacity-50"
            >
              Next
            </button>
          </div>
        </div>
      </div>

      {/* Confirmation Dialog */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm action</DialogTitle>
            <DialogDescription>
              Are you sure you want to {selectedUser?.is_active ? "block" : "activate"} user <strong>{selectedUser?.username}</strong>?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="mt-4 flex gap-2 justify-end">
            <button
              onClick={() => setModalOpen(false)}
              className="px-4 py-2 border rounded"
            >
              Cancel
            </button>
            <button
              onClick={confirmToggle}
              className="px-4 py-2 rounded bg-red-500 text-white"
            >
              Confirm
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}
