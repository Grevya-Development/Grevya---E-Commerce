// import { useEffect, useState } from 'react'
// import { useNavigate, Link } from 'react-router-dom'
// import { Eye, EyeOff } from 'lucide-react'
// import { loginUser } from '../services/authService'
// import { useAuthStore } from '../store/authStore'

// export default function Login() {
//   const navigate = useNavigate()

//   const { user, setUser, setProfile } = useAuthStore()

//   const [form, setForm] = useState({
//     email: '',
//     password: '',
//   })

//   const [error, setError] = useState('')
//   const [loading, setLoading] = useState(false)
//   const [showPassword, setShowPassword] = useState(false)

//   // Redirect if already logged in
//   useEffect(() => {
//     if (user) navigate('/')
//   }, [user, navigate])

//   // Handle input change
//   const handleChange = (
//     e: React.ChangeEvent<HTMLInputElement>
//   ) => {
//     setForm({
//       ...form,
//       [e.target.name]: e.target.value,
//     })
//   }

//   // Handle login
//   const handleSubmit = async (
//     e: React.FormEvent
//   ) => {
//     e.preventDefault()

//     setError('')
//     setLoading(true)

//     try {
//       const { user, profile } = await loginUser(
//         form.email,
//         form.password
//       )

//       if (!profile.is_active) {
//         throw new Error('Your account has been deactivated')
//       }

//       setUser(user)
//       setProfile(profile)

//       if (profile.role === 'admin') {
//         navigate('/admin/dashboard')
//       } else if (profile.role === 'seller') {
//         navigate('/seller/dashboard')
//       } else {
//         navigate('/')
//       }
//     } catch (err: unknown) {
//       if (err instanceof Error) {
//         if (
//           err.message.includes(
//             'Invalid login credentials'
//           )
//         ) {
//           setError('Invalid email or password')
//         } else if (
//           err.message.includes('Email not confirmed')
//         ) {
//           setError(
//             'Please verify your email before login'
//           )
//         } else {
//           setError(err.message)
//         }
//       } else {
//         setError('Login failed')
//       }
//     } finally {
//       setLoading(false)
//     }
//   }

//   return (
//     <div className="max-w-md mx-auto mt-10 p-6 border rounded-lg bg-[#e8f5e9] border-green-200">
//       <h2 className="text-3xl font-bold mb-6 text-green-900">
//         Login
//       </h2>

//       {error && (
//         <p className="text-red-500 mb-4 text-sm font-medium">
//           {error}
//         </p>
//       )}

//       <form
//         onSubmit={handleSubmit}
//         className="space-y-4"
//       >
//         {/* Email */}
//         <input
//           name="email"
//           type="email"
//           placeholder="Email"
//           value={form.email}
//           onChange={handleChange}
//           className="w-full border border-green-300 p-3 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
//           required
//         />

//         {/* Password */}
//         <div className="relative">
//           <input
//             name="password"
//             type={showPassword ? 'text' : 'password'}
//             placeholder="Password"
//             value={form.password}
//             onChange={handleChange}
//             className="w-full border border-green-300 p-3 pr-14 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
//             required
//           />

//           <button
//             type="button"
//             onClick={() =>
//               setShowPassword(!showPassword)
//             }
//             className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-600"
//           >
//             {showPassword ? (
//               <EyeOff size={22} />
//             ) : (
//               <Eye size={22} />
//             )}
//           </button>
//         </div>

//         {/* Login Button */}
//         <button
//           type="submit"
//           disabled={loading}
//           className="w-full bg-blue-600 text-white p-3 rounded-md hover:bg-blue-700 transition duration-200 disabled:opacity-50"
//         >
//           {loading ? 'Logging in...' : 'Login'}
//         </button>
//       </form>

//       <p className="mt-5 text-center text-sm">
//         No account?{' '}
//         <Link
//           to="/register"
//           className="text-blue-600 hover:underline"
//         >
//           Register
//         </Link>
//       </p>
//     </div>
//   )
// }

import { useEffect, useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { Eye, EyeOff, Mail, Lock, XCircle, Leaf } from 'lucide-react'
import { loginUser } from '../services/authService'
import { useAuthStore } from '../store/authStore'

export default function Login() {
  const navigate = useNavigate()
  const { user, setUser, setProfile } = useAuthStore()

  const [form, setForm] = useState({ email: '', password: '' })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)

  // Redirect if already logged in
  useEffect(() => {
    if (user) navigate('/')
  }, [user, navigate])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm({ ...form, [e.target.name]: e.target.value })
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const { user, profile } = await loginUser(form.email, form.password)

      if (!profile.is_active) {
        throw new Error('Your account has been deactivated')
      }

      setUser(user)
      setProfile(profile)

      if (profile.role === 'admin') navigate('/admin/dashboard')
      else if (profile.role === 'seller') navigate('/seller/dashboard')
      else navigate('/')

    } catch (err: unknown) {
      if (err instanceof Error) {
        if (err.message.includes('Invalid login credentials')) {
          setError('Invalid email or password')
        } else if (err.message.includes('Email not confirmed')) {
          setError('Please verify your email before logging in')
        } else {
          setError(err.message)
        }
      } else {
        setError('Login failed. Please try again.')
      }
    } finally {
      setLoading(false)
    }
  }

  const canSubmit = form.email.length > 0 && form.password.length > 0

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-emerald-50 to-teal-50 flex items-center justify-center p-4">

      {/* Card */}
      <div className="w-full max-w-[420px] bg-white rounded-2xl shadow-xl shadow-emerald-100/60 border border-slate-100 overflow-hidden">

        {/* Header strip */}
        <div className="bg-gradient-to-r from-emerald-600 to-teal-500 px-8 py-7">
          <div className="flex items-center gap-3 mb-1">
            <div className="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center">
              <Leaf size={18} className="text-white" />
            </div>
            <span className="text-white/80 text-sm font-medium tracking-wide uppercase">Grevya</span>
          </div>
          <h1 className="text-2xl font-bold text-white mt-3">Welcome back</h1>
          <p className="text-emerald-100 text-sm mt-1">Sign in to continue shopping</p>
        </div>

        {/* Form */}
        <div className="px-8 py-7">

          {/* Error */}
          {error && (
            <div className="mb-5 flex items-start gap-3 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
              <XCircle size={16} className="text-red-500 mt-0.5 flex-shrink-0" />
              <p className="text-red-600 text-sm">{error}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">

            {/* Email */}
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
                Email address
              </label>
              <div className="relative">
                <Mail size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  name="email"
                  type="email"
                  placeholder="you@example.com"
                  value={form.email}
                  onChange={handleChange}
                  className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:border-transparent focus:bg-white transition-all"
                  required
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  Password
                </label>
                {/* Forgot password link — wire up later */}
                <Link
                  to="/forgot-password"
                  className="text-xs text-emerald-600 font-medium hover:text-emerald-700 hover:underline transition-colors"
                >
                  Forgot password?
                </Link>
              </div>
              <div className="relative">
                <Lock size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Enter your password"
                  value={form.password}
                  onChange={handleChange}
                  className="w-full pl-10 pr-11 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:border-transparent focus:bg-white transition-all"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                >
                  {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                </button>
              </div>
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={loading || !canSubmit}
              className="w-full mt-2 py-3.5 bg-gradient-to-r from-emerald-600 to-teal-500 text-white text-sm font-semibold rounded-xl hover:from-emerald-700 hover:to-teal-600 active:scale-[0.98] transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed shadow-md shadow-emerald-200"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                  </svg>
                  Signing in...
                </span>
              ) : (
                'Sign in'
              )}
            </button>

          </form>

          {/* Divider */}
          <div className="flex items-center gap-3 my-6">
            <div className="flex-1 h-px bg-slate-200" />
            <span className="text-xs text-slate-400 font-medium">OR</span>
            <div className="flex-1 h-px bg-slate-200" />
          </div>

          {/* Register link */}
          <p className="text-center text-sm text-slate-500">
            Don't have an account?{' '}
            <Link
              to="/register"
              className="text-emerald-600 font-semibold hover:text-emerald-700 hover:underline transition-colors"
            >
              Create one
            </Link>
          </p>

        </div>
      </div>
    </div>
  )
}