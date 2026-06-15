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
    <div className="bg-[#F7EEE4]/30 min-h-screen">
      {/* Premium Dashboard Header */}
      <section className="relative bg-gradient-to-br from-[#33381C] to-[#212413] text-[#F7EEE4] overflow-hidden">
        {/* Subtle decorative background circles */}
        <div className="absolute top-0 right-0 w-80 h-80 bg-[#A68D65]/10 rounded-full blur-3xl -z-10" />
        <div className="absolute bottom-0 left-10 w-60 h-60 bg-[#E7E9DD]/5 rounded-full blur-2xl -z-10" />

        <div className="container mx-auto px-4 py-10 md:py-14 grid gap-8 lg:grid-cols-[1.2fr_0.8fr] items-center">
          <motion.div 
            initial={{ opacity: 0, y: 15 }} 
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="space-y-4 text-center lg:text-left"
          >
            <div className="inline-flex items-center rounded-full bg-white/8 px-3.5 py-1.5 text-xs font-bold tracking-wider text-[#A68D65] uppercase">
              <Sparkles className="mr-1.5 h-3.5 w-3.5 text-[#A68D65]" />
              Welcome Back
            </div>
            <h1 className="font-serif text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight text-white leading-tight">
              Hello, {displayName}
            </h1>
            <p className="max-w-xl text-sm sm:text-base text-white/70 mx-auto lg:mx-0">
              Manage your orders, save addresses, and enjoy custom product suggestions from Grevya Naturals.
            </p>
            <div className="flex flex-wrap items-center justify-center lg:justify-start gap-3 pt-2">
              <Button asChild className="rounded-xl bg-[#A68D65] hover:bg-[#8F7752] text-[#1D1E19] font-bold px-5 py-5 text-xs transition-all shadow-sm">
                <Link to="/products">Shop Recommendations</Link>
              </Button>
              <Button asChild variant="outline" className="rounded-xl border-white/20 bg-transparent text-white hover:bg-white/10 px-5 py-5 text-xs transition-all">
                <Link to="/orders" className="flex items-center">
                  Track Orders <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
                </Link>
              </Button>
            </div>
          </motion.div>

          {/* Quick Stats Grid */}
          <div className="grid grid-cols-3 gap-3 md:gap-4">
            {[
              { icon: ShoppingCart, label: 'Cart Items', value: totalItems, link: '/cart' },
              { icon: Package, label: 'Recent Orders', value: orders.length, link: '/orders' },
              { icon: Heart, label: 'Wishlist', value: 'Saved', link: '/account' },
            ].map((item, idx) => (
              <Link
                key={idx}
                to={item.link}
                className="group flex flex-col items-center justify-center text-center rounded-2xl border border-white/8 bg-white/5 p-4 backdrop-blur-md transition-all duration-300 hover:bg-white/10 hover:border-white/20 hover:-translate-y-1 shadow-sm"
              >
                <item.icon className="h-5 w-5 text-[#A68D65] group-hover:scale-110 transition-transform mb-2" />
                <span className="text-xl md:text-2xl font-bold text-white leading-none mb-1">{item.value}</span>
                <span className="text-[10px] md:text-xs text-white/60 font-semibold">{item.label}</span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Account Shortcuts */}
      <section className="py-8 bg-[#EAE2D5]/25 border-b border-[#A68D65]/10">
        <div className="container mx-auto px-4">
          <div className="grid gap-4 sm:grid-cols-3">
            <Link 
              to="/account" 
              className="group flex items-start space-x-4 bg-white/70 border border-[#A68D65]/10 p-5 rounded-2xl shadow-sm hover:shadow-md hover:bg-white transition-all duration-300 hover:-translate-y-0.5"
            >
              <Settings className="h-5 w-5 text-[#33381C] mt-0.5 group-hover:rotate-45 transition-transform" />
              <div>
                <h3 className="font-serif text-base font-bold text-[#1D1E19]">Account Overview</h3>
                <p className="text-xs text-[#1D1E19]/60 mt-1">Manage profiles, default addresses, and secure authentication.</p>
              </div>
            </Link>

            <Link 
              to="/orders" 
              className="group flex items-start space-x-4 bg-white/70 border border-[#A68D65]/10 p-5 rounded-2xl shadow-sm hover:shadow-md hover:bg-white transition-all duration-300 hover:-translate-y-0.5"
            >
              <Package className="h-5 w-5 text-[#33381C] mt-0.5 group-hover:translate-x-0.5 transition-transform" />
              <div>
                <h3 className="font-serif text-base font-bold text-[#1D1E19]">Order Tracker</h3>
                <p className="text-xs text-[#1D1E19]/60 mt-1">
                  {orders[0] ? `Latest order is ${orders[0].status}.` : 'View order histories and download invoices.'}
                </p>
              </div>
            </Link>

            <Link 
              to="/products" 
              className="group flex items-start space-x-4 bg-white/70 border border-[#A68D65]/10 p-5 rounded-2xl shadow-sm hover:shadow-md hover:bg-white transition-all duration-300 hover:-translate-y-0.5"
            >
              <Heart className="h-5 w-5 text-[#33381C] mt-0.5 group-hover:scale-110 transition-transform" />
              <div>
                <h3 className="font-serif text-base font-bold text-[#1D1E19]">Organic Catalog</h3>
                <p className="text-xs text-[#1D1E19]/60 mt-1">Discover new releases, seasonal specials, and bestsellers.</p>
              </div>
            </Link>
          </div>
        </div>
      </section>

      {/* Recommended Products Display (High Visibility) */}
      <section className="py-12 bg-white">
        <div className="container mx-auto px-4">
          <div className="mb-8 flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-[#A68D65]">Handpicked For You</span>
              <h2 className="font-serif text-2xl md:text-3xl font-bold text-[#33381C] mt-1">Continue Exploring</h2>
            </div>
            <Link to="/products" className="inline-flex items-center text-xs font-bold uppercase tracking-wider text-[#33381C] hover:text-[#A68D65] transition-colors">
              View All Products <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
            </Link>
          </div>

          {isLoading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
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
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
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
    </div>
  );
};

export default PersonalizedHome;
