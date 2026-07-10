import { supabase } from "@/lib/supabaseClient";
import { authDebug } from "@/lib/authDiagnostics";
import {
  normalizeEmail,
  normalizePhone,
} from "@/lib/authValidation";
import { ensureUserProfile, rememberPendingProfile } from "@/lib/profileSync";

declare global {
  interface Window {
    Clerk?: any;
  }
}

const locks = new Map<string, Promise<any>>();

const withLock = async <T>(key: string, action: () => Promise<T>) => {
  const existing = locks.get(key);
  if (existing) return existing as Promise<T>;

  const run = action().finally(() => locks.delete(key));
  locks.set(key, run);
  return run;
};

/**
 * Standard Sign In using Clerk JS SDK window interface
 */
export const signInWithEmail = (email: string, password: string) => {
  const normalizedEmail = normalizeEmail(email);
  return withLock(`login:${normalizedEmail}`, async () => {
    authDebug("login.start");
    if (!window.Clerk) {
      throw new Error("Authentication provider is still loading. Please try again.");
    }

    const signInAttempt = await window.Clerk.client.signIn.create({
      identifier: normalizedEmail,
      password,
    });

    if (signInAttempt.status === "complete") {
      await window.Clerk.setActive({ session: signInAttempt.createdSessionId });
      authDebug("login.success");
      return signInAttempt;
    }

    throw new Error(`Authentication status: ${signInAttempt.status}. Please check details.`);
  });
};

/**
 * Standard Sign Up using Clerk JS SDK window interface
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
    if (!window.Clerk) {
      throw new Error("Authentication provider is still loading. Please try again.");
    }

    const signUpAttempt = await window.Clerk.client.signUp.create({
      emailAddress: normalizedEmail,
      password: input.password,
      firstName: input.fullName.split(" ")[0] || "",
      lastName: input.fullName.split(" ").slice(1).join(" ") || "",
    });

    // Store pending metadata (role, phone) locally to sync once the email is verified
    rememberPendingProfile(signUpAttempt.id, {
      full_name: input.fullName.trim(),
      phone: normalizedPhone || null,
      role: input.role || "customer",
    });

    // Send verification email code
    await signUpAttempt.prepareEmailAddressVerification({
      strategy: "email_code",
    });

    authDebug("signup.prepared_verification");
    return signUpAttempt;
  });
};

/**
 * Verifies email verification code during Clerk signup
 */
export const verifyEmailVerificationCode = async (clerkUserId: string, code: string) => {
  if (!window.Clerk) {
    throw new Error("Authentication provider is still loading. Please try again.");
  }

  const signUpAttempt = window.Clerk.client.signUp;
  const verification = await signUpAttempt.attemptEmailAddressVerification({
    code,
  });

  if (verification.status === "complete") {
    await window.Clerk.setActive({ session: verification.createdSessionId });
    
    // Sync profile to database immediately
    if (window.Clerk.user) {
      try {
        await ensureUserProfile(window.Clerk.user);
      } catch (err) {
        console.warn("Failed to ensure user profile during signup verification:", err);
      }
    }
    return verification;
  }

  throw new Error(`Verification status: ${verification.status}`);
};

/**
 * Start OAuth flow using Clerk SDK redirect strategy
 */
export const startOAuthSignIn = (provider: "google" | "apple") => {
  return withLock(`oauth:${provider}`, async () => {
    authDebug("oauth.start", { provider });
    if (!window.Clerk) {
      throw new Error("Authentication provider is still loading.");
    }

    return window.Clerk.client.signIn.authenticateWithRedirect({
      strategy: `oauth_${provider}`,
      redirectUrl: "/sso-callback",
      redirectUrlComplete: "/account",
    });
  });
};

/**
 * Request Clerk password reset
 */
export const requestPasswordReset = (email: string) => {
  const normalizedEmail = normalizeEmail(email);
  return withLock(`forgot:${normalizedEmail}`, async () => {
    if (!window.Clerk) {
      throw new Error("Authentication provider is still loading.");
    }

    const signInAttempt = await window.Clerk.client.signIn.create({
      strategy: "reset_password_email_code",
      identifier: normalizedEmail,
    });
    
    return signInAttempt;
  });
};

/**
 * Update active Clerk password
 */
export const updateAuthPassword = (password: string) => {
  return withLock("reset-password", async () => {
    if (!window.Clerk || !window.Clerk.user) {
      throw new Error("No active session found.");
    }

    const updatedUser = await window.Clerk.user.update({ password });
    
    // Send a security notification via Supabase
    try {
      const activeProfile = await supabase
        .from("profiles")
        .select("id")
        .eq("clerk_user_id", window.Clerk.user.id)
        .maybeSingle();

      if (activeProfile?.data?.id) {
        await supabase.from("notifications").insert({
          user_id: activeProfile.data.id,
          message: "Your account password has been updated successfully.",
          type: "security",
        });
      }
    } catch (err) {
      console.warn("Security notification insertion failed:", err);
    }

    return updatedUser;
  });
};

/**
 * Sign out helper linking to Clerk
 */
export const signOutUser = async () => {
  if (window.Clerk) {
    await window.Clerk.signOut();
  }
};
