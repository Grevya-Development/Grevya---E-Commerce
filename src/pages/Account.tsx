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
  const [password, setPassword] = useState('');

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

      setOrders(orderRows || []);
      setAddresses((addressRows || []) as Address[]);
    };

    fetchAccountData();
  }, [user]);

  const updateProfile = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!user) return;
    setSaving(true);

    try {
      const { error } = await supabase.from('profiles').upsert({
        id: user.id,
        username: form.username,
        full_name: form.full_name,
        phone: form.phone,
        email: form.email,
        preferences: {
          marketing: form.marketing,
          order_updates: form.order_updates,
        },
      });
      if (error) throw error;

      if (form.email && form.email !== user.email) {
        const { error: emailError } = await supabase.auth.updateUser({ email: form.email });
        if (emailError) throw emailError;
      }

      await refreshProfile();
      toast({ title: 'Profile saved', description: 'Your account details are up to date.' });
    } catch (error: any) {
      toast({ title: 'Could not save profile', description: error.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const uploadAvatar = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !user) return;

    const extension = file.name.split('.').pop();
    const path = `${user.id}/avatar-${Date.now()}.${extension}`;
    const { error: uploadError } = await supabase.storage.from('avatars').upload(path, file, { upsert: true });

    if (uploadError) {
      toast({ title: 'Upload failed', description: uploadError.message, variant: 'destructive' });
      return;
    }

    const { data } = supabase.storage.from('avatars').getPublicUrl(path);
    const { error } = await supabase.from('profiles').upsert({ id: user.id, avatar_url: data.publicUrl });

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
      label: address.label,
      full_name: address.full_name,
      phone: address.phone,
      address_line1: address.address_line1,
      address_line2: (address as any).address_line2 || '',
      city: address.city,
      state: address.state,
      pincode: address.pincode,
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

    const payload = {
      label: addressForm.label,
      full_name: addressForm.full_name,
      phone: cleanPhone,
      address_line1: addressForm.address_line1,
      address_line2: addressForm.address_line2,
      city: addressForm.city,
      state: addressForm.state,
      pincode: cleanPincode,
      postal_code: cleanPincode,
      landmark: addressForm.landmark,
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

      setAddresses((current) =>
        current.map((addr) => (addr.id === editingAddressId ? (data as Address) : addr))
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

      setAddresses((current) => [data as Address, ...current]);
      cancelEditAddress();
      toast({ title: 'Address saved', description: 'It is ready for your next checkout.' });
    }
  };

  const updatePassword = async (event: React.FormEvent) => {
    event.preventDefault();
    const { error } = await supabase.auth.updateUser({ password });

    if (error) {
      toast({ title: 'Password update failed', description: error.message, variant: 'destructive' });
      return;
    }

    setPassword('');
    toast({ title: 'Password updated' });
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
                  <p className="text-sm font-semibold uppercase tracking-[0.2em] text-amber-200">My Account</p>
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
                  <p className="text-2xl font-bold">RLS</p>
                  <p className="text-xs text-white/70">Protected</p>
                </div>
              </div>
            </div>
          </motion.div>

          <Tabs defaultValue="overview" className="space-y-6">
            <TabsList className="flex h-auto w-full flex-wrap justify-start rounded-2xl bg-white p-2 shadow-sm">
              <TabsTrigger value="overview"><Home className="mr-2 h-4 w-4" />Overview</TabsTrigger>
              <TabsTrigger value="profile"><UserRound className="mr-2 h-4 w-4" />Profile</TabsTrigger>
              <TabsTrigger value="addresses"><MapPin className="mr-2 h-4 w-4" />Addresses</TabsTrigger>
              <TabsTrigger value="security"><Shield className="mr-2 h-4 w-4" />Security</TabsTrigger>
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
                          <p className="text-sm capitalize text-neutral-500">{order.status}</p>
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
              <form onSubmit={updateProfile} className="rounded-2xl bg-white p-6 shadow-sm">
                <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center">
                  <Avatar className="h-16 w-16">
                    <AvatarImage src={profile?.avatar_url || undefined} />
                    <AvatarFallback>{(form.full_name || 'G').slice(0, 1).toUpperCase()}</AvatarFallback>
                  </Avatar>
                  <div>
                    <Label htmlFor="avatar">Profile image</Label>
                    <Input id="avatar" type="file" accept="image/*" onChange={uploadAvatar} className="mt-2" />
                  </div>
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  <div><Label>Full name</Label><Input value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} className="mt-2" /></div>
                  <div><Label>Username</Label><Input value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} className="mt-2" /></div>
                  <div><Label>Email</Label><Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="mt-2" /></div>
                  <div><Label>Phone</Label><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="mt-2" /></div>
                </div>
                <Button type="submit" disabled={saving} className="mt-6 rounded-xl bg-green-800 hover:bg-green-900">
                  {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Save profile
                </Button>
              </form>
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

            <TabsContent value="security">
              <form onSubmit={updatePassword} className="max-w-xl rounded-2xl bg-white p-6 shadow-sm">
                <h2 className="mb-4 text-xl font-bold">Update password</h2>
                <Label>New password</Label>
                <Input type="password" minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} className="mt-2" />
                <Button disabled={!password} className="mt-6 rounded-xl bg-green-800 hover:bg-green-900">Update password</Button>
                <Button type="button" variant="outline" className="ml-3 mt-6 rounded-xl" onClick={signOut}>
                  <LogOut className="mr-2 h-4 w-4" />
                  Logout
                </Button>
              </form>
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
