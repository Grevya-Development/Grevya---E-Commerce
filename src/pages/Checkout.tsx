
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import { Button } from '@/components/ui/button';
import { Check, CreditCard, IndianRupee } from 'lucide-react';
import { toast } from '@/components/ui/use-toast';

interface PaymentMethod {
  id: string;
  name: string;
  description: string;
  icon: React.ReactNode;
}

const Checkout = () => {
  const navigate = useNavigate();
  const [processing, setProcessing] = useState(false);
  const [selectedPayment, setSelectedPayment] = useState<string>('upi');
  
  const paymentMethods: PaymentMethod[] = [
    {
      id: 'upi',
      name: 'UPI Payment',
      description: 'Pay using Google Pay, PhonePe, or BHIM UPI',
      icon: <IndianRupee className="h-8 w-8" />
    },
    {
      id: 'card',
      name: 'Credit/Debit Card',
      description: 'Pay securely with your card',
      icon: <CreditCard className="h-8 w-8" />
    }
  ];
  
  const handlePayment = async (e: React.FormEvent) => {
    e.preventDefault();
    setProcessing(true);
    
    // In a real implementation, this would be connected to a payment gateway
    toast({
      title: "Processing payment",
      description: "Your order is being processed..."
    });
    
    // Simulate payment processing delay
    setTimeout(() => {
      setProcessing(false);
      // Redirect to success page
      navigate('/payment-success');
    }, 2000);
  };
  
  return (
    <div className="flex flex-col min-h-screen">
      <Navbar />
      <main className="flex-grow bg-cream/30 py-16">
        <div className="container mx-auto px-4">
          <div className="max-w-2xl mx-auto">
            <h1 className="text-3xl font-bold text-brown-800 mb-8">Checkout</h1>
            
            <div className="bg-white rounded-lg shadow p-6 mb-8">
              <h2 className="text-xl font-semibold text-brown-800 mb-4">Delivery Information</h2>
              <form>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                  <div>
                    <label htmlFor="firstName" className="block text-sm font-medium text-brown-600 mb-1">
                      First Name
                    </label>
                    <input
                      type="text"
                      id="firstName"
                      className="w-full border border-gray-300 rounded-md p-2"
                      required
                    />
                  </div>
                  <div>
                    <label htmlFor="lastName" className="block text-sm font-medium text-brown-600 mb-1">
                      Last Name
                    </label>
                    <input
                      type="text"
                      id="lastName"
                      className="w-full border border-gray-300 rounded-md p-2"
                      required
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label htmlFor="email" className="block text-sm font-medium text-brown-600 mb-1">
                      Email Address
                    </label>
                    <input
                      type="email"
                      id="email"
                      className="w-full border border-gray-300 rounded-md p-2"
                      required
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label htmlFor="address" className="block text-sm font-medium text-brown-600 mb-1">
                      Address
                    </label>
                    <input
                      type="text"
                      id="address"
                      className="w-full border border-gray-300 rounded-md p-2"
                      required
                    />
                  </div>
                  <div>
                    <label htmlFor="city" className="block text-sm font-medium text-brown-600 mb-1">
                      City
                    </label>
                    <input
                      type="text"
                      id="city"
                      className="w-full border border-gray-300 rounded-md p-2"
                      required
                    />
                  </div>
                  <div>
                    <label htmlFor="pincode" className="block text-sm font-medium text-brown-600 mb-1">
                      PIN Code
                    </label>
                    <input
                      type="text"
                      id="pincode"
                      className="w-full border border-gray-300 rounded-md p-2"
                      required
                    />
                  </div>
                  <div>
                    <label htmlFor="state" className="block text-sm font-medium text-brown-600 mb-1">
                      State
                    </label>
                    <input
                      type="text"
                      id="state"
                      className="w-full border border-gray-300 rounded-md p-2"
                      required
                    />
                  </div>
                  <div>
                    <label htmlFor="phone" className="block text-sm font-medium text-brown-600 mb-1">
                      Phone Number
                    </label>
                    <input
                      type="tel"
                      id="phone"
                      className="w-full border border-gray-300 rounded-md p-2"
                      required
                    />
                  </div>
                </div>
              </form>
            </div>
            
            <div className="bg-white rounded-lg shadow p-6 mb-8">
              <h2 className="text-xl font-semibold text-brown-800 mb-4">Payment Method</h2>
              <div className="space-y-4">
                {paymentMethods.map((method) => (
                  <label 
                    key={method.id}
                    className={`flex items-center p-4 border rounded-lg cursor-pointer ${
                      selectedPayment === method.id 
                        ? 'border-green-700 bg-green-50' 
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
                    <div className="flex-shrink-0 mr-4 text-green-700">
                      {method.icon}
                    </div>
                    <div className="flex-grow">
                      <div className="font-medium text-brown-800">{method.name}</div>
                      <div className="text-sm text-brown-600">{method.description}</div>
                    </div>
                    {selectedPayment === method.id && (
                      <div className="flex-shrink-0 ml-2 text-green-700">
                        <Check className="h-6 w-6" />
                      </div>
                    )}
                  </label>
                ))}
              </div>
            </div>
            
            <div className="bg-white rounded-lg shadow p-6 mb-8">
              <h2 className="text-xl font-semibold text-brown-800 mb-4">Order Summary</h2>
              <div className="space-y-2 mb-4">
                <div className="flex justify-between">
                  <span className="text-brown-600">Subtotal</span>
                  <span>₹799.00</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-brown-600">Shipping</span>
                  <span>Free</span>
                </div>
                <div className="border-t border-gray-100 pt-2 mt-2">
                  <div className="flex justify-between font-semibold">
                    <span>Total</span>
                    <span className="text-green-700">₹799.00</span>
                  </div>
                </div>
              </div>
            </div>
            
            <Button
              className="w-full py-3 text-lg"
              onClick={handlePayment}
              disabled={processing}
            >
              {processing ? 'Processing...' : 'Complete Payment'}
            </Button>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default Checkout;
