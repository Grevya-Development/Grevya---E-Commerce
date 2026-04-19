
import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import { Button } from '@/components/ui/button';
import { Trash2, ShoppingBag, ArrowRight } from 'lucide-react';
import { useCartStore } from '@/store/useCartStore';
interface CartItem {
  id: number;
  name: string;
  price: number;
  image: string;
  quantity: number;
  category: string;
  slug: string;
}

const Cart = () => {
  const cartItems = useCartStore((state) => state.items);
  const removeItem = useCartStore((state) => state.removeItem);
  const updateQuantity = useCartStore((state) => state.updateQuantity);
  const getSubtotal = useCartStore((state) => state.getSubtotal);

  const subtotal = getSubtotal();
  const shipping = subtotal >= 500 ? 0 : 50;
  const total = subtotal + shipping;

  return (
    <div className="flex flex-col min-h-screen">
      <Navbar />
      <main className="flex-grow bg-cream/30 py-16">
        <div className="container mx-auto px-4">
          <h1 className="text-3xl font-bold text-brown-800 mb-8">Your Shopping Cart</h1>

          {cartItems.length > 0 ? (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              <div className="lg:col-span-2">
                <div className="bg-white rounded-lg shadow p-6">
                  <div className="space-y-6">
                    {cartItems.map((item) => (
                      <div key={item.id} className="flex items-center border-b border-gray-100 pb-6 last:border-0 last:pb-0">
                        <img
                          src={item.image}
                          alt={item.name}
                          className="w-20 h-20 object-contain bg-gray-50 rounded-md mr-4"
                        />
                        <div className="flex-1">
                          <Link to={`/products/${item.category}/${item.slug}`} className="font-medium text-brown-800 hover:text-green-700">
                            {item.name}
                          </Link>
                          <p className="text-green-700 font-medium mt-1">₹{item.price.toFixed(2)}</p>
                        </div>
                        <div className="flex items-center space-x-2">
                          <div className="border border-gray-200 rounded flex items-center">
                            <button
                              className="px-2 py-1"
                              onClick={() => updateQuantity(item.id, item.quantity - 1)}
                            >
                              -
                            </button>
                            <span className="px-3 py-1 border-l border-r border-gray-200">
                              {item.quantity}
                            </span>
                            <button
                              className="px-2 py-1"
                              onClick={() => updateQuantity(item.id, item.quantity + 1)}
                            >
                              +
                            </button>
                          </div>
                          <button
                            className="text-gray-400 hover:text-red-500"
                            onClick={() => removeItem(item.id)}
                          >
                            <Trash2 className="h-5 w-5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="lg:col-span-1">
                <div className="bg-white rounded-lg shadow p-6">
                  <h2 className="text-xl font-semibold text-brown-800 mb-4">Order Summary</h2>
                  <div className="space-y-3 mb-6">
                    <div className="flex justify-between">
                      <span className="text-brown-600">Subtotal</span>
                      <span className="font-medium">₹{subtotal.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-brown-600">Shipping</span>
                      <span className="font-medium">{shipping === 0 ? 'Free' : `₹${shipping.toFixed(2)}`}</span>
                    </div>
                    <p className="text-sm text-gray-500 mt-4 flex items-center justify-center">
                      <svg className="w-4 h-4 mr-1 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
                      Secure Checkout
                    </p>
                    <div className="border-t border-gray-100 pt-3 mt-3">
                      <div className="flex justify-between font-semibold text-lg">
                        <span>Total</span>
                        <span className="text-green-700">₹{total.toFixed(2)}</span>
                      </div>
                    </div>
                  </div>
                  {/* @ts-ignore */}
                  <Button asChild className="w-full">
                    <Link to="/checkout">
                      Proceed to Checkout
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </Link>
                  </Button>
                  {/* @ts-ignore */}
                  <Button asChild variant="outline" className="w-full mt-4">
                    <Link to="/products">Continue Shopping</Link>
                  </Button>
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center py-16">
              <div className="inline-flex justify-center items-center w-24 h-24 bg-cream rounded-full mb-6">
                <ShoppingBag className="h-12 w-12 text-brown-400" />
              </div>
              <h2 className="text-2xl font-semibold text-brown-800 mb-4">Your cart is empty</h2>
              <p className="text-brown-600 mb-8 max-w-md mx-auto">
                Looks like you haven't added any products to your cart yet.
              </p>
              {/* @ts-ignore */}
              <Button asChild className="btn-primary">
                <Link to="/products">
                  Continue Shopping
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            </div>
          )}
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default Cart;
