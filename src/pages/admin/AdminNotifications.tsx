import { useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  Bell,
  CheckCircle2,
  Circle,
  Filter,
  Inbox,
  MailCheck,
  MailOpen,
  RefreshCw,
  Search,
  Send,
  Trash2,
  UserCheck,
  Users,
  X,
} from "lucide-react";

import AdminLayout from "@/layouts/AdminLayout";
import { toast } from "@/components/ui/use-toast";
import { supabase } from "@/lib/supabaseClient";

interface Notification {
  id: string;
  user_id: string;
  title: string;
  message: string;
  type: string;
  is_read: boolean;
  created_at: string;
}

type RecipientTarget = "sellers" | "users" | "individual";
type ReadFilter = "all" | "read" | "unread";
type DateFilter = "all" | "today" | "week" | "month";

const DEFAULT_TYPES = ["general", "order", "system", "alert", "info"];

const getTypeStyles = (type: string) => {
  const normalizedType = type.toLowerCase();

  if (normalizedType.includes("order")) {
    return "bg-amber-50 text-amber-700 border-amber-200";
  }

  if (normalizedType.includes("system")) {
    return "bg-sky-50 text-sky-700 border-sky-200";
  }

  if (normalizedType.includes("alert")) {
    return "bg-rose-50 text-rose-700 border-rose-200";
  }

  if (normalizedType.includes("info")) {
    return "bg-blue-50 text-blue-700 border-blue-200";
  }

  return "bg-emerald-50 text-emerald-700 border-emerald-200";
};

const formatDate = (date: string) =>
  new Date(date).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });

const formatTime = (date: string) =>
  new Date(date).toLocaleTimeString("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
  });

export default function AdminNotifications() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState("all");
  const [filterRead, setFilterRead] = useState<ReadFilter>("all");
  const [filterDate, setFilterDate] = useState<DateFilter>("all");
  const [showSendModal, setShowSendModal] = useState(false);
  const [selectedNotification, setSelectedNotification] =
    useState<Notification | null>(null);
  const [sendTo, setSendTo] = useState<RecipientTarget>("sellers");
  const [sendTitle, setSendTitle] = useState("");
  const [sendMessage, setSendMessage] = useState("");
  const [sendType, setSendType] = useState("general");
  const [recipientId, setRecipientId] = useState("");
  const [sendLoading, setSendLoading] = useState(false);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [recipientCounts, setRecipientCounts] = useState({
    sellers: 0,
    users: 0,
  });

  const fetchRecipientCounts = async () => {
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, role");
      if (error) throw error;
      const list = Array.isArray(data) ? data : [];
      const sellers = list.filter((p: any) => p.role === "seller").length;
      const users = list.filter(
        (p: any) =>
          p.role === "buyer" || p.role === "customer" || p.role === "user",
      ).length;
      setRecipientCounts({ sellers, users });
    } catch (err) {
      console.error("Failed to fetch recipient counts:", err);
      setRecipientCounts({ sellers: 0, users: 0 });
    }
  };

  const fetchNotifications = async () => {
    setLoading(true);
    setError(null);

    try {
      const { data, error } = await supabase
        .from("notifications")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      const items = (data || []).map((n: any) => ({
        ...n,
        is_read:
          typeof n.is_read === "boolean"
            ? n.is_read
            : typeof n.read === "boolean"
              ? n.read
              : false,
      }));
      setNotifications(items as Notification[]);
    } catch (err: any) {
      setError(err.message || String(err));
      setNotifications([]);
      toast({
        title: "Failed to load notifications",
        description: err.message || String(err),
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNotifications();
    fetchRecipientCounts();
  }, []);

  const notificationTypes = useMemo(
    () =>
      Array.from(
        new Set([
          ...DEFAULT_TYPES,
          ...notifications.map((notification) => notification.type),
        ]),
      ).filter(Boolean),
    [notifications],
  );

  const filteredNotifications = useMemo(() => {
    let filtered = notifications;
    const term = search.trim().toLowerCase();

    if (term) {
      filtered = filtered.filter((notification) =>
        [
          notification.title,
          notification.message,
          notification.user_id,
          notification.type,
        ]
          .join(" ")
          .toLowerCase()
          .includes(term),
      );
    }

    if (filterType !== "all") {
      filtered = filtered.filter(
        (notification) => notification.type === filterType,
      );
    }

    if (filterRead === "read") {
      filtered = filtered.filter((notification) => notification.is_read);
    } else if (filterRead === "unread") {
      filtered = filtered.filter((notification) => !notification.is_read);
    }

    if (filterDate !== "all") {
      const now = new Date();
      const start = new Date(now);

      if (filterDate === "today") {
        start.setHours(0, 0, 0, 0);
      } else if (filterDate === "week") {
        start.setDate(now.getDate() - 7);
      } else if (filterDate === "month") {
        start.setMonth(now.getMonth() - 1);
      }

      filtered = filtered.filter(
        (notification) => new Date(notification.created_at) >= start,
      );
    }

    return filtered;
  }, [filterDate, filterRead, filterType, notifications, search]);

  const stats = useMemo(() => {
    const unread = notifications.filter(
      (notification) => !notification.is_read,
    ).length;
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    return {
      total: notifications.length,
      unread,
      read: notifications.length - unread,
      sentToday: notifications.filter(
        (notification) => new Date(notification.created_at) >= today,
      ).length,
      recipients: new Set(
        notifications.map((notification) => notification.user_id),
      ).size,
    };
  }, [notifications]);

  const hasActiveFilters =
    search.trim() ||
    filterType !== "all" ||
    filterRead !== "all" ||
    filterDate !== "all";

  const estimatedRecipients =
    sendTo === "sellers"
      ? recipientCounts.sellers
      : sendTo === "users"
        ? recipientCounts.users
        : recipientId.trim()
          ? 1
          : 0;

  const resetFilters = () => {
    setSearch("");
    setFilterType("all");
    setFilterRead("all");
    setFilterDate("all");
  };

  const resetSendForm = () => {
    setSendTo("sellers");
    setSendTitle("");
    setSendMessage("");
    setSendType("general");
    setRecipientId("");
  };

  const closeSendModal = () => {
    setShowSendModal(false);
    resetSendForm();
  };

  const toggleNotificationRead = async (id: string, isRead: boolean) => {
    setActionLoadingId(id);
    try {
      const { data, error } = await supabase
        .from("notifications")
        .update({ is_read: !isRead })
        .eq("id", id)
        .select()
        .maybeSingle();
      if (error) throw error;
      setNotifications((prev) =>
        prev.map((notification) =>
          notification.id === id
            ? { ...notification, is_read: !isRead }
            : notification,
        ),
      );
    } catch (err: any) {
      toast({
        title: "Could not update notification",
        description: err.message || String(err),
      });
    } finally {
      setActionLoadingId(null);
    }
  };

  const openNotificationDetail = async (notification: Notification) => {
    setSelectedNotification(notification);
    if (!notification.is_read) {
      setActionLoadingId(notification.id);
      try {
        const { error } = await supabase
          .from("notifications")
          .update({ is_read: true })
          .eq("id", notification.id);
        if (error) throw error;
        setNotifications((prev) =>
          prev.map((n) =>
            n.id === notification.id ? { ...n, is_read: true } : n,
          ),
        );
      } catch (err: any) {
        toast({
          title: "Could not mark as read",
          description: err.message || String(err),
        });
      } finally {
        setActionLoadingId(null);
      }
    }
  };

  const markFilteredAsRead = async () => {
    const unreadIds = filteredNotifications
      .filter((notification) => !notification.is_read)
      .map((notification) => notification.id);

    if (!unreadIds.length) {
      toast({ title: "No unread notifications in this view" });
      return;
    }

    try {
      const { error } = await supabase
        .from("notifications")
        .update({ is_read: true })
        .in("id", unreadIds);
      if (error) throw error;
      setNotifications((prev) =>
        prev.map((notification) =>
          unreadIds.includes(notification.id)
            ? { ...notification, is_read: true }
            : notification,
        ),
      );
      toast({
        title: "Notifications updated",
        description: `${unreadIds.length} notification(s) marked as read.`,
      });
    } catch (err: any) {
      toast({
        title: "Could not mark notifications as read",
        description: err.message || String(err),
      });
    }
  };

  const deleteNotification = async (id: string) => {
    const shouldDelete = window.confirm(
      "Delete this notification permanently?",
    );

    if (!shouldDelete) return;

    setActionLoadingId(id);
    try {
      const { error } = await supabase
        .from("notifications")
        .delete()
        .eq("id", id);
      if (error) throw error;
      setNotifications((prev) =>
        prev.filter((notification) => notification.id !== id),
      );
      toast({ title: "Notification deleted" });
    } catch (err: any) {
      toast({
        title: "Could not delete notification",
        description: err.message || String(err),
      });
    } finally {
      setActionLoadingId(null);
    }
  };

  const sendNotification = async () => {
    if (!sendTitle.trim() || !sendMessage.trim()) {
      toast({
        title: "Title and message are required",
        description: "Add both fields before sending the notification.",
      });
      return;
    }

    if (sendTo === "individual" && !recipientId.trim()) {
      toast({
        title: "User ID is required",
        description: "Enter the recipient user ID for an individual send.",
      });
      return;
    }

    setSendLoading(true);
    try {
      const title = sendTitle.trim() || "Notification";
      const message = sendMessage.trim();
      const type = sendType.trim() || "general";

      if (sendTo === "individual") {
        const recipient = recipientId.trim();
        const { error } = await supabase.from("notifications").insert({
          user_id: recipient,
          title,
          message,
          type,
        });
        if (error) throw error;
        toast({
          title: "Notification sent",
          description: `1 recipient will receive it.`,
        });
      } else if (sendTo === "sellers" || sendTo === "users") {
        const role = sendTo === "sellers" ? "seller" : "buyer";
        const { data: profiles, error: listErr } = await supabase
          .from("profiles")
          .select("id")
          .eq("role", role);
        if (listErr) throw listErr;
        const ids = (profiles || []).map((p: any) => p.id).filter(Boolean);
        if (ids.length === 0) throw new Error("No recipients found");
        const payload = ids.map((id) => ({
          user_id: id,
          title,
          message,
          type,
        }));
        const { error: insertErr } = await supabase
          .from("notifications")
          .insert(payload);
        if (insertErr) throw insertErr;
        toast({
          title: "Notification sent",
          description: `${ids.length} recipient(s) will receive it.`,
        });
      } else {
        // fallback: send to all profiles
        const { data: profiles, error: listErr } = await supabase
          .from("profiles")
          .select("id");
        if (listErr) throw listErr;
        const ids = (profiles || []).map((p: any) => p.id).filter(Boolean);
        if (ids.length === 0) throw new Error("No recipients found");
        const payload = ids.map((id) => ({
          user_id: id,
          title,
          message,
          type,
        }));
        const { error: insertErr } = await supabase
          .from("notifications")
          .insert(payload);
        if (insertErr) throw insertErr;
        toast({
          title: "Notification sent",
          description: `${ids.length} recipient(s) will receive it.`,
        });
      }

      closeSendModal();
      await fetchNotifications();
      await fetchRecipientCounts();
    } catch (sendError: any) {
      toast({
        title: "Error sending notification",
        description: sendError.message || "Please try again in a moment.",
      });
    } finally {
      setSendLoading(false);
    }
  };

  return (
    <AdminLayout>
      <div className="p-4 sm:p-6 lg:p-8">
        <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
              <Bell size={14} />
              Admin Messaging
            </div>
            <h1 className="text-3xl font-bold text-green-900">Notifications</h1>
            <p className="mt-2 max-w-2xl text-sm text-gray-600">
              Send announcements, review delivery history, and keep user alerts
              tidy from one workspace.
            </p>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <button
              type="button"
              onClick={() => {
                fetchNotifications();
                fetchRecipientCounts();
              }}
              className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50"
            >
              <RefreshCw size={17} />
              Refresh
            </button>
            <button
              type="button"
              onClick={() => setShowSendModal(true)}
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-green-600 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-green-700"
            >
              <Send size={17} />
              Send Notification
            </button>
          </div>
        </div>

        <div className="mb-6 grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          {[
            {
              label: "Total",
              value: stats.total,
              icon: Inbox,
              color: "text-green-700 bg-green-50",
            },
            {
              label: "Unread",
              value: stats.unread,
              icon: MailOpen,
              color: "text-amber-700 bg-amber-50",
            },
            {
              label: "Read",
              value: stats.read,
              icon: MailCheck,
              color: "text-blue-700 bg-blue-50",
            },
            {
              label: "Sent Today",
              value: stats.sentToday,
              icon: Send,
              color: "text-rose-700 bg-rose-50",
            },
            {
              label: "Recipients",
              value: stats.recipients,
              icon: Users,
              color: "text-slate-700 bg-slate-100",
            },
          ].map((stat) => {
            const Icon = stat.icon;

            return (
              <div
                key={stat.label}
                className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm"
              >
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-sm font-medium text-slate-500">
                      {stat.label}
                    </p>
                    <p className="mt-2 text-3xl font-semibold text-slate-950">
                      {stat.value}
                    </p>
                  </div>
                  <div className={`rounded-lg p-3 ${stat.color}`}>
                    <Icon size={22} />
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <div className="mb-6 rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <div className="grid gap-3 lg:grid-cols-[minmax(220px,1fr)_160px_160px_160px_auto_auto]">
            <label className="relative block">
              <Search
                size={17}
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
              />
              <input
                type="text"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search title, message, type, or user ID"
                className="h-11 w-full rounded-lg border border-slate-200 bg-slate-50 py-2 pl-10 pr-3 text-sm text-slate-900 outline-none transition focus:border-emerald-300 focus:bg-white focus:ring-2 focus:ring-emerald-100"
              />
            </label>

            <select
              value={filterType}
              onChange={(event) => setFilterType(event.target.value)}
              className="h-11 rounded-lg border border-slate-200 bg-slate-50 px-3 text-sm text-slate-900 outline-none transition focus:border-emerald-300 focus:bg-white focus:ring-2 focus:ring-emerald-100"
            >
              <option value="all">All Types</option>
              {notificationTypes.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>

            <select
              value={filterRead}
              onChange={(event) =>
                setFilterRead(event.target.value as ReadFilter)
              }
              className="h-11 rounded-lg border border-slate-200 bg-slate-50 px-3 text-sm text-slate-900 outline-none transition focus:border-emerald-300 focus:bg-white focus:ring-2 focus:ring-emerald-100"
            >
              <option value="all">All Status</option>
              <option value="read">Read</option>
              <option value="unread">Unread</option>
            </select>

            <select
              value={filterDate}
              onChange={(event) =>
                setFilterDate(event.target.value as DateFilter)
              }
              className="h-11 rounded-lg border border-slate-200 bg-slate-50 px-3 text-sm text-slate-900 outline-none transition focus:border-emerald-300 focus:bg-white focus:ring-2 focus:ring-emerald-100"
            >
              <option value="all">All Dates</option>
              <option value="today">Today</option>
              <option value="week">Last 7 Days</option>
              <option value="month">Last 30 Days</option>
            </select>

            <button
              type="button"
              onClick={markFilteredAsRead}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-4 text-sm font-semibold text-emerald-700 transition hover:bg-emerald-100"
            >
              <CheckCircle2 size={17} />
              Mark Read
            </button>

            <button
              type="button"
              onClick={resetFilters}
              disabled={!hasActiveFilters}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Filter size={17} />
              Reset
            </button>
          </div>
        </div>

        <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
          <div className="flex flex-col gap-2 border-b border-slate-200 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-base font-semibold text-slate-950">
                Notification History
              </h2>
              <p className="text-sm text-slate-500">
                Showing {filteredNotifications.length} of {notifications.length}
              </p>
            </div>
            {error && (
              <div className="inline-flex items-center gap-2 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">
                <AlertCircle size={16} />
                {error}
              </div>
            )}
          </div>

          <div className="hidden overflow-x-auto lg:block">
            <table className="min-w-full divide-y divide-slate-200">
              <thead className="bg-slate-50">
                <tr>
                  {[
                    "Status",
                    "Notification",
                    "Recipient",
                    "Type",
                    "Created",
                    "Actions",
                  ].map((heading) => (
                    <th
                      key={heading}
                      className={`px-5 py-4 text-sm font-semibold text-slate-500 ${
                        heading === "Actions" || heading === "Created"
                          ? "text-right"
                          : "text-left"
                      }`}
                    >
                      {heading}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {loading ? (
                  <tr>
                    <td
                      colSpan={6}
                      className="px-6 py-12 text-center text-sm text-slate-500"
                    >
                      Loading notifications...
                    </td>
                  </tr>
                ) : filteredNotifications.length === 0 ? (
                  <tr>
                    <td
                      colSpan={6}
                      className="px-6 py-12 text-center text-sm text-slate-500"
                    >
                      No notifications match the current filters.
                    </td>
                  </tr>
                ) : (
                  filteredNotifications.map((notification) => (
                    <tr
                      key={notification.id}
                      className={`transition hover:bg-slate-50 ${
                        !notification.is_read ? "bg-emerald-50/40" : ""
                      }`}
                    >
                      <td className="whitespace-nowrap px-5 py-4">
                        <button
                          type="button"
                          onClick={() =>
                            toggleNotificationRead(
                              notification.id,
                              notification.is_read,
                            )
                          }
                          disabled={actionLoadingId === notification.id}
                          className="inline-flex items-center gap-2 rounded-lg px-2 py-1 text-sm font-medium text-slate-600 transition hover:bg-white disabled:opacity-50"
                          title={
                            notification.is_read
                              ? "Mark as unread"
                              : "Mark as read"
                          }
                        >
                          {notification.is_read ? (
                            <CheckCircle2
                              size={19}
                              className="text-emerald-600"
                            />
                          ) : (
                            <Circle size={19} className="text-amber-500" />
                          )}
                          {notification.is_read ? "Read" : "Unread"}
                        </button>
                      </td>
                      <td className="max-w-md px-5 py-4">
                        <div
                          role="button"
                          tabIndex={0}
                          onClick={() => openNotificationDetail(notification)}
                          onKeyDown={(e) =>
                            e.key === "Enter" &&
                            openNotificationDetail(notification)
                          }
                          className="cursor-pointer"
                        >
                          <p className="font-semibold text-slate-950">
                            {notification.title}
                          </p>
                          <p className="mt-1 line-clamp-2 text-sm text-slate-600">
                            {notification.message}
                          </p>
                        </div>
                      </td>
                      <td className="whitespace-nowrap px-5 py-4 font-mono text-sm text-slate-600">
                        {notification.user_id.slice(0, 8)}...
                      </td>
                      <td className="whitespace-nowrap px-5 py-4">
                        <span
                          className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold capitalize ${getTypeStyles(
                            notification.type,
                          )}`}
                        >
                          {notification.type}
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-5 py-4 text-right text-sm text-slate-600">
                        <p>{formatDate(notification.created_at)}</p>
                        <p className="text-xs text-slate-400">
                          {formatTime(notification.created_at)}
                        </p>
                      </td>
                      <td className="whitespace-nowrap px-5 py-4 text-right">
                        <button
                          type="button"
                          onClick={() => deleteNotification(notification.id)}
                          disabled={actionLoadingId === notification.id}
                          className="inline-flex items-center justify-center rounded-lg p-2 text-rose-600 transition hover:bg-rose-50 hover:text-rose-700 disabled:opacity-50"
                          title="Delete notification"
                        >
                          <Trash2 size={18} />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className="divide-y divide-slate-100 lg:hidden">
            {loading ? (
              <p className="px-5 py-10 text-center text-sm text-slate-500">
                Loading notifications...
              </p>
            ) : filteredNotifications.length === 0 ? (
              <p className="px-5 py-10 text-center text-sm text-slate-500">
                No notifications match the current filters.
              </p>
            ) : (
              filteredNotifications.map((notification) => (
                <div
                  key={notification.id}
                  className={`p-5 ${!notification.is_read ? "bg-emerald-50/40" : ""}`}
                >
                  <div className="mb-3 flex items-start justify-between gap-3">
                    <div>
                      <button
                        type="button"
                        onClick={() => openNotificationDetail(notification)}
                        className="text-left font-semibold text-slate-950"
                      >
                        {notification.title}
                      </button>
                      <p className="mt-1 text-sm text-slate-600">
                        {notification.message}
                      </p>
                    </div>
                    <span
                      className={`inline-flex shrink-0 rounded-full border px-3 py-1 text-xs font-semibold capitalize ${getTypeStyles(
                        notification.type,
                      )}`}
                    >
                      {notification.type}
                    </span>
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-slate-500">
                    <span className="font-mono">
                      {notification.user_id.slice(0, 8)}...
                    </span>
                    <span>
                      {formatDate(notification.created_at)} at{" "}
                      {formatTime(notification.created_at)}
                    </span>
                  </div>

                  <div className="mt-4 flex gap-2">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleNotificationRead(
                          notification.id,
                          notification.is_read,
                        );
                      }}
                      disabled={actionLoadingId === notification.id}
                      className="inline-flex flex-1 items-center justify-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
                    >
                      {notification.is_read ? (
                        <Circle size={16} />
                      ) : (
                        <CheckCircle2 size={16} />
                      )}
                      {notification.is_read ? "Mark Unread" : "Mark Read"}
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteNotification(notification.id);
                      }}
                      disabled={actionLoadingId === notification.id}
                      className="inline-flex items-center justify-center rounded-lg border border-rose-200 px-3 py-2 text-sm font-semibold text-rose-600 transition hover:bg-rose-50 disabled:opacity-50"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {selectedNotification && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4">
            <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-lg bg-white shadow-xl">
              <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-6 py-5">
                <div>
                  <h2 className="text-xl font-bold text-green-900">
                    Notification
                  </h2>
                  <p className="mt-1 text-sm text-slate-500">Detail</p>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedNotification(null)}
                  className="rounded-lg p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-700"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="space-y-4 px-6 py-5">
                <div>
                  <p className="text-sm text-slate-500">Title</p>
                  <p className="font-semibold text-slate-900 mt-1">
                    {selectedNotification.title}
                  </p>
                </div>

                <div>
                  <p className="text-sm text-slate-500">Message</p>
                  <p className="mt-1 text-slate-700 whitespace-pre-wrap">
                    {selectedNotification.message}
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-slate-500">Recipient</p>
                    <p className="font-mono mt-1 text-sm text-slate-700">
                      {selectedNotification.user_id}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-slate-500">Type</p>
                    <p className="mt-1 text-sm text-slate-700 capitalize">
                      {selectedNotification.type}
                    </p>
                  </div>
                </div>

                <div>
                  <p className="text-sm text-slate-500">Created</p>
                  <p className="mt-1 text-sm text-slate-700">
                    {formatDate(selectedNotification.created_at)}{" "}
                    {formatTime(selectedNotification.created_at)}
                  </p>
                </div>
              </div>

              <div className="flex gap-3 border-t border-slate-200 px-6 py-4 justify-end">
                <button
                  onClick={() => {
                    if (selectedNotification) {
                      toggleNotificationRead(
                        selectedNotification.id,
                        selectedNotification.is_read,
                      );
                    }
                  }}
                  className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700"
                >
                  {selectedNotification.is_read ? "Mark Unread" : "Mark Read"}
                </button>
                <button
                  onClick={() => {
                    if (selectedNotification) {
                      deleteNotification(selectedNotification.id);
                      setSelectedNotification(null);
                    }
                  }}
                  className="rounded-lg bg-rose-600 px-4 py-2 text-sm font-semibold text-white"
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
        )}

        {showSendModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4">
            <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-lg bg-white shadow-xl">
              <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-6 py-5">
                <div>
                  <h2 className="text-xl font-bold text-green-900">
                    Send Notification
                  </h2>
                  <p className="mt-1 text-sm text-slate-500">
                    Compose a message for sellers, users, or a single account.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={closeSendModal}
                  disabled={sendLoading}
                  className="rounded-lg p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-700 disabled:opacity-50"
                  title="Close"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="space-y-5 px-6 py-5">
                <div className="grid gap-3 sm:grid-cols-3">
                  {[
                    {
                      value: "sellers",
                      label: "All Sellers",
                      count: recipientCounts.sellers,
                      icon: UserCheck,
                    },
                    {
                      value: "users",
                      label: "All Users",
                      count: recipientCounts.users,
                      icon: Users,
                    },
                    {
                      value: "individual",
                      label: "Individual",
                      count: recipientId.trim() ? 1 : 0,
                      icon: Bell,
                    },
                  ].map((target) => {
                    const Icon = target.icon;
                    const isSelected = sendTo === target.value;

                    return (
                      <button
                        key={target.value}
                        type="button"
                        onClick={() =>
                          setSendTo(target.value as RecipientTarget)
                        }
                        className={`rounded-lg border p-4 text-left transition ${
                          isSelected
                            ? "border-green-300 bg-green-50 text-green-900"
                            : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                        }`}
                      >
                        <Icon size={20} />
                        <p className="mt-3 text-sm font-semibold">
                          {target.label}
                        </p>
                        <p className="mt-1 text-xs text-slate-500">
                          {target.count} recipient(s)
                        </p>
                      </button>
                    );
                  })}
                </div>

                {sendTo === "individual" && (
                  <label className="block">
                    <span className="mb-2 block text-sm font-medium text-slate-700">
                      User ID
                    </span>
                    <input
                      type="text"
                      value={recipientId}
                      onChange={(event) => setRecipientId(event.target.value)}
                      placeholder="Paste recipient user ID"
                      className="h-11 w-full rounded-lg border border-slate-200 px-3 text-sm outline-none transition focus:border-emerald-300 focus:ring-2 focus:ring-emerald-100"
                    />
                  </label>
                )}

                <div className="grid gap-4 sm:grid-cols-[1fr_180px]">
                  <label className="block">
                    <span className="mb-2 block text-sm font-medium text-slate-700">
                      Title
                    </span>
                    <input
                      type="text"
                      value={sendTitle}
                      onChange={(event) => setSendTitle(event.target.value)}
                      placeholder="Short notification title"
                      maxLength={80}
                      className="h-11 w-full rounded-lg border border-slate-200 px-3 text-sm outline-none transition focus:border-emerald-300 focus:ring-2 focus:ring-emerald-100"
                    />
                    <p className="mt-1 text-xs text-slate-400">
                      {sendTitle.length}/80
                    </p>
                  </label>

                  <label className="block">
                    <span className="mb-2 block text-sm font-medium text-slate-700">
                      Type
                    </span>
                    <select
                      value={sendType}
                      onChange={(event) => setSendType(event.target.value)}
                      className="h-11 w-full rounded-lg border border-slate-200 px-3 text-sm capitalize outline-none transition focus:border-emerald-300 focus:ring-2 focus:ring-emerald-100"
                    >
                      {notificationTypes.map((type) => (
                        <option key={type} value={type}>
                          {type}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>

                <label className="block">
                  <span className="mb-2 block text-sm font-medium text-slate-700">
                    Message
                  </span>
                  <textarea
                    value={sendMessage}
                    onChange={(event) => setSendMessage(event.target.value)}
                    placeholder="Write the notification message"
                    rows={5}
                    maxLength={300}
                    className="w-full resize-none rounded-lg border border-slate-200 px-3 py-3 text-sm outline-none transition focus:border-emerald-300 focus:ring-2 focus:ring-emerald-100"
                  />
                  <p className="mt-1 text-xs text-slate-400">
                    {sendMessage.length}/300
                  </p>
                </label>

                <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                  <p className="text-sm font-semibold text-slate-900">
                    Delivery Preview
                  </p>
                  <p className="mt-1 text-sm text-slate-600">
                    This notification will be inserted for {estimatedRecipients}{" "}
                    recipient(s) as an unread {sendType || "general"} message.
                  </p>
                </div>
              </div>

              <div className="flex flex-col-reverse gap-3 border-t border-slate-200 px-6 py-5 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={closeSendModal}
                  disabled={sendLoading}
                  className="rounded-lg border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={sendNotification}
                  disabled={
                    sendLoading ||
                    !sendTitle.trim() ||
                    !sendMessage.trim() ||
                    estimatedRecipients === 0
                  }
                  className="inline-flex items-center justify-center gap-2 rounded-lg bg-green-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <Send size={17} />
                  {sendLoading ? "Sending..." : "Send Notification"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
