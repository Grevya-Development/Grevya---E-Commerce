import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Bell, Heart, Package, ShoppingCart, Sparkles } from 'lucide-react';
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

  useEffect(() => {
    if (!user) return;

    const fetchHomeData = async () => {
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
    };

    fetchHomeData();
  }, [user]);

  const displayName = profile?.full_name || user?.email?.split('@')[0] || 'Grevya customer';

  return (
    <>
      <section className="bg-green-900 text-white">
        <div className="container mx-auto grid gap-8 px-4 py-14 lg:grid-cols-[1.3fr_0.7fr] lg:items-center">
          <motion.div initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }}>
            <div className="mb-5 inline-flex items-center rounded-full bg-white/10 px-4 py-2 text-sm font-semibold">
              <Sparkles className="mr-2 h-4 w-4 text-clay" />
              Personalized Grevya
            </div>
            <h1 className="max-w-3xl text-4xl font-extrabold leading-tight md:text-6xl">
              Welcome back, {displayName}.
            </h1>
            <p className="mt-5 max-w-2xl text-lg text-white/75">
              Your eco-friendly store is ready with order tracking, saved account details, and faster checkout.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Button asChild className="rounded-xl bg-white text-green-900 hover:bg-green-50">
                <Link to="/products">Shop recommendations</Link>
              </Button>
              <Button asChild variant="outline" className="rounded-xl border-white/30 bg-transparent text-white hover:bg-white/10">
                <Link to="/orders">Track orders <ArrowRight className="ml-2 h-4 w-4" /></Link>
              </Button>
            </div>
          </motion.div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
            {[
              { icon: ShoppingCart, label: 'Cart items', value: totalItems },
              { icon: Package, label: 'Recent orders', value: orders.length },
              { icon: Bell, label: 'Updates', value: 'Realtime' },
            ].map((item) => (
              <div key={item.label} className="rounded-2xl border border-white/10 bg-white/10 p-5 backdrop-blur">
                <item.icon className="mb-3 h-6 w-6 text-clay" />
                <p className="text-2xl font-extrabold">{item.value}</p>
                <p className="text-sm text-white/65">{item.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-cream/30 py-12">
        <div className="container mx-auto px-4">
          <div className="grid gap-6 lg:grid-cols-[1fr_1fr_1fr]">
            <Link to="/account" className="rounded-2xl bg-white p-6 shadow-sm transition hover:-translate-y-1 hover:shadow-md">
              <Sparkles className="mb-3 h-6 w-6 text-green-800" />
              <h2 className="text-xl font-bold">Account overview</h2>
              <p className="mt-2 text-sm text-neutral-500">Manage profile, addresses, preferences, and security.</p>
            </Link>
            <Link to="/orders" className="rounded-2xl bg-white p-6 shadow-sm transition hover:-translate-y-1 hover:shadow-md">
              <Package className="mb-3 h-6 w-6 text-green-800" />
              <h2 className="text-xl font-bold">Order quick access</h2>
              <p className="mt-2 text-sm text-neutral-500">{orders[0] ? `Latest order is ${orders[0].status}.` : 'Your first order will appear here.'}</p>
            </Link>
            <Link to="/products" className="rounded-2xl bg-white p-6 shadow-sm transition hover:-translate-y-1 hover:shadow-md">
              <Heart className="mb-3 h-6 w-6 text-green-800" />
              <h2 className="text-xl font-bold">Wishlist ready</h2>
              <p className="mt-2 text-sm text-neutral-500">Save products and build your next sustainable order.</p>
            </Link>
          </div>
        </div>
      </section>

      <section className="bg-background py-16">
        <div className="container mx-auto px-4">
          <div className="mb-8 flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
            <div>
              <p className="text-sm font-bold uppercase tracking-[0.2em] text-green-700">Recommended for you</p>
              <h2 className="text-3xl font-extrabold text-neutral-900">Continue exploring</h2>
            </div>
            <Link to="/products" className="inline-flex items-center font-bold text-green-800">
              View all <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </div>
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
        </div>
      </section>
    </>
  );
};

export default PersonalizedHome;
