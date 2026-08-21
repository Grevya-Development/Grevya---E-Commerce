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

type SellerApplicationAddress = {
  id: string;
  application_id: string;
  address_type: string;
  address_line_1: string;
  address_line_2: string | null;
  landmark: string | null;
  city: string;
  state: string;
  pincode: string;
  country: string;
};

type SellerApplicationWarehouse = {
  id: string;
  application_id: string;
  warehouse_name: string | null;
  pickup_same_as_registered: boolean;
  pickup_address_id: string | null;
  is_primary: boolean;
};

type SellerApplicationStorefront = {
  application_id: string;
  store_name: string;
  store_slug: string;
  store_description: string;
  support_email: string;
  support_phone: string;
  fulfillment_method: string;
  processing_time: string;
  return_handling: string;
};

type SellerApplicationStatusHistory = {
  id: string;
  application_id: string;
  from_status: string | null;
  to_status: string;
  reason: string | null;
  changed_by: string | null;
  created_at: string;
};

type SellerApplication = {
  id: string;
  user_id: string;
  status: string;

  company_name: string | null;
  business_type: string | null;
  registration_number: string | null;
  tax_id: string | null;

  contact_person: string | null;
  business_email: string | null;
  business_phone: string | null;
  trade_name: string | null;
  pan_number: string | null;
  year_established: number | null;
  business_description: string | null;
  declaration_accepted_at: string | null;
  declaration_version: string | null;

  bank_details: BankDetails | null;

  created_at: string | null;
  reviewed_at?: string | null;
  reviewed_by?: string | null;
  rejection_reason?: string | null;

  application_addresses?: SellerApplicationAddress[];
  application_warehouse?: SellerApplicationWarehouse | null;
  application_storefront?: SellerApplicationStorefront | null;
  status_history?: SellerApplicationStatusHistory[];
};

const maskAccountNumber = (accountNumber?: string) => {
  if (!accountNumber) return "Not provided";

  return `${"*".repeat(
    Math.max(accountNumber.length - 4, 0),
  )}${accountNumber.slice(-4)}`;
};

const formatDate = (value: string | null) =>
  value
    ? new Date(value).toLocaleDateString("en-IN", {
        year: "numeric",
        month: "short",
        day: "numeric",
      })
    : "Not available";

const formatDateTime = (value: string | null) =>
  value
    ? new Date(value).toLocaleString("en-IN", {
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "Not available";

const formatOption = (value?: string | null) => {
  if (!value) return "Not provided";

  return value
    .replace(/_/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
};

const createStoreSlug = (companyName: string, sellerId: string) => {
  const name =
    companyName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 48) || "seller-store";

  return `${name}-${sellerId.replace(/-/g, "").slice(0, 8)}`;
};

export default function AdminSellerApplications() {
  const { user } = useAuth();

  const [applications, setApplications] = useState<SellerApplication[]>(
    [],
  );

  const [loading, setLoading] = useState(true);

  const [actionLoading, setActionLoading] = useState<string | null>(
    null,
  );

  const [selectedApplication, setSelectedApplication] =
    useState<SellerApplication | null>(null);

  const [rejectTarget, setRejectTarget] =
    useState<SellerApplication | null>(null);

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

  /*
   * Loads the complete application information when
   * the admin clicks View.
   */
  const fetchApplicationDetails = async (
    application: SellerApplication,
  ) => {
    try {
      const [
        addressesResult,
        warehouseResult,
        storefrontResult,
        historyResult,
      ] = await Promise.all([
        supabase
          .from("seller_application_addresses")
          .select("*")
          .eq("application_id", application.id)
          .order("address_type", { ascending: true }),

        supabase
          .from("seller_application_warehouses")
          .select("*")
          .eq("application_id", application.id)
          .maybeSingle(),

        supabase
          .from("seller_application_storefronts")
          .select("*")
          .eq("application_id", application.id)
          .maybeSingle(),

        supabase
          .from("seller_application_status_history")
          .select("*")
          .eq("application_id", application.id)
          .order("created_at", { ascending: false }),
      ]);

      const error =
        addressesResult.error ||
        warehouseResult.error ||
        storefrontResult.error ||
        historyResult.error;

      if (error) {
        throw error;
      }

      setSelectedApplication({
        ...application,
        application_addresses:
          addressesResult.data || [],
        application_warehouse:
          warehouseResult.data || null,
        application_storefront:
          storefrontResult.data || null,
        status_history:
          historyResult.data || [],
      });
    } catch (error: any) {
      console.error(
        "Failed to load seller application details:",
        error,
      );

      toast({
        title: "Unable to load application details",
        description:
          error?.message ||
          "Could not load the complete seller application.",
        variant: "destructive",
      });
    }
  };

  const filteredApplications = useMemo(() => {
    const search = searchTerm.trim().toLowerCase();

    if (!search) return applications;

    return applications.filter((application) =>
      [
        application.company_name,
        application.business_type,
        application.registration_number,
        application.tax_id,
        application.contact_person,
        application.business_email,
        application.business_phone,
        application.trade_name,
        application.pan_number,
      ].some((value) =>
        value?.toLowerCase().includes(search),
      ),
    );
  }, [applications, searchTerm]);

  const approveApplication = async (
    application: SellerApplication,
  ) => {
    if (!user?.id) {
      toast({
        title: "Unable to approve application",
        description: "Admin session not found.",
        variant: "destructive",
      });

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

      /*
       * STEP 1
       * Update seller application status
       */
      console.log(
        "STEP 1 START - Updating seller application",
        {
          userId: application.user_id,
        },
      );

      const {
        data: updatedApplication,
        error: applicationError,
      } = await supabase
        .from("seller_applications")
        .update({
          status: "approved",
          reviewed_at: new Date().toISOString(),
          reviewed_by: user.id,
        })
        .eq("id", application.id)
        .select("id, user_id, status")
        .single();

      console.log("STEP 1 RESULT", {
        userId: application.user_id,
        data: updatedApplication,
        error: applicationError,
      });

      if (applicationError) {
        console.error("STEP 1 FAILED", applicationError);
        throw applicationError;
      }

      if (!updatedApplication) {
        console.error("ZERO ROWS UPDATED", {
          step: 1,
          userId: application.user_id,
        });

        throw new Error(
          "STEP 1 failed: ZERO ROWS UPDATED",
        );
      }

      /*
       * STEP 2
       * Update seller profile
       */
      console.log(
        "STEP 2 START - Updating seller profile",
        {
          userId: application.user_id,
        },
      );

      const {
        data: updatedProfile,
        error: profileError,
      } = await supabase
        .from("profiles")
        .update({
          role: "seller",
          status: "active",
          is_active: true,
        })
        .eq("id", application.user_id)
        .select("id, role, status, is_active")
        .single();

      console.log("STEP 2 RESULT", {
        userId: application.user_id,
        data: updatedProfile,
        error: profileError,
      });

      console.log(
        "STEP 2 PROFILE ROW",
        updatedProfile,
      );

      if (profileError) {
        console.error("STEP 2 FAILED", profileError);
        throw profileError;
      }

      if (!updatedProfile) {
        console.error("ZERO ROWS UPDATED", {
          step: 2,
          userId: application.user_id,
        });

        throw new Error(
          "STEP 2 failed: ZERO ROWS UPDATED",
        );
      }

      /*
       * STEP 3
       * Fetch seller role
       */
      console.log(
        "STEP 3 START - Fetching seller role",
        {
          userId: application.user_id,
        },
      );

      const {
        data: sellerRole,
        error: sellerRoleError,
      } = await supabase
        .from("roles")
        .select("id")
        .eq("name", "seller")
        .single();

      console.log("STEP 3 RESULT", {
        userId: application.user_id,
        data: sellerRole,
        error: sellerRoleError,
      });

      if (sellerRoleError) {
        console.error(
          "STEP 3 FAILED",
          sellerRoleError,
        );

        throw sellerRoleError;
      }

      console.log(
        "Seller Role ID:",
        sellerRole.id,
      );

      /*
       * STEP 4
       * Insert seller user role
       */
      console.log(
        "STEP 4 START - Inserting seller user role",
        {
          userId: application.user_id,
          sellerRoleId: sellerRole.id,
        },
      );

      const {
        data: userRole,
        error: userRoleError,
      } = await supabase
        .from("user_roles")
        .upsert(
          {
            user_id: application.user_id,
            role_id: sellerRole.id,
          },
          {
            onConflict: "user_id,role_id",
          },
        )
        .select("user_id, role_id")
        .single();

      console.log("STEP 4 RESULT", {
        userId: application.user_id,
        data: userRole,
        error: userRoleError,
      });

      console.log(
        "STEP 4 USER ROLE ROW",
        userRole,
      );

      if (userRoleError) {
        console.error(
          "STEP 4 FAILED",
          userRoleError,
        );

        throw userRoleError;
      }

      if (!userRole) {
        console.error("ZERO ROWS UPDATED", {
          step: 4,
          userId: application.user_id,
        });

        throw new Error(
          "STEP 4 failed: ZERO ROWS UPDATED",
        );
      }

      /*
       * STEP 5
       * Check existing store
       */
      console.log(
        "========== APPROVE SELLER ==========",
      );

      console.log(
        "Applicant User ID:",
        application.user_id,
      );

      console.log(
        "Checking whether a store already exists...",
      );

      console.log(
        "STEP 5 START - Checking existing store",
        {
          userId: application.user_id,
        },
      );

      const {
        data: existingStore,
        error: existingStoreError,
      } = await supabase
        .from("stores")
        .select("id")
        .eq("seller_id", application.user_id)
        .limit(1)
        .maybeSingle();

      console.log(
        "Existing store result:",
        existingStore,
      );

      console.log(
        "Existing store error:",
        existingStoreError,
      );

      console.log("STEP 5 RESULT", {
        userId: application.user_id,
        data: existingStore,
        error: existingStoreError,
      });

      if (existingStoreError) {
        console.error(
          "STEP 5 FAILED",
          existingStoreError,
        );

        throw existingStoreError;
      }

      /*
       * STEP 6
       * Create store if it does not exist
       */
      if (!existingStore) {
        console.log(
          "STEP 6 START - Fetching seller profile",
          {
            userId: application.user_id,
          },
        );

        const {
          data: sellerProfile,
          error: sellerProfileError,
        } = await supabase
          .from("profiles")
          .select("full_name, email")
          .eq("id", application.user_id)
          .single();

        console.log("STEP 6 RESULT", {
          userId: application.user_id,
          data: sellerProfile,
          error: sellerProfileError,
        });

        if (sellerProfileError) {
          console.error(
            "STEP 6 FAILED",
            sellerProfileError,
          );

          throw sellerProfileError;
        }

        const storeName =
          application.company_name?.trim() ||
          `${sellerProfile.full_name || "Seller"}'s Store`;

        console.log(
          "No existing store found.",
        );

        console.log(
          "Creating seller store...",
        );

        console.log({
          seller_id: application.user_id,
          name: storeName,
          slug: createStoreSlug(
            storeName,
            application.user_id,
          ),
          status: "active",
          support_email: sellerProfile?.email,
        });

        /*
         * STEP 6.5
         * Create seller profile
         */
        console.log(
          "STEP 6.5 START - Creating seller profile",
          {
            userId: application.user_id,
          },
        );

        const {
          data: existingSellerProfile,
          error: existingSellerProfileError,
        } = await supabase
          .from("seller_profiles")
          .select("id")
          .eq("id", application.user_id)
          .maybeSingle();

        if (existingSellerProfileError) {
          console.error(
            "STEP 6.5 FAILED",
            existingSellerProfileError,
          );

          throw existingSellerProfileError;
        }

        let sellerProfileRow =
          existingSellerProfile;

        if (!sellerProfileRow) {
          const {
            data: createdSellerProfile,
            error: sellerProfileInsertError,
          } = await supabase
            .from("seller_profiles")
            .insert({
              id: application.user_id,
              application_id: application.id,
              company_name:
                application.company_name,
              business_type:
                application.business_type,
              registration_number:
                application.registration_number,
              tax_id: application.tax_id,
              bank_details:
                application.bank_details,
              is_verified: true,
              verified_at:
                new Date().toISOString(),
            })
            .select(
              "id, application_id, company_name, is_verified, verified_at",
            )
            .single();

          if (sellerProfileInsertError) {
            console.error(
              "STEP 6.5 FAILED",
              sellerProfileInsertError,
            );

            throw sellerProfileInsertError;
          }

          sellerProfileRow =
            createdSellerProfile;
        }

        console.log("STEP 6.5 RESULT", {
          userId: application.user_id,
          data: sellerProfileRow,
          error: null,
        });

        /*
         * STEP 7
         * Insert store
         */
        console.log(
          "STEP 7 START - Inserting store",
          {
            userId: application.user_id,
            slug: createStoreSlug(
              storeName,
              application.user_id,
            ),
          },
        );

        const {
          data: createdStore,
          error: storeError,
        } = await supabase
          .from("stores")
          .insert({
            seller_id: application.user_id,
            name: storeName,
            slug: createStoreSlug(
              storeName,
              application.user_id,
            ),
            status: "active",
            support_email:
              sellerProfile.email || null,
          })
          .select(
            "id, seller_id, name, slug, status, support_email",
          )
          .single();

        console.log(
          "Store insert result:",
          createdStore,
        );

        console.log(
          "Store insert error:",
          storeError,
        );

        console.log("STEP 7 RESULT", {
          userId: application.user_id,
          data: createdStore,
          error: storeError,
        });

        console.log(
          "STEP 7 STORE ROW",
          createdStore,
        );

        if (storeError) {
          console.error(
            "STEP 7 FAILED",
            storeError,
          );

          console.error(
            "STORE INSERT FAILED",
            storeError,
          );

          throw storeError;
        }

        if (!createdStore) {
          console.error(
            "ZERO ROWS UPDATED",
            {
              step: 7,
              userId: application.user_id,
            },
          );

          throw new Error(
            "STEP 7 failed: ZERO ROWS UPDATED",
          );
        }

        console.log(
          "Store created successfully.",
        );
      }

      console.log(
        "Seller approved:",
        application.user_id,
      );

      console.log(
        "Seller approval completed successfully.",
      );

      console.log(
        "===================================",
      );

      toast({
        title: "Success",
        description:
          "Seller application approved successfully.",
      });

      setSelectedApplication(null);

      console.log(
        "STEP 8 START - Refreshing pending applications",
        {
          userId: application.user_id,
        },
      );

      await fetchPendingApplications();

      console.log(
        "STEP 8 RESULT",
        {
          data: undefined,
          error: undefined,
        },
      );

      console.log(
        "SELLER APPROVAL COMPLETED",
      );
    } catch (error: any) {
      console.error(
        "SELLER APPROVAL FAILED",
      );

      console.error(error);

      console.error(
        "Failed to approve seller application:",
        error,
      );

      toast({
        title: "Unable to approve application",
        description:
          error.message ||
          "The seller approval workflow could not be completed.",
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
      toast({
        title: "Rejection reason required",
        description:
          "Please provide a reason before rejecting.",
        variant: "destructive",
      });

      return;
    }

    setActionLoading(rejectTarget.id);

    const { error } = await supabase
      .from("seller_applications")
      .update({
        status: "rejected",
        rejection_reason: reason,
        reviewed_at:
          new Date().toISOString(),
        reviewed_by: user.id,
      })
      .eq("id", rejectTarget.id);

    if (error) {
      toast({
        title: "Unable to reject application",
        description: error.message,
        variant: "destructive",
      });
    } else {
      toast({
        title: "Application rejected",
        description:
          "The seller application has been rejected.",
      });

      setRejectTarget(null);
      setRejectReason("");
      setSelectedApplication(null);

      await fetchPendingApplications();
    }

    setActionLoading(null);
  };

  const openRejectDialog = (
    application: SellerApplication,
  ) => {
    setRejectTarget(application);
    setRejectReason("");
  };

  return (
    <AdminLayout>
      <div className="space-y-8">

        {/* PAGE HEADER */}
        <div className="bg-gradient-to-r from-green-50 to-emerald-50 rounded-xl p-8 border border-green-200">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
            <div>
              <h1 className="text-5xl md:text-6xl font-bold text-green-900">
                Seller Applications
              </h1>

              <p className="text-green-700 mt-2 text-lg md:text-xl">
                Review pending seller verification requests
              </p>
            </div>

            <div className="bg-white rounded-lg p-5 border border-green-200 shadow-sm md:text-right">
              <p className="text-sm text-gray-600 font-medium">
                Pending Review
              </p>

              <p className="text-4xl font-bold text-orange-600">
                {filteredApplications.length}
              </p>
            </div>
          </div>
        </div>

        {/* SEARCH */}
        <div className="bg-white rounded-xl p-5 border border-gray-200 shadow-md">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />

            <input
              type="text"
              placeholder="Search by company, business type, registration number, GST, PAN, contact person, or email..."
              value={searchTerm}
              onChange={(event) =>
                setSearchTerm(event.target.value)
              }
              className="w-full pl-12 pr-5 py-4 border-2 border-gray-300 rounded-lg focus:outline-none focus:border-green-500 focus:ring-2 focus:ring-green-200 transition text-base placeholder-gray-400"
            />
          </div>
        </div>

        {/* APPLICATIONS */}
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[...Array(6)].map((_, index) => (
              <div
                key={index}
                className="h-80 rounded-xl border border-gray-100 bg-white p-5 shadow-md animate-pulse space-y-4"
              >
                <div className="h-7 w-3/4 rounded bg-gray-300" />

                <div className="h-4 rounded bg-gray-200" />

                <div className="h-4 w-4/5 rounded bg-gray-200" />

                <div className="h-20 rounded bg-gray-100" />

                <div className="h-10 rounded bg-gray-200" />
              </div>
            ))}
          </div>
        ) : filteredApplications.length === 0 ? (
          <div className="bg-white rounded-xl p-16 text-center shadow-md border border-gray-100">
            <Building2 className="h-20 w-20 text-gray-300 mx-auto mb-4" />

            <p className="text-gray-700 text-xl font-semibold mb-2">
              {searchTerm
                ? "No applications match your search"
                : "No pending seller applications"}
            </p>

            <p className="text-gray-500 text-base">
              {searchTerm
                ? "Try adjusting your search criteria"
                : "All seller applications have been reviewed"}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredApplications.map(
              (application) => {
                const bank =
                  application.bank_details || {};

                return (
                  <div
                    key={application.id}
                    className="bg-white rounded-xl shadow-md hover:shadow-xl transition-all duration-300 border border-gray-200 p-5 flex flex-col gap-4"
                  >
                    {/* CARD HEADER */}
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h2 className="font-bold text-xl text-gray-900">
                          {application.company_name ||
                            "Unnamed company"}
                        </h2>

                        <p className="mt-1 text-sm text-gray-600">
                          {application.business_type ||
                            "Business type not provided"}
                        </p>
                      </div>

                      <span className="bg-orange-100 text-orange-700 px-3 py-1 rounded-full text-xs font-bold capitalize">
                        {application.status}
                      </span>
                    </div>

                    {/* CARD DETAILS */}
                    <div className="space-y-2 text-sm text-gray-700">
                      <p>
                        <span className="font-semibold text-gray-800">
                          Registration:
                        </span>{" "}
                        {application.registration_number ||
                          "Not provided"}
                      </p>

                      <p>
                        <span className="font-semibold text-gray-800">
                          GST / Tax ID:
                        </span>{" "}
                        {application.tax_id ||
                          "Not provided"}
                      </p>

                      <p>
                        <span className="font-semibold text-gray-800">
                          Bank:
                        </span>{" "}
                        {bank.bank_name ||
                          "Not provided"}
                      </p>

                      <p>
                        <span className="font-semibold text-gray-800">
                          Account:
                        </span>{" "}
                        {maskAccountNumber(
                          bank.account_number,
                        )}
                      </p>

                      <p className="flex items-center gap-2 text-xs text-gray-500 pt-1">
                        <Calendar className="h-4 w-4" />

                        Submitted{" "}
                        {formatDate(
                          application.created_at,
                        )}
                      </p>
                    </div>

                    {/* ACTIONS */}
                    <div className="flex gap-2 mt-auto pt-2">
                      <Button
                        variant="outline"
                        onClick={() =>
                          void fetchApplicationDetails(
                            application,
                          )
                        }
                        className="flex-1 border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100"
                      >
                        <Eye className="mr-2 h-4 w-4" />
                        View
                      </Button>

                      <Button
                        onClick={() =>
                          void approveApplication(
                            application,
                          )
                        }
                        disabled={
                          actionLoading ===
                          application.id
                        }
                        className="flex-1 bg-green-600 hover:bg-green-700"
                      >
                        <CheckCircle className="mr-2 h-4 w-4" />
                        Approve
                      </Button>

                      <Button
                        variant="destructive"
                        onClick={() =>
                          openRejectDialog(
                            application,
                          )
                        }
                        disabled={
                          actionLoading ===
                          application.id
                        }
                      >
                        <XCircle className="mr-2 h-4 w-4" />
                        Reject
                      </Button>
                    </div>
                  </div>
                );
              },
            )}
          </div>
        )}
      </div>

      {/* ========================================================= */}
      {/* COMPLETE SELLER APPLICATION MODAL                         */}
      {/* ========================================================= */}

      <Dialog
        open={!!selectedApplication}
        onOpenChange={(open) => {
          if (!open) {
            setSelectedApplication(null);
          }
        }}
      >
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
          {selectedApplication &&
            (() => {
              const application =
                selectedApplication;

              const bank =
                application.bank_details || {};

              const registeredAddress =
                application.application_addresses?.find(
                  (address) =>
                    address.address_type ===
                    "registered",
                );

              const pickupAddress =
                application.application_addresses?.find(
                  (address) =>
                    address.address_type ===
                    "pickup",
                );

              const warehouse =
                application.application_warehouse;

              const storefront =
                application.application_storefront;

              return (
                <>
                  <DialogHeader>
                    <DialogTitle className="text-3xl font-bold text-gray-900">
                      {application.company_name ||
                        "Seller application"}
                    </DialogTitle>

                    <DialogDescription>
                      Complete seller application details
                    </DialogDescription>
                  </DialogHeader>

                  <div className="space-y-8">

                    {/* ================================================= */}
                    {/* BUSINESS INFORMATION                              */}
                    {/* ================================================= */}

                    <section>
                      <h3 className="mb-4 text-lg font-bold text-gray-900">
                        Business Information
                      </h3>

                      <div className="grid gap-4 sm:grid-cols-2">
                        <Detail
                          label="Company name"
                          value={
                            application.company_name
                          }
                        />

                        <Detail
                          label="Trade name"
                          value={
                            application.trade_name
                          }
                        />

                        <Detail
                          label="Business type"
                          value={
                            application.business_type
                          }
                        />

                        <Detail
                          label="Registration number"
                          value={
                            application.registration_number
                          }
                        />

                        <Detail
                          label="GST / Tax ID"
                          value={
                            application.tax_id
                          }
                        />

                        <Detail
                          label="PAN"
                          value={
                            application.pan_number
                          }
                        />

                        <Detail
                          label="Year established"
                          value={
                            application.year_established
                              ? String(
                                  application.year_established,
                                )
                              : null
                          }
                        />
                      </div>

                      <div className="mt-4">
                        <Detail
                          label="Business description"
                          value={
                            application.business_description
                          }
                        />
                      </div>
                    </section>

                    {/* ================================================= */}
                    {/* CONTACT INFORMATION                               */}
                    {/* ================================================= */}

                    <section>
                      <h3 className="mb-4 text-lg font-bold text-gray-900">
                        Contact Information
                      </h3>

                      <div className="grid gap-4 sm:grid-cols-2">
                        <Detail
                          label="Contact person"
                          value={
                            application.contact_person
                          }
                        />

                        <Detail
                          label="Business email"
                          value={
                            application.business_email
                          }
                        />

                        <Detail
                          label="Business phone"
                          value={
                            application.business_phone
                          }
                        />
                      </div>
                    </section>

                    {/* ================================================= */}
                    {/* BANK INFORMATION                                  */}
                    {/* ================================================= */}

                    <section>
                      <h3 className="mb-4 text-lg font-bold text-gray-900">
                        Bank / Payout Information
                      </h3>

                      <div className="grid gap-4 sm:grid-cols-2">
                        <Detail
                          label="Account holder"
                          value={
                            bank.account_holder_name
                          }
                        />

                        <Detail
                          label="Bank name"
                          value={
                            bank.bank_name
                          }
                        />

                        <Detail
                          label="Account number"
                          value={maskAccountNumber(
                            bank.account_number,
                          )}
                        />

                        <Detail
                          label="IFSC"
                          value={
                            bank.ifsc_code
                          }
                        />
                      </div>
                    </section>

                    {/* ================================================= */}
                    {/* REGISTERED ADDRESS                               */}
                    {/* ================================================= */}

                    <section>
                      <h3 className="mb-4 text-lg font-bold text-gray-900">
                        Registered Address
                      </h3>

                      {registeredAddress ? (
                        <AddressCard
                          address={
                            registeredAddress
                          }
                        />
                      ) : (
                        <EmptyDetail
                          text="Registered address not provided"
                        />
                      )}
                    </section>

                    {/* ================================================= */}
                    {/* PICKUP ADDRESS                                    */}
                    {/* ================================================= */}

                    <section>
                      <h3 className="mb-4 text-lg font-bold text-gray-900">
                        Pickup Address
                      </h3>

                      {warehouse?.pickup_same_as_registered ? (
                        <EmptyDetail
                          text="Same as registered address"
                        />
                      ) : pickupAddress ? (
                        <AddressCard
                          address={
                            pickupAddress
                          }
                        />
                      ) : (
                        <EmptyDetail
                          text="Pickup address not provided"
                        />
                      )}
                    </section>

                    {/* ================================================= */}
                    {/* WAREHOUSE                                         */}
                    {/* ================================================= */}

                    <section>
                      <h3 className="mb-4 text-lg font-bold text-gray-900">
                        Warehouse / Pickup Configuration
                      </h3>

                      {warehouse ? (
                        <div className="grid gap-4 sm:grid-cols-2">
                          <Detail
                            label="Warehouse name"
                            value={
                              warehouse.warehouse_name
                            }
                          />

                          <Detail
                            label="Primary warehouse"
                            value={
                              warehouse.is_primary
                                ? "Yes"
                                : "No"
                            }
                          />

                          <Detail
                            label="Pickup configuration"
                            value={
                              warehouse.pickup_same_as_registered
                                ? "Same as registered address"
                                : "Separate pickup address"
                            }
                          />
                        </div>
                      ) : (
                        <EmptyDetail
                          text="Warehouse information not provided"
                        />
                      )}
                    </section>

                    {/* ================================================= */}
                    {/* STOREFRONT                                       */}
                    {/* ================================================= */}

                    <section>
                      <h3 className="mb-4 text-lg font-bold text-gray-900">
                        Storefront & Fulfillment
                      </h3>

                      {storefront ? (
                        <>
                          <div className="grid gap-4 sm:grid-cols-2">
                            <Detail
                              label="Store name"
                              value={
                                storefront.store_name
                              }
                            />

                            <Detail
                              label="Store slug"
                              value={
                                storefront.store_slug
                              }
                            />

                            <Detail
                              label="Support email"
                              value={
                                storefront.support_email
                              }
                            />

                            <Detail
                              label="Support phone"
                              value={
                                storefront.support_phone
                              }
                            />

                            <Detail
                              label="Fulfillment method"
                              value={formatOption(
                                storefront.fulfillment_method,
                              )}
                            />

                            <Detail
                              label="Processing time"
                              value={formatOption(
                                storefront.processing_time,
                              )}
                            />

                            <Detail
                              label="Return handling"
                              value={formatOption(
                                storefront.return_handling,
                              )}
                            />
                          </div>

                          <div className="mt-4">
                            <Detail
                              label="Store description"
                              value={
                                storefront.store_description
                              }
                            />
                          </div>
                        </>
                      ) : (
                        <EmptyDetail
                          text="Storefront information not provided"
                        />
                      )}
                    </section>

                    {/* ================================================= */}
                    {/* APPLICATION INFORMATION                           */}
                    {/* ================================================= */}

                    <section>
                      <h3 className="mb-4 text-lg font-bold text-gray-900">
                        Application Information
                      </h3>

                      <div className="grid gap-4 sm:grid-cols-2">
                        <Detail
                          label="Application ID"
                          value={
                            application.id
                          }
                        />

                        <Detail
                          label="Applicant User ID"
                          value={
                            application.user_id
                          }
                        />

                        <Detail
                          label="Current status"
                          value={
                            application.status
                          }
                        />

                        <Detail
                          label="Submitted date"
                          value={formatDate(
                            application.created_at,
                          )}
                        />

                        <Detail
                          label="Submitted date & time"
                          value={formatDateTime(
                            application.created_at,
                          )}
                        />

                        <Detail
                          label="Reviewed date"
                          value={formatDateTime(
                            application.reviewed_at ||
                              null,
                          )}
                        />

                        <Detail
                          label="Declaration version"
                          value={
                            application.declaration_version
                          }
                        />

                        <Detail
                          label="Declaration accepted"
                          value={
                            application.declaration_accepted_at
                              ? formatDateTime(
                                  application.declaration_accepted_at,
                                )
                              : "Not accepted"
                          }
                        />

                        <Detail
                          label="Reviewed by"
                          value={
                            application.reviewed_by
                          }
                        />

                        <Detail
                          label="Rejection reason"
                          value={
                            application.rejection_reason
                          }
                        />
                      </div>
                    </section>

                    {/* ================================================= */}
                    {/* STATUS HISTORY                                    */}
                    {/* ================================================= */}

                    {application.status_history &&
                      application.status_history
                        .length > 0 && (
                        <section>
                          <h3 className="mb-4 text-lg font-bold text-gray-900">
                            Application Status History
                          </h3>

                          <div className="space-y-3">
                            {application.status_history.map(
                              (history) => (
                                <div
                                  key={history.id}
                                  className="rounded-lg border border-gray-200 bg-gray-50 p-4"
                                >
                                  <div className="flex flex-wrap items-center justify-between gap-2">
                                    <p className="font-semibold text-gray-900">
                                      {history.from_status ||
                                        "Created"}{" "}
                                      →{" "}
                                      {history.to_status}
                                    </p>

                                    <p className="text-xs text-gray-500">
                                      {formatDateTime(
                                        history.created_at,
                                      )}
                                    </p>
                                  </div>

                                  {history.reason && (
                                    <p className="mt-2 text-sm text-gray-600">
                                      {history.reason}
                                    </p>
                                  )}

                                  {history.changed_by && (
                                    <p className="mt-1 text-xs text-gray-500">
                                      Changed by:{" "}
                                      {
                                        history.changed_by
                                      }
                                    </p>
                                  )}
                                </div>
                              ),
                            )}
                          </div>
                        </section>
                      )}

                  </div>

                  {/* MODAL ACTIONS */}
                  <DialogFooter className="gap-2 sm:gap-2">
                    <Button
                      variant="destructive"
                      onClick={() =>
                        openRejectDialog(
                          application,
                        )
                      }
                      disabled={
                        actionLoading ===
                        application.id
                      }
                    >
                      <XCircle className="mr-2 h-4 w-4" />
                      Reject
                    </Button>

                    <Button
                      onClick={() =>
                        void approveApplication(
                          application,
                        )
                      }
                      disabled={
                        actionLoading ===
                        application.id
                      }
                      className="bg-green-600 hover:bg-green-700"
                    >
                      {actionLoading ===
                      application.id ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <CheckCircle className="mr-2 h-4 w-4" />
                      )}

                      Approve application
                    </Button>
                  </DialogFooter>
                </>
              );
            })()}
        </DialogContent>
      </Dialog>

      {/* ========================================================= */}
      {/* REJECT DIALOG                                             */}
      {/* ========================================================= */}

      <Dialog
        open={!!rejectTarget}
        onOpenChange={(open) => {
          if (!open) {
            setRejectTarget(null);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Reject seller application
            </DialogTitle>

            <DialogDescription>
              Provide a clear reason the seller can
              address before applying again.
            </DialogDescription>
          </DialogHeader>

          <textarea
            value={rejectReason}
            onChange={(event) =>
              setRejectReason(event.target.value)
            }
            placeholder="Enter rejection reason..."
            className="min-h-28 w-full rounded-lg border border-gray-300 p-3 text-sm focus:outline-none focus:ring-2 focus:ring-red-200 focus:border-red-500"
          />

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() =>
                setRejectTarget(null)
              }
            >
              Cancel
            </Button>

            <Button
              variant="destructive"
              onClick={() =>
                void rejectApplication()
              }
              disabled={
                actionLoading ===
                rejectTarget?.id
              }
            >
              {actionLoading ===
                rejectTarget?.id && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}

              Confirm rejection
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}

/* ============================================================= */
/* DETAIL COMPONENT                                               */
/* ============================================================= */

function Detail({
  label,
  value,
}: {
  label: string;
  value?: string | null;
}) {
  return (
    <div className="rounded-lg border border-gray-100 bg-gray-50 p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
        {label}
      </p>

      <p className="mt-1 break-words text-sm font-medium text-gray-900 whitespace-pre-wrap">
        {value || "Not provided"}
      </p>
    </div>
  );
}

/* ============================================================= */
/* ADDRESS COMPONENT                                             */
/* ============================================================= */

function AddressCard({
  address,
}: {
  address: SellerApplicationAddress;
}) {
  return (
    <div className="rounded-lg border border-gray-200 bg-gray-50 p-5">
      <div className="grid gap-4 sm:grid-cols-2">

        <Detail
          label="Address type"
          value={formatOption(
            address.address_type,
          )}
        />

        <Detail
          label="Country"
          value={address.country}
        />

        <Detail
          label="Address line 1"
          value={address.address_line_1}
        />

        <Detail
          label="Address line 2"
          value={address.address_line_2}
        />

        <Detail
          label="Landmark"
          value={address.landmark}
        />

        <Detail
          label="City"
          value={address.city}
        />

        <Detail
          label="State"
          value={address.state}
        />

        <Detail
          label="Pincode"
          value={address.pincode}
        />
      </div>
    </div>
  );
}

/* ============================================================= */
/* EMPTY DETAIL COMPONENT                                        */
/* ============================================================= */

function EmptyDetail({
  text,
}: {
  text: string;
}) {
  return (
    <div className="rounded-lg border border-dashed border-gray-300 bg-gray-50 p-5">
      <p className="text-sm text-gray-500">
        {text}
      </p>
    </div>
  );
}