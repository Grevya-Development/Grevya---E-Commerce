import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import { Button } from '@/components/ui/button';
import { Check, CreditCard, IndianRupee } from 'lucide-react';
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

const Checkout = () => {
  const navigate = useNavigate();
  const { user, profile, loading: authLoading } = useAuth();
  const [processing, setProcessing] = useState(false);
  const [signingInAnonymously, setSigningInAnonymously] = useState(false);
  const [selectedPayment, setSelectedPayment] = useState<string>('razorpay');
  const [step, setStep] = useState(1); // 1 = Delivery, 2 = Payment, 3 = Review
  const [deliveryInfo, setDeliveryInfo] = useState({
    firstName: '',
    lastName: '',
    email: '',
    address: '',
    city: '',
    pincode: '',
    state: '',
    phone: '',
  });

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

  useEffect(() => {
    const nameParts = (profile?.full_name || user?.user_metadata?.full_name || '').split(' ');
    setDeliveryInfo((current) => ({
      ...current,
      firstName: current.firstName || nameParts[0] || '',
      lastName: current.lastName || nameParts.slice(1).join(' '),
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

    const { data: orderData, error: orderError } = await supabase
      .from('orders')
      .insert({
        user_id: user.id,
        order_number: orderReference,
        total_amount: subtotal,
        status: paymentStatus === 'paid' ? 'confirmed' : 'pending',
        payment_status: paymentStatus,
        payment_method: selectedPayment,
        payment_reference: paymentReference || null,
        shipping_address: deliveryInfo,
        estimated_delivery: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString(),
      })
      .select()
      .single();

    if (orderError) throw orderError;

    const orderItems = cartItems.map(item => ({
      order_id: orderData.id,
      product_id: item.id,
      product_name: item.name,
      product_image: item.image || (item as any).image_url,
      quantity: item.quantity,
      price: item.price
    }));

    const { error: itemsError } = await supabase.from('order_items').insert(orderItems);
    if (itemsError) throw itemsError;

    await supabase.from('notifications').insert({
      user_id: user.id,
      message: `Order ${orderReference} has been placed successfully!`,
      type: 'order'
    });

    clearCart();
    navigate(`/payment-success?order=${orderData.id}`);
  };

  const handlePayment = async (event: React.FormEvent) => {
    event.preventDefault();

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
        name: `${deliveryInfo.firstName} ${deliveryInfo.lastName}`.trim() || 'Grevya Customer',
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
    if (
      !deliveryInfo.firstName.trim() ||
      !deliveryInfo.lastName.trim() ||
      !deliveryInfo.email.trim() ||
      !deliveryInfo.phone.trim() ||
      !deliveryInfo.address.trim() ||
      !deliveryInfo.city.trim() ||
      !deliveryInfo.pincode.trim() ||
      !deliveryInfo.state.trim()
    ) {
      toast({
        title: 'Incomplete Details',
        description: 'Please complete all delivery information fields.',
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
                <div className="bg-white rounded-2xl shadow-sm p-6 mb-8 border border-neutral-100/50">
                  <h2 className="text-xl font-semibold text-brown-800 mb-4">Delivery Information</h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {[
                      ['firstName', 'First Name'],
                      ['lastName', 'Last Name'],
                      ['email', 'Email Address'],
                      ['phone', 'Phone Number'],
                      ['city', 'City'],
                      ['pincode', 'PIN Code'],
                      ['state', 'State'],
                    ].map(([key, label]) => (
                      <div key={key} className={key === 'email' ? 'md:col-span-2' : ''}>
                        <label htmlFor={key} className="block text-sm font-medium text-brown-600 mb-1">{label}</label>
                        <input
                          id={key}
                          type={key === 'email' ? 'email' : key === 'phone' ? 'tel' : 'text'}
                          value={(deliveryInfo as any)[key]}
                          onChange={(event) => setDeliveryInfo({ ...deliveryInfo, [key]: event.target.value })}
                          className="w-full rounded-xl border border-gray-200 p-3 focus:outline-none focus:ring-2 focus:ring-green-700 bg-neutral-50/30"
                          required
                        />
                      </div>
                    ))}
                    <div className="md:col-span-2">
                      <label htmlFor="address" className="block text-sm font-medium text-brown-600 mb-1">Address</label>
                      <input
                        id="address"
                        value={deliveryInfo.address}
                        onChange={(event) => setDeliveryInfo({ ...deliveryInfo, address: event.target.value })}
                        className="w-full rounded-xl border border-gray-200 p-3 focus:outline-none focus:ring-2 focus:ring-green-700 bg-neutral-50/30"
                        required
                      />
                    </div>
                  </div>
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
                      <h4 className="font-bold text-xs uppercase text-neutral-400 tracking-wider mb-2">Shipping Destination</h4>
                      <p className="font-semibold text-neutral-800 text-sm">{deliveryInfo.firstName} {deliveryInfo.lastName}</p>
                      <p className="text-neutral-500 text-xs mt-1 leading-relaxed">
                        {deliveryInfo.address}, {deliveryInfo.city}, {deliveryInfo.state} - {deliveryInfo.pincode}
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
                  className="w-full h-12 rounded-xl text-base font-bold bg-green-800 hover:bg-green-900 shadow-lg"
                  disabled={processing}
                >
                  {processing ? 'Processing...' : selectedPayment === 'cod' ? 'Place Order' : 'Pay Securely'}
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
