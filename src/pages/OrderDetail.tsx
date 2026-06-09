import React, { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { CheckCircle2, Circle, Package, Truck } from 'lucide-react';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabaseClient';

const statuses = ['pending', 'confirmed', 'processing', 'shipped', 'out_for_delivery', 'delivered'];

const OrderDetail = () => {
  const { id } = useParams();
  const { user } = useAuth();
  const [order, setOrder] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const activeIndex = useMemo(() => {
    const status = order?.status || 'pending';
    return Math.max(0, statuses.indexOf(status));
  }, [order]);

  useEffect(() => {
    if (!user || !id) return;

    const fetchOrder = async () => {
      try {
        const [{ data, error }, { data: historyData }] = await Promise.all([
          supabase
            .from('orders')
            .select('*, order_items(*)')
            .eq('id', id)
            .eq('user_id', user.id)
            .maybeSingle(),
          supabase
            .from('order_status_history')
            .select('*')
            .eq('order_id', id)
            .order('created_at', { ascending: true })
        ]);

        if (!error && data) {
          setOrder({
            ...data,
            history: historyData || []
          });
        }
      } catch (err) {
        console.warn("Failed to load order history log:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchOrder();

    const channel = supabase
      .channel(`order:${id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders', filter: `id=eq.${id}` }, fetchOrder)
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [id, user]);

  return (
    <div className="flex min-h-screen flex-col">
      <Navbar />
      <main className="flex-grow bg-cream/30 py-12">
        <div className="container mx-auto max-w-5xl px-4">
          {loading ? (
            <div className="h-96 animate-pulse rounded-[2rem] bg-white" />
          ) : !order ? (
            <div className="rounded-[2rem] bg-white p-12 text-center shadow-sm">
              <Package className="mx-auto mb-4 h-12 w-12 text-green-800" />
              <h1 className="text-2xl font-bold">Order not found</h1>
              <Button asChild className="mt-6 rounded-xl bg-green-800 hover:bg-green-900"><Link to="/orders">Back to orders</Link></Button>
            </div>
          ) : (
            <div className="space-y-6">
              <section className="rounded-[2rem] bg-white p-6 shadow-sm md:p-8">
                <div className="flex flex-col justify-between gap-4 md:flex-row md:items-start">
                  <div>
                    <p className="text-sm font-bold uppercase tracking-[0.2em] text-green-700">Order details</p>
                    <h1 className="text-3xl font-extrabold text-neutral-900">#{String(order.id).slice(0, 8)}</h1>
                    <p className="mt-1 text-neutral-500">Placed on {new Date(order.created_at).toLocaleString()}</p>
                  </div>
                  <div className="text-left md:text-right">
                    <p className="text-2xl font-extrabold text-green-800">Rs {Number(order.total_amount || 0).toFixed(2)}</p>
                    <p className="text-sm capitalize text-neutral-500">Payment: {order.payment_status || 'pending'}</p>
                  </div>
                </div>
              </section>

              {order.status === 'cancelled' ? (
                <section className="rounded-[2rem] bg-white p-6 shadow-sm md:p-8 border-t-4 border-red-500">
                  <div className="mb-6 flex items-center gap-3">
                    <Truck className="h-6 w-6 text-red-600" />
                    <h2 className="text-xl font-bold text-neutral-900">Order Status</h2>
                  </div>
                  <div className="mb-6 rounded-2xl bg-red-50 p-5 text-red-900 border border-red-100">
                    <p className="font-bold text-lg mb-1">This order has been cancelled</p>
                    <p className="text-sm opacity-90">If you have already paid, a refund will be processed to your original payment method within 5-7 business days.</p>
                  </div>
                  <div className="grid gap-4 grid-cols-2 max-w-md">
                    <div className="relative rounded-2xl border border-neutral-100 p-4 bg-neutral-50">
                      <CheckCircle2 className="mb-3 h-6 w-6 text-neutral-500" />
                      <p className="text-sm font-bold text-neutral-600">Pending</p>
                    </div>
                    <div className="relative rounded-2xl border border-red-100 p-4 bg-red-50/50">
                      <CheckCircle2 className="mb-3 h-6 w-6 text-red-600" />
                      <p className="text-sm font-bold text-red-700">Cancelled</p>
                    </div>
                  </div>
                </section>
              ) : (
                <section className="rounded-[2rem] bg-white p-6 shadow-sm md:p-8">
                  <div className="mb-6 flex items-center gap-3">
                    <Truck className="h-6 w-6 text-green-800" />
                    <h2 className="text-xl font-bold">Live tracking</h2>
                  </div>
                  <div className="grid gap-4 md:grid-cols-6">
                    {statuses.map((status, index) => {
                      const complete = index <= activeIndex;
                      return (
                        <div key={status} className={`relative rounded-2xl border p-4 ${complete ? 'border-green-100 bg-green-50/10' : 'border-neutral-100'}`}>
                          {complete ? <CheckCircle2 className="mb-3 h-6 w-6 text-green-700" /> : <Circle className="mb-3 h-6 w-6 text-neutral-300" />}
                          <p className={`text-sm font-bold capitalize ${complete ? 'text-green-800' : 'text-neutral-400'}`}>{status.replace(/_/g, ' ')}</p>
                        </div>
                      );
                    })}
                  </div>
                  <p className="mt-5 text-sm text-neutral-500">Estimated delivery: {order.estimated_delivery ? new Date(order.estimated_delivery).toLocaleDateString() : '2-3 business days after dispatch'}</p>
                </section>
              )}

              {/* Order Status History Timeline Audit */}
              {order.history && order.history.length > 0 && (
                <section className="rounded-[2rem] bg-white p-6 shadow-sm md:p-8 border border-neutral-100/50">
                  <h2 className="mb-6 text-xl font-bold text-neutral-900">Activity History Log</h2>
                  <div className="relative border-l border-neutral-100 pl-6 space-y-6 ml-3">
                    {order.history.map((h: any) => (
                      <div key={h.id} className="relative">
                        <span className="absolute -left-[31px] top-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-green-100 ring-4 ring-white">
                          <span className="h-2 w-2 rounded-full bg-green-700" />
                        </span>
                        <div>
                          <p className="text-sm font-bold text-neutral-800 capitalize">{h.status.replace(/_/g, ' ')}</p>
                          <p className="text-xs text-neutral-500 mt-0.5">{h.notes}</p>
                          <p className="text-[10px] text-neutral-400 mt-1">{new Date(h.created_at).toLocaleString()}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              )}

              <section className="rounded-[2rem] bg-white p-6 shadow-sm md:p-8 border border-neutral-100/50">
                <h2 className="mb-4 text-xl font-bold">Product summary</h2>
                <div className="space-y-3">
                  {(order.order_items || []).map((item: any) => (
                    <div key={item.id || item.product_id} className="flex items-center justify-between gap-4 rounded-2xl bg-neutral-50 p-4">
                      <div className="flex items-center gap-4">
                        {item.product_image && (
                          <img
                            src={item.product_image}
                            alt={item.product_name || 'Product'}
                            className="h-16 w-16 rounded-xl object-cover border border-neutral-200/50 bg-white"
                          />
                        )}
                        <div>
                          <p className="font-bold text-neutral-800">{item.product_name || `Product #${item.product_id}`}</p>
                          <p className="text-sm text-neutral-500">Qty {item.quantity}</p>
                        </div>
                      </div>
                      <p className="font-bold text-green-800 whitespace-nowrap">Rs {Number(item.price || 0).toFixed(2)}</p>
                    </div>
                  ))}
                </div>
              </section>
            </div>
          )}
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default OrderDetail;
