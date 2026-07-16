import { supabase } from "@/lib/supabaseClient";
import { authDebug } from "@/lib/authDiagnostics";

export interface ProfileSeed {
  full_name?: string | null;
  phone?: string | null;
  role?: string | null;
}

const pendingProfileKey = (userId: string) =>
  `grevya-pending-profile:${userId}`;

export const rememberPendingProfile = (userId: string, seed: ProfileSeed) => {
  localStorage.setItem(pendingProfileKey(userId), JSON.stringify(seed));
};

export const readPendingProfile = (userId: string): ProfileSeed => {
  try {
    return JSON.parse(localStorage.getItem(pendingProfileKey(userId)) || "{}");
  } catch {
    return {};
  }
};

export const clearPendingProfile = (userId: string) => {
  localStorage.removeItem(pendingProfileKey(userId));
};

/**
 * Ensures a user profile exists in the public.profiles database.
 * Matches the Clerk user ID (clerk_user_id) to retrieve or create the profile.
 */
export const ensureUserProfile = async (clerkUser: any, seed: ProfileSeed = {}) => {
  const pending = readPendingProfile(clerkUser.id);

  // 1. Fetch user profile by clerk_user_id
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("clerk_user_id", clerkUser.id)
    .maybeSingle();

  if (error && !(error.message || "").includes("relation")) {
    authDebug("profile.read_failed", {
      code: error.code,
      message: error.message,
    });
    throw error;
  }

  const mergedSeed = {
    full_name:
      seed.full_name ||
      pending.full_name ||
      data?.full_name ||
      clerkUser.fullName ||
      null,
    phone:
      seed.phone ||
      pending.phone ||
      data?.phone ||
      clerkUser.primaryPhoneNumber?.phoneNumber ||
      null,
    role: seed.role || (pending as any).role || data?.role || "customer",
    avatar_url: data?.avatar_url || clerkUser.imageUrl || null,
  };

  let finalProfile = data;

  if (data) {
    // Check if we need to sync missing or updated fields
    const needsUpdate =
      (mergedSeed.full_name && data.full_name !== mergedSeed.full_name) ||
      (mergedSeed.phone && data.phone !== mergedSeed.phone) ||
      (mergedSeed.role && data.role !== mergedSeed.role) ||
      (clerkUser.primaryEmailAddress?.emailAddress && data.email !== clerkUser.primaryEmailAddress.emailAddress) ||
      (mergedSeed.avatar_url && data.avatar_url !== mergedSeed.avatar_url);

    if (needsUpdate) {
      const { data: updated, error: updateError } = await supabase
        .from("profiles")
        .update({
          full_name: mergedSeed.full_name || data.full_name,
          phone: mergedSeed.phone || data.phone,
          role: mergedSeed.role || data.role,
          email: clerkUser.primaryEmailAddress?.emailAddress || data.email,
          avatar_url: mergedSeed.avatar_url || data.avatar_url,
          last_login_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("clerk_user_id", clerkUser.id)
        .select()
        .single();

      if (!updateError && updated) {
        finalProfile = updated;
        authDebug("profile.updated", { userId: clerkUser.id });
      }
    }
  } else {
    // Create new profile (letting Database generate UUID id automatically)
    const { data: created, error: upsertError } = await supabase
      .from("profiles")
      .upsert(
        {
          clerk_user_id: clerkUser.id,
          email: clerkUser.primaryEmailAddress?.emailAddress || null,
          full_name: mergedSeed.full_name,
          phone: mergedSeed.phone,
          role: mergedSeed.role || "customer",
          avatar_url: mergedSeed.avatar_url,
          status: "active",
          last_login_at: new Date().toISOString(),
        },
        { onConflict: "clerk_user_id" },
      )
      .select()
      .single();

    if (upsertError) {
      authDebug("profile.upsert_failed", {
        code: upsertError.code,
        message: upsertError.message,
      });
      throw upsertError;
    }
    finalProfile = created;
    authDebug("profile.created", { userId: clerkUser.id });
  }

  // Welcome notification check for registered (non-guest) users
  if (finalProfile && !clerkUser.isAnonymous) {
    try {
      const { data: existingNotifs } = await supabase
        .from("notifications")
        .select("id")
        .eq("user_id", finalProfile.id)
        .eq(
          "message",
          "Welcome to Grevya! Start your sustainable shopping journey.",
        )
        .limit(1);

      if (!existingNotifs || existingNotifs.length === 0) {
        await supabase.from("notifications").insert({
          user_id: finalProfile.id,
          message:
            "Welcome to Grevya! Start your sustainable shopping journey.",
          type: "info",
        });
      }
    } catch (notifErr) {
      console.warn("Welcome notification check failed:", notifErr);
    }
  }

  clearPendingProfile(clerkUser.id);
  return finalProfile;
};
