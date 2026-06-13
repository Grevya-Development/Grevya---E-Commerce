import type { User } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabaseClient';
import { authDebug } from '@/lib/authDiagnostics';

export interface ProfileSeed {
  full_name?: string | null;
  phone?: string | null;
}

const pendingProfileKey = (userId: string) => `grevya-pending-profile:${userId}`;

export const rememberPendingProfile = (userId: string, seed: ProfileSeed) => {
  localStorage.setItem(pendingProfileKey(userId), JSON.stringify(seed));
};

export const readPendingProfile = (userId: string): ProfileSeed => {
  try {
    return JSON.parse(localStorage.getItem(pendingProfileKey(userId)) || '{}');
  } catch {
    return {};
  }
};

export const clearPendingProfile = (userId: string) => {
  localStorage.removeItem(pendingProfileKey(userId));
};

export const ensureUserProfile = async (user: User, seed: ProfileSeed = {}) => {
  const pending = readPendingProfile(user.id);

  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .maybeSingle();

  if (error && !(error.message || '').includes('relation')) {
    authDebug('profile.read_failed', { code: error.code, message: error.message });
    throw error;
  }

  const mergedSeed = {
    full_name: seed.full_name || pending.full_name || data?.full_name || user.user_metadata?.full_name || null,
    phone: seed.phone || pending.phone || data?.phone || user.user_metadata?.phone || null,
    avatar_url: data?.avatar_url || user.user_metadata?.avatar_url || null,
  };

  let finalProfile = data;

  if (data) {
    // Check if we need to sync missing or updated fields
    const needsUpdate =
      (mergedSeed.full_name && data.full_name !== mergedSeed.full_name) ||
      (mergedSeed.phone && data.phone !== mergedSeed.phone) ||
      (user.email && data.email !== user.email) ||
      (mergedSeed.avatar_url && data.avatar_url !== mergedSeed.avatar_url);

    if (needsUpdate) {
      const { data: updated, error: updateError } = await supabase
        .from('profiles')
        .update({
          full_name: mergedSeed.full_name || data.full_name,
          phone: mergedSeed.phone || data.phone,
          email: user.email || data.email,
          avatar_url: mergedSeed.avatar_url || data.avatar_url,
          updated_at: new Date().toISOString(),
        })
        .eq('id', user.id)
        .select()
        .single();

      if (!updateError && updated) {
        finalProfile = updated;
        authDebug('profile.updated', { userId: user.id });
      }
    }
  } else {
    // Create new profile
    const { data: created, error: upsertError } = await supabase
      .from('profiles')
      .upsert({
        id: user.id,
        email: user.email || null,
        full_name: mergedSeed.full_name,
        phone: mergedSeed.phone,
        avatar_url: mergedSeed.avatar_url,
      }, { onConflict: 'id' })
      .select()
      .single();

    if (upsertError) {
      authDebug('profile.upsert_failed', { code: upsertError.code, message: upsertError.message });
      throw upsertError;
    }
    finalProfile = created;
    authDebug('profile.created', { userId: user.id });
  }

  // Welcome notification check for registered (non-anonymous) users
  if (user && !user.is_anonymous) {
    try {
      const { data: existingNotifs } = await supabase
        .from('notifications')
        .select('id')
        .eq('user_id', user.id)
        .eq('message', 'Welcome to Grevya! Start your sustainable shopping journey.')
        .limit(1);
      
      if (!existingNotifs || existingNotifs.length === 0) {
        await supabase.from('notifications').insert({
          user_id: user.id,
          message: 'Welcome to Grevya! Start your sustainable shopping journey.',
          type: 'info'
        });
      }
    } catch (notifErr) {
      console.warn('Welcome notification check failed:', notifErr);
    }
  }

  clearPendingProfile(user.id);
  return finalProfile;
};
