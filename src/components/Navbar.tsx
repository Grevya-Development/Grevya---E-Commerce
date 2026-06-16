import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { LogOut, Package, Search, Settings, ShoppingCart, Menu, X, User, Sun, Moon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useCartStore } from '@/store/useCartStore';
import { useAuth } from '@/context/AuthContext';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import NotificationBell from './NotificationBell';
import { motion, AnimatePresence } from 'framer-motion';

const Navbar = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const getTotalItems = useCartStore((state) => state.getTotalItems);
  const [cartCount, setCartCount] = useState(0);
  const { user, profile, signOut } = useAuth();
  const [isScrolled, setIsScrolled] = useState(false);

  const [theme, setTheme] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('grevya-theme') || 'light';
    }
    return 'light';
  });

  useEffect(() => {
    const root = window.document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    localStorage.setItem('grevya-theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme(prev => prev === 'light' ? 'dark' : 'light');
  };

  // Hydration fix for client-only state vs SSR output mismatch
  useEffect(() => {
    setCartCount(getTotalItems());
  }, [getTotalItems]);

  // Scroll listener to activate shrinking floating panel
  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const location = useLocation();

  const [windowWidth, setWindowWidth] = useState(typeof window !== 'undefined' ? window.innerWidth : 1024);

  useEffect(() => {
    const handleResize = () => setWindowWidth(window.innerWidth);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const isMobile = windowWidth < 768;

  const toggleMenu = () => {
    setIsMenuOpen(!isMenuOpen);
  };

  const navItems = [
    { path: '/', name: 'Home' },
    { path: '/about', name: 'About Us' },
    { path: '/products', name: 'Products' },
    { path: '/contact', name: 'Contact' },
  ];

  return (
    <div className="sticky top-0 z-40 w-full">
      <motion.nav
        animate={{
          y: isScrolled ? 10 : 0,
          scale: isScrolled ? (isMobile ? 0.95 : 0.97) : 1,
        }}
        transition={{
          type: 'spring',
          stiffness: 220,
          damping: 24,
          mass: 0.8
        }}
        className="relative w-full select-none origin-top"
      >
        
        {/* PREMIUM STATIC -> FLOATING BACKGROUND PANEL */}
        <motion.div
          animate={{
            backgroundColor: isScrolled ? 'var(--nav-bg-scrolled)' : 'var(--nav-bg-top)',
            borderColor: isScrolled ? 'var(--nav-border-scrolled)' : 'var(--nav-border-top)',
            borderRadius: isScrolled ? (isMobile ? '16px' : '9999px') : '0px',
            boxShadow: isScrolled 
              ? 'var(--nav-shadow-scrolled)' 
              : 'var(--nav-shadow-top)',
          }}
          transition={{
            type: 'spring',
            stiffness: 220,
            damping: 24,
            mass: 0.8
          }}
          className={`absolute inset-0 -z-10 backdrop-blur-md transition-all ${isScrolled ? 'border border-[#A68D65]/20' : 'border-b'}`}
        />

        {/* NAVBAR CONTENT CONTAINER */}
        <div className="flex items-center justify-between w-full max-w-7xl mx-auto py-3.5 px-4 md:px-8 relative">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-2 md:gap-2.5 shrink-0" aria-label="Grevya Naturals home">
            <img 
              src="/logo-mark.svg" 
              alt="" 
              className="h-10 w-10 md:h-11 md:w-11 shrink-0" 
            />
            <span className="flex flex-col leading-none">
              <span className="font-serif font-bold tracking-[0.16em] text-[#33381C] text-base md:text-lg">
                GREVYA
              </span>
              <span className="font-semibold tracking-[0.4em] text-[#A68D65] text-[7.5px] md:text-[8.5px] mt-0.5 md:mt-1">
                NATURALS
              </span>
            </span>
          </Link>

          {/* Desktop Navigation with sliding active underline */}
          <div className="hidden md:flex space-x-6 lg:space-x-8 items-center relative">
            {navItems.map((item) => {
              const active = item.path === '/' 
                ? location.pathname === '/' 
                : location.pathname.startsWith(item.path);

              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`relative py-1 text-sm font-semibold tracking-wide transition-colors ${
                    active ? 'text-[#33381C]' : 'text-[#1D1E19]/60 hover:text-[#33381C]'
                  }`}
                >
                  {item.name}
                  {active && (
                    <motion.div
                      layoutId="activeNavbarTab"
                      className="absolute -bottom-1 left-0 right-0 h-[2px] bg-[#33381C] rounded-full"
                      transition={{ type: 'spring', stiffness: 350, damping: 28 }}
                    />
                  )}
                </Link>
              );
            })}
          </div>

          {/* Right side actions */}
          <div className="hidden md:flex items-center space-x-3.5">
            {/* Spotlight Search trigger button */}
            <button
              onClick={() => window.dispatchEvent(new CustomEvent('open-grevya-search'))}
              className="flex items-center space-x-2 w-36 lg:w-48 rounded-full border border-[#A68D65]/20 bg-white/50 hover:bg-white py-1.5 px-3.5 text-sm text-foreground/75 text-left cursor-pointer transition-all hover:border-[#A68D65]/40 shadow-sm"
              aria-label="Open Spotlight Search"
            >
              <Search className="h-4 w-4 text-gray-400 shrink-0" />
              <span className="text-gray-400 text-xs flex-grow">Search...</span>
              <span className="hidden lg:inline-block text-[9px] px-1.5 py-0.5 rounded border border-[#A68D65]/30 text-gray-400 font-mono shadow-xs">/</span>
            </button>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="rounded-full hover:bg-[#A68D65]/10 text-gray-750" title={user ? 'Account' : 'Login'}>
                  <User className="h-4.5 w-4.5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56 rounded-2xl border border-[#A68D65]/15 bg-[#F7EEE4] shadow-md">
                {user ? (
                  <>
                    <div className="px-3.5 py-2.5 text-sm border-b border-[#A68D65]/10">
                      <p className="font-semibold text-[#33381C]">{profile?.full_name || user.email}</p>
                      <p className="truncate text-xs text-neutral-500">{user.email}</p>
                    </div>
                    <DropdownMenuItem asChild className="focus:bg-[#A68D65]/10 cursor-pointer">
                      <Link to="/account" className="w-full flex items-center"><Settings className="mr-2 h-4 w-4" /> Account Settings</Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild className="focus:bg-[#A68D65]/10 cursor-pointer">
                      <Link to="/orders" className="w-full flex items-center"><Package className="mr-2 h-4 w-4" /> My Orders</Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={signOut} className="focus:bg-red-50 text-red-700 cursor-pointer">
                      <LogOut className="mr-2 h-4 w-4" /> Logout
                    </DropdownMenuItem>
                  </>
                ) : (
                  <>
                    <DropdownMenuItem asChild className="focus:bg-[#A68D65]/10 cursor-pointer">
                      <Link to="/login" className="w-full font-semibold">Login</Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild className="focus:bg-[#A68D65]/10 cursor-pointer">
                      <Link to="/signup" className="w-full font-semibold">Create Account</Link>
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>

            <Button 
              variant="ghost" 
              size="icon" 
              onClick={toggleTheme}
              className="rounded-full hover:bg-[#A68D65]/10 text-gray-700 dark:text-[#F7EEE4]"
              title={theme === 'light' ? 'Dark Mode' : 'Light Mode'}
            >
              {theme === 'light' ? (
                <Moon className="h-4.5 w-4.5 text-[#33381C] dark:text-[#F7EEE4]" />
              ) : (
                <Sun className="h-4.5 w-4.5 text-[#33381C] dark:text-[#F7EEE4]" />
              )}
            </Button>

            <NotificationBell />

            <Link to="/cart" className="relative">
              <Button variant="ghost" size="icon" className="rounded-full hover:bg-[#A68D65]/10 text-gray-700">
                <ShoppingCart className="h-4.5 w-4.5" />
                {cartCount > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 bg-[#33381C] text-[#F7EEE4] text-[9px] rounded-full w-4 h-4 flex items-center justify-center font-bold">
                    {cartCount}
                  </span>
                )}
              </Button>
            </Link>
          </div>

          <div className="flex md:hidden items-center space-x-3">
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={toggleTheme}
              className="rounded-full text-gray-750 dark:text-[#F7EEE4]"
              title={theme === 'light' ? 'Dark Mode' : 'Light Mode'}
            >
              {theme === 'light' ? (
                <Moon className="h-5 w-5 text-[#33381C] dark:text-[#F7EEE4]" />
              ) : (
                <Sun className="h-5 w-5 text-[#33381C] dark:text-[#F7EEE4]" />
              )}
            </Button>

            <NotificationBell />
            <Link to="/cart" className="relative">
              <Button variant="ghost" size="icon" className="rounded-full text-gray-700">
                <ShoppingCart className="h-5 w-5" />
                {cartCount > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 bg-[#33381C] text-[#F7EEE4] text-[9px] rounded-full w-4.5 h-4.5 flex items-center justify-center font-bold">
                    {cartCount}
                  </span>
                )}
              </Button>
            </Link>
            <Button variant="ghost" size="icon" className="rounded-full text-gray-750" onClick={toggleMenu}>
              {isMenuOpen ? (
                <X className="h-5.5 w-5.5" />
              ) : (
                <Menu className="h-5.5 w-5.5" />
              )}
            </Button>
          </div>
        </div>
      </motion.nav>

      {/* Mobile Menu Overlay Drawer */}
      <AnimatePresence>
        {isMenuOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] as [number, number, number, number] }}
            className="md:hidden bg-[#F7EEE4] border-t border-[#A68D65]/15 py-5 px-4 shadow-xl overflow-hidden"
          >
            <div className="flex flex-col space-y-4">
              {navItems.map((item) => (
                <Link 
                  key={item.path}
                  to={item.path} 
                  className={`text-base font-bold py-1 border-b border-[#A68D65]/5 ${
                    location.pathname === item.path ? 'text-[#33381C]' : 'text-[#1D1E19]'
                  }`}
                  onClick={toggleMenu}
                >
                  {item.name}
                </Link>
              ))}
              
              <button
                onClick={() => {
                  toggleMenu();
                  window.dispatchEvent(new CustomEvent('open-grevya-search'));
                }}
                className="w-full flex items-center space-x-2 rounded-full border border-[#A68D65]/20 bg-white py-2.5 px-4 text-sm text-foreground/50 text-left shadow-xs cursor-pointer"
              >
                <Search className="h-4 w-4 text-gray-400 shrink-0" />
                <span>Search products...</span>
              </button>
              
              <Button asChild variant="outline" className="w-full rounded-xl border-[#33381C]/35 text-[#33381C] font-bold">
                <Link to={user ? '/account' : '/login'} onClick={toggleMenu}>{user ? 'My Account' : 'Login / Signup'}</Link>
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default Navbar;
