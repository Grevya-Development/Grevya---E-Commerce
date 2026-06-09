import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, PackageSearch } from 'lucide-react';
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
        .select('id, created_at, total_amount, status, payment_status, delivery_status')
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
            <div className="rounded-[2rem] bg-white p-12 text-center shadow-sm">
              <PackageSearch className="mx-auto mb-4 h-14 w-14 text-green-800" />
              <h2 className="text-2xl font-bold text-neutral-900">No orders yet</h2>
              <p className="mx-auto mt-2 max-w-md text-neutral-500">Once you checkout, your orders and delivery timeline will appear here.</p>
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
                    <span className="rounded-full bg-green-50 px-3 py-1 text-xs font-bold capitalize text-green-800">{order.status || 'pending'}</span>
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
