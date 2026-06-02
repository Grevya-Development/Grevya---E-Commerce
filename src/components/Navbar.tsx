import React, { useState, useEffect, useRef } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  Search, ShoppingCart, Menu, X, User,
  LayoutDashboard, LogOut, ChevronDown, Leaf, Store
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useCartStore } from '@/store/useCartStore';
import {
  DropdownMenu, DropdownMenuContent,
  DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import NotificationBell from './NotificationBell';
import { useAuthStore } from '@/store/authStore';
import { logoutUser } from '@/services/authService';

const Navbar = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const searchRef = useRef<HTMLInputElement>(null);

  const getTotalItems = useCartStore((state) => state.getTotalItems);
  const [cartCount, setCartCount] = useState(0);
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState('');

  const location = useLocation();
  const { user, profile, clearAuth } = useAuthStore();

  useEffect(() => { setCartCount(getTotalItems()); }, [getTotalItems]);

  // Close mobile menu on route change
  useEffect(() => { setIsMenuOpen(false); }, [location.pathname]);

  // Scroll shadow
  useEffect(() => {
    const handler = () => setIsScrolled(window.scrollY > 8);
    window.addEventListener('scroll', handler);
    return () => window.removeEventListener('scroll', handler);
  }, []);

  // Focus search input when opened
  useEffect(() => {
    if (searchOpen) searchRef.current?.focus();
  }, [searchOpen]);

  const isActive = (path: string) =>
    location.pathname === path
      ? 'text-emerald-600 font-semibold'
      : 'text-slate-600 hover:text-emerald-600';

  const isProductsActive =
    location.pathname.includes('/products')
      ? 'text-emerald-600 font-semibold'
      : 'text-slate-600 hover:text-emerald-600';

  const handleLogout = async () => {
    try {
      await logoutUser();
      clearAuth();
      navigate('/login');
    } catch (error) {
      console.error(error);
    }
  };
  

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      navigate(`/products?search=${encodeURIComponent(searchQuery.trim())}`);
      setSearchOpen(false);
      setSearchQuery('');
    }
  };

  return (
    <>
      <nav className={`sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-100 transition-shadow duration-300 ${
        isScrolled ? 'shadow-md shadow-slate-200/60' : 'shadow-sm'
      }`}>

        {/* Top accent line — matches Login/Register gradient */}
        <div className="h-0.5 bg-gradient-to-r from-emerald-500 via-teal-400 to-emerald-600" />

        <div className="container mx-auto px-4 lg:px-6">
          <div className="flex items-center justify-between h-16">

            {/* ── LOGO ── */}
            <Link to="/" className="flex items-center gap-2 group flex-shrink-0">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center shadow-sm group-hover:shadow-emerald-200 transition-shadow">
                <Leaf size={15} className="text-white" />
              </div>
              <div className="flex items-baseline gap-0.5">
                <span className="font-serif text-lg font-bold text-emerald-700 leading-none">Grevya</span>
                <span className="font-serif text-lg font-normal text-slate-500 leading-none">Industries</span>
              </div>
            </Link>

            {/* ── DESKTOP NAV LINKS ── */}
            <div className="hidden md:flex items-center gap-1">
              <Link to="/" className={`px-3.5 py-2 text-sm rounded-lg transition-colors ${isActive('/')}`}>
                Home
              </Link>
              <Link to="/about" className={`px-3.5 py-2 text-sm rounded-lg transition-colors ${isActive('/about')}`}>
                About Us
              </Link>

              {/* Products dropdown */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className={`flex items-center gap-1 px-3.5 py-2 text-sm rounded-lg transition-colors ${isProductsActive}`}>
                    Products
                    <ChevronDown size={14} className="opacity-60" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="center" className="w-52 mt-1 rounded-xl border-slate-200 shadow-lg shadow-slate-200/60 p-1">
                  <DropdownMenuItem asChild>
                    <Link to="/products?category=areca" className="w-full rounded-lg px-3 py-2 text-sm text-slate-700 hover:text-emerald-700 hover:bg-emerald-50 cursor-pointer">
                      🌿 Areca Products
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link to="/products?category=natural" className="w-full rounded-lg px-3 py-2 text-sm text-slate-700 hover:text-emerald-700 hover:bg-emerald-50 cursor-pointer">
                      🍃 Natural Products
                    </Link>
                  </DropdownMenuItem>
                  <div className="my-1 h-px bg-slate-100" />
                  <DropdownMenuItem asChild>
                    <Link to="/products" className="w-full rounded-lg px-3 py-2 text-sm text-slate-700 hover:text-emerald-700 hover:bg-emerald-50 cursor-pointer">
                      🛍️ All Products
                    </Link>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>

              <Link to="/contact" className={`px-3.5 py-2 text-sm rounded-lg transition-colors ${isActive('/contact')}`}>
                Contact
              </Link>
            </div>

            {/* ── RIGHT SIDE ── */}
            <div className="hidden md:flex items-center gap-1">

              {/* Expandable Search */}
              {searchOpen ? (
                <form onSubmit={handleSearch} className="flex items-center">
                  <input
                    ref={searchRef}
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    placeholder="Search products..."
                    className="w-44 px-3 py-1.5 text-sm bg-slate-50 border border-slate-200 rounded-l-lg focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:border-transparent transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => { setSearchOpen(false); setSearchQuery(''); }}
                    className="px-2 py-1.5 bg-slate-100 border border-l-0 border-slate-200 rounded-r-lg text-slate-500 hover:bg-slate-200 transition-colors"
                  >
                    <X size={14} />
                  </button>
                </form>
              ) : (
                <button
                  onClick={() => setSearchOpen(true)}
                  className="p-2 text-slate-500 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors"
                >
                  <Search size={18} />
                </button>
              )}

              {/* Notifications */}
              <NotificationBell />

              {/* Cart */}
              <Link to="/cart" className="relative p-2 text-slate-500 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors">
                <ShoppingCart size={18} />
                {cartCount > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 bg-gradient-to-br from-emerald-500 to-teal-500 text-white text-[10px] font-bold rounded-full min-w-[18px] min-h-[18px] flex items-center justify-center leading-none shadow-sm">
                    {cartCount > 99 ? '99+' : cartCount}
                  </span>
                )}
              </Link>

              {/* Divider */}
              <div className="w-px h-5 bg-slate-200 mx-1" />

              {/* Auth — logged in */}
              {user ? (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button className="flex items-center gap-2 pl-2 pr-3 py-1.5 rounded-xl border border-slate-200 hover:border-emerald-300 hover:bg-emerald-50/50 transition-all group">
                      <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center flex-shrink-0">
                        <span className="text-white text-xs font-bold uppercase">
                          {profile?.username?.[0] ?? 'U'}
                        </span>
                      </div>
                      <span className="text-sm font-medium text-slate-700 max-w-[90px] truncate">
                        {profile?.username}
                      </span>
                      <ChevronDown size={13} className="text-slate-400 group-hover:text-slate-600 transition-colors" />
                    </button>
                  </DropdownMenuTrigger>

                  <DropdownMenuContent align="end" className="w-52 mt-1 rounded-xl border-slate-200 shadow-lg shadow-slate-200/60 p-1">
                    {/* User info header */}
                    <div className="px-3 py-2.5 mb-1">
                      <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Signed in as</p>
                      <p className="text-sm font-semibold text-slate-700 truncate mt-0.5">{profile?.username}</p>
                      <span className={`inline-block mt-1.5 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${
                        profile?.role === 'admin'   ? 'bg-purple-100 text-purple-700'
                        : profile?.role === 'seller' ? 'bg-blue-100 text-blue-700'
                        : 'bg-emerald-100 text-emerald-700'
                      }`}>
                        {profile?.role}
                      </span>
                    </div>

                    <div className="h-px bg-slate-100 my-1" />

                    {profile?.role === 'admin' && (
                      <DropdownMenuItem asChild>
                        <Link to="/admin/dashboard" className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-slate-700 hover:text-emerald-700 hover:bg-emerald-50 cursor-pointer">
                          <LayoutDashboard size={14} className="text-slate-400" /> Admin Dashboard
                        </Link>
                      </DropdownMenuItem>
                    )}

                    {profile?.role === 'seller' && (
                      <DropdownMenuItem asChild>
                        <Link to="/seller/dashboard" className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-slate-700 hover:text-emerald-700 hover:bg-emerald-50 cursor-pointer">
                          <Store size={14} className="text-slate-400" /> Seller Dashboard
                        </Link>
                      </DropdownMenuItem>
                    )}

                    <DropdownMenuItem asChild>
                      <Link to="/profile" className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-slate-700 hover:text-emerald-700 hover:bg-emerald-50 cursor-pointer">
                        <User size={14} className="text-slate-400" /> My Profile
                      </Link>
                    </DropdownMenuItem>

                    <div className="h-px bg-slate-100 my-1" />

                    <DropdownMenuItem
                      onClick={handleLogout}
                      className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-red-600 hover:bg-red-50 cursor-pointer focus:bg-red-50 focus:text-red-600"
                    >
                      <LogOut size={14} /> Sign out
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>

              ) : (
                /* Auth — logged out */
                <div className="flex items-center gap-2">
                  <Link to="/login">
                    <button className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-emerald-700 hover:bg-emerald-50 rounded-xl transition-colors">
                      Sign in
                    </button>
                  </Link>
                  <Link to="/register">
                    <button className="px-4 py-2 text-sm font-semibold text-white bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-700 hover:to-teal-600 rounded-xl shadow-sm shadow-emerald-200 active:scale-[0.98] transition-all">
                      Register
                    </button>
                  </Link>
                </div>
              )}
            </div>

            {/* ── MOBILE RIGHT ── */}
            <div className="flex md:hidden items-center gap-1">
              <NotificationBell />
              <Link to="/cart" className="relative p-2 text-slate-500 hover:text-emerald-600 rounded-lg transition-colors">
                <ShoppingCart size={19} />
                {cartCount > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 bg-gradient-to-br from-emerald-500 to-teal-500 text-white text-[10px] font-bold rounded-full min-w-[17px] min-h-[17px] flex items-center justify-center">
                    {cartCount}
                  </span>
                )}
              </Link>
              <button
                onClick={() => setIsMenuOpen(!isMenuOpen)}
                className="p-2 text-slate-500 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors"
              >
                {isMenuOpen ? <X size={20} /> : <Menu size={20} />}
              </button>
            </div>

          </div>
        </div>

        {/* ── MOBILE MENU ── */}
        {isMenuOpen && (
          <div className="md:hidden border-t border-slate-100 bg-white/98 backdrop-blur-md">
            <div className="container mx-auto px-4 py-4 space-y-1">

              {/* Mobile search */}
              <form onSubmit={handleSearch} className="flex items-center gap-2 mb-3">
                <div className="relative flex-1">
                  <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    placeholder="Search products..."
                    className="w-full pl-9 pr-4 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:border-transparent"
                  />
                </div>
                <button type="submit" className="px-4 py-2.5 text-sm font-semibold text-white bg-gradient-to-r from-emerald-600 to-teal-500 rounded-xl">
                  Go
                </button>
              </form>

              <Link to="/" className={`block px-4 py-2.5 text-sm rounded-xl transition-colors ${isActive('/')}`}>Home</Link>
              <Link to="/about" className={`block px-4 py-2.5 text-sm rounded-xl transition-colors ${isActive('/about')}`}>About Us</Link>

              <div className="px-4 py-2">
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Products</p>
                <div className="space-y-1 pl-2">
                  <Link to="/products?category=areca" className="block px-3 py-2 text-sm text-slate-600 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors">🌿 Areca Products</Link>
                  <Link to="/products?category=natural" className="block px-3 py-2 text-sm text-slate-600 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors">🍃 Natural Products</Link>
                  <Link to="/products" className="block px-3 py-2 text-sm text-slate-600 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors">🛍️ All Products</Link>
                </div>
              </div>

              <Link to="/contact" className={`block px-4 py-2.5 text-sm rounded-xl transition-colors ${isActive('/contact')}`}>Contact</Link>

              <div className="h-px bg-slate-100 my-2" />

              {user ? (
                <>
                  <div className="flex items-center gap-3 px-4 py-3 bg-slate-50 rounded-xl mb-2">
                    <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center flex-shrink-0">
                      <span className="text-white text-sm font-bold uppercase">{profile?.username?.[0]}</span>
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-slate-800">{profile?.username}</p>
                      <span className={`text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full ${
                        profile?.role === 'admin' ? 'bg-purple-100 text-purple-700'
                        : profile?.role === 'seller' ? 'bg-blue-100 text-blue-700'
                        : 'bg-emerald-100 text-emerald-700'
                      }`}>{profile?.role}</span>
                    </div>
                  </div>

                  {profile?.role === 'admin' && (
                    <Link to="/admin/dashboard" className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-slate-600 hover:text-emerald-600 hover:bg-emerald-50 rounded-xl transition-colors">
                      <LayoutDashboard size={15} /> Admin Dashboard
                    </Link>
                  )}
                  {profile?.role === 'seller' && (
                    <Link to="/seller/dashboard" className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-slate-600 hover:text-emerald-600 hover:bg-emerald-50 rounded-xl transition-colors">
                      <Store size={15} /> Seller Dashboard
                    </Link>
                  )}
                  <Link to="/profile" className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-slate-600 hover:text-emerald-600 hover:bg-emerald-50 rounded-xl transition-colors">
                    <User size={15} /> My Profile
                  </Link>

                  <div className="h-px bg-slate-100 my-1" />

                  <button
                    onClick={handleLogout}
                    className="flex items-center gap-2.5 w-full px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 rounded-xl transition-colors"
                  >
                    <LogOut size={15} /> Sign out
                  </button>
                </>
              ) : (
                <div className="flex gap-2 pt-1">
                  <Link to="/login" className="flex-1">
                    <button className="w-full py-2.5 text-sm font-medium text-slate-700 border border-slate-200 hover:border-emerald-300 hover:bg-emerald-50 rounded-xl transition-all">
                      Sign in
                    </button>
                  </Link>
                  <Link to="/register" className="flex-1">
                    <button className="w-full py-2.5 text-sm font-semibold text-white bg-gradient-to-r from-emerald-600 to-teal-500 rounded-xl shadow-sm">
                      Register
                    </button>
                  </Link>
                </div>
              )}

            </div>
          </div>
        )}

      </nav>
    </>
  );
};

export default Navbar;