import React, { useRef, useState, useEffect } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  Eye,
  EyeOff,
  Leaf,
  Loader2,
  Mail,
  ShieldCheck,
  Truck,
  Award,
  Sparkles,
  Compass,
  Lock,
  ArrowRight,
  UserCheck,
  Building,
  User,
  AlertCircle
} from "lucide-react";
import Navbar from "@/components/Navbar";
import { supabase } from "@/lib/supabaseClient";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/use-toast";
import { useAuth } from "@/context/AuthContext";
import {
  friendlyAuthError,
  normalizeEmail,
  normalizePhone,
  validateEmail,
  validatePassword,
  validatePhone
} from "@/lib/authValidation";
import {
  requestPasswordReset,
  signInWithEmail,
  signUpWithEmail,
  startOAuthSignIn,
  updateAuthPassword
} from "@/lib/authService";
import { motion, AnimatePresence } from "framer-motion";

type AuthMode = "login" | "signup" | "forgot" | "reset";

const copy = {
  login: {
    title: "Sign In",
    subtitle: "Access your dashboard, local orders, and settings.",
    submit: "Sign In",
  },
  signup: {
    title: "Create Account",
    subtitle: "Join the marketplace and configure your credentials.",
    submit: "Create Account",
  },
  forgot: {
    title: "Reset Password",
    subtitle: "Enter email to receive your recovery authorization code.",
    submit: "Send Reset Code",
  },
  reset: {
    title: "Set Password",
    subtitle: "Configure a secure password for your credentials.",
    submit: "Save Password",
  },
};

// Reusable Premium Floating Label Input Field
interface FloatingInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  id: string;
  label: string;
  error?: string;
}

const FloatingInput = ({
  id,
  label,
  value = "",
  onChange,
  type = "text",
  error,
  ...props
}: FloatingInputProps) => {
  const [focused, setFocused] = useState(false);
  const isFloating = focused || (value && String(value).length > 0);

  return (
    <div className="relative mb-4">
      <label
        htmlFor={id}
        className={`absolute left-4 transition-all duration-255 pointer-events-none z-10 ${
          isFloating
            ? "top-1 text-[9px] font-bold text-[#A68D65] uppercase tracking-wider"
            : "top-3.5 text-sm text-[#1D1E19]/40 font-medium"
        }`}
      >
        {label}
      </label>
      <input
        id={id}
        type={type}
        value={value}
        onChange={onChange}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        className={`w-full rounded-2xl border border-[#A68D65]/20 p-4 pt-6 focus:outline-none focus:ring-1 focus:ring-[#33381C] focus:border-[#33381C] bg-white text-sm text-[#1D1E19] font-medium transition-all ${
          error
            ? "border-red-500 focus:ring-red-500/20"
            : "hover:border-[#A68D65]/40"
        }`}
        {...props}
      />
      {error && (
        <p className="text-[10px] text-red-500 font-bold mt-1 ml-1">{error}</p>
      )}
    </div>
  );
};

const formVariants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.05 } as const,
  },
};

const fieldVariants = {
  hidden: { opacity: 0, y: 12, filter: "blur(2px)" },
  show: {
    opacity: 1,
    y: 0,
    filter: "blur(0px)",
    transition: { type: "spring", stiffness: 220, damping: 24 } as const,
  },
};

const AuthPage = ({ mode }: { mode: AuthMode }) => {
  const { user, loading: authLoading, refreshProfile } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const path = location.pathname.toLowerCase();

  const getExpectedRole = () => {
    if (path.startsWith("/seller/")) return "seller";
    if (path.startsWith("/admin/")) return "admin";
    if (path.startsWith("/account/register") || path.startsWith("/signup")) return "customer";
    if (path.startsWith("/account/login") || path.startsWith("/login") || path.startsWith("/auth")) return "customer";
    return undefined;
  };

  const expectedRole = getExpectedRole();
  const defaultRedirect = (role?: string) => {
    const activeRole = role || expectedRole;
    if (activeRole === "admin") return "/admin/dashboard";
    if (activeRole === "seller") return "/seller/dashboard";
    return "/account";
  };

  const from = (location.state as any)?.from?.pathname || defaultRedirect();

  // Multi-role experience routing support
  const [selectedRole, setSelectedRole] = useState<"customer" | "seller" | "admin" | undefined>(() => {
    if (path.startsWith("/seller/")) return "seller";
    if (path.startsWith("/admin/")) return "admin";
    return undefined;
  });

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const inFlightRef = useRef(false);

  // Role validation conflict state
  const [validationError, setValidationError] = useState<{ expected: string; actual: string } | null>(null);
  const [userRoles, setUserRoles] = useState<string[]>([]);
  const [multipleRolesChooser, setMultipleRolesChooser] = useState(false);

  const isLogin = mode === "login";
  const isSignup = mode === "signup";
  const needsPassword = mode !== "forgot";
  const pageCopy = copy[mode];

  // If already logged in, validate roles directly
  useEffect(() => {
    if (user && !authLoading) {
      validateActiveUserSession();
    }
  }, [user, authLoading]);

  const validateActiveUserSession = async () => {
    if (!window.Clerk?.user) return;
    setLoading(true);
    try {
      const clerkUserId = window.Clerk.user.id;
      const { data: profileRow } = await supabase
        .from("profiles")
        .select("*")
        .eq("clerk_user_id", clerkUserId)
        .maybeSingle();

      if (profileRow) {
        const actualRole = profileRow.role || "customer";
        
        // Define hierarchy / multiple roles support
        const availableRoles = [actualRole];
        if (actualRole === "admin") {
          availableRoles.push("seller", "customer");
        } else if (actualRole === "seller") {
          availableRoles.push("customer");
        }
        setUserRoles(availableRoles);

        const target = selectedRole || expectedRole || "customer";

        if (availableRoles.includes(target)) {
          // If approved seller, or other active role, redirect
          if (target === "seller" && profileRow.status === "pending") {
            navigate("/seller/onboarding", { replace: true });
          } else {
            navigate(defaultRedirect(target), { replace: true });
          }
        } else {
          // Trigger validation mismatch state
          if (availableRoles.length > 1) {
            setMultipleRolesChooser(true);
          } else {
            setValidationError({ expected: target, actual: actualRole });
          }
        }
      }
    } catch (err) {
      console.error("Session verification failed:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleRoleSelection = (role: "customer" | "seller") => {
    setSelectedRole(role);
    setErrors({});
  };

  const validateForm = () => {
    const nextErrors: Record<string, string> = {};
    const normalizedEmail = normalizeEmail(email);

    if (mode !== "reset") {
      const emailError = validateEmail(normalizedEmail);
      if (emailError) nextErrors.email = emailError;
    }

    if (isSignup && name.trim().length < 2) {
      nextErrors.name = "Enter your full name.";
    }

    if (isSignup) {
      const phoneError = validatePhone(phone, false);
      if (phoneError) nextErrors.phone = phoneError;
    }

    if (needsPassword) {
      const passwordError = isLogin
        ? !password
          ? "Enter your password."
          : ""
        : validatePassword(password);
      if (passwordError) nextErrors.password = passwordError;
    }

    if (isSignup && password !== confirmPassword) {
      nextErrors.confirmPassword = "Passwords do not match.";
    }

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleSocialSignIn = async (provider: "google" | "apple") => {
    if (loading || inFlightRef.current) return;
    inFlightRef.current = true;
    setLoading(true);

    try {
      await startOAuthSignIn(provider);
    } catch (error: any) {
      toast({
        title: "Sign-in failed",
        description: friendlyAuthError(error.message),
        variant: "destructive",
      });
      setLoading(false);
      inFlightRef.current = false;
    }
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (loading || inFlightRef.current) return;
    if (!validateForm()) return;

    const normalizedEmail = normalizeEmail(email);
    const normalizedPhone = normalizePhone(phone);

    inFlightRef.current = true;
    setLoading(true);

    try {
      const targetRole = selectedRole || expectedRole || "customer";

      if (mode === "login") {
        await signInWithEmail(normalizedEmail, password);
        await validateActiveUserSession();
      }

      if (mode === "signup") {
        const data = await signUpWithEmail({
          email: normalizedEmail,
          password,
          fullName: name,
          phone: normalizedPhone,
          role: targetRole,
        });

        toast({
          title: "Account Created",
          description: data.status === "complete"
            ? "Your account has been activated."
            : "Verification code sent to your email inbox.",
        });

        if (data.status === "complete") {
          await validateActiveUserSession();
        } else {
          localStorage.setItem("grevya-signup-email", normalizedEmail);
          navigate("/verify-email", { state: { email: normalizedEmail, clerkUserId: data.id } });
        }
      }

      if (mode === "forgot") {
        await requestPasswordReset(normalizedEmail);
        toast({
          title: "Reset Code Sent",
          description: "Please check your email address.",
        });
      }

      if (mode === "reset") {
        await updateAuthPassword(password);
        toast({
          title: "Password Updated",
          description: "Authentication details saved successfully.",
        });
        navigate("/account");
      }
    } catch (error: any) {
      setPassword("");
      setConfirmPassword("");
      toast({
        title: "Authentication Error",
        description: friendlyAuthError(error.message),
        variant: "destructive",
      });
    } finally {
      setLoading(false);
      inFlightRef.current = false;
    }
  };

  const handleResolveMismatch = (role: string) => {
    setValidationError(null);
    setMultipleRolesChooser(false);
    navigate(defaultRedirect(role), { replace: true });
  };

  const handleSignOut = async () => {
    if (window.Clerk) {
      await window.Clerk.signOut();
    }
    setValidationError(null);
    setMultipleRolesChooser(false);
    setUserRoles([]);
    setSelectedRole(undefined);
  };

  return (
    <div className="flex min-h-screen flex-col bg-[#F7EEE4]/20">
      <Navbar />

      <main className="flex-grow flex items-center justify-center px-4 py-8 md:py-16">
        <div className="w-full max-w-5xl overflow-hidden rounded-[2.5rem] border border-[#A68D65]/20 bg-white shadow-2xl grid md:grid-cols-[1.1fr_1fr] min-h-[640px] relative">
          
          {/* Left panel cinematic decorative sidebar */}
          <section className="relative hidden p-12 text-[#F7EEE4] md:flex md:flex-col md:justify-between overflow-hidden md:order-1 border-r border-[#A68D65]/10">
            {/* Dark Forest background layer */}
            <div className="absolute inset-0 bg-[#33381C]" />

            {/* Glowing animated blur orbs */}
            <motion.div
              animate={{ x: [0, 30, -30, 0], y: [0, -30, 30, 0] }}
              transition={{ duration: 20, repeat: Infinity, ease: "easeInOut" }}
              className="absolute top-10 left-10 w-72 h-72 bg-[#A68D65]/10 rounded-full blur-3xl -z-10 pointer-events-none"
            />
            <motion.div
              animate={{ x: [0, -40, 20, 0], y: [0, 40, -40, 0] }}
              transition={{ duration: 24, repeat: Infinity, ease: "easeInOut" }}
              className="absolute bottom-10 right-10 w-80 h-80 bg-[#E7E9DD]/10 rounded-full blur-3xl -z-10 pointer-events-none"
            />

            <div className="relative z-10 space-y-6">
              <div className="inline-flex items-center rounded-full bg-white/10 px-4 py-1.5 text-[10px] font-bold uppercase tracking-wider backdrop-blur-md border border-white/10">
                <ShieldCheck className="mr-1.5 h-3.5 w-3.5 text-[#A68D65]" />{" "}
                Premium Authentication
              </div>
              <h1 className="font-serif text-3xl lg:text-4xl font-bold leading-tight tracking-tight text-white">
                Traceable Sourcing, Zero Waste.
              </h1>
              <p className="text-white/70 text-sm leading-relaxed max-w-sm font-medium">
                Access your partner account or shopping profile. Verified organic materials cataloging and eco-sustainability guarantees.
              </p>
            </div>

            <div className="relative z-10 space-y-4 py-6">
              {[
                {
                  icon: Award,
                  title: "Carbon-Neutral Sourcing",
                  desc: "Every transaction supports verified environmental offsetting programs.",
                },
                {
                  icon: Truck,
                  title: "Local Logistics Networks",
                  desc: "Compostable packaging materials and electric logistics channels.",
                },
                {
                  icon: Sparkles,
                  title: "Artisanal Traceability",
                  desc: "Transparent vendor catalog validations and certification audits.",
                },
              ].map((benefit, idx) => (
                <div
                  key={idx}
                  className="flex gap-3.5 p-3 rounded-2xl bg-white/5 border border-white/5 backdrop-blur-xs hover:bg-white/8 transition-all duration-200"
                >
                  <benefit.icon className="w-5 h-5 text-[#A68D65] flex-shrink-0 mt-0.5" />
                  <div>
                    <h4 className="font-bold text-xs text-white">
                      {benefit.title}
                    </h4>
                    <p className="text-[10px] text-white/60 mt-0.5">
                      {benefit.desc}
                    </p>
                  </div>
                </div>
              ))}
            </div>

            <div className="relative z-10 text-[10px] text-white/40 flex justify-between border-t border-white/10 pt-4">
              <span>© {new Date().getFullYear()} Grevya Corp</span>
              <span>100% Verified Sourcing</span>
            </div>
          </section>

          {/* Form panel container */}
          <section className="relative p-8 sm:p-12 flex flex-col justify-center md:order-2">
            
            {/* Loading overlays */}
            {loading && (
              <div className="absolute inset-0 z-20 flex items-center justify-center bg-white/85 backdrop-blur-xs rounded-[2rem]">
                <div className="rounded-2xl bg-white px-5 py-4 text-center shadow-lg border border-neutral-100 flex flex-col items-center">
                  <Loader2 className="h-7 w-7 animate-spin text-[#33381C] mb-2" />
                  <p className="text-xs font-bold text-neutral-800">
                    Securing experience...
                  </p>
                </div>
              </div>
            )}

            {/* Validation Error Screen (Mismatch Role) */}
            {validationError && (
              <div className="text-center py-6 animate-fade-in space-y-6">
                <div className="mx-auto w-16 h-16 bg-red-50 rounded-full flex items-center justify-center text-red-600 mb-2 border border-red-150">
                  <AlertCircle className="w-8 h-8" />
                </div>
                <div className="space-y-2">
                  <h2 className="text-xl font-bold text-neutral-900 font-serif">
                    Access Denied
                  </h2>
                  <p className="text-neutral-500 text-xs max-w-sm mx-auto leading-relaxed">
                    This account is registered as a <span className="font-bold text-[#33381C] capitalize">{validationError.actual}</span>.
                    You cannot access the <span className="capitalize">{validationError.expected}</span> portal with these credentials.
                  </p>
                </div>
                <div className="flex flex-col gap-3 max-w-xs mx-auto pt-4">
                  <Button
                    onClick={() => handleResolveMismatch(validationError.actual)}
                    className="h-11 rounded-xl bg-[#33381C] hover:bg-[#262A14] text-xs font-bold w-full"
                  >
                    Continue as {validationError.actual.toUpperCase()}
                  </Button>
                  <Button
                    onClick={handleSignOut}
                    variant="outline"
                    className="h-11 rounded-xl border-[#A68D65]/25 text-neutral-600 hover:bg-neutral-50 text-xs font-bold w-full"
                  >
                    Sign Out / Switch Account
                  </Button>
                </div>
              </div>
            )}

            {/* Multiple Roles Experience Chooser Screen */}
            {multipleRolesChooser && !validationError && (
              <div className="text-center py-6 animate-fade-in space-y-6">
                <div className="mx-auto w-16 h-16 bg-[#33381C]/5 rounded-full flex items-center justify-center text-[#33381C] mb-2">
                  <UserCheck className="w-8 h-8" />
                </div>
                <div className="space-y-2">
                  <h2 className="text-xl font-bold text-neutral-900 font-serif">
                    Choose Experience
                  </h2>
                  <p className="text-neutral-500 text-xs max-w-sm mx-auto">
                    Select which platform dashboard you would like to open.
                  </p>
                </div>
                <div className="flex flex-col gap-3 max-w-xs mx-auto pt-4">
                  {userRoles.map((role) => (
                    <Button
                      key={role}
                      onClick={() => handleResolveMismatch(role)}
                      className="h-11 rounded-xl bg-[#33381C] hover:bg-[#262A14] text-xs font-bold w-full capitalize"
                    >
                      Enter {role} Dashboard
                    </Button>
                  ))}
                  <Button
                    onClick={handleSignOut}
                    variant="outline"
                    className="h-11 rounded-xl border-[#A68D65]/25 text-neutral-600 hover:bg-neutral-50 text-xs font-bold w-full"
                  >
                    Sign Out
                  </Button>
                </div>
              </div>
            )}

            {/* Role Selection Screen */}
            {!selectedRole && !validationError && !multipleRolesChooser && (
              <div className="space-y-6 animate-fade-in">
                <div>
                  <h2 className="text-2xl font-serif font-bold text-[#1d1e19]">
                    Select Experience
                  </h2>
                  <p className="text-xs text-neutral-500 mt-1.5 font-medium">
                    Configure the platform application you wish to sign into.
                  </p>
                </div>

                <div className="grid gap-4">
                  {/* Customer Card */}
                  <button
                    onClick={() => handleRoleSelection("customer")}
                    className="group flex items-start gap-4 p-5 rounded-2xl border border-[#A68D65]/20 hover:border-[#33381C] bg-white text-left transition-all duration-300 hover:shadow-lg hover:-translate-y-0.5"
                  >
                    <div className="w-12 h-12 rounded-xl bg-[#33381C]/5 flex items-center justify-center text-[#33381C] group-hover:bg-[#33381C] group-hover:text-white transition-all shrink-0">
                      <User className="w-6 h-6" />
                    </div>
                    <div>
                      <h3 className="font-serif font-bold text-base text-[#1D1E19] group-hover:text-[#33381C] transition-colors">
                        Customer Portal
                      </h3>
                      <p className="text-[11px] text-neutral-500 mt-1 leading-normal font-medium">
                        Continue shopping, browse verified organic materials, and track purchases.
                      </p>
                    </div>
                  </button>

                  {/* Seller Card */}
                  <button
                    onClick={() => handleRoleSelection("seller")}
                    className="group flex items-start gap-4 p-5 rounded-2xl border border-[#A68D65]/20 hover:border-[#33381C] bg-white text-left transition-all duration-300 hover:shadow-lg hover:-translate-y-0.5"
                  >
                    <div className="w-12 h-12 rounded-xl bg-[#A68D65]/10 flex items-center justify-center text-[#A68D65] group-hover:bg-[#A68D65] group-hover:text-white transition-all shrink-0">
                      <Building className="w-6 h-6" />
                    </div>
                    <div>
                      <h3 className="font-serif font-bold text-base text-[#1D1E19] group-hover:text-[#A68D65] transition-colors">
                        Seller Dashboard
                      </h3>
                      <p className="text-[11px] text-neutral-500 mt-1 leading-normal font-medium">
                        Configure store inventories, check catalogs, and monitor analytics.
                      </p>
                    </div>
                  </button>
                </div>
              </div>
            )}

            {/* Actual Auth forms */}
            {selectedRole && !validationError && !multipleRolesChooser && (
              <AnimatePresence mode="wait">
                <motion.div
                  key={mode}
                  initial={{ opacity: 0, x: 10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -10 }}
                  transition={{ duration: 0.25 }}
                >
                  <div className="mb-6">
                    <div className="flex items-center gap-2 mb-2">
                      <button
                        onClick={() => {
                          if (expectedRole) return; // If direct link, block going back to selection
                          setSelectedRole(undefined);
                        }}
                        className={`text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-neutral-100 hover:bg-[#33381C]/5 text-[#33381C] ${expectedRole ? 'opacity-70 pointer-events-none' : ''}`}
                      >
                        {selectedRole} portal
                      </button>
                    </div>
                    <h2 className="text-2xl font-serif font-bold text-[#1D1E19]">
                      {pageCopy.title}
                    </h2>
                    <p className="mt-1.5 text-xs text-neutral-500 font-medium">
                      {pageCopy.subtitle}
                    </p>
                  </div>

                  {(isLogin || isSignup) && (
                    <>
                      <div className="grid grid-cols-2 gap-3">
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => handleSocialSignIn("google")}
                          className="h-11 rounded-xl border-[#A68D65]/25 hover:bg-neutral-50 flex items-center justify-center gap-2 text-xs font-bold text-neutral-700"
                        >
                          <svg className="h-4 w-4 mr-1 shrink-0" viewBox="0 0 24 24">
                            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l3.66-2.85z" />
                            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.85c.87-2.6 3.3-4.53 12-4.53z" />
                          </svg>
                          Google
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => handleSocialSignIn("apple")}
                          className="h-11 rounded-xl border-[#A68D65]/25 hover:bg-neutral-50 flex items-center justify-center gap-2 text-xs font-bold text-neutral-700"
                        >
                          <svg className="h-4 w-4 mr-1 shrink-0" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M15.97 4.17c.66-.81 1.11-1.93.99-3.06-1 .04-2.22.67-2.94 1.5-.64.74-1.2 1.88-1.05 3 .9.07 2.05-.59 2.76-1.34" />
                          </svg>
                          Apple
                        </Button>
                      </div>

                      <div className="relative my-6">
                        <div className="absolute inset-0 flex items-center">
                          <div className="w-full border-t border-[#A68D65]/10"></div>
                        </div>
                        <div className="relative flex justify-center text-[9px] uppercase">
                          <span className="bg-white px-2.5 text-neutral-400 font-bold tracking-wider">
                            Or Email Credentials
                          </span>
                        </div>
                      </div>
                    </>
                  )}

                  <form className="space-y-4" onSubmit={handleSubmit}>
                    {isSignup && (
                      <FloatingInput
                        id="name"
                        label="Full Name"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        error={errors.name}
                        required
                      />
                    )}

                    {mode !== "reset" && (
                      <FloatingInput
                        id="email"
                        label="Email Address"
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        error={errors.email}
                        required
                      />
                    )}

                    {isSignup && (
                      <FloatingInput
                        id="phone"
                        label="Phone Number"
                        type="tel"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        error={errors.phone}
                        placeholder="9876543210"
                        required
                      />
                    )}

                    {needsPassword && (
                      <div className="relative">
                        <FloatingInput
                          id="password"
                          label="Password"
                          type={showPassword ? "text" : "password"}
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          error={errors.password}
                          minLength={isLogin ? 1 : 8}
                          required
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword((v) => !v)}
                          className="absolute right-3.5 top-5 text-neutral-400 hover:text-[#33381C]"
                        >
                          {showPassword ? (
                            <EyeOff className="h-4.5 w-4.5" />
                          ) : (
                            <Eye className="h-4.5 w-4.5" />
                          )}
                        </button>
                      </div>
                    )}

                    {isLogin && (
                      <div className="text-right -mt-2.5 mb-2">
                        <Link
                          className="text-[11px] font-bold text-[#33381C] hover:underline"
                          to="/forgot-password"
                        >
                          Forgot Password?
                        </Link>
                      </div>
                    )}

                    {isSignup && (
                      <FloatingInput
                        id="confirmPassword"
                        label="Confirm Password"
                        type={showPassword ? "text" : "password"}
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        error={errors.confirmPassword}
                        required
                      />
                    )}

                    <Button
                      type="submit"
                      className="h-12 w-full rounded-xl bg-[#33381C] hover:bg-[#262A14] text-white font-bold shadow-md hover:shadow-lg mt-4 cursor-pointer"
                    >
                      {pageCopy.submit}
                    </Button>
                  </form>

                  <div className="mt-6 text-center text-xs border-t border-[#A68D65]/10 pt-4 font-medium flex flex-col gap-3">
                    {isLogin && selectedRole !== "admin" && (
                      <span className="text-neutral-500">
                        New to Grevya?{" "}
                        <button
                          onClick={() => navigate(selectedRole === "seller" ? "/seller/register" : "/signup")}
                          className="font-bold text-[#33381C] hover:underline"
                        >
                          Create {selectedRole === "seller" ? "Seller" : "an"} Account
                        </button>
                      </span>
                    )}
                    {isSignup && (
                      <span className="text-neutral-500">
                        Already have an account?{" "}
                        <button
                          onClick={() => navigate(selectedRole === "seller" ? "/seller/login" : "/login")}
                          className="font-bold text-[#33381C] hover:underline"
                        >
                          Sign In
                        </button>
                      </span>
                    )}
                    {(mode === "forgot" || mode === "reset") && (
                      <Link
                        className="font-bold text-[#33381C] hover:underline mx-auto"
                        to={selectedRole === "admin" ? "/admin/login" : selectedRole === "seller" ? "/seller/login" : "/login"}
                      >
                        Back to Login
                      </Link>
                    )}
                  </div>
                </motion.div>
              </AnimatePresence>
            )}

          </section>
        </div>
      </main>

      <Footer />
    </div>
  );
};

export default AuthPage;
