import { useEffect } from 'react'

import { useAuthStore } from '../store/authStore'

import {
  onAuthStateChange,
  getUserProfile,
  logoutUser
} from '../services/authService'

// ─────────────────────────────────────────────
// GLOBAL AUTH HOOK
// ─────────────────────────────────────────────

export const useAuth = () => {

  const {

    user,
    profile,
    isLoading,

    setUser,
    setProfile,
    setLoading,
    clearAuth,

    isAdmin,
    isSeller,
    isBuyer,

  } = useAuthStore()

  // ─────────────────────────────────────────
  // AUTH STATE LISTENER
  // ─────────────────────────────────────────

  useEffect(() => {

    let mounted = true

    const {

      data: { subscription }

    } = onAuthStateChange(

      async (authUser) => {

        try {

          if (!mounted) return

          setLoading(true)

          // ─────────────────────────────
          // USER LOGGED IN
          // ─────────────────────────────

          if (authUser) {

            setUser(authUser)

            try {

              const profile =
                await getUserProfile(authUser.id)

              if (mounted) {
                setProfile(profile)
              }

            } catch (profileError) {

              console.error(
                'Failed to fetch profile:',
                profileError
              )

              clearAuth()
            }

          }

          // ─────────────────────────────
          // USER LOGGED OUT
          // ─────────────────────────────

          else {

            clearAuth()

          }

        } catch (error) {

          console.error(
            'Auth state error:',
            error
          )

          clearAuth()

        } finally {

          if (mounted) {
            setLoading(false)
          }

        }

      }

    )

    return () => {

      mounted = false

      subscription.unsubscribe()

    }

  }, [
    setUser,
    setProfile,
    setLoading,
    clearAuth
  ])

  // ─────────────────────────────────────────
  // LOGOUT
  // ─────────────────────────────────────────

  const logout = async () => {

    try {

      await logoutUser()

      clearAuth()

    } catch (error) {

      console.error(
        'Logout failed:',
        error
      )

    }

  }

  // ─────────────────────────────────────────
  // RETURN AUTH API
  // ─────────────────────────────────────────

  return {

    user,

    profile,

    isLoading,

    isAdmin,
    isSeller,
    isBuyer,

    logout,

  }

}