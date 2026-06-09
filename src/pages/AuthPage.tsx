import React, { useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Apple, CheckCircle2, Eye, EyeOff, Leaf, Loader2, Mail, Phone, ShieldCheck, Truck, Award, Sparkles, Compass, Lock } from 'lucide-react';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from '@/components/ui/use-toast';
import {
  friendlyAuthError,
  normalizeEmail,
  normalizePhone,
  validateEmail,
  validatePassword,
  validatePhone,
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

type AuthMode = 'login' | 'signup' | 'forgot' | 'reset';

const copy = {
  login: {
    title: 'Welcome back',
    subtitle: 'Sign in to manage orders, addresses, wishlist, and checkout faster.',
    submit: 'Sign in',
  },
  signup: {
    title: 'Create your account',
    subtitle: 'Join Grevya for cleaner checkout, saved addresses, and order tracking.',
    submit: 'Create account',
  },
  forgot: {
    title: 'Reset your password',
    subtitle: 'We will send a secure reset link to your email address.',
    submit: 'Send reset link',
  },
  reset: {
    title: 'Set new password',
    subtitle: 'Choose a strong password to secure your Grevya account.',
    submit: 'Update password',
  },
};

const AuthPage = ({ mode }: { mode: AuthMode }) => {
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

  const isLogin = mode === 'login';
  const isSignup = mode === 'signup';
  const needsPassword = mode !== 'forgot';
  const pageCopy = copy[mode];

  const passwordChecks = [
    { label: '8+ characters', done: password.length >= 8 },
    { label: 'Uppercase', done: /[A-Z]/.test(password) },
    { label: 'Lowercase', done: /[a-z]/.test(password) },
    { label: 'Number', done: /\d/.test(password) },
    { label: 'Symbol', done: /[^A-Za-z0-9]/.test(password) },
  ];

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
    <div className="flex min-h-screen flex-col bg-cream/10">
      <Navbar />
      <main className="flex-grow flex items-center justify-center px-4 py-16">
        <div className="w-full max-w-6xl overflow-hidden rounded-[2.5rem] border border-green-100 bg-white shadow-2xl shadow-green-900/5 grid md:grid-cols-[1.05fr_0.95fr] min-h-[660px]">
          {/* Sidebar Section */}
          <section className={`relative hidden min-h-[620px] p-12 text-white md:flex md:flex-col md:justify-between overflow-hidden ${isSignup ? 'md:order-2 border-l border-green-50' : 'md:order-1 border-r border-green-50'}`}>
            {isSignup ? (
              <>
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_20%,rgba(250,204,21,0.15),transparent_40%),linear-gradient(135deg,#046d38_0%,#022c16_100%)]" />
                <div className="relative z-10 space-y-6">
                  <div className="inline-flex items-center rounded-full bg-white/10 px-4 py-1.5 text-xs font-semibold uppercase tracking-wider backdrop-blur border border-white/10">
                    <Leaf className="mr-1.5 h-3.5 w-3.5 text-amber-300" />
                    Member Benefits
                  </div>
                  <h1 className="text-4xl lg:text-5xl font-extrabold leading-tight tracking-tight text-white">
                    Unlock Premium Green Shopping.
                  </h1>
                  <p className="text-white/80 text-base leading-relaxed max-w-md">
                    Join the Grevya community to access carbon-neutral shipping, verified organic catalogs, and community-first pricing.
                  </p>
                </div>
                
                <div className="relative z-10 space-y-4">
                  {[
                    { icon: Award, title: '10% Welcome Reward', desc: 'Get an automatic discount code sent to your inbox upon verification.' },
                    { icon: Truck, title: 'Carbon-Neutral Delivery', desc: 'Every single shipment is offset through local forest restoration partnerships.' },
                    { icon: Compass, title: 'Artisan Micro-funding', desc: '1% of every purchase directly supports rural craftspeople.' }
                  ].map((benefit, idx) => (
                    <div key={idx} className="flex gap-4 p-4 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-sm hover:bg-white/10 transition-colors">
                      <benefit.icon className="w-6 h-6 text-amber-300 flex-shrink-0" />
                      <div>
                        <h4 className="font-bold text-sm text-white">{benefit.title}</h4>
                        <p className="text-xs text-white/70 mt-0.5">{benefit.desc}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <>
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_80%,rgba(250,204,21,0.15),transparent_40%),linear-gradient(135deg,#034524_0%,#081e13_100%)]" />
                <div className="relative z-10 space-y-6">
                  <div className="inline-flex items-center rounded-full bg-white/10 px-4 py-1.5 text-xs font-semibold uppercase tracking-wider backdrop-blur border border-white/10">
                    <ShieldCheck className="mr-1.5 h-3.5 w-3.5 text-amber-300" />
                    Secure Access
                  </div>
                  <h1 className="text-4xl lg:text-5xl font-extrabold leading-tight tracking-tight text-white">
                    Welcome Back to Grevya.
                  </h1>
                  <p className="text-white/80 text-base leading-relaxed max-w-md">
                    Access your personalized dashboard, track local orders, and manage saved checkout addresses securely.
                  </p>
                </div>

                <div className="relative z-10 space-y-4">
                  {[
                    { icon: ShieldCheck, title: 'Certified Organic Standards', desc: 'All products pass rigorous eco-safety controls.' },
                    { icon: Sparkles, title: 'Artisanal Traceability', desc: 'Track exactly which rural community crafted your order.' },
                    { icon: Leaf, title: 'Zero Waste Operations', desc: 'We package exclusively with compostable starch fillers.' }
                  ].map((indicator, idx) => (
                    <div key={idx} className="flex gap-4 p-4 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-sm">
                      <indicator.icon className="w-6 h-6 text-amber-300 flex-shrink-0" />
                      <div>
                        <h4 className="font-bold text-sm text-white">{indicator.title}</h4>
                        <p className="text-xs text-white/70 mt-0.5">{indicator.desc}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
            
            <div className="relative z-10 text-xs text-white/40 flex justify-between border-t border-white/10 pt-4">
              <span>© {new Date().getFullYear()} Grevya Nature Corp</span>
              <span>100% Transparent Supply Chain</span>
            </div>
          </section>

          {/* Form Section */}
          <section className={`relative p-8 sm:p-12 lg:p-16 flex flex-col justify-center ${isSignup ? 'md:order-1' : 'md:order-2'}`}>
            {(loading || otpLoading) && (
              <div className="absolute inset-0 z-20 flex items-center justify-center bg-white/80 backdrop-blur-sm rounded-[2.5rem]">
                <div className="rounded-3xl bg-white px-6 py-5 text-center shadow-2xl border border-neutral-100 flex flex-col items-center">
                  <Loader2 className="h-8 w-8 animate-spin text-green-700 mb-2" />
                  <p className="text-sm font-semibold text-neutral-800">Securing your session...</p>
                </div>
              </div>
            )}

            <div className="mb-6">
              <h2 className="text-3xl font-extrabold text-neutral-900 tracking-tight">{pageCopy.title}</h2>
              <p className="mt-1.5 text-sm text-neutral-500">{pageCopy.subtitle}</p>
            </div>

            {(isLogin || isSignup) && (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <Button
                    type="button"
                    variant="outline"
                    disabled={loading || otpLoading}
                    onClick={() => handleSocialSignIn('google')}
                    className="h-12 rounded-xl border-neutral-200 hover:bg-neutral-50 transition-colors flex items-center justify-center gap-2 hover:border-green-600/30 text-neutral-700 font-semibold"
                  >
                    <Mail className="h-4 w-4 text-red-500" />
                    Google
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    disabled={loading || otpLoading}
                    onClick={() => handleSocialSignIn('apple')}
                    className="h-12 rounded-xl border-neutral-200 hover:bg-neutral-50 transition-colors flex items-center justify-center gap-2 hover:border-green-600/30 text-neutral-700 font-semibold"
                  >
                    <Apple className="h-4 w-4 text-black" />
                    Apple
                  </Button>
                </div>

                <div className="relative my-6">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-neutral-100"></div>
                  </div>
                  <div className="relative flex justify-center text-xs uppercase">
                    <span className="bg-white px-3 text-neutral-400 font-semibold tracking-wider">Or continue with</span>
                  </div>
                </div>
              </>
            )}

            <form className="space-y-4" onSubmit={handleSubmit}>
              {isSignup && (
                <div>
                  <Label htmlFor="name" className="text-neutral-700 font-medium text-xs uppercase tracking-wider">Full Name</Label>
                  <Input id="name" placeholder="E.g., Dhanesh Kumar" value={name} onChange={(event) => setName(event.target.value)} required className="mt-1.5 h-12 rounded-xl border-neutral-200 focus-visible:ring-green-700" />
                  {errors.name && <p className="mt-1 text-xs text-red-600">{errors.name}</p>}
                </div>
              )}
              
              {mode !== 'reset' && (
                <div>
                  <Label htmlFor="email" className="text-neutral-700 font-medium text-xs uppercase tracking-wider">Email Address</Label>
                  <Input id="email" type="email" placeholder="name@example.com" value={email} onChange={(event) => setEmail(event.target.value)} required className="mt-1.5 h-12 rounded-xl border-neutral-200 focus-visible:ring-green-700" />
                  {errors.email && <p className="mt-1 text-xs text-red-600">{errors.email}</p>}
                </div>
              )}

              {isSignup && (
                <div>
                  <Label htmlFor="phone" className="text-neutral-700 font-medium text-xs uppercase tracking-wider">Phone Number</Label>
                  <div className="relative mt-1.5">
                    <Phone className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
                    <Input
                      id="phone"
                      inputMode="numeric"
                      value={phone}
                      onChange={(event) => setPhone(event.target.value)}
                      placeholder="9876543210"
                      className="h-12 rounded-xl pl-10 border-neutral-200 focus-visible:ring-green-700"
                    />
                  </div>
                  {errors.phone && <p className="mt-1 text-xs text-red-600">{errors.phone}</p>}
                </div>
              )}

              {isLogin && (
                <div className="rounded-2xl border border-green-100 bg-green-50/20 p-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
                    <div className="flex-1">
                      <Label htmlFor="otpPhone" className="text-green-900 font-semibold text-xs uppercase tracking-wider">Mobile OTP Login</Label>
                      <Input
                        id="otpPhone"
                        inputMode="numeric"
                        value={phone}
                        onChange={(event) => setPhone(event.target.value)}
                        placeholder="9876543210"
                        className="mt-1.5 h-11 rounded-xl bg-white border-neutral-200"
                      />
                    </div>
                    <Button type="button" variant="outline" disabled={otpLoading || loading} onClick={handlePhoneOtp} className="h-11 rounded-xl border-green-700/20 hover:bg-green-50 text-green-800 font-semibold">
                      {otpLoading && !otpSent ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : null}
                      Send OTP
                    </Button>
                  </div>
                  {otpSent && (
                    <div className="mt-3 flex flex-col gap-3 sm:flex-row">
                      <Input
                        value={otp}
                        onChange={(event) => setOtp(event.target.value)}
                        placeholder="Enter verification code"
                        className="h-11 rounded-xl bg-white border-neutral-200"
                      />
                      <Button type="button" disabled={otpLoading || loading} onClick={handleVerifyPhoneOtp} className="h-11 rounded-xl bg-green-800 hover:bg-green-900">
                        {otpLoading ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : null}
                        Verify Code
                      </Button>
                    </div>
                  )}
                  {(errors.phone || errors.otp) && <p className="mt-2 text-xs text-red-600">{errors.phone || errors.otp}</p>}
                </div>
              )}

              {needsPassword && (
                <div>
                  <div className="flex justify-between items-center">
                    <Label htmlFor="password" className="text-neutral-700 font-medium text-xs uppercase tracking-wider">Password</Label>
                    {isLogin && <Link className="text-xs font-bold text-green-700 hover:text-green-800" to="/forgot-password">Forgot password?</Link>}
                  </div>
                  <div className="relative mt-1.5">
                    <Input
                      id="password"
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(event) => setPassword(event.target.value)}
                      minLength={isLogin ? 1 : 8}
                      required
                      className="h-12 rounded-xl pr-12 border-neutral-200 focus-visible:ring-green-700"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((value) => !value)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-green-800"
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                    >
                      {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                    </button>
                  </div>
                  {errors.password && <p className="mt-1 text-xs text-red-600">{errors.password}</p>}
                </div>
              )}

              {isSignup && (
                <div>
                  <Label htmlFor="confirmPassword" className="text-neutral-700 font-medium text-xs uppercase tracking-wider">Confirm Password</Label>
                  <Input
                    id="confirmPassword"
                    type={showPassword ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={(event) => setConfirmPassword(event.target.value)}
                    required
                    className="mt-1.5 h-12 rounded-xl border-neutral-200 focus-visible:ring-green-700"
                  />
                  {errors.confirmPassword && <p className="mt-1 text-xs text-red-600">{errors.confirmPassword}</p>}
                </div>
              )}

              {(isSignup || mode === 'reset') && (
                <div className="mt-3 p-4 rounded-xl border border-neutral-100 bg-neutral-50/50">
                  <span className="text-[10px] uppercase font-bold text-neutral-400 tracking-wider">Password Strength Requirements</span>
                  <div className="mt-2 grid grid-cols-2 gap-2 text-[11px] text-neutral-500">
                    {passwordChecks.map((check) => (
                      <span key={check.label} className={`flex items-center gap-1.5 transition-colors ${check.done ? 'text-green-700 font-semibold' : ''}`}>
                        <CheckCircle2 className={`h-3.5 w-3.5 ${check.done ? 'text-green-700' : 'text-neutral-300'}`} />
                        {check.label}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              <Button type="submit" disabled={loading || otpLoading} className="h-12 w-full rounded-xl bg-green-800 text-base font-bold hover:bg-green-900 shadow-lg shadow-green-900/10 mt-2">
                {loading && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
                {pageCopy.submit}
              </Button>
            </form>

            <div className="mt-6 text-center text-sm border-t border-neutral-100 pt-4">
              {isLogin && <span className="text-neutral-500">New to Grevya? <Link className="font-bold text-green-700 hover:text-green-800 hover:underline" to="/signup">Create an Account</Link></span>}
              {isSignup && <span className="text-neutral-500">Already have an account? <Link className="font-bold text-green-700 hover:text-green-800 hover:underline" to="/login">Sign In</Link></span>}
              {(mode === 'forgot' || mode === 'reset') && <Link className="font-bold text-green-700 hover:text-green-800" to="/login">Back to Login</Link>}
            </div>
          </section>
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default AuthPage;
