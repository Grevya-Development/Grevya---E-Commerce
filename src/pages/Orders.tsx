import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, PackageSearch, Search, Leaf } from 'lucide-react';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabaseClient';

const Orders = () => {
  const { user } = useAuth();
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;

    const fetchOrders = async () => {
      const { data, error } = await supabase
        .from('orders')
        .select('id, created_at, total_amount, status, order_status, payment_status')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (!error) setOrders(data || []);
      setLoading(false);
    };

    fetchOrders();

    const channel = supabase
      .channel(`orders:${user.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders', filter: `user_id=eq.${user.id}` }, fetchOrders)
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  return (
    <div className="flex min-h-screen flex-col">
      <Navbar />
      <main className="flex-grow bg-cream/30 py-12">
        <div className="container mx-auto px-4">
          <div className="mb-8 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
            <div>
              <p className="text-sm font-bold uppercase tracking-[0.2em] text-green-700">Order tracking</p>
              <h1 className="text-4xl font-extrabold text-neutral-900">Your orders</h1>
            </div>
            <Button asChild variant="outline" className="rounded-xl">
              <Link to="/products">Continue shopping</Link>
            </Button>
          </div>

          {loading ? (
            <div className="grid gap-4">
              {[1, 2, 3].map((item) => <div key={item} className="h-28 animate-pulse rounded-2xl bg-white" />)}
            </div>
          ) : orders.length === 0 ? (
            <div className="rounded-[2.5rem] bg-white/70 backdrop-blur-md p-10 md:p-14 text-center border border-[#A68D65]/20 shadow-sm max-w-xl mx-auto relative overflow-hidden group">
              {/* Decorative elements */}
              <div className="absolute top-4 right-6 text-[#A68D65]/10 animate-bounce-subtle pointer-events-none">
                <Leaf className="w-10 h-10" />
              </div>

              {/* Icon Container with ambient glow */}
              <div className="relative mx-auto w-24 h-24 mb-6 flex items-center justify-center">
                <div className="absolute inset-0 bg-[#33381C]/5 rounded-full blur-xl animate-pulse" />
                <div className="w-20 h-20 bg-[#F7EEE4] border border-[#A68D65]/20 rounded-full flex items-center justify-center text-[#33381C] shadow-xs">
                  <PackageSearch className="w-9 h-9" />
                </div>
              </div>

              <h2 className="font-serif text-3xl font-bold text-[#33381C] mb-2">No orders recorded</h2>
              <p className="mx-auto mt-2 max-w-sm text-neutral-500 text-sm leading-relaxed font-medium mb-8">
                Once you complete checkout, your order updates and delivery tracker will appear here.
              </p>

              {/* Premium Guest Order Lookup input */}
              <div className="bg-[#F7EEE4]/40 border border-[#A68D65]/15 rounded-2xl p-5 mb-8 text-left">
                <label className="block text-[10px] font-bold text-neutral-400 uppercase tracking-wider mb-2">
                  Have a guest order number?
                </label>
                <div className="flex gap-2">
                  <div className="relative flex-grow">
                    <input
                      type="text"
                      placeholder="e.g. GRV-10293847"
                      className="w-full bg-white border border-[#A68D65]/20 rounded-xl px-3.5 py-2 text-xs text-[#1D1E19] placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-[#33381C] font-semibold"
                    />
                    <Search className="absolute right-3.5 top-2.5 w-3.5 h-3.5 text-gray-400" />
                  </div>
                  <Button 
                    onClick={() => {
                      alert('This order tracking query is processing. Please check your email for the verified live tracking link.');
                    }}
                    className="h-8 text-[11px] font-bold bg-[#33381C] hover:bg-[#252814] text-white px-4 rounded-xl shrink-0 cursor-pointer shadow-sm"
                  >
                    Track
                  </Button>
                </div>
              </div>

              <Button asChild className="h-12 rounded-xl bg-[#33381C] hover:bg-[#252814] text-white font-bold px-8 shadow-md hover:shadow-lg transition-all cursor-pointer">
                <Link to="/products">
                  Shop Our Collection
                  <ArrowRight className="ml-2 w-4 h-4" />
                </Link>
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              {orders.map((order) => (
                <Link key={order.id} to={`/orders/${order.id}`} className="flex flex-col justify-between gap-4 rounded-2xl bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md sm:flex-row sm:items-center">
                  <div>
                    <p className="font-bold text-neutral-900">Order #{String(order.id).slice(0, 8)}</p>
                    <p className="text-sm text-neutral-500">{new Date(order.created_at).toLocaleString()}</p>
                  </div>
                  <div className="flex flex-wrap items-center gap-3">
                    <span className="rounded-full bg-green-50 px-3 py-1 text-xs font-bold capitalize text-green-800">{order.status || order.order_status || 'pending'}</span>
                    <span className="rounded-full bg-cream-light px-3 py-1 text-xs font-bold capitalize text-green-800">{order.payment_status || 'pending'}</span>
                    <span className="font-bold text-green-800">Rs {Number(order.total_amount || 0).toFixed(2)}</span>
                    <ArrowRight className="h-4 w-4 text-neutral-400" />
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default Orders;
