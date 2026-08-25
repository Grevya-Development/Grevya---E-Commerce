import React, { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  CheckCircle2,
  Circle,
  FileUp,
  Package,
  RotateCcw,
  Truck,
  X,
} from "lucide-react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/lib/supabaseClient";

const statuses = [
  "pending",
  "confirmed",
  "processing",
  "shipped",
  "out_for_delivery",
  "delivered",
];

const issueTypes = [
  ["wrong_product", "Wrong product"],
  ["damaged_product", "Damaged product"],
  ["missing_item", "Missing item"],
  ["refund_request", "Refund request"],
] as const;

interface Claim {
  id: string;
  issue_type: string;
  status: string;
  resolution?: string | null;
  admin_notes?: string | null;
  created_at: string;
}

const OrderDetail = () => {
  const { id } = useParams();
  const { user, profile } = useAuth();
  const [order, setOrder] = useState<any>(null);
  const [claims, setClaims] = useState<Claim[]>([]);
  const [loading, setLoading] = useState(true);
  const [claimOpen, setClaimOpen] = useState(false);
  const [claimType, setClaimType] = useState("wrong_product");
  const [claimDescription, setClaimDescription] = useState("");
  const [claimFiles, setClaimFiles] = useState<File[]>([]);
  const [claimSubmitting, setClaimSubmitting] = useState(false);
  const [claimError, setClaimError] = useState<string | null>(null);

  const activeIndex = useMemo(() => {
    const status = order?.status || order?.order_status || "pending";
    return Math.max(0, statuses.indexOf(status));
  }, [order]);
  const isDelivered = (order?.status || order?.order_status) === "delivered";

  useEffect(() => {
    if (!user || !id) return;

    const fetchOrder = async () => {
      try {
        const [{ data, error }, { data: historyData }, { data: claimData }] =
          await Promise.all([
            supabase
              .from("orders")
              .select("*, order_items(*)")
              .eq("id", id)
              .eq("user_id", user.id)
              .maybeSingle(),
            supabase
              .from("order_status_history")
              .select("*")
              .eq("order_id", id)
              .order("created_at", { ascending: true }),
            supabase
              .from("return_refund_claims")
              .select("id,issue_type,status,resolution,admin_notes,created_at")
              .eq("order_id", id)
              .order("created_at", { ascending: false }),
          ]);

        if (!error && data) {
          setOrder({
            ...data,
            history: historyData || [],
          });
        }
        setClaims((claimData || []) as Claim[]);
      } catch (err) {
        console.warn("Failed to load order history log:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchOrder();

    const channel = supabase
      .channel(`order:${id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "orders",
          filter: `id=eq.${id}`,
        },
        fetchOrder,
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "return_refund_claims",
          filter: `order_id=eq.${id}`,
        },
        fetchOrder,
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [id, user]);

  const submitClaim = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!user || !order || !claimDescription.trim()) return;
    setClaimSubmitting(true);
    setClaimError(null);

    const { data: claim, error: insertError } = await supabase
      .from("return_refund_claims")
      .insert({
        order_id: order.id,
        customer_id: user.id,
        issue_type: claimType,
        description: claimDescription.trim(),
      })
      .select("id,issue_type,status,resolution,admin_notes,created_at")
      .single();

    if (insertError || !claim) {
      setClaimError(
        insertError?.message || "We could not submit your request.",
      );
      setClaimSubmitting(false);
      return;
    }

    const evidenceUrls: string[] = [];
    for (const file of claimFiles) {
      const path = `${user.id}/${claim.id}/${file.name}`;
      const { error: uploadError } = await supabase.storage
        .from("return-refund-evidence")
        .upload(path, file, { upsert: false });
      if (uploadError) {
        await supabase.from("return_refund_claims").delete().eq("id", claim.id);
        setClaimError(`Upload failed for ${file.name}: ${uploadError.message}`);
        setClaimSubmitting(false);
        return;
      }
      evidenceUrls.push(path);
    }

    const { error: updateError } = await supabase
      .from("return_refund_claims")
      .update({ evidence_urls: evidenceUrls })
      .eq("id", claim.id);
    if (updateError) {
      setClaimError(updateError.message);
    } else {
      setClaims((current) => [claim as Claim, ...current]);
      setClaimOpen(false);
      setClaimDescription("");
      setClaimFiles([]);
    }
    setClaimSubmitting(false);
  };

  return (
    <div className="flex min-h-screen flex-col">
      <Navbar />
      <main className="flex-grow bg-cream/30 py-12">
        <div className="container mx-auto max-w-5xl px-4">
          {loading ? (
            <div className="h-96 animate-pulse rounded-[2rem] bg-white" />
          ) : !order ? (
            <div className="rounded-[2rem] bg-white p-12 text-center shadow-sm">
              <Package className="mx-auto mb-4 h-12 w-12 text-green-800" />
              <h1 className="text-2xl font-bold">Order not found</h1>
              <Button
                asChild
                className="mt-6 rounded-xl bg-green-800 hover:bg-green-900"
              >
                <Link to="/orders">Back to orders</Link>
              </Button>
            </div>
          ) : (
            <div className="space-y-6">
              <section className="rounded-[2rem] bg-white p-6 shadow-sm md:p-8">
                <div className="flex flex-col justify-between gap-4 md:flex-row md:items-start">
                  <div>
                    <p className="text-sm font-bold uppercase tracking-[0.2em] text-green-700">
                      Order details
                    </p>
                    <h1 className="text-3xl font-extrabold text-neutral-900">
                      #{String(order.id).slice(0, 8)}
                    </h1>
                    <p className="mt-1 text-neutral-500">
                      Placed on {new Date(order.created_at).toLocaleString()}
                    </p>
                  </div>
                  <div className="text-left md:text-right">
                    <p className="text-2xl font-extrabold text-green-800">
                      Rs {Number(order.total_amount || 0).toFixed(2)}
                    </p>
                    <p className="text-sm capitalize text-neutral-500">
                      Payment: {order.payment_status || "pending"}
                    </p>
                  </div>
                </div>
              </section>

              {order.status === "cancelled" ||
              order.order_status === "cancelled" ? (
                <section className="rounded-[2rem] bg-white p-6 shadow-sm md:p-8 border-t-4 border-red-500">
                  <div className="mb-6 flex items-center gap-3">
                    <Truck className="h-6 w-6 text-red-600" />
                    <h2 className="text-xl font-bold text-neutral-900">
                      Order Status
                    </h2>
                  </div>
                  <div className="mb-6 rounded-2xl bg-red-50 p-5 text-red-900 border border-red-100">
                    <p className="font-bold text-lg mb-1">
                      This order has been cancelled
                    </p>
                    <p className="text-sm opacity-90">
                      If you have already paid, a refund will be processed to
                      your original payment method within 5-7 business days.
                    </p>
                  </div>
                  <div className="grid gap-4 grid-cols-2 max-w-md">
                    <div className="relative rounded-2xl border border-neutral-100 p-4 bg-neutral-50">
                      <CheckCircle2 className="mb-3 h-6 w-6 text-neutral-500" />
                      <p className="text-sm font-bold text-neutral-600">
                        Pending
                      </p>
                    </div>
                    <div className="relative rounded-2xl border border-red-100 p-4 bg-red-50/50">
                      <CheckCircle2 className="mb-3 h-6 w-6 text-red-600" />
                      <p className="text-sm font-bold text-red-700">
                        Cancelled
                      </p>
                    </div>
                  </div>
                </section>
              ) : (
                <section className="rounded-[2rem] bg-white p-6 shadow-sm md:p-8">
                  <div className="mb-6 flex items-center gap-3">
                    <Truck className="h-6 w-6 text-green-800" />
                    <h2 className="text-xl font-bold">Live tracking</h2>
                  </div>
                  <div className="grid gap-4 md:grid-cols-6">
                    {statuses.map((status, index) => {
                      const complete = index <= activeIndex;
                      return (
                        <div
                          key={status}
                          className={`relative rounded-2xl border p-4 ${complete ? "border-green-100 bg-green-50/10" : "border-neutral-100"}`}
                        >
                          {complete ? (
                            <CheckCircle2 className="mb-3 h-6 w-6 text-green-700" />
                          ) : (
                            <Circle className="mb-3 h-6 w-6 text-neutral-300" />
                          )}
                          <p
                            className={`text-sm font-bold capitalize ${complete ? "text-green-800" : "text-neutral-400"}`}
                          >
                            {status.replace(/_/g, " ")}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                  <p className="mt-5 text-sm text-neutral-500">
                    Estimated delivery:{" "}
                    {order.estimated_delivery
                      ? new Date(order.estimated_delivery).toLocaleDateString()
                      : "2-3 business days after dispatch"}
                  </p>
                  {isDelivered && (
                    <div className="mt-6 flex flex-col gap-3 border-t border-neutral-100 pt-5 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <p className="text-sm font-bold text-neutral-800">
                          Need to send something back?
                        </p>
                        <p className="mt-1 text-xs text-neutral-500">
                          Review our return window and eligibility details.
                        </p>
                      </div>
                      <Button
                        variant="outline"
                        onClick={() => setClaimOpen(true)}
                        className="w-full rounded-xl border-green-800/20 text-green-800 hover:bg-green-50 sm:w-auto"
                      >
                        <RotateCcw className="mr-2 h-4 w-4" />
                        Request return or refund
                      </Button>
                    </div>
                  )}
                </section>
              )}

              {claims.length > 0 && (
                <section className="rounded-[2rem] border border-[#A68D65]/20 bg-[#FBF7F0] p-6 shadow-sm md:p-8">
                  <div className="mb-4 flex items-center justify-between gap-3">
                    <div>
                      <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#7B8064]">
                        Customer care
                      </p>
                      <h2 className="mt-1 text-xl font-bold text-[#33381C]">
                        Your support requests
                      </h2>
                    </div>
                    <FileUp className="h-5 w-5 text-[#A68D65]" />
                  </div>
                  <div className="space-y-3">
                    {claims.map((claim) => (
                      <div
                        key={claim.id}
                        className="rounded-2xl border border-white bg-white p-4"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <p className="text-sm font-bold capitalize text-[#303526]">
                            {claim.issue_type.replace(/_/g, " ")}
                          </p>
                          <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-bold capitalize text-amber-700">
                            {claim.status.replace(/_/g, " ")}
                          </span>
                        </div>
                        {claim.resolution && (
                          <p className="mt-2 text-sm text-[#59632F]">
                            Resolution: {claim.resolution}
                          </p>
                        )}
                        {claim.admin_notes && (
                          <p className="mt-1 text-sm text-[#777D70]">
                            {claim.admin_notes}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                </section>
              )}

              {/* Order Status History Timeline Audit */}
              {order.history && order.history.length > 0 && (
                <section className="rounded-[2rem] bg-white p-6 shadow-sm md:p-8 border border-neutral-100/50">
                  <h2 className="mb-6 text-xl font-bold text-neutral-900">
                    Activity History Log
                  </h2>
                  <div className="relative border-l border-neutral-100 pl-6 space-y-6 ml-3">
                    {order.history.map((h: any) => (
                      <div key={h.id} className="relative">
                        <span className="absolute -left-[31px] top-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-green-100 ring-4 ring-white">
                          <span className="h-2 w-2 rounded-full bg-green-700" />
                        </span>
                        <div>
                          <p className="text-sm font-bold text-neutral-800 capitalize">
                            {h.status.replace(/_/g, " ")}
                          </p>
                          <p className="text-xs text-neutral-500 mt-0.5">
                            {h.notes}
                          </p>
                          <p className="text-[10px] text-neutral-400 mt-1">
                            {new Date(h.created_at).toLocaleString()}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              )}

              <section className="rounded-[2rem] bg-white p-6 shadow-sm md:p-8 border border-neutral-100/50">
                <h2 className="mb-4 text-xl font-bold">Product summary</h2>
                <div className="space-y-3">
                  {(order.order_items || []).map((item: any) => (
                    <div
                      key={item.id || item.product_id}
                      className="flex items-center justify-between gap-4 rounded-2xl bg-neutral-50 p-4"
                    >
                      <div className="flex items-center gap-4">
                        {item.product_image && (
                          <img
                            src={item.product_image}
                            alt={item.product_name || "Product"}
                            className="h-16 w-16 rounded-xl object-cover border border-neutral-200/50 bg-white"
                          />
                        )}
                        <div>
                          <p className="font-bold text-neutral-800">
                            {item.product_name || `Product #${item.product_id}`}
                          </p>
                          <p className="text-sm text-neutral-500">
                            Qty {item.quantity}
                          </p>
                        </div>
                      </div>
                      <p className="font-bold text-green-800 whitespace-nowrap">
                        Rs {Number(item.price || 0).toFixed(2)}
                      </p>
                    </div>
                  ))}
                </div>
              </section>
            </div>
          )}
        </div>
      </main>
      <Footer />
      <Dialog open={claimOpen} onOpenChange={setClaimOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto border-[#E7E0D4] bg-[#FBF7F0] sm:max-w-xl">
          <DialogHeader>
            <DialogTitle className="font-serif text-2xl text-[#33381C]">
              Request return or refund
            </DialogTitle>
            <DialogDescription>
              We will review your order and reply with the next steps.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={submitClaim} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-3">
              <label className="text-sm font-semibold text-[#777D70]">
                Order ID
                <input
                  readOnly
                  value={order?.id || ""}
                  className="mt-2 w-full rounded-xl border border-[#DDE3DA] bg-[#F3F4EF] px-3 py-2.5 text-sm text-[#4D5528]"
                />
              </label>
              <label className="text-sm font-semibold text-[#777D70]">
                Customer name
                <input
                  readOnly
                  value={profile?.full_name || profile?.username || "Customer"}
                  className="mt-2 w-full rounded-xl border border-[#DDE3DA] bg-[#F3F4EF] px-3 py-2.5 text-sm text-[#4D5528]"
                />
              </label>
              <label className="text-sm font-semibold text-[#777D70]">
                Email
                <input
                  readOnly
                  value={profile?.email || user?.email || ""}
                  className="mt-2 w-full rounded-xl border border-[#DDE3DA] bg-[#F3F4EF] px-3 py-2.5 text-sm text-[#4D5528]"
                />
              </label>
            </div>
            <label className="block text-sm font-semibold text-[#777D70]">
              Issue type
              <select
                value={claimType}
                onChange={(event) => setClaimType(event.target.value)}
                className="mt-2 w-full rounded-xl border border-[#DDE3DA] bg-white px-3 py-2.5 text-sm text-[#343A20]"
              >
                {issueTypes.map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-sm font-semibold text-[#777D70]">
              Description
              <Textarea
                required
                value={claimDescription}
                onChange={(event) => setClaimDescription(event.target.value)}
                placeholder="Tell us what happened with your order..."
                className="mt-2 min-h-28 bg-white"
              />
            </label>
            <label className="block text-sm font-semibold text-[#777D70]">
              Photo or video evidence
              <input
                type="file"
                accept="image/*,video/*"
                multiple
                onChange={(event) => {
                  const selectedFiles = Array.from(event.target.files || []);
                  setClaimFiles((currentFiles) => {
                    const combinedFiles = [...currentFiles, ...selectedFiles];
                    return combinedFiles
                      .filter(
                        (file, index, allFiles) =>
                          allFiles.findIndex(
                            (candidate) =>
                              candidate.name === file.name &&
                              candidate.size === file.size &&
                              candidate.lastModified === file.lastModified,
                          ) === index,
                      )
                      .slice(0, 5);
                  });
                  event.currentTarget.value = "";
                }}
                className="mt-2 block w-full rounded-xl border border-dashed border-[#A68D65]/40 bg-white p-3 text-sm text-[#777D70]"
              />
              <span className="mt-1 block text-xs font-normal text-[#8A877C]">
                Up to 5 photos or videos.
              </span>
              {claimFiles.length > 0 && (
                <div className="mt-2 space-y-1">
                  {claimFiles.map((file) => (
                    <div
                      key={`${file.name}-${file.lastModified}`}
                      className="flex items-center justify-between gap-2 rounded-lg bg-green-50 px-3 py-1.5 text-xs font-medium text-green-800"
                    >
                      <span className="truncate">{file.name}</span>
                      <button
                        type="button"
                        title={`Remove ${file.name}`}
                        aria-label={`Remove ${file.name}`}
                        onClick={() =>
                          setClaimFiles((currentFiles) =>
                            currentFiles.filter((currentFile) => currentFile !== file),
                          )
                        }
                        className="shrink-0 rounded-full p-1 text-green-900 transition hover:bg-green-100"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </label>
            {claimError && (
              <p className="rounded-xl bg-rose-50 p-3 text-sm text-rose-700">
                {claimError}
              </p>
            )}
            <Button
              type="submit"
              disabled={claimSubmitting || !claimDescription.trim()}
              className="w-full bg-[#33381C] hover:bg-[#262A14]"
            >
              {claimSubmitting ? "Submitting request..." : "Submit request"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default OrderDetail;
