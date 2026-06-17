import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Home, Compass, Search, ShoppingBag, User } from 'lucide-react';
import { useCartStore } from '@/store/useCartStore';
import { useAuth } from '@/context/AuthContext';
import { motion } from 'framer-motion';

export default function MobileBottomNav() {
  const location = useLocation();
  const { user } = useAuth();
  const getTotalItems = useCartStore((state) => state.getTotalItems);
  const [cartCount, setCartCount] = useState(0);
  
  // Scroll visibility states
  const [isVisible, setIsVisible] = useState(true);
  const [lastScrollY, setLastScrollY] = useState(0);

  // Sync cart count
  useEffect(() => {
    setCartCount(getTotalItems());
  }, [getTotalItems]);

  // Scroll listener to hide dock on scroll down
  useEffect(() => {
    const handleScroll = () => {
      const currentScrollY = window.scrollY;
      if (currentScrollY < 15) {
        setIsVisible(true);
      } else if (currentScrollY > lastScrollY) {
        // Scrolling down -> hide bottom dock
        setIsVisible(false);
      } else {
        // Scrolling up -> reveal bottom dock
        setIsVisible(true);
      }
      setLastScrollY(currentScrollY);
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [lastScrollY]);

  const isActive = (path: string) => {
    if (path === '/') return location.pathname === '/';
    return location.pathname.startsWith(path);
  };

  const triggerSearch = (e: React.MouseEvent) => {
    e.preventDefault();
    window.dispatchEvent(new CustomEvent('open-grevya-search'));
  };

  return (
    <div className={`md:hidden fixed bottom-5 left-4 right-4 z-40 transition-transform duration-500 ease-out gpu-accelerated ${
      isVisible ? 'translate-y-0' : 'translate-y-28'
    }`}>
      <div className="glass-pill h-16 flex items-center justify-around px-3 rounded-full bg-white/70 backdrop-blur-xl border border-[#A68D65]/20 shadow-2xl">
        {/* Home */}
        <motion.div whileTap={{ scale: 0.88 }} transition={{ type: "spring", stiffness: 400, damping: 15 }}>
          <Link
            to="/"
            className={`flex flex-col items-center justify-center w-12 h-12 rounded-full transition-colors ${
              isActive('/') ? 'text-[#33381C]' : 'text-[#33381C]/50'
            }`}
            aria-label="Navigate to Home"
          >
            <Home className="h-5 w-5" />
            <span className="text-[9px] font-bold tracking-tight mt-0.5">Home</span>
          </Link>
        </motion.div>

        {/* Categories / Products */}
        <motion.div whileTap={{ scale: 0.88 }} transition={{ type: "spring", stiffness: 400, damping: 15 }}>
          <Link
            to="/products"
            className={`flex flex-col items-center justify-center w-12 h-12 rounded-full transition-colors ${
              isActive('/products') ? 'text-[#33381C]' : 'text-[#33381C]/50'
            }`}
            aria-label="Navigate to Products"
          >
            <Compass className="h-5 w-5" />
            <span className="text-[9px] font-bold tracking-tight mt-0.5">Shop</span>
          </Link>
        </motion.div>

        {/* Search Trigger */}
        <motion.div whileTap={{ scale: 0.88 }} transition={{ type: "spring", stiffness: 400, damping: 15 }}>
          <button
            onClick={triggerSearch}
            className="flex flex-col items-center justify-center w-12 h-12 rounded-full text-[#33381C]/50 hover:text-[#33381C] transition-colors cursor-pointer"
            aria-label="Open Search Modal"
          >
            <Search className="h-5 w-5" />
            <span className="text-[9px] font-bold tracking-tight mt-0.5">Search</span>
          </button>
        </motion.div>

        {/* Cart */}
        <motion.div whileTap={{ scale: 0.88 }} transition={{ type: "spring", stiffness: 400, damping: 15 }}>
          <Link
            to="/cart"
            className={`flex flex-col items-center justify-center w-12 h-12 rounded-full transition-colors relative ${
              isActive('/cart') ? 'text-[#33381C]' : 'text-[#33381C]/50'
            }`}
            aria-label="Navigate to Cart"
          >
            <ShoppingBag className="h-5 w-5" />
            {cartCount > 0 && (
              <span className="absolute top-1 right-1 bg-[#33381C] text-[#F7EEE4] text-[8px] rounded-full min-w-4.5 h-4.5 px-1 flex items-center justify-center font-bold border border-[#F7EEE4] shadow-xs">
                {cartCount}
              </span>
            )}
            <span className="text-[9px] font-bold tracking-tight mt-0.5">Cart</span>
          </Link>
        </motion.div>

        {/* Account */}
        <motion.div whileTap={{ scale: 0.88 }} transition={{ type: "spring", stiffness: 400, damping: 15 }}>
          <Link
            to={user ? '/account' : '/login'}
            className={`flex flex-col items-center justify-center w-12 h-12 rounded-full transition-colors ${
              isActive('/account') || isActive('/login') ? 'text-[#33381C]' : 'text-[#33381C]/50'
            }`}
            aria-label="Navigate to Account"
          >
            <User className="h-5 w-5" />
            <span className="text-[9px] font-bold tracking-tight mt-0.5">Profile</span>
          </Link>
        </motion.div>
      </div>
    </div>
  );
}
