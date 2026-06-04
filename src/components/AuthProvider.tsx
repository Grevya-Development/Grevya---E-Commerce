
import { useEffect } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useAuthStore } from "@/store/authStore";
import { getUserProfile } from "@/services/authService";

interface Props {
  children: React.ReactNode;
}

export default function AuthProvider({ children }: Props) {
  const { setUser, setProfile, setLoading, clearAuth } = useAuthStore();

  useEffect(() => {
    const initAuth = async () => {
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (session?.user) {
          setUser(session.user);
          try {
            const profile = await getUserProfile(session.user.id);
            setProfile(profile);
          } catch {
            setProfile(null);
          }
        } else {
          clearAuth();
        }
      } catch {
        clearAuth();
      } finally {
        setLoading(false); 
      }
    };

    initAuth();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === "SIGNED_IN" && session?.user) {
        setUser(session.user);
        try {
          const profile = await getUserProfile(session.user.id);
          setProfile(profile);
        } catch {
          setProfile(null);
        }
        setLoading(false);
      }

      if (event === "SIGNED_OUT") {
        clearAuth();
      }

      if (event === "TOKEN_REFRESHED" && session?.user) {
        setUser(session.user);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  return <>{children}</>;
}
