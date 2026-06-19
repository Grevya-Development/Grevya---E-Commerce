import { useEffect, useMemo, useState } from "react";
import {
  Ban,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Mail,
  RefreshCw,
  Search,
  Shield,
  ShieldCheck,
  Store,
  UserCheck,
  Users,
} from "lucide-react";

import AdminLayout from "@/layouts/AdminLayout";
import { supabase } from "@/lib/supabaseClient";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";

interface UserProfile {
  id: string;
  username: string;
  email: string;
  role: string;
  is_active: boolean;
}

const roleLabels: Record<string, string> = {
  admin: "Admin",
  seller: "Seller",
  buyer: "Buyer",
};

export default function AdminUsers() {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<UserProfile | null>(null);
  const [mutatingUserId, setMutatingUserId] = useState<string | null>(null);
  const perPage = 10;

  const { toast } = useToast();

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setUsers((data as UserProfile[]) || []);
    } catch (err) {
      console.error("Error fetching users:", err);
      toast({
        title: "Failed to load users",
        description:
          err instanceof Error ? err.message : "Unknown error occurred",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let unsubscribe: (() => void) | null = null;

    const setupRealtimeSubscription = async () => {
      await fetchUsers();

      const channel = supabase
        .channel("profiles-changes")
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "profiles",
          },
          () => fetchUsers(),
        )
        .subscribe((status) => {
          if (status === "CHANNEL_ERROR") {
            const interval = setInterval(() => {
              fetchUsers();
            }, 30000);
            unsubscribe = () => clearInterval(interval);
          }
        });

      unsubscribe = () => {
        supabase.removeChannel(channel);
      };
    };

    setupRealtimeSubscription();

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return users;
    return users.filter((user) =>
      [user.username, user.email, user.role]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(q),
    );
  }, [users, search]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / perPage));
  const pageItems = useMemo(() => {
    const start = (page - 1) * perPage;
    return filtered.slice(start, start + perPage);
  }, [filtered, page]);

  const stats = useMemo(
    () => ({
      total: users.length,
      active: users.filter((user) => user.is_active).length,
      blocked: users.filter((user) => !user.is_active).length,
      sellers: users.filter((user) => user.role === "seller").length,
      admins: users.filter((user) => user.role === "admin").length,
    }),
    [users],
  );

  useEffect(() => {
    if (page > totalPages) setPage(1);
  }, [page, totalPages]);

  const requestToggleUser = (user: UserProfile) => {
    setSelectedUser(user);
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setSelectedUser(null);
  };

  const confirmToggle = async () => {
    if (!selectedUser) return;

    const id = selectedUser.id;
    const current = selectedUser.is_active;
    setMutatingUserId(id);
    setModalOpen(false);

    try {
      const { data, error } = await supabase
        .from("profiles")
        .update({ is_active: !current })
        .eq("id", id)
        .select("id,is_active")
        .maybeSingle();

      if (error) throw error;
      if (!data || data.is_active !== !current) {
        throw new Error(
          "Supabase blocked this update. Run supabase/fix-admin-users-rls.sql so admins can update other users.",
        );
      }

      setUsers((prevUsers) =>
        prevUsers.map((user) =>
          user.id === id ? { ...user, is_active: data.is_active } : user,
        ),
      );

      toast({
        title: current ? "User blocked" : "User activated",
        description: `${selectedUser.username || selectedUser.email} is now ${
          current ? "blocked" : "active"
        }.`,
      });
    } catch (err) {
      console.error("Toggle error:", err);
      toast({
        title: "Action failed",
        description:
          err instanceof Error ? err.message : "Failed to update user status",
        variant: "destructive",
      });
      fetchUsers();
    } finally {
      setMutatingUserId(null);
      setSelectedUser(null);
    }
  };

  const changeRole = async (id: string, role: string) => {
    const previousUsers = users;
    setMutatingUserId(id);
    setUsers((prevUsers) =>
      prevUsers.map((user) => (user.id === id ? { ...user, role } : user)),
    );

    try {
      const { data, error } = await supabase
        .from("profiles")
        .update({ role })
        .eq("id", id)
        .select("id,role")
        .maybeSingle();

      if (error) throw error;
      if (!data || data.role !== role) {
        throw new Error(
          "Supabase blocked this update. Run supabase/fix-admin-users-rls.sql so admins can update other users.",
        );
      }

      toast({
        title: "Role updated",
        description: `Role set to ${roleLabels[role] || role}.`,
      });
    } catch (err) {
      console.error("Role change error:", err);
      setUsers(previousUsers);
      toast({
        title: "Failed to update role",
        description: err instanceof Error ? err.message : "Unknown error",
        variant: "destructive",
      });
      fetchUsers();
    } finally {
      setMutatingUserId(null);
    }
  };

  return (
    <AdminLayout>
      <div className="space-y-8">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-3xl font-bold text-green-900">
              User Management
            </h1>
            <p className="mt-2 text-gray-600">
              Review customer accounts, roles, and access status.
            </p>
          </div>
          <Button variant="outline" onClick={fetchUsers} className="gap-2">
            <RefreshCw className="h-4 w-4" />
            Refresh
          </Button>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
          <Card className="border-slate-200 bg-white">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardDescription>Total users</CardDescription>
              <Users className="h-5 w-5 text-green-700" />
            </CardHeader>
            <CardContent>
              <CardTitle className="text-3xl">{stats.total}</CardTitle>
            </CardContent>
          </Card>
          <Card className="border-slate-200 bg-white">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardDescription>Active</CardDescription>
              <UserCheck className="h-5 w-5 text-emerald-600" />
            </CardHeader>
            <CardContent>
              <CardTitle className="text-3xl">{stats.active}</CardTitle>
            </CardContent>
          </Card>
          <Card className="border-slate-200 bg-white">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardDescription>Blocked</CardDescription>
              <Ban className="h-5 w-5 text-red-600" />
            </CardHeader>
            <CardContent>
              <CardTitle className="text-3xl">{stats.blocked}</CardTitle>
            </CardContent>
          </Card>
          <Card className="border-slate-200 bg-white">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardDescription>Sellers</CardDescription>
              <Store className="h-5 w-5 text-amber-600" />
            </CardHeader>
            <CardContent>
              <CardTitle className="text-3xl">{stats.sellers}</CardTitle>
            </CardContent>
          </Card>
          <Card className="border-slate-200 bg-white">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardDescription>Admins</CardDescription>
              <ShieldCheck className="h-5 w-5 text-blue-600" />
            </CardHeader>
            <CardContent>
              <CardTitle className="text-3xl">{stats.admins}</CardTitle>
            </CardContent>
          </Card>
        </div>

        <Card className="border-slate-200 bg-white">
          <CardHeader className="gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <CardTitle>Platform users</CardTitle>
              <CardDescription>
                {loading ? "Loading users..." : `${filtered.length} matching users`}
              </CardDescription>
            </div>
            <div className="relative w-full md:max-w-sm">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input
                placeholder="Search name, email, or role"
                value={search}
                onChange={(event) => {
                  setSearch(event.target.value);
                  setPage(1);
                }}
                className="pl-9"
              />
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader className="bg-slate-50">
                <TableRow>
                  <TableHead>User</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell
                      colSpan={5}
                      className="h-32 text-center text-slate-500"
                    >
                      Loading users...
                    </TableCell>
                  </TableRow>
                ) : pageItems.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={5}
                      className="h-32 text-center text-slate-500"
                    >
                      No users match your search.
                    </TableCell>
                  </TableRow>
                ) : (
                  pageItems.map((user) => (
                    <TableRow key={user.id}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-green-100 text-sm font-semibold text-green-800">
                            {(user.username || user.email || "U")
                              .slice(0, 1)
                              .toUpperCase()}
                          </div>
                          <div>
                            <p className="font-medium text-slate-900">
                              {user.username || "Unnamed user"}
                            </p>
                            <p className="text-xs text-slate-500">
                              ID {user.id.slice(0, 8)}
                            </p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2 text-slate-700">
                          <Mail className="h-4 w-4 text-slate-400" />
                          {user.email || "No email"}
                        </div>
                      </TableCell>
                      <TableCell className="min-w-[150px]">
                        <Select
                          value={user.role || "buyer"}
                          onValueChange={(role) => changeRole(user.id, role)}
                          disabled={mutatingUserId === user.id}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="buyer">Buyer</SelectItem>
                            <SelectItem value="seller">Seller</SelectItem>
                            <SelectItem value="admin">Admin</SelectItem>
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={user.is_active ? "outline" : "destructive"}
                          className={
                            user.is_active
                              ? "border-green-200 bg-green-50 text-green-700"
                              : ""
                          }
                        >
                          {user.is_active ? (
                            <CheckCircle2 className="mr-1 h-3.5 w-3.5" />
                          ) : (
                            <Ban className="mr-1 h-3.5 w-3.5" />
                          )}
                          {user.is_active ? "Active" : "Blocked"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant={user.is_active ? "outline" : "default"}
                          size="sm"
                          onClick={() => requestToggleUser(user)}
                          disabled={mutatingUserId === user.id}
                          className={
                            user.is_active
                              ? "border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700"
                              : "bg-green-700 hover:bg-green-800"
                          }
                        >
                          {user.is_active ? (
                            <Ban className="h-4 w-4" />
                          ) : (
                            <Shield className="h-4 w-4" />
                          )}
                          {user.is_active ? "Block" : "Activate"}
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>

            <div className="flex flex-col gap-3 border-t p-4 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-slate-500">
                Showing {pageItems.length} of {filtered.length} users
              </p>
              <div className="flex items-center gap-3">
                <span className="text-sm text-slate-500">
                  Page {page} of {totalPages}
                </span>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => setPage((current) => Math.max(1, current - 1))}
                    disabled={page === 1}
                    aria-label="Previous page"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() =>
                      setPage((current) => Math.min(totalPages, current + 1))
                    }
                    disabled={page === totalPages}
                    aria-label="Next page"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Dialog
        open={modalOpen}
        onOpenChange={(open) => {
          if (!open) closeModal();
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {selectedUser?.is_active ? "Block user?" : "Activate user?"}
            </DialogTitle>
            <DialogDescription>
              {selectedUser?.is_active
                ? "This user will no longer be able to access their account until reactivated."
                : "This user will regain access to their account."}
            </DialogDescription>
          </DialogHeader>

          {selectedUser && (
            <div className="rounded-lg border bg-slate-50 p-4">
              <p className="font-medium text-slate-900">
                {selectedUser.username || "Unnamed user"}
              </p>
              <p className="mt-1 text-sm text-slate-500">
                {selectedUser.email || "No email"}
              </p>
            </div>
          )}

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={closeModal}>
              Cancel
            </Button>
            <Button
              onClick={confirmToggle}
              className={
                selectedUser?.is_active
                  ? "bg-red-600 hover:bg-red-700"
                  : "bg-green-700 hover:bg-green-800"
              }
            >
              {selectedUser?.is_active ? "Block user" : "Activate user"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}
