import React, { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/lib/supabaseClient";
import AdminLayout from "@/layouts/AdminLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { Loader2, UserRound, Lock, Bell, Shield, Sparkles } from "lucide-react";
import { updateAuthPassword } from "@/lib/authService";

export default function AdminSettings() {
  const { user, profile, refreshProfile } = useAuth();
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const [updatingPass, setUpdatingPass] = useState(false);

  const [searchParams, setSearchParams] = useSearchParams();
  const defaultTab = searchParams.get("tab") || "profile";
  const [activeTab, setActiveTab] = useState(defaultTab);

  useEffect(() => {
    const tab = searchParams.get("tab");
    if (tab && (tab === "profile" || tab === "security" || tab === "preferences")) {
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

  // Preferences State
  const [preferences, setPreferences] = useState({
    systemAlerts: true,
    weeklyDigest: false,
    auditLogEmails: true,
  });

  useEffect(() => {
    if (profile) {
      setProfileForm({
        full_name: profile.full_name || "",
        username: profile.username || "",
        phone: profile.phone || "",
        avatar_url: profile.avatar_url || "",
      });
      if (profile.preferences) {
        setPreferences((prev) => ({
          ...prev,
          ...profile.preferences,
        }));
      }
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
          preferences: {
            ...profile?.preferences,
            ...preferences,
          },
        })
        .eq("id", user.id);

      if (error) throw error;

      await refreshProfile();
      toast({
        title: "Settings updated",
        description: "Your administrator profile has been updated.",
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

  const handlePreferenceChange = (key: string, value: boolean) => {
    setPreferences((prev) => ({
      ...prev,
      [key]: value,
    }));
  };

  return (
    <AdminLayout>
      <div className="max-w-4xl mx-auto space-y-6">
        <div>
          <h1 className="font-serif text-3xl font-bold text-[#33381C]">
            Admin Settings
          </h1>
          <p className="text-neutral-500 mt-1 text-sm">
            Manage your administrator profile, security parameters, and system preferences.
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
              value="security"
              className="rounded-xl py-2 font-semibold text-xs tracking-wide cursor-pointer data-[state=active]:bg-[#33381C] data-[state=active]:text-white"
            >
              <Lock className="h-4 w-4 mr-1.5" /> Security
            </TabsTrigger>
            <TabsTrigger
              value="preferences"
              className="rounded-xl py-2 font-semibold text-xs tracking-wide cursor-pointer data-[state=active]:bg-[#33381C] data-[state=active]:text-white"
            >
              <Bell className="h-4 w-4 mr-1.5" /> Preferences
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
                  <Shield size={20} />
                </div>
                <h3 className="font-serif text-lg font-bold text-[#33381C]">
                  Administrator Profile Info
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
                    Username
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
                    Full Name
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
                  Security &amp; Credentials
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
                  Update Credentials
                </Button>
              </div>
            </form>
          </TabsContent>

          {/* PREFERENCES SECTION */}
          <TabsContent value="preferences" className="mt-6">
            <div className="bg-white border border-[#A68D65]/15 rounded-3xl p-6 md:p-8 shadow-xs space-y-6">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-[#33381C]/10 text-[#33381C]">
                  <Bell size={20} />
                </div>
                <h3 className="font-serif text-lg font-bold text-[#33381C]">
                  System Notifications &amp; Alerts
                </h3>
              </div>

              <div className="space-y-5">
                <div className="flex items-center justify-between border-b border-neutral-100 pb-4">
                  <div className="space-y-0.5">
                    <h4 className="text-sm font-bold text-neutral-800">
                      Real-time System Alerts
                    </h4>
                    <p className="text-xs text-neutral-500 max-w-md">
                      Receive immediate dashboard notifications when errors, high request volume, or role anomalies are detected.
                    </p>
                  </div>
                  <Switch
                    checked={preferences.systemAlerts}
                    onCheckedChange={(checked) =>
                      handlePreferenceChange("systemAlerts", checked)
                    }
                  />
                </div>

                <div className="flex items-center justify-between border-b border-neutral-100 pb-4">
                  <div className="space-y-0.5">
                    <h4 className="text-sm font-bold text-neutral-800">
                      Weekly digest reports
                    </h4>
                    <p className="text-xs text-neutral-500 max-w-md">
                      Get a compiled overview of store performance, registered user increases, and vendor statistics directly in your email.
                    </p>
                  </div>
                  <Switch
                    checked={preferences.weeklyDigest}
                    onCheckedChange={(checked) =>
                      handlePreferenceChange("weeklyDigest", checked)
                    }
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <h4 className="text-sm font-bold text-neutral-800">
                      Audit Trail logs
                    </h4>
                    <p className="text-xs text-neutral-500 max-w-md">
                      Send security warnings to administrator email when new seller credentials or admin changes occur.
                    </p>
                  </div>
                  <Switch
                    checked={preferences.auditLogEmails}
                    onCheckedChange={(checked) =>
                      handlePreferenceChange("auditLogEmails", checked)
                    }
                  />
                </div>
              </div>

              <div className="pt-4 border-t border-neutral-100 flex justify-end">
                <Button
                  onClick={handleProfileSubmit}
                  disabled={saving}
                  className="rounded-xl bg-[#33381C] hover:bg-[#262A14] text-white font-bold h-10 px-6 cursor-pointer"
                >
                  {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Save Preferences
                </Button>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </AdminLayout>
  );
}
