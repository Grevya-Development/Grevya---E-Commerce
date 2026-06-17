import React, { useState, useEffect } from 'react';
import { X, Star, ShoppingCart, Plus, Minus, Shield, Sparkles, Leaf } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '@/lib/supabaseClient';
import { useCartStore } from '@/store/useCartStore';
import { toast } from '@/components/ui/use-toast';
import { ProductProps } from './ProductCard';

export default function QuickViewModal() {
  const [isOpen, setIsOpen] = useState(false);
  const [product, setProduct] = useState<ProductProps | null>(null);
  const [description, setDescription] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const addItem = useCartStore((state) => state.addItem);

  useEffect(() => {
    const handleOpenQuickView = async (e: CustomEvent<ProductProps>) => {
      const p = e.detail;
      setProduct(p);
      setQuantity(1);
      setDescription('');
      setIsOpen(true);
      
      // Fetch full description/details from Supabase
      if (p?.id) {
        setIsLoading(true);
        try {
          const { data, error } = await supabase
            .from('products')
            .select('description')
            .eq('id', p.id)
            .single();
          if (error) throw error;
          setDescription(data?.description || 'No description available for this premium organic product.');
        } catch (err) {
          console.error('Error fetching product description for QuickView:', err);
          setDescription('Pure, cold-pressed natural ingredients sourced directly from organic farms. Experience premium wellness.');
        } finally {
          setIsLoading(false);
        }
      }
    };

    window.addEventListener('open-grevya-quickview', handleOpenQuickView as EventListener);
    return () => window.removeEventListener('open-grevya-quickview', handleOpenQuickView as EventListener);
  }, []);

  const handleAddToCart = () => {
    if (!product) return;
    addItem(product, quantity);
    toast({
      title: "Added to cart",
      description: `${quantity} × ${product.name} added to your cart`,
    });
    setIsOpen(false);
  };

  if (!product) return null;

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setIsOpen(false)}
            className="fixed inset-0 bg-[#1D1E19]/45 backdrop-blur-md"
          />

          {/* Modal Container */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 15 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 15 }}
            transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
            className="w-full max-w-3xl bg-[#F7EEE4] border border-[#A68D65]/20 rounded-3xl shadow-2xl overflow-hidden z-10 flex flex-col md:flex-row relative"
          >
            {/* Close Button */}
            <button
              onClick={() => setIsOpen(false)}
              className="absolute top-4 right-4 z-20 p-2 rounded-full bg-white/70 hover:bg-[#33381C] hover:text-[#F7EEE4] text-[#1D1E19] transition-all border border-[#A68D65]/10 shadow-sm"
            >
              <X className="h-4 w-4" />
            </button>

            {/* Product Image Area */}
            <div className="w-full md:w-1/2 h-72 md:h-auto min-h-[300px] relative bg-neutral-100/50">
              <img
                src={product.image}
                alt={product.name}
                className="w-full h-full object-cover"
              />
              {product.eco && (
                <span className="absolute top-4 left-4 z-10 eco-badge bg-white/90 backdrop-blur-sm shadow-md border-[#A68D65]/15">
                  <Leaf className="w-3.5 h-3.5 mr-1 text-[#33381C]" /> Eco Natural
                </span>
              )}
            </div>

            {/* Product Details Area */}
            <div className="w-full md:w-1/2 p-6 md:p-8 flex flex-col justify-between">
              <div>
                <span className="text-xs font-semibold tracking-wider text-[#A68D65] uppercase block mb-1">
                  {product.category}
                </span>
                <h2 className="font-serif text-2xl md:text-3xl font-bold text-[#33381C] mb-2 leading-tight">
                  {product.name}
                </h2>

                {/* Rating display */}
                <div className="flex items-center mb-4">
                  <div className="flex text-[#A68D65]">
                    {[...Array(5)].map((_, i) => (
                      <Star
                        key={i}
                        size={14}
                        fill={i < Math.floor(product.rating) ? "currentColor" : "none"}
                        stroke="currentColor"
                        className="mr-0.5"
                      />
                    ))}
                  </div>
                  <span className="text-xs font-medium text-[#1D1E19]/60 ml-2">
                    ({product.rating.toFixed(1)} Rating)
                  </span>
                </div>

                <div className="h-px bg-[#A68D65]/10 my-4" />

                {/* Price */}
                <p className="text-2xl font-bold text-[#33381C] mb-4">
                  ₹{product.price.toFixed(2)}
                </p>

                {/* Description loading/content */}
                <div className="text-sm text-[#1D1E19]/75 leading-relaxed mb-6">
                  {isLoading ? (
                    <div className="space-y-2">
                      <div className="h-4 bg-[#A68D65]/10 rounded w-full shimmer-bg" />
                      <div className="h-4 bg-[#A68D65]/10 rounded w-5/6 shimmer-bg" />
                      <div className="h-4 bg-[#A68D65]/10 rounded w-2/3 shimmer-bg" />
                    </div>
                  ) : (
                    <p className="line-clamp-4">{description}</p>
                  )}
                </div>

                {/* Brand promises */}
                <div className="grid grid-cols-2 gap-3 mb-6">
                  <div className="flex items-center space-x-2 text-xs text-[#33381C]/75">
                    <Sparkles className="h-3.5 w-3.5 text-[#A68D65]" />
                    <span>Pure Botanical Extracts</span>
                  </div>
                  <div className="flex items-center space-x-2 text-xs text-[#33381C]/75">
                    <Shield className="h-3.5 w-3.5 text-[#A68D65]" />
                    <span>Toxin-Free & Clean</span>
                  </div>
                </div>
              </div>

              {/* Add to Cart Actions */}
              <div className="space-y-4">
                <div className="flex items-center space-x-4">
                  <div className="flex items-center border border-[#A68D65]/35 rounded-xl bg-white overflow-hidden shadow-sm">
                    <button
                      onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                      className="px-3.5 py-2 hover:bg-[#A68D65]/10 text-[#33381C] transition-colors"
                      aria-label="Decrease quantity"
                    >
                      <Minus className="h-3.5 w-3.5" />
                    </button>
                    <span className="w-8 text-center text-sm font-bold text-[#1D1E19]">
                      {quantity}
                    </span>
                    <button
                      onClick={() => setQuantity((q) => q + 1)}
                      className="px-3.5 py-2 hover:bg-[#A68D65]/10 text-[#33381C] transition-colors"
                      aria-label="Increase quantity"
                    >
                      <Plus className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  <span className="text-xs text-[#1D1E19]/50">In Stock / Ready to Ship</span>
                </div>

                <button
                  onClick={handleAddToCart}
                  className="w-full flex items-center justify-center rounded-xl bg-[#33381C] hover:bg-[#262A14] text-[#F7EEE4] py-3.5 font-semibold transition-all duration-300 shadow-md hover:shadow-xl hover:-translate-y-0.5 active:translate-y-0"
                >
                  <ShoppingCart className="h-4 w-4 mr-2" />
                  Add to Cart • ₹{(product.price * quantity).toFixed(2)}
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
