  import { supabase } from "@/lib/supabaseClient";
  import { authDebug } from "@/lib/authDiagnostics";
  import type { User } from "@supabase/supabase-js";

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
   * Uses the Supabase auth user id as the canonical profile key.
   */
  export const ensureUserProfile = async (authUser: User, seed: ProfileSeed = {}) => {
    const pending = readPendingProfile(authUser.id);

    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", authUser.id)
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
        authUser.user_metadata?.full_name ||
        null,
      phone:
        seed.phone ||
        pending.phone ||
        data?.phone ||
        authUser.user_metadata?.phone ||
        null,
role:
  seed.role ||
  authUser.user_metadata?.role ||
  (pending as any).role ||
  data?.role ||
  "customer",      avatar_url:
        data?.avatar_url ||
        authUser.user_metadata?.avatar_url ||
        authUser.user_metadata?.picture ||
        null,
    };

    let finalProfile = data;

    if (data) {
      const needsUpdate =
        (mergedSeed.full_name && data.full_name !== mergedSeed.full_name) ||
        (mergedSeed.phone && data.phone !== mergedSeed.phone) ||
        (mergedSeed.role && data.role !== mergedSeed.role) ||
        (authUser.email && data.email !== authUser.email) ||
        (mergedSeed.avatar_url && data.avatar_url !== mergedSeed.avatar_url);

      if (needsUpdate) {
        const { data: updated, error: updateError } = await supabase
          .from("profiles")
          .update({
            full_name: mergedSeed.full_name || data.full_name,
            phone: mergedSeed.phone || data.phone,
            role: mergedSeed.role || data.role,
            email: authUser.email || data.email,
            avatar_url: mergedSeed.avatar_url || data.avatar_url,
          })
          .eq("id", authUser.id)
          .select()
          .single();

        if (!updateError && updated) {
          finalProfile = updated;
          authDebug("profile.updated", { userId: authUser.id });
        }
      }
    } else {
      const { data: created, error: upsertError } = await supabase
        .from("profiles")
        .upsert(
          {
            id: authUser.id,
            email: authUser.email || null,
            full_name: mergedSeed.full_name,
            phone: mergedSeed.phone,
            role: mergedSeed.role || "customer",
            avatar_url: mergedSeed.avatar_url,
          },
          { onConflict: "id" },
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
      authDebug("profile.created", { userId: authUser.id });
    }

    if (finalProfile && !authUser.is_anonymous) {
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

    clearPendingProfile(authUser.id);
    return finalProfile;
  };
