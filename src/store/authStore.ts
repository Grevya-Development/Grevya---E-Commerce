import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { User } from '@supabase/supabase-js'
import { Profile } from '../services/authService'


interface AuthState {

  // CURRENT AUTH USER
  user: User | null
  
  // USER PROFILE FROM profiles TABLE
  profile: Profile | null

  // GLOBAL AUTH LOADING STATE
  isLoading: boolean

  // ─────────────────────────────────────────
  // ACTIONS
  // ─────────────────────────────────────────

  setUser: (
    user: User | null
  ) => void

  setProfile: (
    profile: Profile | null
  ) => void

  setLoading: (
    loading: boolean
  ) => void

  clearAuth: () => void

  // ─────────────────────────────────────────
  // ROLE CHECKERS
  // ─────────────────────────────────────────

  isAdmin: () => boolean

  isSeller: () => boolean

  isBuyer: () => boolean
}

// ─────────────────────────────────────────────
// AUTH STORE
// ─────────────────────────────────────────────

export const useAuthStore = create<AuthState>()(

  persist(

    (set, get) => ({

      // ─────────────────────────────────────
      // INITIAL STATE
      // ─────────────────────────────────────

      user: null,

      profile: null,

      isLoading: true,

      // ─────────────────────────────────────
      // SET USER
      // ─────────────────────────────────────

      setUser: (
        user
      ) => set({
        user
      }),

      // ─────────────────────────────────────
      // SET PROFILE
      // ─────────────────────────────────────

      setProfile: (
        profile
      ) => set({
        profile
      }),

      // ─────────────────────────────────────
      // SET LOADING
      // ─────────────────────────────────────

      setLoading: (
        isLoading
      ) => set({
        isLoading
      }),

      // ─────────────────────────────────────
      // CLEAR AUTH
      // ─────────────────────────────────────

      clearAuth: () =>

        set({

          user: null,

          profile: null,

          isLoading: false,

        }),

      // ─────────────────────────────────────
      // ROLE CHECKERS
      // ─────────────────────────────────────

      isAdmin: () =>

        !!get().profile &&
        get().profile?.role === 'admin',

      isSeller: () =>

        !!get().profile &&
        get().profile?.role === 'seller',

      isBuyer: () =>

        !!get().profile &&
        get().profile?.role === 'buyer',

    }),

    // ───────────────────────────────────────
    // PERSIST CONFIG
    // ───────────────────────────────────────

    {

      name: 'auth-storage',

      // ONLY PERSIST NECESSARY DATA
      partialize: (state) => ({

        user: state.user,

        profile: state.profile,

      }),

    }

  )

)