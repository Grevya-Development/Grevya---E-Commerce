import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import { Button } from '@/components/ui/button';
import { Check, CreditCard, IndianRupee, Loader2, ShieldCheck, Truck, Lock } from 'lucide-react';
import { toast } from '@/components/ui/use-toast';
import { useCartStore } from '@/store/useCartStore';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/context/AuthContext';
import { openRazorpayCheckout, RazorpayResponse } from '@/lib/razorpay';
import { motion, AnimatePresence } from 'framer-motion';

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

const checkmarkVariants = {
  hidden: { scale: 0, opacity: 0 },
  visible: {
    scale: 1,
    opacity: 1,
    transition: {
      type: "spring" as const,
      stiffness: 200,
      damping: 15,
      delay: 0.2
    }
  }
};

const LeafParticle = ({ delay, duration, startX, startY, scale }: { delay: number, duration: number, startX: number, startY: number, scale: number }) => {
  return (
    <motion.div
      initial={{ x: startX, y: startY, opacity: 0, scale: 0, rotate: 0 }}
      animate={{
        y: [startY, startY - 150 - Math.random() * 200],
        x: [startX, startX + (Math.random() - 0.5) * 120, startX + (Math.random() - 0.5) * 120],
        opacity: [0, 0.8, 0.8, 0],
        scale: [0, scale, scale, 0],
        rotate: [0, Math.random() * 360],
      }}
      transition={{
        duration: duration,
        delay: delay,
        repeat: Infinity,
        ease: "easeInOut"
      }}
      className="absolute pointer-events-none text-green-600/30"
      style={{ filter: 'blur(0.5px)' }}
    >
      <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24">
        <path d="M17,8C8,10 5.9,16.17 3.82,21.34L5.71,22L6.66,19.7C9.38,20.87 11.92,19.7 13.91,18.06C18.66,14.16 19.34,9.22 17,8M14,16C12,17.13 10,16.13 8.5,15.5C10.3,14 12.3,13 14,12.5C14,13.7 14,14.87 14,16Z" />
      </svg>
    </motion.div>
  );
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
    <div className="relative mb-2">
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

const stepVariants = {
  enter: (dir: number) => ({
    x: dir > 0 ? 100 : -100,
    opacity: 0
  }),
  center: {
    x: 0,
    opacity: 1
  },
  exit: (dir: number) => ({
    x: dir < 0 ? 100 : -100,
    opacity: 0
  })
};

const stepTransition = {
  x: { type: "spring" as const, stiffness: 300, damping: 30 },
  opacity: { duration: 0.15 }
};

const Checkout = () => {
  const navigate = useNavigate();
  const { user, profile, loading: authLoading } = useAuth();
  const [processing, setProcessing] = useState(false);
  const [signingInAnonymously, setSigningInAnonymously] = useState(false);
  const [selectedPayment, setSelectedPayment] = useState<string>('razorpay');
  const [step, setStep] = useState(1); // 1 = Delivery, 2 = Payment, 3 = Review
  const [direction, setDirection] = useState(0);
  const [placedOrder, setPlacedOrder] = useState<{ id: string; number: string } | null>(null);

  const paginate = (newStep: number) => {
    setDirection(newStep > step ? 1 : -1);
    setStep(newStep);
  };

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
    setPlacedOrder({ id: orderData.id, number: orderReference });
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
                {idx > 0 && <div className={`flex-1 h-0.5 mx-2 ${step > idx ? 'bg-[#33381C]' : 'bg-neutral-100'}`} />}
                <button
                  type="button"
                  onClick={() => {
                    if (s.num < step) paginate(s.num);
                    else if (s.num === 2 && step === 1) { if (validateStep1()) paginate(2); }
                    else if (s.num === 3 && step === 2) paginate(3);
                  }}
                  className="flex items-center gap-2 text-left focus:outline-none"
                >
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs transition-colors ${
                    step >= s.num ? 'bg-[#33381C] text-white shadow-md shadow-[#33381C]/10' : 'bg-neutral-50 text-neutral-400 border border-neutral-100'
                  }`}>
                    {s.num}
                  </div>
                  <span className={`text-[10px] uppercase font-bold tracking-wider hidden sm:inline ${
                    step >= s.num ? 'text-neutral-900 font-bold' : 'text-neutral-400 font-medium'
                  }`}>{s.label}</span>
                </button>
              </React.Fragment>
            ))}
          </div>

          <div className="mx-auto grid max-w-6xl gap-8 lg:grid-cols-[1.35fr_0.85fr]">
            <div>
              <h1 className="text-4xl font-extrabold text-neutral-900 mb-2">Checkout</h1>
              <p className="mb-8 text-neutral-500">Secure delivery details, payment, and order confirmation.</p>

              <div className="relative overflow-hidden min-h-[400px]">
                <AnimatePresence mode="wait" initial={false} custom={direction}>
                  {/* STEP 1: DELIVERY FORM */}
                  {step === 1 && (
                    <motion.div
                      key={1}
                      custom={direction}
                      variants={stepVariants}
                      initial="enter"
                      animate="center"
                      exit="exit"
                      transition={stepTransition}
                      className="bg-white rounded-2xl shadow-sm p-6 mb-8 border border-neutral-100/50 space-y-6"
                    >
                      <h2 className="text-xl font-semibold text-brown-800">Delivery Information</h2>

                      {/* Saved Addresses Selector */}
                      {user && !user.is_anonymous && savedAddresses.length > 0 && (
                        <div className="space-y-3">
                          <label className="block text-sm font-semibold text-neutral-700">Ship to a Saved Address</label>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {savedAddresses.map((addr) => (
                              <motion.div
                                key={addr.id}
                                whileHover={{ scale: 1.01 }}
                                whileTap={{ scale: 0.99 }}
                                onClick={() => {
                                  setSelectedAddressId(addr.id);
                                  applySavedAddress(addr);
                                }}
                                className={`p-4 rounded-2xl border-2 cursor-pointer transition-all ${
                                  selectedAddressId === addr.id
                                    ? 'border-[#33381C] bg-[#F7EEE4]/30 shadow-sm'
                                    : 'border-neutral-200 hover:border-neutral-300 bg-white'
                                }`}
                              >
                                <div className="flex items-center justify-between mb-2">
                                  <span className="font-bold text-neutral-800 text-xs capitalize">[{addr.label || 'Address'}]</span>
                                  {addr.is_default && (
                                    <span className="text-[9px] bg-[#E7E9DD] text-[#33381C] px-2 py-0.5 rounded-full font-bold">
                                      Default
                                    </span>
                                  )}
                                  {selectedAddressId === addr.id && (
                                    <Check className="h-4 w-4 text-[#33381C] font-bold" />
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
                              </motion.div>
                            ))}

                            <motion.div
                              whileHover={{ scale: 1.01 }}
                              whileTap={{ scale: 0.99 }}
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
                                  ? 'border-[#33381C] bg-[#F7EEE4]/30'
                                  : 'border-neutral-200 hover:border-neutral-300 bg-white'
                              }`}
                            >
                              <span className="text-sm font-bold text-[#33381C]">+ Use a new address</span>
                              <span className="text-xs text-neutral-400 mt-1 text-center font-medium">Enter a custom shipping destination</span>
                            </motion.div>
                          </div>
                        </div>
                      )}

                      {/* Redesigned Structured Form */}
                      {selectedAddressId === 'new' && (
                        <div className="space-y-4 pt-4 border-t border-neutral-100/70">
                          <h3 className="text-base font-semibold text-neutral-800">Add Shipping Destination</h3>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <FloatingInput
                              id="fullName"
                              label="Full Name *"
                              value={deliveryInfo.fullName}
                              onChange={(e) => setDeliveryInfo({ ...deliveryInfo, fullName: e.target.value })}
                              required
                            />
                            <FloatingInput
                              id="phone"
                              label="Phone Number *"
                              type="tel"
                              value={deliveryInfo.phone}
                              onChange={(e) => setDeliveryInfo({ ...deliveryInfo, phone: e.target.value })}
                              required
                            />
                            <div className="md:col-span-2">
                              <FloatingInput
                                id="email"
                                label="Email Address *"
                                type="email"
                                value={deliveryInfo.email}
                                onChange={(e) => setDeliveryInfo({ ...deliveryInfo, email: e.target.value })}
                                required
                              />
                            </div>
                            <div className="md:col-span-2">
                              <FloatingInput
                                id="addressLine1"
                                label="Address Line 1 (Flat, House, Building, Apt) *"
                                value={deliveryInfo.addressLine1}
                                onChange={(e) => setDeliveryInfo({ ...deliveryInfo, addressLine1: e.target.value })}
                                required
                              />
                            </div>
                            <div className="md:col-span-2">
                              <FloatingInput
                                id="addressLine2"
                                label="Address Line 2 (Area, Street, Village) (Optional)"
                                value={deliveryInfo.addressLine2}
                                onChange={(e) => setDeliveryInfo({ ...deliveryInfo, addressLine2: e.target.value })}
                              />
                            </div>
                            <FloatingInput
                              id="landmark"
                              label="Landmark (Optional)"
                              value={deliveryInfo.landmark}
                              onChange={(e) => setDeliveryInfo({ ...deliveryInfo, landmark: e.target.value })}
                            />
                            <FloatingInput
                              id="city"
                              label="City *"
                              value={deliveryInfo.city}
                              onChange={(e) => setDeliveryInfo({ ...deliveryInfo, city: e.target.value })}
                              required
                            />
                            <FloatingInput
                              id="pincode"
                              label="PIN Code *"
                              value={deliveryInfo.pincode}
                              onChange={(e) => setDeliveryInfo({ ...deliveryInfo, pincode: e.target.value })}
                              required
                            />
                            <FloatingInput
                              id="state"
                              label="State *"
                              value={deliveryInfo.state}
                              onChange={(e) => setDeliveryInfo({ ...deliveryInfo, state: e.target.value })}
                              required
                            />
                            <FloatingInput
                              id="country"
                              label="Country *"
                              value={deliveryInfo.country}
                              onChange={(e) => setDeliveryInfo({ ...deliveryInfo, country: e.target.value })}
                              required
                            />
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
                                        ? 'border-[#33381C] bg-[#F7EEE4]/30 text-[#33381C] shadow-sm'
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
                                  className="rounded border-gray-300 text-[#33381C] focus:ring-[#33381C] h-4 w-4"
                                />
                                <span className="text-sm font-medium text-neutral-700">Save this address to my account</span>
                              </label>

                              {deliveryInfo.saveToAccount && (
                                <label className="flex items-center gap-2 cursor-pointer ml-6">
                                  <input
                                    type="checkbox"
                                    checked={deliveryInfo.isDefault}
                                    onChange={(e) => setDeliveryInfo({ ...deliveryInfo, isDefault: e.target.checked })}
                                    className="rounded border-gray-300 text-[#33381C] focus:ring-[#33381C] h-4 w-4"
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
                        onClick={() => { if (validateStep1()) paginate(2); }}
                        className="w-full h-12 rounded-xl text-base font-bold bg-[#33381C] hover:bg-[#262A14] text-[#F7EEE4] mt-6 shadow-md transition-all duration-300"
                      >
                        Continue to Payment
                      </Button>
                    </motion.div>
                  )}

                  {/* STEP 2: PAYMENT FORM */}
                  {step === 2 && (
                    <motion.div
                      key={2}
                      custom={direction}
                      variants={stepVariants}
                      initial="enter"
                      animate="center"
                      exit="exit"
                      transition={stepTransition}
                      className="bg-white rounded-2xl shadow-sm p-6 mb-8 border border-neutral-100/50"
                    >
                      <h2 className="text-xl font-semibold text-brown-800 mb-4">Payment Method</h2>
                      <div className="space-y-4">
                        {paymentMethods.map((method) => (
                          <motion.label
                            key={method.id}
                            layout
                            whileHover={{ scale: 1.01 }}
                            whileTap={{ scale: 0.99 }}
                            className={`flex items-center p-4 border rounded-2xl cursor-pointer transition-all ${
                              selectedPayment === method.id
                                ? 'border-[#33381C] bg-[#F7EEE4]/30 shadow-sm'
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
                            <div className="flex-shrink-0 mr-4 text-[#33381C]">{method.icon}</div>
                            <div className="flex-grow">
                              <div className="font-semibold text-neutral-800">{method.name}</div>
                              <div className="text-sm text-neutral-500">{method.description}</div>
                            </div>
                            {selectedPayment === method.id && (
                              <motion.div
                                initial={{ scale: 0 }}
                                animate={{ scale: 1 }}
                                transition={{ type: "spring", stiffness: 300, damping: 20 }}
                              >
                                <Check className="h-6 w-6 text-[#33381C]" />
                              </motion.div>
                            )}
                          </motion.label>
                        ))}
                      </div>

                      <div className="flex items-center justify-between gap-4 mt-6">
                        <button
                          type="button"
                          onClick={() => paginate(1)}
                          className="text-sm font-bold text-neutral-500 hover:text-neutral-700"
                        >
                          Back
                        </button>
                        <Button
                          type="button"
                          onClick={() => paginate(3)}
                          className="h-12 rounded-xl text-base font-bold bg-[#33381C] hover:bg-[#262A14] text-[#F7EEE4] px-6 shadow-md transition-all duration-300"
                        >
                          Continue to Review
                        </Button>
                      </div>
                    </motion.div>
                  )}

                  {/* STEP 3: CONFIRMATION & REVIEW */}
                  {step === 3 && (
                    <motion.div
                      key={3}
                      custom={direction}
                      variants={stepVariants}
                      initial="enter"
                      animate="center"
                      exit="exit"
                      transition={stepTransition}
                      className="bg-white rounded-2xl shadow-sm p-6 mb-8 border border-neutral-100/50 space-y-6"
                    >
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
                            onClick={() => paginate(2)}
                            className="text-xs font-bold text-[#A68D65] hover:text-[#33381C] mt-4 text-left"
                          >
                            Change Payment
                          </button>
                        </div>
                      </div>

                      <div className="flex items-center gap-4 pt-4 border-t border-neutral-100">
                        <button
                          type="button"
                          onClick={() => paginate(2)}
                          className="text-sm font-bold text-neutral-500 hover:text-neutral-700"
                        >
                          Back
                        </button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
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

              {/* Delivery Estimate */}
              <div className="flex items-center space-x-2.5 text-xs text-[#33381C] bg-[#E7E9DD] border border-[#33381C]/10 rounded-xl p-3 mb-4 font-semibold">
                <Truck className="h-4 w-4 shrink-0 text-[#A68D65]" />
                <span>
                  Delivery Estimate: {new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toLocaleDateString('en-IN', { weekday: 'short', month: 'short', day: 'numeric' })} (Free Shipping)
                </span>
              </div>

              {step === 1 && (
                <Button
                  type="button"
                  onClick={() => { if (validateStep1()) paginate(2); }}
                  className="w-full h-12 rounded-xl text-base font-bold bg-[#33381C] hover:bg-[#262A14] text-[#F7EEE4] shadow-md transition-all duration-300"
                >
                  Continue to Payment
                </Button>
              )}
              {step === 2 && (
                <Button
                  type="button"
                  onClick={() => paginate(3)}
                  className="w-full h-12 rounded-xl text-base font-bold bg-[#33381C] hover:bg-[#262A14] text-[#F7EEE4] shadow-md transition-all duration-300"
                >
                  Continue to Review
                </Button>
              )}
              {step === 3 && (
                <Button
                  type="submit"
                  className="w-full h-12 rounded-xl text-base font-bold bg-[#33381C] hover:bg-[#262A14] text-[#F7EEE4] shadow-lg flex items-center justify-center gap-2 transition-all duration-300"
                  disabled={processing}
                >
                  {processing ? (
                    <>
                      <Loader2 className="h-5 w-5 animate-spin" />
                      Securing Order...
                    </>
                  ) : (
                    <>
                      <Lock className="h-4 w-4 mr-1.5" />
                      Securely Place Order
                    </>
                  )}
                </Button>
              )}

              {/* Secure Trust Strip */}
              <div className="mt-5 pt-4 border-t border-[#A68D65]/15 text-center space-y-2">
                <div className="flex items-center justify-center space-x-1.5 text-[10px] text-gray-500 font-bold uppercase tracking-wider">
                  <ShieldCheck className="h-4 w-4 text-[#A68D65]" />
                  <span>Secured 256-bit Checkout</span>
                </div>
                <div className="flex items-center justify-center gap-2.5 opacity-70">
                  <img src="https://img.icons8.com/color/48/000000/visa.png" className="h-5 w-auto" alt="Visa" />
                  <img src="https://img.icons8.com/color/48/000000/mastercard.png" className="h-5 w-auto" alt="Mastercard" />
                  <img src="https://img.icons8.com/color/48/000000/rupay.png" className="h-5 w-auto" alt="RuPay" />
                  <span className="text-[9px] font-bold text-gray-500 px-1.5 py-0.5 rounded border border-gray-200">UPI</span>
                  <span className="text-[9px] font-bold bg-[#33381C] text-[#F7EEE4] px-1.5 py-0.5 rounded uppercase">COD</span>
                </div>
              </div>

              <p className="mt-4 text-center text-[9px] text-neutral-400">Razorpay payment signature verification should be enabled with a Supabase Edge Function before production launch.</p>
            </aside>
          </div>
        </form>
      </main>
      <Footer />

      {/* SUCCESS MODAL OVERLAY */}
      <AnimatePresence>
        {placedOrder && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-md p-4"
          >
            <motion.div
              initial={{ scale: 0.9, y: 20, opacity: 0 }}
              animate={{ scale: 1, y: 0, opacity: 1 }}
              exit={{ scale: 0.9, y: 20, opacity: 0 }}
              transition={{ type: "spring", stiffness: 300, damping: 25 }}
              className="relative w-full max-w-lg overflow-hidden bg-white rounded-3xl p-8 text-center shadow-2xl border border-neutral-100"
            >
              {/* Ambient glow */}
              <div className="absolute inset-0 bg-gradient-to-b from-[#F7EEE4]/40 to-transparent pointer-events-none -z-10" />
              
              {/* Particle container */}
              <div className="absolute inset-0 pointer-events-none overflow-hidden">
                {Array.from({ length: 15 }).map((_, i) => {
                  const delay = i * 0.15;
                  const duration = 2.5 + Math.random() * 2;
                  const scale = 0.5 + Math.random() * 0.6;
                  const startX = (Math.random() - 0.5) * 160;
                  const startY = 80 + Math.random() * 40;
                  return (
                    <LeafParticle
                      key={i}
                      delay={delay}
                      duration={duration}
                      startX={startX}
                      startY={startY}
                      scale={scale}
                    />
                  );
                })}
              </div>

              {/* Animated green check circle */}
              <div className="relative inline-flex justify-center items-center w-20 h-20 mb-6">
                <motion.div
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{ scale: [1, 1.15, 1], opacity: [0.4, 0.7, 0.4] }}
                  transition={{ repeat: Infinity, duration: 3, ease: "easeInOut" }}
                  className="absolute inset-0 bg-[#33381C]/10 rounded-full blur-xl"
                />
                <motion.div
                  variants={checkmarkVariants}
                  initial="hidden"
                  animate="visible"
                  className="w-20 h-20 bg-[#33381C] rounded-full flex items-center justify-center shadow-lg shadow-[#33381C]/25"
                >
                  <Check className="h-10 w-10 text-[#F7EEE4] stroke-[3]" />
                </motion.div>
              </div>

              <motion.h2
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className="text-3xl font-extrabold text-neutral-900 mb-2"
              >
                Order Placed Successfully!
              </motion.h2>
              
              <motion.p
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 }}
                className="text-neutral-500 text-sm mb-6"
              >
                Thank you for shopping with Grevya Naturals. We've sent a detailed confirmation to your email.
              </motion.p>

              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.5 }}
                className="bg-[#F7EEE4]/50 border border-[#A68D65]/20 rounded-2xl p-5 mb-8 text-left"
              >
                <div className="flex justify-between items-center mb-2">
                  <span className="text-xs uppercase font-bold text-neutral-400 tracking-wider">Order Reference</span>
                  <span className="font-mono font-bold text-[#33381C] text-sm">{placedOrder.number}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-xs uppercase font-bold text-neutral-400 tracking-wider">Estimated Delivery</span>
                  <span className="font-semibold text-neutral-800 text-sm">
                    {new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toLocaleDateString('en-IN', { weekday: 'short', month: 'short', day: 'numeric' })}
                  </span>
                </div>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.6 }}
                className="flex flex-col sm:flex-row gap-4"
              >
                <Button
                  onClick={() => {
                    navigate('/account');
                  }}
                  variant="outline"
                  className="flex-1 h-12 rounded-xl text-sm font-bold border-neutral-200 hover:bg-neutral-50"
                >
                  View My Orders
                </Button>
                <Button
                  onClick={() => {
                    navigate('/products');
                  }}
                  className="flex-1 h-12 rounded-xl text-sm font-bold bg-[#33381C] hover:bg-[#262A14] text-[#F7EEE4] shadow-md shadow-[#33381C]/10"
                >
                  Continue Shopping
                </Button>
              </motion.div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default Checkout;
