import { supabase } from "../lib/supabaseClient";
import { User } from "@supabase/supabase-js";

export type UserRole = "buyer" | "seller" | "admin";

export interface RegisterData {
  username: string;
  email: string;
  password: string;
  confirm_password: string;
  role?: UserRole;
}

export interface Profile {
  id: string;
  username: string;
  email?: string;
  phone: string | null;
  avatar_url: string | null;
  role: UserRole;
  is_active: boolean;
  created_at: string;
}

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&]).{8,}$/;

// REGISTER USER
export const registerUser = async (formData: RegisterData) => {
  const {
    username,
    email,
    password,
    confirm_password,
    role = "buyer",
  } = formData;

  if (!username || !email || !password || !confirm_password) {
    throw new Error("Please fill all fields");
  }

  if (!emailRegex.test(email)) {
    throw new Error("Invalid email format");
  }

  if (password !== confirm_password) {
    throw new Error("Passwords do not match");
  }

  if (!passwordRegex.test(password)) {
    throw new Error(
      "Password must contain minimum 8 characters, uppercase, lowercase, number and special character",
    );
  }

  // SECURITY
  const safeRole: UserRole = role === "seller" ? "seller" : "buyer";

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        username,
        role: safeRole,
      },
    },
  });

  if (error) {
    throw error;
  }

  return data;
};

// LOGIN USER
export const loginUser = async (email: string, password: string) => {
  if (!email || !password) {
    throw new Error("Email and password are required");
  }

  if (!emailRegex.test(email)) {
    throw new Error("Invalid email format");
  }

  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    throw error;
  }

  const profile = await getUserProfile(data.user.id);

  return {
    session: data.session,
    user: data.user,
    profile,
  };
};

// LOGOUT USER
export const logoutUser = async () => {
  const { error } = await supabase.auth.signOut();

  if (error) {
    throw error;
  }
};

// GET USER PROFILE
export const getUserProfile = async (userId: string): Promise<Profile> => {
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .single();

  if (error) {
    throw error;
  }

  return data as Profile;
};

// GET CURRENT SESSION
export const getSession = async () => {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  return session;
};

// GET CURRENT USER
export const getCurrentUser = async () => {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return user;
};

// AUTH STATE LISTENER
export const onAuthStateChange = (callback: (user: User | null) => void) => {
  return supabase.auth.onAuthStateChange((_event, session) => {
    callback(session?.user ?? null);
  });
};
