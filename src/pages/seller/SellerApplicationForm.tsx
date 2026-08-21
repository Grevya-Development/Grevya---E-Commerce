import { FormEvent, ReactNode, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  ArrowRight,
  Building2,
  Check,
  CheckCircle2,
  ChevronRight,
  CircleHelp,
  Home,
  Landmark,
  Loader2,
  MapPin,
  Save,
  Send,
  ShieldCheck,
  Store,
  UserRound,
  Warehouse,
} from "lucide-react";

import { supabase } from "@/lib/supabaseClient";
import { useAuth } from "@/context/AuthContext";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";

type ApplicationStatus =
  | "pending"
  | "under_review"
  | "approved"
  | "rejected";

type SellerApplication = {
  id: string;
  user_id: string;
  status: ApplicationStatus;
  rejection_reason: string | null;
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
  // Existing database-backed fields
  company_name: string;
  business_type: string;
  registration_number: string;
  tax_id: string;
  account_holder_name: string;
  bank_name: string;
  account_number: string;
  ifsc_code: string;

  // New UI fields — not persisted yet
  contact_person: string;
  business_email: string;
  business_phone: string;

  trade_name: string;
  pan_number: string;
  year_established: string;
  business_description: string;

  registered_address_line_1: string;
  registered_address_line_2: string;
  registered_landmark: string;
  registered_city: string;
  registered_state: string;
  registered_pincode: string;
  registered_country: string;

  pickup_same_as_registered: boolean;
  pickup_address_line_1: string;
  pickup_address_line_2: string;
  pickup_landmark: string;
  pickup_city: string;
  pickup_state: string;
  pickup_pincode: string;
  pickup_country: string;
  warehouse_name: string;

  store_name: string;
  store_slug: string;
  store_description: string;
  support_email: string;
  support_phone: string;

  fulfillment_method: string;
  processing_time: string;
  return_handling: string;

  declaration: boolean;
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

  contact_person: "",
  business_email: "",
  business_phone: "",

  trade_name: "",
  pan_number: "",
  year_established: "",
  business_description: "",

  registered_address_line_1: "",
  registered_address_line_2: "",
  registered_landmark: "",
  registered_city: "",
  registered_state: "",
  registered_pincode: "",
  registered_country: "India",

  pickup_same_as_registered: true,
  pickup_address_line_1: "",
  pickup_address_line_2: "",
  pickup_landmark: "",
  pickup_city: "",
  pickup_state: "",
  pickup_pincode: "",
  pickup_country: "India",
  warehouse_name: "",

  store_name: "",
  store_slug: "",
  store_description: "",
  support_email: "",
  support_phone: "",

  fulfillment_method: "",
  processing_time: "",
  return_handling: "",

  declaration: false,
};

const businessTypes = [
  "Sole proprietorship",
  "Partnership",
  "Private limited company",
  "LLP",
  "Co-operative",
  "Other",
];

const steps = [
  {
    id: 1,
    title: "Business & Contact",
    shortTitle: "Business",
    icon: UserRound,
  },
  {
    id: 2,
    title: "Business & Tax",
    shortTitle: "Details",
    icon: Building2,
  },
  {
    id: 3,
    title: "Business Address",
    shortTitle: "Address",
    icon: Home,
  },
  {
    id: 4,
    title: "Pickup / Warehouse",
    shortTitle: "Pickup",
    icon: Warehouse,
  },
  {
    id: 5,
    title: "Bank & Store",
    shortTitle: "Bank & Store",
    icon: Landmark,
  },
  {
    id: 6,
    title: "Review & Submit",
    shortTitle: "Review",
    icon: CheckCircle2,
  },
];

export default function SellerApplicationForm() {
  const { user, profile } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();

  const [application, setApplication] =
    useState<SellerApplication | null>(null);

  const [form, setForm] = useState<FormValues>(emptyForm);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const [currentStep, setCurrentStep] = useState(1);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [reapplying, setReapplying] = useState(false);
  const submittingRef = useRef(false);

  const completion = useMemo(() => {
    const importantFields = [
      form.company_name,
      form.business_type,
      form.registration_number,
      form.tax_id,
      form.account_holder_name,
      form.bank_name,
      form.account_number,
      form.ifsc_code,
      form.contact_person,
      form.business_email,
      form.business_phone,
      form.trade_name,
      form.pan_number,
      form.registered_address_line_1,
      form.registered_city,
      form.registered_state,
      form.registered_pincode,
      form.store_name,
      form.store_slug,
      form.store_description,
      form.support_email,
      form.support_phone,
      form.fulfillment_method,
      form.processing_time,
      form.return_handling,
    ];

    const completed = importantFields.filter(
      (value) => typeof value === "string" && value.trim(),
    ).length;

    return Math.round((completed / importantFields.length) * 100);
  }, [form]);

  useEffect(() => {
    if (!user?.id) return;

    let cancelled = false;

    const loadApplication = async () => {
      setLoading(true);

      const { data, error } = await supabase
        .from("seller_applications")
        .select(
          "id, user_id, status, rejection_reason, company_name, business_type, registration_number, tax_id, bank_details",
        )
        .eq("user_id", user.id)
        .maybeSingle();

      if (cancelled) return;

      if (error) {
        toast({
          title: "Unable to load application",
          description: error.message,
          variant: "destructive",
        });
        setLoading(false);
        return;
      }

      const existing = data as SellerApplication | null;

      if (
        existing?.status === "pending" ||
        existing?.status === "under_review"
      ) {
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

        setForm((current) => ({
          ...current,

          company_name: existing.company_name || "",
          business_type: existing.business_type || "",
          registration_number: existing.registration_number || "",
          tax_id: existing.tax_id || "",

          account_holder_name: bank.account_holder_name || "",
          bank_name: bank.bank_name || "",
          account_number: bank.account_number || "",
          ifsc_code: bank.ifsc_code || "",
        }));
      } else {
        setForm((current) => ({
          ...current,
          business_email: user.email || "",
          support_email: user.email || "",
          contact_person: profile?.full_name || "",
          business_phone: profile?.phone || "",
          support_phone: profile?.phone || "",
        }));
      }

      setLoading(false);
    };

    void loadApplication();

    return () => {
      cancelled = true;
    };
  }, [navigate, profile?.full_name, profile?.phone, toast, user?.email, user?.id]);

  const updateField = <K extends keyof FormValues>(
    field: K,
    value: FormValues[K],
  ) => {
    setForm((current) => ({
      ...current,
      [field]: value,
    }));

    setErrors((current) => {
      const next = { ...current };
      delete next[field as string];
      return next;
    });
  };

  const validateStep = (step: number) => {
    const nextErrors: Record<string, string> = {};

    const required = (field: keyof FormValues, message = "This field is required.") => {
      const value = form[field];

      if (typeof value === "string" && !value.trim()) {
        nextErrors[field] = message;
      }
    };

    if (step === 1) {
      required("company_name", "Enter your legal business name.");
      required("business_type", "Select your business type.");
      required("contact_person", "Enter the primary contact person.");
      required("business_email", "Enter your business email.");
      required("business_phone", "Enter your business phone number.");

      if (
        form.business_email.trim() &&
        !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.business_email.trim())
      ) {
        nextErrors.business_email = "Enter a valid email address.";
      }
    }

    if (step === 2) {
      required("registration_number", "Enter your registration number.");
      required("tax_id", "Enter your GSTIN / tax ID.");
      required("pan_number", "Enter your PAN number.");
      required("trade_name", "Enter your trade or brand name.");
      required("year_established", "Enter the year your business was established.");

      if (
        form.pan_number.trim() &&
        !/^[A-Z]{5}[0-9]{4}[A-Z]$/i.test(form.pan_number.trim())
      ) {
        nextErrors.pan_number = "Enter a valid PAN number.";
      }

      if (
        form.tax_id.trim() &&
        form.tax_id.trim().length < 10
      ) {
        nextErrors.tax_id = "Enter a valid GSTIN / tax ID.";
      }
    }

    if (step === 3) {
      required(
        "registered_address_line_1",
        "Enter your registered business address.",
      );
      required("registered_city", "Enter your city.");
      required("registered_state", "Enter your state.");
      required("registered_pincode", "Enter your pincode.");
      required("registered_country", "Enter your country.");

      if (
        form.registered_pincode.trim() &&
        !/^\d{6}$/.test(form.registered_pincode.trim())
      ) {
        nextErrors.registered_pincode = "Enter a valid 6-digit pincode.";
      }
    }

    if (step === 4) {
      if (!form.pickup_same_as_registered) {
        required(
          "pickup_address_line_1",
          "Enter your pickup address.",
        );
        required("pickup_city", "Enter your pickup city.");
        required("pickup_state", "Enter your pickup state.");
        required("pickup_pincode", "Enter your pickup pincode.");
        required("pickup_country", "Enter your pickup country.");

        if (
          form.pickup_pincode.trim() &&
          !/^\d{6}$/.test(form.pickup_pincode.trim())
        ) {
          nextErrors.pickup_pincode = "Enter a valid 6-digit pincode.";
        }
      }
    }

    if (step === 5) {
      required("account_holder_name", "Enter the account holder name.");
      required("bank_name", "Enter the bank name.");
      required("account_number", "Enter the account number.");
      required("ifsc_code", "Enter the IFSC code.");

      required("store_name", "Enter your store name.");
      required("store_slug", "Enter your store URL.");
      required("store_description", "Describe your store.");
      required("support_email", "Enter your support email.");
      required("support_phone", "Enter your support phone.");

      if (
        form.ifsc_code.trim() &&
        !/^[A-Z]{4}0[A-Z0-9]{6}$/i.test(form.ifsc_code.trim())
      ) {
        nextErrors.ifsc_code =
          "Enter a valid 11-character IFSC code.";
      }

      if (
        form.support_email.trim() &&
        !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.support_email.trim())
      ) {
        nextErrors.support_email = "Enter a valid support email.";
      }

      if (
        form.store_slug.trim() &&
        !/^[a-z0-9]+(?:-[a-z0-9]+)*$/i.test(form.store_slug.trim())
      ) {
        nextErrors.store_slug =
          "Use letters, numbers and hyphens only.";
      }
    }

    if (step === 6) {
      if (!form.declaration) {
        nextErrors.declaration =
          "Please confirm that the information provided is accurate.";
      }
    }

    setErrors(nextErrors);

    return Object.keys(nextErrors).length === 0;
  };

  const goNext = () => {
    if (!validateStep(currentStep)) {
      return;
    }

    setCurrentStep((step) => Math.min(step + 1, steps.length));
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const goBack = () => {
    setCurrentStep((step) => Math.max(step - 1, 1));
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const goToStep = (step: number) => {
    if (step < currentStep) {
      setCurrentStep(step);
      setErrors({});
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

 const handleSubmit = async (event: FormEvent) => {
  event.preventDefault();

  if (!user?.id) return;

  if (!validateStep(6)) {
    return;
  }

  if (submittingRef.current) return;

  submittingRef.current = true;
  setSubmitting(true);

  try {
    // ---------------------------------------------------------
    // 1. Save the main seller application
    // ---------------------------------------------------------
    const payload = {
      user_id: user.id,

      company_name: form.company_name.trim(),
      business_type: form.business_type,
      registration_number: form.registration_number.trim(),
      tax_id: form.tax_id.trim().toUpperCase(),

      // New business/contact fields
      contact_person: form.contact_person.trim(),
      business_email: form.business_email.trim(),
      business_phone: form.business_phone.trim(),
      trade_name: form.trade_name.trim(),
      pan_number: form.pan_number.trim().toUpperCase(),
      year_established: form.year_established
        ? Number(form.year_established)
        : null,
      business_description:
        form.business_description.trim() || null,

      // Declaration audit fields
      declaration_accepted_at: form.declaration
        ? new Date().toISOString()
        : null,
      declaration_version: form.declaration ? "v1" : null,

      // Existing bank_details JSONB
      bank_details: {
        account_holder_name: form.account_holder_name.trim(),
        bank_name: form.bank_name.trim(),
        account_number: form.account_number.trim(),
        ifsc_code: form.ifsc_code.trim().toUpperCase(),
      },
    };

    // ---------------------------------------------------------
    // 2. Insert or update seller application
    // ---------------------------------------------------------
    let applicationId = application?.id;

    if (applicationId) {
      const { error } = await supabase
        .from("seller_applications")
        .update(payload)
        .eq("id", applicationId)
        .eq("user_id", user.id);

      if (error) {
        throw error;
      }
    } else {
      const { data, error } = await supabase
        .from("seller_applications")
        .insert(payload)
        .select("id")
        .single();

      if (error) {
        throw error;
      }

      applicationId = data.id;
    }

    if (!applicationId) {
      throw new Error("Unable to determine application ID.");
    }
    const { error: statusError } = await supabase
  .from("seller_applications")
  .update({
    status: "pending",
    rejection_reason: null,
  })
  .eq("id", applicationId)
  .eq("user_id", user.id);

if (statusError) {
  throw statusError;
}
    // ---------------------------------------------------------
    // 3. Save REGISTERED address
    // ---------------------------------------------------------
    const { data: registeredAddress, error: registeredAddressError } =
      await supabase
        .from("seller_application_addresses")
        .upsert(
          {
            application_id: applicationId,
            address_type: "registered",
            address_line_1: form.registered_address_line_1.trim(),
            address_line_2:
              form.registered_address_line_2.trim() || null,
            landmark: form.registered_landmark.trim() || null,
            city: form.registered_city.trim(),
            state: form.registered_state.trim(),
            pincode: form.registered_pincode.trim(),
            country: form.registered_country.trim(),
          },
          {
            onConflict: "application_id,address_type",
          },
        )
        .select("id")
        .single();

    if (registeredAddressError) {
      throw registeredAddressError;
    }

   // ---------------------------------------------------------
// 4. Save PICKUP address
// ---------------------------------------------------------
let pickupAddressId: string | null = null;

if (!form.pickup_same_as_registered) {
  const { data: pickupAddress, error: pickupAddressError } =
    await supabase
      .from("seller_application_addresses")
      .upsert(
        {
          application_id: applicationId,
          address_type: "pickup",
          address_line_1: form.pickup_address_line_1.trim(),
          address_line_2:
            form.pickup_address_line_2.trim() || null,
          landmark: form.pickup_landmark.trim() || null,
          city: form.pickup_city.trim(),
          state: form.pickup_state.trim(),
          pincode: form.pickup_pincode.trim(),
          country: form.pickup_country.trim(),
        },
        {
          onConflict: "application_id,address_type",
        },
      )
      .select("id")
      .single();

  if (pickupAddressError) {
    throw pickupAddressError;
  }

  pickupAddressId = pickupAddress.id;
}
    // ---------------------------------------------------------
    // 5. Save warehouse / pickup configuration
    // ---------------------------------------------------------
    const { error: warehouseError } = await supabase
      .from("seller_application_warehouses")
      .upsert(
        {
          application_id: applicationId,
          warehouse_name:
            form.warehouse_name.trim() || null,
          pickup_same_as_registered:
            form.pickup_same_as_registered,
          pickup_address_id: pickupAddressId,
          is_primary: true,
        },
        {
          onConflict: "application_id",
        },
      );

    if (warehouseError) {
      throw warehouseError;
    }

    // ---------------------------------------------------------
    // 6. Save storefront + fulfillment configuration
    // ---------------------------------------------------------
    const { error: storefrontError } = await supabase
      .from("seller_application_storefronts")
      .upsert(
        {
          application_id: applicationId,
          store_name: form.store_name.trim(),
          store_slug: form.store_slug.trim().toLowerCase(),
          store_description: form.store_description.trim(),
          support_email: form.support_email.trim(),
          support_phone: form.support_phone.trim(),
          fulfillment_method: form.fulfillment_method,
          processing_time: form.processing_time,
          return_handling: form.return_handling,
        },
        {
          onConflict: "application_id",
        },
      );

    if (storefrontError) {
      throw storefrontError;
    }

    // ---------------------------------------------------------
    // 7. Mark the application as pending only after ALL
    //    application data has been saved successfully.
    //    This is especially important for rejected applications
    //    that are being resubmitted.
    // ---------------------------------------------------------
   

    setApplication((current) =>
      current
        ? { ...current, status: "pending", rejection_reason: null }
        : current,
    );

    // ---------------------------------------------------------
    // 8. Success
    // ---------------------------------------------------------
    toast({
      title: "Application submitted",
      description:
        "Your complete seller application is now awaiting review.",
    });

    navigate("/seller/onboarding", { replace: true });
  } catch (error: any) {
    console.error(
      "Seller application submission failed:",
      error,
    );

    toast({
      title: "Application not submitted",
      description:
        error?.message ||
        "Something went wrong while saving your application.",
      variant: "destructive",
    });
  } finally {
    submittingRef.current = false;
    setSubmitting(false);
  }
};

  const startReapplication = () => {
    setReapplying(true);
    setCurrentStep(1);
    setErrors({});

    toast({
      title: "Application reopened",
      description:
        "Update your details and submit them for a new review.",
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F7EEE4]/20 text-[#33381C]">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  const isRejected = application?.status === "rejected";
  const rejectionReason = application?.rejection_reason?.trim();
  const canEdit = !application || (isRejected && reapplying);

  return (
    <div className="flex min-h-screen flex-col bg-[#F7EEE4]/20">
      <Navbar />

      <main className="flex-1 px-4 py-8 md:py-12">
        <div className="mx-auto max-w-7xl">
          {/* Header */}
          <div className="mb-8">
            <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#A68D65]">
                  Grevya Marketplace
                </p>

                <h1 className="mt-2 font-serif text-3xl font-bold text-[#33381C] md:text-4xl">
                  Become a Grevya Seller
                </h1>

                <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
                  Complete your seller profile and business information.
                  This information will be reviewed before your seller
                  account is activated.
                </p>
              </div>

              <div className="flex items-center gap-2 rounded-full border border-[#A68D65]/20 bg-white px-4 py-2 text-xs font-semibold text-slate-600 shadow-sm">
                <ShieldCheck className="h-4 w-4 text-[#33381C]" />
                Secure application
              </div>
            </div>
          </div>

          {/* Rejected application */}
          {isRejected && !reapplying && (
            <div className="mb-6 rounded-2xl border border-red-200 bg-red-50 p-5">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="font-bold text-red-800">
                    Your previous application was not approved.
                  </p>

                  {rejectionReason && (
                    <div className="mt-4 rounded-xl border border-red-200 bg-white/80 p-4">
                      <p className="text-xs font-bold uppercase tracking-wider text-red-800">
                        Reason for rejection
                      </p>
                      <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-red-700">
                        {rejectionReason}
                      </p>
                    </div>
                  )}

                  <p className="mt-1 text-sm text-red-700">
                    {rejectionReason
                      ? "Please review the reason above, update the relevant information, and submit your application again."
                      : "Review your information and submit an updated application for another review."}
                  </p>
                </div>

                <Button
                  type="button"
                  onClick={startReapplication}
                  className="rounded-xl bg-[#33381C] hover:bg-[#262A14]"
                >
                  Reapply
                </Button>
              </div>
            </div>
          )}

          {/* Progress */}
          <div className="mb-6 overflow-hidden rounded-3xl border border-[#A68D65]/20 bg-white shadow-sm">
            <div className="border-b border-[#A68D65]/10 px-5 py-4 md:px-7">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider text-[#A68D65]">
                    Application progress
                  </p>

                  <p className="mt-1 text-sm font-semibold text-[#33381C]">
                    Step {currentStep} of {steps.length}
                  </p>
                </div>

                <div className="text-right">
                  <p className="text-2xl font-bold text-[#33381C]">
                    {completion}%
                  </p>
                </div>
              </div>

              <div className="mt-4 h-2 overflow-hidden rounded-full bg-[#E7E9DD]">
                <div
                  className="h-full rounded-full bg-[#33381C] transition-all duration-500"
                  style={{
                    width: `${Math.max(
                      ((currentStep - 1) / (steps.length - 1)) * 100,
                      completion,
                    )}%`,
                  }}
                />
              </div>
            </div>

            <div className="hidden overflow-x-auto px-5 py-5 md:block">
              <div className="flex min-w-[800px] items-center justify-between">
                {steps.map((step, index) => {
                  const Icon = step.icon;
                  const completed = step.id < currentStep;
                  const active = step.id === currentStep;

                  return (
                    <div
                      key={step.id}
                      className="flex flex-1 items-center"
                    >
                      <button
                        type="button"
                        onClick={() => goToStep(step.id)}
                        disabled={step.id > currentStep}
                        className={`flex items-center gap-3 ${
                          step.id <= currentStep
                            ? "cursor-pointer"
                            : "cursor-default"
                        }`}
                      >
                        <span
                          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-2 transition-all ${
                            completed
                              ? "border-[#33381C] bg-[#33381C] text-white"
                              : active
                                ? "border-[#33381C] bg-[#F7EEE4] text-[#33381C]"
                                : "border-slate-200 bg-white text-slate-400"
                          }`}
                        >
                          {completed ? (
                            <Check className="h-4 w-4" />
                          ) : (
                            <Icon className="h-4 w-4" />
                          )}
                        </span>

                        <span className="text-left">
                          <span
                            className={`block text-[10px] font-bold uppercase tracking-wider ${
                              active || completed
                                ? "text-[#33381C]"
                                : "text-slate-400"
                            }`}
                          >
                            Step {step.id}
                          </span>

                          <span
                            className={`block text-xs font-semibold ${
                              active
                                ? "text-[#33381C]"
                                : "text-slate-500"
                            }`}
                          >
                            {step.title}
                          </span>
                        </span>
                      </button>

                      {index < steps.length - 1 && (
                        <div className="mx-4 h-px flex-1 bg-slate-200" />
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Mobile step indicator */}
            <div className="flex items-center gap-3 px-5 py-4 md:hidden">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#33381C] text-sm font-bold text-white">
                {currentStep}
              </div>

              <div className="min-w-0 flex-1">
                <p className="text-[10px] font-bold uppercase tracking-wider text-[#A68D65]">
                  Current step
                </p>

                <p className="truncate text-sm font-bold text-[#33381C]">
                  {steps[currentStep - 1].title}
                </p>
              </div>

              <ChevronRight className="h-5 w-5 text-slate-300" />
            </div>
          </div>

          <form onSubmit={handleSubmit}>
            <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
              {/* Main content */}
              <div className="min-w-0">
                {/* STEP 1 */}
                {currentStep === 1 && (
                  <StepCard
                    icon={<UserRound className="h-5 w-5" />}
                    eyebrow="Step 1"
                    title="Business & Contact Information"
                    description="Tell us who you are and how we can contact your business."
                  >
                    <div className="grid gap-5 md:grid-cols-2">
                      <Field
                        label="Legal Business Name"
                        required
                        error={errors.company_name}
                        hint="Name registered for your business."
                      >
                        <Input
                          value={form.company_name}
                          onChange={(e) =>
                            updateField(
                              "company_name",
                              e.target.value,
                            )
                          }
                          disabled={!canEdit}
                          placeholder="e.g. Grevya Naturals Pvt Ltd"
                        />
                      </Field>

                      <Field
                        label="Business Type"
                        required
                        error={errors.business_type}
                      >
                        <select
                          value={form.business_type}
                          onChange={(e) =>
                            updateField(
                              "business_type",
                              e.target.value,
                            )
                          }
                          disabled={!canEdit}
                          className="h-10 w-full rounded-xl border border-[#A68D65]/35 bg-white px-3 text-sm outline-none focus:border-[#33381C] disabled:cursor-not-allowed disabled:bg-slate-50"
                        >
                          <option value="">
                            Select business type
                          </option>

                          {businessTypes.map((type) => (
                            <option key={type} value={type}>
                              {type}
                            </option>
                          ))}
                        </select>
                      </Field>

                      <Field
                        label="Primary Contact Person"
                        required
                        error={errors.contact_person}
                      >
                        <Input
                          value={form.contact_person}
                          onChange={(e) =>
                            updateField(
                              "contact_person",
                              e.target.value,
                            )
                          }
                          disabled={!canEdit}
                          placeholder="Full name"
                        />
                      </Field>

                      <Field
                        label="Business Email"
                        required
                        error={errors.business_email}
                      >
                        <Input
                          type="email"
                          value={form.business_email}
                          onChange={(e) =>
                            updateField(
                              "business_email",
                              e.target.value,
                            )
                          }
                          disabled={!canEdit}
                          placeholder="business@example.com"
                        />
                      </Field>

                      <Field
                        label="Business Phone"
                        required
                        error={errors.business_phone}
                      >
                        <Input
                          type="tel"
                          value={form.business_phone}
                          onChange={(e) =>
                            updateField(
                              "business_phone",
                              e.target.value,
                            )
                          }
                          disabled={!canEdit}
                          placeholder="+91 XXXXX XXXXX"
                        />
                      </Field>
                    </div>

                    <InfoBox>
                      <CircleHelp className="h-4 w-4 shrink-0 text-[#33381C]" />
                      <p>
                        Use your legal business information wherever
                        possible. It may be used during verification.
                      </p>
                    </InfoBox>
                  </StepCard>
                )}

                {/* STEP 2 */}
                {currentStep === 2 && (
                  <StepCard
                    icon={<Building2 className="h-5 w-5" />}
                    eyebrow="Step 2"
                    title="Business & Tax Details"
                    description="Provide your legal registration and tax information."
                  >
                    <div className="grid gap-5 md:grid-cols-2">
                      <Field
                        label="Trade / Brand Name"
                        required
                        error={errors.trade_name}
                      >
                        <Input
                          value={form.trade_name}
                          onChange={(e) =>
                            updateField(
                              "trade_name",
                              e.target.value,
                            )
                          }
                          disabled={!canEdit}
                          placeholder="Name customers will see"
                        />
                      </Field>

                      <Field
                        label="Registration Number"
                        required
                        error={errors.registration_number}
                      >
                        <Input
                          value={form.registration_number}
                          onChange={(e) =>
                            updateField(
                              "registration_number",
                              e.target.value,
                            )
                          }
                          disabled={!canEdit}
                          placeholder="Business registration number"
                        />
                      </Field>

                      <Field
                        label="GSTIN / Tax ID"
                        required
                        error={errors.tax_id}
                      >
                        <Input
                          value={form.tax_id}
                          onChange={(e) =>
                            updateField(
                              "tax_id",
                              e.target.value.toUpperCase(),
                            )
                          }
                          disabled={!canEdit}
                          className="uppercase"
                          placeholder="GSTIN"
                        />
                      </Field>

                      <Field
                        label="PAN"
                        required
                        error={errors.pan_number}
                      >
                        <Input
                          value={form.pan_number}
                          onChange={(e) =>
                            updateField(
                              "pan_number",
                              e.target.value.toUpperCase(),
                            )
                          }
                          disabled={!canEdit}
                          className="uppercase"
                          placeholder="ABCDE1234F"
                        />
                      </Field>

                      <Field
                        label="Year Established"
                        required
                        error={errors.year_established}
                      >
                        <Input
                          type="number"
                          min="1900"
                          max={new Date().getFullYear()}
                          value={form.year_established}
                          onChange={(e) =>
                            updateField(
                              "year_established",
                              e.target.value,
                            )
                          }
                          disabled={!canEdit}
                          placeholder="e.g. 2020"
                        />
                      </Field>

                      <div className="md:col-span-2">
                        <Field
                          label="Business Description"
                          error={errors.business_description}
                        >
                          <Textarea
                            value={form.business_description}
                            onChange={(e) =>
                              updateField(
                                "business_description",
                                e.target.value,
                              )
                            }
                            disabled={!canEdit}
                            placeholder="Tell us briefly about your business, products and sourcing."
                            className="min-h-[120px] rounded-xl"
                          />
                        </Field>
                      </div>
                    </div>
                  </StepCard>
                )}

                {/* STEP 3 */}
                {currentStep === 3 && (
                  <StepCard
                    icon={<Home className="h-5 w-5" />}
                    eyebrow="Step 3"
                    title="Registered Business Address"
                    description="Enter the address associated with your registered business."
                  >
                    <div className="grid gap-5 md:grid-cols-2">
                      <div className="md:col-span-2">
                        <Field
                          label="Address Line 1"
                          required
                          error={errors.registered_address_line_1}
                        >
                          <Input
                            value={form.registered_address_line_1}
                            onChange={(e) =>
                              updateField(
                                "registered_address_line_1",
                                e.target.value,
                              )
                            }
                            disabled={!canEdit}
                            placeholder="Building, street and area"
                          />
                        </Field>
                      </div>

                      <Field label="Address Line 2">
                        <Input
                          value={form.registered_address_line_2}
                          onChange={(e) =>
                            updateField(
                              "registered_address_line_2",
                              e.target.value,
                            )
                          }
                          disabled={!canEdit}
                          placeholder="Apartment, suite, etc."
                        />
                      </Field>

                      <Field label="Landmark">
                        <Input
                          value={form.registered_landmark}
                          onChange={(e) =>
                            updateField(
                              "registered_landmark",
                              e.target.value,
                            )
                          }
                          disabled={!canEdit}
                          placeholder="Nearby landmark"
                        />
                      </Field>

                      <Field
                        label="City"
                        required
                        error={errors.registered_city}
                      >
                        <Input
                          value={form.registered_city}
                          onChange={(e) =>
                            updateField(
                              "registered_city",
                              e.target.value,
                            )
                          }
                          disabled={!canEdit}
                          placeholder="City"
                        />
                      </Field>

                      <Field
                        label="State"
                        required
                        error={errors.registered_state}
                      >
                        <Input
                          value={form.registered_state}
                          onChange={(e) =>
                            updateField(
                              "registered_state",
                              e.target.value,
                            )
                          }
                          disabled={!canEdit}
                          placeholder="State"
                        />
                      </Field>

                      <Field
                        label="Pincode"
                        required
                        error={errors.registered_pincode}
                      >
                        <Input
                          inputMode="numeric"
                          maxLength={6}
                          value={form.registered_pincode}
                          onChange={(e) =>
                            updateField(
                              "registered_pincode",
                              e.target.value.replace(/\D/g, ""),
                            )
                          }
                          disabled={!canEdit}
                          placeholder="641001"
                        />
                      </Field>

                      <Field
                        label="Country"
                        required
                        error={errors.registered_country}
                      >
                        <Input
                          value={form.registered_country}
                          onChange={(e) =>
                            updateField(
                              "registered_country",
                              e.target.value,
                            )
                          }
                          disabled={!canEdit}
                        />
                      </Field>
                    </div>
                  </StepCard>
                )}

                {/* STEP 4 */}
                {currentStep === 4 && (
                  <StepCard
                    icon={<Warehouse className="h-5 w-5" />}
                    eyebrow="Step 4"
                    title="Pickup & Warehouse"
                    description="Tell us where orders will be picked up and prepared for shipment."
                  >
                    <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-[#A68D65]/20 bg-[#F7EEE4]/50 p-4">
                      <input
                        type="checkbox"
                        checked={form.pickup_same_as_registered}
                        onChange={(e) =>
                          updateField(
                            "pickup_same_as_registered",
                            e.target.checked,
                          )
                        }
                        disabled={!canEdit}
                        className="mt-1 h-4 w-4 accent-[#33381C]"
                      />

                      <span>
                        <span className="block text-sm font-bold text-[#33381C]">
                          Pickup address is the same as registered address
                        </span>

                        <span className="mt-1 block text-xs text-slate-500">
                          Use this option if orders will be dispatched from
                          your registered business location.
                        </span>
                      </span>
                    </label>

                    <div className="mt-6">
                      <Field label="Warehouse / Pickup Location Name">
                        <Input
                          value={form.warehouse_name}
                          onChange={(e) =>
                            updateField(
                              "warehouse_name",
                              e.target.value,
                            )
                          }
                          disabled={!canEdit}
                          placeholder="e.g. Grevya Main Warehouse"
                        />
                      </Field>
                    </div>

                    {!form.pickup_same_as_registered && (
                      <div className="mt-6 grid gap-5 md:grid-cols-2">
                        <div className="md:col-span-2">
                          <Field
                            label="Pickup Address Line 1"
                            required
                            error={errors.pickup_address_line_1}
                          >
                            <Input
                              value={form.pickup_address_line_1}
                              onChange={(e) =>
                                updateField(
                                  "pickup_address_line_1",
                                  e.target.value,
                                )
                              }
                              disabled={!canEdit}
                              placeholder="Building, street and area"
                            />
                          </Field>
                        </div>

                        <Field label="Address Line 2">
                          <Input
                            value={form.pickup_address_line_2}
                            onChange={(e) =>
                              updateField(
                                "pickup_address_line_2",
                                e.target.value,
                              )
                            }
                            disabled={!canEdit}
                          />
                        </Field>

                        <Field label="Landmark">
                          <Input
                            value={form.pickup_landmark}
                            onChange={(e) =>
                              updateField(
                                "pickup_landmark",
                                e.target.value,
                              )
                            }
                            disabled={!canEdit}
                          />
                        </Field>

                        <Field
                          label="City"
                          required
                          error={errors.pickup_city}
                        >
                          <Input
                            value={form.pickup_city}
                            onChange={(e) =>
                              updateField(
                                "pickup_city",
                                e.target.value,
                              )
                            }
                            disabled={!canEdit}
                          />
                        </Field>

                        <Field
                          label="State"
                          required
                          error={errors.pickup_state}
                        >
                          <Input
                            value={form.pickup_state}
                            onChange={(e) =>
                              updateField(
                                "pickup_state",
                                e.target.value,
                              )
                            }
                            disabled={!canEdit}
                          />
                        </Field>

                        <Field
                          label="Pincode"
                          required
                          error={errors.pickup_pincode}
                        >
                          <Input
                            inputMode="numeric"
                            maxLength={6}
                            value={form.pickup_pincode}
                            onChange={(e) =>
                              updateField(
                                "pickup_pincode",
                                e.target.value.replace(/\D/g, ""),
                              )
                            }
                            disabled={!canEdit}
                          />
                        </Field>

                        <Field
                          label="Country"
                          required
                          error={errors.pickup_country}
                        >
                          <Input
                            value={form.pickup_country}
                            onChange={(e) =>
                              updateField(
                                "pickup_country",
                                e.target.value,
                              )
                            }
                            disabled={!canEdit}
                          />
                        </Field>
                      </div>
                    )}

                    <InfoBox>
                      <MapPin className="h-4 w-4 shrink-0 text-[#33381C]" />
                      <p>
                        Pickup and warehouse information is currently
                        collected as part of the onboarding experience.
                      </p>
                    </InfoBox>
                  </StepCard>
                )}

                {/* STEP 5 */}
                {currentStep === 5 && (
                  <div className="space-y-6">
                    <StepCard
                      icon={<Landmark className="h-5 w-5" />}
                      eyebrow="Step 5"
                      title="Bank & Payout Information"
                      description="Provide the account where your marketplace payouts will be received."
                    >
                      <div className="grid gap-5 md:grid-cols-2">
                        <Field
                          label="Account Holder Name"
                          required
                          error={errors.account_holder_name}
                        >
                          <Input
                            value={form.account_holder_name}
                            onChange={(e) =>
                              updateField(
                                "account_holder_name",
                                e.target.value,
                              )
                            }
                            disabled={!canEdit}
                          />
                        </Field>

                        <Field
                          label="Bank Name"
                          required
                          error={errors.bank_name}
                        >
                          <Input
                            value={form.bank_name}
                            onChange={(e) =>
                              updateField(
                                "bank_name",
                                e.target.value,
                              )
                            }
                            disabled={!canEdit}
                          />
                        </Field>

                        <Field
                          label="Account Number"
                          required
                          error={errors.account_number}
                        >
                          <Input
                            type="password"
                            value={form.account_number}
                            onChange={(e) =>
                              updateField(
                                "account_number",
                                e.target.value.replace(/\s/g, ""),
                              )
                            }
                            disabled={!canEdit}
                            autoComplete="off"
                          />
                        </Field>

                        <Field
                          label="IFSC Code"
                          required
                          error={errors.ifsc_code}
                        >
                          <Input
                            value={form.ifsc_code}
                            onChange={(e) =>
                              updateField(
                                "ifsc_code",
                                e.target.value.toUpperCase(),
                              )
                            }
                            disabled={!canEdit}
                            className="uppercase"
                            maxLength={11}
                            placeholder="ABCD0123456"
                          />
                        </Field>
                      </div>

                      <InfoBox>
                        <ShieldCheck className="h-4 w-4 shrink-0 text-[#33381C]" />
                        <p>
                          Bank information is used for seller verification
                          and payouts. Only the information currently
                          supported by the existing application database
                          will be submitted.
                        </p>
                      </InfoBox>
                    </StepCard>

                    <StepCard
                      icon={<Store className="h-5 w-5" />}
                      eyebrow="Store setup"
                      title="Create Your Store"
                      description="Tell customers what your marketplace store represents."
                    >
                      <div className="grid gap-5 md:grid-cols-2">
                        <Field
                          label="Store Name"
                          required
                          error={errors.store_name}
                        >
                          <Input
                            value={form.store_name}
                            onChange={(e) =>
                              updateField(
                                "store_name",
                                e.target.value,
                              )
                            }
                            disabled={!canEdit}
                            placeholder="Your customer-facing store name"
                          />
                        </Field>

                        <Field
                          label="Store URL"
                          required
                          error={errors.store_slug}
                          hint="Example: grevya-naturals"
                        >
                          <div className="flex h-10 overflow-hidden rounded-xl border border-[#A68D65]/35">
                            <span className="flex items-center bg-slate-50 px-3 text-xs text-slate-400">
                              grevya.com/store/
                            </span>

                            <input
                              value={form.store_slug}
                              onChange={(e) =>
                                updateField(
                                  "store_slug",
                                  e.target.value
                                    .toLowerCase()
                                    .replace(/\s+/g, "-"),
                                )
                              }
                              disabled={!canEdit}
                              className="min-w-0 flex-1 px-3 text-sm outline-none"
                              placeholder="your-store"
                            />
                          </div>
                        </Field>

                        <div className="md:col-span-2">
                          <Field
                            label="Store Description"
                            required
                            error={errors.store_description}
                          >
                            <Textarea
                              value={form.store_description}
                              onChange={(e) =>
                                updateField(
                                  "store_description",
                                  e.target.value,
                                )
                              }
                              disabled={!canEdit}
                              className="min-h-[120px] rounded-xl"
                              placeholder="Describe your products, brand and what makes your store unique."
                            />
                          </Field>
                        </div>

                        <Field
                          label="Customer Support Email"
                          required
                          error={errors.support_email}
                        >
                          <Input
                            type="email"
                            value={form.support_email}
                            onChange={(e) =>
                              updateField(
                                "support_email",
                                e.target.value,
                              )
                            }
                            disabled={!canEdit}
                          />
                        </Field>

                        <Field
                          label="Customer Support Phone"
                          required
                          error={errors.support_phone}
                        >
                          <Input
                            type="tel"
                            value={form.support_phone}
                            onChange={(e) =>
                              updateField(
                                "support_phone",
                                e.target.value,
                              )
                            }
                            disabled={!canEdit}
                          />
                        </Field>
                      </div>
                    </StepCard>

                    <StepCard
                      icon={<Send className="h-5 w-5" />}
                      eyebrow="Fulfillment"
                      title="Fulfillment Preferences"
                      description="Tell us how you expect to process and handle marketplace orders."
                    >
                      <div className="grid gap-5 md:grid-cols-3">
                        <ChoiceCard
                          selected={
                            form.fulfillment_method ===
                            "self_fulfillment"
                          }
                          onClick={() =>
                            updateField(
                              "fulfillment_method",
                              "self_fulfillment",
                            )
                          }
                          disabled={!canEdit}
                          title="Self Fulfillment"
                          description="You pack and dispatch customer orders."
                        />

                        <ChoiceCard
                          selected={
                            form.fulfillment_method ===
                            "courier_partner"
                          }
                          onClick={() =>
                            updateField(
                              "fulfillment_method",
                              "courier_partner",
                            )
                          }
                          disabled={!canEdit}
                          title="Courier Partner"
                          description="Orders are dispatched through a courier partner."
                        />

                        <ChoiceCard
                          selected={
                            form.fulfillment_method === "both"
                          }
                          onClick={() =>
                            updateField("fulfillment_method", "both")
                          }
                          disabled={!canEdit}
                          title="Both"
                          description="Use multiple fulfillment methods."
                        />
                      </div>

                      <div className="mt-5 grid gap-5 md:grid-cols-2">
                        <Field label="Typical Processing Time">
                          <select
                            value={form.processing_time}
                            onChange={(e) =>
                              updateField(
                                "processing_time",
                                e.target.value,
                              )
                            }
                            disabled={!canEdit}
                            className="h-10 w-full rounded-xl border border-[#A68D65]/35 bg-white px-3 text-sm outline-none focus:border-[#33381C]"
                          >
                            <option value="">
                              Select processing time
                            </option>
                            <option value="same_day">
                              Same day
                            </option>
                            <option value="1_2_days">
                              1–2 business days
                            </option>
                            <option value="3_5_days">
                              3–5 business days
                            </option>
                            <option value="5_plus_days">
                              More than 5 days
                            </option>
                          </select>
                        </Field>

                        <Field label="Return Handling">
                          <select
                            value={form.return_handling}
                            onChange={(e) =>
                              updateField(
                                "return_handling",
                                e.target.value,
                              )
                            }
                            disabled={!canEdit}
                            className="h-10 w-full rounded-xl border border-[#A68D65]/35 bg-white px-3 text-sm outline-none focus:border-[#33381C]"
                          >
                            <option value="">
                              Select return preference
                            </option>
                            <option value="seller_managed">
                              Seller managed
                            </option>
                            <option value="marketplace_managed">
                              Marketplace managed
                            </option>
                            <option value="both">
                              Both
                            </option>
                          </select>
                        </Field>
                      </div>
                    </StepCard>
                  </div>
                )}

                {/* STEP 6 */}
                {currentStep === 6 && (
                  <StepCard
                    icon={<CheckCircle2 className="h-5 w-5" />}
                    eyebrow="Step 6"
                    title="Review & Submit"
                    description="Review the information you've provided before sending your application."
                  >
                    <div className="space-y-5">
                      <ReviewSection
                        title="Business & Contact"
                        step={1}
                        onEdit={() => goToStep(1)}
                      >
                        <ReviewItem
                          label="Legal Business Name"
                          value={form.company_name}
                        />

                        <ReviewItem
                          label="Business Type"
                          value={form.business_type}
                        />

                        <ReviewItem
                          label="Contact Person"
                          value={form.contact_person}
                        />

                        <ReviewItem
                          label="Business Email"
                          value={form.business_email}
                        />

                        <ReviewItem
                          label="Business Phone"
                          value={form.business_phone}
                        />
                      </ReviewSection>

                      <ReviewSection
                        title="Business & Tax"
                        step={2}
                        onEdit={() => goToStep(2)}
                      >
                        <ReviewItem
                          label="Trade / Brand Name"
                          value={form.trade_name}
                        />

                        <ReviewItem
                          label="Registration Number"
                          value={form.registration_number}
                        />

                        <ReviewItem
                          label="GSTIN"
                          value={form.tax_id}
                        />

                        <ReviewItem
                          label="PAN"
                          value={form.pan_number}
                        />

                        <ReviewItem
                          label="Year Established"
                          value={form.year_established}
                        />
                      </ReviewSection>

                      <ReviewSection
                        title="Registered Address"
                        step={3}
                        onEdit={() => goToStep(3)}
                      >
                        <div className="md:col-span-2">
                          <ReviewItem
                            label="Address"
                            value={[
                              form.registered_address_line_1,
                              form.registered_address_line_2,
                              form.registered_landmark,
                              form.registered_city,
                              form.registered_state,
                              form.registered_pincode,
                              form.registered_country,
                            ]
                              .filter(Boolean)
                              .join(", ")}
                          />
                        </div>
                      </ReviewSection>

                      <ReviewSection
                        title="Pickup / Warehouse"
                        step={4}
                        onEdit={() => goToStep(4)}
                      >
                        <ReviewItem
                          label="Pickup Address"
                          value={
                            form.pickup_same_as_registered
                              ? "Same as registered business address"
                              : [
                                  form.pickup_address_line_1,
                                  form.pickup_address_line_2,
                                  form.pickup_landmark,
                                  form.pickup_city,
                                  form.pickup_state,
                                  form.pickup_pincode,
                                ]
                                  .filter(Boolean)
                                  .join(", ")
                          }
                        />

                        <ReviewItem
                          label="Warehouse"
                          value={
                            form.warehouse_name ||
                            "Not specified"
                          }
                        />
                      </ReviewSection>

                      <ReviewSection
                        title="Bank & Store"
                        step={5}
                        onEdit={() => goToStep(5)}
                      >
                        <ReviewItem
                          label="Account Holder"
                          value={form.account_holder_name}
                        />

                        <ReviewItem
                          label="Bank"
                          value={form.bank_name}
                        />

                        <ReviewItem
                          label="Account Number"
                          value={maskAccountNumber(
                            form.account_number,
                          )}
                        />

                        <ReviewItem
                          label="IFSC"
                          value={form.ifsc_code}
                        />

                        <ReviewItem
                          label="Store Name"
                          value={form.store_name}
                        />

                        <ReviewItem
                          label="Store URL"
                          value={form.store_slug}
                        />

                        <ReviewItem
                          label="Support Email"
                          value={form.support_email}
                        />

                        <ReviewItem
                          label="Support Phone"
                          value={form.support_phone}
                        />
                      </ReviewSection>

                      <div className="rounded-2xl border border-[#A68D65]/20 bg-[#F7EEE4]/50 p-5">
                        <label className="flex cursor-pointer items-start gap-3">
                          <input
                            type="checkbox"
                            checked={form.declaration}
                            onChange={(e) =>
                              updateField(
                                "declaration",
                                e.target.checked,
                              )
                            }
                            disabled={!canEdit}
                            className="mt-1 h-4 w-4 accent-[#33381C]"
                          />

                          <span className="text-sm leading-6 text-slate-600">
                            I confirm that the information provided in
                            this application is accurate and complete,
                            and I understand that Grevya may review the
                            submitted information before approving my
                            seller account.
                          </span>
                        </label>

                        {errors.declaration && (
                          <p className="mt-2 text-xs font-semibold text-red-600">
                            {errors.declaration}
                          </p>
                        )}
                      </div>
                    </div>
                  </StepCard>
                )}

                {/* Navigation */}
                {canEdit && (
                  <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      {currentStep > 1 && (
                        <Button
                          type="button"
                          variant="outline"
                          onClick={goBack}
                          className="h-12 rounded-xl border-[#A68D65]/25 px-5"
                        >
                          <ArrowLeft className="mr-2 h-4 w-4" />
                          Back
                        </Button>
                      )}
                    </div>

                    {currentStep < steps.length ? (
                      <Button
                        type="button"
                        onClick={goNext}
                        className="h-12 rounded-xl bg-[#33381C] px-7 font-bold hover:bg-[#262A14]"
                      >
                        Save & Continue
                        <ArrowRight className="ml-2 h-4 w-4" />
                      </Button>
                    ) : (
                      <Button
                        type="submit"
                        disabled={submitting}
                        className="h-12 rounded-xl bg-[#33381C] px-7 font-bold hover:bg-[#262A14]"
                      >
                        {submitting ? (
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : (
                          <Send className="mr-2 h-4 w-4" />
                        )}

                        {application
                          ? "Resubmit Application"
                          : "Submit Application"}
                      </Button>
                    )}
                  </div>
                )}
              </div>

              {/* Sidebar */}
              <aside className="h-fit space-y-5 lg:sticky lg:top-6">
                <section className="rounded-[1.75rem] border border-[#A68D65]/20 bg-white p-6 shadow-sm">
                  <div className="flex items-center gap-3">
                    <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#F7EEE4] text-[#33381C]">
                      <CheckCircle2 className="h-5 w-5" />
                    </div>

                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-wider text-[#A68D65]">
                        Application readiness
                      </p>

                      <p className="text-2xl font-bold text-[#33381C]">
                        {completion}%
                      </p>
                    </div>
                  </div>

                  <div className="mt-5 h-2 overflow-hidden rounded-full bg-[#E7E9DD]">
                    <div
                      className="h-full rounded-full bg-[#33381C] transition-all"
                      style={{
                        width: `${completion}%`,
                      }}
                    />
                  </div>
                </section>

                <section className="rounded-[1.75rem] border border-[#A68D65]/15 bg-white p-6 shadow-sm">
                  <div className="flex items-center gap-3">
                    <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#F7EEE4] text-[#33381C]">
                      <UserRound className="h-5 w-5" />
                    </div>

                    <div className="min-w-0">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-[#A68D65]">
                        Seller account
                      </p>

                      <p className="truncate text-sm font-bold text-[#33381C]">
                        {profile?.full_name ||
                          user?.email ||
                          "Seller account"}
                      </p>

                      <p className="truncate text-xs text-slate-500">
                        {user?.email}
                      </p>
                    </div>
                  </div>
                </section>

                <section className="rounded-[1.75rem] border border-[#A68D65]/15 bg-[#F7EEE4]/70 p-6">
                  <h2 className="font-bold text-[#33381C]">
                    What happens next?
                  </h2>

                  <div className="mt-4 space-y-4">
                    <TimelineItem
                      number="1"
                      title="Submit application"
                      description="Complete your business information."
                      active
                    />

                    <TimelineItem
                      number="2"
                      title="Verification"
                      description="Our team reviews your seller application."
                    />

                    <TimelineItem
                      number="3"
                      title="Seller activation"
                      description="Approved sellers receive marketplace access."
                    />
                  </div>
                </section>

                <section className="rounded-[1.75rem] border border-[#A68D65]/15 bg-white p-6">
                  <div className="flex gap-3">
                    <Save className="h-5 w-5 shrink-0 text-[#33381C]" />

                    <div>
                      <h2 className="text-sm font-bold text-[#33381C]">
                        Your progress
                      </h2>

                      <p className="mt-1 text-xs leading-5 text-slate-500">
                        Your current information remains available while
                        you move between the application steps.
                      </p>
                    </div>
                  </div>
                </section>
              </aside>
            </div>
          </form>
        </div>
      </main>

      <Footer />
    </div>
  );
}

function StepCard({
  icon,
  eyebrow,
  title,
  description,
  children,
}: {
  icon: ReactNode;
  eyebrow: string;
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <section className="overflow-hidden rounded-[2rem] border border-[#A68D65]/15 bg-white shadow-sm">
      <div className="border-b border-[#A68D65]/10 bg-gradient-to-r from-[#F7EEE4] via-[#F1ECE3] to-[#E7E9DD] p-6 md:p-8">
        <div className="flex items-start gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#33381C] text-white shadow-lg">
            {icon}
          </div>

          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#A68D65]">
              {eyebrow}
            </p>

            <h2 className="mt-1 font-serif text-2xl font-bold text-[#33381C]">
              {title}
            </h2>

            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
              {description}
            </p>
          </div>
        </div>
      </div>

      <div className="p-6 md:p-8">{children}</div>
    </section>
  );
}

function Field({
  label,
  required = false,
  error,
  hint,
  children,
}: {
  label: string;
  required?: boolean;
  error?: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-bold text-neutral-700">
        {label}

        {required && (
          <span className="ml-1 text-red-600">*</span>
        )}
      </Label>

      {children}

      {hint && !error && (
        <p className="text-[11px] text-slate-400">
          {hint}
        </p>
      )}

      {error && (
        <p className="text-xs font-medium text-red-600">
          {error}
        </p>
      )}
    </div>
  );
}

function InfoBox({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <div className="mt-6 flex gap-3 rounded-2xl border border-[#A68D65]/15 bg-[#F7EEE4]/60 p-4 text-xs leading-5 text-slate-600">
      {children}
    </div>
  );
}

function ChoiceCard({
  title,
  description,
  selected,
  onClick,
  disabled,
}: {
  title: string;
  description: string;
  selected: boolean;
  onClick: () => void;
  disabled: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`rounded-2xl border p-5 text-left transition-all ${
        selected
          ? "border-[#33381C] bg-[#F7EEE4] shadow-sm"
          : "border-[#A68D65]/20 bg-white hover:border-[#33381C]/40 hover:shadow-sm"
      } disabled:cursor-not-allowed disabled:opacity-60`}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-bold text-[#33381C]">
            {title}
          </h3>

          <p className="mt-2 text-xs leading-5 text-slate-500">
            {description}
          </p>
        </div>

        <div
          className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border ${
            selected
              ? "border-[#33381C] bg-[#33381C] text-white"
              : "border-slate-300"
          }`}
        >
          {selected && <Check className="h-3 w-3" />}
        </div>
      </div>
    </button>
  );
}

function ReviewSection({
  title,
  step,
  onEdit,
  children,
}: {
  title: string;
  step: number;
  onEdit: () => void;
  children: ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-[#A68D65]/15 bg-white">
      <div className="flex items-center justify-between border-b border-[#A68D65]/10 px-5 py-4">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#F7EEE4] text-xs font-bold text-[#33381C]">
            {step}
          </div>

          <h3 className="text-sm font-bold text-[#33381C]">
            {title}
          </h3>
        </div>

        <button
          type="button"
          onClick={onEdit}
          className="text-xs font-bold text-[#33381C] hover:underline"
        >
          Edit
        </button>
      </div>

      <div className="grid gap-5 p-5 sm:grid-cols-2">
        {children}
      </div>
    </section>
  );
}

function ReviewItem({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div>
      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
        {label}
      </p>

      <p className="mt-1 break-words text-sm font-semibold text-slate-700">
        {value || "Not provided"}
      </p>
    </div>
  );
}

function TimelineItem({
  number,
  title,
  description,
  active = false,
}: {
  number: string;
  title: string;
  description: string;
  active?: boolean;
}) {
  return (
    <div className="flex gap-3">
      <div
        className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
          active
            ? "bg-[#33381C] text-white"
            : "bg-white text-slate-400 border border-slate-200"
        }`}
      >
        {number}
      </div>

      <div>
        <p className="text-xs font-bold text-[#33381C]">
          {title}
        </p>

        <p className="mt-0.5 text-[11px] leading-5 text-slate-500">
          {description}
        </p>
      </div>
    </div>
  );
}

function maskAccountNumber(accountNumber: string) {
  const value = accountNumber.trim();

  if (!value) return "Not provided";

  if (value.length <= 4) {
    return "••••";
  }

  return `••••••${value.slice(-4)}`;
}
