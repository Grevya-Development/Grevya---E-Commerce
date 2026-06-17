import React, { useEffect, useState } from 'react';
import { Bell, Check, Info, Package, Circle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/context/AuthContext';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { motion, AnimatePresence } from 'framer-motion';

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

  const fetchNotifications = async () => {
    if (!user) {
      setNotifications([]);
      setUnreadCount(0);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(10);

      if (error && (error.message || '').includes('relation')) {
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
      setNotifications([]);
      setUnreadCount(0);
      setHasError(true);
    }
  };

  useEffect(() => {
    fetchNotifications();

    let channel: any = null;

    try {
      const channelName = user ? `notifications_changes_${user.id}` : 'notifications_changes_guest';
      channel = supabase
        .channel(channelName)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'notifications',
            filter: user ? `user_id=eq.${user.id}` : undefined,
          },
          (payload) => {
            fetchNotifications();
          }
        )
        .subscribe();
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
        .from('notifications')
        .update({ read: true, is_read: true })
        .eq('id', id)
        .eq('user_id', user?.id);
      if (error) throw error;
      
      setNotifications(notifications.map(n => n.id === id ? { ...n, read: true } : n));
      setUnreadCount((prev) => Math.max(0, prev - 1));
    } catch (err) {
      console.error("Failed to mark as read:", err);
    }
  };

  const toggleReadStatus = async (id: string, currentlyRead: boolean) => {
    try {
      const { error } = await supabase
        .from('notifications')
        .update({ read: !currentlyRead, is_read: !currentlyRead })
        .eq('id', id)
        .eq('user_id', user?.id);
      if (error) throw error;
      
      setNotifications(notifications.map(n => n.id === id ? { ...n, read: !currentlyRead } : n));
      setUnreadCount((prev) => currentlyRead ? prev + 1 : Math.max(0, prev - 1));
    } catch (err) {
      console.error("Failed to toggle notification status:", err);
    }
  };

  const markAllAsRead = async () => {
    try {
      const { error } = await supabase
        .from('notifications')
        .update({ read: true, is_read: true })
        .eq('user_id', user?.id)
        .or('read.eq.false,is_read.eq.false');
      if (error) throw error;
      
      setNotifications(notifications.map(n => ({ ...n, read: true })));
      setUnreadCount(0);
    } catch (err) {
      console.error("Failed to mark all as read:", err);
    }
  };

  // Group notifications helper
  const groupNotifications = (items: Notification[]) => {
    const today: Notification[] = [];
    const yesterday: Notification[] = [];
    const earlier: Notification[] = [];
    
    const now = new Date();
    const todayStr = now.toDateString();
    
    const yest = new Date();
    yest.setDate(yest.getDate() - 1);
    const yestStr = yest.toDateString();

    items.forEach(item => {
      const itemDate = new Date(item.created_at).toDateString();
      if (itemDate === todayStr) {
        today.push(item);
      } else if (itemDate === yestStr) {
        yesterday.push(item);
      } else {
        earlier.push(item);
      }
    });

    return { today, yesterday, earlier };
  };

  if (!user) {
    return (
      <Button variant="ghost" size="icon" className="relative cursor-not-allowed opacity-50" title="Login to view notifications">
        <Bell className="h-5 w-5 text-gray-500" />
      </Button>
    );
  }

  if (hasError) {
    return (
      <Button variant="ghost" size="icon" className="relative cursor-not-allowed opacity-50" title="Notifications unavailable">
        <Bell className="h-5 w-5 text-gray-500" />
      </Button>
    );
  }

  const { today, yesterday, earlier } = groupNotifications(notifications);

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: { staggerChildren: 0.04 }
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 8 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.4, ease: [0.16, 1, 0.3, 1] as [number, number, number, number] }
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="relative hover:bg-[#A68D65]/10 text-gray-750">
          <Bell className="h-5 w-5 text-gray-700" />
          <AnimatePresence>
            {unreadCount > 0 && (
              <motion.span
                initial={{ opacity: 0, scale: 0.4 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.4 }}
                className="absolute -top-1 -right-1 bg-red-650 text-white text-[9px] rounded-full w-4.5 h-4.5 flex items-center justify-center font-bold"
              >
                {unreadCount}
              </motion.span>
            )}
          </AnimatePresence>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80 p-0 border border-[#A68D65]/25 bg-white rounded-2xl overflow-hidden shadow-xl">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: -4 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] as [number, number, number, number] }}
        >
          <div className="flex items-center justify-between px-4 py-3 border-b border-[#A68D65]/10 bg-[#F7EEE4]/30 select-none">
            <h3 className="font-serif text-sm font-bold text-[#33381C]">Notifications</h3>
            {unreadCount > 0 && (
              <button 
                className="text-[10px] text-[#A68D65] hover:text-[#33381C] font-extrabold uppercase flex items-center cursor-pointer"
                onClick={markAllAsRead}
              >
                <Check className="h-3.5 w-3.5 mr-1" />
                Mark all read
              </button>
            )}
          </div>
          
          <div className="max-h-80 overflow-y-auto no-scrollbar">
            {notifications.length === 0 ? (
              <div className="py-10 px-4 text-center space-y-3">
                <div className="mx-auto w-12 h-12 rounded-full bg-[#F7EEE4] border border-[#A68D65]/20 flex items-center justify-center text-[#A68D65]">
                  <Bell className="w-5 h-5 opacity-70" />
                </div>
                <div>
                  <p className="text-xs font-bold text-[#33381C] uppercase tracking-wider">All caught up</p>
                  <p className="text-[10px] text-neutral-400 font-semibold mt-0.5">We'll alert you when orders ship or stock arrives.</p>
                </div>
              </div>
            ) : (
              <motion.div
                variants={containerVariants}
                initial="hidden"
                animate="visible"
                className="divide-y divide-gray-50"
              >
                {/* Render today's notifications */}
                {today.length > 0 && (
                  <div>
                    <div className="bg-[#FBF9F6] px-4 py-1 text-[9px] font-bold text-neutral-400 uppercase tracking-widest border-y border-gray-100/50">Today</div>
                    {today.map((notification) => (
                      <motion.div variants={itemVariants} key={notification.id}>
                        <NotificationItem
                          notification={notification}
                          markAsRead={markAsRead}
                          toggleReadStatus={toggleReadStatus}
                        />
                      </motion.div>
                    ))}
                  </div>
                )}

                {/* Render yesterday's notifications */}
                {yesterday.length > 0 && (
                  <div>
                    <div className="bg-[#FBF9F6] px-4 py-1 text-[9px] font-bold text-neutral-400 uppercase tracking-widest border-y border-gray-100/50">Yesterday</div>
                    {yesterday.map((notification) => (
                      <motion.div variants={itemVariants} key={notification.id}>
                        <NotificationItem
                          notification={notification}
                          markAsRead={markAsRead}
                          toggleReadStatus={toggleReadStatus}
                        />
                      </motion.div>
                    ))}
                  </div>
                )}

                {/* Render earlier notifications */}
                {earlier.length > 0 && (
                  <div>
                    <div className="bg-[#FBF9F6] px-4 py-1 text-[9px] font-bold text-neutral-400 uppercase tracking-widest border-y border-gray-100/50">Earlier</div>
                    {earlier.map((notification) => (
                      <motion.div variants={itemVariants} key={notification.id}>
                        <NotificationItem
                          notification={notification}
                          markAsRead={markAsRead}
                          toggleReadStatus={toggleReadStatus}
                        />
                      </motion.div>
                    ))}
                  </div>
                )}
              </motion.div>
            )}
          </div>
        </motion.div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

interface NotificationItemProps {
  notification: Notification;
  markAsRead: (id: string, read: boolean) => void;
  toggleReadStatus: (id: string, read: boolean) => void;
}

const NotificationItem = ({ notification, markAsRead, toggleReadStatus }: NotificationItemProps) => {
  return (
    <DropdownMenuItem 
      className={`p-4 cursor-pointer flex items-start space-x-3 transition-colors ${!notification.read ? 'bg-emerald-50/25' : 'bg-transparent'}`}
      onClick={(e) => {
        e.preventDefault();
        markAsRead(notification.id, notification.read);
      }}
    >
      <div className={`mt-0.5 p-1.5 rounded-xl ${notification.type === 'order' ? 'bg-emerald-100 text-[#33381C]' : 'bg-[#F7EEE4] text-[#A68D65]'}`}>
        {notification.type === 'order' ? <Package className="h-4 w-4" /> : <Info className="h-4 w-4" />}
      </div>
      <div className="flex-1 space-y-0.5">
        <p className={`text-xs ${!notification.read ? 'font-bold text-[#33381C]' : 'text-neutral-600 font-medium'}`}>
          {notification.message}
        </p>
        <p className="text-[9px] text-neutral-400 font-bold uppercase tracking-wider">
          {new Date(notification.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </p>
      </div>
      <button
        type="button"
        className="p-1 hover:bg-[#F7EEE4] rounded-full text-neutral-300 hover:text-[#33381C] transition-colors mt-0.5 cursor-pointer focus:outline-none"
        onClick={(e) => {
          e.stopPropagation();
          e.preventDefault();
          toggleReadStatus(notification.id, notification.read);
        }}
        title={notification.read ? "Mark as unread" : "Mark as read"}
      >
        {notification.read ? (
          <Circle className="w-3.5 h-3.5 text-neutral-200" />
        ) : (
          <Check className="w-3.5 h-3.5 text-emerald-600 font-bold" />
        )}
      </button>
    </DropdownMenuItem>
  );
};

export default NotificationBell;
