import React, { createContext, useContext, useEffect, useMemo, useState, useRef, useCallback } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabaseClient';
import { authDebug } from '@/lib/authDiagnostics';
import { ensureUserProfile } from '@/lib/profileSync';
import { useCartStore } from '@/store/useCartStore';

export interface UserProfile {
  id: string;
  username: string | null;
  full_name: string | null;
  avatar_url: string | null;
  phone: string | null;
  email: string | null;
  preferences: Record<string, any> | null;
  role?: string | null;
  created_at?: string;
}

interface AuthContextValue {
  session: Session | null;
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
  profileLoading: boolean;
  refreshProfile: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [profileLoading, setProfileLoading] = useState(false);
  const loadedUserIdRef = useRef<string | null>(null);
  const isExchangePendingRef = useRef(
    (window.location.search.includes('code=') || 
     window.location.hash.includes('access_token=') || 
     window.location.search.includes('type=recovery') ||
     window.location.hash.includes('error=')) &&
    (window.location.pathname.startsWith('/account') || 
     window.location.pathname.startsWith('/reset-password') || 
     window.location.pathname.startsWith('/login') || 
     window.location.pathname.startsWith('/signup') || 
     window.location.pathname.startsWith('/auth'))
  );

  const loadProfile = useCallback(async (user: User) => {
    if (loadedUserIdRef.current === user.id) return;
    loadedUserIdRef.current = user.id;
    setProfileLoading(true);
    try {
      const syncedProfile = await ensureUserProfile(user);
      setProfile(syncedProfile as UserProfile);
    } catch (error: any) {
      authDebug('profile.fallback', { message: error.message });
      setProfile({
        id: user.id,
        username: null,
        full_name: user.user_metadata?.full_name || null,
        avatar_url: null,
        phone: user.user_metadata?.phone || null,
        email: user.email || null,
        preferences: null,
      });
    } finally {
      setProfileLoading(false);
    }
  }, []);

  const refreshProfile = useCallback(async () => {
    const { data } = await supabase.auth.getUser();
    if (!data.user) {
      setProfile(null);
      setProfileLoading(false);
      loadedUserIdRef.current = null;
      return;
    }
    // Force reload by clearing ref first
    loadedUserIdRef.current = null;
    await loadProfile(data.user);
  }, [loadProfile]);

  useEffect(() => {
    let mounted = true;

    const restoreSession = async () => {
      try {
        const hasAuthParams = (window.location.search.includes('code=') || 
                            window.location.hash.includes('access_token=') || 
                            window.location.search.includes('type=recovery') ||
                            window.location.hash.includes('error=')) &&
                            (window.location.pathname.startsWith('/account') || 
                             window.location.pathname.startsWith('/reset-password') || 
                             window.location.pathname.startsWith('/login') || 
                             window.location.pathname.startsWith('/signup') || 
                             window.location.pathname.startsWith('/auth'));

        const { data } = await supabase.auth.getSession();
        if (!mounted) return;

        console.log('[AuthContext] restoreSession result:', { hasSession: Boolean(data.session), hasAuthParams });
        authDebug('session.restore', { hasSession: Boolean(data.session), hasAuthParams });
        
        if (data.session) {
          isExchangePendingRef.current = false;
          setSession(data.session);
          useCartStore.getState().syncUserSession(data.session.user.id);
          await loadProfile(data.session.user);
          if (mounted) setLoading(false);
        } else if (!hasAuthParams) {
          isExchangePendingRef.current = false;
          setSession(null);
          useCartStore.getState().syncUserSession(null);
          setProfile(null);
          setProfileLoading(false);
          loadedUserIdRef.current = null;
          if (mounted) setLoading(false);
        } else {
          // Failsafe timeout to prevent indefinite loading spinner if code exchange fails
          setTimeout(() => {
            if (mounted && isExchangePendingRef.current) {
              console.log('[AuthContext] Code exchange timeout failsafe triggered.');
              isExchangePendingRef.current = false;
              setLoading(false);
            }
          }, 8000);
        }
      } catch (err) {
        if (mounted) setLoading(false);
      }
    };

    restoreSession();

    const { data: authListener } = supabase.auth.onAuthStateChange((event, nextSession) => {
      console.log('[AuthContext] Auth Event:', event);
      console.log('[AuthContext] Session:', nextSession);
      console.log('[AuthContext] User:', nextSession?.user?.id);
      console.log('[AuthContext] Auth Loading:', loading);
      console.log('[AuthContext] isExchangePending:', isExchangePendingRef.current);
      authDebug('state.change', { event, hasSession: Boolean(nextSession) });

      if (!mounted) return;

      if (nextSession) {
        isExchangePendingRef.current = false;
        setSession(nextSession);
        useCartStore.getState().syncUserSession(nextSession.user.id);
        loadProfile(nextSession.user).then(() => {
          if (mounted) setLoading(false);
        });
      } else {
        setSession(null);
        useCartStore.getState().syncUserSession(null);
        if (!isExchangePendingRef.current) {
          setProfile(null);
          setProfileLoading(false);
          loadedUserIdRef.current = null;
          setLoading(false);
        }
      }
    });

    return () => {
      mounted = false;
      authListener.subscription.unsubscribe();
    };
  }, [loadProfile]);

  const signOut = useCallback(async () => {
    authDebug('logout.start');
    await supabase.auth.signOut();
    setSession(null);
    setProfile(null);
    setProfileLoading(false);
    loadedUserIdRef.current = null;
    useCartStore.getState().syncUserSession(null);
    authDebug('logout.success');
  }, []);

  const value = useMemo<AuthContextValue>(() => ({
    session,
    user: session?.user ?? null,
    profile,
    loading,
    profileLoading,
    refreshProfile,
    signOut,
  }), [session, profile, loading, profileLoading]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used inside AuthProvider');
  }
  return context;
};
