import { useEffect } from "react";

import { useAuthStore } from "@/store/authStore";

import {
  getCurrentUser,
  getUserProfile,
  onAuthStateChange,
} from "@/services/authService";

export default function AuthInitializer() {
  const { setUser, setProfile, setLoading, clearAuth } = useAuthStore();

  useEffect(() => {
    const initializeAuth = async () => {
      try {
        const user = await getCurrentUser();

        if (user) {
          const profile = await getUserProfile(user.id);

          setUser(user);

          setProfile(profile);
        } else {
          clearAuth();
        }
      } catch (error) {
        console.error("Auth init error:", error);

        clearAuth();
      } finally {
        setLoading(false);
      }
    };

    initializeAuth();

    const { data: listener } = onAuthStateChange(async (user) => {
      if (user) {
        try {
          const profile = await getUserProfile(user.id);

          setUser(user);

          setProfile(profile);
        } catch (error) {
          console.error(error);

          clearAuth();
        }
      } else {
        clearAuth();
      }

      setLoading(false);
    });

    return () => {
      listener.subscription.unsubscribe();
    };
  }, []);

  return null;
}
