
import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import { Button } from '@/components/ui/button';
import { Trash2, ShoppingBag, ArrowRight } from 'lucide-react';
import { toast } from '@/components/ui/use-toast';
import { productImages } from '@/lib/product-images';

// In a real app, this would come from a state management solution or context
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
  const [cartItems, setCartItems] = useState<CartItem[]>([
    {
      id: 1,
      name: "Premium Areca Leaf Plates (10\")",
      price: 249.00,
      image: productImages.areca.plates,
      quantity: 2,
      category: "areca",
      slug: "premium-areca-plates-10-inch"
    },
    {
      id: 6,
      name: "Pure Coconut Oil (500ml)",
      price: 350.00,
      image: productImages.natural.coconutOil,
      quantity: 1,
      category: "natural",
      slug: "pure-coconut-oil-500ml"
    }
  ]);
  
  const removeItem = (id: number) => {
    setCartItems(cartItems.filter(item => item.id !== id));
    toast({
      title: "Item removed",
      description: "The item has been removed from your cart."
    });
  };
  
  const updateQuantity = (id: number, newQuantity: number) => {
    if (newQuantity < 1) return;
    
    setCartItems(cartItems.map(item => 
      item.id === id ? { ...item, quantity: newQuantity } : item
    ));
  };
  
  const subtotal = cartItems.reduce((total, item) => total + (item.price * item.quantity), 0);
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
                    <div className="border-t border-gray-100 pt-3 mt-3">
                      <div className="flex justify-between font-semibold text-lg">
                        <span>Total</span>
                        <span className="text-green-700">₹{total.toFixed(2)}</span>
                      </div>
                    </div>
                  </div>
                  <Button asChild className="w-full">
                    <Link to="/checkout">
                      Proceed to Checkout
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </Link>
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
