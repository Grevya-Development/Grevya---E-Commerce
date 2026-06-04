import { supabase } from "../lib/supabaseClient";

export const getAllUsers = async () => {
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .order("created_at", {
      ascending: false,
    });

  if (error) {
    throw error;
  }

  return data;
};

export const updateUserRole = async (userId: string, role: string) => {
  const { error } = await supabase
    .from("profiles")
    .update({
      role,
    })
    .eq("id", userId);

  if (error) {
    throw error;
  }
};

export const toggleUserStatus = async (userId: string, isActive: boolean) => {
  const { error } = await supabase
    .from("profiles")
    .update({
      is_active: isActive,
    })
    .eq("id", userId);

  if (error) {
    throw error;
  }
};
