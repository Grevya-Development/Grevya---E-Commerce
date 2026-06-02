import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { registerUser } from '../services/authService';
import { Eye, EyeOff, User, Mail, Lock, CheckCircle2, XCircle, Leaf } from 'lucide-react';

export default function Register() {
  const navigate = useNavigate();

  const [form, setForm] = useState({
    username: '',
    email: '',
    password: '',
    confirm_password: '',
  });

  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [touched, setTouched] = useState({ password: false, confirm_password: false });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    setTouched({ ...touched, [e.target.name]: true });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await registerUser({ ...form, role: 'buyer' });
      navigate('/login');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  const passwordChecks = {
    minLength: form.password.length >= 8,
    uppercase: /[A-Z]/.test(form.password),
    lowercase: /[a-z]/.test(form.password),
    number:    /\d/.test(form.password),
    special:   /[@$!%*?&]/.test(form.password),
  };

  const passwordsMatch =
    form.password.length > 0 &&
    form.confirm_password.length > 0 &&
    form.password === form.confirm_password;

  const passwordStrength = Object.values(passwordChecks).filter(Boolean).length;
  const allChecksPass = Object.values(passwordChecks).every(Boolean);
  const canSubmit = allChecksPass && passwordsMatch && form.username && form.email;

  const strengthConfig = [
    { label: '',         color: 'bg-slate-200',   text: '' },
    { label: 'Very weak',color: 'bg-red-500',     text: 'text-red-500' },
    { label: 'Weak',     color: 'bg-orange-400',  text: 'text-orange-500' },
    { label: 'Fair',     color: 'bg-yellow-400',  text: 'text-yellow-600' },
    { label: 'Strong',   color: 'bg-emerald-400', text: 'text-emerald-600' },
    { label: 'Very strong', color: 'bg-emerald-600', text: 'text-emerald-700' },
  ];

  const strength = form.password.length > 0 ? strengthConfig[passwordStrength] : strengthConfig[0];

  const rules = [
    { key: 'minLength', label: 'Minimum 8 characters' },
    { key: 'uppercase', label: 'One uppercase letter' },
    { key: 'lowercase', label: 'One lowercase letter' },
    { key: 'number',    label: 'One number' },
    { key: 'special',   label: 'One special character (@$!%*?&)' },
  ] as const;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-emerald-50 to-teal-50 flex items-center justify-center p-4">

      {/* Card */}
      <div className="w-full max-w-[460px] bg-white rounded-2xl shadow-xl shadow-emerald-100/60 border border-slate-100 overflow-hidden">

        {/* Header strip */}
        <div className="bg-gradient-to-r from-emerald-600 to-teal-500 px-8 py-7">
          <div className="flex items-center gap-3 mb-1">
            <div className="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center">
              <Leaf size={18} className="text-white" />
            </div>
            <span className="text-white/80 text-sm font-medium tracking-wide uppercase">Grevya</span>
          </div>
          <h1 className="text-2xl font-bold text-white mt-3">Create your account</h1>
          <p className="text-emerald-100 text-sm mt-1">Join thousands of eco-conscious shoppers</p>
        </div>

        {/* Form */}
        <div className="px-8 py-7">

          {error && (
            <div className="mb-5 flex items-start gap-3 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
              <XCircle size={16} className="text-red-500 mt-0.5 flex-shrink-0" />
              <p className="text-red-600 text-sm">{error}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">

            {/* Username */}
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
                Username
              </label>
              <div className="relative">
                <User size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  name="username"
                  type="text"
                  placeholder="e.g. john_doe"
                  value={form.username}
                  onChange={handleChange}
                  className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:border-transparent focus:bg-white transition-all"
                  required
                />
              </div>
            </div>

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
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
                Password
              </label>
              <div className="relative">
                <Lock size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Create a strong password"
                  value={form.password}
                  onChange={handleChange}
                  onBlur={handleBlur}
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

              {/* Strength bar */}
              {form.password.length > 0 && (
                <div className="mt-2.5">
                  <div className="flex gap-1 mb-1.5">
                    {[1,2,3,4,5].map(i => (
                      <div
                        key={i}
                        className={`h-1 flex-1 rounded-full transition-all duration-300 ${
                          i <= passwordStrength ? strength.color : 'bg-slate-200'
                        }`}
                      />
                    ))}
                  </div>
                  <p className={`text-xs font-medium ${strength.text}`}>{strength.label}</p>
                </div>
              )}
            </div>

            {/* Confirm Password */}
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
                Confirm password
              </label>
              <div className="relative">
                <Lock size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  name="confirm_password"
                  type={showConfirmPassword ? 'text' : 'password'}
                  placeholder="Repeat your password"
                  value={form.confirm_password}
                  onChange={handleChange}
                  onBlur={handleBlur}
                  className={`w-full pl-10 pr-11 py-3 bg-slate-50 border rounded-xl text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:border-transparent focus:bg-white transition-all ${
                    form.confirm_password.length > 0
                      ? passwordsMatch
                        ? 'border-emerald-400 focus:ring-emerald-400'
                        : 'border-red-300 focus:ring-red-300'
                      : 'border-slate-200 focus:ring-emerald-400'
                  }`}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                >
                  {showConfirmPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                </button>
              </div>

              {/* Match indicator */}
              {form.confirm_password.length > 0 && (
                <div className={`flex items-center gap-1.5 mt-2 text-xs font-medium ${
                  passwordsMatch ? 'text-emerald-600' : 'text-red-500'
                }`}>
                  {passwordsMatch
                    ? <><CheckCircle2 size={13} /> Passwords match</>
                    : <><XCircle size={13} /> Passwords do not match</>
                  }
                </div>
              )}
            </div>

            {/* Validation rules — only show when user has typed */}
            {(touched.password || form.password.length > 0) && (
              <div className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-3.5">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2.5">
                  Password requirements
                </p>
                <div className="grid grid-cols-1 gap-1.5">
                  {rules.map(rule => {
                    const passed = passwordChecks[rule.key];
                    return (
                      <div key={rule.key} className="flex items-center gap-2.5">
                        <span className={`w-2.5 h-2.5 rounded-full flex-shrink-0 transition-all duration-200 ${
                          passed ? 'bg-emerald-500 shadow-sm shadow-emerald-200' : 'bg-red-400'
                        }`} />
                        <span className={`text-xs transition-colors duration-200 ${
                          passed ? 'text-emerald-700' : 'text-red-500'
                        }`}>
                          {rule.label}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={loading || !canSubmit}
              className="w-full mt-2 py-3.5 bg-gradient-to-r from-emerald-600 to-teal-500 text-white text-sm font-semibold rounded-xl hover:from-emerald-700 hover:to-teal-600 active:scale-[0.98] transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed shadow-md shadow-emerald-200"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
                  </svg>
                  Creating account...
                </span>
              ) : (
                'Create account'
              )}
            </button>

          </form>

          <p className="mt-6 text-center text-sm text-slate-500">
            Already have an account?{' '}
            <Link to="/login" className="text-emerald-600 font-semibold hover:text-emerald-700 hover:underline transition-colors">
              Sign in
            </Link>
          </p>

        </div>
      </div>
    </div>
  );
}