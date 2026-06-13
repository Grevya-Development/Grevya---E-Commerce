export interface RazorpayCheckoutOptions {
  amount: number;
  name: string;
  email: string;
  phone: string;
  orderReference: string;
  onSuccess: (response: RazorpayResponse) => void;
  onFailure: (reason: string) => void;
}

export interface RazorpayResponse {
  razorpay_payment_id: string;
  razorpay_order_id?: string;
  razorpay_signature?: string;
}

declare global {
  interface Window {
    Razorpay?: any;
  }
}

const loadRazorpayScript = () => {
  return new Promise<boolean>((resolve) => {
    if (window.Razorpay) {
      resolve(true);
      return;
    }

    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
};

export const openRazorpayCheckout = async ({
  amount,
  name,
  email,
  phone,
  orderReference,
  onSuccess,
  onFailure,
}: RazorpayCheckoutOptions) => {
  const key = import.meta.env.VITE_RAZORPAY_KEY_ID;
  const isDev = import.meta.env.DEV;

  if (!key || key === 'rzp_test_dummy') {
    if (isDev) {
      console.warn('Razorpay Key ID is not configured. Falling back to test simulation mode.');
      const confirmPayment = window.confirm(
        '[Test Mode] Razorpay is not configured or in test mode. Would you like to simulate a successful test payment for this order?'
      );
      if (confirmPayment) {
        onSuccess({
          razorpay_payment_id: `pay_mock_${Date.now()}`,
          razorpay_order_id: `order_mock_${Date.now()}`,
          razorpay_signature: `sig_mock_${Date.now()}`,
        });
      } else {
        onFailure('Payment simulation cancelled by the user.');
      }
      return;
    } else {
      onFailure('Online payment gateway is currently unavailable. Please choose another payment method.');
      return;
    }
  }

  const loaded = await loadRazorpayScript();
  if (!loaded || !window.Razorpay) {
    onFailure('Razorpay checkout could not be loaded. Check your network connection.');
    return;
  }

  const checkout = new window.Razorpay({
    key,
    amount: Math.round(amount * 100),
    currency: 'INR',
    name: 'Grevya Naturals',
    description: `Order ${orderReference}`,
    prefill: {
      name,
      email,
      contact: phone,
    },
    notes: {
      order_reference: orderReference,
    },
    theme: {
      color: '#33381C',
    },
    handler: onSuccess,
    modal: {
      ondismiss: () => onFailure('Payment was cancelled before completion.'),
    },
  });

  checkout.on('payment.failed', (response: any) => {
    onFailure(response?.error?.description || 'Payment failed. Please try again.');
  });

  checkout.open();
};
