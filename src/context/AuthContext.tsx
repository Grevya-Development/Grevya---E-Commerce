import React, { createContext, useContext, useEffect, useMemo, useState, useRef, useCallback } from 'react';
import { useAuth as useClerkAuth, useUser as useClerkUser } from '@clerk/clerk-react';
import { setSupabaseToken } from '@/lib/supabaseClient';
import { ensureUserProfile } from '@/lib/profileSync';
import { useCartStore } from '@/store/useCartStore';
import { useWishlistStore } from '@/store/useWishlistStore';

export interface UserProfile {
  id: string;
  clerk_user_id: string;
  username: string | null;
  full_name: string | null;
  avatar_url: string | null;
  phone: string | null;
  email: string | null;
  preferences: Record<string, any> | null;
  role?: string | null;
  status: string;
  created_at?: string;
  last_login_at?: string | null;
}

interface AuthContextValue {
  session: any | null;
  user: any | null;
  profile: UserProfile | null;
  loading: boolean;
  profileLoading: boolean;
  refreshProfile: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const { isLoaded: authLoaded, userId, sessionId, getToken, signOut: clerkSignOut } = useClerkAuth();
  const { isLoaded: userLoaded, user: clerkUser } = useClerkUser();

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [profileLoading, setProfileLoading] = useState(false);
  const loadedClerkIdRef = useRef<string | null>(null);

  const loading = !authLoaded || !userLoaded;

  const loadProfile = useCallback(async (currUser: any) => {
    if (loadedClerkIdRef.current === currUser.id && profile) return;
    loadedClerkIdRef.current = currUser.id;
    setProfileLoading(true);
    try {
      // 1. Get the Supabase JWT token from Clerk
      const token = await getToken({ template: 'supabase' });
      // 2. Set the token on the Supabase client
      await setSupabaseToken(token);

      // 3. Ensure user profile exists in public.profiles
      const syncedProfile = await ensureUserProfile(currUser);
      setProfile(syncedProfile as UserProfile);

      // 4. Sync local state stores with the database profile UUID
      if (syncedProfile) {
        useCartStore.getState().syncUserSession(syncedProfile.id);
        useWishlistStore.getState().syncUserSession(syncedProfile.id);
      }
    } catch (error) {
      console.error('[AuthContext] Profile sync error:', error);
      // Fallback profile if DB call fails
      setProfile({
        id: currUser.id,
        clerk_user_id: currUser.id,
        username: null,
        full_name: currUser.fullName || null,
        avatar_url: currUser.imageUrl || null,
        phone: currUser.primaryPhoneNumber?.phoneNumber || null,
        email: currUser.primaryEmailAddress?.emailAddress || null,
        preferences: null,
        role: 'customer',
        status: 'active',
      });
    } finally {
      setProfileLoading(false);
    }
  }, [getToken, profile]);

  const refreshProfile = useCallback(async () => {
    if (!clerkUser) {
      setProfile(null);
      setProfileLoading(false);
      loadedClerkIdRef.current = null;
      return;
    }
    loadedClerkIdRef.current = null;
    await loadProfile(clerkUser);
  }, [clerkUser, loadProfile]);

  // Sync auth token and profiles when Clerk state updates
  useEffect(() => {
    const syncAuth = async () => {
      if (loading) return;

      if (userId && clerkUser) {
        await loadProfile(clerkUser);
      } else {
        // Clear Supabase session and states on logout
        loadedClerkIdRef.current = null;
        setProfile(null);
        await setSupabaseToken(null);
        useCartStore.getState().syncUserSession(null);
        useWishlistStore.getState().syncUserSession(null);
      }
    };

    syncAuth();
  }, [loading, userId, clerkUser, loadProfile]);

  const signOut = useCallback(async () => {
    await clerkSignOut();
    setProfile(null);
    loadedClerkIdRef.current = null;
    await setSupabaseToken(null);
    useCartStore.getState().syncUserSession(null);
    useWishlistStore.getState().syncUserSession(null);
  }, [clerkSignOut]);

  const value = useMemo<AuthContextValue>(() => ({
    session: sessionId ? { id: sessionId } : null,
    user: clerkUser ? {
      id: clerkUser.id,
      email: clerkUser.primaryEmailAddress?.emailAddress || null,
      user_metadata: {
        full_name: clerkUser.fullName || null,
        phone: clerkUser.primaryPhoneNumber?.phoneNumber || null,
      }
    } : null,
    profile,
    loading,
    profileLoading,
    refreshProfile,
    signOut,
  }), [sessionId, clerkUser, profile, loading, profileLoading, refreshProfile, signOut]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used inside AuthProvider');
  }
  return context;
};
