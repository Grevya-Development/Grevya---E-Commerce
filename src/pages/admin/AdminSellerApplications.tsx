import { useEffect, useMemo, useState } from "react";
import AdminLayout from "@/layouts/AdminLayout";
import { supabase } from "@/lib/supabaseClient";
import { useAuth } from "@/context/AuthContext";
import { toast } from "@/components/ui/use-toast";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Building2,
  Calendar,
  CheckCircle,
  Eye,
  Loader2,
  Search,
  XCircle,
} from "lucide-react";

type BankDetails = {
  account_holder_name?: string;
  bank_name?: string;
  account_number?: string;
  ifsc_code?: string;
};

type SellerApplication = {
  id: string;
  user_id: string;
  status: string;
  company_name: string | null;
  business_type: string | null;
  registration_number: string | null;
  tax_id: string | null;
  bank_details: BankDetails | null;
  created_at: string | null;
};
const maskAccountNumber = (accountNumber?: string) => {
  if (!accountNumber) return "Not provided";
  return `${"*".repeat(Math.max(accountNumber.length - 4, 0))}${accountNumber.slice(-4)}`;
};

const formatDate = (value: string | null) =>
  value
    ? new Date(value).toLocaleDateString("en-IN", {
        year: "numeric",
        month: "short",
        day: "numeric",
      })
    : "Not available";

const createStoreSlug = (companyName: string, sellerId: string) => {
  const name = companyName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48) || "seller-store";

  return `${name}-${sellerId.replace(/-/g, "").slice(0, 8)}`;
};

export default function AdminSellerApplications() {
  const { user } = useAuth();
  const [applications, setApplications] = useState<SellerApplication[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [selectedApplication, setSelectedApplication] = useState<SellerApplication | null>(null);
  const [rejectTarget, setRejectTarget] = useState<SellerApplication | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [searchTerm, setSearchTerm] = useState("");

  const fetchPendingApplications = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("seller_applications")
      .select("*")
      .eq("status", "pending")
      .order("created_at", { ascending: false });
      console.log("Error:", error);
      console.log("Data:", data);
      console.log("Current User:", user);
    if (error) {
      toast({
        title: "Unable to load seller applications",
        description: error.message,
        variant: "destructive",
      });
      setLoading(false);
      return;
    }

    setApplications((data || []) as SellerApplication[]);
    setLoading(false);
  };

  useEffect(() => {
    void fetchPendingApplications();
  }, []);

  const filteredApplications = useMemo(() => {
    const search = searchTerm.trim().toLowerCase();
    if (!search) return applications;

    return applications.filter((application) =>
      [
        application.company_name,
        application.business_type,
        application.registration_number,
        application.tax_id,
        // TODO: Include applicant email in search when seller_applications exposes an email field.
      ].some((value) => value?.toLowerCase().includes(search)),
    );
  }, [applications, searchTerm]);

  const approveApplication = async (application: SellerApplication) => {
    if (!user?.id) {
      toast({ title: "Unable to approve application", description: "Admin session not found.", variant: "destructive" });
      return;
    }

    setActionLoading(application.id);
    try {
      console.log("================================");
      console.log("APPROVING SELLER");
      console.log("Application:", application);
      console.log("Admin:", user);
      console.log("Applicant User ID:", application.user_id);
      console.log("================================");

      console.log("STEP 1 START - Updating seller application", { userId: application.user_id });
      const { data: updatedApplication, error: applicationError } = await supabase
        .from("seller_applications")
        .update({ status: "approved", reviewed_at: new Date().toISOString(), reviewed_by: user.id })
        .eq("id", application.id)
        .select("id, user_id, status")
        .single();

      console.log("STEP 1 RESULT", { userId: application.user_id, data: updatedApplication, error: applicationError });

      if (applicationError) {
        console.error("STEP 1 FAILED", applicationError);
        throw applicationError;
      }
      if (!updatedApplication) {
        console.error("ZERO ROWS UPDATED", { step: 1, userId: application.user_id });
        throw new Error("STEP 1 failed: ZERO ROWS UPDATED");
      }

      console.log("STEP 2 START - Updating seller profile", { userId: application.user_id });
      const { data: updatedProfile, error: profileError } = await supabase
        .from("profiles")
        .update({ role: "seller", status: "active", is_active: true })
        .eq("id", application.user_id)
        .select("id, role, status, is_active")
        .single();

      console.log("STEP 2 RESULT", { userId: application.user_id, data: updatedProfile, error: profileError });
      console.log("STEP 2 PROFILE ROW", updatedProfile);

      if (profileError) {
        console.error("STEP 2 FAILED", profileError);
        throw profileError;
      }
      if (!updatedProfile) {
        console.error("ZERO ROWS UPDATED", { step: 2, userId: application.user_id });
        throw new Error("STEP 2 failed: ZERO ROWS UPDATED");
      }

      console.log("STEP 3 START - Fetching seller role", { userId: application.user_id });
      const { data: sellerRole, error: sellerRoleError } = await supabase
        .from("roles")
        .select("id")
        .eq("name", "seller")
        .single();

      console.log("STEP 3 RESULT", { userId: application.user_id, data: sellerRole, error: sellerRoleError });

      if (sellerRoleError) {
        console.error("STEP 3 FAILED", sellerRoleError);
        throw sellerRoleError;
      }
      console.log("Seller Role ID:", sellerRole.id);

      console.log("STEP 4 START - Inserting seller user role", { userId: application.user_id, sellerRoleId: sellerRole.id });
      const { data: userRole, error: userRoleError } = await supabase
        .from("user_roles")
        .upsert(
          { user_id: application.user_id, role_id: sellerRole.id },
          { onConflict: "user_id,role_id" },
        )
        .select("user_id, role_id")
        .single();

      console.log("STEP 4 RESULT", { userId: application.user_id, data: userRole, error: userRoleError });
      console.log("STEP 4 USER ROLE ROW", userRole);

      if (userRoleError) {
        console.error("STEP 4 FAILED", userRoleError);
        throw userRoleError;
      }
      if (!userRole) {
        console.error("ZERO ROWS UPDATED", { step: 4, userId: application.user_id });
        throw new Error("STEP 4 failed: ZERO ROWS UPDATED");
      }

      console.log("========== APPROVE SELLER ==========");
      console.log("Applicant User ID:", application.user_id);
      console.log("Checking whether a store already exists...");

      console.log("STEP 5 START - Checking existing store", { userId: application.user_id });
      const { data: existingStore, error: existingStoreError } = await supabase
        .from("stores")
        .select("id")
        .eq("seller_id", application.user_id)
        .limit(1)
        .maybeSingle();

      console.log("Existing store result:", existingStore);
      console.log("Existing store error:", existingStoreError);
      console.log("STEP 5 RESULT", { userId: application.user_id, data: existingStore, error: existingStoreError });

      if (existingStoreError) {
        console.error("STEP 5 FAILED", existingStoreError);
        throw existingStoreError;
      }

      if (!existingStore) {
        console.log("STEP 6 START - Fetching seller profile", { userId: application.user_id });
        const { data: sellerProfile, error: sellerProfileError } = await supabase
          .from("profiles")
          .select("full_name, email")
          .eq("id", application.user_id)
          .single();

        console.log("STEP 6 RESULT", { userId: application.user_id, data: sellerProfile, error: sellerProfileError });

        if (sellerProfileError) {
          console.error("STEP 6 FAILED", sellerProfileError);
          throw sellerProfileError;
        }

        const storeName = application.company_name?.trim()
          || `${sellerProfile.full_name || "Seller"}'s Store`;

        console.log("No existing store found.");
        console.log("Creating seller store...");
        console.log({
          seller_id: application.user_id,
          name: storeName,
          slug: createStoreSlug(storeName, application.user_id),
          status: "active",
          support_email: sellerProfile?.email,
        });

        console.log("STEP 6.5 START - Creating seller profile", { userId: application.user_id });
        const { data: existingSellerProfile, error: existingSellerProfileError } = await supabase
          .from("seller_profiles")
          .select("id")
          .eq("id", application.user_id)
          .maybeSingle();

        if (existingSellerProfileError) {
          console.error("STEP 6.5 FAILED", existingSellerProfileError);
          throw existingSellerProfileError;
        }

        let sellerProfileRow = existingSellerProfile;
        if (!sellerProfileRow) {
          const { data: createdSellerProfile, error: sellerProfileInsertError } = await supabase
            .from("seller_profiles")
            .insert({
              id: application.user_id,
              application_id: application.id,
              company_name: application.company_name,
              business_type: application.business_type,
              registration_number: application.registration_number,
              tax_id: application.tax_id,
              bank_details: application.bank_details,
              is_verified: true,
              verified_at: new Date().toISOString(),
            })
            .select("id, application_id, company_name, is_verified, verified_at")
            .single();

          if (sellerProfileInsertError) {
            console.error("STEP 6.5 FAILED", sellerProfileInsertError);
            throw sellerProfileInsertError;
          }

          sellerProfileRow = createdSellerProfile;
        }

        console.log("STEP 6.5 RESULT", { userId: application.user_id, data: sellerProfileRow, error: null });

        console.log("STEP 7 START - Inserting store", { userId: application.user_id, slug: createStoreSlug(storeName, application.user_id) });
        const { data: createdStore, error: storeError } = await supabase
          .from("stores")
          .insert({
            seller_id: application.user_id,
            name: storeName,
            slug: createStoreSlug(storeName, application.user_id),
            status: "active",
            support_email: sellerProfile.email || null,
          })
          .select("id, seller_id, name, slug, status, support_email")
          .single();

        console.log("Store insert result:", createdStore);
        console.log("Store insert error:", storeError);
        console.log("STEP 7 RESULT", { userId: application.user_id, data: createdStore, error: storeError });
        console.log("STEP 7 STORE ROW", createdStore);

        if (storeError) {
          console.error("STEP 7 FAILED", storeError);
          console.error("STORE INSERT FAILED", storeError);
          throw storeError;
        }
        if (!createdStore) {
          console.error("ZERO ROWS UPDATED", { step: 7, userId: application.user_id });
          throw new Error("STEP 7 failed: ZERO ROWS UPDATED");
        }

        console.log("Store created successfully.");
      }

      console.log("Seller approved:", application.user_id);
      console.log("Seller approval completed successfully.");
      console.log("===================================");
      toast({ title: "Success", description: "Seller application approved successfully." });
      setSelectedApplication(null);
      console.log("STEP 8 START - Refreshing pending applications", { userId: application.user_id });
      await fetchPendingApplications();
      console.log("STEP 8 RESULT", { data: undefined, error: undefined });
      console.log("SELLER APPROVAL COMPLETED");
    } catch (error: any) {
      console.error("SELLER APPROVAL FAILED");
      console.error(error);
      console.error("Failed to approve seller application:", error);
      toast({
        title: "Unable to approve application",
        description: error.message || "The seller approval workflow could not be completed.",
        variant: "destructive",
      });
    } finally {
      setActionLoading(null);
    }
  };

  const rejectApplication = async () => {
    if (!rejectTarget || !user?.id) return;
    const reason = rejectReason.trim();
    if (!reason) {
      toast({ title: "Rejection reason required", description: "Please provide a reason before rejecting.", variant: "destructive" });
      return;
    }

    setActionLoading(rejectTarget.id);
    const { error } = await supabase
      .from("seller_applications")
      .update({
        status: "rejected",
        rejection_reason: reason,
        reviewed_at: new Date().toISOString(),
        reviewed_by: user.id,
      })
      .eq("id", rejectTarget.id);

    if (error) {
      toast({ title: "Unable to reject application", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Application rejected", description: "The seller application has been rejected." });
      setRejectTarget(null);
      setRejectReason("");
      setSelectedApplication(null);
      await fetchPendingApplications();
    }
    setActionLoading(null);
  };

  const openRejectDialog = (application: SellerApplication) => {
    setRejectTarget(application);
    setRejectReason("");
  };

  return (
    <AdminLayout>
      <div className="space-y-8">
        <div className="bg-gradient-to-r from-green-50 to-emerald-50 rounded-xl p-8 border border-green-200">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
            <div>
              <h1 className="text-5xl md:text-6xl font-bold text-green-900">Seller Applications</h1>
              <p className="text-green-700 mt-2 text-lg md:text-xl">Review pending seller verification requests</p>
            </div>
            <div className="bg-white rounded-lg p-5 border border-green-200 shadow-sm md:text-right">
              <p className="text-sm text-gray-600 font-medium">Pending Review</p>
              <p className="text-4xl font-bold text-orange-600">{filteredApplications.length}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl p-5 border border-gray-200 shadow-md">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search by company, business type, registration number, or GST number..."
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              className="w-full pl-12 pr-5 py-4 border-2 border-gray-300 rounded-lg focus:outline-none focus:border-green-500 focus:ring-2 focus:ring-green-200 transition text-base placeholder-gray-400"
            />
          </div>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[...Array(6)].map((_, index) => <div key={index} className="h-80 rounded-xl border border-gray-100 bg-white p-5 shadow-md animate-pulse space-y-4"><div className="h-7 w-3/4 rounded bg-gray-300" /><div className="h-4 rounded bg-gray-200" /><div className="h-4 w-4/5 rounded bg-gray-200" /><div className="h-20 rounded bg-gray-100" /><div className="h-10 rounded bg-gray-200" /></div>)}
          </div>
        ) : filteredApplications.length === 0 ? (
          <div className="bg-white rounded-xl p-16 text-center shadow-md border border-gray-100">
            <Building2 className="h-20 w-20 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-700 text-xl font-semibold mb-2">{searchTerm ? "No applications match your search" : "No pending seller applications"}</p>
            <p className="text-gray-500 text-base">{searchTerm ? "Try adjusting your search criteria" : "All seller applications have been reviewed"}</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredApplications.map((application) => {
              const bank = application.bank_details || {};
              return <div key={application.id} className="bg-white rounded-xl shadow-md hover:shadow-xl transition-all duration-300 border border-gray-200 p-5 flex flex-col gap-4">
                <div className="flex items-start justify-between gap-3"><div><h2 className="font-bold text-xl text-gray-900">{application.company_name || "Unnamed company"}</h2><p className="mt-1 text-sm text-gray-600">{application.business_type || "Business type not provided"}</p></div><span className="bg-orange-100 text-orange-700 px-3 py-1 rounded-full text-xs font-bold capitalize">{application.status}</span></div>
                <div className="space-y-2 text-sm text-gray-700"><p><span className="font-semibold text-gray-800">Registration:</span> {application.registration_number || "Not provided"}</p><p><span className="font-semibold text-gray-800">GST / Tax ID:</span> {application.tax_id || "Not provided"}</p><p><span className="font-semibold text-gray-800">Bank:</span> {bank.bank_name || "Not provided"}</p><p><span className="font-semibold text-gray-800">Account:</span> {maskAccountNumber(bank.account_number)}</p><p className="flex items-center gap-2 text-xs text-gray-500 pt-1"><Calendar className="h-4 w-4" />Submitted {formatDate(application.created_at)}</p></div>
                <div className="flex gap-2 mt-auto pt-2"><Button variant="outline" onClick={() => setSelectedApplication(application)} className="flex-1 border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100"><Eye className="mr-2 h-4 w-4" />View</Button><Button onClick={() => void approveApplication(application)} disabled={actionLoading === application.id} className="flex-1 bg-green-600 hover:bg-green-700"><CheckCircle className="mr-2 h-4 w-4" />Approve</Button><Button variant="destructive" onClick={() => openRejectDialog(application)} disabled={actionLoading === application.id}><XCircle className="mr-2 h-4 w-4" />Reject</Button></div>
              </div>;
            })}
          </div>
        )}
      </div>

      <Dialog open={!!selectedApplication} onOpenChange={(open) => !open && setSelectedApplication(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          {selectedApplication && (() => { const bank = selectedApplication.bank_details || {}; return <><DialogHeader><DialogTitle className="text-3xl font-bold text-gray-900">{selectedApplication.company_name || "Seller application"}</DialogTitle><DialogDescription>Review the complete seller application details.</DialogDescription></DialogHeader><div className="grid gap-6 sm:grid-cols-2"><Detail label="Business type" value={selectedApplication.business_type} /><Detail label="Registration number" value={selectedApplication.registration_number} /><Detail label="GST / Tax ID" value={selectedApplication.tax_id} /><Detail label="Current status" value={selectedApplication.status} /><Detail label="Bank name" value={bank.bank_name} /><Detail label="Account holder" value={bank.account_holder_name} /><Detail label="Account number" value={maskAccountNumber(bank.account_number)} /><Detail label="IFSC" value={bank.ifsc_code} /><Detail label="Submitted date" value={formatDate(selectedApplication.created_at)} /></div><DialogFooter className="gap-2 sm:gap-2"><Button variant="destructive" onClick={() => openRejectDialog(selectedApplication)} disabled={actionLoading === selectedApplication.id}><XCircle className="mr-2 h-4 w-4" />Reject</Button><Button onClick={() => void approveApplication(selectedApplication)} disabled={actionLoading === selectedApplication.id}>{actionLoading === selectedApplication.id ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle className="mr-2 h-4 w-4" />}Approve application</Button></DialogFooter></>; })()}
        </DialogContent>
      </Dialog>

      <Dialog open={!!rejectTarget} onOpenChange={(open) => !open && setRejectTarget(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Reject seller application</DialogTitle><DialogDescription>Provide a clear reason the seller can address before applying again.</DialogDescription></DialogHeader>
          <textarea value={rejectReason} onChange={(event) => setRejectReason(event.target.value)} placeholder="Enter rejection reason..." className="min-h-28 w-full rounded-lg border border-gray-300 p-3 text-sm focus:outline-none focus:ring-2 focus:ring-red-200 focus:border-red-500" />
          <DialogFooter><Button variant="outline" onClick={() => setRejectTarget(null)}>Cancel</Button><Button variant="destructive" onClick={() => void rejectApplication()} disabled={actionLoading === rejectTarget?.id}>{actionLoading === rejectTarget?.id && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Confirm rejection</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}

function Detail({ label, value }: { label: string; value?: string | null }) {
  return <div className="rounded-lg border border-gray-100 bg-gray-50 p-4"><p className="text-xs font-semibold uppercase tracking-wide text-gray-500">{label}</p><p className="mt-1 break-words text-sm font-medium text-gray-900">{value || "Not provided"}</p></div>;
}
