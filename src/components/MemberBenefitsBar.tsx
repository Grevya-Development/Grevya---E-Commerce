import React, { useState, useEffect } from 'react';
import { X, Truck, Leaf, ShieldCheck, Sparkles } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const BENEFITS = [
  { id: 1, text: "Free shipping on organic orders over $50", icon: Truck },
  { id: 2, text: "100% Natural, Cruelty-Free & Vegan", icon: Leaf },
  { id: 3, text: "Use code GREVYA10 for 10% off first order", icon: Sparkles },
  { id: 4, text: "Secure payments & COD available", icon: ShieldCheck }
];

export default function MemberBenefitsBar() {
  const [isVisible, setIsVisible] = useState(true);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isScrolledUp, setIsScrolledUp] = useState(true);
  const [lastScrollY, setLastScrollY] = useState(0);

  // Rotate benefits on mobile/tablet
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % BENEFITS.length);
    }, 4500);
    return () => clearInterval(timer);
  }, []);

  // Sync visibility with localStorage persistence
  useEffect(() => {
    const isDismissed = localStorage.getItem('grevya-benefits-dismissed') === 'true';
    if (isDismissed) {
      setIsVisible(false);
    }
  }, []);

  // Listen to scroll to adjust sticky positioning
  useEffect(() => {
    const handleScroll = () => {
      const currentScrollY = window.scrollY;
      if (currentScrollY < 10) {
        setIsScrolledUp(true);
      } else if (currentScrollY > lastScrollY) {
        // Scrolling down -> hide promo bar
        setIsScrolledUp(false);
      } else {
        // Scrolling up -> reveal promo bar
        setIsScrolledUp(true);
      }
      setLastScrollY(currentScrollY);
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [lastScrollY]);

  const handleDismiss = () => {
    setIsVisible(false);
    localStorage.setItem('grevya-benefits-dismissed', 'true');
  };

  if (!isVisible) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ height: 0, opacity: 0 }}
        animate={{ height: 'auto', opacity: 1 }}
        exit={{ height: 0, opacity: 0 }}
        transition={{ duration: 0.3, ease: 'easeInOut' }}
        className={`w-full z-50 bg-[#33381C] text-[#F7EEE4] py-2 px-4 border-b border-[#F7EEE4]/10 transition-transform duration-300 sticky ${
          isScrolledUp ? 'top-0' : '-translate-y-full'
        }`}
      >
        <div className="max-w-7xl mx-auto flex items-center justify-between text-xs md:text-sm font-sans tracking-wide">
          {/* Desktop view: display multiple items grid-style */}
          <div className="hidden md:flex items-center justify-around w-full mr-4">
            {BENEFITS.map((b) => {
              const IconComp = b.icon;
              return (
                <div key={b.id} className="flex items-center space-x-2 text-[#F7EEE4]/90 hover:text-[#F7EEE4] transition-colors">
                  <IconComp className="h-4 w-4 text-[#A68D65]" />
                  <span>{b.text}</span>
                </div>
              );
            })}
          </div>

          {/* Mobile view: rotating carousel */}
          <div className="flex md:hidden items-center justify-center w-full mr-2">
            <AnimatePresence mode="wait">
              <motion.div
                key={currentIndex}
                initial={{ y: 8, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: -8, opacity: 0 }}
                transition={{ duration: 0.25, ease: 'easeInOut' }}
                className="flex items-center space-x-2 text-center"
              >
                {React.createElement(BENEFITS[currentIndex].icon, { className: "h-4 w-4 text-[#A68D65]" })}
                <span className="font-medium">{BENEFITS[currentIndex].text}</span>
              </motion.div>
            </AnimatePresence>
          </div>

          {/* Dismiss button */}
          <button
            onClick={handleDismiss}
            className="p-1 rounded-full text-[#F7EEE4]/70 hover:text-[#F7EEE4] hover:bg-white/10 transition-all shrink-0"
            aria-label="Dismiss benefits bar"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
