import { supabase } from "@/lib/supabaseClient";
import { authDebug } from "@/lib/authDiagnostics";
import {
  normalizeEmail,
  normalizePhone,
} from "@/lib/authValidation";
import { rememberPendingProfile } from "@/lib/profileSync";

const locks = new Map<string, Promise<any>>();

const withLock = async <T>(key: string, action: () => Promise<T>) => {
  const existing = locks.get(key);
  if (existing) return existing as Promise<T>;

  const run = action().finally(() => locks.delete(key));
  locks.set(key, run);
  return run;
};

/**
 * Standard Sign In using Supabase Auth
 */
export const signInWithEmail = (email: string, password: string) => {
  const normalizedEmail = normalizeEmail(email);
  return withLock(`login:${normalizedEmail}`, async () => {
    authDebug("login.start");

    const { data, error } = await supabase.auth.signInWithPassword({
      email: normalizedEmail,
      password,
    });

    if (error) {
      throw error;
    }

    authDebug("login.success");
    return data;
  });
};

/**
 * Standard Sign Up using Supabase Auth and role metadata
 */
export const signUpWithEmail = (input: {
  email: string;
  password: string;
  fullName: string;
  phone?: string;
  role?: string;
}) => {
  const normalizedEmail = normalizeEmail(input.email);
  const normalizedPhone = normalizePhone(input.phone || "");

  return withLock(`signup:${normalizedEmail}`, async () => {
    authDebug("signup.start");

    rememberPendingProfile(normalizedEmail, {
      full_name: input.fullName.trim(),
      phone: normalizedPhone || null,
      role: input.role || "customer",
    });

    // const { data, error } = await supabase.auth.signUp({
    //   email: normalizedEmail,
    //   password: input.password,
    //   options: {
    //     data: {
    //       full_name: input.fullName.trim(),
    //       phone: normalizedPhone || null,
    //       role: input.role || "customer",
    //     },
    //   },
    // });

    // if (error) {
    //   throw error;
    // }

    // authDebug("signup.complete", {
    //   hasSession: Boolean(data.session),
    //   hasUser: Boolean(data.user),
    // });
    const { data, error } = await supabase.auth.signUp({
  email: normalizedEmail,
  password: input.password,
  options: {
    data: {
      full_name: input.fullName.trim(),
      phone: normalizedPhone || null,
      role: input.role || "customer",
    },
  },
});

if (error) throw error;

if (data.user) {
  rememberPendingProfile(data.user.id, {
    full_name: input.fullName.trim(),
    phone: normalizedPhone || null,
    role: input.role || "customer",
  });
}

    return data;
  });
};

/**
 * Verify an email confirmation code through Supabase Auth OTP flow.
 */
export const verifyEmailVerificationCode = async (email: string, code: string) => {
  const normalizedEmail = normalizeEmail(email);
  const { data, error } = await supabase.auth.verifyOtp({
    email: normalizedEmail,
    token: code,
    type: "email",
  });

  if (error) {
    throw error;
  }

  return data;
};

/**
 * Start OAuth flow by redirecting to an external provider.
 * This project currently uses email/password auth; OAuth is not enabled in the Supabase client.
 */
export const startOAuthSignIn = async (_provider: "google" | "apple") => {
  throw new Error("OAuth sign-in is not enabled for the Supabase auth setup.");
};

/**
 * Request password reset using Supabase Auth
 */
export const requestPasswordReset = (email: string) => {
  const normalizedEmail = normalizeEmail(email);
  return withLock(`forgot:${normalizedEmail}`, async () => {
    const { data, error } = await supabase.auth.resetPasswordForEmail(normalizedEmail);

    if (error) {
      throw error;
    }

    return data;
  });
};

/**
 * Update active Supabase password
 */
export const updateAuthPassword = async (password: string) => {
  const { data, error } = await supabase.auth.updateUser({ password });

  if (error) {
    throw error;
  }

  const activeProfile = await supabase
    .from("profiles")
    .select("id")
    .eq("id", data.user?.id || "")
    .maybeSingle();

  if (activeProfile?.data?.id) {
    await supabase.from("notifications").insert({
      user_id: activeProfile.data.id,
      message: "Your account password has been updated successfully.",
      type: "security",
    });
  }

  return data;
};

/**
 * Sign out helper linked to Supabase Auth
 */
export const signOutUser = async () => {
  await supabase.auth.signOut();
};
