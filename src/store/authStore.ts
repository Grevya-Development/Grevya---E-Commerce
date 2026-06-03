import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { User } from '@supabase/supabase-js';
import { Profile } from '../services/authService';

interface AuthState {
  // Current auth user
  user: User | null;
  // User profile from profiles table
  profile: Profile | null;
  // Global auth loading state
  isLoading: boolean;
  // Actions
  setUser: (user: User | null) => void;
  setProfile: (profile: Profile | null) => void;
  setLoading: (loading: boolean) => void;
  clearAuth: () => void;

  // Role checkers
  isAdmin: () => boolean;
  isSeller: () => boolean;
  isBuyer: () => boolean;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      // Initial state
      user: null,
      profile: null,
      isLoading: true,

      // Actions
      setUser: (user) => set({ user }),
      setProfile: (profile) => set({ profile }),
      setLoading: (isLoading) => set({ isLoading }),
      clearAuth: () =>
        set({
          user: null,
          profile: null,
          isLoading: false,
        }),

      // Role checkers
      isAdmin: () => get().profile?.role === 'admin',
      isSeller: () => get().profile?.role === 'seller',
      isBuyer: () => get().profile?.role === 'buyer',
    }),
    {
      name: 'auth-storage',
      // Only persist necessary data
      partialize: (state) => ({
        user: state.user,
        profile: state.profile,
      }),
    }
  )
);