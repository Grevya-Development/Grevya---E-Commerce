import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  BadgeCheck,
  CheckCircle2,
  FileText,
  Loader2,
  ShieldCheck,
  Store,
} from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";

type ApplicationStatus =
  | "draft"
  | "submitted"
  | "under_review"
  | "changes_requested"
  | "approved"
  | "rejected"
  | "suspended";

interface SellerApplication {
  id: string;
  status: ApplicationStatus;
  store_name: string | null;
  owner_full_name: string | null;
  email: string | null;
  phone: string | null;
  pan_number: string | null;
  gstin: string | null;
  business_address: Record<string, string> | null;
  pickup_address: Record<string, string> | null;
  return_address: Record<string, string> | null;
  product_categories: string[] | null;
  ayush_license_number: string | null;
  fssai_license_number: string | null;
  brand_authorization_reference: string | null;
  rejection_reason: string | null;
  suspension_reason: string | null;
  admin_remarks: string | null;
}

const POLICY_VERSION = "seller-agreement-v1";

const emptyAddress = {
  line1: "",
  line2: "",
  city: "",
  state: "",
  pincode: "",
  country: "India",
};

const requiredDocuments = [
  { type: "pan_card", label: "PAN Card", required: true },
  { type: "gst_certificate", label: "GST Certificate", required: true },
  {
    type: "bank_proof",
    label: "Bank Proof / Cancelled Cheque",
    required: true,
  },
  { type: "ayush_license", label: "AYUSH License", required: false },
  { type: "fssai_license", label: "FSSAI License", required: false },
  {
    type: "brand_authorization",
    label: "Brand Authorization Letter",
    required: false,
  },
] as const;

export default function ApplyToSell() {
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [application, setApplication] = useState<SellerApplication | null>(
    null,
  );

  const [storeName, setStoreName] = useState("");
  const [ownerFullName, setOwnerFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [panNumber, setPanNumber] = useState("");
  const [gstin, setGstin] = useState("");
  const [categories, setCategories] = useState("");
  const [ayushLicense, setAyushLicense] = useState("");
  const [fssaiLicense, setFssaiLicense] = useState("");
  const [brandAuthorization, setBrandAuthorization] = useState("");

  const [businessAddress, setBusinessAddress] = useState(emptyAddress);
  const [pickupAddress, setPickupAddress] = useState(emptyAddress);
  const [returnAddress, setReturnAddress] = useState(emptyAddress);

  const [bankHolderName, setBankHolderName] = useState("");
  const [bankName, setBankName] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [ifscCode, setIfscCode] = useState("");

  const [agreementAccepted, setAgreementAccepted] = useState(false);
  const [uploadedDocuments, setUploadedDocuments] = useState<
    Record<string, boolean>
  >({});
  const [documentError, setDocumentError] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isReapplying, setIsReapplying] = useState(false);

  const isEditable =
    !application ||
    application.status === "draft" ||
    application.status === "changes_requested";
  const loadApplication = async () => {
    if (!user) return;

    setLoading(true);

    try {
      const { data, error } = await supabase
        .from("seller_applications")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();

      if (error) throw error;

      if (!data) {
        setApplication(null);
        setOwnerFullName(profile?.full_name || "");
        setEmail(user.email || "");
        setPhone(profile?.phone || "");
        return;
      }

      const existing = data as SellerApplication;
      setApplication(existing);

      setStoreName(existing.store_name || "");
      setOwnerFullName(existing.owner_full_name || "");
      setEmail(existing.email || user.email || "");
      setPhone(existing.phone || "");
      setPanNumber(existing.pan_number || "");
      setGstin(existing.gstin || "");
      setCategories((existing.product_categories || []).join(", "));
      setAyushLicense(existing.ayush_license_number || "");
      setFssaiLicense(existing.fssai_license_number || "");
      setBrandAuthorization(existing.brand_authorization_reference || "");

      setBusinessAddress({
        ...emptyAddress,
        ...(existing.business_address || {}),
      });
      setPickupAddress({
        ...emptyAddress,
        ...(existing.pickup_address || {}),
      });
      setReturnAddress({
        ...emptyAddress,
        ...(existing.return_address || {}),
      });

      const { data: payoutData } = await supabase
        .from("seller_payout_accounts")
        .select("account_holder_name,bank_name,account_number,ifsc_code")
        .eq("application_id", existing.id)
        .maybeSingle();

      if (payoutData) {
        setBankHolderName(payoutData.account_holder_name || "");
        setBankName(payoutData.bank_name || "");
        setAccountNumber(payoutData.account_number || "");
        setIfscCode(payoutData.ifsc_code || "");
      }

      const { data: policyData } = await supabase
        .from("seller_policy_acceptance")
        .select("id")
        .eq("application_id", existing.id)
        .eq("policy_version", POLICY_VERSION)
        .maybeSingle();

      setAgreementAccepted(Boolean(policyData));

      const { data: documentData } = await supabase
        .from("seller_documents")
        .select("document_type")
        .eq("application_id", existing.id);

      const documentMap: Record<string, boolean> = {};

      (documentData || []).forEach((document) => {
        documentMap[document.document_type] = true;
      });

      setUploadedDocuments(documentMap);
    } catch (error: any) {
      toast({
        title: "Unable to load seller application",
        description: error.message || "Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!user) {
      navigate("/login");
      return;
    }

    loadApplication();

    const channel = supabase
      .channel(`seller-application-${user.id}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "seller_applications",
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          console.log("Realtime event received");
          console.log(payload);

          setApplication(payload.new as SellerApplication);

          loadApplication();
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);
  const validateApplicationFields = () => {
    const newErrors: Record<string, string> = {};

    if (!storeName.trim()) newErrors.storeName = "Store name is required.";
    if (!ownerFullName.trim())
      newErrors.ownerFullName = "Owner full name is required.";

    if (!email.trim()) {
      newErrors.email = "Email is required.";
    } else if (!/^\S+@\S+\.\S+$/.test(email.trim())) {
      newErrors.email = "Enter a valid email address.";
    }

    if (!phone.trim()) {
      newErrors.phone = "Phone number is required.";
    } else if (!/^\d{10,15}$/.test(phone.trim().replace(/\D/g, ""))) {
      newErrors.phone = "Enter a valid phone number.";
    }

    if (!panNumber.trim()) {
      newErrors.panNumber = "PAN number is required.";
    } else if (panNumber.trim().length !== 10) {
      newErrors.panNumber = "PAN number must be 10 characters.";
    }

    if (!gstin.trim()) {
      newErrors.gstin = "GSTIN is required.";
    } else if (gstin.trim().length !== 15) {
      newErrors.gstin = "GSTIN must be 15 characters.";
    }

    if (!bankHolderName.trim())
      newErrors.bankHolderName = "Account holder name is required.";
    if (!bankName.trim()) newErrors.bankName = "Bank name is required.";
    if (!accountNumber.trim())
      newErrors.accountNumber = "Account number is required.";
    if (!ifscCode.trim()) {
      newErrors.ifscCode = "IFSC code is required.";
    } else if (ifscCode.trim().length !== 11) {
      newErrors.ifscCode = "IFSC code must be 11 characters.";
    }

    const docErrors = requiredDocuments
      .filter((document) => document.required)
      .filter((document) => !uploadedDocuments[document.type]);

    if (docErrors.length > 0) {
      newErrors.documents = `Upload ${docErrors
        .map((document) => document.label)
        .join(", ")} before submitting.`;
    }

    if (!agreementAccepted) {
      newErrors.agreementAccepted =
        "You must agree to the Seller Agreement before submitting.";
    }

    setErrors(newErrors);
    setDocumentError(newErrors.documents || "");

    return newErrors;
  };

  const createOrSaveDraft = async () => {
    if (!user) return null;

    setSaving(true);

    try {
      const payload = {
        user_id: user.id,
        status: "draft",
        store_name: storeName.trim() || null,
        owner_full_name: ownerFullName.trim() || null,
        email: email.trim() || null,
        phone: phone.trim() || null,
        pan_number: panNumber.trim().toUpperCase() || null,
        gstin: gstin.trim().toUpperCase() || null,
        business_address: businessAddress,
        pickup_address: pickupAddress,
        return_address: returnAddress,
        product_categories: categories
          .split(",")
          .map((item) => item.trim())
          .filter(Boolean),
        ayush_license_number: ayushLicense.trim() || null,
        fssai_license_number: fssaiLicense.trim() || null,
        brand_authorization_reference: brandAuthorization.trim() || null,
      };

      let applicationId = application?.id;

      if (!applicationId) {
        const { data, error } = await supabase
          .from("seller_applications")
          .insert(payload)
          .select("*")
          .single();

        if (error) throw error;

        applicationId = data.id;
        setApplication(data as SellerApplication);
      } else {
        const { data, error } = await supabase
          .from("seller_applications")
          .update(payload)
          .eq("id", applicationId)
          .select("*")
          .single();

        if (error) throw error;

        setApplication(data as SellerApplication);
      }

      const payoutPayload = {
        application_id: applicationId,
        account_holder_name: bankHolderName.trim(),
        bank_name: bankName.trim(),
        account_number: accountNumber.trim(),
        ifsc_code: ifscCode.trim().toUpperCase(),
      };

      if (
        payoutPayload.account_holder_name &&
        payoutPayload.bank_name &&
        payoutPayload.account_number &&
        payoutPayload.ifsc_code
      ) {
        const { error: payoutError } = await supabase
          .from("seller_payout_accounts")
          .upsert(payoutPayload, { onConflict: "application_id" });

        if (payoutError) throw payoutError;
      }

      if (agreementAccepted) {
        const { error: policyError } = await supabase
          .from("seller_policy_acceptance")
          .upsert(
            {
              application_id: applicationId,
              user_id: user.id,
              policy_version: POLICY_VERSION,
            },
            { onConflict: "application_id,policy_version" },
          );

        if (policyError) throw policyError;
      }

      toast({
        title: "Draft saved",
        description: "Your seller application draft has been saved.",
      });

      return applicationId;
    } catch (error: any) {
      toast({
        title: "Unable to save draft",
        description: error.message || "Please check the details and try again.",
        variant: "destructive",
      });

      return null;
    } finally {
      setSaving(false);
    }
  };

  const uploadDocument = async (
    documentType: (typeof requiredDocuments)[number]["type"],
    file: File,
  ) => {
    if (!user) return;

    const applicationId = await createOrSaveDraft();

    if (!applicationId) return;

    const extension = file.name.split(".").pop() || "file";
    const filePath = `${user.id}/${documentType}-${Date.now()}.${extension}`;

    try {
      const { error: storageError } = await supabase.storage
        .from("seller-documents")
        .upload(filePath, file, {
          upsert: false,
          contentType: file.type,
        });

      if (storageError) throw storageError;

      const { error: documentError } = await supabase
        .from("seller_documents")
        .upsert(
          {
            application_id: applicationId,
            document_type: documentType,
            storage_bucket: "seller-documents",
            storage_path: filePath,
            original_file_name: file.name,
            mime_type: file.type,
            file_size_bytes: file.size,
          },
          { onConflict: "application_id,document_type" },
        );

      if (documentError) throw documentError;

      setUploadedDocuments((current) => ({
        ...current,
        [documentType]: true,
      }));
      setDocumentError("");
      setErrors((current) => ({ ...current, documents: "" }));

      toast({
        title: "Document uploaded",
        description: `${file.name} was uploaded securely.`,
      });
    } catch (error: any) {
      toast({
        title: "Upload failed",
        description: error.message || "Unable to upload this document.",
        variant: "destructive",
      });
    }
  };

  const submitApplication = async () => {
    if (!user) return;

    const validationErrors = validateApplicationFields();
    if (Object.keys(validationErrors).length > 0) {
      toast({
        title: "Complete required fields",
        description:
          "Please fix the highlighted fields and upload required documents.",
        variant: "destructive",
      });
      return;
    }

    const applicationId = await createOrSaveDraft();

    if (!applicationId) return;

    setSubmitting(true);

    try {
      const { error } = await supabase.rpc("submit_seller_application", {
        p_application_id: applicationId,
      });

      if (error) throw error;

      toast({
        title: "Application submitted",
        description:
          "Your seller application is now waiting for admin verification.",
      });

      await loadApplication();
    } catch (error: any) {
      toast({
        title: "Unable to submit application",
        description: error.message || "Complete all required details first.",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };
  const handleReapply = async () => {
    if (!application) return;

    const { error } = await supabase
      .from("seller_applications")
      .update({
        status: "draft",
        rejection_reason: null,
      })
      .eq("id", application.id);

    if (error) return;

    await loadApplication();
  };

  const updateAddress = (
    setter: React.Dispatch<React.SetStateAction<typeof emptyAddress>>,
    field: keyof typeof emptyAddress,
    value: string,
  ) => {
    setter((current) => ({ ...current, [field]: value }));
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[linear-gradient(135deg,#fdf8f1_0%,#f5ebde_60%,#eef7ec_100%)] px-4 py-16">
        <div className="mx-auto flex max-w-3xl justify-center rounded-[30px] border border-[#A68D65]/20 bg-white/80 p-10 shadow-[0_25px_70px_-30px_rgba(58,72,34,0.35)] backdrop-blur">
          <Loader2 className="h-8 w-8 animate-spin text-green-700" />
        </div>
      </div>
    );
  }

  if (
    application &&
    application.status !== "draft" &&
    application.status !== "changes_requested"
  ) {
    const statusText = application.status.replace(/_/g, " ");

    return (
      <div className="min-h-screen bg-[linear-gradient(135deg,#fdf8f1_0%,#f5ebde_60%,#eef7ec_100%)] px-4 py-10 md:py-16">
        <div className="mx-auto max-w-2xl rounded-[32px] border border-[#A68D65]/20 bg-white/90 p-8 shadow-[0_25px_70px_-30px_rgba(58,72,34,0.35)] backdrop-blur md:p-10">
          <div className="flex items-center gap-3">
            <div className="rounded-2xl bg-[#F7EEE4] p-3 text-green-700">
              <CheckCircle2 className="h-8 w-8" />
            </div>
            <div>
              <h1 className="text-2xl font-semibold text-[#33381C]">
                Seller application status
              </h1>
              <p className="mt-1 capitalize text-slate-600">{statusText}</p>
            </div>
          </div>

          {application.status === "submitted" && (
            <p className="mt-6 text-slate-700">
              Your documents and business details were submitted. An admin will
              review them shortly.
            </p>
          )}

          {application.status === "under_review" && (
            <p className="mt-6 text-slate-700">
              Your seller application is currently under review.
            </p>
          )}

          {application.status === "approved" && (
            <div className="mt-6">
              <p className="text-slate-700">
                Your seller account has been approved. You can now access the
                seller dashboard.
              </p>
              <Button
                className="mt-5 bg-green-700 hover:bg-green-800"
                onClick={() => navigate("/seller/dashboard")}
              >
                Open Seller Dashboard
              </Button>
            </div>
          )}

          {application.status === "rejected" && (
            <div className="mt-6 rounded-[24px] border border-red-200 bg-red-50 p-6">
              <h2 className="text-xl font-semibold text-red-700">
                Seller Application Rejected
              </h2>

              <p className="mt-3 text-red-600">
                Unfortunately, your seller application was rejected.
              </p>

              <div className="mt-4 rounded-2xl border border-red-100 bg-white p-4">
                <p className="font-semibold text-slate-900">Reason</p>

                <p className="mt-2 text-gray-700">
                  {application.rejection_reason || "No reason provided."}
                </p>
              </div>

              <div className="mt-6 flex justify-end">
                <Button
                  className="bg-green-700 hover:bg-green-800"
                  onClick={handleReapply}
                >
                  Reapply
                </Button>
              </div>
            </div>
          )}

          {application.status === "suspended" && (
            <p className="mt-6 text-red-700">
              Reason: {application.suspension_reason || "Not provided"}
            </p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[linear-gradient(135deg,#fdf8f1_0%,#f5ebde_60%,#eef7ec_100%)] px-4 py-8 md:py-14">
      <div className="mx-auto max-w-6xl">
        <div className="mb-8 overflow-hidden rounded-[32px] border border-[#A68D65]/20 bg-white/85 p-6 shadow-[0_30px_80px_-30px_rgba(58,72,34,0.35)] backdrop-blur md:p-8">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-2xl">
              <div className="inline-flex items-center rounded-full border border-green-200 bg-green-50 px-3 py-1 text-sm font-medium text-green-700">
                <ShieldCheck className="mr-2 h-4 w-4" />
                Trusted seller onboarding
              </div>

              <div className="mt-4 flex items-center gap-3">
                <div className="rounded-2xl bg-[#33381C] p-3 text-white shadow-lg">
                  <Store className="h-7 w-7" />
                </div>
                <div>
                  <h1 className="text-3xl font-semibold tracking-tight text-[#33381C]">
                    Apply to Become a Seller
                  </h1>
                  <p className="mt-2 text-base leading-7 text-slate-600">
                    Complete your business profile, upload compliance documents,
                    and submit your application for a smooth review.
                  </p>
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-[#A68D65]/20 bg-[#FAF3E8] p-4 text-sm text-slate-700">
              <p className="font-semibold text-[#33381C]">
                Verification checklist
              </p>
              <ul className="mt-2 space-y-2">
                <li>• Business and owner details</li>
                <li>• PAN, GST and bank proof</li>
                <li>• Agreement acceptance</li>
              </ul>
            </div>
          </div>
        </div>

        <div className="mb-6 grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
          <div className="rounded-[24px] border border-stone-200/80 bg-white/90 p-5 shadow-[0_16px_45px_-24px_rgba(25,34,19,0.35)] backdrop-blur">
            <div className="flex items-center gap-3">
              <div className="rounded-2xl bg-[#F7EEE4] p-2.5 text-green-700">
                <FileText className="h-5 w-5" />
              </div>
              <div>
                <h2 className="font-semibold text-[#33381C]">
                  Prepare your documents
                </h2>
                <p className="mt-1 text-sm text-slate-600">
                  Keep your PAN, GST certificate, bank proof, and address
                  details ready before you submit.
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-[24px] border border-stone-200/80 bg-white/90 p-5 shadow-[0_16px_45px_-24px_rgba(25,34,19,0.35)] backdrop-blur">
            <div className="flex items-center gap-3">
              <div className="rounded-2xl bg-[#F7EEE4] p-2.5 text-green-700">
                <BadgeCheck className="h-5 w-5" />
              </div>
              <div>
                <h2 className="font-semibold text-[#33381C]">
                  Quick review steps
                </h2>
                <ol className="mt-2 space-y-1 text-sm text-slate-600">
                  <li>1. Complete your profile</li>
                  <li>2. Upload required documents</li>
                  <li>3. Review and submit</li>
                </ol>
              </div>
            </div>
          </div>
        </div>

        {application?.status === "changes_requested" &&
          application?.admin_remarks && (
            <div className="mb-6 rounded-[24px] border border-yellow-300 bg-yellow-50 p-5 shadow-sm">
              <h2 className="text-lg font-semibold text-yellow-800">
                ⚠ Changes requested
              </h2>

              <p className="mt-2 text-sm text-gray-700">
                The admin has reviewed your application and requested the
                following changes:
              </p>

              <div className="mt-3 rounded-2xl border border-yellow-200 bg-white p-4 text-gray-800">
                {application.admin_remarks}
              </div>

              <p className="mt-3 text-sm text-gray-600">
                Please update the requested information and click
                <strong> Submit for Verification</strong> again.
              </p>
            </div>
          )}

        <div className="space-y-6">
          <section className="rounded-[28px] border border-stone-200/80 bg-white/90 p-6 shadow-[0_20px_60px_-26px_rgba(25,34,19,0.35)] backdrop-blur md:p-8">
            <div className="flex items-center gap-3">
              <div className="rounded-2xl bg-[#F7EEE4] p-2.5 text-green-700">
                <Store className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-xl font-semibold text-[#33381C]">
                  Store and owner details
                </h2>
                <p className="mt-1 text-sm text-slate-600">
                  Share your brand identity and primary contact details.
                </p>
              </div>
            </div>

            <div className="mt-6 grid gap-4 md:grid-cols-2">
              <Input
                label="Store name *"
                value={storeName}
                onChange={(value) => {
                  setStoreName(value);
                  if (errors.storeName) {
                    setErrors((curr) => ({ ...curr, storeName: "" }));
                  }
                }}
                disabled={!isEditable}
                error={errors.storeName}
              />
              <Input
                label="Owner full name *"
                value={ownerFullName}
                onChange={(value) => {
                  setOwnerFullName(value);
                  if (errors.ownerFullName) {
                    setErrors((curr) => ({ ...curr, ownerFullName: "" }));
                  }
                }}
                disabled={!isEditable}
                error={errors.ownerFullName}
              />
              <Input
                label="Email *"
                type="email"
                value={email}
                onChange={(value) => {
                  setEmail(value);
                  if (errors.email) {
                    setErrors((curr) => ({ ...curr, email: "" }));
                  }
                }}
                disabled={!isEditable}
                error={errors.email}
              />
              <Input
                label="Phone number *"
                value={phone}
                onChange={(value) => {
                  setPhone(value);
                  if (errors.phone) {
                    setErrors((curr) => ({ ...curr, phone: "" }));
                  }
                }}
                disabled={!isEditable}
                error={errors.phone}
              />
              <Input
                label="PAN number *"
                value={panNumber}
                onChange={(value) => {
                  setPanNumber(value);
                  if (errors.panNumber) {
                    setErrors((curr) => ({ ...curr, panNumber: "" }));
                  }
                }}
                disabled={!isEditable}
                error={errors.panNumber}
              />
              <Input
                label="GSTIN *"
                value={gstin}
                onChange={(value) => {
                  setGstin(value);
                  if (errors.gstin) {
                    setErrors((curr) => ({ ...curr, gstin: "" }));
                  }
                }}
                disabled={!isEditable}
                error={errors.gstin}
              />
              <Input
                label="Product categories (comma separated)"
                value={categories}
                onChange={setCategories}
                disabled={!isEditable}
              />
              <Input
                label="AYUSH license number (if applicable)"
                value={ayushLicense}
                onChange={setAyushLicense}
                disabled={!isEditable}
              />
              <Input
                label="FSSAI license number (if applicable)"
                value={fssaiLicense}
                onChange={setFssaiLicense}
                disabled={!isEditable}
              />
              <Input
                label="Brand authorization reference (if applicable)"
                value={brandAuthorization}
                onChange={setBrandAuthorization}
                disabled={!isEditable}
              />
            </div>
          </section>

          <AddressSection
            title="Business address"
            address={businessAddress}
            disabled={!isEditable}
            onChange={(field, value) =>
              updateAddress(setBusinessAddress, field, value)
            }
          />

          <AddressSection
            title="Pickup address"
            address={pickupAddress}
            disabled={!isEditable}
            onChange={(field, value) =>
              updateAddress(setPickupAddress, field, value)
            }
          />

          <AddressSection
            title="Return address"
            address={returnAddress}
            disabled={!isEditable}
            onChange={(field, value) =>
              updateAddress(setReturnAddress, field, value)
            }
          />

          <section className="rounded-[28px] border border-stone-200/80 bg-white/90 p-6 shadow-[0_20px_60px_-26px_rgba(25,34,19,0.35)] backdrop-blur md:p-8">
            <div className="flex items-center gap-3">
              <div className="rounded-2xl bg-[#F7EEE4] p-2.5 text-green-700">
                <BadgeCheck className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-xl font-semibold text-[#33381C]">
                  Payout account
                </h2>
                <p className="mt-1 text-sm text-slate-600">
                  Add your payout details to receive payments securely.
                </p>
              </div>
            </div>

            <div className="mt-6 grid gap-4 md:grid-cols-2">
              <Input
                label="Account holder name *"
                value={bankHolderName}
                onChange={(value) => {
                  setBankHolderName(value);
                  if (errors.bankHolderName) {
                    setErrors((curr) => ({ ...curr, bankHolderName: "" }));
                  }
                }}
                disabled={!isEditable}
                error={errors.bankHolderName}
              />
              <Input
                label="Bank name *"
                value={bankName}
                onChange={(value) => {
                  setBankName(value);
                  if (errors.bankName) {
                    setErrors((curr) => ({ ...curr, bankName: "" }));
                  }
                }}
                disabled={!isEditable}
                error={errors.bankName}
              />
              <Input
                label="Account number *"
                value={accountNumber}
                onChange={(value) => {
                  setAccountNumber(value);
                  if (errors.accountNumber) {
                    setErrors((curr) => ({ ...curr, accountNumber: "" }));
                  }
                }}
                disabled={!isEditable}
                error={errors.accountNumber}
              />
              <Input
                label="IFSC code *"
                value={ifscCode}
                onChange={(value) => {
                  setIfscCode(value);
                  if (errors.ifscCode) {
                    setErrors((curr) => ({ ...curr, ifscCode: "" }));
                  }
                }}
                disabled={!isEditable}
                error={errors.ifscCode}
              />
            </div>
          </section>

          <section className="rounded-[28px] border border-stone-200/80 bg-white/90 p-6 shadow-[0_20px_60px_-26px_rgba(25,34,19,0.35)] backdrop-blur md:p-8">
            <div className="flex items-center gap-3">
              <div className="rounded-2xl bg-[#F7EEE4] p-2.5 text-green-700">
                <FileText className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-xl font-semibold text-[#33381C]">
                  Compliance documents
                </h2>
                <p className="mt-1 text-sm text-slate-600">
                  Required: PAN card, GST certificate, and bank proof. Upload
                  PDF, JPG, or PNG files.
                </p>
              </div>
            </div>

            <div className="mt-6 grid gap-4 md:grid-cols-2">
              {requiredDocuments.map((document) => (
                <div
                  key={document.type}
                  className="rounded-[20px] border border-stone-200 bg-[#FCFBF8] p-4 shadow-sm"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-medium text-slate-900">
                        {document.label}
                        {document.required ? " *" : ""}
                      </p>
                      <p className="mt-1 text-xs text-slate-500">
                        {uploadedDocuments[document.type]
                          ? "Uploaded"
                          : "Not uploaded"}
                      </p>
                    </div>

                    <label
                      className={`cursor-pointer rounded-xl px-3 py-2 text-sm font-semibold transition ${
                        isEditable
                          ? "bg-[#33381C] text-white hover:bg-[#243017]"
                          : "cursor-not-allowed bg-slate-200 text-slate-500"
                      }`}
                    >
                      Upload
                      <input
                        type="file"
                        className="hidden"
                        disabled={!isEditable}
                        accept=".pdf,.jpg,.jpeg,.png"
                        onChange={(event) => {
                          const file = event.target.files?.[0];
                          if (file) uploadDocument(document.type, file);
                          event.target.value = "";
                        }}
                      />
                    </label>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-[28px] border border-stone-200/80 bg-white/90 p-6 shadow-[0_20px_60px_-26px_rgba(25,34,19,0.35)] backdrop-blur md:p-8">
            <h2 className="text-xl font-semibold text-[#33381C]">
              Seller agreement
            </h2>

            <p className="mt-3 text-sm leading-6 text-slate-600">
              By applying, you agree to provide accurate business information,
              sell only lawful and genuine products, follow return and refund
              rules, avoid unsupported medical claims, and use customer data
              only for order fulfilment.
            </p>

            <label className="mt-5 flex cursor-pointer items-start gap-3 rounded-[20px] border border-stone-200 bg-[#FCFBF8] p-4 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={agreementAccepted}
                disabled={!isEditable}
                onChange={(event) => {
                  setAgreementAccepted(event.target.checked);
                  if (errors.agreementAccepted) {
                    setErrors((curr) => ({ ...curr, agreementAccepted: "" }));
                  }
                }}
                className="mt-1 h-4 w-4 rounded border-stone-300 text-green-700 focus:ring-green-600"
              />
              <span>
                I agree to the Seller Agreement and platform policies.
              </span>
            </label>
            {errors.agreementAccepted ? (
              <p className="mt-2 text-[10px] text-red-500 font-bold ml-1">
                {errors.agreementAccepted}
              </p>
            ) : null}
          </section>

          <div className="flex flex-wrap gap-3 pb-10">
            <Button
              type="button"
              variant="outline"
              disabled={!isEditable || saving || submitting}
              onClick={createOrSaveDraft}
              className="border-stone-300 px-5 py-2.5"
            >
              {saving ? "Saving..." : "Save Draft"}
            </Button>

            <Button
              type="button"
              disabled={!isEditable || saving || submitting}
              onClick={submitApplication}
              className="bg-green-700 px-5 py-2.5 hover:bg-green-800"
            >
              {submitting ? "Submitting..." : "Submit for Verification"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

function Input({
  label,
  value,
  onChange,
  disabled,
  type = "text",
  error,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  type?: string;
  error?: string;
}) {
  return (
    <label className="block">
      <span className="text-sm font-medium text-slate-700">{label}</span>
      <input
        type={type}
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
        className={`mt-2 w-full rounded-2xl border px-3 py-2.5 text-sm text-slate-800 shadow-sm outline-none transition focus:bg-white focus:ring-4 disabled:bg-stone-100 ${
          error
            ? "border-red-500 focus:border-red-500 focus:ring-red-100"
            : "border-stone-200 bg-[#FCFBF8] focus:border-green-600 focus:ring-green-100"
        }`}
      />
      {error ? (
        <p className="text-[10px] text-red-500 font-bold mt-1 ml-1">{error}</p>
      ) : null}
    </label>
  );
}

function AddressSection({
  title,
  address,
  onChange,
  disabled,
}: {
  title: string;
  address: typeof emptyAddress;
  onChange: (field: keyof typeof emptyAddress, value: string) => void;
  disabled?: boolean;
}) {
  return (
    <section className="rounded-[28px] border border-stone-200/80 bg-white/90 p-6 shadow-[0_20px_60px_-26px_rgba(25,34,19,0.35)] backdrop-blur md:p-8">
      <div className="flex items-center gap-3">
        <div className="rounded-2xl bg-[#F7EEE4] p-2.5 text-green-700">
          <FileText className="h-5 w-5" />
        </div>
        <div>
          <h2 className="text-xl font-semibold text-[#33381C]">{title}</h2>
          <p className="mt-1 text-sm text-slate-600">
            Add the relevant shipping and business address details.
          </p>
        </div>
      </div>

      <div className="mt-6 grid gap-4 md:grid-cols-2">
        <Input
          label="Address line 1"
          value={address.line1}
          onChange={(value) => onChange("line1", value)}
          disabled={disabled}
        />
        <Input
          label="Address line 2"
          value={address.line2}
          onChange={(value) => onChange("line2", value)}
          disabled={disabled}
        />
        <Input
          label="City"
          value={address.city}
          onChange={(value) => onChange("city", value)}
          disabled={disabled}
        />
        <Input
          label="State"
          value={address.state}
          onChange={(value) => onChange("state", value)}
          disabled={disabled}
        />
        <Input
          label="Pincode"
          value={address.pincode}
          onChange={(value) => onChange("pincode", value)}
          disabled={disabled}
        />
        <Input
          label="Country"
          value={address.country}
          onChange={(value) => onChange("country", value)}
          disabled={disabled}
        />
      </div>
    </section>
  );
}
