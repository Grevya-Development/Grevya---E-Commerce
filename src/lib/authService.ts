import { supabase } from '@/lib/supabaseClient';
import { authDebug } from '@/lib/authDiagnostics';
import { getAuthRedirectUrl, normalizeEmail, normalizePhone } from '@/lib/authValidation';
import { ensureUserProfile, rememberPendingProfile } from '@/lib/profileSync';

export type AuthRole = 'buyer' | 'seller' | 'admin';

const locks = new Map<string, Promise<any>>();
const cooldowns = new Map<string, number>();

const withLock = async <T,>(key: string, action: () => Promise<T>) => {
  const existing = locks.get(key);
  if (existing) return existing as Promise<T>;

  const run = action().finally(() => locks.delete(key));
  locks.set(key, run);
  return run;
};

const assertCooldown = (key: string, ms: number) => {
  const until = cooldowns.get(key) || Number(localStorage.getItem(key) || 0);
  const remaining = until - Date.now();

  if (remaining > 0) {
    throw new Error(`Please wait ${Math.ceil(remaining / 1000)} seconds before trying again.`);
  }

  const nextUntil = Date.now() + ms;
  cooldowns.set(key, nextUntil);
  localStorage.setItem(key, String(nextUntil));
};

const roleAccessMessages: Record<AuthRole, string> = {
  buyer: 'Only buyer accounts can sign in here.',
  seller: 'Only seller accounts can sign in here.',
  admin: 'Only admin accounts can sign in here.',
};

const validateProfileRole = async (profile: any, requiredRole?: AuthRole) => {
  if (profile?.is_active === false) {
    await supabase.auth.signOut();
    throw new Error('Your account has been blocked. Please contact support.');
  }

  if (requiredRole && profile?.role !== requiredRole) {
    await supabase.auth.signOut();
    throw new Error(roleAccessMessages[requiredRole]);
  }
};

export const signInWithEmail = (email: string, password: string, requiredRole?: AuthRole) => {
  const normalizedEmail = normalizeEmail(email);
  return withLock(`login:${requiredRole || 'any'}:${normalizedEmail}`, async () => {
    authDebug('login.start');
    const result = await supabase.auth.signInWithPassword({ email: normalizedEmail, password });
    if (result.error) throw result.error;
    if (result.data.user) {
      const profile = await ensureUserProfile(result.data.user);
      await validateProfileRole(profile, requiredRole);
    }
    authDebug('login.success');
    return result.data;
  });
};

export const signUpWithEmail = (input: { email: string; password: string; fullName: string; phone?: string; role?: Extract<AuthRole, 'buyer' | 'seller'> }) => {
  const normalizedEmail = normalizeEmail(input.email);
  const normalizedPhone = normalizePhone(input.phone || '');
  const registrationRole = input.role === 'seller' ? 'seller' : 'buyer';

  return withLock(`signup:${registrationRole}:${normalizedEmail}`, async () => {
    assertCooldown(`grevya-auth-cooldown:signup:${normalizedEmail}`, 90000);
    authDebug('signup.start');

    const { data: { session: currentSession } } = await supabase.auth.getSession();
    const isAnonymous = currentSession?.user?.is_anonymous;

    let result;
    if (isAnonymous) {
      authDebug('signup.promote_anonymous');
      const updateResult = await supabase.auth.updateUser({
        email: normalizedEmail,
        password: input.password,
        data: {
          full_name: input.fullName.trim(),
          phone: normalizedPhone || null,
          registration_role: registrationRole,
        }
      });
      if (updateResult.error) throw updateResult.error;
      result = {
        data: {
          user: updateResult.data.user,
          session: currentSession
        }
      };
    } else {
      authDebug('signup.standard');
      const signUpResult = await supabase.auth.signUp({
        email: normalizedEmail,
        password: input.password,
        options: {
          data: {
            full_name: input.fullName.trim(),
            phone: normalizedPhone || null,
            registration_role: registrationRole,
          },
          emailRedirectTo: getAuthRedirectUrl(registrationRole === 'seller' ? '/seller/dashboard' : '/account'),
        },
      });
      if (signUpResult.error) throw signUpResult.error;
      result = signUpResult;
    }

    if (result.data.user) {
      rememberPendingProfile(result.data.user.id, {
        full_name: input.fullName.trim(),
        phone: normalizedPhone || null,
        role: registrationRole,
      });

      if (isAnonymous || result.data.session) {
        await ensureUserProfile(result.data.user, {
          full_name: input.fullName.trim(),
          phone: normalizedPhone || null,
          role: registrationRole,
        });
      }
    }

    authDebug('signup.success', { hasSession: Boolean(result.data.session) });
    return result.data;
  });
};

export const startOAuthSignIn = (provider: 'google' | 'apple', redirectPath = '/account') => {
  return withLock(`oauth:${provider}`, async () => {
    assertCooldown(`grevya-auth-cooldown:oauth:${provider}`, 5000);
    authDebug('oauth.start', { provider });

    const result = await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: getAuthRedirectUrl(redirectPath),
        skipBrowserRedirect: false,
      },
    });

    if (result.error) throw result.error;
    return result.data;
  });
};

export const requestPasswordReset = (email: string) => {
  const normalizedEmail = normalizeEmail(email);
  return withLock(`forgot:${normalizedEmail}`, async () => {
    assertCooldown(`grevya-auth-cooldown:forgot:${normalizedEmail}`, 60000);
    const result = await supabase.auth.resetPasswordForEmail(normalizedEmail, {
      redirectTo: getAuthRedirectUrl('/reset-password'),
    });
    if (result.error) throw result.error;
    return result.data;
  });
};

export const updateAuthPassword = (password: string) => {
  return withLock('reset-password', async () => {
    const result = await supabase.auth.updateUser({ password });
    if (result.error) throw result.error;
    
    if (result.data.user) {
      try {
        await supabase.from('notifications').insert({
          user_id: result.data.user.id,
          message: 'Your account password has been updated successfully.',
          type: 'security'
        });
      } catch (err) {
        console.warn('Security notification insertion failed:', err);
      }
    }
    
    return result.data;
  });
};

export const requestPhoneOtp = (phone: string) => {
  const normalizedPhone = `+91${normalizePhone(phone)}`;
  return withLock(`phone-otp:${normalizedPhone}`, async () => {
    assertCooldown(`grevya-auth-cooldown:phone:${normalizedPhone}`, 60000);
    const result = await supabase.auth.signInWithOtp({ phone: normalizedPhone });
    if (result.error) throw result.error;
    return result.data;
  });
};

export const verifyPhoneOtp = (phone: string, token: string, requiredRole?: AuthRole) => {
  const normalizedPhone = `+91${normalizePhone(phone)}`;
  return withLock(`phone-verify:${requiredRole || 'any'}:${normalizedPhone}`, async () => {
    const result = await supabase.auth.verifyOtp({ phone: normalizedPhone, token, type: 'sms' });
    if (result.error) throw result.error;
    if (result.data.user) {
      const profile = await ensureUserProfile(result.data.user, { phone: normalizePhone(phone) });
      await validateProfileRole(profile, requiredRole);
    }
    return result.data;
  });
};
