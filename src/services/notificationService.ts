import { supabase } from '../lib/supabaseClient';

export interface Notification {
  id: string;
  user_id: string;
  title: string;
  message: string;
  type: string;
  is_read: boolean;
  created_at: string;
}

// GET USER NOTIFICATIONS
export const getNotifications = async () => {
  const { data, error } = await supabase
    .from('notifications')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) throw error;

  return data;
};

// CREATE NOTIFICATION
export const createNotification = async (
  userId: string,
  title: string,
  message: string,
  type = 'general'
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

  return data;
};

// MARK AS READ
export const markNotificationAsRead = async (
  notificationId: string
) => {
  const { error } = await supabase
    .from('notifications')
    .update({ is_read: true })
    .eq('id', notificationId);

  if (error) throw error;
};