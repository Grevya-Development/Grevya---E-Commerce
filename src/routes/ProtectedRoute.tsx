import { Navigate } from 'react-router-dom'
import { ReactNode } from 'react'
import { useAuthStore } from '../store/authStore'
import { UserRole } from '../services/authService'


interface Props {
  children: ReactNode
  allowedRoles: UserRole[]
}

// ─────────────────────────────────────────────
// PROTECTED ROUTE
// ─────────────────────────────────────────────

export default function ProtectedRoute({

  children,
  allowedRoles

}: Props) {

  const {

    user,
    profile,
    isLoading

  } = useAuthStore()

  // ─────────────────────────────────────────
  // LOADING STATE
  // ─────────────────────────────────────────

  if (isLoading) {

    return (

      <div className="flex items-center justify-center min-h-screen">

        Loading...

      </div>

    )

  }

  // ─────────────────────────────────────────
  // NOT LOGGED IN
  // ─────────────────────────────────────────

  if (!user) {

    return <Navigate to="/login" replace />

  }

  // ─────────────────────────────────────────
  // PROFILE NOT READY
  // ─────────────────────────────────────────

  if (!profile) {

    return <Navigate to="/login" replace />

  }

  // ─────────────────────────────────────────
  // ROLE NOT ALLOWED
  // ─────────────────────────────────────────

  if (

    !allowedRoles.includes(profile.role)

  ) {

    return <Navigate to="/" replace />

  }

  // ─────────────────────────────────────────
  // ACCESS GRANTED
  // ─────────────────────────────────────────

  return <>{children}</>

}