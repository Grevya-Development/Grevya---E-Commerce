import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import { Button } from '@/components/ui/button';
import { Check, CreditCard, IndianRupee, Loader2 } from 'lucide-react';
import { toast } from '@/components/ui/use-toast';
import { useCartStore } from '@/store/useCartStore';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/context/AuthContext';
import { openRazorpayCheckout, RazorpayResponse } from '@/lib/razorpay';

interface PaymentMethod {
  id: string;
  name: string;
  description: string;
  icon: React.ReactNode;
}

interface Address {
  id: string;
  label?: string;
  full_name: string;
  phone: string;
  address_line1: string;
  address_line2?: string;
  landmark?: string;
  city: string;
  state: string;
  pincode: string;
  postal_code?: string;
  country: string;
  is_default?: boolean;
}

// ============================================================================
// CENTRALIZED ADDRESS NORMALIZATION HELPERS
// ============================================================================
const normalizeAddressForUI = (addr: any): Address => {
  const line1 = addr.address_line_1 || addr.address_line1 || '';
  const line2 = addr.address_line_2 || addr.address_line2 || '';
  
  const match = (line1 || '').match(/^\[(.*?)\]\s*(.*)$/);
  const label = match ? match[1] : (addr.label || 'Home');
  const address_line1 = match ? match[2] : line1;

  let cleanLine2 = line2;
  let landmark = addr.landmark || '';
  if (!landmark && cleanLine2.includes(', Landmark: ')) {
    const parts = cleanLine2.split(', Landmark: ');
    cleanLine2 = parts[0];
    landmark = parts[1];
  }

  return {
    id: addr.id,
    label,
    full_name: addr.full_name || '',
    phone: addr.phone || '',
    address_line1,
    address_line2: cleanLine2,
    landmark,
    city: addr.city || '',
    state: addr.state || '',
    pincode: addr.postal_code || addr.pincode || '',
    postal_code: addr.postal_code || addr.pincode || '',
    country: addr.country || 'India',
    is_default: !!addr.is_default,
  };
};

const normalizeAddressForDB = (info: any, userId: string) => {
  const cleanPhone = info.phone.replace(/\D/g, '');
  const cleanPincode = info.pincode.replace(/\D/g, '');
  const labelTag = info.addressType ? `[${info.addressType}] ` : '';

  return {
    user_id: userId,
    full_name: info.fullName.trim() || null,
    phone: cleanPhone || null,
    address_line_1: (labelTag + info.addressLine1).trim() || null,
    address_line1: (labelTag + info.addressLine1).trim() || null,
    address_line_2: (info.addressLine2 + (info.landmark ? `, Landmark: ${info.landmark}` : '')).trim() || null,
    address_line2: (info.addressLine2 + (info.landmark ? `, Landmark: ${info.landmark}` : '')).trim() || null,
    landmark: info.landmark.trim() || null,
    city: info.city.trim() || null,
    state: info.state.trim() || null,
    postal_code: cleanPincode || null,
    pincode: cleanPincode || null,
    country: info.country.trim() || 'India',
    label: info.addressType || 'Home',
    is_default: !!info.isDefault,
  };
};

// ============================================================================
// SCHEMA-RESILIENT RETRY WRAPPERS (FALLBACK PRUNING MECHANISM WITH WARNINGS)
// ============================================================================
const safeInsertOrder = async (orderPayload: any) => {
  let attemptData = { ...orderPayload };
  while (true) {
    const { data, error } = await supabase
      .from('orders')
      .insert(attemptData)
      .select()
      .single();

    if (!error) {
      return { data, error: null };
    }

    const errorMsg = error.message || '';
    const matchSchemaCache = errorMsg.match(/Could not find the '([^']+)' column/);
    const matchNotExist = errorMsg.match(/column "([^"]+)" of relation "[^"]+" does not exist/);
    const missingColumn = (matchSchemaCache && matchSchemaCache[1]) || (matchNotExist && matchNotExist[1]);

    if (missingColumn && missingColumn in attemptData) {
      console.warn(`[Grevya Dev Resilience] Column '${missingColumn}' not found in orders database. Retrying order save without it.`);
      delete attemptData[missingColumn];
      if (Object.keys(attemptData).length === 0) {
        return { data: null, error };
      }
      continue;
    }

    return { data: null, error };
  }
};

const safeInsertOrderItems = async (itemsPayload: any[]) => {
  let attemptData = itemsPayload.map(item => ({ ...item }));
  while (true) {
    const { error } = await supabase.from('order_items').insert(attemptData);
    if (!error) {
      return { error: null };
    }

    const errorMsg = error.message || '';
    const matchSchemaCache = errorMsg.match(/Could not find the '([^']+)' column/);
    const matchNotExist = errorMsg.match(/column "([^"]+)" of relation "[^"]+" does not exist/);
    const missingColumn = (matchSchemaCache && matchSchemaCache[1]) || (matchNotExist && matchNotExist[1]);

    if (missingColumn) {
      let keyExisted = false;
      attemptData = attemptData.map(item => {
        if (missingColumn in item) {
          keyExisted = true;
          const { [missingColumn]: _, ...rest } = item;
          return rest;
        }
        return item;
      });
      if (keyExisted) {
        console.warn(`[Grevya Dev Resilience] Column '${missingColumn}' not found in order_items database. Retrying insert.`);
        if (attemptData.length === 0 || Object.keys(attemptData[0]).length === 0) {
          return { error };
        }
        continue;
      }
    }

    return { error };
  }
};

const safeInsertNotification = async (notifPayload: any) => {
  let attemptData = { ...notifPayload };
  while (true) {
    const { error } = await supabase.from('notifications').insert(attemptData);
    if (!error) {
      return { error: null };
    }

    const errorMsg = error.message || '';
    const matchSchemaCache = errorMsg.match(/Could not find the '([^']+)' column/);
    const matchNotExist = errorMsg.match(/column "([^"]+)" of relation "[^"]+" does not exist/);
    const missingColumn = (matchSchemaCache && matchSchemaCache[1]) || (matchNotExist && matchNotExist[1]);

    if (missingColumn && missingColumn in attemptData) {
      console.warn(`[Grevya Dev Resilience] Column '${missingColumn}' not found in notifications database. Retrying notification insert without it.`);
      delete attemptData[missingColumn];
      if (Object.keys(attemptData).length === 0) {
        return { error };
      }
      continue;
    }

    return { error };
  }
};

const safeInsertAddress = async (addressPayload: any) => {
  let attemptData = { ...addressPayload };
  while (true) {
    const { data, error } = await supabase
      .from('addresses')
      .insert(attemptData)
      .select()
      .single();

    if (!error) {
      return { data, error: null };
    }

    const errorMsg = error.message || '';
    const matchSchemaCache = errorMsg.match(/Could not find the '([^']+)' column/);
    const matchNotExist = errorMsg.match(/column "([^"]+)" of relation "[^"]+" does not exist/);
    const missingColumn = (matchSchemaCache && matchSchemaCache[1]) || (matchNotExist && matchNotExist[1]);

    if (missingColumn && missingColumn in attemptData) {
      console.warn(`[Grevya Dev Resilience] Column '${missingColumn}' not found in addresses database. Retrying address save without it.`);
      delete attemptData[missingColumn];
      if (Object.keys(attemptData).length === 0) {
        return { data: null, error };
      }
      continue;
    }

    return { data: null, error };
  }
};

const Checkout = () => {
  const navigate = useNavigate();
  const { user, profile, loading: authLoading } = useAuth();
  const [processing, setProcessing] = useState(false);
  const [signingInAnonymously, setSigningInAnonymously] = useState(false);
  const [selectedPayment, setSelectedPayment] = useState<string>('razorpay');
  const [step, setStep] = useState(1); // 1 = Delivery, 2 = Payment, 3 = Review
  const [deliveryInfo, setDeliveryInfo] = useState({
    fullName: '',
    email: '',
    phone: '',
    addressLine1: '',
    addressLine2: '',
    landmark: '',
    city: '',
    state: '',
    pincode: '',
    country: 'India',
    addressType: 'Home',
    isDefault: false,
    saveToAccount: false,
  });

  const [savedAddresses, setSavedAddresses] = useState<Address[]>([]);
  const [selectedAddressId, setSelectedAddressId] = useState<string>('new');

  const cartItems = useCartStore((state) => state.items);
  const getSubtotal = useCartStore((state) => state.getSubtotal);
  const clearCart = useCartStore((state) => state.clearCart);

  useEffect(() => {
    const handleAnonymousAuth = async () => {
      const { data } = await supabase.auth.getSession();
      if (!data.session) {
        setSigningInAnonymously(true);
        try {
          await supabase.auth.signInAnonymously();
        } catch (err) {
          console.error('Anonymous sign-in failed:', err);
        } finally {
          setSigningInAnonymously(false);
        }
      }
    };
    
    if (!authLoading) {
      handleAnonymousAuth();
    }
  }, [authLoading]);

  const applySavedAddress = (addr: Address) => {
    let cleanLine2 = addr.address_line2 || '';
    let landmark = addr.landmark || '';
    if (!landmark && cleanLine2.includes(', Landmark: ')) {
      const parts = cleanLine2.split(', Landmark: ');
      cleanLine2 = parts[0];
      landmark = parts[1];
    }

    setDeliveryInfo({
      fullName: addr.full_name || '',
      email: user?.email || '',
      phone: addr.phone || '',
      addressLine1: addr.address_line1 || '',
      addressLine2: cleanLine2,
      landmark: landmark,
      city: addr.city || '',
      state: addr.state || '',
      pincode: addr.pincode || '',
      country: addr.country || 'India',
      addressType: addr.label || 'Home',
      isDefault: !!addr.is_default,
      saveToAccount: false,
    });
  };

  useEffect(() => {
    const fetchSavedAddresses = async () => {
      if (!user || user.is_anonymous) return;
      try {
        const { data, error } = await supabase
          .from('addresses')
          .select('*')
          .eq('user_id', user.id)
          .order('is_default', { ascending: false });
        
        if (error) throw error;
        
        const parsed = (data || []).map((addr: any) => normalizeAddressForUI(addr));
        setSavedAddresses(parsed);
        
        const defaultAddr = parsed.find(a => a.is_default);
        if (defaultAddr) {
          setSelectedAddressId(defaultAddr.id);
          applySavedAddress(defaultAddr);
        } else if (parsed.length > 0) {
          setSelectedAddressId(parsed[0].id);
          applySavedAddress(parsed[0]);
        }
      } catch (err) {
        console.error('Failed to fetch saved addresses:', err);
      }
    };

    fetchSavedAddresses();
  }, [user]);

  useEffect(() => {
    const fullName = profile?.full_name || user?.user_metadata?.full_name || '';
    setDeliveryInfo((current) => ({
      ...current,
      fullName: current.fullName || fullName,
      email: current.email || profile?.email || user?.email || '',
      phone: current.phone || profile?.phone || '',
    }));
  }, [profile, user]);

  const paymentMethods: PaymentMethod[] = [
    {
      id: 'razorpay',
      name: 'Razorpay Secure Checkout',
      description: 'Pay using UPI, cards, wallets, or net banking',
      icon: <IndianRupee className="h-8 w-8" />
    },
    {
      id: 'card',
      name: 'Card via Razorpay',
      description: 'Razorpay will securely collect your card details',
      icon: <CreditCard className="h-8 w-8" />
    },
    {
      id: 'cod',
      name: 'Cash on Delivery',
      description: 'Pay with cash when your order arrives',
      icon: <IndianRupee className="h-8 w-8" />
    }
  ];

  const createOrder = async (paymentStatus: string, paymentReference?: RazorpayResponse) => {
    if (!user) throw new Error('Please sign in before checkout.');

    const orderReference = `GI-${Date.now()}`;
    const subtotal = getSubtotal();

    const spaceIndex = deliveryInfo.fullName.indexOf(' ');
    const firstName = spaceIndex !== -1 ? deliveryInfo.fullName.substring(0, spaceIndex) : deliveryInfo.fullName;
    const lastName = spaceIndex !== -1 ? deliveryInfo.fullName.substring(spaceIndex + 1) : '';
    const computedAddress = `${deliveryInfo.addressLine1}${deliveryInfo.addressLine2 ? ', ' + deliveryInfo.addressLine2 : ''}${deliveryInfo.landmark ? ', Landmark: ' + deliveryInfo.landmark : ''}`;

    const shippingPayload = {
      ...deliveryInfo,
      firstName,
      lastName,
      address: computedAddress,
    };

    if (user && !user.is_anonymous && selectedAddressId === 'new' && deliveryInfo.saveToAccount) {
      try {
        const addressPayload = normalizeAddressForDB(deliveryInfo, user.id);
        if (deliveryInfo.isDefault) {
          await supabase
            .from('addresses')
            .update({ is_default: false })
            .eq('user_id', user.id);
        }
        await safeInsertAddress(addressPayload);
      } catch (addrErr) {
        console.error('Failed to save address to user account:', addrErr);
      }
    }

    const orderPayload = {
      user_id: user.id,
      order_number: orderReference,
      total_amount: subtotal,
      total: subtotal,
      status: paymentStatus === 'paid' ? 'confirmed' : 'pending',
      order_status: paymentStatus === 'paid' ? 'confirmed' : 'pending',
      payment_status: paymentStatus,
      payment_method: selectedPayment,
      payment_reference: paymentReference || null,
      shipping_address: shippingPayload,
      estimated_delivery: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString(),
    };

    const { data: orderData, error: orderError } = await safeInsertOrder(orderPayload);
    if (orderError) throw orderError;
    if (!orderData) throw new Error('Failed to create order record.');

    const orderItems = cartItems.map(item => ({
      order_id: orderData.id,
      product_id: item.id,
      product_name: item.name,
      product_image: item.image || (item as any).image_url,
      quantity: item.quantity,
      price: item.price
    }));

    const { error: itemsError } = await safeInsertOrderItems(orderItems);
    if (itemsError) throw itemsError;

    const notifPayload = {
      user_id: user.id,
      message: `Order ${orderReference} has been placed successfully!`,
      type: 'order',
      title: 'Order Placed',
      is_read: false,
      read: false
    };

    const { error: notifError } = await safeInsertNotification(notifPayload);
    if (notifError) {
      console.warn('Failed to insert notification:', notifError);
    }

    clearCart();
    navigate(`/payment-success?order=${orderData.id}`);
  };

  const handlePayment = async (event: React.FormEvent) => {
    event.preventDefault();
    if (processing) return;

    if (cartItems.length === 0) {
      toast({ title: 'Cart empty', description: 'Add some items before checking out.', variant: 'destructive' });
      return;
    }

    setProcessing(true);

    try {
      if (selectedPayment === 'cod') {
        await createOrder('pending');
        toast({ title: 'Order placed', description: 'Your order is pending confirmation.' });
        return;
      }

      await openRazorpayCheckout({
        amount: getSubtotal(),
        name: deliveryInfo.fullName || 'Grevya Customer',
        email: deliveryInfo.email,
        phone: deliveryInfo.phone,
        orderReference: `GI-${Date.now()}`,
        onSuccess: async (response) => {
          try {
            await createOrder('paid', response);
            toast({ title: 'Payment successful', description: 'Your order has been confirmed.' });
          } catch (error: any) {
            toast({ title: 'Payment captured, order sync failed', description: error.message, variant: 'destructive' });
          } finally {
            setProcessing(false);
          }
        },
        onFailure: (reason) => {
          toast({ title: 'Payment not completed', description: reason, variant: 'destructive' });
          setProcessing(false);
        },
      });
    } catch (error: any) {
      toast({ title: 'Order failed', description: error.message || 'Failed to process your order.', variant: 'destructive' });
      setProcessing(false);
    } finally {
      if (selectedPayment === 'cod') setProcessing(false);
    }
  };

  const validateStep1 = () => {
    const phonePattern = /^[6-9]\d{9}$/;
    const cleanPhone = deliveryInfo.phone.replace(/\D/g, '');
    const pincodePattern = /^\d{6}$/;
    const cleanPincode = deliveryInfo.pincode.replace(/\D/g, '');

    if (selectedAddressId !== 'new') {
      return true;
    }

    if (
      !deliveryInfo.fullName.trim() ||
      !deliveryInfo.email.trim() ||
      !deliveryInfo.phone.trim() ||
      !deliveryInfo.addressLine1.trim() ||
      !deliveryInfo.city.trim() ||
      !deliveryInfo.pincode.trim() ||
      !deliveryInfo.state.trim()
    ) {
      toast({
        title: 'Incomplete Details',
        description: 'Please complete all required delivery information fields.',
        variant: 'destructive',
      });
      return false;
    }

    if (!phonePattern.test(cleanPhone)) {
      toast({
        title: 'Invalid phone number',
        description: 'Please enter a valid 10-digit Indian mobile number.',
        variant: 'destructive',
      });
      return false;
    }

    if (!pincodePattern.test(cleanPincode)) {
      toast({
        title: 'Invalid PIN code',
        description: 'Please enter a valid 6-digit postal code.',
        variant: 'destructive',
      });
      return false;
    }

    return true;
  };

  if (authLoading || signingInAnonymously) {
    return (
      <div className="flex flex-col min-h-screen">
        <Navbar />
        <main className="flex-grow bg-cream/30 py-16 flex items-center justify-center">
          <div className="text-center bg-white p-8 rounded-3xl shadow-sm border border-neutral-100 max-w-sm w-full mx-4">
            <div className="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-4 border-green-100 border-t-green-800" />
            <p className="text-neutral-600 font-medium">Preparing secure checkout...</p>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen">
      <Navbar />
      <main className="flex-grow bg-cream/30 py-16">
        <form onSubmit={handlePayment} className="container mx-auto px-4">
          {/* Stepped progress indicator */}
          <div className="flex items-center justify-between max-w-lg mx-auto mb-12 w-full bg-white p-4 rounded-2xl shadow-sm border border-neutral-100/50">
            {[
              { num: 1, label: 'Delivery' },
              { num: 2, label: 'Payment' },
              { num: 3, label: 'Confirm' }
            ].map((s, idx) => (
              <React.Fragment key={s.num}>
                {idx > 0 && <div className={`flex-1 h-0.5 mx-2 ${step > idx ? 'bg-green-700' : 'bg-neutral-100'}`} />}
                <button
                  type="button"
                  onClick={() => {
                    if (s.num < step) setStep(s.num);
                    else if (s.num === 2 && step === 1) { if (validateStep1()) setStep(2); }
                    else if (s.num === 3 && step === 2) setStep(3);
                  }}
                  className="flex items-center gap-2 text-left focus:outline-none"
                >
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs transition-colors ${
                    step >= s.num ? 'bg-green-800 text-white shadow-md shadow-green-950/10' : 'bg-neutral-50 text-neutral-400 border border-neutral-100'
                  }`}>
                    {s.num}
                  </div>
                  <span className={`text-[10px] uppercase font-bold tracking-wider hidden sm:inline ${
                    step >= s.num ? 'text-neutral-900' : 'text-neutral-400'
                  }`}>{s.label}</span>
                </button>
              </React.Fragment>
            ))}
          </div>

          <div className="mx-auto grid max-w-6xl gap-8 lg:grid-cols-[1.35fr_0.85fr]">
            <div>
              <h1 className="text-4xl font-extrabold text-neutral-900 mb-2">Checkout</h1>
              <p className="mb-8 text-neutral-500">Secure delivery details, payment, and order confirmation.</p>

              {/* STEP 1: DELIVERY FORM */}
              {step === 1 && (
                <div className="bg-white rounded-2xl shadow-sm p-6 mb-8 border border-neutral-100/50 space-y-6">
                  <h2 className="text-xl font-semibold text-brown-800">Delivery Information</h2>

                  {/* Saved Addresses Selector */}
                  {user && !user.is_anonymous && savedAddresses.length > 0 && (
                    <div className="space-y-3">
                      <label className="block text-sm font-semibold text-neutral-700">Ship to a Saved Address</label>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {savedAddresses.map((addr) => (
                          <div
                            key={addr.id}
                            onClick={() => {
                              setSelectedAddressId(addr.id);
                              applySavedAddress(addr);
                            }}
                            className={`p-4 rounded-2xl border-2 cursor-pointer transition-all ${
                              selectedAddressId === addr.id
                                ? 'border-green-800 bg-green-50/20 shadow-sm'
                                : 'border-neutral-200 hover:border-neutral-300 bg-white'
                            }`}
                          >
                            <div className="flex items-center justify-between mb-2">
                              <span className="font-bold text-neutral-800 text-xs capitalize">[{addr.label || 'Address'}]</span>
                              {addr.is_default && (
                                <span className="text-[9px] bg-green-100 text-green-800 px-2 py-0.5 rounded-full font-bold">
                                  Default
                                </span>
                              )}
                              {selectedAddressId === addr.id && (
                                <Check className="h-4 w-4 text-green-800 font-bold" />
                              )}
                            </div>
                            <p className="text-sm font-semibold text-neutral-850">{addr.full_name}</p>
                            <p className="text-xs text-neutral-500 mt-1 leading-relaxed">
                              {addr.address_line1}
                              {addr.address_line2 ? `, ${addr.address_line2}` : ''}
                              {addr.landmark ? ` (Near ${addr.landmark})` : ''}
                              , {addr.city}, {addr.state} - {addr.pincode}
                            </p>
                            <p className="text-xs text-neutral-600 font-medium mt-1">Phone: {addr.phone}</p>
                          </div>
                        ))}

                        <div
                          onClick={() => {
                            setSelectedAddressId('new');
                            setDeliveryInfo({
                              fullName: profile?.full_name || user?.user_metadata?.full_name || '',
                              email: profile?.email || user?.email || '',
                              phone: profile?.phone || '',
                              addressLine1: '',
                              addressLine2: '',
                              landmark: '',
                              city: '',
                              state: '',
                              pincode: '',
                              country: 'India',
                              addressType: 'Home',
                              isDefault: false,
                              saveToAccount: false,
                            });
                          }}
                          className={`p-4 rounded-2xl border-2 border-dashed cursor-pointer transition-all flex flex-col items-center justify-center min-h-[120px] ${
                            selectedAddressId === 'new'
                              ? 'border-green-800 bg-green-50/20'
                              : 'border-neutral-200 hover:border-neutral-300 bg-white'
                          }`}
                        >
                          <span className="text-sm font-bold text-green-800">+ Use a new address</span>
                          <span className="text-xs text-neutral-400 mt-1 text-center">Enter a custom shipping destination</span>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Redesigned Structured Form */}
                  {selectedAddressId === 'new' && (
                    <div className="space-y-4 pt-4 border-t border-neutral-100/70">
                      <h3 className="text-base font-semibold text-neutral-800">Add Shipping Destination</h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label htmlFor="fullName" className="block text-xs font-semibold text-neutral-600 mb-1 uppercase tracking-wider">Full Name *</label>
                          <input
                            id="fullName"
                            type="text"
                            value={deliveryInfo.fullName}
                            onChange={(e) => setDeliveryInfo({ ...deliveryInfo, fullName: e.target.value })}
                            className="w-full rounded-xl border border-gray-200 p-3 focus:outline-none focus:ring-2 focus:ring-green-700 bg-neutral-50/30 text-sm"
                            required
                          />
                        </div>
                        <div>
                          <label htmlFor="phone" className="block text-xs font-semibold text-neutral-600 mb-1 uppercase tracking-wider">Phone Number *</label>
                          <input
                            id="phone"
                            type="tel"
                            value={deliveryInfo.phone}
                            onChange={(e) => setDeliveryInfo({ ...deliveryInfo, phone: e.target.value })}
                            placeholder="10-digit mobile number"
                            className="w-full rounded-xl border border-gray-200 p-3 focus:outline-none focus:ring-2 focus:ring-green-700 bg-neutral-50/30 text-sm"
                            required
                          />
                        </div>
                        <div className="md:col-span-2">
                          <label htmlFor="email" className="block text-xs font-semibold text-neutral-600 mb-1 uppercase tracking-wider">Email Address *</label>
                          <input
                            id="email"
                            type="email"
                            value={deliveryInfo.email}
                            onChange={(e) => setDeliveryInfo({ ...deliveryInfo, email: e.target.value })}
                            className="w-full rounded-xl border border-gray-200 p-3 focus:outline-none focus:ring-2 focus:ring-green-700 bg-neutral-50/30 text-sm"
                            required
                          />
                        </div>
                        <div className="md:col-span-2">
                          <label htmlFor="addressLine1" className="block text-xs font-semibold text-neutral-600 mb-1 uppercase tracking-wider">Address Line 1 (Flat, House, Building, Apt) *</label>
                          <input
                            id="addressLine1"
                            type="text"
                            value={deliveryInfo.addressLine1}
                            onChange={(e) => setDeliveryInfo({ ...deliveryInfo, addressLine1: e.target.value })}
                            className="w-full rounded-xl border border-gray-200 p-3 focus:outline-none focus:ring-2 focus:ring-green-700 bg-neutral-50/30 text-sm"
                            required
                          />
                        </div>
                        <div className="md:col-span-2">
                          <label htmlFor="addressLine2" className="block text-xs font-semibold text-neutral-600 mb-1 uppercase tracking-wider">Address Line 2 (Area, Street, Village) (Optional)</label>
                          <input
                            id="addressLine2"
                            type="text"
                            value={deliveryInfo.addressLine2}
                            onChange={(e) => setDeliveryInfo({ ...deliveryInfo, addressLine2: e.target.value })}
                            className="w-full rounded-xl border border-gray-200 p-3 focus:outline-none focus:ring-2 focus:ring-green-700 bg-neutral-50/30 text-sm"
                          />
                        </div>
                        <div>
                          <label htmlFor="landmark" className="block text-xs font-semibold text-neutral-600 mb-1 uppercase tracking-wider">Landmark (Optional)</label>
                          <input
                            id="landmark"
                            type="text"
                            value={deliveryInfo.landmark}
                            onChange={(e) => setDeliveryInfo({ ...deliveryInfo, landmark: e.target.value })}
                            className="w-full rounded-xl border border-gray-200 p-3 focus:outline-none focus:ring-2 focus:ring-green-700 bg-neutral-50/30 text-sm"
                          />
                        </div>
                        <div>
                          <label htmlFor="city" className="block text-xs font-semibold text-neutral-600 mb-1 uppercase tracking-wider">City *</label>
                          <input
                            id="city"
                            type="text"
                            value={deliveryInfo.city}
                            onChange={(e) => setDeliveryInfo({ ...deliveryInfo, city: e.target.value })}
                            className="w-full rounded-xl border border-gray-200 p-3 focus:outline-none focus:ring-2 focus:ring-green-700 bg-neutral-50/30 text-sm"
                            required
                          />
                        </div>
                        <div>
                          <label htmlFor="pincode" className="block text-xs font-semibold text-neutral-600 mb-1 uppercase tracking-wider">PIN Code *</label>
                          <input
                            id="pincode"
                            type="text"
                            value={deliveryInfo.pincode}
                            onChange={(e) => setDeliveryInfo({ ...deliveryInfo, pincode: e.target.value })}
                            placeholder="6-digit postal code"
                            className="w-full rounded-xl border border-gray-200 p-3 focus:outline-none focus:ring-2 focus:ring-green-700 bg-neutral-50/30 text-sm"
                            required
                          />
                        </div>
                        <div>
                          <label htmlFor="state" className="block text-xs font-semibold text-neutral-600 mb-1 uppercase tracking-wider">State *</label>
                          <input
                            id="state"
                            type="text"
                            value={deliveryInfo.state}
                            onChange={(e) => setDeliveryInfo({ ...deliveryInfo, state: e.target.value })}
                            className="w-full rounded-xl border border-gray-200 p-3 focus:outline-none focus:ring-2 focus:ring-green-700 bg-neutral-50/30 text-sm"
                            required
                          />
                        </div>
                        <div>
                          <label htmlFor="country" className="block text-xs font-semibold text-neutral-600 mb-1 uppercase tracking-wider">Country *</label>
                          <input
                            id="country"
                            type="text"
                            value={deliveryInfo.country}
                            onChange={(e) => setDeliveryInfo({ ...deliveryInfo, country: e.target.value })}
                            className="w-full rounded-xl border border-gray-200 p-3 focus:outline-none focus:ring-2 focus:ring-green-700 bg-neutral-50/30 text-sm"
                            required
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-semibold text-neutral-600 mb-2 uppercase tracking-wider">Address Type</label>
                          <div className="flex gap-2">
                            {['Home', 'Work', 'Other'].map((type) => (
                              <button
                                key={type}
                                type="button"
                                onClick={() => setDeliveryInfo({ ...deliveryInfo, addressType: type })}
                                className={`flex-1 py-2 px-3 text-sm font-semibold rounded-xl border transition-all ${
                                  deliveryInfo.addressType === type
                                    ? 'border-green-800 bg-green-50 text-green-800 shadow-sm'
                                    : 'border-gray-200 bg-white hover:bg-neutral-50 text-neutral-600'
                                }`}
                              >
                                {type}
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>

                      {user && !user.is_anonymous && (
                        <div className="mt-4 space-y-2 border-t border-neutral-100 pt-4">
                          <label className="flex items-center gap-2 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={deliveryInfo.saveToAccount}
                              onChange={(e) => setDeliveryInfo({ ...deliveryInfo, saveToAccount: e.target.checked })}
                              className="rounded border-gray-300 text-green-800 focus:ring-green-700 h-4 w-4"
                            />
                            <span className="text-sm font-medium text-neutral-700">Save this address to my account</span>
                          </label>

                          {deliveryInfo.saveToAccount && (
                            <label className="flex items-center gap-2 cursor-pointer ml-6">
                              <input
                                type="checkbox"
                                checked={deliveryInfo.isDefault}
                                onChange={(e) => setDeliveryInfo({ ...deliveryInfo, isDefault: e.target.checked })}
                                className="rounded border-gray-300 text-green-800 focus:ring-green-700 h-4 w-4"
                              />
                              <span className="text-sm font-medium text-neutral-600">Set as default address</span>
                            </label>
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  <Button
                    type="button"
                    onClick={() => { if (validateStep1()) setStep(2); }}
                    className="w-full h-12 rounded-xl text-base font-bold bg-green-800 hover:bg-green-900 mt-6 shadow-md"
                  >
                    Continue to Payment
                  </Button>
                </div>
              )}

              {/* STEP 2: PAYMENT FORM */}
              {step === 2 && (
                <div className="bg-white rounded-2xl shadow-sm p-6 mb-8 border border-neutral-100/50">
                  <h2 className="text-xl font-semibold text-brown-800 mb-4">Payment Method</h2>
                  <div className="space-y-4">
                    {paymentMethods.map((method) => (
                      <label
                        key={method.id}
                        className={`flex items-center p-4 border rounded-2xl cursor-pointer transition-all ${
                          selectedPayment === method.id
                            ? 'border-green-700 bg-green-50/30 shadow-sm'
                            : 'border-gray-200 hover:bg-gray-50'
                        }`}
                      >
                        <input
                          type="radio"
                          name="paymentMethod"
                          value={method.id}
                          checked={selectedPayment === method.id}
                          onChange={() => setSelectedPayment(method.id)}
                          className="sr-only"
                        />
                        <div className="flex-shrink-0 mr-4 text-green-700">{method.icon}</div>
                        <div className="flex-grow">
                          <div className="font-medium text-brown-800">{method.name}</div>
                          <div className="text-sm text-brown-600">{method.description}</div>
                        </div>
                        {selectedPayment === method.id && <Check className="h-6 w-6 text-green-700" />}
                      </label>
                    ))}
                  </div>

                  <div className="flex items-center justify-between gap-4 mt-6">
                    <button
                      type="button"
                      onClick={() => setStep(1)}
                      className="text-sm font-bold text-neutral-500 hover:text-neutral-700"
                    >
                      Back
                    </button>
                    <Button
                      type="button"
                      onClick={() => setStep(3)}
                      className="h-12 rounded-xl text-base font-bold bg-green-800 hover:bg-green-900 px-6"
                    >
                      Continue to Review
                    </Button>
                  </div>
                </div>
              )}

              {/* STEP 3: CONFIRMATION & REVIEW */}
              {step === 3 && (
                <div className="bg-white rounded-2xl shadow-sm p-6 mb-8 border border-neutral-100/50 space-y-6">
                  <div>
                    <h2 className="text-xl font-semibold text-brown-800 mb-3">Review Details</h2>
                    <p className="text-sm text-neutral-400">Please confirm that all shipping and payment parameters are correct.</p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t border-neutral-100">
                    <div className="p-4 rounded-xl bg-neutral-50 border border-neutral-100">
                      <p className="font-semibold text-neutral-800 text-sm">{deliveryInfo.fullName}</p>
                      <p className="text-neutral-500 text-xs mt-1 leading-relaxed">
                        {deliveryInfo.addressLine1}
                        {deliveryInfo.addressLine2 ? `, ${deliveryInfo.addressLine2}` : ''}
                        {deliveryInfo.landmark ? ` (Near ${deliveryInfo.landmark})` : ''}
                        , {deliveryInfo.city}, {deliveryInfo.state} - {deliveryInfo.pincode}
                      </p>
                      <p className="text-neutral-500 text-xs mt-2 font-medium">Phone: {deliveryInfo.phone}</p>
                      <p className="text-neutral-500 text-xs font-medium">Email: {deliveryInfo.email}</p>
                    </div>

                    <div className="p-4 rounded-xl bg-neutral-50 border border-neutral-100 flex flex-col justify-between">
                      <div>
                        <h4 className="font-bold text-xs uppercase text-neutral-400 tracking-wider mb-2">Payment Option</h4>
                        <p className="font-semibold text-neutral-800 text-sm capitalize">{selectedPayment.replace(/_/g, ' ')}</p>
                        <p className="text-neutral-500 text-xs mt-1">
                          {selectedPayment === 'cod' 
                            ? 'Cash will be collected upon delivery of the items.' 
                            : 'Secure credit card/UPI transactions via Razorpay.'}
                        </p>
                      </div>

                      <button
                        type="button"
                        onClick={() => setStep(2)}
                        className="text-xs font-bold text-green-700 hover:text-green-800 mt-4 text-left"
                      >
                        Change Payment
                      </button>
                    </div>
                  </div>

                  <div className="flex items-center gap-4 pt-4 border-t border-neutral-100">
                    <button
                      type="button"
                      onClick={() => setStep(2)}
                      className="text-sm font-bold text-neutral-500 hover:text-neutral-700"
                    >
                      Back
                    </button>
                  </div>
                </div>
              )}
            </div>

            <aside className="lg:sticky lg:top-24 h-fit bg-white rounded-2xl shadow-sm p-6 border border-neutral-100/50">
              <h2 className="text-xl font-semibold text-brown-800 mb-4">Order Summary</h2>
              <div className="mb-4 max-h-64 space-y-3 overflow-y-auto pr-1">
                {cartItems.map((item) => (
                  <div key={item.id} className="flex items-center justify-between gap-3 rounded-xl bg-neutral-50 p-3">
                    <div>
                      <p className="line-clamp-1 font-medium">{item.name}</p>
                      <p className="text-sm text-neutral-500">Qty {item.quantity}</p>
                    </div>
                    <p className="font-bold text-green-800">Rs {(item.price * item.quantity).toFixed(2)}</p>
                  </div>
                ))}
              </div>
              <div className="space-y-2 mb-6">
                <div className="flex justify-between">
                  <span className="text-brown-600">Subtotal</span>
                  <span>Rs {getSubtotal().toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-brown-600">Shipping</span>
                  <span>Free</span>
                </div>
                <div className="border-t border-gray-100 pt-3 mt-3">
                  <div className="flex justify-between font-semibold">
                    <span>Total</span>
                    <span className="text-green-700">Rs {getSubtotal().toFixed(2)}</span>
                  </div>
                </div>
              </div>

              {step === 1 && (
                <Button
                  type="button"
                  onClick={() => { if (validateStep1()) setStep(2); }}
                  className="w-full h-12 rounded-xl text-base font-bold bg-green-800 hover:bg-green-900 shadow-md"
                >
                  Continue to Payment
                </Button>
              )}
              {step === 2 && (
                <Button
                  type="button"
                  onClick={() => setStep(3)}
                  className="w-full h-12 rounded-xl text-base font-bold bg-green-800 hover:bg-green-900 shadow-md"
                >
                  Continue to Review
                </Button>
              )}
              {step === 3 && (
                <Button
                  type="submit"
                  className="w-full h-12 rounded-xl text-base font-bold bg-green-800 hover:bg-green-900 shadow-lg flex items-center justify-center gap-2"
                  disabled={processing}
                >
                  {processing ? (
                    <>
                      <Loader2 className="h-5 w-5 animate-spin" />
                      Processing Order...
                    </>
                  ) : (
                    selectedPayment === 'cod' ? 'Place Order' : 'Pay Securely'
                  )}
                </Button>
              )}

              <p className="mt-3 text-center text-[10px] text-neutral-400">Razorpay payment signature verification should be enabled with a Supabase Edge Function before production launch.</p>
            </aside>
          </div>
        </form>
      </main>
      <Footer />
    </div>
  );
};

export default Checkout;
