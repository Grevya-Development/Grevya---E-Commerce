import React, { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Mail, ArrowRight, CheckCircle2, Loader2, RefreshCw, KeyRound } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from '@/components/ui/use-toast';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import { motion } from 'framer-motion';
import { requestPasswordReset, verifyEmailVerificationCode } from '@/lib/authService';

const VerifyEmail = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const email = (location.state as any)?.email || localStorage.getItem('grevya-signup-email') || '';

  const [code, setCode] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [resending, setResending] = useState(false);
  const [cooldownSeconds, setCooldownSeconds] = useState(0);

  useEffect(() => {
    const stored = localStorage.getItem('grevya-resend-cooldown');
    if (stored) {
      const parsed = Number(stored);
      const remaining = Math.max(0, Math.ceil((parsed - Date.now()) / 1000));
      if (remaining > 0) {
        setCooldownSeconds(remaining);
      }
    }
  }, []);

  useEffect(() => {
    if (cooldownSeconds <= 0) return;
    const interval = setInterval(() => {
      setCooldownSeconds((prev) => {
        if (prev <= 1) {
          localStorage.removeItem('grevya-resend-cooldown');
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [cooldownSeconds]);

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code || code.trim().length !== 6) {
      toast({
        title: 'Invalid verification code',
        description: 'Please enter a valid 6-digit OTP code sent to your email.',
        variant: 'destructive',
      });
      return;
    }

    setVerifying(true);
    try {
      await verifyEmailVerificationCode(email, code.trim());
      toast({
        title: 'Email confirmed',
        description: 'Your account has been verified successfully.',
      });
      navigate('/account', { replace: true });
    } catch (error: any) {
      toast({
        title: 'Verification failed',
        description: error.message || 'The verification code is incorrect or expired.',
        variant: 'destructive',
      });
    } finally {
      setVerifying(false);
    }
  };

  const handleResend = async () => {
    if (!email) {
      toast({
        title: 'Email missing',
        description: 'Please sign up again to receive a fresh confirmation code.',
        variant: 'destructive',
      });
      return;
    }

    if (cooldownSeconds > 0) {
      toast({
        title: 'Please wait',
        description: `You can request another code in ${cooldownSeconds} seconds.`,
        variant: 'destructive',
      });
      return;
    }

    setResending(true);
    try {
      await requestPasswordReset(email);

      const cooldownTime = Date.now() + 60 * 1000;
      setCooldownSeconds(60);
      localStorage.setItem('grevya-resend-cooldown', String(cooldownTime));

      toast({
        title: 'Verification code sent',
        description: `We've sent a new 6-digit code to ${email}.`,
      });
    } catch (error: any) {
      toast({
        title: 'Could not resend code',
        description: error.message || 'Something went wrong while requesting a new code.',
        variant: 'destructive',
      });
    } finally {
      setResending(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col bg-cream/20">
      <Navbar />
      <main className="flex-grow flex items-center justify-center px-4 py-16">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="max-w-md w-full bg-white rounded-[2rem] border border-green-100 shadow-2xl p-8 sm:p-10 text-center"
        >
          <div className="mx-auto w-16 h-16 bg-green-50 rounded-full flex items-center justify-center text-green-700 mb-6">
            <Mail className="w-8 h-8" />
          </div>

          <h1 className="text-3xl font-extrabold text-neutral-900 mb-3">Confirm your email</h1>
          <p className="text-neutral-500 mb-6">
            We sent a 6-digit confirmation code to {email ? <strong className="text-neutral-800">{email}</strong> : 'your email inbox'}. Enter it below to activate your account.
          </p>

          <form onSubmit={handleVerify} className="space-y-6 mb-6">
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-neutral-400">
                <KeyRound className="w-5 h-5" />
              </div>
              <input
                type="text"
                maxLength={6}
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
                placeholder="Enter 6-digit OTP"
                className="block w-full h-12 pl-11 pr-4 rounded-xl border border-neutral-200 focus:border-green-600 focus:ring-1 focus:ring-green-600 text-neutral-900 text-center font-mono text-xl tracking-[0.3em] font-bold outline-none transition-all placeholder:text-neutral-300 placeholder:text-base placeholder:tracking-normal placeholder:font-normal"
                required
              />
            </div>

            <Button
              type="submit"
              disabled={verifying}
              className="h-12 rounded-xl bg-green-800 hover:bg-green-900 text-base font-bold w-full flex items-center justify-center gap-2"
            >
              {verifying ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Verifying...
                </>
              ) : (
                <>
                  Verify Code
                  <ArrowRight className="w-5 h-5" />
                </>
              )}
            </Button>
          </form>

          <div className="space-y-3">
            {email && (
              <button
                onClick={handleResend}
                disabled={resending || cooldownSeconds > 0}
                className="text-sm font-semibold text-green-700 hover:text-green-800 flex items-center justify-center gap-2 disabled:opacity-50 mx-auto"
              >
                {resending ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                {cooldownSeconds > 0 ? `Resend Code (retry in ${cooldownSeconds}s)` : 'Resend Verification Code'}
              </button>
            )}

            <Button asChild variant="ghost" className="text-neutral-500 hover:text-neutral-800 text-sm font-semibold h-10 w-full rounded-xl">
              <Link to="/login">
                Back to Sign In
              </Link>
            </Button>
          </div>
        </motion.div>
      </main>
      <Footer />
    </div>
  );
};

export default VerifyEmail;
