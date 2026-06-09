import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Instagram, Youtube, MapPin, Mail, Phone, Clock, ArrowRight, ArrowUp } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

const QUICK_LINKS = [
  { to: '/terms', label: 'Terms & Conditions' },
  { to: '/return-refund-policy', label: 'Return & Refund Policy' },
  { to: '/privacy-policy', label: 'Privacy Policy' },
  { to: '/shipping-payment-policy', label: 'Shipping & Payment Policy' },
];

const BOTTOM_NAV = [
  { to: '/', label: 'Home' },
  { to: '/about', label: 'About Us' },
  { to: '/products', label: 'Products' },
  { to: '/contact', label: 'Contact' },
  { to: '/account', label: 'Account' },
];

const PAYMENTS = [
  { label: 'AMEX', className: 'text-blue-700' },
  { label: 'Diners', className: 'text-gray-700' },
  { label: 'Maestro', className: 'text-red-600' },
  { label: 'Mastercard', className: 'text-orange-600' },
  { label: 'RuPay', className: 'text-green-700' },
  { label: 'Visa', className: 'text-blue-800' },
];

const WHATSAPP_NUMBER = '919566966054';

const Footer = () => {
  const [email, setEmail] = useState('');
  const [showTop, setShowTop] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    const onScroll = () => setShowTop(window.scrollY > 400);
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const handleSubscribe = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;
    toast({
      title: 'Subscribed!',
      description: "You're on the list for product launches & offers.",
    });
    setEmail('');
  };

  const scrollToTop = () => window.scrollTo({ top: 0, behavior: 'smooth' });

  return (
    <footer className="bg-[#E9E1D4] text-neutral-800">
      <div className="container mx-auto px-4 pt-16 pb-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
          {/* Signup + Store */}
          <div>
            <h2 className="font-serif text-3xl md:text-4xl font-medium leading-tight mb-6">
              Signup &amp; get access to Product Launch &amp; Offers
            </h2>
            <form onSubmit={handleSubscribe} className="relative max-w-md">
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Email"
                aria-label="Email"
                className="w-full rounded-full bg-white/70 border border-neutral-300 py-4 pl-6 pr-16 text-neutral-800 placeholder:text-neutral-500 focus:outline-none focus:ring-2 focus:ring-neutral-400"
              />
              <button
                type="submit"
                aria-label="Subscribe"
                className="absolute right-2 top-1/2 -translate-y-1/2 flex h-10 w-10 items-center justify-center rounded-full border border-neutral-400 hover:bg-neutral-800 hover:text-white transition-colors"
              >
                <ArrowRight size={20} />
              </button>
            </form>
            <p className="text-sm text-neutral-600 mt-3 max-w-md">
              By subscribing you agree to the{' '}
              <Link to="/terms" className="underline">Terms of Use</Link> &amp;{' '}
              <Link to="/privacy-policy" className="underline">Privacy Policy.</Link>
            </p>

            <h3 className="font-serif text-2xl font-medium mt-12 mb-5">Visit our store</h3>
            <ul className="space-y-4 text-neutral-700">
              <li className="flex items-start gap-3">
                <MapPin className="w-5 h-5 mt-0.5 shrink-0" />
                <span>4th South Cross St., Kovai Thiru Nagar, Kalapatty (E), Coimbatore 641014.</span>
              </li>
              <li className="flex items-center gap-3">
                <Mail className="w-5 h-5 shrink-0" />
                <a href="mailto:info@grevya.com" className="hover:underline">info@grevya.com</a>
              </li>
              <li className="flex items-center gap-3">
                <Phone className="w-5 h-5 shrink-0" />
                <a href="tel:+919566966054" className="hover:underline">95669 66054</a>
              </li>
              <li className="flex items-center gap-3">
                <Clock className="w-5 h-5 shrink-0" />
                <span>10:00am – 5:00pm, Monday to Saturday</span>
              </li>
            </ul>

            <div className="flex items-center gap-4 mt-8">
              <a href="https://instagram.com" target="_blank" rel="noreferrer" aria-label="Instagram" className="hover:opacity-70 transition-opacity">
                <Instagram size={22} />
              </a>
              <a href="https://youtube.com" target="_blank" rel="noreferrer" aria-label="YouTube" className="hover:opacity-70 transition-opacity">
                <Youtube size={24} />
              </a>
            </div>
          </div>

          {/* About us */}
          <div>
            <h2 className="font-serif text-3xl md:text-4xl font-medium mb-6">About us</h2>
            <p className="text-neutral-700 leading-relaxed max-w-md">
              At Grevya Naturals, we believe everyday essentials should be kind to you and to the planet.
              That's why our products are 100% natural and eco-friendly, crafted with care and free from
              harsh chemicals—because sustainability should never come with a compromise.
            </p>
          </div>

          {/* Quick links */}
          <div>
            <h2 className="font-serif text-3xl md:text-4xl font-medium mb-6">Quick links</h2>
            <ul className="space-y-4 text-neutral-700">
              {QUICK_LINKS.map(({ to, label }) => (
                <li key={to}>
                  <Link to={to} className="hover:underline">{label}</Link>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="border-t border-neutral-300/70 mt-14 pt-8 flex flex-col gap-8 lg:flex-row lg:items-center lg:justify-between">
          <p className="text-sm text-neutral-600 order-3 lg:order-1">
            &copy; {new Date().getFullYear()} Grevya Naturals. All rights reserved.
          </p>

          <nav className="order-1 lg:order-2 flex flex-wrap gap-x-7 gap-y-3 justify-center">
            {BOTTOM_NAV.map(({ to, label }) => (
              <Link key={to} to={to} className="text-sm text-neutral-800 hover:underline">{label}</Link>
            ))}
          </nav>

          <div className="order-2 lg:order-3 flex flex-wrap items-center gap-2 justify-center lg:justify-end">
            {PAYMENTS.map(({ label, className }) => (
              <span
                key={label}
                className={`bg-white rounded-md px-2.5 py-1.5 text-[11px] font-bold leading-none shadow-sm ${className}`}
              >
                {label}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Floating WhatsApp button */}
      <a
        href={`https://wa.me/${WHATSAPP_NUMBER}`}
        target="_blank"
        rel="noreferrer"
        aria-label="Chat on WhatsApp"
        className="fixed bottom-6 left-6 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-[#25D366] text-white shadow-lg hover:scale-105 transition-transform"
      >
        <svg viewBox="0 0 24 24" width="28" height="28" fill="currentColor" aria-hidden="true">
          <path d="M.057 24l1.687-6.163a11.867 11.867 0 01-1.587-5.945C.16 5.335 5.495 0 12.05 0a11.82 11.82 0 018.413 3.488 11.82 11.82 0 013.48 8.414c-.003 6.557-5.338 11.892-11.893 11.892a11.9 11.9 0 01-5.688-1.448L.057 24zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884a9.86 9.86 0 001.59 5.392l-.999 3.648 3.909-1.039zm11.387-5.464c-.074-.124-.272-.198-.57-.347-.297-.149-1.758-.868-2.031-.967-.272-.099-.47-.149-.669.149-.198.297-.768.967-.941 1.165-.173.198-.347.223-.644.074-.297-.149-1.255-.462-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.521.151-.172.2-.296.3-.495.099-.198.05-.372-.025-.521-.075-.148-.669-1.611-.916-2.206-.242-.579-.487-.501-.669-.51l-.57-.01c-.198 0-.52.074-.792.372s-1.04 1.016-1.04 2.479 1.065 2.876 1.213 3.074c.149.198 2.095 3.2 5.076 4.487.709.306 1.263.489 1.694.626.712.226 1.36.194 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.695.248-1.29.173-1.414z"/>
        </svg>
      </a>

      {/* Scroll to top */}
      {showTop && (
        <button
          onClick={scrollToTop}
          aria-label="Scroll to top"
          className="fixed bottom-6 right-6 z-50 flex h-12 w-12 items-center justify-center rounded-full bg-green-800 text-white shadow-lg hover:bg-green-900 transition-colors"
        >
          <ArrowUp size={22} />
        </button>
      )}
    </footer>
  );
};

export default Footer;
