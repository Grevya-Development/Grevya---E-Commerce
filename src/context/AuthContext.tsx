import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  useRef,
  useCallback,
} from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabaseClient";
import { ensureUserProfile } from "@/lib/profileSync";
import { useCartStore } from "@/store/useCartStore";
import { useWishlistStore } from "@/store/useWishlistStore";

export interface UserProfile {
  id: string;
  username: string | null;
  full_name: string | null;
  avatar_url: string | null;
  phone: string | null;
  email: string | null;
  preferences: Record<string, any> | null;
  role?: string | null;
  status?: string | null;
  created_at?: string;
  last_login_at?: string | null;
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
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [profileLoading, setProfileLoading] = useState(false);
  const [authLoading, setAuthLoading] = useState(true);
  const loadedUserIdRef = useRef<string | null>(null);

  const loading = authLoading || profileLoading;

  const loadProfile = useCallback(
    async (currUser: User) => {
      if (loadedUserIdRef.current === currUser.id && profile) return;
      loadedUserIdRef.current = currUser.id;
      setProfileLoading(true);

      try {
        const syncedProfile = await ensureUserProfile(currUser);
        setProfile(syncedProfile as UserProfile);

        if (syncedProfile) {
          useCartStore.getState().syncUserSession(syncedProfile.id);
          useWishlistStore.getState().syncUserSession(syncedProfile.id);
        }
      } catch (error) {
        console.error("[AuthContext] Profile sync error:", error);
        setProfile({
          id: currUser.id,
          username: null,
          full_name: currUser.user_metadata?.full_name || null,
          avatar_url:
            currUser.user_metadata?.avatar_url ||
            currUser.user_metadata?.picture ||
            null,
          phone: currUser.user_metadata?.phone || null,
          email: currUser.email || null,
          preferences: null,
          role: "customer",
          status: "active",
        });
      } finally {
        setProfileLoading(false);
      }
    },
    [profile],
  );

  const refreshProfile = useCallback(async () => {
    if (!user) {
      setProfile(null);
      setProfileLoading(false);
      loadedUserIdRef.current = null;
      return;
    }

    loadedUserIdRef.current = null;
    await loadProfile(user);
  }, [loadProfile, user]);

  useEffect(() => {
    let mounted = true;
    let authSubscription: { unsubscribe: () => void } | null = null;

    const initialize = async () => {
      const { data: sessionData } = await supabase.auth.getSession();
      if (!mounted) return;

      const nextSession = sessionData.session;
      setSession(nextSession);
      setUser(nextSession?.user ?? null);
      setAuthLoading(false);

      if (nextSession?.user) {
        await loadProfile(nextSession.user);
      } else {
        setProfile(null);
        setProfileLoading(false);
      }

      const { data: authData } = supabase.auth.onAuthStateChange(
        (_event, nextSession) => {
          if (!mounted) return;

          const nextUser = nextSession?.user ?? null;
          setSession(nextSession);
          setUser(nextUser);
          setAuthLoading(false);

          if (nextUser) {
            void loadProfile(nextUser);
          } else {
            loadedUserIdRef.current = null;
            setProfile(null);
            useCartStore.getState().syncUserSession(null);
            useWishlistStore.getState().syncUserSession(null);
          }
        },
      );

      authSubscription = authData.subscription;
    };

    void initialize();

    return () => {
      mounted = false;
      authSubscription?.unsubscribe();
    };
  }, [loadProfile]);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    setProfile(null);
    loadedUserIdRef.current = null;
    useCartStore.getState().syncUserSession(null);
    useWishlistStore.getState().syncUserSession(null);
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      user,
      profile,
      loading,
      profileLoading,
      refreshProfile,
      signOut,
    }),
    [session, user, profile, loading, profileLoading, refreshProfile, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used inside AuthProvider");
  }
  return context;
};
