
import React, { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { LogOut, Package, Search, Settings, ShoppingCart, Menu, X, User } from 'lucide-react';
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

const Navbar = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const getTotalItems = useCartStore((state) => state.getTotalItems);
  const [cartCount, setCartCount] = useState(0);
  const { user, profile, signOut } = useAuth();

  // Hydration fix for client-only state vs SSR output mismatch if any
  useEffect(() => {
    setCartCount(getTotalItems());
  }, [getTotalItems]);

  const location = useLocation();
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState('');

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const q = searchTerm.trim();
    navigate(q ? `/products?q=${encodeURIComponent(q)}` : '/products');
    setIsMenuOpen(false);
  };

  const toggleMenu = () => {
    setIsMenuOpen(!isMenuOpen);
  };

  const isActive = (path: string) => {
    return location.pathname === path ? "text-green-700 font-medium" : "text-foreground hover:text-green-700";
  };

  return (
    <nav className="sticky top-0 z-40 bg-white/95 backdrop-blur-md shadow-sm border-b border-gray-100">
      <div className="container mx-auto px-4 py-3">
        <div className="flex items-center justify-between">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-2.5 md:gap-3" aria-label="Grevya Naturals home">
            <img src="/logo-mark.svg" alt="" className="h-11 w-11 md:h-14 md:w-14 shrink-0" />
            <span className="flex flex-col leading-none">
              <span className="font-serif text-xl md:text-2xl font-bold tracking-[0.18em] text-[#33381C]">GREVYA</span>
              <span className="text-[9px] md:text-[11px] font-semibold tracking-[0.42em] text-[#A68D65] mt-1">NATURALS</span>
            </span>
          </Link>

          {/* Desktop Navigation */}
          <div className="hidden md:flex space-x-8">
            <Link to="/" className={`nav-link ${isActive('/')}`}>Home</Link>
            <Link to="/about" className={`nav-link ${isActive('/about')}`}>About Us</Link>
            <Link to="/products" className={`nav-link ${location.pathname.includes('/products') ? 'text-green-700 font-medium' : 'text-foreground hover:text-green-700'}`}>Products</Link>
            <Link to="/contact" className={`nav-link ${isActive('/contact')}`}>Contact</Link>
          </div>

          {/* Right side icons */}
          <div className="hidden md:flex items-center space-x-4">
            <form onSubmit={handleSearch} className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <input
                type="search"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search products..."
                aria-label="Search products"
                className="w-40 lg:w-52 rounded-full border border-input bg-white py-1.5 pl-9 pr-3 text-sm text-foreground placeholder:text-gray-400 outline-none transition-all focus:w-56 focus:ring-2 focus:ring-green-700/30"
              />
            </form>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" title={user ? 'Account' : 'Login'}>
                  <User className="h-5 w-5 text-gray-600" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                {user ? (
                  <>
                    <div className="px-2 py-2 text-sm">
                      <p className="font-semibold text-brown-800">{profile?.full_name || user.email}</p>
                      <p className="truncate text-xs text-gray-500">{user.email}</p>
                    </div>
                    <DropdownMenuItem asChild>
                      <Link to="/account" className="w-full"><Settings className="mr-2 h-4 w-4" /> Account</Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                      <Link to="/orders" className="w-full"><Package className="mr-2 h-4 w-4" /> Orders</Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={signOut}>
                      <LogOut className="mr-2 h-4 w-4" /> Logout
                    </DropdownMenuItem>
                  </>
                ) : (
                  <>
                    <DropdownMenuItem asChild>
                      <Link to="/login" className="w-full">Login</Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                      <Link to="/signup" className="w-full">Create account</Link>
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
            <NotificationBell />
            <Link to="/cart" className="relative">
              <Button variant="ghost" size="icon">
                <ShoppingCart className="h-5 w-5 text-gray-600" />
                {cartCount > 0 && (
                  <span className="absolute -top-1 -right-1 bg-green-700 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                    {cartCount}
                  </span>
                )}
              </Button>
            </Link>
          </div>

          {/* Mobile menu button */}
          <div className="flex md:hidden items-center space-x-4">
            <NotificationBell />
            <Link to="/cart" className="relative">
              <Button variant="ghost" size="icon">
                <ShoppingCart className="h-5 w-5 text-gray-600" />
                {cartCount > 0 && (
                  <span className="absolute -top-1 -right-1 bg-green-700 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                    {cartCount}
                  </span>
                )}
              </Button>
            </Link>
            <Button variant="ghost" size="icon" onClick={toggleMenu}>
              {isMenuOpen ? (
                <X className="h-6 w-6 text-gray-600" />
              ) : (
                <Menu className="h-6 w-6 text-gray-600" />
              )}
            </Button>
          </div>
        </div>
      </div>

      {/* Mobile menu */}
      {isMenuOpen && (
        <div className="md:hidden bg-white border-t border-gray-100 py-4 animate-fade-in">
          <div className="container mx-auto px-4 flex flex-col space-y-4">
            <Link to="/" className={`text-foreground py-2 ${isActive('/')}`} onClick={toggleMenu}>Home</Link>
            <Link to="/about" className={`text-foreground py-2 ${isActive('/about')}`} onClick={toggleMenu}>About Us</Link>
            <Link to="/products" className={`text-foreground py-2 ${isActive('/products')}`} onClick={toggleMenu}>Products</Link>
            <Link to="/contact" className={`text-foreground py-2 ${isActive('/contact')}`} onClick={toggleMenu}>Contact</Link>
            <form onSubmit={handleSearch} className="relative pt-2">
              <Search className="pointer-events-none absolute left-3 top-1/2 mt-1 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <input
                type="search"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search products..."
                aria-label="Search products"
                className="w-full rounded-full border border-input bg-white py-2 pl-9 pr-3 text-sm text-foreground placeholder:text-gray-400 outline-none focus:ring-2 focus:ring-green-700/30"
              />
            </form>
            <Button asChild variant="outline" size="sm" className="w-full">
              <Link to={user ? '/account' : '/login'} onClick={toggleMenu}>{user ? 'Account' : 'Login'}</Link>
            </Button>
          </div>
        </div>
      )}
    </nav>
  );
};

export default Navbar;
