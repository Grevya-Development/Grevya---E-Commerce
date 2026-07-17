import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/lib/supabaseClient";
import { useToast } from "@/hooks/use-toast";
import ApplicationHeader from "@/components/admin/seller_application/ApplicationHeader";
import StoreDetailsCard from "@/components/admin/seller_application/StoreDetailsCard";
import AddressCard from "@/components/admin/seller_application/AddressCard";
import BankDetailsCard from "@/components/admin/seller_application/BankDetailsCard";
import DocumentsCard from "@/components/admin/seller_application/DocumentsCard";
import ActionButtons from "@/components/admin/seller_application/ActionButtons";

export default function SellerApplicationReview() {
  const { id } = useParams();
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [application, setApplication] = useState<any>(null);

  useEffect(() => {
    loadApplication();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const loadApplication = async () => {
    if (!id) return;

    setLoading(true);

    try {
      const { data, error } = await supabase
        .from("seller_applications")
        .select(
          `
          *,
          seller_payout_accounts!seller_payout_accounts_application_id_fkey(*),
          seller_documents(*),
          seller_policy_acceptance(*)
        `,
        )
        .eq("id", id)
        .single();

      if (error) throw error;

      setApplication(data);
    } catch (error: any) {
      toast({
        title: "Unable to load application",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background px-4 py-16">
        <div className="mx-auto flex max-w-4xl items-center justify-center rounded-[32px] border border-stone-200 bg-white/90 p-10 shadow-[0_30px_80px_-40px_rgba(15,23,42,0.12)]">
          <div className="text-center">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-green-100 text-green-700">
              <svg
                viewBox="0 0 24 24"
                className="h-7 w-7 animate-spin"
                fill="currentColor"
              >
                <path d="M12 2a10 10 0 100 20 10 10 0 000-20zm1 15.93V18a1 1 0 11-2 0v-.07A8.001 8.001 0 014.07 13H4a1 1 0 110-2h.07A8.001 8.001 0 0111 4.07V4a1 1 0 112 0v.07A8.001 8.001 0 0119.93 11H20a1 1 0 110 2h-.07A8.001 8.001 0 0113 17.93z"></path>
              </svg>
            </div>
            <p className="text-lg font-semibold text-slate-700">
              Loading application details…
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (!application) {
    return (
      <div className="min-h-screen bg-background px-4 py-16">
        <div className="mx-auto max-w-2xl rounded-[32px] border border-stone-200 bg-white/90 p-10 text-center shadow-[0_30px_80px_-40px_rgba(15,23,42,0.12)]">
          <p className="text-xl font-semibold text-slate-900">
            Application not found
          </p>
          <p className="mt-3 text-sm text-slate-600">
            We couldn't locate the requested seller application.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background px-4 pt-8 pb-14 md:pt-10 md:pb-16">
      <div className="mx-auto max-w-6xl">
        <div className="mb-6 rounded-[32px] border border-stone-200 bg-white/95 p-6 shadow-[0_30px_70px_-35px_rgba(15,23,42,0.14)] backdrop-blur md:p-8">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-sm uppercase tracking-[0.24em] text-slate-500">
                Seller applications
              </p>
              <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-900">
                Review seller submission
              </h1>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600">
                Review application details, verify documents, and take action
                with confidence.
              </p>
            </div>
            <div className="rounded-full bg-slate-100 px-4 py-2 text-sm font-medium text-slate-700">
              Application ID: {application.id}
            </div>
          </div>
        </div>

        <div className="mb-8 rounded-[32px] border border-stone-200 bg-white/95 p-6 shadow-[0_30px_70px_-35px_rgba(15,23,42,0.14)] backdrop-blur md:p-8">
          <ApplicationHeader
            storeName={application.store_name}
            ownerName={application.owner_full_name}
            status={application.status}
          />

          <div className="mt-6 grid gap-4 lg:grid-cols-[1fr_0.65fr]">
            <div className="rounded-[28px] border border-stone-200 bg-[#FAF7F2] p-5">
              <p className="text-sm uppercase tracking-[0.2em] text-slate-500">
                Application overview
              </p>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <div>
                  <p className="text-sm text-slate-500">Submitted</p>
                  <p className="font-semibold text-slate-900">
                    {application.submitted_at
                      ? new Date(application.submitted_at).toLocaleString()
                      : "Not submitted"}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-slate-500">Documents</p>
                  <p className="font-semibold text-slate-900">
                    {application.seller_documents?.length || 0} uploaded
                  </p>
                </div>
              </div>
            </div>

            <div className="rounded-[28px] border border-stone-200 bg-white p-5">
              <p className="text-sm uppercase tracking-[0.2em] text-slate-500">
                Policy acceptance
              </p>
              <p className="mt-4 text-slate-700">
                {application.seller_policy_acceptance?.length
                  ? "Seller agreement recorded"
                  : "Seller has not accepted the agreement yet."}
              </p>
            </div>
          </div>
        </div>

        <div className="grid gap-6">
          <StoreDetailsCard application={application} />

          <div className="grid gap-6 lg:grid-cols-2">
            <AddressCard
              title="Business Address"
              address={application.business_address}
            />
            <AddressCard
              title="Pickup Address"
              address={application.pickup_address}
            />
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <AddressCard
              title="Return Address"
              address={application.return_address}
            />
            <BankDetailsCard bank={application.seller_payout_accounts?.[0]} />
          </div>

          <DocumentsCard documents={application.seller_documents || []} />
          <ActionButtons
            applicationId={application.id}
            status={application.status}
            onRefresh={loadApplication}
          />
        </div>
      </div>
    </div>
  );
}
