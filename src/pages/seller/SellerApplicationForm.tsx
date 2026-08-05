import { FormEvent, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Building2, CheckCircle2, Landmark, Loader2, Send, ShieldCheck } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { useAuth } from "@/context/AuthContext";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";

type ApplicationStatus = "pending" | "under_review" | "approved" | "rejected";

type SellerApplication = {
  id: string;
  user_id: string;
  status: ApplicationStatus;
  company_name: string | null;
  business_type: string | null;
  registration_number: string | null;
  tax_id: string | null;
  bank_details: BankDetails | null;
};

type BankDetails = {
  account_holder_name?: string;
  bank_name?: string;
  account_number?: string;
  ifsc_code?: string;
};

type FormValues = {
  company_name: string;
  business_type: string;
  registration_number: string;
  tax_id: string;
  account_holder_name: string;
  bank_name: string;
  account_number: string;
  ifsc_code: string;
};

const emptyForm: FormValues = {
  company_name: "",
  business_type: "",
  registration_number: "",
  tax_id: "",
  account_holder_name: "",
  bank_name: "",
  account_number: "",
  ifsc_code: "",
};

const businessTypes = [
  "Sole proprietorship",
  "Partnership",
  "Private limited company",
  "LLP",
  "Co-operative",
  "Other",
];

export default function SellerApplicationForm() {
  const { user, profile } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [application, setApplication] = useState<SellerApplication | null>(null);
  const [form, setForm] = useState<FormValues>(emptyForm);
  const [errors, setErrors] = useState<Partial<Record<keyof FormValues, string>>>({});
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [reapplying, setReapplying] = useState(false);

  const completion = useMemo(
    () => Math.round((Object.values(form).filter((value) => value.trim()).length / Object.keys(form).length) * 100),
    [form],
  );

  useEffect(() => {
    if (!user?.id) return;

    let cancelled = false;
    const loadApplication = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("seller_applications")
        .select("id, user_id, status, company_name, business_type, registration_number, tax_id, bank_details")
        .eq("user_id", user.id)
        .maybeSingle();

      if (cancelled) return;
      if (error) {
        toast({ title: "Unable to load application", description: error.message, variant: "destructive" });
        setLoading(false);
        return;
      }

      const existing = data as SellerApplication | null;
      if (existing?.status === "pending" || existing?.status === "under_review") {
        navigate("/seller/onboarding", { replace: true });
        return;
      }
      if (existing?.status === "approved") {
        navigate("/seller/dashboard", { replace: true });
        return;
      }

      setApplication(existing);
      if (existing) {
        const bank = existing.bank_details || {};
        setForm({
          company_name: existing.company_name || "",
          business_type: existing.business_type || "",
          registration_number: existing.registration_number || "",
          tax_id: existing.tax_id || "",
          account_holder_name: bank.account_holder_name || "",
          bank_name: bank.bank_name || "",
          account_number: bank.account_number || "",
          ifsc_code: bank.ifsc_code || "",
        });
      }
      setLoading(false);
    };

    void loadApplication();
    return () => {
      cancelled = true;
    };
  }, [navigate, toast, user?.id]);

  const updateField = (field: keyof FormValues, value: string) => {
    setForm((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({ ...current, [field]: undefined }));
  };

  const validate = () => {
    const nextErrors: Partial<Record<keyof FormValues, string>> = {};
    (Object.keys(form) as Array<keyof FormValues>).forEach((field) => {
      if (!form[field].trim()) nextErrors[field] = "This field is required.";
    });
    if (form.tax_id.trim() && form.tax_id.trim().length < 10) nextErrors.tax_id = "Enter a valid tax ID.";
    if (form.ifsc_code.trim() && !/^[A-Z]{4}0[A-Z0-9]{6}$/i.test(form.ifsc_code.trim())) nextErrors.ifsc_code = "Enter a valid 11-character IFSC code.";
    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!user?.id || !validate()) return;

    setSubmitting(true);
    const payload = {
      user_id: user.id,
      status: "pending",
      company_name: form.company_name.trim(),
      business_type: form.business_type,
      registration_number: form.registration_number.trim(),
      tax_id: form.tax_id.trim().toUpperCase(),
      bank_details: {
        account_holder_name: form.account_holder_name.trim(),
        bank_name: form.bank_name.trim(),
        account_number: form.account_number.trim(),
        ifsc_code: form.ifsc_code.trim().toUpperCase(),
      },
    };

    const request = application
      ? supabase.from("seller_applications").update(payload).eq("id", application.id).eq("user_id", user.id)
      : supabase.from("seller_applications").insert(payload);
    const result = await request;

console.log("Supabase Response:", result);

if (result.error) {
  console.error("Supabase Error:", result.error);

  toast({
    title: "Application not submitted",
    description: result.error.message,
    variant: "destructive",
  });

  alert(JSON.stringify(result.error, null, 2));

  return;
}

    toast({ title: "Application submitted", description: "Your seller application is now awaiting review." });
    navigate("/seller/onboarding", { replace: true });
  };

  const startReapplication = () => {
    setReapplying(true);
    toast({ title: "Application reopened", description: "Update your details and submit them for a new review." });
  };

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center bg-[#F7EEE4]/20 text-[#33381C]"><Loader2 className="h-8 w-8 animate-spin" /></div>;
  }

  const isRejected = application?.status === "rejected";
  const canEdit = !application || isRejected && reapplying;

  return (
    <div className="flex min-h-screen flex-col bg-[#F7EEE4]/20">
      <Navbar />
      <main className="flex-1 px-4 py-10 md:py-16">
        <form onSubmit={handleSubmit} className="mx-auto grid max-w-6xl gap-6 lg:grid-cols-[minmax(0,1fr)_330px]">
          <div className="space-y-6">
            <section className="overflow-hidden rounded-[2rem] border border-[#A68D65]/20 bg-white shadow-xl shadow-[#33381C]/5">
              <div className="bg-[linear-gradient(135deg,#F7EEE4_0%,#F1ECE3_55%,#E7E9DD_100%)] p-7 md:p-10">
                <div className="flex items-start gap-4">
                  <div className="rounded-2xl bg-[#33381C] p-3 text-white shadow-lg"><Building2 className="h-7 w-7" /></div>
                  <div><p className="text-xs font-bold uppercase tracking-[0.18em] text-[#A68D65]">Partner with Grevya</p><h1 className="mt-2 font-serif text-3xl font-bold text-[#33381C]">Seller application</h1><p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600">Tell us about your business and payout account. We use these details to verify your marketplace application.</p></div>
                </div>
              </div>
              {isRejected && !reapplying && <div className="border-t border-red-100 bg-red-50 px-7 py-5"><p className="font-semibold text-red-800">Your previous application was not approved.</p><p className="mt-1 text-sm text-red-700">You can reopen it, update the details, and submit a new application.</p><Button type="button" onClick={startReapplication} className="mt-4 bg-[#33381C] hover:bg-[#262A14]">Reapply</Button></div>}
            </section>

            <Section title="Business details" icon={<Building2 className="h-5 w-5" />} description="Use the registered details for the business that will sell on Grevya.">
              <div className="grid gap-5 md:grid-cols-2"><Field label="Company name" error={errors.company_name}><Input value={form.company_name} onChange={(e) => updateField("company_name", e.target.value)} disabled={!canEdit} required /></Field><Field label="Business type" error={errors.business_type}><select value={form.business_type} onChange={(e) => updateField("business_type", e.target.value)} disabled={!canEdit} required className="h-10 w-full rounded-xl border border-[#A68D65]/35 bg-white px-3 text-sm disabled:cursor-not-allowed disabled:bg-slate-50"><option value="">Select business type</option>{businessTypes.map((type) => <option key={type} value={type}>{type}</option>)}</select></Field><Field label="Registration number" error={errors.registration_number}><Input value={form.registration_number} onChange={(e) => updateField("registration_number", e.target.value)} disabled={!canEdit} required /></Field><Field label="Tax ID / GSTIN" error={errors.tax_id}><Input value={form.tax_id} onChange={(e) => updateField("tax_id", e.target.value)} disabled={!canEdit} required className="uppercase" /></Field></div>
            </Section>

            <Section title="Payout account" icon={<Landmark className="h-5 w-5" />} description="These bank details are stored with your application for verification.">
              <div className="grid gap-5 md:grid-cols-2"><Field label="Account holder name" error={errors.account_holder_name}><Input value={form.account_holder_name} onChange={(e) => updateField("account_holder_name", e.target.value)} disabled={!canEdit} required /></Field><Field label="Bank name" error={errors.bank_name}><Input value={form.bank_name} onChange={(e) => updateField("bank_name", e.target.value)} disabled={!canEdit} required /></Field><Field label="Account number" error={errors.account_number}><Input value={form.account_number} onChange={(e) => updateField("account_number", e.target.value)} disabled={!canEdit} required /></Field><Field label="IFSC code" error={errors.ifsc_code}><Input value={form.ifsc_code} onChange={(e) => updateField("ifsc_code", e.target.value.toUpperCase())} disabled={!canEdit} required className="uppercase" /></Field></div>
            </Section>

            {canEdit && <div className="flex flex-col gap-3 rounded-3xl border border-[#A68D65]/20 bg-white p-5 sm:flex-row sm:items-center sm:justify-between"><div className="flex gap-3 text-sm text-slate-600"><ShieldCheck className="h-5 w-5 flex-none text-[#33381C]" /><p>By submitting, you confirm that the business and bank details are accurate.</p></div><Button type="submit" disabled={submitting} className="rounded-xl bg-[#33381C] hover:bg-[#262A14]">{submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}{application ? "Resubmit application" : "Submit application"}</Button></div>}
          </div>

          <aside className="h-fit space-y-5 lg:sticky lg:top-6"><section className="rounded-[1.75rem] border border-[#A68D65]/20 bg-white p-6 shadow-sm"><div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#F7EEE4] text-[#33381C]"><CheckCircle2 className="h-6 w-6" /></div><p className="mt-5 text-xs font-bold uppercase tracking-[0.16em] text-[#A68D65]">Application readiness</p><p className="mt-1 text-3xl font-bold text-[#33381C]">{completion}%</p><div className="mt-4 h-2 overflow-hidden rounded-full bg-[#E7E9DD]"><div className="h-full rounded-full bg-[#33381C] transition-all" style={{ width: `${completion}%` }} /></div><p className="mt-5 text-sm leading-6 text-slate-600">Complete your business and payout details, then submit once. You will be taken to the review page immediately.</p></section><section className="rounded-[1.75rem] border border-[#A68D65]/15 bg-[#F7EEE4]/60 p-6"><h2 className="font-bold text-[#33381C]">Account</h2><p className="mt-2 text-sm text-slate-600">{profile?.full_name || user?.email || "Seller account"}</p><p className="mt-1 text-xs text-slate-500">{user?.email}</p></section></aside>
        </form>
      </main>
      <Footer />
    </div>
  );
}

function Section({ title, icon, description, children }: { title: string; icon: React.ReactNode; description: string; children: React.ReactNode }) {
  return <section className="rounded-[1.75rem] border border-[#A68D65]/15 bg-white p-6 shadow-sm md:p-8"><div className="flex gap-3"><div className="rounded-2xl bg-[#F7EEE4] p-3 text-[#33381C]">{icon}</div><div><h2 className="text-xl font-bold text-[#33381C]">{title}</h2><p className="mt-1 text-sm text-slate-500">{description}</p></div></div><div className="mt-7">{children}</div></section>;
}

function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return <div className="space-y-1.5"><Label className="text-xs font-bold text-neutral-700">{label} <span className="text-red-600">*</span></Label>{children}{error && <p className="text-xs font-medium text-red-600">{error}</p>}</div>;
}
