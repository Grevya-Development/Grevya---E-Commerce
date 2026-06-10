import { ChangeEvent, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Link } from "react-router-dom";
import {
  BadgeCheck,
  Box,
  Camera,
  CalendarDays,
  CheckCircle2,
  ClipboardList,
  Edit3,
  Heart,
  LayoutDashboard,
  Mail,
  MapPin,
  PackageCheck,
  Phone,
  Save,
  ShieldCheck,
  ShoppingBag,
  Store,
  UserRound,
  X,
} from "lucide-react";

import Footer from "@/components/Footer";
import Navbar from "@/components/Navbar";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/lib/supabaseClient";
import { useAuthStore } from "@/store/authStore";

type UserRole = "buyer" | "seller" | "admin";

type ProfileData = {
  id: string;
  username?: string | null;
  full_name?: string | null;
  email?: string | null;
  phone?: string | null;
  alternate_phone?: string | null;
  address?: string | null;
  avatar_url?: string | null;
  role?: UserRole | string | null;
  is_active?: boolean | null;
  created_at?: string | null;
  updated_at?: string | null;
};

type ProfileForm = {
  full_name: string;
  phone: string;
  alternate_phone: string;
  address: string;
};

type Stats = {
  primary: number | string;
  secondary: number | string;
  wishlist: number;
};

const roleTheme: Record<
  UserRole,
  {
    title: string;
    label: string;
    accent: string;
    badge: string;
    primaryStat: string;
    secondaryStat: string;
  }
> = {
  buyer: {
    title: "Personal shopping profile",
    label: "Customer",
    accent: "from-emerald-600 via-teal-500 to-sky-500",
    badge: "bg-emerald-100 text-emerald-800 border-emerald-200",
    primaryStat: "Saved Items",
    secondaryStat: "Membership",
  },
  seller: {
    title: "Seller profile and storefront",
    label: "Seller",
    accent: "from-blue-600 via-cyan-500 to-emerald-500",
    badge: "bg-blue-100 text-blue-800 border-blue-200",
    primaryStat: "Products",
    secondaryStat: "Pending",
  },
  admin: {
    title: "Admin profile and controls",
    label: "Admin",
    accent: "from-violet-600 via-fuchsia-500 to-emerald-500",
    badge: "bg-violet-100 text-violet-800 border-violet-200",
    primaryStat: "Users",
    secondaryStat: "Products",
  },
};

const quickActions: Record<
  UserRole,
  Array<{ label: string; path: string; icon: typeof ShoppingBag }>
> = {
  buyer: [
    { label: "Shop Products", path: "/products", icon: ShoppingBag },
    { label: "Wishlist", path: "/wishlist", icon: Heart },
    { label: "Cart", path: "/cart", icon: Box },
  ],
  seller: [
    { label: "Dashboard", path: "/seller/dashboard", icon: LayoutDashboard },
    { label: "My Products", path: "/seller/products", icon: PackageCheck },
    { label: "Add Product", path: "/seller/add-product", icon: Store },
  ],
  admin: [
    { label: "Dashboard", path: "/admin/dashboard", icon: LayoutDashboard },
    { label: "Users", path: "/admin/users", icon: ShieldCheck },
    { label: "Requests", path: "/admin/product-requests", icon: ClipboardList },
  ],
};

const normalizeRole = (role?: string | null): UserRole => {
  if (role === "admin" || role === "seller") return role;
  return "buyer";
};

const formatDate = (date?: string | null) => {
  if (!date) return "Not available";

  return new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(date));
};

export default function Profile() {
  const { setProfile: setStoredProfile } = useAuthStore();
  const { toast } = useToast();
  const avatarMenuRef = useRef<HTMLDivElement>(null);

  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showAvatarMenu, setShowAvatarMenu] = useState(false);
  const [stats, setStats] = useState<Stats>({
    primary: 0,
    secondary: 0,
    wishlist: 0,
  });
  const [formData, setFormData] = useState<ProfileForm>({
    full_name: "",
    phone: "",
    alternate_phone: "",
    address: "",
  });

  const role = normalizeRole(profile?.role);
  const theme = roleTheme[role];
  const displayName =
    profile?.full_name?.trim() || profile?.username?.trim() || "Your profile";
  const initial = displayName.charAt(0).toUpperCase();

  const completionItems = useMemo(
    () => [
      {
        label: "Name",
        complete: Boolean(profile?.full_name || profile?.username),
      },
      { label: "Phone", complete: Boolean(profile?.phone) },
      { label: "Alternate phone", complete: Boolean(profile?.alternate_phone) },
      { label: "Address", complete: Boolean(profile?.address) },
      { label: "Photo", complete: Boolean(profile?.avatar_url) },
    ],
    [profile],
  );

  const profileCompletion = Math.round(
    (completionItems.filter((item) => item.complete).length /
      completionItems.length) *
      100,
  );

  const hasChanges =
    formData.full_name !== (profile?.full_name || "") ||
    formData.phone !== (profile?.phone || "") ||
    formData.alternate_phone !== (profile?.alternate_phone || "") ||
    formData.address !== (profile?.address || "");

  const fetchProfile = async () => {
    setLoading(true);

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setLoading(false);
      return;
    }

    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .single();

    if (error) {
      toast({
        title: "Profile not loaded",
        description: error.message,
        variant: "destructive",
      });
      setLoading(false);
      return;
    }

    const nextProfile = data as ProfileData;
    const nextRole = normalizeRole(nextProfile.role);

    setProfile(nextProfile);
    setStoredProfile(nextProfile as any);
    setFormData({
      full_name: nextProfile.full_name || "",
      phone: nextProfile.phone || "",
      alternate_phone: nextProfile.alternate_phone || "",
      address: nextProfile.address || "",
    });

    await fetchStats(user.id, nextRole);
    setLoading(false);
  };

  const fetchStats = async (userId: string, currentRole: UserRole) => {
    const { count: wishlistCount } = await supabase
      .from("wishlist")
      .select("*", { count: "exact", head: true })
      .eq("user_id", userId);

    if (currentRole === "seller") {
      const { count: productCount } = await supabase
        .from("products")
        .select("*", { count: "exact", head: true })
        .eq("seller_id", userId);

      const { count: pendingCount } = await supabase
        .from("products")
        .select("*", { count: "exact", head: true })
        .eq("seller_id", userId)
        .neq("product_status", "approved");

      setStats({
        primary: productCount || 0,
        secondary: pendingCount || 0,
        wishlist: wishlistCount || 0,
      });
      return;
    }

    if (currentRole === "admin") {
      const { count: userCount } = await supabase
        .from("profiles")
        .select("*", { count: "exact", head: true });

      const { count: productCount } = await supabase
        .from("products")
        .select("*", { count: "exact", head: true });

      setStats({
        primary: userCount || 0,
        secondary: productCount || 0,
        wishlist: wishlistCount || 0,
      });
      return;
    }

    setStats({
      primary: wishlistCount || 0,
      secondary: "Customer",
      wishlist: wishlistCount || 0,
    });
  };

  useEffect(() => {
    fetchProfile();
  }, []);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        avatarMenuRef.current &&
        !avatarMenuRef.current.contains(event.target as Node)
      ) {
        setShowAvatarMenu(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const updateForm = (field: keyof ProfileForm, value: string) => {
    setFormData((current) => ({ ...current, [field]: value }));
  };

  const uploadAvatar = async (event: ChangeEvent<HTMLInputElement>) => {
    try {
      const file = event.target.files?.[0];
      if (!file) return;

      setUploading(true);

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) return;

      const fileExt = file.name.split(".").pop();
      const fileName = `${user.id}-${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from("avatars")
        .upload(fileName, file, { upsert: true });

      if (uploadError) throw uploadError;

      const { data } = supabase.storage.from("avatars").getPublicUrl(fileName);

      const { error } = await supabase
        .from("profiles")
        .update({ avatar_url: data.publicUrl })
        .eq("id", user.id);

      if (error) throw error;

      setShowAvatarMenu(false);
      await fetchProfile();
      toast({ title: "Profile photo updated" });
    } catch (error: any) {
      toast({
        title: "Upload failed",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setUploading(false);
      event.target.value = "";
    }
  };

  const removeAvatar = async () => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) return;

      const { error } = await supabase
        .from("profiles")
        .update({ avatar_url: null })
        .eq("id", user.id);

      if (error) throw error;

      setShowAvatarMenu(false);
      await fetchProfile();
      toast({ title: "Profile photo removed" });
    } catch (error: any) {
      toast({
        title: "Could not remove photo",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const saveProfile = async () => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) return;

      setSaving(true);

      const { error } = await supabase
        .from("profiles")
        .update({
          full_name: formData.full_name.trim() || null,
          phone: formData.phone.trim() || null,
          alternate_phone: formData.alternate_phone.trim() || null,
          address: formData.address.trim() || null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", user.id);

      if (error) throw error;

      await fetchProfile();
      setEditing(false);
      toast({ title: "Profile updated successfully" });
    } catch (error: any) {
      toast({
        title: "Update failed",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen flex-col bg-slate-50">
        <Navbar />
        <main className="flex flex-grow items-center justify-center">
          <div className="rounded-lg border border-emerald-100 bg-white px-6 py-4 text-sm font-medium text-emerald-800 shadow-sm">
            Loading profile...
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-slate-50">
      <Navbar />

      <main className="flex-grow">
        <section className={`bg-gradient-to-r ${theme.accent} text-white`}>
          <div className="container mx-auto px-4 py-10 lg:px-6">
            <div className="flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
              <div className="flex flex-col gap-6 sm:flex-row sm:items-end">
                <div className="relative w-max" ref={avatarMenuRef}>
                  <button
                    type="button"
                    onClick={() => setShowAvatarMenu((value) => !value)}
                    className="group relative block"
                    aria-label="Change profile photo"
                  >
                    {profile?.avatar_url ? (
                      <img
                        src={profile.avatar_url}
                        alt={displayName}
                        className="h-32 w-32 rounded-2xl border-4 border-white/70 object-cover shadow-xl"
                      />
                    ) : (
                      <div className="flex h-32 w-32 items-center justify-center rounded-2xl border-4 border-white/70 bg-white/15 text-5xl font-bold shadow-xl backdrop-blur">
                        {initial}
                      </div>
                    )}

                    <span className="absolute -bottom-3 -right-3 flex h-11 w-11 items-center justify-center rounded-full border-4 border-white bg-slate-950 text-white shadow-lg transition-transform group-hover:scale-105">
                      <Camera className="h-5 w-5" />
                    </span>
                  </button>

                  {showAvatarMenu && (
                    <div className="absolute left-0 top-full z-50 mt-5 w-52 overflow-hidden rounded-lg border border-slate-200 bg-white text-sm shadow-2xl">
                      <label className="flex cursor-pointer items-center gap-2 px-4 py-3 font-medium text-slate-700 transition-colors hover:bg-slate-50">
                        <Camera className="h-4 w-4 text-slate-400" />
                        {uploading
                          ? "Uploading..."
                          : profile?.avatar_url
                            ? "Change Photo"
                            : "Upload Photo"}
                        <input
                          type="file"
                          accept="image/*"
                          onChange={uploadAvatar}
                          className="hidden"
                          disabled={uploading}
                        />
                      </label>

                      {profile?.avatar_url && (
                        <button
                          type="button"
                          onClick={removeAvatar}
                          className="flex w-full items-center gap-2 px-4 py-3 text-left font-medium text-red-600 transition-colors hover:bg-red-50"
                        >
                          <X className="h-4 w-4" />
                          Remove Photo
                        </button>
                      )}
                    </div>
                  )}
                </div>

                <div className="max-w-2xl">
                  <div className="mb-3 flex flex-wrap items-center gap-2">
                    {role !== "buyer" && (
                      <span
                        className={`rounded-full border px-3 py-1 text-xs font-bold uppercase tracking-wide ${theme.badge}`}
                      >
                        {theme.label}
                      </span>
                    )}
                    <span className="rounded-full border border-white/30 bg-white/15 px-3 py-1 text-xs font-semibold backdrop-blur">
                      {profile?.is_active
                        ? "Active account"
                        : "Inactive account"}
                    </span>
                  </div>

                  <h1 className="text-4xl font-bold leading-tight md:text-5xl">
                    {displayName}
                  </h1>
                  <p className="mt-3 max-w-xl text-sm leading-6 text-white/85 md:text-base">
                    {theme.title}. Keep your contact details fresh and move
                    quickly to the areas you use most.
                  </p>

                  <div className="mt-5 flex flex-wrap gap-3 text-sm text-white/90">
                    <span className="flex items-center gap-2">
                      <Mail className="h-4 w-4" />
                      {profile?.email || "Email not available"}
                    </span>
                    <span className="flex items-center gap-2">
                      <CalendarDays className="h-4 w-4" />
                      Joined {formatDate(profile?.created_at)}
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap gap-3">
                <Button
                  onClick={() => setEditing(true)}
                  className="bg-white text-slate-900 hover:bg-white/90"
                >
                  <Edit3 className="mr-2 h-4 w-4" />
                  Edit Profile
                </Button>
              </div>
            </div>
          </div>
        </section>

        <section className="container mx-auto px-4 py-8 lg:px-6">
          <AnimatePresence mode="wait">
            {editing ? (
              <motion.section
                key="edit-view"
                initial={{ opacity: 0, y: 36 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -24 }}
                transition={{ duration: 0.3, ease: "easeOut" }}
                className="mx-auto max-w-5xl"
              >
                <div className="rounded-[28px] border border-emerald-200 bg-white p-6 shadow-sm sm:p-8">
                  <div className="mb-8 flex flex-col gap-4 border-b border-slate-100 pb-6 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <p className="text-sm font-semibold uppercase tracking-[0.18em] text-emerald-700">
                        Profile Settings
                      </p>
                      <h2 className="mt-2 text-3xl font-bold text-slate-950">
                        Edit your account details
                      </h2>
                      <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
                        Update the information tied to your Grevya account. Changes save to your live profile and refresh this page when complete.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setEditing(false)}
                      className="rounded-full border border-slate-200 p-2 text-slate-400 transition-colors hover:border-slate-300 hover:bg-slate-50 hover:text-slate-700"
                      aria-label="Close edit form"
                    >
                      <X className="h-5 w-5" />
                    </button>
                  </div>

                  <div className="grid gap-5 md:grid-cols-2">
                    <Field
                      label="Full Name"
                      value={formData.full_name}
                      onChange={(value) => updateForm("full_name", value)}
                      placeholder="Enter full name"
                    />
                    <Field
                      label="Phone"
                      value={formData.phone}
                      onChange={(value) => updateForm("phone", value)}
                      placeholder="Enter phone number"
                    />
                    <Field
                      label="Alternate Phone"
                      value={formData.alternate_phone}
                      onChange={(value) => updateForm("alternate_phone", value)}
                      placeholder="Optional alternate number"
                    />
                    <Field
                      label="Address"
                      value={formData.address}
                      onChange={(value) => updateForm("address", value)}
                      placeholder="Delivery or business address"
                    />
                  </div>

                  <div className="mt-8 grid gap-4 rounded-2xl bg-slate-50 p-5 md:grid-cols-3">
                    <MiniStat label="Username" value={profile?.username || "-"} />
                    <MiniStat label="Email" value={profile?.email || "-"} />
                    <MiniStat
                      label="Profile Complete"
                      value={`${profileCompletion}%`}
                    />
                  </div>

                  <div className="mt-8 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
                    <Button
                      variant="outline"
                      onClick={() => setEditing(false)}
                      className="border-slate-200"
                    >
                      Cancel
                    </Button>
                    <Button
                      onClick={saveProfile}
                      disabled={saving || !hasChanges}
                      className="bg-emerald-700 hover:bg-emerald-800"
                    >
                      <Save className="mr-2 h-4 w-4" />
                      {saving ? "Saving..." : "Save Changes"}
                    </Button>
                  </div>
                </div>
              </motion.section>
            ) : (
              <motion.div
                key="profile-view"
                initial={{ opacity: 0, y: 24 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.28, ease: "easeOut" }}
              >
                <div className="grid gap-5 md:grid-cols-3">
                  <StatCard
                    label={theme.primaryStat}
                    value={stats.primary}
                    icon={
                      role === "buyer"
                        ? ShoppingBag
                        : role === "seller"
                          ? PackageCheck
                          : ShieldCheck
                    }
                    tone="emerald"
                  />
                  <StatCard
                    label={theme.secondaryStat}
                    value={stats.secondary}
                    icon={
                      role === "admin"
                        ? Box
                        : role === "seller"
                          ? ClipboardList
                          : Heart
                    }
                    tone="sky"
                  />
                  <StatCard
                    label="Profile Complete"
                    value={`${profileCompletion}%`}
                    icon={CheckCircle2}
                    tone="amber"
                  />
                </div>

                <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_360px]">
                  <div className="space-y-8">
                    <section className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
                      <div className="flex flex-col gap-4 border-b border-slate-100 pb-5 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                          <h2 className="text-xl font-semibold text-slate-950">
                            Personal Information
                          </h2>
                          <p className="mt-1 text-sm text-slate-500">
                            The core details connected to your Grevya account.
                          </p>
                        </div>
                        <Button
                          variant="outline"
                          onClick={() => setEditing(true)}
                          className="border-emerald-200 text-emerald-800 hover:bg-emerald-50"
                        >
                          <Edit3 className="mr-2 h-4 w-4" />
                          Update
                        </Button>
                      </div>

                      <div className="mt-6 grid gap-4 md:grid-cols-2">
                        <Info
                          icon={UserRound}
                          label="Username"
                          value={profile?.username}
                        />
                        <Info
                          icon={UserRound}
                          label="Full Name"
                          value={profile?.full_name}
                        />
                        <Info icon={Mail} label="Email" value={profile?.email} />
                        <Info icon={Phone} label="Phone" value={profile?.phone} />
                        <Info
                          icon={Phone}
                          label="Alternate Phone"
                          value={profile?.alternate_phone}
                        />
                        <Info
                          icon={ShieldCheck}
                          label={role === "buyer" ? "Account" : "Role"}
                          value={theme.label}
                        />
                        <Info
                          icon={BadgeCheck}
                          label="Status"
                          value={profile?.is_active ? "Active" : "Inactive"}
                        />
                        <Info
                          icon={CalendarDays}
                          label="Last Updated"
                          value={formatDate(profile?.updated_at)}
                        />
                      </div>

                      <div className="mt-5 rounded-lg border border-slate-100 bg-slate-50 p-4">
                        <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-700">
                          <MapPin className="h-4 w-4 text-emerald-600" />
                          Address
                        </div>
                        <p className="text-sm leading-6 text-slate-600">
                          {profile?.address || "No address added yet."}
                        </p>
                      </div>
                    </section>
                  </div>

                  <aside className="space-y-6">
                    <section className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
                      <div className="flex items-center justify-between">
                        <div>
                          <h2 className="text-lg font-semibold text-slate-950">
                            Completion
                          </h2>
                          <p className="text-sm text-slate-500">
                            {profileCompletion}% ready
                          </p>
                        </div>
                        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 text-lg font-bold text-emerald-800">
                          {profileCompletion}%
                        </div>
                      </div>

                      <div className="mt-5 h-2 overflow-hidden rounded-full bg-slate-100">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-sky-500"
                          style={{ width: `${profileCompletion}%` }}
                        />
                      </div>

                      <div className="mt-5 space-y-3">
                        {completionItems.map((item) => (
                          <div
                            key={item.label}
                            className="flex items-center justify-between text-sm"
                          >
                            <span className="text-slate-600">{item.label}</span>
                            <span
                              className={
                                item.complete
                                  ? "text-emerald-700"
                                  : "text-slate-400"
                              }
                            >
                              {item.complete ? "Done" : "Missing"}
                            </span>
                          </div>
                        ))}
                      </div>
                    </section>

                    <section className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
                      <h2 className="text-lg font-semibold text-slate-950">
                        Quick Actions
                      </h2>
                      <div className="mt-4 space-y-3">
                        {quickActions[role].map((action) => {
                          const Icon = action.icon;

                          return (
                            <Link
                              key={action.path}
                              to={action.path}
                              className="flex items-center justify-between rounded-lg border border-slate-100 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-700 transition-colors hover:border-emerald-200 hover:bg-emerald-50 hover:text-emerald-800"
                            >
                              <span className="flex items-center gap-3">
                                <Icon className="h-4 w-4" />
                                {action.label}
                              </span>
                              <span>Open</span>
                            </Link>
                          );
                        })}
                      </div>
                    </section>
                  </aside>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </section>
      </main>

      <Footer />
    </div>
  );
}

function StatCard({
  label,
  value,
  icon: Icon,
  tone,
}: {
  label: string;
  value: number | string;
  icon: typeof ShoppingBag;
  tone: "emerald" | "sky" | "amber";
}) {
  const styles = {
    emerald: "bg-emerald-50 text-emerald-700 border-emerald-100",
    sky: "bg-sky-50 text-sky-700 border-sky-100",
    amber: "bg-amber-50 text-amber-700 border-amber-100",
  };

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-slate-500">{label}</p>
          <p className="mt-3 text-3xl font-bold text-slate-950">{value}</p>
        </div>
        <div className={`rounded-lg border p-3 ${styles[tone]}`}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </div>
  );
}

function Info({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof UserRound;
  label: string;
  value?: string | null;
}) {
  return (
    <div className="rounded-lg border border-slate-100 bg-white p-4">
      <div className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-slate-400">
        <Icon className="h-4 w-4" />
        {label}
      </div>
      <p className="break-words text-sm font-semibold text-slate-800">
        {value || "-"}
      </p>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
}) {
  return (
    <label className="block">
      <span className="text-sm font-semibold text-slate-700">{label}</span>
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="mt-2 h-11 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 text-sm text-slate-900 outline-none transition focus:border-emerald-300 focus:bg-white focus:ring-4 focus:ring-emerald-100"
      />
    </label>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white px-4 py-3">
      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">
        {label}
      </p>
      <p className="mt-2 truncate text-sm font-semibold text-slate-900">
        {value}
      </p>
    </div>
  );
}
