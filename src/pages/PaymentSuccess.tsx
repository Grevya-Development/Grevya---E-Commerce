
import React from 'react';
import { Link } from 'react-router-dom';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import { Button } from '@/components/ui/button';
import { CheckCircle, ShoppingBag } from 'lucide-react';

const PaymentSuccess = () => {
  return (
    <div className="flex flex-col min-h-screen">
      <Navbar />
      <main className="flex-grow bg-cream/30 py-16">
        <div className="container mx-auto px-4">
          <div className="max-w-lg mx-auto bg-white rounded-lg shadow p-8 text-center">
            <div className="inline-flex justify-center items-center w-16 h-16 bg-green-100 rounded-full mb-6">
              <CheckCircle className="h-10 w-10 text-green-700" />
            </div>
            <h1 className="text-3xl font-bold text-brown-800 mb-4">Payment Successful!</h1>
            <p className="text-brown-600 mb-8">
              Your order has been placed successfully. We have sent you an email with your order details.
            </p>
            <div className="bg-cream/50 rounded-lg p-6 mb-8">
              <h3 className="font-medium text-brown-800 mb-2">Order #GI202405{Math.floor(Math.random() * 10000)}</h3>
              <p className="text-sm text-brown-600">
                Thank you for your purchase! Your order will be shipped within 2-3 business days.
              </p>
            </div>
            <div className="flex flex-col md:flex-row gap-4">
              <Button asChild variant="outline" className="flex-1">
                <Link to="/">
                  Return to Home
                </Link>
              </Button>
              <Button asChild className="flex-1 flex items-center justify-center">
                <Link to="/products">
                  <ShoppingBag className="h-5 w-5 mr-2" />
                  Continue Shopping
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default PaymentSuccess;
