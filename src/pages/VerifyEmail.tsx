import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Mail, ArrowRight, CheckCircle2, Loader2, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/lib/supabaseClient';
import { toast } from '@/components/ui/use-toast';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import { motion } from 'framer-motion';
import { friendlyAuthError, getAuthRedirectUrl } from '@/lib/authValidation';

const VerifyEmail = () => {
  const location = useLocation();
  const email = (location.state as any)?.email || localStorage.getItem('grevya-signup-email') || '';
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

  const handleResend = async () => {
    if (!email) {
      toast({
        title: 'Email address missing',
        description: 'Please go back and sign up again or enter your email.',
        variant: 'destructive',
      });
      return;
    }

    if (cooldownSeconds > 0) {
      toast({
        title: 'Please wait',
        description: `You can request another verification link in ${cooldownSeconds} seconds.`,
        variant: 'destructive',
      });
      return;
    }

    setResending(true);
    try {
      const { error } = await supabase.auth.resend({
        type: 'signup',
        email: email,
        options: {
          emailRedirectTo: getAuthRedirectUrl('/account'),
        },
      });

      if (error) throw error;

      const cooldownTime = Date.now() + 60 * 1000;
      setCooldownSeconds(60);
      localStorage.setItem('grevya-resend-cooldown', String(cooldownTime));

      toast({
        title: 'Verification email sent',
        description: `We've sent a new confirmation link to ${email}.`,
      });
    } catch (error: any) {
      const errorMsg = error.message.toLowerCase();
      if (errorMsg.includes('rate limit') || errorMsg.includes('rate exceeded')) {
        const cooldownTime = Date.now() + 60 * 1000;
        setCooldownSeconds(60);
        localStorage.setItem('grevya-resend-cooldown', String(cooldownTime));
      }
      toast({
        title: 'Could not resend email',
        description: friendlyAuthError(error.message),
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
            We sent a secure validation link to {email ? <strong className="text-neutral-800">{email}</strong> : 'your email inbox'}. Click the link inside to activate your account.
          </p>

          <div className="space-y-4 mb-8 text-left rounded-2xl bg-green-50/50 p-5 border border-green-50">
            <h3 className="font-semibold text-green-900 text-sm uppercase tracking-wider mb-2">Next Steps</h3>
            <div className="flex items-start gap-3 text-sm text-neutral-600">
              <CheckCircle2 className="w-4 h-4 text-green-700 mt-0.5 flex-shrink-0" />
              <span>Open your email client and find our verification message.</span>
            </div>
            <div className="flex items-start gap-3 text-sm text-neutral-600">
              <CheckCircle2 className="w-4 h-4 text-green-700 mt-0.5 flex-shrink-0" />
              <span>Click the verification link to activate your account.</span>
            </div>
            <div className="flex items-start gap-3 text-sm text-neutral-600">
              <CheckCircle2 className="w-4 h-4 text-green-700 mt-0.5 flex-shrink-0" />
              <span>Return to the app and log in to your dashboard.</span>
            </div>
          </div>

          <div className="flex flex-col gap-3">
            <Button asChild className="h-12 rounded-xl bg-green-800 hover:bg-green-900 text-base font-bold w-full">
              <Link to="/login">
                Back to Sign In
                <ArrowRight className="ml-2 w-4 h-4" />
              </Link>
            </Button>

            {email && (
              <button
                onClick={handleResend}
                disabled={resending || cooldownSeconds > 0}
                className="mt-3 text-sm font-semibold text-green-700 hover:text-green-800 flex items-center justify-center gap-2 disabled:opacity-50 mx-auto"
              >
                {resending ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                {cooldownSeconds > 0 ? `Resend Link (retry in ${cooldownSeconds}s)` : 'Resend Verification Link'}
              </button>
            )}
          </div>
        </motion.div>
      </main>
      <Footer />
    </div>
  );
};

export default VerifyEmail;
