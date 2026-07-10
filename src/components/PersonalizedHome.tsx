import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Bell, Heart, Package, ShoppingCart, Sparkles, User, Settings } from 'lucide-react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import ProductCard from '@/components/ProductCard';
import { useAuth } from '@/context/AuthContext';
import { useCartStore } from '@/store/useCartStore';
import { supabase } from '@/lib/supabaseClient';

const PersonalizedHome = () => {
  const { user, profile } = useAuth();
  const totalItems = useCartStore((state) => state.getTotalItems());
  const [orders, setOrders] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!user) return;

    const fetchHomeData = async () => {
      try {
        setIsLoading(true);
        const [{ data: orderRows }, { data: productRows }] = await Promise.all([
          supabase
            .from('orders')
            .select('id, status, total_amount, created_at')
            .eq('user_id', user.id)
            .order('created_at', { ascending: false })
            .limit(3),
          supabase
            .from('products')
            .select('*')
            .limit(4),
        ]);

        setOrders(orderRows || []);
        setProducts((productRows || []).map((item) => ({
          ...item,
          image: item.image_url,
          rating: item.rating || 4,
          slug: (item.name || '').toLowerCase().replace(/\s+/g, '-'),
        })));
      } catch (err) {
        console.error('Error fetching personalized home data:', err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchHomeData();
  }, [user]);

  const displayName = profile?.full_name || user?.email?.split('@')[0] || 'customer';

  return (
    <div className="bg-[#F7EEE4]/10">
      {/* 1. Tailored Recommendations Section */}
      <section className="py-16 bg-white/40 border-t border-[#A68D65]/10">
        <div className="container mx-auto px-4">
          <div className="mb-10 text-center lg:text-left">
            <span className="text-[10px] font-bold uppercase tracking-wider text-[#A68D65]">Tailored for You</span>
            <h2 className="font-serif text-3xl font-bold text-[#33381C] mt-1 mb-3">Your Botanical Edit</h2>
            <p className="text-xs sm:text-sm text-[#1D1E19]/65 max-w-xl">
              Discover unique recommendations handcrafted by local rural communities, curated specifically for your lifestyle.
            </p>
          </div>

          {isLoading ? (
            <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2 sm:gap-4 lg:gap-6">
              {[1, 2, 3, 4].map((n) => (
                <div key={n} className="bg-[#FBF7F1] rounded-2xl border border-[#A68D65]/12 flex flex-col h-[400px] overflow-hidden animate-pulse">
                  <div className="bg-[#EAE2D5]/30 h-64 w-full shimmer-bg" />
                  <div className="p-4 flex flex-col flex-grow">
                    <div className="h-4 bg-[#EAE2D5]/50 rounded w-1/3 mb-2" />
                    <div className="h-5 bg-[#EAE2D5]/50 rounded w-3/4 mb-3" />
                    <div className="h-4 bg-[#EAE2D5]/50 rounded w-1/4 mb-4" />
                    <div className="h-9 bg-[#EAE2D5]/50 rounded-xl w-full mt-auto" />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2 sm:gap-4 lg:gap-6">
              {products.map((product) => (
                <ProductCard
                  key={product.id}
                  id={product.id}
                  name={product.name}
                  price={product.price}
                  image={product.image}
                  category={product.category}
                  rating={product.rating}
                  slug={product.slug}
                />
              ))}
            </div>
          )}
        </div>
      </section>

      {/* 2. Minimal Personal Hub Card */}
      <section className="py-12 bg-[#F7EEE4]/60 border-t border-[#A68D65]/10">
        <div className="container mx-auto px-4 max-w-5xl">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6 bg-[#33381C] text-[#F7EEE4] p-6 md:p-8 rounded-3xl shadow-sm border border-[#A68D65]/15">
            <div className="text-center md:text-left">
              <span className="text-[9px] font-bold uppercase tracking-widest text-[#A68D65] flex items-center justify-center md:justify-start gap-1">
                <Sparkles className="h-3 w-3" /> Member Account
              </span>
              <h3 className="font-serif text-2xl font-bold mt-1 text-white">Hello, {displayName}</h3>
              <p className="text-xs text-white/60 mt-1.5 max-w-md leading-relaxed">
                Review your active basket, track your delivery shipments, or update your profiles and settings here.
              </p>
            </div>
            <div className="flex gap-3 shrink-0 flex-wrap justify-center">
              <Button asChild className="rounded-xl bg-[#A68D65] hover:bg-[#8F7752] text-[#1D1E19] font-bold px-5 py-4 text-xs transition-all shadow-sm cursor-pointer">
                <Link to="/account">Account Settings</Link>
              </Button>
              <Button asChild variant="outline" className="rounded-xl border-white/20 bg-transparent text-white hover:bg-white/10 px-5 py-4 text-xs transition-all cursor-pointer">
                <Link to="/orders" className="flex items-center">
                  Track Orders <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};

export default PersonalizedHome;
