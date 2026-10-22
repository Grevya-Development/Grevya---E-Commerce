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
import { useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabaseClient";
import { ensureUserProfile } from "@/lib/profileSync";
import { useCartStore } from "@/store/useCartStore";
import { useWishlistStore } from "@/store/useWishlistStore";
import { toast } from "@/components/ui/use-toast";

export interface UserProfile {
  id: string;
  username: string | null;
  full_name: string | null;
  avatar_url: string | null;
  phone: string | null;
  email: string | null;
  preferences: Record<string, unknown> | null;
  role?: string | null;
  role_id?: number | string | null;
  status?: string | null;
  is_active?: boolean;
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
  const navigate = useNavigate();
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfileState] = useState<UserProfile | null>(null);
  const profileRef = useRef<UserProfile | null>(null);
  const [profileLoading, setProfileLoading] = useState(false);
  const [authLoading, setAuthLoading] = useState(true);
  const loadedUserIdRef = useRef<string | null>(null);
  const activeAuthUserIdRef = useRef<string | null>(null);
  const authStateRevisionRef = useRef(0);
  const blockedSignOutInProgressRef = useRef(false);
  const loading = authLoading || profileLoading;

  const setProfile = useCallback((nextProfile: UserProfile | null) => {
    profileRef.current = nextProfile;
    setProfileState(nextProfile);
  }, []);

  const signOutIfCurrentUser = useCallback(
    async (userId: string, revision: number) => {
      if (
        activeAuthUserIdRef.current !== userId ||
        authStateRevisionRef.current !== revision
      ) {
        return false;
      }

      const { data, error } = await supabase.auth.getSession();
      if (error) throw error;
      if (
        data.session?.user.id !== userId ||
        activeAuthUserIdRef.current !== userId ||
        authStateRevisionRef.current !== revision
      ) {
        return false;
      }

      const { error: signOutError } = await supabase.auth.signOut({
        scope: "local",
      });
      if (signOutError) throw signOutError;
      const { data: verifiedSession, error: verificationError } =
        await supabase.auth.getSession();
      if (verificationError) throw verificationError;
      if (verifiedSession.session?.user.id === userId) {
        throw new Error("The authenticated session could not be cleared.");
      }
      if (verifiedSession.session) {
        throw new Error(
          "The signed-in account changed while the session was being cleared.",
        );
      }
      return true;
    },
    [],
  );

  const signOutBlockedUser = useCallback(async (
    userId: string,
    revision: number,
  ) => {
    if (blockedSignOutInProgressRef.current) return;
    blockedSignOutInProgressRef.current = true;

    try {
      const didSignOut = await signOutIfCurrentUser(userId, revision);
      if (!didSignOut) return;
      toast({
        title: "Account blocked",
        description:
          "Your account has been blocked. Please contact the administrator.",
        variant: "destructive",
      });
      navigate("/login", { replace: true });
    } catch (error) {
      console.error("[AuthContext] Could not sign out blocked user:", error);
      toast({
        title: "Account access blocked",
        description:
          "We could not safely end this session. Please sign out and contact the administrator.",
        variant: "destructive",
      });
    } finally {
      blockedSignOutInProgressRef.current = false;
    }
  }, [navigate, signOutIfCurrentUser]);

  const loadProfile = useCallback(
    async (currUser: User, revision: number) => {
      if (
        activeAuthUserIdRef.current !== currUser.id ||
        authStateRevisionRef.current !== revision
      ) {
        return;
      }
      if (loadedUserIdRef.current === currUser.id && profileRef.current) return;
      loadedUserIdRef.current = currUser.id;
      setProfileLoading(true);

      try {
        const { data: existingProfile, error: profileError } = await supabase
          .from("profiles")
          .select("id, is_active")
          .eq("id", currUser.id)
          .maybeSingle();

        if (profileError) throw profileError;

        if (
          activeAuthUserIdRef.current !== currUser.id ||
          authStateRevisionRef.current !== revision
        ) {
          return;
        }

        // A profile is required for every authenticated application session.
        // Do not recreate a missing profile during sign-in, since it may have
        // been deliberately removed or failed verification.
        if (!existingProfile || existingProfile.is_active === false) {
          const didSignOut = await signOutIfCurrentUser(currUser.id, revision);
          if (didSignOut) {
            toast({
              title: existingProfile ? "Account blocked" : "Account not verified",
              description: existingProfile
                ? "Your account has been blocked. Please contact the administrator."
                : "We could not verify your account profile. Please contact support.",
              variant: "destructive",
            });
          }
          return;
        }

        const syncedProfile = await ensureUserProfile(currUser);
        if (
          activeAuthUserIdRef.current !== currUser.id ||
          authStateRevisionRef.current !== revision
        ) {
          return;
        }
        setProfile(syncedProfile as UserProfile);

        if (syncedProfile) {
          useCartStore.getState().syncUserSession(syncedProfile.id);
          useWishlistStore.getState().syncUserSession(syncedProfile.id);
        }
      } catch (error) {
        console.error("[AuthContext] Profile sync error:", error);
        if (
          activeAuthUserIdRef.current === currUser.id &&
          authStateRevisionRef.current === revision
        ) {
          setProfile(null);
          try {
            const didSignOut = await signOutIfCurrentUser(
              currUser.id,
              revision,
            );
            if (didSignOut) {
              toast({
                title: "Account verification failed",
                description:
                  "We could not verify your account profile. Please try signing in again or contact support.",
                variant: "destructive",
              });
            }
          } catch (signOutError) {
            console.error(
              "[AuthContext] Could not safely sign out after profile verification failed:",
              signOutError,
            );
            toast({
              title: "Account verification failed",
              description:
                "We could not verify your account or safely end its session. Please contact support.",
              variant: "destructive",
            });
          }
        }
      } finally {
        if (
          activeAuthUserIdRef.current === currUser.id &&
          authStateRevisionRef.current === revision
        ) {
          setProfileLoading(false);
        }
      }
    },
    [setProfile, signOutIfCurrentUser],
  );

  const refreshProfile = useCallback(async () => {
    if (!user) {
      setProfile(null);
      setProfileLoading(false);
      loadedUserIdRef.current = null;
      return;
    }

    loadedUserIdRef.current = null;
    await loadProfile(user, authStateRevisionRef.current);
  }, [loadProfile, setProfile, user]);

  useEffect(() => {
    let mounted = true;
    let authSubscription: { unsubscribe: () => void } | null = null;

    const syncAuthState = (
      nextSession: Session | null,
      deferProfileLoad = false,
    ) => {
      const nextUser = nextSession?.user ?? null;
      const previousUserId = activeAuthUserIdRef.current;
      const nextRevision = authStateRevisionRef.current + 1;
      authStateRevisionRef.current = nextRevision;
      activeAuthUserIdRef.current = nextUser?.id ?? null;
      if (previousUserId !== nextUser?.id) {
        loadedUserIdRef.current = null;
        setProfile(null);
        setProfileLoading(Boolean(nextUser));
      }
      setSession(nextSession);
      setUser(nextUser);
      setAuthLoading(false);

      if (nextUser) {
        if (deferProfileLoad) {
          window.setTimeout(() => {
            if (
              mounted &&
              activeAuthUserIdRef.current === nextUser.id &&
              authStateRevisionRef.current === nextRevision
            ) {
              void loadProfile(nextUser, nextRevision);
            }
          }, 0);
        } else {
          void loadProfile(nextUser, nextRevision);
        }
      } else {
        loadedUserIdRef.current = null;
        setProfile(null);
        setProfileLoading(false);
        useCartStore.getState().syncUserSession(null);
        useWishlistStore.getState().syncUserSession(null);
      }
    };

    const initialize = async () => {
      const restoreRevision = authStateRevisionRef.current;
      const { data: authData } = supabase.auth.onAuthStateChange(
        (_event, nextSession) => {
          if (!mounted) return;
          syncAuthState(nextSession, true);
        },
      );

      authSubscription = authData.subscription;

      try {
        const { data: sessionData, error } = await supabase.auth.getSession();
        if (error) throw error;
        if (!mounted) return;
        if (authStateRevisionRef.current !== restoreRevision) return;

        syncAuthState(sessionData.session);

        if (!sessionData.session?.user) {
          setProfile(null);
          setProfileLoading(false);
        }
      } catch (error) {
        console.error("[AuthContext] Could not restore the auth session:", error);
        if (!mounted || authStateRevisionRef.current !== restoreRevision) return;

        activeAuthUserIdRef.current = null;
        loadedUserIdRef.current = null;
        setSession(null);
        setUser(null);
        setProfile(null);
        setProfileLoading(false);
        setAuthLoading(false);
        useCartStore.getState().syncUserSession(null);
        useWishlistStore.getState().syncUserSession(null);
        toast({
          title: "Session could not be restored",
          description: "Please sign in again to continue.",
          variant: "destructive",
        });
      }
    };

    void initialize();

    return () => {
      mounted = false;
      authSubscription?.unsubscribe();
    };
  }, [loadProfile, setProfile]);

  useEffect(() => {
    if (!user?.id) return;

    blockedSignOutInProgressRef.current = false;
    const userAuthRevision = authStateRevisionRef.current;

    const profileChannel = supabase
      .channel(`current-user-profile:${user.id}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "profiles",
          filter: `id=eq.${user.id}`,
        },
        (payload) => {
          if (payload.new.is_active === false) {
            void signOutBlockedUser(user.id, userAuthRevision);
            return;
          }

          setProfile(payload.new as UserProfile);
        },
      )
      .subscribe((status) => {
        if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          console.warn(
            "[AuthContext] Profile realtime subscription unavailable.",
          );
        }
      });

    return () => {
      void supabase.removeChannel(profileChannel);
    };
  }, [setProfile, signOutBlockedUser, user?.id]);

  const signOut = useCallback(async () => {
    const userId = activeAuthUserIdRef.current;
    if (!userId) return;
    const didSignOut = await signOutIfCurrentUser(
      userId,
      authStateRevisionRef.current,
    );
    if (!didSignOut) {
      throw new Error("The signed-in account changed before sign-out completed.");
    }
  }, [signOutIfCurrentUser]);

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
