import { supabase } from '../lib/supabaseClient';

export type NotificationType = 'general' | 'order' | 'system';

export interface Notification {
  id: string;
  user_id: string;
  title: string;
  message: string;
  type: NotificationType;
  is_read: boolean;
  created_at: string;
}

export interface NotificationInput {
  user_id: string;
  title: string;
  message: string;
  type: NotificationType;
  is_read?: boolean;
}

export const getNotifications = async () => {
  const { data, error } = await supabase
    .from('notifications')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) throw error;

  return data as Notification[];
};

export const getUserNotifications = async (userId: string) => {
  const { data, error } = await supabase
    .from('notifications')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (error) throw error;

  return data as Notification[];
};

export const createNotification = async (
  userId: string,
  title: string,
  message: string,
  type: NotificationType = 'general',
) => {
  const { data, error } = await supabase
    .from('notifications')
    .insert([
      {
        user_id: userId,
        title,
        message,
        type,
      },
    ])
    .select();

  if (error) throw error;

  return data as Notification[];
};

export const createNotifications = async (
  notifications: NotificationInput[],
) => {
  const { data, error } = await supabase
    .from('notifications')
    .insert(notifications)
    .select();

  if (error) throw error;

  return data as Notification[];
};

export const markNotificationAsRead = async (
  notificationId: string,
) => {
  const { error } = await supabase
    .from('notifications')
    .update({ is_read: true })
    .eq('id', notificationId);

  if (error) throw error;
};

export const markNotificationAsUnread = async (
  notificationId: string,
) => {
  const { error } = await supabase
    .from('notifications')
    .update({ is_read: false })
    .eq('id', notificationId);

  if (error) throw error;
};

export const deleteNotification = async (notificationId: string) => {
  const { error } = await supabase
    .from('notifications')
    .delete()
    .eq('id', notificationId);

  if (error) throw error;
};
