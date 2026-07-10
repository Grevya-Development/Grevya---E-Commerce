import React, { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/lib/supabaseClient";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Bell, BellOff, Loader2, Trash2, CheckCircle2, AlertCircle, Shield } from "lucide-react";
import { toast } from "@/components/ui/use-toast";
import { motion, AnimatePresence } from "framer-motion";

interface Notification {
  id: string;
  message: string;
  type: string;
  read: boolean;
  created_at: string;
}

export default function Notifications() {
  const { user, profile, loading: authLoading } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [clearing, setClearing] = useState(false);

  const fetchNotifications = async () => {
    if (!profile?.id) return;
    try {
      const { data, error } = await supabase
        .from("notifications")
        .select("*")
        .eq("user_id", profile.id)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setNotifications(data || []);
    } catch (err: any) {
      console.error("Failed to load notifications:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!authLoading && profile?.id) {
      fetchNotifications();
    }
  }, [authLoading, profile]);

  const handleMarkAsRead = async (id: string) => {
    try {
      const { error } = await supabase
        .from("notifications")
        .update({ read: true })
        .eq("id", id);

      if (error) throw error;
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, read: true } : n))
      );
      toast({
        title: "Notification read",
        description: "Marked as read successfully.",
      });
    } catch (err: any) {
      toast({
        title: "Action failed",
        description: err.message,
        variant: "destructive",
      });
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const { error } = await supabase
        .from("notifications")
        .delete()
        .eq("id", id);

      if (error) throw error;
      setNotifications((prev) => prev.filter((n) => n.id !== id));
      toast({
        title: "Notification deleted",
      });
    } catch (err: any) {
      toast({
        title: "Delete failed",
        description: err.message,
        variant: "destructive",
      });
    }
  };

  const handleClearAll = async () => {
    if (notifications.length === 0 || !profile?.id) return;
    setClearing(true);
    try {
      const { error } = await supabase
        .from("notifications")
        .delete()
        .eq("user_id", profile.id);

      if (error) throw error;
      setNotifications([]);
      toast({
        title: "Inbox Cleared",
        description: "All notifications have been removed.",
      });
    } catch (err: any) {
      toast({
        title: "Clear failed",
        description: err.message,
        variant: "destructive",
      });
    } finally {
      setClearing(false);
    }
  };

  const getIcon = (type: string) => {
    switch (type) {
      case "security":
        return <Shield className="w-5 h-5 text-red-600 shrink-0" />;
      case "success":
        return <CheckCircle2 className="w-5 h-5 text-green-700 shrink-0" />;
      default:
        return <Bell className="w-5 h-5 text-[#A68D65] shrink-0" />;
    }
  };

  return (
    <div className="flex min-h-screen flex-col bg-[#F7EEE4]/20">
      <Navbar />

      <main className="flex-grow max-w-4xl w-full mx-auto px-4 py-10 md:py-16">
        <div className="bg-white rounded-[2rem] border border-[#A68D65]/20 shadow-2xl p-6 sm:p-10 relative overflow-hidden">
          
          <div className="absolute top-0 right-0 w-64 h-64 bg-[#33381C]/5 rounded-full blur-3xl -z-10 pointer-events-none" />

          {/* Header */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-[#A68D65]/10 pb-6 mb-8">
            <div>
              <h1 className="font-serif text-3xl font-bold text-[#1D1E19]">
                Notifications
              </h1>
              <p className="text-neutral-500 text-xs mt-1.5 font-medium">
                Manage alerts, security events, and platform updates.
              </p>
            </div>
            {notifications.length > 0 && (
              <Button
                onClick={handleClearAll}
                disabled={clearing}
                variant="outline"
                className="h-10 rounded-xl border-red-200 text-red-700 hover:bg-red-50 text-xs font-bold shrink-0 flex items-center gap-2 cursor-pointer"
              >
                {clearing ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Trash2 className="w-4 h-4" />
                )}
                Clear Inbox
              </Button>
            )}
          </div>

          {/* Loading */}
          {loading ? (
            <div className="py-16 flex flex-col items-center justify-center text-neutral-500 text-xs font-medium">
              <Loader2 className="w-8 h-8 animate-spin text-[#33381C] mb-3" />
              Loading notifications...
            </div>
          ) : (
            <div className="space-y-4">
              <AnimatePresence mode="popLayout">
                {notifications.length === 0 ? (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.96 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.96 }}
                    className="py-16 text-center space-y-4 max-w-sm mx-auto"
                  >
                    <div className="mx-auto w-16 h-16 bg-[#33381C]/5 rounded-full flex items-center justify-center text-neutral-400">
                      <BellOff className="w-8 h-8" />
                    </div>
                    <div className="space-y-1">
                      <h3 className="font-serif font-bold text-base text-[#1D1E19]">
                        All Clear!
                      </h3>
                      <p className="text-neutral-500 text-[11px] leading-normal font-medium">
                        You do not have any new notifications in your inbox right now.
                      </p>
                    </div>
                  </motion.div>
                ) : (
                  notifications.map((notif) => (
                    <motion.div
                      layout
                      key={notif.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      className={`flex gap-4 p-4.5 rounded-2xl border transition-all duration-200 ${
                        notif.read
                          ? "border-[#A68D65]/10 bg-white"
                          : "border-[#33381C]/20 bg-[#F7EEE4]/20 shadow-xs"
                      }`}
                    >
                      {getIcon(notif.type)}

                      <div className="flex-grow space-y-1.5">
                        <p className={`text-xs text-neutral-850 leading-relaxed ${notif.read ? 'font-medium' : 'font-bold'}`}>
                          {notif.message}
                        </p>
                        <span className="block text-[9px] text-neutral-400 font-semibold uppercase tracking-wider">
                          {new Date(notif.created_at).toLocaleDateString(undefined, {
                            month: "short",
                            day: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </span>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        {!notif.read && (
                          <button
                            onClick={() => handleMarkAsRead(notif.id)}
                            className="text-[9px] font-bold text-[#33381C] hover:underline px-2.5 py-1 rounded bg-[#33381C]/5 hover:bg-[#33381C]/10 transition-colors"
                          >
                            Mark Read
                          </button>
                        )}
                        <button
                          onClick={() => handleDelete(notif.id)}
                          className="p-2 text-neutral-400 hover:text-red-600 rounded-xl hover:bg-neutral-50 transition-colors"
                          title="Delete Alert"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </motion.div>
                  ))
                )}
              </AnimatePresence>
            </div>
          )}

        </div>
      </main>

      <Footer />
    </div>
  );
}
