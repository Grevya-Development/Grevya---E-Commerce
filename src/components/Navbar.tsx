
import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Search, ShoppingCart, Menu, X, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useCartStore } from '@/store/useCartStore';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

const Navbar = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const getTotalItems = useCartStore((state) => state.getTotalItems);
  const [cartCount, setCartCount] = useState(0);

  // Hydration fix for client-only state vs SSR output mismatch if any
  useEffect(() => {
    setCartCount(getTotalItems());
  }, [getTotalItems]);

  const location = useLocation();

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
          <Link to="/" className="flex items-center">
            <span className="font-serif text-xl md:text-2xl font-bold text-green-700">Grevya</span>
            <span className="font-serif text-xl md:text-2xl font-normal text-brown-800">Industries</span>
          </Link>

          {/* Desktop Navigation */}
          <div className="hidden md:flex space-x-8">
            <Link to="/" className={`nav-link ${isActive('/')}`}>Home</Link>
            <Link to="/about" className={`nav-link ${isActive('/about')}`}>About Us</Link>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className={`nav-link ${location.pathname.includes('/products') ? 'text-green-700 font-medium' : 'text-foreground hover:text-green-700'}`}>Products</button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="center" className="w-56">
                <DropdownMenuItem asChild>
                  <Link to="/products?category=areca" className="w-full">Areca Products</Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link to="/products?category=natural" className="w-full">Natural Products</Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link to="/products" className="w-full">All Products</Link>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <Link to="/contact" className={`nav-link ${isActive('/contact')}`}>Contact</Link>
          </div>

          {/* Right side icons */}
          <div className="hidden md:flex items-center space-x-4">
            <Button variant="ghost" size="icon">
              <Search className="h-5 w-5 text-gray-600" />
            </Button>
            <Button variant="ghost" size="icon">
              <User className="h-5 w-5 text-gray-600" />
            </Button>
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
            <button className="text-foreground py-2 text-left flex items-center justify-between">
              Products
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            <div className="pl-4 border-l-2 border-gray-200 flex flex-col space-y-2">
              <Link to="/products?category=areca" className="text-foreground py-1" onClick={toggleMenu}>Areca Products</Link>
              <Link to="/products?category=natural" className="text-foreground py-1" onClick={toggleMenu}>Natural Products</Link>
              <Link to="/products" className="text-foreground py-1" onClick={toggleMenu}>All Products</Link>
            </div>
            <Link to="/contact" className={`text-foreground py-2 ${isActive('/contact')}`} onClick={toggleMenu}>Contact</Link>
            <div className="flex items-center space-x-3 pt-2">
              <Button variant="outline" size="sm" className="w-1/2">Search</Button>
              <Button variant="outline" size="sm" className="w-1/2">Login</Button>
            </div>
          </div>
        </div>
      )}
    </nav>
  );
};

export default Navbar;
