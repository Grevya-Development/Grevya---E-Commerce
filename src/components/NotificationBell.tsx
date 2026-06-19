import React, { useEffect, useState } from "react";
import { Bell, Check, Info, Package, Circle } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { supabase } from "@/lib/supabaseClient";
import { useAuth } from "@/context/AuthContext";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface Notification {
  id: string;
  message: string;
  type: string;
  created_at: string;
  read: boolean;
}

const NotificationBell = () => {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [hasError, setHasError] = useState(false);
  const [selectedNotification, setSelectedNotification] =
    useState<Notification | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  const fetchNotifications = async () => {
    if (!user) {
      setNotifications([]);
      setUnreadCount(0);
      return;
    }

    try {
      const { data, error } = await supabase
        .from("notifications")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(10);

      if (error && (error.message || "").includes("relation")) {
        setHasError(true);
        return;
      }
      if (error) {
        throw error;
      }

      const notifs = data ? (data as Notification[]) : [];
      setNotifications(notifs);
      setUnreadCount(notifs.filter((n) => !n.read).length);
    } catch (err) {
      console.error("Failed to load notifications:", err);
      // Failsafe: don't crash, just show empty list
      setNotifications([]);
      setUnreadCount(0);
      setHasError(true);
    }
  };

  useEffect(() => {
    fetchNotifications();

    let channel: any = null;

    try {
      const channelName = user
        ? `notifications_changes_${user.id}`
        : "notifications_changes_guest";
      channel = supabase
        .channel(channelName)
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "notifications",
            filter: user ? `user_id=eq.${user.id}` : undefined,
          },
          (payload) => {
            console.log("Change received!", payload);
            fetchNotifications();
          },
        )
        .subscribe((status) => {
          if (status === "SUBSCRIBED") {
            console.log("Realtime subscribed");
          }
        });
    } catch (e) {
      console.warn("Realtime disabled", e);
    }

    return () => {
      try {
        if (channel) {
          supabase.removeChannel(channel);
        }
      } catch (e) {
        console.error("Failed to remove channel:", e);
      }
    };
  }, [user]);

  const markAsRead = async (id: string, currentlyRead: boolean) => {
    if (currentlyRead) return;
    try {
      const { error } = await supabase
        .from("notifications")
        .update({ read: true })
        .eq("id", id)
        .eq("user_id", user?.id);
      if (error) throw error;

      setNotifications(
        notifications.map((n) => (n.id === id ? { ...n, read: true } : n)),
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));
    } catch (err) {
      console.error("Failed to mark as read:", err);
    }
  };

  const toggleReadStatus = async (id: string, currentlyRead: boolean) => {
    try {
      const { error } = await supabase
        .from("notifications")
        .update({ read: !currentlyRead })
        .eq("id", id)
        .eq("user_id", user?.id);
      if (error) throw error;

      setNotifications(
        notifications.map((n) =>
          n.id === id ? { ...n, read: !currentlyRead } : n,
        ),
      );
      setUnreadCount((prev) =>
        currentlyRead ? prev + 1 : Math.max(0, prev - 1),
      );
    } catch (err) {
      console.error("Failed to toggle notification status:", err);
    }
  };

  const markAllAsRead = async () => {
    try {
      const { error } = await supabase
        .from("notifications")
        .update({ read: true })
        .eq("read", false)
        .eq("user_id", user?.id);
      if (error) throw error;

      setNotifications(notifications.map((n) => ({ ...n, read: true })));
      setUnreadCount(0);
    } catch (err) {
      console.error("Failed to mark all as read:", err);
    }
  };

  if (!user) {
    return (
      <Button
        variant="ghost"
        size="icon"
        className="relative cursor-not-allowed opacity-50"
        title="Login to view notifications"
      >
        <Bell className="h-5 w-5 text-gray-500" />
      </Button>
    );
  }

  if (hasError) {
    return (
      <Button
        variant="ghost"
        size="icon"
        className="relative cursor-not-allowed opacity-50"
        title="Notifications unavailable"
      >
        <Bell className="h-5 w-5 text-gray-500" />
      </Button>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-5 w-5 text-gray-600" />
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 bg-red-600 text-white text-[10px] rounded-full w-5 h-5 flex items-center justify-center font-bold">
              {unreadCount}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80">
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
          <h3 className="font-semibold text-brown-800">Notifications</h3>
          {unreadCount > 0 && (
            <button
              className="text-xs text-green-700 hover:text-green-800 font-medium flex items-center"
              onClick={markAllAsRead}
            >
              <Check className="h-3 w-3 mr-1" />
              Mark all read
            </button>
          )}
        </div>
        <div className="max-h-80 overflow-y-auto">
          {notifications.length === 0 ? (
            <div className="p-4 text-center text-sm text-gray-500">
              No notifications yet
            </div>
          ) : (
            notifications.map((notification) => (
              <DropdownMenuItem
                key={notification.id}
                className={`p-4 cursor-pointer border-b border-gray-50 last:border-0 flex items-start space-x-3 ${!notification.read ? "bg-green-50/50" : "bg-transparent"}`}
                onClick={(e) => {
                  e.preventDefault();
                  // open detail view and mark as read
                  setSelectedNotification(notification);
                  setDetailOpen(true);
                  markAsRead(notification.id, notification.read);
                }}
              >
                <div
                  className={`mt-0.5 p-1.5 rounded-full ${notification.type === "order" ? "bg-green-100 text-olive" : "bg-blue-100 text-blue-700"}`}
                >
                  {notification.type === "order" ? (
                    <Package className="h-4 w-4" />
                  ) : (
                    <Info className="h-4 w-4" />
                  )}
                </div>
                <div className="flex-1 space-y-1">
                  <p
                    className={`text-sm ${!notification.read ? "font-medium text-brown-800" : "text-gray-600"}`}
                  >
                    {notification.message}
                  </p>
                  <p className="text-xs text-gray-400">
                    {new Date(notification.created_at).toLocaleDateString()} at{" "}
                    {new Date(notification.created_at).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </p>
                </div>
                <button
                  type="button"
                  className="p-1 hover:bg-neutral-100 rounded-full text-neutral-400 hover:text-green-700 transition-colors mt-2"
                  onClick={(e) => {
                    e.stopPropagation();
                    e.preventDefault();
                    toggleReadStatus(notification.id, notification.read);
                  }}
                  title={notification.read ? "Mark as unread" : "Mark as read"}
                >
                  {notification.read ? (
                    <Circle className="w-3.5 h-3.5 text-neutral-300" />
                  ) : (
                    <Check className="w-3.5 h-3.5 text-green-600 font-bold" />
                  )}
                </button>
              </DropdownMenuItem>
            ))
          )}
        </div>
      </DropdownMenuContent>
      {selectedNotification && (
        <Dialog
          open={detailOpen}
          onOpenChange={(open) => {
            setDetailOpen(open);
            if (!open) setSelectedNotification(null);
          }}
        >
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>
                {selectedNotification.type === "order"
                  ? "Order update"
                  : selectedNotification.type === "alert"
                    ? "Alert"
                    : selectedNotification.type === "system"
                      ? "System message"
                      : "Notification"}
              </DialogTitle>
              <DialogDescription>
                {new Date(selectedNotification.created_at).toLocaleString()}
              </DialogDescription>
            </DialogHeader>

            <div className="py-2">
              <p className="text-sm text-gray-600 mb-2">
                Type:{" "}
                <span className="font-medium">{selectedNotification.type}</span>
              </p>
              <p className="text-sm text-gray-800 whitespace-pre-wrap">
                {selectedNotification.message}
              </p>
            </div>

            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => {
                  setDetailOpen(false);
                  setSelectedNotification(null);
                }}
              >
                Close
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </DropdownMenu>
  );
};

export default NotificationBell;
