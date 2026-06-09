import React from 'react';
import { Link } from 'react-router-dom';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import { Button } from '@/components/ui/button';
import { Trash2, ShoppingBag, ArrowRight, Minus, Plus, ShieldCheck, ChevronRight } from 'lucide-react';
import { useCartStore } from '@/store/useCartStore';
import { motion, AnimatePresence } from 'framer-motion';

const Cart = () => {
  const cartItems = useCartStore((state) => state.items);
  const removeItem = useCartStore((state) => state.removeItem);
  const updateQuantity = useCartStore((state) => state.updateQuantity);
  const getSubtotal = useCartStore((state) => state.getSubtotal);

  const subtotal = getSubtotal();
  const freeShippingThreshold = 500;
  const shipping = subtotal >= freeShippingThreshold ? 0 : 50;
  const total = subtotal + shipping;
  const progressToFreeShipping = Math.min((subtotal / freeShippingThreshold) * 100, 100);
  const remainingForFreeShipping = Math.max(freeShippingThreshold - subtotal, 0);

  return (
    <div className="flex flex-col min-h-screen bg-cream/10">
      <Navbar />
      <main className="flex-grow py-12">
        <div className="container mx-auto px-4 max-w-6xl">
          
          {/* Breadcrumbs */}
          <div className="flex items-center gap-1.5 text-xs text-neutral-400 font-semibold uppercase tracking-wider mb-6">
            <Link to="/" className="hover:text-green-700 transition-colors">Home</Link>
            <ChevronRight size={12} />
            <span className="text-neutral-800">Your Cart</span>
          </div>

          <h1 className="text-4xl font-extrabold text-neutral-900 tracking-tight mb-8">Shopping Bag</h1>

          {cartItems.length > 0 ? (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
              
              {/* Items List */}
              <div className="lg:col-span-2 space-y-4">
                <div className="bg-white rounded-2xl shadow-sm border border-neutral-100 p-6 sm:p-8">
                  <div className="flow-root">
                    <ul className="-my-6 divide-y divide-neutral-100">
                      <AnimatePresence>
                        {cartItems.map((item) => (
                          <motion.li
                            key={item.id}
                            initial={{ opacity: 0, y: 15 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, x: -50 }}
                            transition={{ duration: 0.3 }}
                            className="flex py-6 items-center"
                          >
                            <div className="h-24 w-24 flex-shrink-0 overflow-hidden rounded-2xl border border-neutral-100 bg-neutral-50 p-2 flex items-center justify-center">
                              <img
                                src={item.image}
                                alt={item.name}
                                className="h-full w-full object-contain"
                              />
                            </div>

                            <div className="ml-4 flex flex-1 flex-col sm:ml-6">
                              <div>
                                <div className="flex justify-between text-base font-bold text-neutral-900">
                                  <h3>
                                    <Link to={`/products/${item.category}/${item.slug}`} className="hover:text-green-700 transition-colors line-clamp-1">
                                      {item.name}
                                    </Link>
                                  </h3>
                                  <p className="ml-4 text-green-800 tracking-tight">₹{(item.price * item.quantity).toFixed(2)}</p>
                                </div>
                                <p className="mt-1 text-xs text-neutral-400 font-semibold uppercase tracking-wider capitalize">{item.category}</p>
                              </div>
                              
                              <div className="flex flex-1 items-end justify-between text-sm mt-4">
                                <div className="flex items-center border border-neutral-200 rounded-xl bg-neutral-50 p-1">
                                  <button
                                    onClick={() => updateQuantity(item.id, item.quantity - 1)}
                                    className="p-1.5 hover:bg-white rounded-lg text-neutral-500 hover:text-neutral-900 transition-colors"
                                  >
                                    <Minus size={14} />
                                  </button>
                                  <span className="px-3 text-neutral-900 font-bold text-sm w-8 text-center">
                                    {item.quantity}
                                  </span>
                                  <button
                                    onClick={() => updateQuantity(item.id, item.quantity + 1)}
                                    className="p-1.5 hover:bg-white rounded-lg text-neutral-500 hover:text-neutral-900 transition-colors"
                                  >
                                    <Plus size={14} />
                                  </button>
                                </div>

                                <div className="flex">
                                  <button
                                    type="button"
                                    onClick={() => removeItem(item.id)}
                                    className="font-semibold text-neutral-400 hover:text-red-500 transition-colors flex items-center gap-1.5 text-xs uppercase tracking-wider"
                                  >
                                    <Trash2 size={16} />
                                    Remove
                                  </button>
                                </div>
                              </div>
                            </div>
                          </motion.li>
                        ))}
                      </AnimatePresence>
                    </ul>
                  </div>
                </div>
              </div>

              {/* Summary Sidebar */}
              <div className="space-y-6">
                
                {/* Shipping Progress bar */}
                <div className="bg-white rounded-2xl p-6 shadow-sm border border-neutral-100/50">
                  {shipping === 0 ? (
                    <p className="text-sm font-semibold text-green-800 flex items-center gap-1.5">
                      🎉 You qualified for Free Shipping!
                    </p>
                  ) : (
                    <div className="space-y-2">
                      <p className="text-xs text-neutral-500 font-medium">
                        Add <strong className="text-green-800">₹{remainingForFreeShipping.toFixed(2)}</strong> more for Free Shipping
                      </p>
                      <div className="w-full bg-neutral-100 rounded-full h-1.5 overflow-hidden">
                        <div className="bg-green-700 h-full rounded-full transition-all duration-500" style={{ width: `${progressToFreeShipping}%` }}></div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Final Breakdown */}
                <div className="bg-white rounded-2xl shadow-sm border border-neutral-100 p-6 space-y-6">
                  <h2 className="text-lg font-bold text-neutral-900">Summary</h2>
                  
                  <div className="space-y-3.5 border-b border-neutral-100 pb-4">
                    <div className="flex justify-between text-sm text-neutral-500 font-medium">
                      <span>Subtotal</span>
                      <span className="font-bold text-neutral-800">₹{subtotal.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-sm text-neutral-500 font-medium">
                      <span>Shipping</span>
                      <span className="font-bold text-neutral-800">
                        {shipping === 0 ? 'Free' : `₹${shipping.toFixed(2)}`}
                      </span>
                    </div>
                  </div>

                  <div className="flex justify-between items-center">
                    <span className="text-base font-bold text-neutral-900">Total Price</span>
                    <span className="text-2xl font-extrabold text-green-800 tracking-tight">₹{total.toFixed(2)}</span>
                  </div>

                  <div className="space-y-3">
                    <Button asChild className="w-full h-12 rounded-xl text-base font-bold bg-green-800 hover:bg-green-900 shadow-md">
                      <Link to="/checkout">
                        Proceed to Checkout
                        <ArrowRight className="ml-2 h-4 w-4" />
                      </Link>
                    </Button>
                    <Button asChild variant="outline" className="w-full h-12 rounded-xl border-neutral-200 text-neutral-700 hover:bg-neutral-50 font-bold">
                      <Link to="/products">Continue Shopping</Link>
                    </Button>
                  </div>

                  <div className="flex items-center justify-center text-xs text-neutral-400 font-medium pt-2">
                    <ShieldCheck className="w-4 h-4 mr-1.5 text-green-700" />
                    SSL Secure Transaction Guarantee
                  </div>
                </div>

              </div>

            </div>
          ) : (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="text-center py-20 rounded-[2.5rem] bg-white border border-neutral-100 shadow-sm p-8 sm:p-12 max-w-md mx-auto"
            >
              <div className="mx-auto w-20 h-20 bg-green-50 rounded-full flex items-center justify-center text-green-700 mb-6">
                <ShoppingBag className="w-10 h-10" />
              </div>
              <h2 className="text-2xl font-extrabold text-neutral-900 mb-2">Your Bag is Empty</h2>
              <p className="text-neutral-400 text-sm mb-8">
                Explore our collections of hand-crafted, eco-friendly bamboo and clay items.
              </p>
              <Button asChild className="h-12 rounded-xl bg-green-800 hover:bg-green-900 text-base font-bold px-8 shadow-md">
                <Link to="/products">
                  Shop Our Collection
                  <ArrowRight className="ml-2 w-4 h-4" />
                </Link>
              </Button>
            </motion.div>
          )}

        </div>
      </main>
      <Footer />
    </div>
  );
};

export default Cart;
