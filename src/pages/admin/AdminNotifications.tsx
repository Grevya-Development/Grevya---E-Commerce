import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import type { DateRange } from "react-day-picker";
import {
  AlertCircle,
  AlertTriangle,
  Bell,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  Circle,
  Clock3,
  CreditCard,
  Filter,
  Inbox,
  Package,
  RefreshCw,
  Search,
  Send,
  Settings,
  ShoppingCart,
  Store,
  Trash2,
  UserCheck,
  UserRound,
  Users,
  X,
  XCircle,
} from "lucide-react";

import AdminLayout from "@/layouts/AdminLayout";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverAnchor, PopoverContent } from "@/components/ui/popover";
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

type NotificationRecord = Partial<Notification> & { read?: boolean };
type ProfileRecord = {
  id?: string | null;
  role?: string | null;
  full_name?: string | null;
  username?: string | null;
  email?: string | null;
};

const getErrorMessage = (error: unknown) => {
  if (error instanceof Error) return error.message;
  if (typeof error === "object" && error !== null) {
    const details = error as Record<string, unknown>;
    return [details.message, details.details, details.hint, details.code]
      .filter((value): value is string => typeof value === "string" && Boolean(value))
      .join(" — ") || "The notification could not be updated.";
  }
  return String(error);
};

type RecipientTarget = "sellers" | "users" | "individual";
type ReadFilter = "all" | "read" | "unread";
type DateFilter = "all" | "today" | "week" | "month" | "custom";
type SortOrder = "newest" | "oldest";

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

const formatDateRange = (range: DateRange | undefined) => {
  if (!range?.from) return "Select date range";

  const options: Intl.DateTimeFormatOptions = { day: "numeric", month: "short", year: "numeric" };
  const from = range.from.toLocaleDateString("en-IN", options);
  const to = range.to?.toLocaleDateString("en-IN", options);
  return to ? `${from} – ${to}` : `${from} – Select end date`;
};

const formatRelativeTime = (date: string) => {
  const difference = Date.now() - new Date(date).getTime();
  const minutes = Math.floor(difference / 60_000);

  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  if (hours < 48) return "Yesterday";
  return new Date(date).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
  });
};

const getNotificationPresentation = (type: string) => {
  const normalized = type.toLowerCase();

  if (normalized.includes("order")) return { icon: ShoppingCart, label: "Order", className: "bg-amber-50 text-amber-700 ring-amber-100" };
  if (normalized.includes("product")) return { icon: Package, label: "Product", className: "bg-violet-50 text-violet-700 ring-violet-100" };
  if (normalized.includes("seller")) return { icon: Store, label: "Seller", className: "bg-orange-50 text-orange-700 ring-orange-100" };
  if (normalized.includes("user") || normalized.includes("customer")) return { icon: UserRound, label: "User", className: "bg-sky-50 text-sky-700 ring-sky-100" };
  if (normalized.includes("payment")) return { icon: CreditCard, label: "Payment", className: "bg-emerald-50 text-emerald-700 ring-emerald-100" };
  if (normalized.includes("alert") || normalized.includes("warning")) return { icon: AlertTriangle, label: "Alert", className: "bg-rose-50 text-rose-700 ring-rose-100" };
  if (normalized.includes("error")) return { icon: XCircle, label: "Error", className: "bg-rose-50 text-rose-700 ring-rose-100" };
  if (normalized.includes("system")) return { icon: Settings, label: "System", className: "bg-slate-100 text-slate-700 ring-slate-200" };
  if (normalized.includes("success")) return { icon: CheckCircle2, label: "Success", className: "bg-emerald-50 text-emerald-700 ring-emerald-100" };
  return { icon: Bell, label: "General", className: "bg-[#f1f3e8] text-[#59632f] ring-[#e1e7cd]" };
};

export default function AdminNotifications() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState("all");
  const [filterRead, setFilterRead] = useState<ReadFilter>("all");
  const [filterDate, setFilterDate] = useState<DateFilter>("all");
  const [customDateRange, setCustomDateRange] = useState<DateRange>();
  const [isCustomCalendarOpen, setIsCustomCalendarOpen] = useState(false);
  const [sortOrder, setSortOrder] = useState<SortOrder>("newest");
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
  const [markAllLoading, setMarkAllLoading] = useState(false);
  const [recipientCounts, setRecipientCounts] = useState({
    sellers: 0,
    users: 0,
  });
  const [recipientNames, setRecipientNames] = useState<Record<string, string>>({});

  const fetchRecipientCounts = async () => {
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, role, full_name, username, email");
      if (error) throw error;
      const list = (Array.isArray(data) ? data : []) as ProfileRecord[];
      const sellers = list.filter((p) => p.role === "seller").length;
      const users = list.filter(
        (p) => p.role === "customer" || p.role === "user",
      ).length;
      setRecipientCounts({ sellers, users });
      setRecipientNames(
        Object.fromEntries(
          list.flatMap((profile) => {
            const displayName = profile.full_name || profile.username || profile.email;
            return profile.id && displayName ? [[profile.id, displayName]] : [];
          }),
        ),
      );
    } catch (err) {
      console.error("Failed to fetch recipient counts:", err);
      setRecipientCounts({ sellers: 0, users: 0 });
      setRecipientNames({});
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
      const items = ((data || []) as NotificationRecord[]).map((n) => ({
        ...n,
        // Older notification rows can have nullable fields. Normalize them
        // before rendering so one incomplete row cannot break the page.
        id: typeof n.id === "string" ? n.id : "",
        user_id: typeof n.user_id === "string" ? n.user_id : "Unknown user",
        title: typeof n.title === "string" ? n.title : "Notification",
        message: typeof n.message === "string" ? n.message : "",
        type: typeof n.type === "string" && n.type ? n.type : "general",
        created_at:
          typeof n.created_at === "string" ? n.created_at : new Date(0).toISOString(),
        is_read:
          typeof n.is_read === "boolean"
            ? n.is_read
            : typeof n.read === "boolean"
              ? n.read
              : false,
      }));
      setNotifications(items as Notification[]);
    } catch (err: unknown) {
      setError(getErrorMessage(err));
      setNotifications([]);
      toast({
        title: "Failed to load notifications",
        description: "Please try again in a moment.",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNotifications();
    fetchRecipientCounts();
  }, []);

  useEffect(() => {
    const channel = supabase
      .channel("admin-notifications-live")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "notifications" },
        (payload) => {
          const notification = payload.new as Partial<Notification>;
          if (!notification.id) return;
          setNotifications((previous) => [
            {
              id: notification.id,
              user_id: notification.user_id || "Unknown user",
              title: notification.title || "Notification",
              message: notification.message || "",
              type: notification.type || "general",
              is_read: notification.is_read ?? false,
              created_at: notification.created_at || new Date().toISOString(),
            },
            ...previous.filter((item) => item.id !== notification.id),
          ]);
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
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

    if (filterDate !== "all" && filterDate !== "custom") {
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

    if (filterDate === "custom" && customDateRange?.from) {
      const start = new Date(customDateRange.from);
      start.setHours(0, 0, 0, 0);
      const end = new Date(customDateRange.to ?? customDateRange.from);
      end.setHours(23, 59, 59, 999);

      filtered = filtered.filter((notification) => {
        const date = new Date(notification.created_at);
        return date >= start && date <= end;
      });
    }

    return [...filtered].sort((a, b) => {
      const difference =
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      return sortOrder === "newest" ? difference : -difference;
    });
  }, [customDateRange, filterDate, filterRead, filterType, notifications, search, sortOrder]);

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
    filterDate !== "all" ||
    Boolean(customDateRange?.from);
  const selectedPresentation = selectedNotification
    ? getNotificationPresentation(selectedNotification.type)
    : null;

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
    setCustomDateRange(undefined);
    setIsCustomCalendarOpen(false);
    setSortOrder("newest");
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

  const updateReadStatus = async (ids: string[], value: boolean) => {
    const { error: modernError } = await supabase
      .from("notifications")
      .update({ is_read: value })
      .in("id", ids);

    if (!modernError) return;
    if (!getErrorMessage(modernError).toLowerCase().includes("is_read")) {
      throw modernError;
    }

    const { error: legacyError } = await supabase
      .from("notifications")
      .update({ read: value })
      .in("id", ids);
    if (legacyError) throw legacyError;
  };

  const toggleNotificationRead = async (id: string, isRead: boolean) => {
    setActionLoadingId(id);
    setNotifications((previous) =>
      previous.map((notification) =>
        notification.id === id
          ? { ...notification, is_read: !isRead }
          : notification,
      ),
    );
    setSelectedNotification((previous) =>
      previous?.id === id ? { ...previous, is_read: !isRead } : previous,
    );
    try {
      await updateReadStatus([id], !isRead);
    } catch (err: unknown) {
      setNotifications((previous) =>
        previous.map((notification) =>
          notification.id === id
            ? { ...notification, is_read: isRead }
            : notification,
        ),
      );
      setSelectedNotification((previous) =>
        previous?.id === id ? { ...previous, is_read: isRead } : previous,
      );
      toast({
        title: "Could not update notification",
        description: getErrorMessage(err),
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
        await updateReadStatus([notification.id], true);
        setNotifications((prev) =>
          prev.map((n) =>
            n.id === notification.id ? { ...n, is_read: true } : n,
          ),
        );
      } catch (err: unknown) {
        toast({
          title: "Could not mark as read",
          description: getErrorMessage(err),
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
      await updateReadStatus(unreadIds, true);
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
    } catch (err: unknown) {
      toast({
        title: "Could not mark notifications as read",
        description: getErrorMessage(err),
      });
    }
  };

  const markAllAsRead = async () => {
    const unreadIds = notifications
      .filter((notification) => !notification.is_read)
      .map((notification) => notification.id);

    if (!unreadIds.length) {
      toast({ title: "You're all caught up" });
      return;
    }

    setMarkAllLoading(true);
    try {
      await updateReadStatus(unreadIds, true);
      setNotifications((previous) =>
        previous.map((notification) =>
          unreadIds.includes(notification.id)
            ? { ...notification, is_read: true }
            : notification,
        ),
      );
      toast({
        title: "All notifications marked as read",
        description: `${unreadIds.length} notification(s) updated.`,
      });
    } catch (err: unknown) {
      console.error("Mark all as read failed:", err);
      toast({
        title: "Could not mark all notifications as read",
        description: "Please try again in a moment.",
      });
    } finally {
      setMarkAllLoading(false);
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
    } catch (err: unknown) {
      toast({
        title: "Could not delete notification",
        description: getErrorMessage(err),
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
        title: "Email address is required",
        description:
          "Enter the recipient's email address for an individual send.",
      });
      return;
    }

    setSendLoading(true);
    try {
      const title = sendTitle.trim() || "Notification";
      const message = sendMessage.trim();
      const type = sendType.trim() || "general";

      if (sendTo === "individual") {
        const recipientEmail = recipientId.trim();

        // Look up user by email
        const { data: userProfile, error: lookupErr } = await supabase
          .from("profiles")
          .select("id, email")
          .eq("email", recipientEmail)
          .single();

        if (lookupErr || !userProfile) {
          throw new Error("No user found with that email address");
        }

        const { error } = await supabase.from("notifications").insert({
          user_id: userProfile.id,
          title,
          message,
          type,
        });
        if (error) throw error;
        toast({
          title: "Notification sent",
          description: `Notification sent to ${recipientEmail}`,
        });
      } else if (sendTo === "sellers" || sendTo === "users") {
        const role = sendTo === "sellers" ? "seller" : "customer";
        const { data: profiles, error: listErr } = await supabase
          .from("profiles")
          .select("id")
          .eq("role", role);
        if (listErr) throw listErr;
        const ids = (profiles || []).map((p: ProfileRecord) => p.id).filter((id): id is string => Boolean(id));
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
        const ids = (profiles || []).map((p: ProfileRecord) => p.id).filter((id): id is string => Boolean(id));
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
    } catch (sendError: unknown) {
      toast({
        title: "Error sending notification",
        description: getErrorMessage(sendError) || "Please try again in a moment.",
      });
    } finally {
      setSendLoading(false);
    }
  };

  return (
    <AdminLayout>
      <div className="mx-auto max-w-6xl p-4 sm:p-6 lg:p-8">
        <div className="mb-8 flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-start gap-4">
            <div className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-[#303a18] text-[#f7f4ea] shadow-sm">
              <Bell size={22} />
            </div>
            <div>
              <div className="mb-2 inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-[#687244]">
                <span className="relative flex size-2"><span className="absolute inline-flex size-2 animate-ping rounded-full bg-emerald-500 opacity-60" /><span className="relative inline-flex size-2 rounded-full bg-emerald-600" /></span>
                Live
              </div>
              <h1 className="font-serif text-3xl font-bold text-[#283111] sm:text-4xl">Notifications</h1>
              <p className="mt-2 max-w-xl text-sm leading-6 text-slate-600">Stay updated with important activity across your marketplace.</p>
            </div>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <button
              type="button"
              onClick={markAllAsRead}
              disabled={loading || markAllLoading || stats.unread === 0}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-[#dce2c7] bg-[#f5f7ee] px-4 py-3 text-sm font-semibold text-[#455221] transition hover:bg-[#eaf0da] disabled:cursor-not-allowed disabled:opacity-50"
            >
              <CheckCircle2 size={17} />
              {markAllLoading ? "Marking as read..." : "Mark all as read"}
            </button>
            <button
              type="button"
              onClick={() => {
                fetchNotifications();
                fetchRecipientCounts();
              }}
              aria-label="Refresh notifications"
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
            >
              <RefreshCw size={17} />
              Refresh
            </button>
            <button
              type="button"
              onClick={() => setShowSendModal(true)}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#303a18] px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-[#435125]"
            >
              <Send size={17} />
              Send Notification
            </button>
          </div>
        </div>

        <div className="mb-7 grid grid-cols-3 divide-x divide-[#e7e8de] overflow-hidden rounded-2xl border border-[#e7e8de] bg-white shadow-[0_8px_30px_rgba(48,58,24,0.05)]">
          {[
            {
              label: "Unread",
              value: stats.unread,
              icon: Bell,
              color: "text-[#56642c] bg-[#f0f3e5]",
            },
            {
              label: "Total",
              value: stats.total,
              icon: Inbox,
              color: "text-slate-700 bg-slate-100",
            },
            {
              label: "Today",
              value: stats.sentToday,
              icon: Clock3,
              color: "text-amber-700 bg-amber-50",
            },
          ].map((stat) => {
            const Icon = stat.icon;

            return (
              <div
                key={stat.label}
                className="min-w-0 px-4 py-4 sm:px-6"
              >
                <div className="flex items-center justify-between gap-4">
                  <div className="min-w-0">
                    <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                      {stat.label}
                    </p>
                    <p className="mt-1 text-2xl font-semibold text-[#293110] sm:text-3xl">
                      {stat.value}
                    </p>
                  </div>
                  <div className={`hidden rounded-xl p-2.5 sm:block ${stat.color}`}>
                    <Icon size={19} />
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <div className="mb-6 rounded-2xl border border-[#e7e8de] bg-white p-3 shadow-[0_8px_30px_rgba(48,58,24,0.04)] sm:p-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
            <label className="relative block">
              <Search
                size={17}
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
              />
              <input
                type="text"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                aria-label="Search notifications"
                placeholder="Search notifications..."
                className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 py-2 pl-10 pr-3 text-sm text-slate-900 outline-none transition focus:border-[#aab77a] focus:bg-white focus:ring-2 focus:ring-[#edf1dd] lg:w-72"
              />
            </label>

            <div className="flex shrink-0 rounded-xl bg-slate-100 p-1" role="group" aria-label="Notification status filter">
              {(["all", "unread", "read"] as ReadFilter[]).map((status) => (
                <button key={status} type="button" onClick={() => setFilterRead(status)} className={`rounded-lg px-3 py-2 text-sm font-semibold capitalize transition ${filterRead === status ? "bg-white text-[#364019] shadow-sm" : "text-slate-500 hover:text-slate-700"}`}>
                  {status}
                </button>
              ))}
            </div>

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

            <Popover
              open={filterDate === "custom" && isCustomCalendarOpen}
              onOpenChange={setIsCustomCalendarOpen}
            >
              <PopoverAnchor asChild>
                <select
                  value={filterDate}
                  onChange={(event) => {
                    const value = event.target.value as DateFilter;
                    setFilterDate(value);
                    setIsCustomCalendarOpen(value === "custom");
                    if (value !== "custom") setCustomDateRange(undefined);
                  }}
                  className="h-11 rounded-lg border border-slate-200 bg-slate-50 px-3 text-sm text-slate-900 outline-none transition focus:border-emerald-300 focus:bg-white focus:ring-2 focus:ring-emerald-100"
                >
                  <option value="all">All Dates</option>
                  <option value="today">Today</option>
                  <option value="week">Last 7 Days</option>
                  <option value="month">Last 30 Days</option>
                  <option value="custom">Custom</option>
                </select>
              </PopoverAnchor>
              <PopoverContent align="start" className="w-auto p-0">
                <div className="flex items-center gap-2 border-b border-slate-100 px-3 py-2 text-sm font-semibold text-slate-700">
                  <CalendarDays size={16} className="text-slate-500" />
                  {formatDateRange(customDateRange)}
                </div>
                <Calendar
                  mode="range"
                  selected={customDateRange}
                  onSelect={setCustomDateRange}
                  numberOfMonths={1}
                  initialFocus
                />
                {customDateRange?.from && (
                  <div className="flex justify-end border-t border-slate-100 p-2">
                    <button
                      type="button"
                      onClick={() => setCustomDateRange(undefined)}
                      className="rounded-md px-2 py-1 text-xs font-semibold text-slate-600 transition hover:bg-slate-100"
                    >
                      Clear dates
                    </button>
                  </div>
                )}
              </PopoverContent>
            </Popover>

            <select
              value={sortOrder}
              onChange={(event) => setSortOrder(event.target.value as SortOrder)}
              aria-label="Sort notifications"
              className="h-11 rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm text-slate-900 outline-none transition focus:border-emerald-300 focus:bg-white focus:ring-2 focus:ring-emerald-100"
            >
              <option value="newest">Newest</option>
              <option value="oldest">Oldest</option>
            </select>

            <button
              type="button"
              onClick={markFilteredAsRead}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 text-sm font-semibold text-emerald-700 transition hover:bg-emerald-100"
            >
              <CheckCircle2 size={17} />
              Mark Read
            </button>

            <button
              type="button"
              onClick={resetFilters}
              disabled={!hasActiveFilters}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Filter size={17} />
              Reset
            </button>
          </div>
        </div>

        <div className="overflow-hidden rounded-2xl border border-[#e7e8de] bg-white shadow-[0_12px_36px_rgba(48,58,24,0.05)]">
          <div className="flex flex-col gap-2 border-b border-[#e7e8de] px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-base font-semibold text-slate-950">
                Recent activity
              </h2>
              <p className="text-sm text-slate-500">
                Showing {filteredNotifications.length} of {notifications.length} notifications
              </p>
            </div>
            {error && (
              <div className="inline-flex items-center gap-2 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">
                <AlertCircle size={16} />
                Unable to load notifications. Please try again.
                <button type="button" onClick={fetchNotifications} className="font-semibold underline underline-offset-2 hover:text-rose-900">Try again</button>
              </div>
            )}
          </div>

          <div className="hidden overflow-x-auto">
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

          <div className="divide-y divide-[#edf0e4]">
            {loading ? (
              <div className="space-y-1 p-3" aria-label="Loading notifications">
                {Array.from({ length: 6 }, (_, index) => (
                  <div key={index} className="flex animate-pulse items-center gap-4 rounded-xl p-3 sm:p-4">
                    <div className="size-11 shrink-0 rounded-xl bg-slate-100" />
                    <div className="min-w-0 flex-1 space-y-2"><div className="h-4 w-2/5 rounded bg-slate-100" /><div className="h-3 w-4/5 rounded bg-slate-100" /></div>
                    <div className="h-3 w-14 rounded bg-slate-100" />
                  </div>
                ))}
              </div>
            ) : filteredNotifications.length === 0 ? (
              <div className="px-5 py-16 text-center">
                <div className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-[#f1f3e8] text-[#657139]"><Bell size={25} /></div>
                <h3 className="mt-4 font-serif text-xl font-bold text-[#303a18]">{hasActiveFilters ? "Nothing matches your filters" : "You're all caught up"}</h3>
                <p className="mt-2 text-sm text-slate-500">{hasActiveFilters ? "Try changing your search or filter." : "No new notifications to review."}</p>
                {hasActiveFilters && <button type="button" onClick={resetFilters} className="mt-5 text-sm font-semibold text-[#56642c] hover:text-[#303a18]">Clear filters</button>}
              </div>
            ) : (
              filteredNotifications.map((notification) => (
                <div
                  key={notification.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => openNotificationDetail(notification)}
                  onKeyDown={(event) => event.key === "Enter" && openNotificationDetail(notification)}
                  className={`group relative flex cursor-pointer gap-3 p-4 transition hover:bg-[#fafbf7] focus:outline-none focus-visible:bg-[#fafbf7] focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#9daa6f] sm:gap-4 sm:p-5 ${!notification.is_read ? "bg-[#f8faef]" : ""}`}
                >
                  {(() => { const presentation = getNotificationPresentation(notification.type); const Icon = presentation.icon; return <div className={`flex size-11 shrink-0 items-center justify-center rounded-xl ring-1 ${presentation.className}`}><Icon size={20} /></div>; })()}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2"><p className={`truncate text-sm sm:text-base ${notification.is_read ? "font-semibold text-slate-700" : "font-bold text-[#27300f]"}`}>{notification.title}</p>{!notification.is_read && <span className="size-2 shrink-0 rounded-full bg-[#6a7936]" aria-label="Unread" />}</div>
                        <p className="mt-1 line-clamp-2 text-sm leading-6 text-slate-600">{notification.message}</p>
                      </div>
                      <span className="shrink-0 text-xs font-medium text-slate-400">{formatRelativeTime(notification.created_at)}</span>
                    </div>
                    <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500"><span className="capitalize">{notification.type}</span><span aria-hidden="true">•</span><span className="font-mono">{notification.user_id.slice(0, 8)}…</span></div>
                  </div>
                  <div className="flex shrink-0 items-center gap-1 self-center">
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
                      aria-label={notification.is_read ? "Mark notification as unread" : "Mark notification as read"}
                      className="inline-flex items-center justify-center rounded-lg p-2 text-slate-500 transition hover:bg-white hover:text-[#56642c] disabled:opacity-50"
                    >
                      {notification.is_read ? (
                        <Circle size={16} />
                      ) : (
                        <CheckCircle2 size={16} />
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteNotification(notification.id);
                      }}
                      disabled={actionLoadingId === notification.id}
                      aria-label="Delete notification"
                      className="inline-flex items-center justify-center rounded-lg p-2 text-slate-400 transition hover:bg-rose-50 hover:text-rose-600 disabled:opacity-50"
                    >
                      <Trash2 size={17} />
                    </button>
                    <ChevronRight size={18} className="hidden text-slate-300 sm:block" aria-hidden="true" />
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {selectedNotification && selectedPresentation && createPortal(
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/50 p-4">
            <div
              role="dialog"
              aria-modal="true"
              aria-labelledby="notification-detail-title"
              className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-3xl bg-white shadow-2xl shadow-slate-950/30"
            >
              <div className="relative overflow-hidden bg-[#f6f8ee] px-6 py-6 sm:px-8">
                <div className="absolute -right-12 -top-14 size-40 rounded-full bg-[#dce5bc]/60 blur-2xl" aria-hidden="true" />
                <div className="relative flex items-start justify-between gap-4">
                  <div className="flex min-w-0 items-center gap-4">
                    <div className={`flex size-12 shrink-0 items-center justify-center rounded-2xl ring-1 ${selectedPresentation.className}`}>
                      <selectedPresentation.icon size={22} />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#687244]">Notification detail</p>
                      <h2 id="notification-detail-title" className="mt-1 truncate font-serif text-2xl font-bold text-[#283111]">
                        {selectedNotification.title}
                      </h2>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSelectedNotification(null)}
                    aria-label="Close notification detail"
                    className="rounded-xl p-2 text-slate-500 transition hover:bg-white hover:text-slate-900"
                  >
                    <X size={18} />
                  </button>
                </div>
              </div>

              <div className="space-y-6 px-6 py-6 sm:px-8">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-400">Message</p>
                  <p className="mt-2 whitespace-pre-wrap text-[15px] leading-7 text-slate-700">
                    {selectedNotification.message}
                  </p>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-2xl border border-slate-100 bg-slate-50/80 p-4">
                    <p className="text-xs font-bold uppercase tracking-[0.12em] text-slate-400">Recipient</p>
                    <p className="mt-2 truncate text-sm font-semibold text-slate-800">
                      {recipientNames[selectedNotification.user_id] || "Recipient unavailable"}
                    </p>
                  </div>
                  <div className="rounded-2xl border border-slate-100 bg-slate-50/80 p-4">
                    <p className="text-xs font-bold uppercase tracking-[0.12em] text-slate-400">Category</p>
                    <div className="mt-2 inline-flex items-center gap-2 text-sm font-semibold text-slate-800">
                      <span className={`size-2 rounded-full ${selectedPresentation.className.split(" ")[0] || "bg-slate-400"}`} />
                      {selectedPresentation.label}
                    </div>
                  </div>
                </div>

                <div className="border-t border-slate-100 pt-5">
                  <p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-400">Received</p>
                  <p className="mt-2 text-sm font-medium text-slate-700">
                    {formatDate(selectedNotification.created_at)}{" "}
                    {formatTime(selectedNotification.created_at)}
                  </p>
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 border-t border-slate-100 bg-slate-50/60 px-6 py-4 sm:px-8">
                <button
                  onClick={() => {
                    if (selectedNotification) {
                      toggleNotificationRead(
                        selectedNotification.id,
                        selectedNotification.is_read,
                      );
                    }
                  }}
                  className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:border-[#b5c180] hover:bg-[#f6f8ee]"
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
                  className="rounded-xl bg-rose-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-rose-700"
                >
                  Delete
                </button>
              </div>
            </div>
          </div>,
          document.body,
        )}

        {showSendModal && createPortal(
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/50 p-4">
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
                      Email Address
                    </span>
                    <input
                      type="email"
                      value={recipientId}
                      onChange={(event) => setRecipientId(event.target.value)}
                      placeholder="Enter recipient email address (e.g., user@example.com)"
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
          </div>,
          document.body,
        )}
      </div>
    </AdminLayout>
  );
}
