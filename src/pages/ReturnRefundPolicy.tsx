import React, { useState } from "react";
import PolicyLayout from "@/components/PolicyLayout";
import {
  ShieldCheck,
  Truck,
  RotateCcw,
  HelpCircle,
  AlertTriangle,
  CheckCircle,
  FileUp,
  X,
} from "lucide-react";
import { motion } from "framer-motion";
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

const issueTypes = [
  ["wrong_product", "Wrong product"],
  ["damaged_product", "Damaged product"],
  ["missing_item", "Missing item"],
  ["refund_request", "Refund request"],
] as const;

const ReturnRefundPolicy = () => {
  const { user, profile } = useAuth();
  const [supportOpen, setSupportOpen] = useState(false);
  const [orderId, setOrderId] = useState("");
  const [issueType, setIssueType] = useState("wrong_product");
  const [description, setDescription] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  const submitSupportRequest = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!user || !orderId.trim() || !description.trim()) return;

    setSubmitting(true);
    setError(null);
    const { data: claim, error: insertError } = await supabase
      .from("return_refund_claims")
      .insert({
        order_id: orderId.trim(),
        customer_id: user.id,
        issue_type: issueType,
        description: description.trim(),
      })
      .select("id")
      .single();

    if (insertError || !claim) {
      setError(
        insertError?.message ||
          "We could not submit your request. Check the Order ID and try again.",
      );
      setSubmitting(false);
      return;
    }

    const evidenceUrls: string[] = [];
    for (const file of files) {
      const path = `${user.id}/${claim.id}/${file.name}`;
      const { error: uploadError } = await supabase.storage
        .from("return-refund-evidence")
        .upload(path, file);
      if (uploadError) {
        await supabase.from("return_refund_claims").delete().eq("id", claim.id);
        setError(`Upload failed for ${file.name}: ${uploadError.message}`);
        setSubmitting(false);
        return;
      }
      evidenceUrls.push(path);
    }

    await supabase
      .from("return_refund_claims")
      .update({ evidence_urls: evidenceUrls })
      .eq("id", claim.id);
    setSubmitted(true);
    setOrderId("");
    setDescription("");
    setFiles([]);
    setSubmitting(false);
  };

  return (
    <PolicyLayout title="Return & Refund Policy" updated="June 2026">
      {/* Intro Editorial section */}
      <div className="space-y-4 mb-10">
        <p className="text-base md:text-lg text-neutral-600 leading-relaxed font-serif italic border-l-2 border-[#A68D65]/40 pl-4 py-1">
          "At Grevya Naturals, each formulation is a fresh, botanical
          composition handcrafted in small, active batches. To preserve the
          purity, clinical hygiene, and freshness of our organic lifestyle
          goods, we maintain a refined, rigorous policy regarding returns and
          fulfillment."
        </p>
      </div>

      {/* SECTION 1 */}
      <section className="space-y-4">
        <h2 className="font-serif text-2xl font-bold text-[#33381C]">
          1. The Purity & Hygiene Directive
        </h2>
        <div className="grid md:grid-cols-[auto_1fr] gap-4 p-5 rounded-2xl bg-[#FBF7F1] border border-[#A68D65]/10 items-start">
          <ShieldCheck className="w-8 h-8 text-[#A68D65] mt-1 shrink-0" />
          <div className="space-y-2">
            <p className="font-semibold text-neutral-800 text-sm">
              Why all sales are final
            </p>
            <p className="text-neutral-600 text-xs leading-relaxed">
              Because our skincare, wellness, and lifestyle preparations are
              organic, chemical-preservative-free, and highly sensitive to
              environmental factors, we do not allow returns or refunds for any
              products once they have left our controlled-temperature
              fulfillment center. This policy guarantees that every patron
              receives a guaranteed untouched, untampered, and fresh product.
            </p>
          </div>
        </div>
      </section>

      {/* SECTION 2 */}
      <section className="space-y-4 mt-8">
        <h2 className="font-serif text-2xl font-bold text-[#33381C]">
          2. Transit & Damage Indemnity
        </h2>
        <p className="text-neutral-600 text-sm leading-relaxed">
          While all items are final sale, we insure every shipment to ensure
          peace of mind. If your package encounters misfortune during transit,
          we take complete responsibility for resolving the issue immediately.
        </p>
        <div className="grid md:grid-cols-2 gap-4">
          <div className="p-5 rounded-2xl border border-red-100 bg-red-50/20 space-y-2">
            <div className="flex items-center gap-2 text-red-800 font-bold text-xs uppercase tracking-wide">
              <AlertTriangle className="w-4 h-4 text-red-600" /> Damaged
              Shipments
            </div>
            <p className="text-neutral-600 text-xs leading-relaxed">
              If a glass jar, botanical vial, or packaging arrives compromised,
              leaked, or broken, please notify our concierge within 48 hours of
              receipt. We will process a complimentary replacement or refund.
            </p>
          </div>
          <div className="p-5 rounded-2xl border border-emerald-100 bg-emerald-50/20 space-y-2">
            <div className="flex items-center gap-2 text-emerald-800 font-bold text-xs uppercase tracking-wide">
              <Truck className="w-4 h-4 text-emerald-600" /> Delivery
              Discrepancies
            </div>
            <p className="text-neutral-600 text-xs leading-relaxed">
              Should our logistics partners report your order as delivered, but
              it has not arrived, or if a shipment is lost in transit, please
              contact us immediately to initiate a trace and coordinate a
              resolution.
            </p>
          </div>
        </div>
      </section>

      {/* SECTION 3 */}
      <section className="space-y-4 mt-8">
        <h2 className="font-serif text-2xl font-bold text-[#33381C]">
          3. Fulfillment & Accuracy
        </h2>
        <div className="p-5 rounded-2xl bg-[#FBF7F1] border border-[#A68D65]/10 space-y-3">
          <div className="flex items-center gap-2 font-bold text-[#33381C] text-sm">
            <RotateCcw className="w-4 h-4 text-[#A68D65]" /> Incorrect Items
            Dispatched
          </div>
          <p className="text-neutral-600 text-xs leading-relaxed">
            In the rare event that our artisan packaging team dispatches an
            incorrect blend, size, or product, we will immediately ship the
            correct item to you at zero cost. To preserve your convenience, we
            do not require you to ship the incorrect item back to us.
          </p>
        </div>
      </section>

      {/* SECTION 4 */}
      <section className="space-y-4 mt-8">
        <h2 className="font-serif text-2xl font-bold text-[#33381C]">
          4. Resolution Blueprint
        </h2>
        <p className="text-neutral-600 text-sm leading-relaxed font-medium">
          If you need to submit a claim for a transit-damaged or incorrect
          shipment, follow our three-step resolution pathway:
        </p>

        <div className="grid md:grid-cols-3 gap-4 pt-2">
          {[
            {
              step: "Step 01",
              title: "Document & Verify",
              desc: "Take a clear photograph or brief video of the damaged item and the shipping label on the box.",
            },
            {
              step: "Step 02",
              title: "Connect with Concierge",
              desc: "Email info@grevya.com within 48 hours of delivery. Include your Order ID and attach your documentation.",
            },
            {
              step: "Step 03",
              title: "Dispatch & Resolve",
              desc: "Our support team will verify the claim and dispatch a replacement package or process a refund within 24 hours.",
            },
          ].map((item, idx) => (
            <div
              key={idx}
              className="p-5 rounded-2xl border border-[#A68D65]/12 bg-white flex flex-col justify-between shadow-2xs hover:shadow-sm transition-all"
            >
              <div>
                <span className="text-[10px] font-extrabold uppercase tracking-widest text-[#A68D65] block mb-2">
                  {item.step}
                </span>
                <h4 className="font-serif font-bold text-base text-[#33381C] mb-2">
                  {item.title}
                </h4>
                <p className="text-neutral-500 text-xs leading-relaxed">
                  {item.desc}
                </p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* FAQ CTA */}
      <div className="mt-12 p-6 rounded-[2rem] bg-[#33381C] text-white flex flex-col sm:flex-row items-center justify-between gap-4 border border-[#A68D65]/30">
        <div className="space-y-1 text-center sm:text-left">
          <h4 className="font-serif font-bold text-lg text-[#F7EEE4] flex items-center justify-center sm:justify-start gap-2">
            <HelpCircle className="w-5 h-5 text-[#A68D65]" /> Have any
            questions?
          </h4>
          <p className="text-white/60 text-xs">
            Our customer support concierge is ready to assist you at all times.
          </p>
        </div>
        <Button
          type="button"
          onClick={() => {
            setSupportOpen(true);
            setSubmitted(false);
            setError(null);
          }}
          className="bg-[#F7EEE4] text-[#33381C] hover:bg-[#EAE2D5] font-extrabold uppercase tracking-wide text-xs shadow-md hover:-translate-y-0.5"
        >
          Email Support
        </Button>
      </div>

      <Dialog open={supportOpen} onOpenChange={setSupportOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto border-[#E7E0D4] bg-[#FBF7F0] sm:max-w-xl">
          <DialogHeader>
            <DialogTitle className="font-serif text-2xl text-[#33381C]">
              Contact customer support
            </DialogTitle>
            <DialogDescription>
              Submit your issue here. Our team will review the order and update
              you in the website.
            </DialogDescription>
          </DialogHeader>
          {!user ? (
            <div className="rounded-xl bg-amber-50 p-4 text-sm text-amber-800">
              Please sign in before submitting a support request.
            </div>
          ) : submitted ? (
            <div className="space-y-4 rounded-2xl bg-emerald-50 p-6 text-center text-emerald-800">
              <CheckCircle className="mx-auto h-10 w-10" />
              <p className="font-bold">Request submitted successfully</p>
              <p className="text-sm">
                The admin team will review your evidence and update the claim
                status on your order page.
              </p>
              <Button
                type="button"
                onClick={() => setSupportOpen(false)}
                className="bg-[#33381C]"
              >
                Close
              </Button>
            </div>
          ) : (
            <form onSubmit={submitSupportRequest} className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-3">
                <label className="text-sm font-semibold text-[#777D70]">
                  Order ID
                  <input
                    required
                    value={orderId}
                    onChange={(event) => setOrderId(event.target.value)}
                    placeholder="Paste your order ID"
                    className="mt-2 w-full rounded-xl border border-[#DDE3DA] bg-white px-3 py-2.5 text-sm text-[#4D5528]"
                  />
                </label>
                <label className="text-sm font-semibold text-[#777D70]">
                  Customer name
                  <input
                    readOnly
                    value={
                      profile?.full_name || profile?.username || "Customer"
                    }
                    className="mt-2 w-full rounded-xl border border-[#DDE3DA] bg-[#F3F4EF] px-3 py-2.5 text-sm text-[#4D5528]"
                  />
                </label>
                <label className="text-sm font-semibold text-[#777D70]">
                  Email
                  <input
                    readOnly
                    value={profile?.email || user.email || ""}
                    className="mt-2 w-full rounded-xl border border-[#DDE3DA] bg-[#F3F4EF] px-3 py-2.5 text-sm text-[#4D5528]"
                  />
                </label>
              </div>
              <label className="block text-sm font-semibold text-[#777D70]">
                Issue type
                <select
                  value={issueType}
                  onChange={(event) => setIssueType(event.target.value)}
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
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                  placeholder="Tell us what happened..."
                  className="mt-2 min-h-28 bg-white"
                />
              </label>
              <label className="block text-sm font-semibold text-[#777D70]">
                <span className="flex items-center gap-2">
                  <FileUp className="h-4 w-4" /> Photo or video evidence
                </span>
                <input
                  type="file"
                  accept="image/*,video/*"
                  multiple
                  onChange={(event) => {
                    const selectedFiles = Array.from(event.target.files || []);
                    setFiles((currentFiles) => {
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
                {files.length > 0 && (
                  <div className="mt-2 space-y-1">
                    {files.map((file) => (
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
                              setFiles((currentFiles) =>
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
              {error && (
                <p className="rounded-xl bg-rose-50 p-3 text-sm text-rose-700">
                  {error}
                </p>
              )}
              <Button
                type="submit"
                disabled={submitting || !description.trim()}
                className="w-full bg-[#33381C] hover:bg-[#262A14]"
              >
                {submitting ? "Submitting request..." : "Submit request"}
              </Button>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </PolicyLayout>
  );
};

export default ReturnRefundPolicy;
