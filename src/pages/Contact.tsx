import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Mail, Phone, MapPin, Send, MessageSquare, Clock, ShieldCheck, ChevronDown, Check, Loader2 } from 'lucide-react';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabaseClient';
import { useToast } from '@/components/ui/use-toast';

interface OrderOption {
  id: string;
  created_at: string;
  total_amount: number;
}

const FAQItem = ({ question, answer }: { question: string; answer: string }) => {
  const [isOpen, setIsOpen] = useState(false);
  return (
    <div className="border-b border-[#A68D65]/15 last:border-0 py-4">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex justify-between items-center text-left py-2 group cursor-pointer focus:outline-none"
      >
        <span className="font-serif text-base font-bold text-[#33381C] group-hover:text-[#A68D65] transition-colors">
          {question}
        </span>
        <motion.div
          animate={{ rotate: isOpen ? 180 : 0 }}
          transition={{ duration: 0.3 }}
          className="text-[#A68D65] shrink-0 ml-4"
        >
          <ChevronDown className="w-5 h-5" />
        </motion.div>
      </button>
      <AnimatePresence initial={false}>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: 'easeInOut' }}
            className="overflow-hidden"
          >
            <p className="text-sm text-neutral-600 leading-relaxed pt-2 pb-4 font-medium">
              {answer}
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

const Contact = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [selectedOrder, setSelectedOrder] = useState('');
  const [category, setCategory] = useState('general');
  const [orders, setOrders] = useState<OrderOption[]>([]);
  const [submitting, setSubmitting] = useState(false);

  // Fetch user orders if logged in
  useEffect(() => {
    if (!user) return;
    const fetchUserOrders = async () => {
      try {
        const { data, error } = await supabase
          .from('orders')
          .select('id, created_at, total_amount')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
          .limit(10);
        if (!error && data) {
          setOrders(data as OrderOption[]);
        }
      } catch (err) {
        console.warn('Failed to load orders for contact form:', err);
      }
    };
    fetchUserOrders();
  }, [user]);

  // Sync user info to name and email states
  useEffect(() => {
    if (user) {
      setEmail(user.email || '');
      // Try to fetch profile name if exists
      const fetchProfileName = async () => {
        const { data } = await supabase
          .from('profiles')
          .select('full_name')
          .eq('id', user.id)
          .single();
        if (data?.full_name) {
          setName(data.full_name);
        }
      };
      fetchProfileName();
    }
  }, [user]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);

    try {
      // Mock submission logic for high-end feel
      await new Promise((resolve) => setTimeout(resolve, 1500));
      
      toast({
        title: 'Message Sent Successfully',
        description: 'Thank you for reaching out. A representative will contact you shortly.',
      });

      // Clear non-user inputs
      setSubject('');
      setMessage('');
      setSelectedOrder('');
    } catch (err: any) {
      toast({
        title: 'Error sending message',
        description: err.message || 'Please try again later.',
        variant: 'destructive',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const supportCategories = [
    { id: 'general', label: 'General Help' },
    { id: 'orders', label: 'Order & Refund' },
    { id: 'wholesale', label: 'Wholesale Inquiry' },
    { id: 'feedback', label: 'Sourcing Feedback' },
  ];

  const faqs = [
    {
      question: 'Where do you source your fallen palm leaves?',
      answer: 'We source 100% of our areca palm leaves from small farming communities in Nagaranai and neighboring rural regions of South India. We collect only naturally shed leaves, ensuring complete ecological respect.',
    },
    {
      question: 'Do you offer bulk customization for corporate orders?',
      answer: 'Yes. We provide complete customization services for large events, corporate gifting, and hotels, including brand embossing and tailored shapes. Contact us via the Wholesale category for details.',
    },
    {
      question: 'What is your shipping and return policy?',
      answer: 'We offer free shipping on orders above ₹500. For damaged items or quality concerns, we offer a 100% replacement guarantee. Just take a photo and upload a support message here.',
    },
    {
      question: 'Are your items microwave and freezer safe?',
      answer: 'Absolutely. Our molded areca palm leaf plates are highly heat-resistant, microwave-safe for up to 2 minutes, and freezer-safe. They hold both hot liquids and cold foods perfectly.',
    },
  ];

  // Reusable FloatingInput inside Contact page
  const FloatingInput = ({
    label,
    type = 'text',
    value,
    onChange,
    required = false,
    disabled = false,
  }: {
    label: string;
    type?: string;
    value: string;
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
    required?: boolean;
    disabled?: boolean;
  }) => {
    const inputId = `contact-${label.toLowerCase().replace(/\s+/g, '-')}`;
    return (
      <div className="relative z-0 w-full group">
        <input
          type={type}
          id={inputId}
          name={inputId}
          className="block py-2.5 px-0 w-full text-sm text-[#1D1E19] bg-transparent border-0 border-b-2 border-gray-300 appearance-none focus:outline-none focus:ring-0 focus:border-[#33381C] peer"
          placeholder=" "
          value={value}
          onChange={onChange}
          required={required}
          disabled={disabled}
        />
        <label
          htmlFor={inputId}
          className="peer-focus:font-medium absolute text-sm text-gray-500 duration-300 transform -translate-y-6 scale-75 top-3 -z-10 origin-[0] peer-focus:left-0 peer-focus:text-[#33381C] peer-placeholder-shown:scale-100 peer-placeholder-shown:translate-y-0 peer-focus:scale-75"
        >
          {label}
        </label>
      </div>
    );
  };

  return (
    <div className="flex flex-col min-h-screen bg-[#FBF9F6] text-[#1D1E19]">
      <Navbar />

      <main className="flex-grow">
        {/* PREMIUM STORY HERO */}
        <section className="bg-gradient-to-b from-[#F7EEE4] to-[#FBF9F6] py-16 md:py-24 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-96 h-96 bg-[#33381C]/5 rounded-full blur-[90px] -translate-y-1/2 translate-x-1/3" />
          <div className="container mx-auto px-4 max-w-5xl relative z-10 text-center">
            <span className="text-xs uppercase tracking-[0.25em] font-bold text-[#A68D65] mb-3 inline-block">
              Support Center
            </span>
            <h1 className="font-serif text-4xl md:text-5xl font-bold text-[#33381C] mb-4 tracking-tight">
              We're here to assist you
            </h1>
            <p className="text-neutral-500 text-sm md:text-base max-w-2xl mx-auto font-medium leading-relaxed">
              Have a question about our zero-waste ingredients, bulk options, or an order? 
              Connect with our design and support team directly.
            </p>
          </div>
        </section>

        {/* SUPPORT DASHBOARD */}
        <section className="py-12 md:py-20">
          <div className="container mx-auto px-4 max-w-6xl">
            <div className="grid grid-cols-1 lg:grid-cols-[1.1fr_1.9fr] gap-10 items-stretch">
              
              {/* LEFT COLUMN: CONTACT DETAILS & STATS */}
              <div className="space-y-6 flex flex-col justify-between">
                <div className="rounded-3xl p-8 bg-white border border-[#A68D65]/15 shadow-xs flex-grow space-y-8">
                  
                  {/* Category description */}
                  <div>
                    <h2 className="font-serif text-2xl font-bold text-[#33381C] mb-3">Our Office</h2>
                    <p className="text-neutral-500 text-xs font-medium leading-relaxed">
                      Visit our headquarters or contact us through traditional channels. We welcome visits to review our manufacturing standards and samples.
                    </p>
                  </div>

                  {/* Trust indicator */}
                  <div className="flex items-center space-x-3.5 p-4 rounded-2xl bg-[#F7EEE4]/40 border border-[#A68D65]/10">
                    <Clock className="w-5 h-5 text-[#33381C] shrink-0" />
                    <div>
                      <h4 className="text-xs font-bold text-[#33381C] uppercase tracking-wider">Average Response Time</h4>
                      <p className="text-[11px] text-neutral-500 font-semibold mt-0.5">We reply in under 2 hours during weekdays.</p>
                    </div>
                  </div>

                  {/* Detail channels */}
                  <div className="space-y-6">
                    <div className="flex items-start">
                      <div className="bg-[#F7EEE4] p-3 rounded-2xl mr-4 shrink-0 text-[#33381C]">
                        <MapPin className="h-5 w-5" />
                      </div>
                      <div>
                        <h3 className="font-bold text-[#33381C] text-sm mb-0.5">Location</h3>
                        <p className="text-xs text-neutral-600 leading-relaxed font-semibold">
                          4th South Cross St., Kovai Thiru Nagar,<br />
                          Kalapatty (E), Coimbatore 641014.
                        </p>
                      </div>
                    </div>
                    
                    <div className="flex items-start">
                      <div className="bg-[#F7EEE4] p-3 rounded-2xl mr-4 shrink-0 text-[#33381C]">
                        <Phone className="h-5 w-5" />
                      </div>
                      <div>
                        <h3 className="font-bold text-[#33381C] text-sm mb-0.5">Phone</h3>
                        <p className="text-xs text-neutral-600 font-semibold">95669 66054</p>
                        <p className="text-[10px] text-neutral-400 font-bold uppercase tracking-wider mt-0.5">Mon - Fri, 9am - 6pm IST</p>
                      </div>
                    </div>
                    
                    <div className="flex items-start">
                      <div className="bg-[#F7EEE4] p-3 rounded-2xl mr-4 shrink-0 text-[#33381C]">
                        <Mail className="h-5 w-5" />
                      </div>
                      <div>
                        <h3 className="font-bold text-[#33381C] text-sm mb-0.5">Email</h3>
                        <p className="text-xs text-neutral-600 font-semibold">info@grevya.com</p>
                      </div>
                    </div>
                  </div>

                </div>

                {/* Ambient Map Placeholder */}
                <div className="rounded-3xl border border-[#A68D65]/15 overflow-hidden bg-[#EAE2D5] h-52 relative flex items-center justify-center shadow-xs">
                  <div className="absolute inset-0 bg-[url('https://api.mapbox.com/styles/v1/mapbox/streets-v11/static/77.01,11.04,11,0/400x200?access_token=mock')] bg-cover bg-center opacity-40 mix-blend-multiply" />
                  <div className="absolute inset-0 bg-[#A68D65]/10 pointer-events-none" />
                  <div className="relative z-10 text-center space-y-1">
                    <MapPin className="w-8 h-8 text-[#33381C] mx-auto animate-bounce-subtle" />
                    <p className="text-[10px] font-bold text-[#33381C] uppercase tracking-wider">Coimbatore, Tamil Nadu</p>
                    <span className="text-[9px] text-[#33381C]/70 font-semibold px-2 py-0.5 rounded-full bg-white/70">Google Maps Verified</span>
                  </div>
                </div>
              </div>

              {/* RIGHT COLUMN: CONTACT FORM */}
              <div className="rounded-3xl p-8 bg-white border border-[#A68D65]/15 shadow-xs flex flex-col justify-between">
                <div>
                  <h2 className="font-serif text-2xl font-bold text-[#33381C] mb-6">Send a Message</h2>
                  
                  {/* Category Tabs Selector */}
                  <div className="mb-8">
                    <label className="block text-xs uppercase font-bold text-neutral-400 tracking-wider mb-3">
                      Inquiry Category
                    </label>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      {supportCategories.map((cat) => (
                        <button
                          key={cat.id}
                          type="button"
                          onClick={() => setCategory(cat.id)}
                          className={`px-3 py-2.5 rounded-xl text-xs font-bold border transition-all cursor-pointer text-center ${
                            category === cat.id
                              ? 'bg-[#33381C] border-[#33381C] text-[#F7EEE4] shadow-xs'
                              : 'bg-transparent border-[#A68D65]/20 text-neutral-600 hover:border-[#A68D65]/50'
                          }`}
                        >
                          {cat.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <form onSubmit={handleSubmit} className="space-y-6">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                      <FloatingInput
                        label="Your Name"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        required
                      />
                      <FloatingInput
                        label="Email Address"
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                      />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 items-end">
                      <FloatingInput
                        label="Subject"
                        value={subject}
                        onChange={(e) => setSubject(e.target.value)}
                        required
                      />
                      
                      {/* Contextual Order Dropdown if user has orders */}
                      {category === 'orders' && (
                        <div className="relative z-0 w-full group">
                          {orders.length > 0 ? (
                            <select
                              value={selectedOrder}
                              onChange={(e) => setSelectedOrder(e.target.value)}
                              className="block py-2.5 px-0 w-full text-sm text-[#1D1E19] bg-transparent border-0 border-b-2 border-gray-300 appearance-none focus:outline-none focus:ring-0 focus:border-[#33381C] font-semibold"
                            >
                              <option value="">Select Related Order</option>
                              {orders.map((ord) => (
                                <option key={ord.id} value={ord.id}>
                                  Order #{String(ord.id).slice(0, 8)} - ₹{Number(ord.total_amount).toFixed(2)}
                                </option>
                              ))}
                            </select>
                          ) : (
                            <input
                              type="text"
                              placeholder="Order ID (Optional)"
                              value={selectedOrder}
                              onChange={(e) => setSelectedOrder(e.target.value)}
                              className="block py-2.5 px-0 w-full text-sm text-[#1D1E19] bg-transparent border-0 border-b-2 border-gray-300 appearance-none focus:outline-none focus:ring-0 focus:border-[#33381C] placeholder-gray-400"
                            />
                          )}
                          <label className="absolute text-[10px] text-gray-400 font-bold uppercase tracking-wider -translate-y-6 top-1">
                            Related Order
                          </label>
                        </div>
                      )}
                    </div>

                    <div className="relative">
                      <textarea
                        value={message}
                        onChange={(e) => setMessage(e.target.value)}
                        rows={4}
                        placeholder="Write your request here..."
                        className="w-full rounded-2xl border border-gray-200 p-4 text-sm focus:outline-none focus:ring-2 focus:ring-[#33381C] focus:border-transparent placeholder-gray-400 bg-[#FBF9F6]/50"
                        required
                      />
                    </div>

                    <div className="flex items-center justify-between pt-2">
                      <div className="flex items-center space-x-2 text-xs text-neutral-400 font-bold uppercase tracking-wider">
                        <ShieldCheck className="w-4 h-4 text-[#A68D65]" />
                        <span>Secure Messaging SSL</span>
                      </div>
                      <Button
                        type="submit"
                        disabled={submitting}
                        className="bg-[#33381C] hover:bg-[#252814] text-white font-bold h-12 px-6 rounded-xl cursor-pointer shadow-md"
                      >
                        {submitting ? (
                          <Loader2 className="w-4 h-4 animate-spin mr-2" />
                        ) : (
                          <Send className="w-4 h-4 mr-2" />
                        )}
                        Send Message
                      </Button>
                    </div>
                  </form>
                </div>
              </div>

            </div>
          </div>
        </section>

        {/* EMBEDDED FAQ SECTION */}
        <section className="py-20 bg-white border-t border-[#A68D65]/10">
          <div className="container mx-auto px-4 max-w-4xl">
            <div className="text-center mb-12">
              <span className="text-xs uppercase tracking-[0.25em] font-bold text-[#A68D65] mb-2 inline-block">
                Frequently Asked
              </span>
              <h2 className="font-serif text-3xl font-bold text-[#33381C]">
                Helpful Inquiries
              </h2>
            </div>
            
            <div className="bg-[#FBF9F6] border border-[#A68D65]/15 rounded-3xl p-6 md:p-8 space-y-1 shadow-xs">
              {faqs.map((faq, idx) => (
                <FAQItem key={idx} question={faq.question} answer={faq.answer} />
              ))}
            </div>
          </div>
        </section>

        {/* BULK/WHOLESALE INQUIRY BANNER */}
        <section className="bg-[#F7EEE4] py-16 border-t border-[#A68D65]/10">
          <div className="container mx-auto px-4 text-center max-w-3xl space-y-6">
            <h2 className="font-serif text-3xl font-bold text-[#33381C]">Interested in Wholesale partnerships?</h2>
            <p className="text-neutral-600 text-sm leading-relaxed max-w-2xl mx-auto font-medium">
              We offer exclusive tier pricing, customizable sizes, logo branding options, and global freight solutions for corporate branding, hotels, and bulk distribution.
            </p>
            <Button
              onClick={() => {
                setCategory('wholesale');
                window.scrollTo({ top: 400, behavior: 'smooth' });
              }}
              className="bg-[#33381C] hover:bg-[#252814] text-white font-bold h-12 px-8 rounded-xl cursor-pointer"
            >
              Configure Wholesale Request
            </Button>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
};

export default Contact;
