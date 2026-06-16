import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useCartStore } from '@/store/useCartStore';
import { Bell, Heart, Home, Loader2, LogOut, MapPin, Package, Shield, UserRound, Sparkles, Check, CheckCircle2, Clock, CreditCard, Lock, Plus, Trash2, Download, UserX, ChevronRight, AlertCircle, Eye, EyeOff, Activity, Star } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from '@/components/ui/use-toast';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabaseClient';
import { friendlyAuthError, getAuthRedirectUrl } from '@/lib/authValidation';
import { useWishlistStore } from '@/store/useWishlistStore';
import ProductCard from '@/components/ProductCard';

interface Address {
  id: string;
  label: string;
  full_name: string;
  phone: string;
  address_line1: string;
  address_line2?: string;
  city: string;
  state: string;
  pincode: string;
  is_default: boolean;
  landmark?: string;
}

const Account = () => {
  const { user, profile, refreshProfile, signOut } = useAuth();
  const navigate = useNavigate();
  const wishlistItems = useWishlistStore((state) => state.items);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState('overview');
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

  // Custom Cropper states
  const [cropperSrc, setCropperSrc] = useState<string | null>(null);
  const [isCropperOpen, setIsCropperOpen] = useState(false);
  const [cropScale, setCropScale] = useState(1);
  const [cropPosition, setCropPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [uploadingCropped, setUploadingCropped] = useState(false);

  // Additional settings state (with persistence via localStorage)
  const [profileSettings, setProfileSettings] = useState({
    gender: '',
    birthday: '',
    preferredPayment: 'card',
    deliveryPreference: 'leave-door',
    twoFactorEnabled: false,
    wishlistStockAlerts: true,
    promoOffersAlerts: true,
  });

  useEffect(() => {
    if (user) {
      const savedSettings = localStorage.getItem(`grevya-premium-settings:${user.id}`);
      if (savedSettings) {
        setProfileSettings(JSON.parse(savedSettings));
      }
    }
  }, [user]);

  const saveSettingsField = (key: string, value: any) => {
    const updated = { ...profileSettings, [key]: value };
    setProfileSettings(updated);
    if (user) {
      localStorage.setItem(`grevya-premium-settings:${user.id}`, JSON.stringify(updated));
    }
  };

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

  // Profile Completeness calculation: Name (25%), Phone (25%), Avatar (25%), Default Address (25%)
  const profileCompleteness = 
    (form.full_name.trim().length > 0 ? 25 : 0) +
    (form.phone.trim().length > 0 ? 25 : 0) +
    (profile?.avatar_url ? 25 : 0) +
    (addresses.length > 0 ? 25 : 0);

  const safeUpsertProfile = async (profileData: any) => {
    let attemptData = { ...profileData };
    while (true) {
      const { error } = await supabase.from('profiles').upsert({
        id: user.id,
        ...attemptData
      });

      if (!error) return { error: null };

      const errorMsg = error.message || '';
      const matchSchemaCache = errorMsg.match(/Could not find the '([^']+)' column/);
      const matchNotExist = errorMsg.match(/column "([^"]+)" of relation "[^"]+" does not exist/);
      const missingColumn = (matchSchemaCache && matchSchemaCache[1]) || (matchNotExist && matchNotExist[1]);

      if (missingColumn && missingColumn in attemptData) {
        console.warn(`[Grevya Dev Resilience] Pruning missing column '${missingColumn}' for compatibility.`);
        delete attemptData[missingColumn];
        if (Object.keys(attemptData).length === 0) return { error };
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

      const { error } = await safeUpsertProfile(payload);
      if (error) throw error;

      const authUpdates: any = {
        data: {
          full_name: form.full_name.trim() || null,
          phone: form.phone.trim() || null,
        }
      };

      const emailChanged = form.email && form.email.trim() !== user.email;
      if (emailChanged) {
        if (emailCooldownSeconds > 0) {
          toast({
            title: 'Please wait',
            description: `You can request another email change in ${emailCooldownSeconds} seconds.`,
            variant: 'destructive',
          });
          setSaving(false);
          return;
        }

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
    localStorage.setItem(`grevya-dismiss-pending-email:${user.id}`, user.new_email);
    setDismissedPendingEmail(user.new_email);
    setForm((prev) => ({ ...prev, email: user.email || '' }));
    toast({
      title: 'Pending email change dismissed',
      description: 'The verification warning has been hidden.',
    });
  };

  const uploadAvatar = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !user) return;

    const reader = new FileReader();
    reader.onload = () => {
      setCropperSrc(reader.result as string);
      setIsCropperOpen(true);
      setCropScale(1);
      setCropPosition({ x: 0, y: 0 });
    };
    reader.readAsDataURL(file);
  };

  const handleDragStart = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    setIsDragging(true);
    setDragStart({ x: clientX - cropPosition.x, y: clientY - cropPosition.y });
  };

  const handleDragMove = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDragging) return;
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    setCropPosition({
      x: clientX - dragStart.x,
      y: clientY - dragStart.y
    });
  };

  const handleDragEnd = () => {
    setIsDragging(false);
  };

  const saveCroppedAvatar = async () => {
    if (!cropperSrc || !user) return;
    setUploadingCropped(true);

    const img = new Image();
    img.src = cropperSrc;
    img.onload = async () => {
      const canvas = document.createElement('canvas');
      canvas.width = 300;
      canvas.height = 300;
      const ctx = canvas.getContext('2d');
      
      if (ctx) {
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, 300, 300);

        const w_img = img.width;
        const h_img = img.height;
        let w_base = 300;
        let h_base = 300;

        if (w_img > h_img) {
          w_base = 300 * (w_img / h_img);
        } else {
          h_base = 300 * (h_img / w_img);
        }

        const drawWidth = w_base * cropScale;
        const drawHeight = h_base * cropScale;
        const dx = 150 - drawWidth / 2 + cropPosition.x;
        const dy = 150 - drawHeight / 2 + cropPosition.y;

        ctx.drawImage(img, dx, dy, drawWidth, drawHeight);

        canvas.toBlob(async (blob) => {
          if (!blob) {
            toast({ title: 'Cropping failed', description: 'Could not create image blob.', variant: 'destructive' });
            setUploadingCropped(false);
            return;
          }

          const fileType = 'image/jpeg';
          const extension = 'jpg';
          const path = `${user.id}/avatar-${Date.now()}.${extension}`;

          let bucket = 'profile-images';
          let uploadResult = await supabase.storage.from(bucket).upload(path, blob, { 
            contentType: fileType,
            upsert: true 
          });

          if (uploadResult.error && uploadResult.error.message.includes('Bucket not found')) {
            bucket = 'avatars';
            uploadResult = await supabase.storage.from(bucket).upload(path, blob, { 
              contentType: fileType,
              upsert: true 
            });
          }

          if (uploadResult.error) {
            toast({
              title: 'Upload failed',
              description: `Storage bucket avatars not found.`,
              variant: 'destructive'
            });
            setUploadingCropped(false);
            return;
          }

          const { data } = supabase.storage.from(bucket).getPublicUrl(path);
          const avatarUrl = `${data.publicUrl}?t=${Date.now()}`;
          const { error } = await safeUpsertProfile({ avatar_url: avatarUrl });

          if (error) {
            toast({ title: 'Could not save avatar', description: error.message, variant: 'destructive' });
            setUploadingCropped(false);
            return;
          }

          await refreshProfile();
          setIsCropperOpen(false);
          setUploadingCropped(false);
          toast({ title: 'Profile image updated' });
        }, 'image/jpeg', 0.9);
      }
    };
  };

  const startEditAddress = (address: Address) => {
    setEditingAddressId(address.id);
    setAddressForm({
      label: address.label || 'Home',
      full_name: address.full_name,
      phone: address.phone,
      address_line1: address.address_line1 || '',
      address_line2: address.address_line2 || '',
      city: address.city,
      state: address.state,
      pincode: address.pincode || '',
      postal_code: address.pincode || '',
      landmark: address.landmark || '',
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

      try {
        await supabase.auth.refreshSession();
      } catch (refreshErr) {
        console.warn('Failed to force refresh session:', refreshErr);
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

  // Reorder a previous order: adds all items from the selected order to the cart
  const handleReorder = async (orderId: string) => {
    if (!user) return;
    try {
      const { data: orderData, error } = await supabase
        .from('order_detail')
        .select('order_items')
        .eq('id', orderId)
        .single();
      if (error) {
        toast({ title: 'Reorder failed', description: error.message, variant: 'destructive' });
        return;
      }
      const items = (orderData as any)?.order_items || [];
      const cart = useCartStore.getState();
      items.forEach((item: any) => {
        const product = {
          id: item.product_id,
          name: item.product_name,
          price: item.price,
          image: item.product_image,
        } as any;
        cart.addItem(product, item.quantity);
      });
      toast({ title: 'Reorder added', description: 'Items added to cart.', variant: 'default' });
    } catch (err: any) {
      toast({ title: 'Reorder error', description: err.message, variant: 'destructive' });
    }
  };

  // Logout from all devices
  const handleLogoutAllDevices = async () => {
    if (!user) return;
    try {
      const { error } = await supabase.auth.signOut({ scope: 'global' });
      if (error) throw error;
      toast({ title: 'Logged out from all devices' });
      navigate('/auth');
    } catch (err: any) {
      toast({ title: 'Logout failed', description: err.message, variant: 'destructive' });
    }
  };

  // Download user data as JSON
  const downloadUserData = async () => {
    if (!user) return;
    try {
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();
      const { data: ordersData, error: ordersError } = await supabase
        .from('order_detail')
        .select('*')
        .eq('user_id', user.id);
      if (profileError || ordersError) {
        throw new Error(profileError?.message || ordersError?.message);
      }
      const payload = { profile: profileData, orders: ordersData };
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'grevya_user_data.json';
      a.click();
      URL.revokeObjectURL(url);
    } catch (err: any) {
      toast({ title: 'Download failed', description: err.message, variant: 'destructive' });
    }
  };

  // Floating input component reused across pages
  const FloatingInput = ({
    label,
    type = 'text',
    value,
    onChange,
    placeholder,
    required = false,
    disabled = false,
    id,
    autoComplete,
  }: {
    label: string;
    type?: string;
    value: string;
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
    placeholder?: string;
    required?: boolean;
    disabled?: boolean;
    id?: string;
    autoComplete?: string;
  }) => {
    const inputId = id || label;
    return (
      <div className="relative z-0 w-full group">
        <input
          type={type}
          name={label}
          id={inputId}
          className="block py-2.5 px-0 w-full text-sm text-gray-900 bg-transparent border-0 border-b-2 border-gray-300 appearance-none focus:outline-none focus:ring-0 focus:border-[#33381C] peer"
          placeholder=" "
          value={value}
          onChange={onChange}
          required={required}
          disabled={disabled}
          autoComplete={autoComplete}
        />
        <label
          htmlFor={inputId}
          className="peer-focus:font-medium absolute text-sm text-gray-500 duration-300 transform -translate-y-6 scale-75 top-3 -z-10 origin-[0] peer-focus:left-0 peer-focus:text-[#33381C] peer-placeholder-shown:scale-100 peer-placeholder-shown:translate-y-0 peer-focus:scale-75"
        >
          {label}
        </label>
      </div>
    );
  };

  return (
    <div className="flex flex-col min-h-screen bg-[#FBF9F6]">
      <Navbar />
      
      <main className="flex-grow py-10">
        <div className="container mx-auto px-4 max-w-6xl">
          <Tabs value={activeTab} onValueChange={setActiveTab} defaultValue="overview" className="space-y-6">
            {/* PREMIUM SPLIT HEADER PANEL */}
            <div className="grid gap-6 md:grid-cols-[1.3fr_1.7fr] mb-10 items-stretch">
            
            {/* LEFT: Frosted Metallic Membership Card */}
            <motion.div
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              className="rounded-3xl p-6 text-[#FBF7F1] bg-gradient-to-br from-[#33381C] via-[#2a2f16] to-[#1b1d11] border border-[#A68D65]/40 shadow-xl relative overflow-hidden flex flex-col justify-between min-h-[220px] metallic-shine group"
            >
              {/* Subtle background golden mesh decoration */}
              <div className="absolute top-0 right-0 w-48 h-48 bg-[#A68D65]/10 rounded-full blur-2xl" />
              <div className="absolute -bottom-8 -left-8 w-36 h-36 bg-[#F7EEE4]/5 rounded-full blur-xl" />
              
              {/* Gold Shimmer animated line overlay */}
              <div className="absolute inset-0 gold-shimmer-border opacity-15 pointer-events-none rounded-3xl" />

              {/* Card Top Row */}
              <div className="flex items-start justify-between relative z-10">
                <div className="flex flex-col">
                  <span className="text-[9px] font-bold uppercase tracking-[0.25em] text-[#A68D65] mb-0.5">Prestige Membership</span>
                  <span className="font-serif text-lg font-bold tracking-[0.1em] text-white">GREVYA NATURALS</span>
                </div>
                <div className="w-10 h-7 rounded-md bg-gradient-to-tr from-[#A68D65]/60 to-[#A68D65] border border-white/20 relative overflow-hidden flex items-center justify-center shadow-xs">
                  {/* Mock Gold Chip lines */}
                  <div className="w-6 h-5 border border-white/10 rounded-xs flex flex-wrap opacity-50">
                    <div className="w-1/2 h-1/2 border-r border-b border-white/20" />
                    <div className="w-1/2 h-1/2 border-b border-white/20" />
                    <div className="w-1/2 h-1/2 border-r border-white/20" />
                  </div>
                </div>
              </div>

              {/* Card Middle: formatted ID */}
              <div className="relative z-10 py-2">
                <p className="font-mono text-sm tracking-[0.25em] text-[#FBF7F1] font-semibold">
                  GN - {String(user?.id || 'XXXX').slice(0, 4).toUpperCase()} - {String(user?.id || 'XXXX').slice(4, 8).toUpperCase()} - {String(user?.id || 'XXXX').slice(9, 13).toUpperCase()}
                </p>
              </div>

              {/* Card Bottom Row */}
              <div className="flex items-end justify-between relative z-10 pt-2">
                <div className="flex flex-col">
                  <span className="text-[8px] font-bold text-white/50 uppercase tracking-wider">Member Name</span>
                  <span className="text-sm font-semibold text-white tracking-wide truncate max-w-[180px]">
                    {profile?.full_name || user?.user_metadata?.full_name || 'Grevya Guest'}
                  </span>
                </div>
                <div className="text-right flex flex-col">
                  <span className="text-[8px] font-bold text-[#A68D65] uppercase tracking-wider">Join Year</span>
                  <span className="text-xs font-bold text-white tracking-wider">2026</span>
                </div>
              </div>
            </motion.div>

            {/* RIGHT: Profile Completeness & Natural Onboarding Checklist */}
            <motion.div
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.1 }}
              className="rounded-3xl bg-white border border-[#A68D65]/15 p-6 shadow-xs flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between mb-4">
                  <div className="flex flex-col">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-[#A68D65]">Profile Integration</span>
                    <h2 className="text-base font-bold text-[#33381C] mt-0.5">Membership Readiness</h2>
                  </div>
                  <span className="text-sm font-extrabold text-[#33381C] bg-[#F7EEE4] px-2.5 py-0.5 rounded-full border border-[#A68D65]/20">
                    {profileCompleteness}% Complete
                  </span>
                </div>

                {/* Progress Bar */}
                <div className="w-full bg-[#F7EEE4] h-2 rounded-full overflow-hidden mb-5">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${profileCompleteness}%` }}
                    transition={{ duration: 0.8, ease: "easeOut" }}
                    className="h-full bg-gradient-to-r from-[#A68D65] to-[#33381C] rounded-full"
                  />
                </div>

                {/* Checklist Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {[
                    {
                      label: 'Profile Picture',
                      done: !!profile?.avatar_url,
                      actionText: 'Upload Photo',
                      actionId: 'avatar-checklist-trigger'
                    },
                    {
                      label: 'Personal Details',
                      done: !!(form.full_name?.trim() && form.phone?.trim()),
                      actionText: 'Configure profile',
                      tab: 'profile'
                    },
                    {
                      label: 'Shipping Address',
                      done: addresses.length > 0,
                      actionText: 'Add address',
                      tab: 'addresses'
                    },
                    {
                      label: 'Secure Credentials',
                      done: true,
                      actionText: 'Review security',
                      tab: 'security'
                    }
                  ].map((item, idx) => (
                    <div
                      key={idx}
                      className={`flex items-center justify-between p-3 rounded-xl border text-xs transition-colors ${
                        item.done 
                          ? 'bg-emerald-50/40 border-emerald-100 text-emerald-850' 
                          : 'bg-[#FBF7F1]/70 border-[#A68D65]/10 text-neutral-500'
                      }`}
                    >
                      <div className="flex items-center space-x-2">
                        {item.done ? (
                          <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                        ) : (
                          <div className="w-4 h-4 rounded-full border border-dashed border-[#A68D65] shrink-0" />
                        )}
                        <span className="font-semibold">{item.label}</span>
                      </div>
                      {!item.done && (
                        item.actionId ? (
                          <label htmlFor="avatar-file-upload" className="text-[10px] text-[#A68D65] font-extrabold uppercase hover:underline cursor-pointer">
                            Upload
                          </label>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setActiveTab(item.tab || 'overview')}
                            className="text-[10px] text-[#A68D65] font-extrabold uppercase hover:underline p-0 h-auto bg-transparent border-none shadow-none cursor-pointer focus-visible:ring-0 focus-visible:ring-offset-0"
                          >
                            Add
                          </button>
                        )
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>
          </div>

            {/* Scrollable frosted tabs header */}
            <TabsList className="flex h-auto w-full flex-wrap justify-start rounded-2xl bg-white p-1.5 shadow-xs border border-[#A68D65]/10 select-none overflow-x-auto no-scrollbar gap-1">
              <TabsTrigger value="overview" className="rounded-xl px-4 py-2 font-bold text-xs uppercase tracking-wider cursor-pointer"><Home className="mr-1.5 h-3.5 w-3.5" />Overview</TabsTrigger>
              <TabsTrigger value="profile" className="rounded-xl px-4 py-2 font-bold text-xs uppercase tracking-wider cursor-pointer"><UserRound className="mr-1.5 h-3.5 w-3.5" />Profile</TabsTrigger>
              <TabsTrigger value="security" className="rounded-xl px-4 py-2 font-bold text-xs uppercase tracking-wider cursor-pointer"><Lock className="mr-1.5 h-3.5 w-3.5" />Security</TabsTrigger>
              <TabsTrigger value="addresses" className="rounded-xl px-4 py-2 font-bold text-xs uppercase tracking-wider cursor-pointer"><MapPin className="mr-1.5 h-3.5 w-3.5" />Addresses</TabsTrigger>
              <TabsTrigger value="wishlist" className="rounded-xl px-4 py-2 font-bold text-xs uppercase tracking-wider cursor-pointer"><Heart className="mr-1.5 h-3.5 w-3.5" />Wishlist</TabsTrigger>
              <TabsTrigger value="preferences" className="rounded-xl px-4 py-2 font-bold text-xs uppercase tracking-wider cursor-pointer"><Bell className="mr-1.5 h-3.5 w-3.5" />Notifications</TabsTrigger>
              <TabsTrigger value="privacy" className="rounded-xl px-4 py-2 font-bold text-xs uppercase tracking-wider cursor-pointer"><Shield className="mr-1.5 h-3.5 w-3.5" />Privacy</TabsTrigger>
            </TabsList>

            {/* OVERVIEW CONTENT */}
            <TabsContent value="overview" className="focus:outline-none">
              <motion.div
                initial={{ opacity: 0, y: 15, filter: 'blur(4px)' }}
                animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
                transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1] as [number, number, number, number] }}
                className="grid gap-6 lg:grid-cols-[1.35fr_0.85fr]"
              >
                {/* Timeline Orders */}
                <div className="rounded-3xl bg-white p-6 border border-[#A68D65]/15 shadow-xs">
                  <div className="mb-6 flex items-center justify-between">
                    <h3 className="font-serif text-lg font-bold text-[#33381C]">Order History Timeline</h3>
                    {orders.length > 0 && (
                      <Button asChild variant="outline" className="rounded-xl text-xs font-bold border-[#A68D65]/20 h-9 px-4">
                        <Link to="/orders">View All</Link>
                      </Button>
                    )}
                  </div>

                  {orders.length === 0 ? (
                    <div className="rounded-2xl p-10 text-center border border-dashed border-[#A68D65]/20 bg-[#FBF7F1]/30 max-w-sm mx-auto">
                      <div className="mx-auto w-12 h-12 bg-[#F7EEE4] rounded-full flex items-center justify-center text-[#A68D65] mb-4">
                        <Package className="w-6 h-6" />
                      </div>
                      <h4 className="font-serif text-base font-bold text-[#1D1E19] mb-1">No Orders Placed</h4>
                      <p className="text-xs text-neutral-400 mb-6 leading-relaxed">Your order history is currently empty. Explore our collection of premium, organic, eco-friendly lifestyle goods.</p>
                      <Button asChild className="h-10 rounded-xl bg-[#33381C] hover:bg-[#262A14] text-white font-bold px-6 text-xs">
                        <Link to="/products">Shop Products</Link>
                      </Button>
                    </div>
                  ) : (
                    /* Timeline nodes list */
                    <div className="relative pl-6 border-l border-[#A68D65]/20 space-y-6 ml-3 my-2">
                      {orders.map((order) => {
                        const statusColors: Record<string, string> = {
                          pending: 'bg-amber-100 text-amber-900 border-amber-200',
                          confirmed: 'bg-blue-50 text-blue-900 border-blue-100',
                          processing: 'bg-[#E7E9DD] text-[#33381C] border-[#A68D65]/20',
                          shipped: 'bg-indigo-50 text-indigo-900 border-indigo-100',
                          delivered: 'bg-emerald-50 text-emerald-900 border-emerald-100',
                          cancelled: 'bg-red-50 text-red-900 border-red-100'
                        };

                        return (
                          <div key={order.id} className="relative group">
                            {/* timeline bullet bullet */}
                            <div className="absolute -left-[31px] top-1.5 w-4.5 h-4.5 rounded-full bg-white border-2 border-[#A68D65] flex items-center justify-center">
                              {order.status === 'delivered' ? (
                                <Check className="h-2.5 w-2.5 text-emerald-600 font-bold" />
                              ) : (
                                <Clock className="h-2.5 w-2.5 text-[#A68D65]" />
                              )}
                            </div>

                            <div className="p-4 rounded-2xl bg-[#FBF7F1]/60 border border-[#A68D65]/10 hover:border-[#A68D65]/35 hover:bg-[#FBF7F1] transition-all duration-300 shadow-xs flex flex-col sm:flex-row justify-between gap-4 items-start sm:items-center">
                              <div className="space-y-1">
                                <div className="flex items-center space-x-2">
                                  <Link to={`/orders/${order.id}`} className="font-mono text-xs font-bold text-neutral-800 hover:text-[#33381C] hover:underline">
                                    #{String(order.id).slice(0, 8)}
                                  </Link>
                                  <span className={`text-[9px] uppercase font-bold tracking-wider px-2 py-0.5 rounded border ${
                                    statusColors[order.status] || 'bg-neutral-50 text-neutral-500'
                                  }`}>
                                    {order.status || 'Pending'}
                                  </span>
                                </div>
                                <p className="text-xs text-neutral-450 font-medium">Placed on {new Date(order.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</p>
                              </div>

                              <div className="flex items-center gap-4 w-full sm:w-auto justify-between sm:justify-end">
                                <div className="text-left sm:text-right">
                                  <p className="text-[9px] text-neutral-450 font-bold uppercase tracking-wider">Amount</p>
                                  <p className="text-sm font-extrabold text-[#33381C]">₹{Number(order.total_amount || 0).toFixed(0)}</p>
                                </div>
                                <div className="flex gap-2">
                                  <Button asChild variant="ghost" size="sm" className="rounded-xl h-8 text-xs font-bold text-[#A68D65] hover:bg-[#A68D65]/10">
                                    <Link to={`/orders/${order.id}`}>Details</Link>
                                  </Button>
                                  <Button 
                                    onClick={() => handleReorder(order.id)}
                                    size="sm"
                                    className="rounded-xl h-8 text-xs font-bold bg-[#33381C] hover:bg-[#262A14] text-white"
                                  >
                                    Reorder
                                  </Button>
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Sidebar Membership Insights */}
                <div className="space-y-4">
                  <div className="rounded-3xl bg-white p-5 border border-[#A68D65]/15 shadow-xs">
                    <h3 className="font-serif text-sm font-bold text-[#33381C] border-b border-[#A68D65]/10 pb-3 mb-4">Membership Insights</h3>
                    
                    <div className="space-y-4">
                      <div className="flex justify-between items-center text-xs">
                        <span className="text-neutral-500 font-medium">Total Orders Placed</span>
                        <span className="font-extrabold text-neutral-800">{orders.length}</span>
                      </div>
                      <div className="flex justify-between items-center text-xs">
                        <span className="text-neutral-500 font-medium">Total Investments</span>
                        <span className="font-extrabold text-[#33381C]">₹{orders.reduce((sum, o) => sum + Number(o.total_amount || 0), 0).toFixed(0)}</span>
                      </div>
                      <div className="flex justify-between items-center text-xs">
                        <span className="text-neutral-500 font-medium">Prestige Tier Status</span>
                        <span className="font-bold text-emerald-800 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-100">Prestige Active</span>
                      </div>
                      <div className="flex justify-between items-start text-xs pt-3 border-t border-[#A68D65]/10">
                        <span className="text-neutral-500 font-medium shrink-0 mr-4">Eco Impact Contribution</span>
                        <span className="font-bold text-neutral-700 text-right">
                          Saved {(orders.length * 1.2).toFixed(1)}kg plastics. Supported artisan families in Nagaranai.
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-3xl bg-[#F7EEE4]/40 p-5 border border-[#A68D65]/20 shadow-xs relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-24 h-24 bg-[#A68D65]/5 rounded-full blur-xl" />
                    <Sparkles className="h-5 w-5 text-[#A68D65] mb-2" />
                    <h4 className="font-serif text-sm font-bold text-[#33381C] mb-1">Eco-Conscious Choice</h4>
                    <p className="text-xs text-neutral-500 leading-relaxed font-medium">Thank you for making sustainable choices. Every order from Grevya promotes zero-waste bio-degradable alternatives that help protect and heal our planet.</p>
                  </div>
                </div>
              </motion.div>
            </TabsContent>

            {/* PROFILE TAB */}
            <TabsContent value="profile" className="focus:outline-none">
              <motion.div
                initial={{ opacity: 0, y: 15, filter: 'blur(4px)' }}
                animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
                transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1] as [number, number, number, number] }}
                className="max-w-2xl"
              >
                <form onSubmit={updateProfile} className="rounded-3xl bg-white p-6 border border-[#A68D65]/15 shadow-xs space-y-6">
                  <div className="flex items-center space-x-6 border-b border-[#A68D65]/10 pb-5">
                    {/* Avatar Upload Panel */}
                    <div className="relative shrink-0 group">
                      <Avatar className="h-20 w-20 border-4 border-[#A68D65]/20 shadow-md">
                        <AvatarImage src={profile?.avatar_url || undefined} />
                        <AvatarFallback className="bg-[#E7E9DD] text-[#33381C] text-xl font-bold">
                          {(form.full_name || form.email || 'G').slice(0, 1).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <label htmlFor="avatar-file-upload" className="absolute -bottom-1 -right-1 bg-[#A68D65] hover:bg-[#8F7752] text-white p-1.5 rounded-full shadow-xs border border-white cursor-pointer transition-colors" title="Change Avatar">
                        <UserRound className="h-3 w-3" />
                      </label>
                      <input id="avatar-file-upload" type="file" accept="image/*" onChange={uploadAvatar} className="hidden" />
                    </div>

                    <div>
                      <h3 className="font-serif text-lg font-bold text-[#33381C]">Personal Profile</h3>
                      <p className="text-xs text-neutral-400 mt-1 leading-relaxed">Upload a profile photo (jpeg or png), then configure your name and username.</p>
                    </div>
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    <FloatingInput
                      id="profileName"
                      label="Full Name"
                      value={form.full_name}
                      onChange={(e) => setForm({ ...form, full_name: e.target.value })}
                    />
                    <FloatingInput
                      id="profileUsername"
                      label="Username"
                      value={form.username}
                      onChange={(e) => setForm({ ...form, username: e.target.value })}
                    />
                    <FloatingInput
                      id="profileEmail"
                      label="Email Address"
                      type="email"
                      value={form.email}
                      onChange={(e) => setForm({ ...form, email: e.target.value })}
                    />
                    <FloatingInput
                      id="profilePhone"
                      label="Phone Number"
                      value={form.phone}
                      onChange={(e) => setForm({ ...form, phone: e.target.value })}
                    />

                    <div>
                      <Label htmlFor="genderSelect" className="text-[10px] font-bold text-neutral-500 uppercase tracking-wider mb-1.5 block">Gender (Optional)</Label>
                      <select
                        id="genderSelect"
                        value={profileSettings.gender}
                        onChange={(e) => saveSettingsField('gender', e.target.value)}
                        className="w-full rounded-xl border border-[#A68D65]/20 p-3 h-12 bg-white focus:outline-none focus:ring-2 focus:ring-[#33381C]/20 focus:border-[#33381C] text-sm text-[#1D1E19] font-medium"
                      >
                        <option value="">Select gender</option>
                        <option value="female">Female</option>
                        <option value="male">Male</option>
                        <option value="non-binary">Non-binary</option>
                        <option value="prefer-not-say">Prefer not to say</option>
                      </select>
                    </div>

                    <div>
                      <Label htmlFor="birthdayInput" className="text-[10px] font-bold text-neutral-500 uppercase tracking-wider mb-1.5 block">Birthday (Optional)</Label>
                      <input
                        id="birthdayInput"
                        type="date"
                        value={profileSettings.birthday}
                        onChange={(e) => saveSettingsField('birthday', e.target.value)}
                        className="w-full rounded-xl border border-[#A68D65]/20 p-2.5 h-12 bg-white focus:outline-none focus:ring-2 focus:ring-[#33381C]/20 focus:border-[#33381C] text-sm text-[#1D1E19] font-semibold"
                      />
                    </div>
                  </div>

                  {emailCooldownSeconds > 0 && (
                    <div className="p-3 bg-amber-50 text-amber-800 text-xs rounded-xl border border-amber-200">
                      Email cooldown active: you can request change again in {emailCooldownSeconds}s.
                    </div>
                  )}

                  {user?.new_email && user.new_email !== dismissedPendingEmail && (
                    <div className="rounded-2xl bg-amber-50 border border-amber-200 p-4 text-sm text-amber-900 space-y-3">
                      <div className="flex items-start gap-2">
                        <AlertCircle className="h-4.5 w-4.5 text-amber-700 shrink-0 mt-0.5" />
                        <div>
                          <p className="font-bold">Email Change Verification Pending</p>
                          <p className="text-xs text-neutral-600 mt-0.5 leading-relaxed">
                            Confirm the change by clicking the link sent to <strong className="text-amber-950">{user.new_email}</strong>.
                          </p>
                        </div>
                      </div>
                      <div className="flex gap-2 pl-7">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          disabled={saving || emailCooldownSeconds > 0}
                          onClick={resendEmailVerification}
                          className="h-8 rounded-xl text-xs bg-white text-amber-950 font-bold border-amber-200 hover:bg-amber-100"
                        >
                          Resend Link
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          disabled={saving}
                          onClick={cancelEmailChange}
                          className="h-8 rounded-xl text-xs text-amber-950 font-bold hover:bg-amber-105"
                        >
                          Cancel Request
                        </Button>
                      </div>
                    </div>
                  )}

                  <Button type="submit" disabled={saving} className="rounded-xl bg-[#33381C] hover:bg-[#262A14] text-white font-bold h-11 px-8 shadow-md cursor-pointer">
                    {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Save Details
                  </Button>
                </form>
              </motion.div>
            </TabsContent>

            {/* SECURITY TAB */}
            <TabsContent value="security" className="focus:outline-none">
              <motion.div
                initial={{ opacity: 0, y: 15, filter: 'blur(4px)' }}
                animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
                transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1] as [number, number, number, number] }}
                className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]"
              >
                {/* Password Form */}
                <form onSubmit={updatePassword} className="rounded-3xl bg-white p-6 border border-[#A68D65]/15 shadow-xs space-y-6">
                  <div>
                    <h3 className="font-serif text-lg font-bold text-[#33381C] border-b border-[#A68D65]/10 pb-3">Password Credentials</h3>
                    <p className="text-xs text-neutral-400 mt-1 leading-relaxed">Ensure your account is protected with a strong, complex passphrase.</p>
                  </div>

                  <div className="space-y-4">
                    <FloatingInput
                      id="currentPassword"
                      label="Current Password"
                      type="password"
                      required
                      autoComplete="current-password"
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                    />

                    <FloatingInput
                      id="newPassword"
                      label="New Password"
                      type="password"
                      required
                      autoComplete="new-password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                    />

                    {newPassword && (
                      <div className="px-2 pt-1">
                        <div className="h-1.5 w-full bg-neutral-100 rounded-full overflow-hidden">
                          <div className={`h-full rounded-full transition-all duration-300 ${
                            getPasswordStrength(newPassword).startsWith('Weak')
                              ? 'bg-red-500 w-1/3'
                              : getPasswordStrength(newPassword) === 'Medium'
                              ? 'bg-amber-500 w-2/3'
                              : 'bg-emerald-600 w-full'
                          }`} />
                        </div>
                        <p className={`text-[10px] mt-1.5 font-bold uppercase tracking-wider ${
                          getPasswordStrength(newPassword).startsWith('Weak')
                            ? 'text-red-500'
                            : getPasswordStrength(newPassword) === 'Medium'
                            ? 'text-amber-600'
                            : 'text-emerald-700'
                        }`}>
                          Password Strength: {getPasswordStrength(newPassword)}
                        </p>
                      </div>
                    )}

                    <FloatingInput
                      id="confirmPassword"
                      label="Confirm New Password"
                      type="password"
                      required
                      autoComplete="new-password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                    />
                    
                    {confirmPassword && newPassword !== confirmPassword && (
                      <p className="text-[10px] text-red-500 font-bold ml-1">New passwords do not match.</p>
                    )}
                  </div>

                  <div className="flex items-center gap-4">
                    <Button
                      type="submit"
                      disabled={updatingPass || !currentPassword || !newPassword || newPassword !== confirmPassword || getPasswordStrength(newPassword).startsWith('Weak')}
                      className="rounded-xl bg-[#33381C] hover:bg-[#262A14] text-white font-bold h-11 px-6 shadow-md cursor-pointer"
                    >
                      {updatingPass && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      Update Password
                    </Button>
                  </div>
                </form>

                {/* Session Manager & Multi-factor UI */}
                <div className="space-y-4">
                  {/* Active Devices */}
                  <div className="rounded-3xl bg-white p-5 border border-[#A68D65]/15 shadow-xs">
                    <h3 className="font-serif text-sm font-bold text-[#33381C] border-b border-[#A68D65]/10 pb-3 mb-4 flex items-center">
                      <Activity className="h-4.5 w-4.5 text-[#A68D65] mr-2" /> Active sessions
                    </h3>
                    
                    <div className="space-y-3.5">
                      <div className="flex items-start gap-2.5">
                        <div className="p-1.5 rounded-lg bg-emerald-50 text-emerald-800 mt-0.5 border border-emerald-100">
                          <Check className="h-3 w-3" />
                        </div>
                        <div>
                          <p className="text-xs font-bold text-neutral-800">Chrome on Windows 11 (Current)</p>
                          <p className="text-[10px] text-neutral-450 mt-0.5">Active Session • India</p>
                        </div>
                      </div>

                      <div className="flex items-start gap-2.5 opacity-60">
                        <div className="p-1.5 rounded-lg bg-[#F7EEE4] text-[#33381C] mt-0.5">
                          <Clock className="h-3 w-3" />
                        </div>
                        <div>
                          <p className="text-xs font-bold text-neutral-800">Mobile Safari on iPhone 15</p>
                          <p className="text-[10px] text-neutral-450 mt-0.5">Active 3 hours ago • Coimbatore, IN</p>
                        </div>
                      </div>
                    </div>

                    <div className="mt-5 pt-4 border-t border-[#A68D65]/10 flex flex-col gap-2">
                      <Button 
                        type="button" 
                        variant="outline" 
                        onClick={handleLogoutAllDevices}
                        className="w-full rounded-xl text-xs font-bold border-red-200 text-red-700 hover:bg-red-50 h-9"
                      >
                        Logout from all devices
                      </Button>
                      <Button 
                        type="button" 
                        variant="ghost" 
                        onClick={signOut}
                        className="w-full rounded-xl text-xs font-bold text-neutral-500 hover:bg-neutral-50 h-9"
                      >
                        Sign Out current session
                      </Button>
                    </div>
                  </div>

                  {/* Two-Factor Authentication Placeholder */}
                  <div className="rounded-3xl bg-white p-5 border border-[#A68D65]/15 shadow-xs">
                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <h4 className="font-serif text-sm font-bold text-[#33381C]">Two-Factor Auth (2FA)</h4>
                        <p className="text-[10px] text-neutral-450 font-medium">Add an extra layer of protection (future-ready).</p>
                      </div>
                      <Switch 
                        checked={profileSettings.twoFactorEnabled} 
                        onCheckedChange={(checked) => saveSettingsField('twoFactorEnabled', checked)} 
                      />
                    </div>
                  </div>
                </div>
              </motion.div>
            </TabsContent>

            {/* ADDRESSES TAB */}
            <TabsContent value="addresses" className="focus:outline-none">
              <motion.div
                initial={{ opacity: 0, y: 15, filter: 'blur(4px)' }}
                animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
                transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1] as [number, number, number, number] }}
                className="grid gap-6 lg:grid-cols-[1fr_1.1fr]"
              >
                {/* Address Form */}
                <form onSubmit={saveAddress} className="rounded-3xl bg-white p-6 border border-[#A68D65]/15 shadow-xs h-fit space-y-6">
                  <div>
                    <h3 className="font-serif text-lg font-bold text-[#33381C] border-b border-[#A68D65]/10 pb-3">{editingAddressId ? 'Edit Address Destination' : 'Add New Destination'}</h3>
                    <p className="text-xs text-neutral-400 mt-1 leading-relaxed">Save multiple shipping locations for faster checkout delivery selection.</p>
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    <FloatingInput
                      id="addrLabel"
                      label="Label Tag (e.g., Home, Work)"
                      value={addressForm.label}
                      onChange={(e) => setAddressForm({ ...addressForm, label: e.target.value })}
                    />
                    <FloatingInput
                      id="addrFullName"
                      label="Recipient Full Name"
                      required
                      value={addressForm.full_name}
                      onChange={(e) => setAddressForm({ ...addressForm, full_name: e.target.value })}
                    />
                    <FloatingInput
                      id="addrPhone"
                      label="Contact Phone"
                      required
                      value={addressForm.phone}
                      onChange={(e) => setAddressForm({ ...addressForm, phone: e.target.value })}
                    />
                    <FloatingInput
                      id="addrPincode"
                      label="6-Digit PIN Code"
                      required
                      value={addressForm.pincode}
                      onChange={(e) => setAddressForm({ ...addressForm, pincode: e.target.value, postal_code: e.target.value })}
                    />
                    <FloatingInput
                      id="addrCity"
                      label="City"
                      required
                      value={addressForm.city}
                      onChange={(e) => setAddressForm({ ...addressForm, city: e.target.value })}
                    />
                    <FloatingInput
                      id="addrState"
                      label="State"
                      required
                      value={addressForm.state}
                      onChange={(e) => setAddressForm({ ...addressForm, state: e.target.value })}
                    />
                    <div className="md:col-span-2">
                      <FloatingInput
                        id="addrLine1"
                        label="Flat, House, Building, Apartment *"
                        required
                        value={addressForm.address_line1}
                        onChange={(e) => setAddressForm({ ...addressForm, address_line1: e.target.value })}
                      />
                    </div>
                    <div className="md:col-span-2">
                      <FloatingInput
                        id="addrLine2"
                        label="Area, Street, Village (Optional)"
                        value={addressForm.address_line2}
                        onChange={(e) => setAddressForm({ ...addressForm, address_line2: e.target.value })}
                      />
                    </div>
                    <div className="md:col-span-2">
                      <FloatingInput
                        id="addrLandmark"
                        label="Landmark (Optional)"
                        value={addressForm.landmark}
                        onChange={(e) => setAddressForm({ ...addressForm, landmark: e.target.value })}
                      />
                    </div>
                  </div>

                  <div className="flex items-center gap-3 border-t border-neutral-100 pt-4">
                    <Button type="submit" className="rounded-xl bg-[#33381C] hover:bg-[#262A14] text-white font-bold h-11 px-6 shadow-md cursor-pointer">
                      {editingAddressId ? 'Update Address' : 'Save Destination'}
                    </Button>
                    {editingAddressId && (
                      <Button type="button" variant="outline" onClick={cancelEditAddress} className="rounded-xl h-11 border-neutral-200 font-bold">
                        Cancel
                      </Button>
                    )}
                  </div>
                </form>

                {/* Right side: Address List + Preferences */}
                <div className="space-y-6">
                  {/* Addresses List */}
                  <div className="space-y-4">
                    <h3 className="font-serif text-sm font-bold text-[#33381C] uppercase tracking-wider pl-1">Saved Destinations</h3>
                    {addresses.length === 0 ? (
                      <div className="rounded-3xl bg-white p-8 text-center text-neutral-500 border border-[#A68D65]/15 shadow-xs">
                        No delivery addresses saved yet. Add one to accelerate your checkout.
                      </div>
                    ) : (
                      addresses.map((address) => (
                        <div key={address.id} className="rounded-2xl bg-white p-5 border border-[#A68D65]/15 shadow-xs flex flex-col justify-between gap-4">
                          <div>
                            <div className="mb-2 flex items-center justify-between">
                              <span className="font-bold text-xs uppercase tracking-wider text-[#A68D65]">[{address.label || 'Address'}]</span>
                              {address.is_default && (
                                <span className="rounded-full bg-emerald-50 border border-emerald-100 px-3 py-0.5 text-[9px] font-bold text-emerald-800">
                                  Default Shipping
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-neutral-800 font-extrabold">{address.full_name}</p>
                            <p className="text-xs text-neutral-500 mt-1 leading-relaxed font-semibold">
                              {address.address_line1}
                              {address.address_line2 ? `, ${address.address_line2}` : ''}
                              {address.landmark ? ` (Near ${address.landmark})` : ''}
                              , {address.city}, {address.state} - {address.pincode}
                            </p>
                            <p className="text-[11px] text-neutral-600 font-bold mt-1.5">Phone: {address.phone}</p>
                          </div>
                          
                          <div className="flex flex-wrap items-center gap-2 border-t border-neutral-100 pt-3">
                            <Button size="sm" variant="outline" onClick={() => startEditAddress(address)} className="rounded-xl h-8 text-[11px] font-bold border-[#A68D65]/25">
                              Edit
                            </Button>
                            <Button size="sm" variant="ghost" onClick={() => deleteAddress(address.id)} className="rounded-xl h-8 text-[11px] font-bold text-red-600 hover:text-red-750 hover:bg-red-50">
                              Delete
                            </Button>
                            {!address.is_default && (
                              <Button size="sm" variant="ghost" onClick={() => setDefaultAddress(address.id)} className="rounded-xl h-8 text-[11px] font-bold text-green-800 hover:text-green-900 hover:bg-green-50 ml-auto">
                                Set Default
                              </Button>
                            )}
                          </div>
                        </div>
                      ))
                    )}
                  </div>

                  {/* Shopping Preferences */}
                  <div className="rounded-3xl bg-white p-5 border border-[#A68D65]/15 shadow-xs space-y-4">
                    <h3 className="font-serif text-sm font-bold text-[#33381C] border-b border-[#A68D65]/10 pb-3">Shopping Preferences</h3>
                    
                    <div className="space-y-3">
                      <div>
                        <Label htmlFor="prefPayment" className="text-[10px] font-bold text-neutral-500 uppercase tracking-wider mb-1 block">Preferred Payment Method</Label>
                        <select
                          id="prefPayment"
                          value={profileSettings.preferredPayment}
                          onChange={(e) => saveSettingsField('preferredPayment', e.target.value)}
                          className="w-full rounded-xl border border-[#A68D65]/20 p-2.5 h-11 bg-white focus:outline-none focus:ring-2 focus:ring-[#33381C]/20 focus:border-[#33381C] text-xs text-[#1D1E19] font-medium"
                        >
                          <option value="upi">UPI / Instant Pay</option>
                          <option value="card">Credit / Debit Card</option>
                          <option value="netbanking">Net Banking</option>
                          <option value="cod">Cash on Delivery (COD)</option>
                        </select>
                      </div>

                      <div>
                        <Label htmlFor="prefDelivery" className="text-[10px] font-bold text-neutral-500 uppercase tracking-wider mb-1 block">Delivery Preferences</Label>
                        <select
                          id="prefDelivery"
                          value={profileSettings.deliveryPreference}
                          onChange={(e) => saveSettingsField('deliveryPreference', e.target.value)}
                          className="w-full rounded-xl border border-[#A68D65]/20 p-2.5 h-11 bg-white focus:outline-none focus:ring-2 focus:ring-[#33381C]/20 focus:border-[#33381C] text-xs text-[#1D1E19] font-medium"
                        >
                          <option value="leave-door">Leave at my door</option>
                          <option value="hand-resident">Hand to resident directly</option>
                          <option value="leave-gate">Leave at security/main gate</option>
                          <option value="call-first">Call me before delivery</option>
                        </select>
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>
            </TabsContent>

            {/* WISHLIST TAB */}
            <TabsContent value="wishlist" className="focus:outline-none">
              <motion.div
                initial={{ opacity: 0, y: 15, filter: 'blur(4px)' }}
                animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
                transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1] as [number, number, number, number] }}
              >
                <div className="mb-6">
                  <h3 className="font-serif text-lg font-bold text-[#33381C] border-b border-[#A68D65]/10 pb-3">Premium Wishlist Showcase</h3>
                  <p className="text-xs text-neutral-400 mt-1 leading-relaxed">Your curated list of organic, hand-crafted items you are interested in.</p>
                </div>

                {wishlistItems.length === 0 ? (
                  <div className="rounded-3xl bg-white p-12 text-center border border-[#A68D65]/15 shadow-xs max-w-md mx-auto space-y-5">
                    <div className="mx-auto w-16 h-16 bg-[#F7EEE4] rounded-full flex items-center justify-center text-[#A68D65] border border-[#A68D65]/25">
                      <Heart className="w-8 h-8" />
                    </div>
                    <div className="space-y-1.5">
                      <h4 className="font-serif text-lg font-bold text-[#1D1E19]">Wishlist Empty</h4>
                      <p className="text-xs text-neutral-400 max-w-xs mx-auto leading-relaxed">Save botanical items and sustainable kitchenware here to keep track of their stock and price details.</p>
                    </div>
                    <Button asChild className="h-11 rounded-xl bg-[#33381C] hover:bg-[#262A14] text-white font-bold px-8 text-xs shadow-md">
                      <Link to="/products">Browse Catalog</Link>
                    </Button>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
                    {wishlistItems.map((product) => (
                      <ProductCard key={product.id} {...product} />
                    ))}
                  </div>
                )}
              </motion.div>
            </TabsContent>

            {/* PREFERENCES TAB */}
            <TabsContent value="preferences" className="focus:outline-none">
              <motion.div 
                initial={{ opacity: 0, y: 15, filter: 'blur(4px)' }}
                animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
                transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1] as [number, number, number, number] }}
                className="max-w-xl"
              >
                <form onSubmit={updateProfile} className="space-y-5 rounded-3xl bg-white p-6 border border-[#A68D65]/15 shadow-xs">
                  <div>
                    <h2 className="font-serif text-lg font-bold text-[#33381C] border-b border-[#A68D65]/10 pb-3">Notification Settings</h2>
                    <p className="text-xs text-neutral-400 mt-1 leading-relaxed">Configure how you wish to receive alerts, promotions, and wishlist updates.</p>
                  </div>

                  <div className="space-y-4">
                    <div className="flex items-center justify-between border-b border-neutral-50 pb-3">
                      <div>
                        <h3 className="font-bold text-sm text-[#1D1E19]">Order Updates</h3>
                        <p className="text-xs text-neutral-500 mt-0.5">Receive immediate shipping, payment, and delivery status updates.</p>
                      </div>
                      <Switch checked={form.order_updates} onCheckedChange={(checked) => setForm({ ...form, order_updates: checked })} />
                    </div>

                    <div className="flex items-center justify-between border-b border-neutral-50 pb-3">
                      <div>
                        <h3 className="font-bold text-sm text-[#1D1E19]">Offers & Promotions</h3>
                        <p className="text-xs text-neutral-500 mt-0.5">Receive exclusive discounts, new product alerts, and artisan highlights.</p>
                      </div>
                      <Switch checked={form.marketing} onCheckedChange={(checked) => setForm({ ...form, marketing: checked })} />
                    </div>

                    <div className="flex items-center justify-between border-b border-neutral-50 pb-3">
                      <div>
                        <h3 className="font-bold text-sm text-[#1D1E19]">Wishlist Stock Alerts</h3>
                        <p className="text-xs text-neutral-500 mt-0.5">Get notified instantly when items in your wishlist are back in stock or running low.</p>
                      </div>
                      <Switch checked={profileSettings.wishlistStockAlerts} onCheckedChange={(checked) => saveSettingsField('wishlistStockAlerts', checked)} />
                    </div>

                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="font-bold text-sm text-[#1D1E19]">Promo SMS Alerts</h3>
                        <p className="text-xs text-neutral-550 mt-0.5">Receive short SMS notifications for key delivery updates (standard charges apply).</p>
                      </div>
                      <Switch checked={profileSettings.promoOffersAlerts} onCheckedChange={(checked) => saveSettingsField('promoOffersAlerts', checked)} />
                    </div>
                  </div>

                  <Button type="submit" className="rounded-xl bg-[#33381C] hover:bg-[#262A14] text-white font-bold h-11 px-6 shadow-md cursor-pointer mt-4">
                    Save Preferences
                  </Button>
                </form>
              </motion.div>
            </TabsContent>

            {/* PRIVACY TAB */}
            <TabsContent value="privacy" className="focus:outline-none">
              <motion.div
                initial={{ opacity: 0, y: 15, filter: 'blur(4px)' }}
                animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
                transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1] as [number, number, number, number] }}
                className="max-w-2xl space-y-6"
              >
                {/* Privacy Card */}
                <div className="rounded-3xl bg-white p-6 border border-[#A68D65]/15 shadow-xs space-y-5">
                  <div>
                    <h3 className="font-serif text-lg font-bold text-[#33381C] border-b border-[#A68D65]/10 pb-3">Privacy & Data Control</h3>
                    <p className="text-xs text-neutral-400 mt-1 leading-relaxed">Manage your personal information, request data archives, or handle account deactivation options.</p>
                  </div>

                  <div className="space-y-4">
                    <div className="flex flex-col sm:flex-row justify-between sm:items-center p-4 rounded-2xl bg-[#FBF7F1] border border-[#A68D65]/10 gap-3">
                      <div>
                        <h4 className="text-xs font-bold text-neutral-800 uppercase tracking-wider flex items-center"><Download className="h-4 w-4 mr-1.5 text-[#A68D65]" /> Export Member Data</h4>
                        <p className="text-[11px] text-neutral-500 mt-0.5">Download a secure copy of your profile settings and complete past order histories.</p>
                      </div>
                      <Button onClick={downloadUserData} size="sm" className="rounded-xl bg-[#33381C] hover:bg-[#262A14] text-white font-bold px-4 h-9">
                        Download JSON
                      </Button>
                    </div>

                    <div className="flex flex-col sm:flex-row justify-between sm:items-center p-4 rounded-2xl bg-amber-50/20 border border-amber-200/50 gap-3">
                      <div>
                        <h4 className="text-xs font-bold text-amber-900 uppercase tracking-wider flex items-center"><UserX className="h-4 w-4 mr-1.5 text-amber-700" /> Temporary Deactivation</h4>
                        <p className="text-[11px] text-amber-800 mt-0.5">Disable your account temporarily. You can reactivate it at any time by logging back in.</p>
                      </div>
                      <Button 
                        onClick={() => toast({ title: "Request Submitted", description: "A secure deactivation link has been dispatched to your email." })}
                        variant="outline" 
                        size="sm" 
                        className="rounded-xl border-amber-200 hover:bg-amber-50 text-amber-900 font-bold px-4 h-9"
                      >
                        Deactivate Account
                      </Button>
                    </div>

                    <div className="flex flex-col sm:flex-row justify-between sm:items-center p-4 rounded-2xl bg-red-50/20 border border-red-200/50 gap-3">
                      <div>
                        <h4 className="text-xs font-bold text-red-900 uppercase tracking-wider flex items-center"><Trash2 className="h-4 w-4 mr-1.5 text-red-700" /> Permanent Account Deletion</h4>
                        <p className="text-[11px] text-red-800 mt-0.5">Delete all your records, saved addresses, and loyalty profiles permanently. This is irreversible.</p>
                      </div>
                      <Button 
                        onClick={() => {
                          const confirm = window.confirm("Are you sure you want to request permanent account deletion? This action is irreversible.");
                          if (confirm) {
                            toast({ title: "Deletion request logged", description: "Our compliance team will review and process your deletion in 14 business days.", variant: "destructive" });
                          }
                        }}
                        variant="outline" 
                        size="sm" 
                        className="rounded-xl border-red-200 hover:bg-red-50 text-red-700 font-bold px-4 h-9"
                      >
                        Delete Request
                      </Button>
                    </div>
                  </div>
                </div>
              </motion.div>
            </TabsContent>
          </Tabs>
        </div>
      </main>
      <Footer />

      {/* CUSTOM AVATAR INTERACTIVE CROPPER MODAL */}
      <AnimatePresence>
        {isCropperOpen && cropperSrc && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/60 backdrop-blur-md"
              onClick={() => setIsCropperOpen(false)}
            />
            
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 15 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 15 }}
              transition={{ type: "spring", stiffness: 300, damping: 25 }}
              className="relative w-full max-w-md bg-white border border-neutral-100 rounded-3xl p-6 text-center shadow-2xl z-10 space-y-5 overflow-hidden"
            >
              <div>
                <h3 className="font-serif text-lg font-bold text-[#33381C]">Position & Scale Avatar</h3>
                <p className="text-xs text-neutral-400 mt-1">Drag to adjust the center, and use slider to crop the ideal framing.</p>
              </div>

              {/* Crop circular boundary container */}
              <div className="w-[240px] h-[240px] mx-auto rounded-full border-4 border-[#A68D65] overflow-hidden relative cursor-move select-none bg-neutral-900 shadow-inner flex items-center justify-center">
                {/* Bounding Mask grid for alignment */}
                <div className="absolute inset-0 border border-white/5 pointer-events-none rounded-full" />
                
                <img
                  src={cropperSrc}
                  alt="Crop preview"
                  onMouseDown={handleDragStart}
                  onMouseMove={handleDragMove}
                  onMouseUp={handleDragEnd}
                  onMouseLeave={handleDragEnd}
                  onTouchStart={handleDragStart}
                  onTouchMove={handleDragMove}
                  onTouchEnd={handleDragEnd}
                  className="absolute max-w-none max-h-none pointer-events-auto"
                  style={{
                    left: '50%',
                    top: '50%',
                    transform: `translate(-50%, -50%) translate(${cropPosition.x}px, ${cropPosition.y}px) scale(${cropScale})`,
                    transformOrigin: 'center',
                    cursor: isDragging ? 'grabbing' : 'grab',
                  }}
                />
              </div>

              {/* Crop Controls */}
              <div className="space-y-2 px-4">
                <div className="flex justify-between items-center text-[10px] font-bold text-neutral-400 uppercase tracking-wider">
                  <span>Zoom Level</span>
                  <span>{cropScale.toFixed(2)}x</span>
                </div>
                <input
                  type="range"
                  min="1"
                  max="3"
                  step="0.01"
                  value={cropScale}
                  onChange={(e) => setCropScale(Number(e.target.value))}
                  className="w-full accent-[#33381C] bg-[#F7EEE4] rounded-lg h-1.5 appearance-none outline-none cursor-pointer"
                />
              </div>

              {/* Actions */}
              <div className="flex gap-3 pt-2">
                <Button 
                  onClick={() => setIsCropperOpen(false)} 
                  variant="outline" 
                  disabled={uploadingCropped}
                  className="flex-1 h-11 rounded-xl text-xs font-bold border-neutral-200"
                >
                  Cancel
                </Button>
                <Button 
                  onClick={saveCroppedAvatar} 
                  disabled={uploadingCropped}
                  className="flex-1 h-11 rounded-xl text-xs font-bold bg-[#33381C] hover:bg-[#262A14] text-white shadow-md"
                >
                  {uploadingCropped ? <Loader2 className="h-4 w-4 animate-spin mx-auto" /> : 'Save Profile Photo'}
                </Button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default Account;
