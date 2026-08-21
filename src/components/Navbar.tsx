import React, { useState, useEffect } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  LogOut,
  Package,
  Search,
  Settings,
  ShoppingCart,
  Menu,
  X,
  User,
  LayoutDashboard,
  Bell,
  HelpCircle,
  Shield,
  Heart,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useCartStore } from "@/store/useCartStore";
import { useAuth } from "@/context/AuthContext";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import NotificationBell from "./NotificationBell";
import { motion, AnimatePresence } from "framer-motion";

const Navbar = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const cartCount = useCartStore((state) => state.items.length);
  const { user, profile, signOut } = useAuth();
  const [isScrolled, setIsScrolled] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    // Explicitly clean up any residual dark class and localStorage values
    if (typeof window !== "undefined") {
      window.document.documentElement.classList.remove("dark");
      localStorage.removeItem("grevya-theme");
    }
  }, []);

  // Scroll listener to activate shrinking floating panel
  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const [windowWidth, setWindowWidth] = useState(
    typeof window !== "undefined" ? window.innerWidth : 1024,
  );

  useEffect(() => {
    const handleResize = () => setWindowWidth(window.innerWidth);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const isMobile = windowWidth < 768;

  const toggleMenu = () => {
    setIsMenuOpen(!isMenuOpen);
  };

  const openRoleDashboard = () => {
    if (profile?.role === "admin") {
      navigate("/admin/dashboard");
      return;
    }

    if (profile?.role === "seller") {
      navigate("/seller/dashboard");
    }
  };

  const isAdminOrSeller =
    profile?.role === "admin" || profile?.role === "seller";

  const getNavItems = () => {
    if (profile?.role === "admin") {
      return [
        { path: "/admin/dashboard", name: "Dashboard" },
        { path: "/admin/users", name: "Users" },
        { path: "/admin/products", name: "Products" },
        { path: "/admin/product-requests", name: "Requests" },
        { path: "/admin/orders", name: "Orders" },
        { path: "/admin/notifications", name: "Notifications" },
      ];
    }
    if (profile?.role === "seller") {
      return [
        { path: "/seller/dashboard", name: "Dashboard" },
        { path: "/seller/products", name: "My Products" },
        { path: "/seller/add-product", name: "Add Product" },
        { path: "/seller/pending-products", name: "Pending" },
        { path: "/seller/orders", name: "Orders" },
      ];
    }
    return [
      { path: "/", name: "Home" },
      { path: "/about", name: "About Us" },
      { path: "/products", name: "Products" },
      { path: "/contact", name: "Contact" },
    ];
  };

  const navItems = getNavItems();

  return (
    <div className="sticky top-0 z-40 w-full">
      <motion.nav
        animate={{
          y: isScrolled ? 10 : 0,
          scale: isScrolled ? (isMobile ? 0.95 : 0.97) : 1,
        }}
        transition={{
          type: "spring",
          stiffness: 220,
          damping: 24,
          mass: 0.8,
        }}
        className="relative w-full select-none origin-top"
      >
        {/* PREMIUM STATIC -> FLOATING BACKGROUND PANEL */}
        <motion.div
          animate={{
            backgroundColor: isScrolled
              ? "var(--nav-bg-scrolled)"
              : "var(--nav-bg-top)",
            borderColor: isScrolled
              ? "var(--nav-border-scrolled)"
              : "var(--nav-border-top)",
            borderRadius: isScrolled ? (isMobile ? "16px" : "9999px") : "0px",
            boxShadow: isScrolled
              ? "var(--nav-shadow-scrolled)"
              : "var(--nav-shadow-top)",
          }}
          transition={{
            type: "spring",
            stiffness: 220,
            damping: 24,
            mass: 0.8,
          }}
          className={`absolute inset-0 -z-10 backdrop-blur-md transition-all ${
            isScrolled ? "border border-[#A68D65]/20" : "border-b"
          }`}
        />

        {/* NAVBAR CONTENT CONTAINER */}
        <div className="flex items-center justify-between w-full max-w-7xl mx-auto py-3.5 px-4 md:px-8 relative">
          {/* Logo */}
          <div className="flex items-center gap-2 md:gap-3.5 shrink-0">
            <Link
              to="/"
              className="flex items-center gap-2 md:gap-2.5 shrink-0"
              aria-label="Grevya Naturals home"
            >
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

            {isAdminOrSeller && (
              <Link
                to="/"
                className="hidden sm:flex items-center gap-1.5 text-[9px] font-bold text-[#A68D65] border border-[#A68D65]/25 hover:bg-[#33381C] hover:text-white px-3 py-1.5 rounded-full transition-all tracking-wider uppercase ml-1.5 shadow-2xs"
              >
                <span>View Store</span>
              </Link>
            )}
          </div>

          {/* Desktop Navigation with sliding active underline (Customers only) */}
          {!isAdminOrSeller && (
            <div className="hidden md:flex space-x-6 lg:space-x-8 items-center relative">
              {navItems.map((item) => {
                const active =
                  item.path === "/"
                    ? location.pathname === "/"
                    : location.pathname.startsWith(item.path);

                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    className={`relative py-1 text-sm font-semibold tracking-wide transition-colors ${
                      active
                        ? "text-[#33381C]"
                        : "text-[#1D1E19]/60 hover:text-[#33381C]"
                    }`}
                  >
                    {item.name}
                    {active && (
                      <motion.div
                        layoutId="activeNavbarTab"
                        className="absolute -bottom-1 left-0 right-0 h-[2px] bg-[#33381C] rounded-full"
                        transition={{
                          type: "spring",
                          stiffness: 350,
                          damping: 28,
                        }}
                      />
                    )}
                  </Link>
                );
              })}
            </div>
          )}

          {/* Dashboard Premium Search Experience (Admin/Seller only) */}
          {isAdminOrSeller && (
            <div className="hidden md:flex flex-grow max-w-md mx-8 relative items-center">
              <div className="relative w-full group">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-400 group-focus-within:text-[#33381C] transition-all duration-200" />
                <input
                  type="text"
                  placeholder={
                    profile?.role === "admin"
                      ? "Search users, products, reports..."
                      : "Search products, orders, inventory..."
                  }
                  className="w-full rounded-full border border-[#A68D65]/20 bg-[#F7EEE4]/30 py-2 pl-11 pr-5 text-xs text-neutral-800 placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-[#33381C]/15 focus:border-[#33381C] focus:bg-white transition-all duration-300 shadow-[inset_0_2px_4px_rgba(0,0,0,0.02)] focus:shadow-[0_4px_16px_rgba(51,56,28,0.06)]"
                />
              </div>
            </div>
          )}

          {/* Right side actions */}
          <div className="hidden md:flex items-center space-x-3.5">
            {/* Spotlight Search trigger button (Customers only) */}
            {!isAdminOrSeller && (
              <button
                onClick={() =>
                  window.dispatchEvent(new CustomEvent("open-grevya-search"))
                }
                className="group flex items-center space-x-2.5 w-40 lg:w-48 rounded-full border border-[#A68D65]/20 bg-[#F7EEE4]/20 hover:bg-white py-1.5 pl-5 pr-5 text-sm text-foreground/75 text-left cursor-pointer transition-all duration-300 hover:border-[#A68D65]/50 shadow-[inset_0_2px_4px_rgba(0,0,0,0.01)] hover:shadow-[0_4px_12px_rgba(51,56,28,0.04)]"
                aria-label="Open Spotlight Search"
              >
                <Search className="mr-2 h-4 w-4 text-neutral-400 shrink-0 group-hover:scale-105 transition-transform" />
                <span className="text-neutral-400 text-xs flex-grow">
                  Search...
                </span>
                <kbd className="hidden lg:inline-flex h-5 select-none items-center justify-center rounded-full bg-[#A68D65]/12 px-2.5 font-mono text-[9px] font-semibold text-neutral-400">
                  /
                </kbd>
              </button>
            )}

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="rounded-full hover:bg-[#A68D65]/10 text-gray-750"
                  title={user ? "Account" : "Login"}
                >
                  <User className="h-4.5 w-4.5" />
                </Button>
              </DropdownMenuTrigger>

              <DropdownMenuContent
                align="end"
                className="w-56 rounded-2xl border border-[#A68D65]/15 bg-[#F7EEE4] shadow-md"
              >
                {user ? (
                  <>
                    <div className="px-3.5 py-2.5 text-sm border-b border-[#A68D65]/10">
                      <p className="font-semibold text-[#33381C] capitalize">
                        {profile?.full_name || user.email?.split("@")[0]}
                      </p>
                      <div className="flex items-center justify-between gap-1.5 mt-0.5">
                        <p className="truncate text-[10px] text-neutral-500 max-w-[120px]">
                          {user.email}
                        </p>
                        {profile?.role && (
                          <span className="rounded-full bg-[#33381C]/10 px-2 py-0.2 text-[8px] font-bold text-[#33381C] uppercase tracking-wider">
                            {profile.role}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Customer Dropdown */}
                    {(!profile || profile.role === "customer") && (
                      <>
                        <DropdownMenuItem
                          asChild
                          className="focus:bg-[#A68D65]/10 cursor-pointer"
                        >
                          <Link
                            to="/account"
                            className="w-full flex items-center"
                          >
                            <User className="mr-2 h-4 w-4 text-neutral-500" />
                            Profile
                          </Link>
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          asChild
                          className="focus:bg-[#A68D65]/10 cursor-pointer"
                        >
                          <Link
                            to="/orders"
                            className="w-full flex items-center"
                          >
                            <Package className="mr-2 h-4 w-4 text-neutral-500" />
                            Orders
                          </Link>
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          asChild
                          className="focus:bg-[#A68D65]/10 cursor-pointer"
                        >
                          <Link
                            to="/account?tab=wishlist"
                            className="w-full flex items-center"
                          >
                            <Heart className="mr-2 h-4 w-4 text-neutral-500" />
                            Wishlist
                          </Link>
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          asChild
                          className="focus:bg-[#A68D65]/10 cursor-pointer"
                        >
                          <Link
                            to="/notifications"
                            className="w-full flex items-center"
                          >
                            <Bell className="mr-2 h-4 w-4 text-neutral-500" />
                            Notifications
                          </Link>
                        </DropdownMenuItem>
                      </>
                    )}

                    {/* Seller Dropdown */}
                    {profile?.role === "seller" && (
                      <>
                        <DropdownMenuItem
                          asChild
                          className="focus:bg-[#A68D65]/10 cursor-pointer"
                        >
                          <Link
                            to="/seller/settings?tab=store"
                            className="w-full flex items-center"
                          >
                            <User className="mr-2 h-4 w-4 text-neutral-500" />
                            Store Profile
                          </Link>
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          asChild
                          className="focus:bg-[#A68D65]/10 cursor-pointer"
                        >
                          <Link
                            to="/seller/settings?tab=profile"
                            className="w-full flex items-center"
                          >
                            <Settings className="mr-2 h-4 w-4 text-neutral-500" />
                            Seller Settings
                          </Link>
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          asChild
                          className="focus:bg-[#A68D65]/10 cursor-pointer"
                        >
                          <Link
                            to="/notifications"
                            className="w-full flex items-center"
                          >
                            <Bell className="mr-2 h-4 w-4 text-neutral-500" />
                            Notifications
                          </Link>
                        </DropdownMenuItem>
                      </>
                    )}

                    {/* Admin Dropdown */}
                    {profile?.role === "admin" && (
                      <>
                        <DropdownMenuItem
                          asChild
                          className="focus:bg-[#A68D65]/10 cursor-pointer"
                        >
                          <Link
                            to="/admin/settings?tab=profile"
                            className="w-full flex items-center"
                          >
                            <User className="mr-2 h-4 w-4 text-neutral-500" />
                            Admin Profile
                          </Link>
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          asChild
                          className="focus:bg-[#A68D65]/10 cursor-pointer"
                        >
                          <Link
                            to="/admin/settings?tab=preferences"
                            className="w-full flex items-center"
                          >
                            <Settings className="mr-2 h-4 w-4 text-neutral-500" />
                            Platform Settings
                          </Link>
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          asChild
                          className="focus:bg-[#A68D65]/10 cursor-pointer"
                        >
                          <Link
                            to="/admin/notifications"
                            className="w-full flex items-center"
                          >
                            <Bell className="mr-2 h-4 w-4 text-neutral-500" />
                            Notifications
                          </Link>
                        </DropdownMenuItem>
                      </>
                    )}

                    <DropdownMenuItem
                      asChild
                      className="focus:bg-[#A68D65]/10 cursor-pointer"
                    >
                      <Link to="/contact" className="w-full flex items-center">
                        <HelpCircle className="mr-2 h-4 w-4 text-neutral-500" />
                        Help
                      </Link>
                    </DropdownMenuItem>

                    <DropdownMenuItem
                      onClick={signOut}
                      className="focus:bg-red-50 text-red-700 cursor-pointer"
                    >
                      <LogOut className="mr-2 h-4 w-4" />
                      Logout
                    </DropdownMenuItem>
                  </>
                ) : (
                  <>
                    <DropdownMenuItem
                      asChild
                      className="focus:bg-[#A68D65]/10 cursor-pointer"
                    >
                      <Link to="/login" className="w-full font-semibold">
                        Login
                      </Link>
                    </DropdownMenuItem>

                    <DropdownMenuItem
                      asChild
                      className="focus:bg-[#A68D65]/10 cursor-pointer"
                    >
                      <Link to="/signup" className="w-full font-semibold">
                        Create Account
                      </Link>
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>

            <NotificationBell />

            {!isAdminOrSeller && (
              <Link to="/cart" className="relative animate-fade-in">
                <Button
                  variant="ghost"
                  size="icon"
                  className="rounded-full hover:bg-[#A68D65]/10 text-gray-700"
                >
                  <ShoppingCart className="h-4.5 w-4.5" />
                  {cartCount > 0 && (
                    <span className="absolute -top-0.5 -right-0.5 bg-[#33381C] text-[#F7EEE4] text-[9px] rounded-full w-4 h-4 flex items-center justify-center font-bold">
                      {cartCount}
                    </span>
                  )}
                </Button>
              </Link>
            )}
          </div>

          <div className="flex md:hidden items-center space-x-3">
            <NotificationBell />

            {!isAdminOrSeller && (
              <Link to="/cart" className="relative">
                <Button
                  variant="ghost"
                  size="icon"
                  className="rounded-full text-gray-700"
                >
                  <ShoppingCart className="h-5 w-5" />
                  {cartCount > 0 && (
                    <span className="absolute -top-0.5 -right-0.5 bg-[#33381C] text-[#F7EEE4] text-[9px] rounded-full w-4.5 h-4.5 flex items-center justify-center font-bold">
                      {cartCount}
                    </span>
                  )}
                </Button>
              </Link>
            )}

            <Button
              variant="ghost"
              size="icon"
              className="rounded-full text-gray-750"
              onClick={toggleMenu}
            >
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
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{
              duration: 0.35,
              ease: [0.16, 1, 0.3, 1] as [number, number, number, number],
            }}
            className="md:hidden bg-[#F7EEE4] border-t border-[#A68D65]/15 py-5 px-4 shadow-xl overflow-hidden"
          >
            <div className="flex flex-col space-y-4">
              {navItems.map((item) => (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`text-base font-bold py-1 border-b border-[#A68D65]/5 ${
                    location.pathname === item.path
                      ? "text-[#33381C]"
                      : "text-[#1D1E19]"
                  }`}
                  onClick={toggleMenu}
                >
                  {item.name}
                </Link>
              ))}

              {!isAdminOrSeller && (
                <button
                  onClick={() => {
                    toggleMenu();
                    window.dispatchEvent(new CustomEvent("open-grevya-search"));
                  }}
                  className="w-full flex items-center space-x-2 rounded-full border border-[#A68D65]/20 bg-white py-2.5 px-4 text-sm text-foreground/50 text-left shadow-xs cursor-pointer"
                >
                  <Search className="h-4 w-4 text-gray-400 shrink-0" />
                  <span>Search products...</span>
                </button>
              )}

              {user && profile?.role === "admin" && (
                <>
                  <Button
                    asChild
                    variant="outline"
                    className="w-full rounded-xl border-[#33381C]/35 text-[#33381C] font-bold"
                  >
                    <Link to="/admin/dashboard" onClick={toggleMenu}>
                      <LayoutDashboard className="mr-2 h-4 w-4 inline" />
                      Admin Dashboard
                    </Link>
                  </Button>
                  <Button
                    asChild
                    variant="outline"
                    className="w-full rounded-xl border-[#33381C]/35 text-[#33381C] font-bold"
                  >
                    <Link to="/admin/settings?tab=profile" onClick={toggleMenu}>
                      <User className="mr-2 h-4 w-4 inline" />
                      Admin Profile
                    </Link>
                  </Button>
                </>
              )}

              {user && profile?.role === "seller" && (
                <>
                  <Button
                    asChild
                    variant="outline"
                    className="w-full rounded-xl border-[#33381C]/35 text-[#33381C] font-bold"
                  >
                    <Link to="/seller/dashboard" onClick={toggleMenu}>
                      <LayoutDashboard className="mr-2 h-4 w-4 inline" />
                      Seller Dashboard
                    </Link>
                  </Button>
                  <Button
                    asChild
                    variant="outline"
                    className="w-full rounded-xl border-[#33381C]/35 text-[#33381C] font-bold"
                  >
                    <Link
                      to="/seller/settings?tab=profile"
                      onClick={toggleMenu}
                    >
                      <User className="mr-2 h-4 w-4 inline" />
                      My Profile
                    </Link>
                  </Button>
                </>
              )}

              {(!user || profile?.role === "customer") && (
                <Button
                  asChild
                  variant="outline"
                  className="w-full rounded-xl border-[#33381C]/35 text-[#33381C] font-bold"
                >
                  <Link to={user ? "/account" : "/login"} onClick={toggleMenu}>
                    {user ? "My Account" : "Login / Signup"}
                  </Link>
                </Button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default Navbar;
