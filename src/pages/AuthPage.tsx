import React, { useRef, useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Apple, CheckCircle2, Eye, EyeOff, Leaf, Loader2, Mail, Phone, ShieldCheck, Truck, Award, Sparkles, Compass, Lock, AlertCircle } from 'lucide-react';
import Navbar from '@/components/Navbar';
import { supabase } from '@/lib/supabaseClient';
import Footer from '@/components/Footer';
import { Button } from '@/components/ui/button';
import { toast } from '@/components/ui/use-toast';
import { useAuth } from '@/context/AuthContext';
import {
  friendlyAuthError,
  normalizeEmail,
  normalizePhone,
  validateEmail,
  validatePassword,
  validatePhone,
  getAuthRedirectUrl,
} from '@/lib/authValidation';
import {
  requestPasswordReset,
  requestPhoneOtp,
  signInWithEmail,
  signUpWithEmail,
  startOAuthSignIn,
  updateAuthPassword,
  verifyPhoneOtp,
} from '@/lib/authService';
import { motion, AnimatePresence } from 'framer-motion';

type AuthMode = 'login' | 'signup' | 'forgot' | 'reset';

const copy = {
  login: {
    title: 'Welcome Back',
    subtitle: 'Sign in to manage orders, addresses, wishlist, and checkout faster.',
    submit: 'Sign in securely',
  },
  signup: {
    title: 'Create Your Account',
    subtitle: 'Join Grevya for cleaner checkout, saved addresses, and order tracking.',
    submit: 'Create secure account',
  },
  forgot: {
    title: 'Reset Password',
    subtitle: 'We will send a secure reset link to your email address.',
    submit: 'Send reset link',
  },
  reset: {
    title: 'Set New Password',
    subtitle: 'Choose a strong password to secure your Grevya account.',
    submit: 'Update password',
  },
};

// Reusable Premium Floating Label Input Field
interface FloatingInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  id: string;
  label: string;
  error?: string;
}

const FloatingInput = ({ id, label, value = '', onChange, type = 'text', error, ...props }: FloatingInputProps) => {
  const [focused, setFocused] = useState(false);
  const isFloating = focused || (value && String(value).length > 0);

  return (
    <div className="relative mb-4">
      <label
        htmlFor={id}
        className={`absolute left-3 transition-all duration-200 pointer-events-none z-10 ${
          isFloating 
            ? 'top-1 text-[9px] font-bold text-[#A68D65] uppercase tracking-wider' 
            : 'top-3.5 text-sm text-[#1D1E19]/40 font-medium'
        }`}
      >
        {label}
      </label>
      <input
        id={id}
        type={type}
        value={value}
        onChange={onChange}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        className={`w-full rounded-xl border border-[#A68D65]/20 p-3 pt-5 focus:outline-none focus:ring-2 focus:ring-[#33381C]/20 focus:border-[#33381C] bg-white text-sm text-[#1D1E19] font-medium transition-all ${
          error ? 'border-red-500 focus:ring-red-500/20 focus:border-red-500' : 'hover:border-[#A68D65]/40'
        }`}
        {...props}
      />
      {error && <p className="text-[10px] text-red-500 font-bold mt-1 ml-1">{error}</p>}
    </div>
  );
};

const AuthPage = ({ mode }: { mode: AuthMode }) => {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as any)?.from?.pathname || '/account';
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [otpLoading, setOtpLoading] = useState(false);
  const [otpSent, setOtpSent] = useState(false);
  const [otp, setOtp] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const inFlightRef = useRef(false);

  // Email verification cooldown
  const [unconfirmedEmail, setUnconfirmedEmail] = useState<string | null>(null);
  const [resendingVerification, setResendingVerification] = useState(false);
  const [loginCooldownSeconds, setLoginCooldownSeconds] = useState(0);
  const [loginCooldownUntil, setLoginCooldownUntil] = useState<number | null>(null);

  useEffect(() => {
    const stored = localStorage.getItem('grevya-login-resend-cooldown');
    if (stored) {
      const parsed = Number(stored);
      if (parsed > Date.now()) {
        setLoginCooldownUntil(parsed);
      }
    }
  }, []);

  useEffect(() => {
    if (!loginCooldownUntil) {
      setLoginCooldownSeconds(0);
      return;
    }

    const updateTimer = () => {
      const remaining = Math.max(0, Math.ceil((loginCooldownUntil - Date.now()) / 1000));
      setLoginCooldownSeconds(remaining);
      if (remaining === 0) {
        setLoginCooldownUntil(null);
        localStorage.removeItem('grevya-login-resend-cooldown');
      }
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [loginCooldownUntil]);

  const handleResendLoginVerification = async () => {
    if (!unconfirmedEmail) return;
    if (loginCooldownSeconds > 0) return;

    setResendingVerification(true);
    try {
      const { error } = await supabase.auth.resend({
        type: 'signup',
        email: unconfirmedEmail,
        options: {
          emailRedirectTo: getAuthRedirectUrl('/account'),
        },
      });

      if (error) {
        const errorMsg = error.message.toLowerCase();
        if (errorMsg.includes('rate limit') || errorMsg.includes('rate exceeded')) {
          const cooldownTime = Date.now() + 60 * 1000;
          setLoginCooldownUntil(cooldownTime);
          localStorage.setItem('grevya-login-resend-cooldown', String(cooldownTime));
        }
        throw error;
      }

      const cooldownTime = Date.now() + 60 * 1000;
      setLoginCooldownUntil(cooldownTime);
      localStorage.setItem('grevya-login-resend-cooldown', String(cooldownTime));

      toast({
        title: 'Verification email sent',
        description: `We've sent a new confirmation link to ${unconfirmedEmail}.`,
      });
    } catch (error: any) {
      toast({
        title: 'Could not resend email',
        description: friendlyAuthError(error.message),
        variant: 'destructive',
      });
    } finally {
      setResendingVerification(false);
    }
  };

  const isLogin = mode === 'login';
  const isSignup = mode === 'signup';
  const needsPassword = mode !== 'forgot';
  const pageCopy = copy[mode];

  const passwordChecks = [
    { label: '8+ characters', done: password.length >= 8 },
    { label: 'Uppercase letter', done: /[A-Z]/.test(password) },
    { label: 'Lowercase letter', done: /[a-z]/.test(password) },
    { label: 'Number digit', done: /\d/.test(password) },
    { label: 'Special symbol', done: /[^A-Za-z0-9]/.test(password) },
  ];

  const score = passwordChecks.filter(c => c.done).length;
  const strengthColors = ['bg-red-500', 'bg-orange-500', 'bg-yellow-500', 'bg-emerald-500', 'bg-emerald-600'];
  const strengthLabels = ['Weak', 'Fair', 'Good', 'Strong', 'Excellent'];

  const validateForm = () => {
    const nextErrors: Record<string, string> = {};
    const normalizedEmail = normalizeEmail(email);

    if (mode !== 'reset') {
      const emailError = validateEmail(normalizedEmail);
      if (emailError) nextErrors.email = emailError;
    }

    if (isSignup && name.trim().length < 2) {
      nextErrors.name = 'Enter your full name.';
    }

    if (isSignup) {
      const phoneError = validatePhone(phone, false);
      if (phoneError) nextErrors.phone = phoneError;
    }

    if (needsPassword) {
      const passwordError = isLogin ? (!password ? 'Enter your password.' : '') : validatePassword(password);
      if (passwordError) nextErrors.password = passwordError;
    }

    if (isSignup && password !== confirmPassword) {
      nextErrors.confirmPassword = 'Passwords do not match.';
    }

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleSocialSignIn = async (provider: 'google' | 'apple') => {
    if (loading || otpLoading || inFlightRef.current) return;
    inFlightRef.current = true;
    setLoading(true);

    try {
      await startOAuthSignIn(provider);
    } catch (error: any) {
      toast({ title: 'Sign-in failed', description: friendlyAuthError(error.message), variant: 'destructive' });
      setLoading(false);
      inFlightRef.current = false;
    }
  };

  const handlePhoneOtp = async () => {
    const phoneError = validatePhone(phone, true);
    if (phoneError) {
      setErrors((current) => ({ ...current, phone: phoneError }));
      return;
    }

    setOtpLoading(true);
    try {
      await requestPhoneOtp(phone);
      setOtpSent(true);
      toast({ title: 'OTP sent', description: 'Enter the code sent to your phone.' });
    } catch (error: any) {
      toast({ title: 'OTP unavailable', description: friendlyAuthError(error.message), variant: 'destructive' });
    } finally {
      setOtpLoading(false);
    }
  };

  const handleVerifyPhoneOtp = async () => {
    if (!otp.trim()) {
      setErrors((current) => ({ ...current, otp: 'Enter the OTP code.' }));
      return;
    }

    setOtpLoading(true);
    try {
      await verifyPhoneOtp(phone, otp.trim());
      toast({ title: 'Phone verified', description: 'You are signed in securely.' });
      navigate(from, { replace: true });
    } catch (error: any) {
      toast({ title: 'OTP failed', description: friendlyAuthError(error.message), variant: 'destructive' });
    } finally {
      setOtpLoading(false);
    }
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (loading || otpLoading || inFlightRef.current) return;
    if (!validateForm()) return;

    const normalizedEmail = normalizeEmail(email);
    const normalizedPhone = normalizePhone(phone);

    inFlightRef.current = true;
    setLoading(true);

    try {
      if (mode === 'login') {
        await signInWithEmail(normalizedEmail, password);
        toast({ title: 'Signed in', description: 'Your secure session has been restored.' });
        navigate(from, { replace: true });
      }

      if (mode === 'signup') {
        const data = await signUpWithEmail({
          email: normalizedEmail,
          password,
          fullName: name,
          phone: normalizedPhone,
        });

        toast({
          title: 'Account created',
          description: data.session ? 'You are signed in.' : 'Check your email to confirm your account.',
        });
        
        if (data.session) {
          navigate('/account');
        } else {
          localStorage.setItem('grevya-signup-email', normalizedEmail);
          navigate('/verify-email', { state: { email: normalizedEmail } });
        }
      }

      if (mode === 'forgot') {
        await requestPasswordReset(normalizedEmail);
        toast({ title: 'Reset link sent', description: 'Please check your email inbox.' });
      }

      if (mode === 'reset') {
        await updateAuthPassword(password);
        toast({ title: 'Password updated', description: 'You can now continue securely.' });
        navigate('/account');
      }
    } catch (error: any) {
      setPassword('');
      setConfirmPassword('');
      const isUnconfirmed = error.message?.toLowerCase().includes('email not confirmed') || 
                            error.message?.toLowerCase().includes('confirm your email');
      if (isUnconfirmed) {
        setUnconfirmedEmail(normalizedEmail);
      } else {
        setUnconfirmedEmail(null);
      }
      toast({
        title: 'Authentication error',
        description: friendlyAuthError(error.message),
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
      inFlightRef.current = false;
    }
  };

  return (
    <div className="flex min-h-screen flex-col bg-[#F7EEE4]/30">
      <Navbar />
      
      <main className="flex-grow flex items-center justify-center px-4 py-10 md:py-16">
        <div className="w-full max-w-5.5xl overflow-hidden rounded-[2rem] border border-[#A68D65]/20 bg-white shadow-2xl grid md:grid-cols-[1fr_1fr] min-h-[630px] relative">
          
          {/* Left panel cinematic decorative sidebar */}
          <section className={`relative hidden min-h-[580px] p-12 text-[#F7EEE4] md:flex md:flex-col md:justify-between overflow-hidden ${
            isSignup ? 'md:order-2 border-l border-[#A68D65]/10' : 'md:order-1 border-r border-[#A68D65]/10'
          }`}>
            {/* Dark Forest background layer */}
            <div className="absolute inset-0 bg-[#33381C]" />
            
            {/* Glowing animated blur orbs */}
            <motion.div 
              animate={{ 
                x: [0, 40, -20, 0],
                y: [0, -40, 30, 0]
              }}
              transition={{
                duration: 18,
                repeat: Infinity,
                ease: "easeInOut"
              }}
              className="absolute top-10 left-10 w-64 h-64 bg-[#A68D65]/15 rounded-full blur-3xl -z-10 pointer-events-none gpu-accelerated animate-pulse-orb" 
            />
            <motion.div 
              animate={{ 
                x: [0, -30, 40, 0],
                y: [0, 30, -30, 0]
              }}
              transition={{
                duration: 22,
                repeat: Infinity,
                ease: "easeInOut"
              }}
              className="absolute bottom-10 right-10 w-72 h-72 bg-[#E7E9DD]/10 rounded-full blur-3xl -z-10 pointer-events-none gpu-accelerated animate-pulse-orb" 
            />

            <div className="relative z-10 space-y-6">
              <div className="inline-flex items-center rounded-full bg-white/10 px-4 py-1.5 text-[10px] font-bold uppercase tracking-wider backdrop-blur-md border border-white/10">
                {isSignup ? (
                  <><Award className="mr-1.5 h-3.5 w-3.5 text-[#A68D65]" /> Member Perks</>
                ) : (
                  <><ShieldCheck className="mr-1.5 h-3.5 w-3.5 text-[#A68D65]" /> Secure Portal</>
                )}
              </div>
              <h1 className="font-serif text-3xl lg:text-4xl font-bold leading-tight tracking-tight text-white">
                {isSignup ? 'Unlock Premium Green Shopping.' : 'Welcome Back to Grevya.'}
              </h1>
              <p className="text-white/70 text-sm leading-relaxed max-w-sm font-medium">
                {isSignup 
                  ? 'Join the Grevya community to access carbon-neutral shipping, verified organic catalogs, and community-first pricing.'
                  : 'Access your personalized dashboard, track local orders, and manage saved checkout addresses securely.'
                }
              </p>
            </div>
            
            <div className="relative z-10 space-y-4 py-6">
              {isSignup ? (
                <>
                  {[
                    { icon: Award, title: '10% Welcome Reward', desc: 'Get an automatic discount code sent to your inbox upon verification.' },
                    { icon: Truck, title: 'Carbon-Neutral Delivery', desc: 'Every single shipment is offset through local forest restoration partnerships.' },
                    { icon: Compass, title: 'Artisan Support', desc: '1% of every purchase directly supports rural craftspeople.' }
                  ].map((benefit, idx) => (
                    <div key={idx} className="flex gap-3.5 p-3 rounded-2xl bg-white/5 border border-white/5 backdrop-blur-xs hover:bg-white/8 transition-colors">
                      <benefit.icon className="w-5 h-5 text-[#A68D65] flex-shrink-0 mt-0.5" />
                      <div>
                        <h4 className="font-bold text-xs text-white">{benefit.title}</h4>
                        <p className="text-[10px] text-white/60 mt-0.5">{benefit.desc}</p>
                      </div>
                    </div>
                  ))}
                </>
              ) : (
                <>
                  {[
                    { icon: ShieldCheck, title: 'Certified Organic Standards', desc: 'All products pass rigorous eco-safety controls.' },
                    { icon: Sparkles, title: 'Artisanal Traceability', desc: 'Track exactly which rural community crafted your order.' },
                    { icon: Leaf, title: 'Zero Waste Operations', desc: 'We package exclusively with compostable starch fillers.' }
                  ].map((indicator, idx) => (
                    <div key={idx} className="flex gap-3.5 p-3 rounded-2xl bg-white/5 border border-white/5 backdrop-blur-xs">
                      <indicator.icon className="w-5 h-5 text-[#A68D65] flex-shrink-0 mt-0.5" />
                      <div>
                        <h4 className="font-bold text-xs text-white">{indicator.title}</h4>
                        <p className="text-[10px] text-white/60 mt-0.5">{indicator.desc}</p>
                      </div>
                    </div>
                  ))}
                </>
              )}
            </div>

            <div className="relative z-10 text-[10px] text-white/40 flex justify-between border-t border-white/10 pt-4">
              <span>© {new Date().getFullYear()} Grevya Nature Corp</span>
              <span>100% Traceable Supply</span>
            </div>
          </section>

          {/* Form panel container */}
          <section className={`relative p-6 sm:p-10 lg:p-14 flex flex-col justify-center ${isSignup ? 'md:order-1' : 'md:order-2'}`}>
            {/* Loading overlays */}
            {(loading || otpLoading || (mode === 'reset' && authLoading)) && (
              <div className="absolute inset-0 z-20 flex items-center justify-center bg-white/85 backdrop-blur-xs rounded-[2rem]">
                <div className="rounded-2xl bg-white px-5 py-4 text-center shadow-lg border border-neutral-100 flex flex-col items-center">
                  <Loader2 className="h-7 w-7 animate-spin text-[#33381C] mb-2" />
                  <p className="text-xs font-bold text-neutral-800">
                    {mode === 'reset' && authLoading ? 'Verifying recovery session...' : 'Securing session...'}
                  </p>
                </div>
              </div>
            )}

            {mode === 'reset' && !authLoading && !user ? (
              <div className="text-center py-6">
                <div className="mx-auto w-14 h-14 bg-red-50 rounded-full flex items-center justify-center text-red-750 mb-4">
                  <Lock className="w-6 h-6" />
                </div>
                <h2 className="text-xl font-bold text-neutral-900 mb-2 font-serif">Invalid Reset Link</h2>
                <p className="text-neutral-500 mb-6 text-xs max-w-xs mx-auto leading-relaxed">
                  This password reset link is invalid, expired, or has already been used. Please request a new link.
                </p>
                <div className="flex flex-col gap-2">
                  <Button asChild className="h-11 rounded-xl bg-[#33381C] hover:bg-[#262A14] text-xs font-bold w-full">
                    <Link to="/forgot-password">Request New Link</Link>
                  </Button>
                  <Button asChild variant="ghost" className="h-11 rounded-xl text-neutral-600 text-xs">
                    <Link to="/login">Back to Login</Link>
                  </Button>
                </div>
              </div>
            ) : (
              <AnimatePresence mode="wait">
                <motion.div
                  key={mode}
                  initial={{ opacity: 0, x: 10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -10 }}
                  transition={{ duration: 0.25 }}
                >
                  <div className="mb-6">
                    <h2 className="text-2xl font-serif font-bold text-[#1D1E19] leading-none">{pageCopy.title}</h2>
                    <p className="mt-1.5 text-xs text-neutral-500 font-semibold">{pageCopy.subtitle}</p>
                  </div>

                  {(isLogin || isSignup) && (
                    <>
                      <div className="grid grid-cols-2 gap-3">
                        <Button
                          type="button"
                          variant="outline"
                          disabled={loading || otpLoading}
                          onClick={() => handleSocialSignIn('google')}
                          className="h-11 rounded-xl border-[#A68D65]/25 hover:bg-neutral-50 flex items-center justify-center gap-2 hover:border-[#33381C]/35 text-[#1D1E19]/80 font-bold text-xs"
                        >
                          <Mail className="h-4 w-4 text-red-500 shrink-0" />
                          Google
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          disabled={loading || otpLoading}
                          onClick={() => handleSocialSignIn('apple')}
                          className="h-11 rounded-xl border-[#A68D65]/25 hover:bg-neutral-50 flex items-center justify-center gap-2 hover:border-[#33381C]/35 text-[#1D1E19]/80 font-bold text-xs"
                        >
                          <Apple className="h-4 w-4 text-black shrink-0" />
                          Apple
                        </Button>
                      </div>

                      <div className="relative my-5">
                        <div className="absolute inset-0 flex items-center">
                          <div className="w-full border-t border-[#A68D65]/10"></div>
                        </div>
                        <div className="relative flex justify-center text-[9px] uppercase">
                          <span className="bg-white px-2.5 text-neutral-400 font-bold tracking-wider">Or continue with</span>
                        </div>
                      </div>
                    </>
                  )}

                  <form className="space-y-4" onSubmit={handleSubmit}>
                    {isSignup && (
                      <FloatingInput
                        id="name"
                        label="Full Name"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        error={errors.name}
                        required
                      />
                    )}
                    
                    {mode !== 'reset' && (
                      <FloatingInput
                        id="email"
                        label="Email Address"
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        error={errors.email}
                        required
                      />
                    )}

                    {isSignup && (
                      <FloatingInput
                        id="phone"
                        label="Phone Number"
                        type="tel"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        error={errors.phone}
                        placeholder="9876543210"
                        required
                      />
                    )}

                    {isLogin && (
                      <div className="rounded-2xl border border-[#A68D65]/20 bg-[#E7E9DD]/20 p-3.5 space-y-2">
                        <span className="text-[9px] uppercase font-bold text-[#33381C]/70 tracking-wider">Mobile OTP Login</span>
                        <div className="flex gap-2 items-center">
                          <div className="flex-grow">
                            <input
                              type="tel"
                              value={phone}
                              onChange={(e) => setPhone(e.target.value)}
                              placeholder="9876543210 OTP Mobile"
                              className="w-full h-10 rounded-lg border border-[#A68D65]/20 bg-white/80 px-3 text-xs outline-none focus:border-[#33381C]"
                            />
                          </div>
                          <Button 
                            type="button" 
                            variant="outline" 
                            disabled={otpLoading || loading} 
                            onClick={handlePhoneOtp} 
                            className="h-10 rounded-lg text-xs font-bold border-[#33381C]/30 hover:bg-[#33381C]/5 text-[#33381C] shrink-0"
                          >
                            {otpLoading && !otpSent ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : null}
                            Send OTP
                          </Button>
                        </div>
                        {otpSent && (
                          <div className="flex gap-2">
                            <input
                              value={otp}
                              onChange={(e) => setOtp(e.target.value)}
                              placeholder="Enter verification code"
                              className="flex-grow h-10 rounded-lg border border-[#A68D65]/20 bg-white px-3 text-xs outline-none focus:border-[#33381C]"
                            />
                            <Button 
                              type="button" 
                              disabled={otpLoading || loading} 
                              onClick={handleVerifyPhoneOtp} 
                              className="h-10 rounded-lg text-xs font-bold bg-[#33381C] hover:bg-[#262A14] text-white shrink-0"
                            >
                              Verify
                            </Button>
                          </div>
                        )}
                        {(errors.phone || errors.otp) && <p className="text-[10px] text-red-500 font-bold">{errors.phone || errors.otp}</p>}
                      </div>
                    )}

                    {needsPassword && (
                      <div>
                        <div className="relative">
                          <FloatingInput
                            id="password"
                            label="Password"
                            type={showPassword ? 'text' : 'password'}
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            error={errors.password}
                            minLength={isLogin ? 1 : 8}
                            required
                          />
                          <button
                            type="button"
                            onClick={() => setShowPassword((v) => !v)}
                            className="absolute right-3.5 top-3.5 text-neutral-450 hover:text-[#33381C]"
                            aria-label={showPassword ? 'Hide password' : 'Show password'}
                          >
                            {showPassword ? <EyeOff className="h-4.5 w-4.5" /> : <Eye className="h-4.5 w-4.5" />}
                          </button>
                        </div>
                        {isLogin && (
                          <div className="text-right -mt-2.5 mb-2">
                            <Link className="text-[11px] font-bold text-[#33381C] hover:underline" to="/forgot-password">
                              Forgot password?
                            </Link>
                          </div>
                        )}
                      </div>
                    )}

                    {isSignup && (
                      <FloatingInput
                        id="confirmPassword"
                        label="Confirm Password"
                        type={showPassword ? 'text' : 'password'}
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        error={errors.confirmPassword}
                        required
                      />
                    )}

                    {/* Premium strength progress bar */}
                    {(isSignup || mode === 'reset') && password.length > 0 && (
                      <motion.div 
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        className="p-3.5 rounded-xl border border-[#A68D65]/15 bg-[#F7EEE4]/40"
                      >
                        <div className="flex justify-between items-center text-[10px] font-bold text-neutral-500 uppercase tracking-wider mb-1.5">
                          <span>Password Strength</span>
                          <span className={score > 0 ? `font-extrabold text-[#33381C]` : `text-red-500`}>
                            {score > 0 ? strengthLabels[score - 1] : 'None'}
                          </span>
                        </div>
                        <div className="h-1.5 w-full bg-[#EAE2D5]/50 rounded-full overflow-hidden flex space-x-0.5">
                          {[...Array(5)].map((_, idx) => (
                            <div 
                              key={idx} 
                              className={`h-full flex-1 transition-colors duration-300 ${
                                idx < score ? strengthColors[score - 1] : 'bg-gray-200'
                              }`} 
                            />
                          ))}
                        </div>
                        <div className="mt-2.5 grid grid-cols-2 gap-x-2 gap-y-1 text-[9px] font-semibold text-neutral-500 border-t border-[#A68D65]/10 pt-2">
                          {passwordChecks.map((check) => (
                            <span key={check.label} className={`flex items-center gap-1 ${check.done ? 'text-green-700 font-bold' : ''}`}>
                              <CheckCircle2 className={`h-3 w-3 ${check.done ? 'text-green-700' : 'text-neutral-300'}`} />
                              {check.label}
                            </span>
                          ))}
                        </div>
                      </motion.div>
                    )}

                    {isLogin && unconfirmedEmail && (
                      <div className="rounded-2xl border border-amber-100 bg-amber-50/20 p-3.5 text-xs text-amber-900 space-y-2 mt-4 shadow-xs">
                        <div className="flex items-start gap-2">
                          <AlertCircle className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" />
                          <div>
                            <p className="font-bold">Email Verification Required</p>
                            <p className="text-[10px] text-neutral-600 mt-0.5 leading-relaxed">
                              Verification link not clicked. Resend confirmation link to <strong>{unconfirmedEmail}</strong>.
                            </p>
                          </div>
                        </div>
                        <div className="pt-0.5 flex items-center">
                          <Button
                            type="button"
                            variant="outline"
                            disabled={resendingVerification || loginCooldownSeconds > 0}
                            onClick={handleResendLoginVerification}
                            className="h-8 rounded-lg text-[10px] bg-white border-amber-200 text-amber-900 hover:bg-amber-50 font-bold"
                          >
                            {resendingVerification ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : null}
                            {loginCooldownSeconds > 0 ? `Resend (${loginCooldownSeconds}s)` : 'Resend Verification Email'}
                          </Button>
                        </div>
                      </div>
                    )}

                    <Button type="submit" disabled={loading || otpLoading} className="h-12 w-full rounded-xl bg-[#33381C] hover:bg-[#262A14] text-white font-bold shadow-md hover:shadow-lg mt-4 cursor-pointer">
                      {loading && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
                      {pageCopy.submit}
                    </Button>
                  </form>

                  <div className="mt-5 text-center text-xs border-t border-[#A68D65]/10 pt-4 font-medium">
                    {isLogin && <span className="text-neutral-500">New to Grevya? <Link className="font-bold text-[#33381C] hover:underline" to="/signup">Create an Account</Link></span>}
                    {isSignup && <span className="text-neutral-500">Already have an account? <Link className="font-bold text-[#33381C] hover:underline" to="/login">Sign In</Link></span>}
                    {(mode === 'forgot' || mode === 'reset') && <Link className="font-bold text-[#33381C] hover:underline" to="/login">Back to Login</Link>}
                  </div>
                </motion.div>
              </AnimatePresence>
            )}
          </section>
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default AuthPage;
