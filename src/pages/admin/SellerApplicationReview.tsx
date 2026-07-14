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
    return <div>Loading...</div>;
  }

  if (!application) {
    return <div>Application not found.</div>;
  }

  return (
    <div>
      <ApplicationHeader
        storeName={application.store_name}
        ownerName={application.owner_full_name}
        status={application.status}
      />
      <StoreDetailsCard application={application} />
      <AddressCard
        title="Business Address"
        address={application.business_address}
      />

      <AddressCard
        title="Pickup Address"
        address={application.pickup_address}
      />

      <AddressCard
        title="Return Address"
        address={application.return_address}
      />
      <BankDetailsCard bank={application.seller_payout_accounts?.[0]} />
      <DocumentsCard documents={application.seller_documents || []} />
      <ActionButtons
        applicationId={application.id}
        status={application.status}
        onRefresh={loadApplication}
      />
    </div>
  );
}
