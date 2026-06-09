const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/i;
const phonePattern = /^[6-9]\d{9}$/;

export const normalizeEmail = (email: string) => email.trim().toLowerCase();
export const normalizePhone = (phone: string) => phone.replace(/\D/g, '');

export const getAuthRedirectUrl = (path: string) => {
  const configuredUrl = import.meta.env.VITE_APP_SITE_URL || window.location.origin;
  return `${configuredUrl.replace(/\/$/, '')}${path}`;
};

export const validateEmail = (email: string) => {
  const normalized = normalizeEmail(email);
  if (!normalized) return 'Enter your email address.';
  if (!emailPattern.test(normalized)) return 'Enter a valid email address, for example name@example.com.';
  return '';
};

export const validatePhone = (phone: string, required = false) => {
  const normalized = normalizePhone(phone);
  if (!normalized && !required) return '';
  if (!phonePattern.test(normalized)) return 'Enter a valid 10-digit Indian mobile number.';
  return '';
};

export const validatePassword = (password: string) => {
  if (!password) return 'Enter your password.';
  if (password.length < 8) return 'Use at least 8 characters.';
  if (!/[A-Z]/.test(password)) return 'Add at least one uppercase letter.';
  if (!/[a-z]/.test(password)) return 'Add at least one lowercase letter.';
  if (!/\d/.test(password)) return 'Add at least one number.';
  if (!/[^A-Za-z0-9]/.test(password)) return 'Add at least one symbol.';
  return '';
};

export const friendlyAuthError = (message = '') => {
  const lower = message.toLowerCase();

  if (lower.includes('email rate limit') || lower.includes('email rate exceeded') || lower.includes('rate limit')) {
    return 'Too many email attempts were made. Please wait a minute before trying again.';
  }
  if (lower.includes('invalid email')) {
    return 'That email address does not look valid. Please check it and try again.';
  }
  if (lower.includes('invalid login credentials')) {
    return 'The email or password is incorrect.';
  }
  if (lower.includes('email not confirmed')) {
    return 'Please confirm your email before signing in.';
  }
  if (lower.includes('already registered') || lower.includes('user already registered')) {
    return 'An account already exists for this email. Please sign in instead.';
  }
  if (lower.includes('otp') || lower.includes('token')) {
    return 'The verification code is invalid or expired. Please request a new one.';
  }
  if (lower.includes('session')) {
    return 'Your session expired. Please sign in again.';
  }
  if (lower.includes('password')) {
    return 'Your password does not meet the required strength. Please try a stronger one.';
  }
  if (lower.includes('network')) {
    return 'Network connection failed. Please check your connection and try again.';
  }

  return message || 'Something went wrong. Please try again.';
};
