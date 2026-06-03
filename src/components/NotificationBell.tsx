import { useEffect, useState, useCallback, useRef } from 'react'
import { Bell, Check, Info, Package } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { supabase } from '@/lib/supabaseClient'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useAuthStore } from '@/store/authStore'

interface Notification {
  id: string
  user_id: string
  title: string
  message: string
  type: string
  is_read: boolean
  created_at: string
}

const NotificationBell = () => {
  const { user } = useAuthStore()
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [hasError, setHasError] = useState(false)
  const channelRef = useRef<any>(null)          // ← track channel to avoid duplicates

  const fetchNotifications = useCallback(async () => {
    if (!user?.id) return
    try {
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(20)
      if (error) { setHasError(true); return }
      const notifs = (data as Notification[]) ?? []
      setNotifications(notifs)
      setUnreadCount(notifs.filter((n) => !n.is_read).length)
      setHasError(false)
    } catch { setHasError(true) }
  }, [user?.id])

  // Initial fetch
  useEffect(() => {
    if (!user?.id) {
      setNotifications([])
      setUnreadCount(0)
      return
    }
    fetchNotifications()
  }, [user?.id, fetchNotifications])

  // Realtime — uses ref to prevent StrictMode double-mount duplicate channel crash
  useEffect(() => {
    if (!user?.id) return

    // If a channel already exists for this user, remove it first
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current)
      channelRef.current = null
    }

    // Small delay lets WebSocket connect before subscribing
    const timer = setTimeout(() => {
      try {
        const channel = supabase
          .channel(`notif-${user.id}-${Date.now()}`)  // truly unique name
          .on(
            'postgres_changes',
            {
              event: '*',
              schema: 'public',
              table: 'notifications',
              filter: `user_id=eq.${user.id}`,
            },
            () => fetchNotifications()
          )
          .subscribe()

        channelRef.current = channel
      } catch (e) {
        console.warn('Realtime subscription failed:', e)
      }
    }, 500)   // 500ms delay — lets WebSocket establish first

    return () => {
      clearTimeout(timer)
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current)
        channelRef.current = null
      }
    }
  }, [user?.id, fetchNotifications])

  const markAsRead = async (id: string, isRead: boolean) => {
    if (isRead) return
    const { error } = await supabase
      .from('notifications').update({ is_read: true }).eq('id', id)
    if (error) return
    setNotifications((prev) =>
      prev.map((n) => n.id === id ? { ...n, is_read: true } : n))
    setUnreadCount((prev) => Math.max(0, prev - 1))
  }

  const markAllAsRead = async () => {
    if (!user?.id) return
    const { error } = await supabase
      .from('notifications').update({ is_read: true })
      .eq('user_id', user.id).eq('is_read', false)
    if (error) return
    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })))
    setUnreadCount(0)
  }

  if (!user) return null

  if (hasError) return (
    <Button variant="ghost" size="icon" className="opacity-50 cursor-not-allowed" disabled>
      <Bell className="h-5 w-5 text-slate-500" />
    </Button>
  )

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className="relative p-2 rounded-lg text-slate-500 hover:text-emerald-700 hover:bg-slate-50 transition-all">
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 bg-red-500 text-white text-[10px] font-bold rounded-full min-w-[18px] min-h-[18px] flex items-center justify-center shadow-sm">
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          )}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80 rounded-xl shadow-lg border border-slate-100 p-0 overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 bg-slate-50">
          <div className="flex items-center gap-2">
            <Bell className="h-4 w-4 text-emerald-600" />
            <h3 className="font-semibold text-sm text-slate-700">Notifications</h3>
            {unreadCount > 0 && (
              <span className="text-[10px] font-bold bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded-full">
                {unreadCount} new
              </span>
            )}
          </div>
          {unreadCount > 0 && (
            <button onClick={markAllAsRead}
              className="text-xs text-emerald-600 hover:text-emerald-800 font-medium flex items-center gap-1">
              <Check className="h-3 w-3" /> Mark all read
            </button>
          )}
        </div>
        <div className="max-h-80 overflow-y-auto">
          {notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 px-4 text-center">
              <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center mb-3">
                <Bell className="h-5 w-5 text-slate-400" />
              </div>
              <p className="text-sm font-medium text-slate-500">You're all caught up!</p>
              <p className="text-xs text-slate-400 mt-1">No notifications yet</p>
            </div>
          ) : (
            notifications.map((notif) => (
              <DropdownMenuItem key={notif.id}
                className={`p-0 cursor-pointer border-b border-slate-50 last:border-0 focus:bg-transparent ${!notif.is_read ? 'bg-emerald-50/40' : 'bg-white'}`}
                onClick={(e) => { e.preventDefault(); markAsRead(notif.id, notif.is_read) }}>
                <div className="flex items-start gap-3 px-4 py-3 w-full hover:bg-slate-50 transition-colors">
                  <div className={`mt-0.5 p-1.5 rounded-full flex-shrink-0 ${notif.type === 'order' ? 'bg-amber-100 text-amber-600' : 'bg-blue-100 text-blue-600'}`}>
                    {notif.type === 'order' ? <Package className="h-3.5 w-3.5" /> : <Info className="h-3.5 w-3.5" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    {notif.title && (
                      <p className={`text-xs font-semibold mb-0.5 ${!notif.is_read ? 'text-emerald-700' : 'text-slate-400'}`}>
                        {notif.title}
                      </p>
                    )}
                    <p className={`text-sm leading-snug ${!notif.is_read ? 'font-medium text-slate-800' : 'text-slate-500'}`}>
                      {notif.message}
                    </p>
                    <p className="text-[11px] text-slate-400 mt-1">
                      {new Date(notif.created_at).toLocaleDateString()} at{' '}
                      {new Date(notif.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                  {!notif.is_read && <div className="w-2 h-2 rounded-full bg-emerald-500 mt-1.5 flex-shrink-0" />}
                </div>
              </DropdownMenuItem>
            ))
          )}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

export default NotificationBell
