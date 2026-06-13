import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Bell, Heart, Home, Loader2, LogOut, MapPin, Package, Shield, UserRound } from 'lucide-react';
import { motion } from 'framer-motion';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { toast } from '@/components/ui/use-toast';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabaseClient';
import { friendlyAuthError, getAuthRedirectUrl } from '@/lib/authValidation';

interface Address {
  id: string;
  label: string;
  full_name: string;
  phone: string;
  address_line1: string;
  city: string;
  state: string;
  pincode: string;
  is_default: boolean;
}

const Account = () => {
  const { user, profile, refreshProfile, signOut } = useAuth();
  const [saving, setSaving] = useState(false);
  const [orders, setOrders] = useState<any[]>([]);
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [editingAddressId, setEditingAddressId] = useState<string | null>(null);
  const [form, setForm] = useState({
    username: '',
    full_name: '',
    phone: '',
    email: '',
    marketing: true,
    order_updates: true,
  });
  const [addressForm, setAddressForm] = useState({
    label: 'Home',
    full_name: '',
    phone: '',
    address_line1: '',
    address_line2: '',
    city: '',
    state: '',
    pincode: '',
    postal_code: '',
    landmark: '',
  });
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [updatingPass, setUpdatingPass] = useState(false);
  const [failedAttempts, setFailedAttempts] = useState(0);
  const [blockUntil, setBlockUntil] = useState<number | null>(null);
  const [emailCooldownUntil, setEmailCooldownUntil] = useState<number | null>(null);
  const [emailCooldownSeconds, setEmailCooldownSeconds] = useState(0);
  const [dismissedPendingEmail, setDismissedPendingEmail] = useState<string | null>(null);

  useEffect(() => {
    if (user) {
      const dismissed = localStorage.getItem(`grevya-dismiss-pending-email:${user.id}`);
      setDismissedPendingEmail(dismissed);
    }
  }, [user]);

  useEffect(() => {
    const stored = localStorage.getItem('grevya-email-cooldown');
    if (stored) {
      const parsed = Number(stored);
      if (parsed > Date.now()) {
        setEmailCooldownUntil(parsed);
      }
    }
  }, []);

  useEffect(() => {
    if (!emailCooldownUntil) {
      setEmailCooldownSeconds(0);
      return;
    }

    const updateTimer = () => {
      const remaining = Math.max(0, Math.ceil((emailCooldownUntil - Date.now()) / 1000));
      setEmailCooldownSeconds(remaining);
      if (remaining === 0) {
        setEmailCooldownUntil(null);
        localStorage.removeItem('grevya-email-cooldown');
      }
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [emailCooldownUntil]);

  const getPasswordStrength = (pass: string) => {
    if (!pass) return '';
    if (pass.length < 6) return 'Weak (min 6 characters)';
    const hasLetter = /[a-zA-Z]/.test(pass);
    const hasNumber = /[0-9]/.test(pass);
    const hasSpecial = /[^a-zA-Z0-9]/.test(pass);
    const score = [hasLetter, hasNumber, hasSpecial].filter(Boolean).length;
    if (score === 1) return 'Weak';
    if (score === 2) return 'Medium';
    return 'Strong';
  };

  useEffect(() => {
    if (!profile && !user) return;
    setForm({
      username: profile?.username || '',
      full_name: profile?.full_name || user?.user_metadata?.full_name || '',
      phone: profile?.phone || '',
      email: profile?.email || user?.email || '',
      marketing: profile?.preferences?.marketing ?? true,
      order_updates: profile?.preferences?.order_updates ?? true,
    });
  }, [profile, user]);

  useEffect(() => {
    const fetchAccountData = async () => {
      if (!user) return;

      const [{ data: orderRows }, { data: addressRows }] = await Promise.all([
        supabase
          .from('orders')
          .select('id, created_at, total_amount, status, payment_status')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
          .limit(5),
        supabase
          .from('addresses')
          .select('*')
          .eq('user_id', user.id)
          .order('is_default', { ascending: false }),
      ]);

      const parseAddressLabelAndLine = (addressLine1: string) => {
        const match = (addressLine1 || '').match(/^\[(.*?)\]\s*(.*)$/);
        if (match) {
          return { label: match[1], cleanLine1: match[2] };
        }
        return { label: 'Home', cleanLine1: addressLine1 };
      };

      setOrders(orderRows || []);
      setAddresses(((addressRows || []) as any[]).map(addr => {
        const line1 = addr.address_line_1 || addr.address_line1 || '';
        const { label, cleanLine1 } = parseAddressLabelAndLine(line1);
        return {
          ...addr,
          label,
          address_line1: cleanLine1,
          address_line2: addr.address_line_2 || addr.address_line2 || '',
          pincode: addr.postal_code || addr.pincode || '',
          postal_code: addr.postal_code || addr.pincode || '',
        };
      }) as Address[]);
    };

    fetchAccountData();
  }, [user]);

  const safeUpsertProfile = async (profileData: any) => {
    let attemptData = { ...profileData };
    while (true) {
      const { error } = await supabase.from('profiles').upsert({
        id: user.id,
        ...attemptData
      });

      if (!error) {
        return { error: null };
      }

      const errorMsg = error.message || '';
      const matchSchemaCache = errorMsg.match(/Could not find the '([^']+)' column/);
      const matchNotExist = errorMsg.match(/column "([^"]+)" of relation "[^"]+" does not exist/);
      const missingColumn = (matchSchemaCache && matchSchemaCache[1]) || (matchNotExist && matchNotExist[1]);

      if (missingColumn && missingColumn in attemptData) {
        console.warn(`[Grevya Dev Resilience] Column '${missingColumn}' not found in profiles database. Retrying profile save without it.`);
        delete attemptData[missingColumn];
        if (Object.keys(attemptData).length === 0) {
          return { error };
        }
        continue;
      }

      return { error };
    }
  };

  const updateProfile = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!user) return;
    setSaving(true);

    try {
      const payload = {
        username: form.username.trim() || null,
        full_name: form.full_name.trim() || null,
        phone: form.phone.trim() || null,
        email: form.email.trim() || null,
        preferences: {
          marketing: form.marketing,
          order_updates: form.order_updates,
        },
      };

      // 1. Update the database profiles table
      const { error } = await safeUpsertProfile(payload);
      if (error) throw error;

      // 2. Update auth metadata and email (if changed) so they stay in sync
      const authUpdates: any = {
        data: {
          full_name: form.full_name.trim() || null,
          phone: form.phone.trim() || null,
        }
      };

      const emailChanged = form.email && form.email.trim() !== user.email;
      if (emailChanged) {
        // Check email change cooldown first!
        if (emailCooldownSeconds > 0) {
          toast({
            title: 'Please wait',
            description: `You can request another email change in ${emailCooldownSeconds} seconds.`,
            variant: 'destructive',
          });
          setSaving(false);
          return;
        }

        // Clear dismissed state for new email requests
        if (user) {
          localStorage.removeItem(`grevya-dismiss-pending-email:${user.id}`);
        }
        setDismissedPendingEmail(null);

        authUpdates.email = form.email.trim();
      }

      const { error: authError } = await supabase.auth.updateUser(
        authUpdates,
        { emailRedirectTo: getAuthRedirectUrl('/account') }
      );
      if (authError) {
        const errorMsg = authError.message.toLowerCase();
        if (errorMsg.includes('rate limit') || errorMsg.includes('rate exceeded')) {
          const cooldownTime = Date.now() + 60 * 1000;
          setEmailCooldownUntil(cooldownTime);
          localStorage.setItem('grevya-email-cooldown', String(cooldownTime));
        }
        throw authError;
      }

      if (emailChanged) {
        const cooldownTime = Date.now() + 60 * 1000;
        setEmailCooldownUntil(cooldownTime);
        localStorage.setItem('grevya-email-cooldown', String(cooldownTime));

        toast({
          title: 'Email verification pending',
          description: 'A confirmation link has been sent to your new email. Please verify it to update your address.',
        });
      } else {
        toast({ title: 'Profile saved', description: 'Your account details are up to date.' });
      }

      await refreshProfile();
    } catch (error: any) {
      toast({
        title: 'Could not save profile',
        description: friendlyAuthError(error.message),
        variant: 'destructive'
      });
    } finally {
      setSaving(false);
    }
  };

  const resendEmailVerification = async () => {
    if (!user) return;
    if (emailCooldownSeconds > 0) return;

    const isEmailChange = !!user.new_email;
    const targetEmail = isEmailChange ? user.new_email : user.email;
    const resendType = isEmailChange ? 'email_change' : 'signup';

    if (!targetEmail) return;

    setSaving(true);
    try {
      const { error } = await supabase.auth.resend({
        type: resendType,
        email: targetEmail,
        options: {
          emailRedirectTo: getAuthRedirectUrl('/account'),
        },
      });

      if (error) {
        const errorMsg = error.message.toLowerCase();
        if (errorMsg.includes('rate limit') || errorMsg.includes('rate exceeded')) {
          const cooldownTime = Date.now() + 60 * 1000;
          setEmailCooldownUntil(cooldownTime);
          localStorage.setItem('grevya-email-cooldown', String(cooldownTime));
        }
        throw error;
      }

      const cooldownTime = Date.now() + 60 * 1000;
      setEmailCooldownUntil(cooldownTime);
      localStorage.setItem('grevya-email-cooldown', String(cooldownTime));

      toast({
        title: 'Verification email resent',
        description: `A new confirmation link has been sent to ${targetEmail}.`,
      });
    } catch (err: any) {
      toast({
        title: 'Failed to resend email',
        description: friendlyAuthError(err.message),
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const cancelEmailChange = () => {
    if (!user || !user.new_email) return;
    
    // Dismiss the pending email change banner locally
    localStorage.setItem(`grevya-dismiss-pending-email:${user.id}`, user.new_email);
    setDismissedPendingEmail(user.new_email);
    
    // Reset the local form email field back to the current confirmed email
    setForm((prev) => ({ ...prev, email: user.email || '' }));
    
    toast({
      title: 'Pending email change dismissed',
      description: 'The verification warning has been hidden. It will remain hidden unless a new request is started.',
    });
  };

  const uploadAvatar = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !user) return;

    const extension = file.name.split('.').pop();
    const path = `${user.id}/avatar-${Date.now()}.${extension}`;
    
    let bucket = 'profile-images';
    let uploadResult = await supabase.storage.from(bucket).upload(path, file, { upsert: true });

    if (uploadResult.error && uploadResult.error.message.includes('Bucket not found')) {
      console.warn(`[Grevya Dev Resilience] Bucket 'profile-images' not found. Falling back to 'avatars' bucket.`);
      bucket = 'avatars';
      uploadResult = await supabase.storage.from(bucket).upload(path, file, { upsert: true });
    }

    if (uploadResult.error) {
      toast({
        title: 'Upload failed',
        description: `Storage bucket not found. Please run the recovery_schema.sql in your Supabase SQL Editor to initialize the storage buckets.`,
        variant: 'destructive'
      });
      return;
    }

    const { data } = supabase.storage.from(bucket).getPublicUrl(path);
    const avatarUrl = `${data.publicUrl}?t=${Date.now()}`;
    const { error } = await safeUpsertProfile({ avatar_url: avatarUrl });

    if (error) {
      toast({ title: 'Could not save avatar', description: error.message, variant: 'destructive' });
      return;
    }

    await refreshProfile();
    toast({ title: 'Profile image updated' });
  };

  const startEditAddress = (address: Address) => {
    setEditingAddressId(address.id);
    setAddressForm({
      label: address.label || 'Home',
      full_name: address.full_name,
      phone: address.phone,
      address_line1: address.address_line1 || (address as any).address_line_1 || '',
      address_line2: (address as any).address_line2 || (address as any).address_line_2 || '',
      city: address.city,
      state: address.state,
      pincode: address.pincode || (address as any).postal_code || '',
      postal_code: (address as any).postal_code || address.pincode || '',
      landmark: (address as any).landmark || '',
    });
  };

  const cancelEditAddress = () => {
    setEditingAddressId(null);
    setAddressForm({
      label: 'Home',
      full_name: '',
      phone: '',
      address_line1: '',
      address_line2: '',
      city: '',
      state: '',
      pincode: '',
      postal_code: '',
      landmark: '',
    });
  };

  const deleteAddress = async (id: string) => {
    if (!user) return;
    const addressToDelete = addresses.find((addr) => addr.id === id);
    const { error } = await supabase.from('addresses').delete().eq('id', id).eq('user_id', user.id);
    if (error) {
      toast({ title: 'Delete failed', description: error.message, variant: 'destructive' });
      return;
    }
    const remaining = addresses.filter((addr) => addr.id !== id);
    setAddresses(remaining);
    toast({ title: 'Address deleted' });

    if (addressToDelete?.is_default && remaining.length > 0) {
      await setDefaultAddress(remaining[0].id);
    }
  };

  const setDefaultAddress = async (id: string) => {
    if (!user) return;
    try {
      const { error: resetError } = await supabase
        .from('addresses')
        .update({ is_default: false })
        .eq('user_id', user.id);
      if (resetError) throw resetError;

      const { error: setError } = await supabase
        .from('addresses')
        .update({ is_default: true })
        .eq('id', id)
        .eq('user_id', user.id);
      if (setError) throw setError;

      setAddresses((current) =>
        current.map((addr) => ({ ...addr, is_default: addr.id === id }))
      );
      toast({ title: 'Default address updated' });
    } catch (error: any) {
      toast({ title: 'Update failed', description: error.message, variant: 'destructive' });
    }
  };

  const saveAddress = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!user) return;

    const phonePattern = /^[6-9]\d{9}$/;
    const cleanPhone = addressForm.phone.replace(/\D/g, '');
    if (!phonePattern.test(cleanPhone)) {
      toast({
        title: 'Invalid phone number',
        description: 'Enter a valid 10-digit Indian mobile number.',
        variant: 'destructive',
      });
      return;
    }

    const pincodePattern = /^\d{6}$/;
    const cleanPincode = addressForm.pincode.replace(/\D/g, '');
    if (!pincodePattern.test(cleanPincode)) {
      toast({
        title: 'Invalid PIN code',
        description: 'Enter a valid 6-digit postal code.',
        variant: 'destructive',
      });
      return;
    }

    const labelTag = addressForm.label ? `[${addressForm.label}] ` : '';
    const payload = {
      full_name: addressForm.full_name,
      phone: cleanPhone,
      address_line_1: labelTag + addressForm.address_line1,
      address_line_2: addressForm.address_line2 + (addressForm.landmark ? `, Landmark: ${addressForm.landmark}` : ''),
      city: addressForm.city,
      state: addressForm.state,
      postal_code: cleanPincode,
      country: 'India',
    };

    const parseAddressLabelAndLine = (addressLine1: string) => {
      const match = (addressLine1 || '').match(/^\[(.*?)\]\s*(.*)$/);
      if (match) {
        return { label: match[1], cleanLine1: match[2] };
      }
      return { label: 'Home', cleanLine1: addressLine1 };
    };

    if (editingAddressId) {
      const { data, error } = await supabase
        .from('addresses')
        .update(payload)
        .eq('id', editingAddressId)
        .eq('user_id', user.id)
        .select()
        .single();

      if (error) {
        toast({ title: 'Address not updated', description: error.message, variant: 'destructive' });
        return;
      }

      const formattedData = {
        ...(data as any),
        label: parseAddressLabelAndLine((data as any).address_line_1 || (data as any).address_line1 || '').label,
        address_line1: parseAddressLabelAndLine((data as any).address_line_1 || (data as any).address_line1 || '').cleanLine1,
        address_line2: (data as any).address_line_2 || (data as any).address_line2 || '',
        pincode: (data as any).postal_code || (data as any).pincode || '',
        postal_code: (data as any).postal_code || (data as any).pincode || '',
      };

      setAddresses((current) =>
        current.map((addr) => (addr.id === editingAddressId ? (formattedData as Address) : addr))
      );
      cancelEditAddress();
      toast({ title: 'Address updated' });
    } else {
      const { data, error } = await supabase
        .from('addresses')
        .insert({ ...payload, user_id: user.id, is_default: addresses.length === 0 })
        .select()
        .single();

      if (error) {
        toast({ title: 'Address not saved', description: error.message, variant: 'destructive' });
        return;
      }

      const formattedData = {
        ...(data as any),
        label: parseAddressLabelAndLine((data as any).address_line_1 || (data as any).address_line1 || '').label,
        address_line1: parseAddressLabelAndLine((data as any).address_line_1 || (data as any).address_line1 || '').cleanLine1,
        address_line2: (data as any).address_line_2 || (data as any).address_line2 || '',
        pincode: (data as any).postal_code || (data as any).pincode || '',
        postal_code: (data as any).postal_code || (data as any).pincode || '',
      };

      setAddresses((current) => [formattedData as Address, ...current]);
      cancelEditAddress();
      toast({ title: 'Address saved', description: 'It is ready for your next checkout.' });
    }
  };

  const updatePassword = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!user) return;

    if (blockUntil && Date.now() < blockUntil) {
      const remainingSecs = Math.ceil((blockUntil - Date.now()) / 1000);
      toast({
        title: 'Too many attempts',
        description: `Please wait ${remainingSecs} seconds before trying again.`,
        variant: 'destructive',
      });
      return;
    }

    if (newPassword.length < 6) {
      toast({ title: 'Weak password', description: 'Password must be at least 6 characters long.', variant: 'destructive' });
      return;
    }

    if (newPassword !== confirmPassword) {
      toast({ title: 'Mismatched passwords', description: 'New password and confirmation do not match.', variant: 'destructive' });
      return;
    }

    setUpdatingPass(true);

    try {
      const { error: verifyError } = await supabase.auth.signInWithPassword({
        email: user.email!,
        password: currentPassword,
      });

      if (verifyError) {
        const attempts = failedAttempts + 1;
        setFailedAttempts(attempts);
        if (attempts >= 3) {
          const blockTime = Date.now() + 5 * 60 * 1000;
          setBlockUntil(blockTime);
          setFailedAttempts(0);
          toast({
            title: 'Account locked temporarily',
            description: 'Too many incorrect attempts. Password updating blocked for 5 minutes.',
            variant: 'destructive',
          });
        } else {
          toast({
            title: 'Verification failed',
            description: 'Incorrect current password. Please try again.',
            variant: 'destructive',
          });
        }
        return;
      }

      const { error: updateError } = await supabase.auth.updateUser({ password: newPassword });
      if (updateError) throw updateError;

      // Force refresh the session tokens to avoid auth desync/stale session states
      try {
        await supabase.auth.refreshSession();
      } catch (refreshErr) {
        console.warn('Failed to force refresh session after password update:', refreshErr);
      }

      await refreshProfile();

      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setFailedAttempts(0);
      toast({ title: 'Password updated', description: 'Your password has been changed successfully.' });
    } catch (err: any) {
      toast({ title: 'Password update failed', description: err.message, variant: 'destructive' });
    } finally {
      setUpdatingPass(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col">
      <Navbar />
      <main className="flex-grow bg-cream/30 py-10">
        <div className="container mx-auto px-4">
          <motion.div
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-8 overflow-hidden rounded-[2rem] bg-green-900 p-6 text-white shadow-xl shadow-green-900/15 md:p-8"
          >
            <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
              <div className="flex items-center gap-4">
                <Avatar className="h-20 w-20 border-4 border-white/20">
                  <AvatarImage src={profile?.avatar_url || undefined} />
                  <AvatarFallback className="bg-green-100 text-xl font-bold text-green-900">
                    {(form.full_name || form.email || 'G').slice(0, 1).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <p className="text-sm font-semibold uppercase tracking-[0.2em] text-clay">My Account</p>
                  <h1 className="text-3xl font-extrabold">{form.full_name || 'Grevya Customer'}</h1>
                  <p className="text-white/70">{form.email}</p>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3 text-center">
                <div className="rounded-2xl bg-white/10 p-4">
                  <p className="text-2xl font-bold">{orders.length}</p>
                  <p className="text-xs text-white/70">Recent orders</p>
                </div>
                <div className="rounded-2xl bg-white/10 p-4">
                  <p className="text-2xl font-bold">{addresses.length}</p>
                  <p className="text-xs text-white/70">Addresses</p>
                </div>
                <div className="rounded-2xl bg-white/10 p-4">
                  <p className="text-2xl font-bold capitalize">{profile?.role || 'Customer'}</p>
                  <p className="text-xs text-white/70">Account role</p>
                </div>
              </div>
            </div>
          </motion.div>

          <Tabs defaultValue="overview" className="space-y-6">
            <TabsList className="flex h-auto w-full flex-wrap justify-start rounded-2xl bg-white p-2 shadow-sm">
              <TabsTrigger value="overview"><Home className="mr-2 h-4 w-4" />Overview</TabsTrigger>
              <TabsTrigger value="profile"><UserRound className="mr-2 h-4 w-4" />Profile</TabsTrigger>
              <TabsTrigger value="addresses"><MapPin className="mr-2 h-4 w-4" />Addresses</TabsTrigger>
              <TabsTrigger value="preferences"><Bell className="mr-2 h-4 w-4" />Preferences</TabsTrigger>
            </TabsList>

            <TabsContent value="overview">
              <div className="grid gap-6 lg:grid-cols-[1.4fr_0.8fr]">
                <section className="rounded-2xl bg-white p-6 shadow-sm">
                  <div className="mb-4 flex items-center justify-between">
                    <h2 className="text-xl font-bold text-neutral-900">Recent orders</h2>
                    <Button asChild variant="outline" className="rounded-xl">
                      <Link to="/orders">View all</Link>
                    </Button>
                  </div>
                  <div className="space-y-3">
                    {orders.length === 0 ? (
                      <div className="rounded-2xl bg-neutral-50 p-8 text-center text-neutral-500">
                        <Package className="mx-auto mb-3 h-10 w-10 text-green-700" />
                        No orders yet.
                      </div>
                    ) : orders.map((order) => (
                      <Link key={order.id} to={`/orders/${order.id}`} className="flex items-center justify-between rounded-2xl border border-neutral-100 p-4 transition hover:border-green-200 hover:bg-green-50/40">
                        <div>
                          <p className="font-bold text-neutral-900">#{String(order.id).slice(0, 8)}</p>
                          <p className="text-sm text-neutral-500">{new Date(order.created_at).toLocaleDateString()}</p>
                        </div>
                        <div className="text-right">
                          <p className="font-bold text-green-800">Rs {Number(order.total_amount || 0).toFixed(2)}</p>
                          <p className="text-sm capitalize text-neutral-500">{order.status || order.order_status || 'pending'}</p>
                        </div>
                      </Link>
                    ))}
                  </div>
                </section>

                <section className="grid gap-4">
                  {[
                    { icon: Heart, title: 'Wishlist', value: 'Saved product sync ready' },
                    { icon: Shield, title: 'Payment methods', value: 'Razorpay-ready placeholder' },
                    { icon: MapPin, title: 'Default address', value: addresses[0]?.address_line1 || 'Add one below' },
                  ].map((item) => (
                    <div key={item.title} className="rounded-2xl bg-white p-5 shadow-sm">
                      <item.icon className="mb-3 h-6 w-6 text-green-800" />
                      <h3 className="font-bold text-neutral-900">{item.title}</h3>
                      <p className="text-sm text-neutral-500">{item.value}</p>
                    </div>
                  ))}
                </section>
              </div>
            </TabsContent>

            <TabsContent value="profile">
              <div className="space-y-6">
                <form onSubmit={updateProfile} className="rounded-2xl bg-white p-6 shadow-sm border border-neutral-150/40">
                  <h2 className="mb-4 text-xl font-bold text-neutral-900 font-serif">Account Details</h2>
                  <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center">
                    <Avatar className="h-16 w-16">
                      <AvatarImage src={profile?.avatar_url || undefined} />
                      <AvatarFallback className="bg-green-100 text-green-900 font-bold">
                        {(form.full_name || form.email || 'G').slice(0, 1).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <Label htmlFor="avatar">Profile image</Label>
                      <Input id="avatar" type="file" accept="image/*" onChange={uploadAvatar} className="mt-2" />
                    </div>
                  </div>
                  <div className="grid gap-4 md:grid-cols-2">
                    <div><Label>Full name</Label><Input value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} className="mt-2" /></div>
                    <div><Label>Username</Label><Input value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} className="mt-2" /></div>
                    <div>
                      <Label htmlFor="profileEmail">Email</Label>
                      <Input
                        id="profileEmail"
                        type="email"
                        value={form.email}
                        onChange={(e) => setForm({ ...form, email: e.target.value })}
                        className="mt-2"
                      />
                      {emailCooldownSeconds > 0 && (
                        <p className="text-xs text-amber-600 mt-1 font-semibold">
                          Email cooldown active: retry in {emailCooldownSeconds}s.
                        </p>
                      )}
                      {user?.new_email && user.new_email !== dismissedPendingEmail ? (
                        <div className="mt-3 rounded-2xl bg-amber-50 border border-amber-200/60 p-4 text-amber-900 text-sm">
                          <p className="font-semibold">Verification Pending</p>
                          <p className="text-xs text-neutral-600 mt-1">
                            A confirmation link was sent to <strong className="text-amber-950">{user.new_email}</strong>. Please confirm it to finalize your email change.
                          </p>
                          <div className="mt-3 flex gap-2">
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              disabled={saving || emailCooldownSeconds > 0}
                              onClick={resendEmailVerification}
                              className="h-8 rounded-xl text-xs bg-white text-amber-900 border-amber-200 hover:bg-amber-50"
                            >
                              Resend Verification
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              disabled={saving}
                              onClick={cancelEmailChange}
                              className="h-8 rounded-xl text-xs text-amber-900 hover:bg-amber-100 hover:text-amber-950"
                            >
                              Cancel Request
                            </Button>
                          </div>
                        </div>
                      ) : (
                        user && !user.email_confirmed_at && (
                          <div className="mt-3 rounded-2xl bg-amber-50 border border-amber-200/60 p-4 text-amber-900 text-sm">
                            <p className="font-semibold">Email Not Verified</p>
                            <p className="text-xs text-neutral-600 mt-1">
                              Your email address <strong className="text-amber-950">{user.email}</strong> is not verified yet. Please check your inbox for the confirmation link.
                            </p>
                            <div className="mt-3 flex gap-2">
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                disabled={saving || emailCooldownSeconds > 0}
                                onClick={resendEmailVerification}
                                className="h-8 rounded-xl text-xs bg-white text-amber-900 border-amber-200 hover:bg-amber-50"
                              >
                                Resend Verification Email
                              </Button>
                            </div>
                          </div>
                        )
                      )}
                    </div>
                    <div><Label>Phone</Label><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="mt-2" /></div>
                  </div>
                  <Button type="submit" disabled={saving} className="mt-6 rounded-xl bg-green-800 hover:bg-green-900">
                    {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Save profile
                  </Button>
                </form>

                <form onSubmit={updatePassword} className="rounded-2xl bg-white p-6 shadow-sm border border-neutral-150/40">
                  <h2 className="mb-4 text-xl font-bold text-neutral-900 font-serif">Change Password</h2>
                  <div className="grid gap-4 md:grid-cols-1">
                    <div>
                      <Label htmlFor="currentPassword">Current Password</Label>
                      <Input
                        id="currentPassword"
                        type="password"
                        required
                        autoComplete="current-password"
                        value={currentPassword}
                        onChange={(e) => setCurrentPassword(e.target.value)}
                        className="mt-2"
                      />
                    </div>
                    <div>
                      <Label htmlFor="newPassword">New Password</Label>
                      <Input
                        id="newPassword"
                        type="password"
                        required
                        autoComplete="new-password"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        className="mt-2"
                      />
                      {newPassword && (
                        <p className={`text-xs mt-1 font-semibold ${
                          getPasswordStrength(newPassword).startsWith('Weak')
                            ? 'text-red-500'
                            : getPasswordStrength(newPassword) === 'Medium'
                            ? 'text-yellow-600'
                            : 'text-green-700'
                        }`}>
                          Strength: {getPasswordStrength(newPassword)}
                        </p>
                      )}
                    </div>
                    <div>
                      <Label htmlFor="confirmPassword">Confirm New Password</Label>
                      <Input
                        id="confirmPassword"
                        type="password"
                        required
                        autoComplete="new-password"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        className="mt-2"
                      />
                      {confirmPassword && newPassword !== confirmPassword && (
                        <p className="text-xs text-red-500 mt-1 font-semibold">Passwords do not match.</p>
                      )}
                    </div>
                  </div>
                  <div className="mt-6 flex items-center gap-3">
                    <Button
                      type="submit"
                      disabled={updatingPass || !currentPassword || !newPassword || newPassword !== confirmPassword || getPasswordStrength(newPassword).startsWith('Weak')}
                      className="rounded-xl bg-green-800 hover:bg-green-900"
                    >
                      {updatingPass && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      Update password
                    </Button>
                    <Button type="button" variant="outline" className="rounded-xl border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700 ml-auto" onClick={signOut}>
                      <LogOut className="mr-2 h-4 w-4" />
                      Sign Out
                    </Button>
                  </div>
                </form>
              </div>
            </TabsContent>

            <TabsContent value="addresses">
              <div className="grid gap-6 lg:grid-cols-2">
                <form onSubmit={saveAddress} className="rounded-2xl bg-white p-6 shadow-sm">
                  <h2 className="mb-4 text-xl font-bold">{editingAddressId ? 'Edit address' : 'Add address'}</h2>
                  <div className="grid gap-4 md:grid-cols-2">
                    <div><Label>Label</Label><Input value={addressForm.label} onChange={(e) => setAddressForm({ ...addressForm, label: e.target.value })} className="mt-2" /></div>
                    <div><Label>Full name</Label><Input required value={addressForm.full_name} onChange={(e) => setAddressForm({ ...addressForm, full_name: e.target.value })} className="mt-2" /></div>
                    <div><Label>Phone</Label><Input required value={addressForm.phone} onChange={(e) => setAddressForm({ ...addressForm, phone: e.target.value })} className="mt-2" /></div>
                    <div><Label>Pincode / Postal Code</Label><Input required value={addressForm.pincode} onChange={(e) => setAddressForm({ ...addressForm, pincode: e.target.value, postal_code: e.target.value })} className="mt-2" /></div>
                    <div><Label>City</Label><Input required value={addressForm.city} onChange={(e) => setAddressForm({ ...addressForm, city: e.target.value })} className="mt-2" /></div>
                    <div><Label>State</Label><Input required value={addressForm.state} onChange={(e) => setAddressForm({ ...addressForm, state: e.target.value })} className="mt-2" /></div>
                    <div className="md:col-span-2"><Label>Address Line 1</Label><Input required value={addressForm.address_line1} onChange={(e) => setAddressForm({ ...addressForm, address_line1: e.target.value })} className="mt-2" /></div>
                    <div className="md:col-span-2"><Label>Address Line 2 (Optional)</Label><Input value={addressForm.address_line2} onChange={(e) => setAddressForm({ ...addressForm, address_line2: e.target.value })} className="mt-2" /></div>
                    <div className="md:col-span-2"><Label>Landmark (Optional)</Label><Input value={addressForm.landmark} onChange={(e) => setAddressForm({ ...addressForm, landmark: e.target.value })} className="mt-2" /></div>
                  </div>
                  <div className="mt-6 flex items-center gap-3">
                    <Button type="submit" className="rounded-xl bg-green-800 hover:bg-green-900">
                      {editingAddressId ? 'Update Address' : 'Save address'}
                    </Button>
                    {editingAddressId && (
                      <Button type="button" variant="outline" onClick={cancelEditAddress} className="rounded-xl">
                        Cancel
                      </Button>
                    )}
                  </div>
                </form>
                <div className="space-y-4">
                  {addresses.length === 0 ? (
                    <div className="rounded-2xl bg-white p-8 text-center text-neutral-500 border border-neutral-100 shadow-sm">
                      No addresses saved yet.
                    </div>
                  ) : (
                    addresses.map((address) => (
                      <div key={address.id} className="rounded-2xl bg-white p-5 shadow-sm border border-neutral-100 flex flex-col justify-between gap-4">
                        <div>
                          <div className="mb-2 flex items-center justify-between">
                            <h3 className="font-bold text-neutral-900">{address.label}</h3>
                            {address.is_default && <span className="rounded-full bg-green-100 px-3 py-1 text-xs font-bold text-green-800">Default</span>}
                          </div>
                          <p className="text-sm text-neutral-600 font-medium">{address.full_name}, {address.phone}</p>
                          <p className="text-sm text-neutral-500 mt-1">
                            {address.address_line1}
                            {(address as any).address_line2 ? `, ${(address as any).address_line2}` : ''}
                            {(address as any).landmark ? ` (Near ${(address as any).landmark})` : ''}
                            , {address.city}, {address.state} - {address.pincode}
                          </p>
                        </div>
                        <div className="flex flex-wrap items-center gap-2 border-t border-neutral-50 pt-3">
                          <Button size="sm" variant="outline" onClick={() => startEditAddress(address)} className="rounded-xl h-8 text-xs">
                            Edit
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => deleteAddress(address.id)} className="rounded-xl h-8 text-xs text-red-600 hover:text-red-700 hover:bg-red-50">
                            Delete
                          </Button>
                          {!address.is_default && (
                            <Button size="sm" variant="ghost" onClick={() => setDefaultAddress(address.id)} className="rounded-xl h-8 text-xs text-green-700 hover:text-green-800 hover:bg-green-50 ml-auto">
                              Set Default
                            </Button>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </TabsContent>

            <TabsContent value="preferences">
              <form onSubmit={updateProfile} className="max-w-xl space-y-5 rounded-2xl bg-white p-6 shadow-sm">
                <div className="flex items-center justify-between">
                  <div><h3 className="font-bold">Order updates</h3><p className="text-sm text-neutral-500">Receive payment, shipping, and delivery alerts.</p></div>
                  <Switch checked={form.order_updates} onCheckedChange={(checked) => setForm({ ...form, order_updates: checked })} />
                </div>
                <div className="flex items-center justify-between">
                  <div><h3 className="font-bold">Product news</h3><p className="text-sm text-neutral-500">Occasional updates about eco-friendly launches.</p></div>
                  <Switch checked={form.marketing} onCheckedChange={(checked) => setForm({ ...form, marketing: checked })} />
                </div>
                <Button className="rounded-xl bg-green-800 hover:bg-green-900">Save preferences</Button>
              </form>
            </TabsContent>
          </Tabs>
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default Account;
