import React, { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/lib/supabaseClient";
import SellerLayout from "@/layouts/SellerLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { Loader2, UserRound, Lock, Store, Sparkles } from "lucide-react";
import { updateAuthPassword } from "@/lib/authService";

export default function SellerSettings() {
  const { user, profile, refreshProfile } = useAuth();
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const [updatingPass, setUpdatingPass] = useState(false);

  const [searchParams, setSearchParams] = useSearchParams();
  const defaultTab = searchParams.get("tab") || "profile";
  const [activeTab, setActiveTab] = useState(defaultTab);

  useEffect(() => {
    const tab = searchParams.get("tab");
    if (tab && (tab === "profile" || tab === "store" || tab === "security")) {
      setActiveTab(tab);
    }
  }, [searchParams]);

  const handleTabChange = (val: string) => {
    setActiveTab(val);
    setSearchParams({ tab: val });
  };

  // Profile Form State
  const [profileForm, setProfileForm] = useState({
    full_name: "",
    username: "",
    phone: "",
    avatar_url: "",
  });

  // Password Form State
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });

  // Store Details Form State
  const [storeForm, setStoreForm] = useState({
    business_name: "",
    description: "",
    contact_email: "",
    contact_phone: "",
    address: "",
    store_logo: "",
  });

  useEffect(() => {
    if (profile) {
      setProfileForm({
        full_name: profile.full_name || "",
        username: profile.username || "",
        phone: profile.phone || "",
        avatar_url: profile.avatar_url || "",
      });

      const storeDetails = profile.preferences?.store_details || {};
      setStoreForm({
        business_name: storeDetails.business_name || profile.username || "",
        description: storeDetails.description || "",
        contact_email: storeDetails.contact_email || profile.email || "",
        contact_phone: storeDetails.contact_phone || profile.phone || "",
        address: storeDetails.address || "",
        store_logo: storeDetails.store_logo || profile.avatar_url || "",
      });
    }
  }, [profile]);

  const handleProfileSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    setSaving(true);
    try {
      const { error } = await supabase
        .from("profiles")
        .update({
          full_name: profileForm.full_name,
          username: profileForm.username,
          phone: profileForm.phone,
          avatar_url: profileForm.avatar_url,
        })
        .eq("id", user.id);

      if (error) throw error;

      await refreshProfile();
      toast({
        title: "Profile updated",
        description: "Your seller profile settings have been updated.",
      });
    } catch (err: any) {
      toast({
        title: "Update failed",
        description: err.message,
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleStoreSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    setSaving(true);
    try {
      const { error } = await supabase
        .from("profiles")
        .update({
          preferences: {
            ...profile?.preferences,
            store_details: {
              business_name: storeForm.business_name,
              description: storeForm.description,
              contact_email: storeForm.contact_email,
              contact_phone: storeForm.contact_phone,
              address: storeForm.address,
              store_logo: storeForm.store_logo,
            },
          },
        })
        .eq("id", user.id);

      if (error) throw error;

      await refreshProfile();
      toast({
        title: "Store details updated",
        description: "Your public store branding details have been updated.",
      });
    } catch (err: any) {
      toast({
        title: "Update failed",
        description: err.message,
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      toast({
        title: "Mismatched passwords",
        description: "New passwords do not match.",
        variant: "destructive",
      });
      return;
    }

    setUpdatingPass(true);
    try {
      await updateAuthPassword(passwordForm.newPassword);

      setPasswordForm({
        currentPassword: "",
        newPassword: "",
        confirmPassword: "",
      });

      toast({
        title: "Password updated",
        description: "Your security credentials have been updated.",
      });
    } catch (err: any) {
      toast({
        title: "Update failed",
        description: err.message,
        variant: "destructive",
      });
    } finally {
      setUpdatingPass(false);
    }
  };

  return (
    <SellerLayout>
      <div className="max-w-4xl mx-auto space-y-6">
        <div>
          <h1 className="font-serif text-3xl font-bold text-[#33381C]">
            Seller Settings
          </h1>
          <p className="text-neutral-500 mt-1 text-sm">
            Configure your vendor profile, manage security, and design your digital storefront branding.
          </p>
        </div>

        <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
          <TabsList className="grid grid-cols-3 w-full max-w-md rounded-2xl bg-[#F7EEE4] p-1.5 border border-[#A68D65]/20">
            <TabsTrigger
              value="profile"
              className="rounded-xl py-2 font-semibold text-xs tracking-wide cursor-pointer data-[state=active]:bg-[#33381C] data-[state=active]:text-white"
            >
              <UserRound className="h-4 w-4 mr-1.5" /> Profile
            </TabsTrigger>
            <TabsTrigger
              value="store"
              className="rounded-xl py-2 font-semibold text-xs tracking-wide cursor-pointer data-[state=active]:bg-[#33381C] data-[state=active]:text-white"
            >
              <Store className="h-4 w-4 mr-1.5" /> Store Details
            </TabsTrigger>
            <TabsTrigger
              value="security"
              className="rounded-xl py-2 font-semibold text-xs tracking-wide cursor-pointer data-[state=state=active]:bg-[#33381C] data-[state=active]:text-white"
            >
              <Lock className="h-4 w-4 mr-1.5" /> Security
            </TabsTrigger>
          </TabsList>

          {/* PROFILE SECTION */}
          <TabsContent value="profile" className="mt-6">
            <form
              onSubmit={handleProfileSubmit}
              className="bg-white border border-[#A68D65]/15 rounded-3xl p-6 md:p-8 shadow-xs space-y-6"
            >
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-[#33381C]/10 text-[#33381C]">
                  <UserRound size={20} />
                </div>
                <h3 className="font-serif text-lg font-bold text-[#33381C]">
                  Seller Profile Information
                </h3>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="email" className="text-xs font-bold text-neutral-700">
                    Email Address (Read-only)
                  </Label>
                  <Input
                    id="email"
                    type="email"
                    disabled
                    value={user?.email || ""}
                    className="rounded-xl border-[#A68D65]/35 bg-neutral-50 text-neutral-500 font-medium h-10"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="username" className="text-xs font-bold text-neutral-700">
                    Username / Slug
                  </Label>
                  <Input
                    id="username"
                    required
                    value={profileForm.username}
                    onChange={(e) =>
                      setProfileForm({ ...profileForm, username: e.target.value })
                    }
                    className="rounded-xl border-[#A68D65]/35 font-medium h-10"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="full_name" className="text-xs font-bold text-neutral-700">
                    Contact Name
                  </Label>
                  <Input
                    id="full_name"
                    required
                    value={profileForm.full_name}
                    onChange={(e) =>
                      setProfileForm({ ...profileForm, full_name: e.target.value })
                    }
                    className="rounded-xl border-[#A68D65]/35 font-medium h-10"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="phone" className="text-xs font-bold text-neutral-700">
                    Contact Phone
                  </Label>
                  <Input
                    id="phone"
                    value={profileForm.phone}
                    onChange={(e) =>
                      setProfileForm({ ...profileForm, phone: e.target.value })
                    }
                    className="rounded-xl border-[#A68D65]/35 font-medium h-10"
                  />
                </div>

                <div className="space-y-1.5 md:col-span-2">
                  <Label htmlFor="avatar_url" className="text-xs font-bold text-neutral-700">
                    Profile Avatar URL
                  </Label>
                  <Input
                    id="avatar_url"
                    placeholder="https://example.com/avatar.jpg"
                    value={profileForm.avatar_url}
                    onChange={(e) =>
                      setProfileForm({ ...profileForm, avatar_url: e.target.value })
                    }
                    className="rounded-xl border-[#A68D65]/35 font-medium h-10"
                  />
                </div>
              </div>

              <div className="pt-4 border-t border-neutral-100 flex justify-end">
                <Button
                  type="submit"
                  disabled={saving}
                  className="rounded-xl bg-[#33381C] hover:bg-[#262A14] text-white font-bold h-10 px-6 cursor-pointer"
                >
                  {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Save Profile Changes
                </Button>
              </div>
            </form>
          </TabsContent>

          {/* STORE DETAILS SECTION */}
          <TabsContent value="store" className="mt-6">
            <form
              onSubmit={handleStoreSubmit}
              className="bg-white border border-[#A68D65]/15 rounded-3xl p-6 md:p-8 shadow-xs space-y-6"
            >
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-[#33381C]/10 text-[#33381C]">
                  <Store size={20} />
                </div>
                <h3 className="font-serif text-lg font-bold text-[#33381C]">
                  Store Details &amp; Branding
                </h3>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="business_name" className="text-xs font-bold text-neutral-700">
                    Business / Store Name
                  </Label>
                  <Input
                    id="business_name"
                    required
                    value={storeForm.business_name}
                    onChange={(e) =>
                      setStoreForm({ ...storeForm, business_name: e.target.value })
                    }
                    className="rounded-xl border-[#A68D65]/35 font-medium h-10"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="store_logo" className="text-xs font-bold text-neutral-700">
                    Store Logo URL
                  </Label>
                  <Input
                    id="store_logo"
                    placeholder="https://example.com/logo.png"
                    value={storeForm.store_logo}
                    onChange={(e) =>
                      setStoreForm({ ...storeForm, store_logo: e.target.value })
                    }
                    className="rounded-xl border-[#A68D65]/35 font-medium h-10"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="contact_email" className="text-xs font-bold text-neutral-700">
                    Business Contact Email
                  </Label>
                  <Input
                    id="contact_email"
                    type="email"
                    value={storeForm.contact_email}
                    onChange={(e) =>
                      setStoreForm({ ...storeForm, contact_email: e.target.value })
                    }
                    className="rounded-xl border-[#A68D65]/35 font-medium h-10"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="contact_phone" className="text-xs font-bold text-neutral-700">
                    Business Contact Phone
                  </Label>
                  <Input
                    id="contact_phone"
                    value={storeForm.contact_phone}
                    onChange={(e) =>
                      setStoreForm({ ...storeForm, contact_phone: e.target.value })
                    }
                    className="rounded-xl border-[#A68D65]/35 font-medium h-10"
                  />
                </div>

                <div className="space-y-1.5 md:col-span-2">
                  <Label htmlFor="address" className="text-xs font-bold text-neutral-700">
                    Warehouse / Business Address
                  </Label>
                  <Input
                    id="address"
                    placeholder="123 Orchard Street, suite 100"
                    value={storeForm.address}
                    onChange={(e) =>
                      setStoreForm({ ...storeForm, address: e.target.value })
                    }
                    className="rounded-xl border-[#A68D65]/35 font-medium h-10"
                  />
                </div>

                <div className="space-y-1.5 md:col-span-2">
                  <Label htmlFor="description" className="text-xs font-bold text-neutral-700">
                    Store / Brand Description
                  </Label>
                  <textarea
                    id="description"
                    rows={4}
                    value={storeForm.description}
                    onChange={(e) =>
                      setStoreForm({ ...storeForm, description: e.target.value })
                    }
                    className="w-full rounded-xl border border-[#A68D65]/35 bg-white p-3 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-neutral-400"
                    placeholder="Describe your brand values, organic sourcing, etc..."
                  />
                </div>
              </div>

              <div className="pt-4 border-t border-neutral-100 flex justify-end">
                <Button
                  type="submit"
                  disabled={saving}
                  className="rounded-xl bg-[#33381C] hover:bg-[#262A14] text-white font-bold h-10 px-6 cursor-pointer"
                >
                  {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Save Store Details
                </Button>
              </div>
            </form>
          </TabsContent>

          {/* SECURITY SECTION */}
          <TabsContent value="security" className="mt-6">
            <form
              onSubmit={handlePasswordSubmit}
              className="bg-white border border-[#A68D65]/15 rounded-3xl p-6 md:p-8 shadow-xs space-y-6"
            >
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-[#33381C]/10 text-[#33381C]">
                  <Lock size={20} />
                </div>
                <h3 className="font-serif text-lg font-bold text-[#33381C]">
                  Security Credentials
                </h3>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="new_pass" className="text-xs font-bold text-neutral-700">
                    New Password
                  </Label>
                  <Input
                    id="new_pass"
                    type="password"
                    required
                    value={passwordForm.newPassword}
                    onChange={(e) =>
                      setPasswordForm({ ...passwordForm, newPassword: e.target.value })
                    }
                    className="rounded-xl border-[#A68D65]/35 font-medium h-10"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="confirm_pass" className="text-xs font-bold text-neutral-700">
                    Confirm New Password
                  </Label>
                  <Input
                    id="confirm_pass"
                    type="password"
                    required
                    value={passwordForm.confirmPassword}
                    onChange={(e) =>
                      setPasswordForm({
                        ...passwordForm,
                        confirmPassword: e.target.value,
                      })
                    }
                    className="rounded-xl border-[#A68D65]/35 font-medium h-10"
                  />
                </div>
              </div>

              <div className="pt-4 border-t border-neutral-100 flex justify-end">
                <Button
                  type="submit"
                  disabled={updatingPass || !passwordForm.newPassword}
                  className="rounded-xl bg-[#33381C] hover:bg-[#262A14] text-white font-bold h-10 px-6 cursor-pointer"
                >
                  {updatingPass && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Update Security Credentials
                </Button>
              </div>
            </form>
          </TabsContent>
        </Tabs>
      </div>
    </SellerLayout>
  );
}
