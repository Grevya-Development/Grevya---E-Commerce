import { useEffect, useState } from "react";
import {
  CheckCircle2,
  FileText,
  RefreshCw,
  RotateCcw,
  XCircle,
} from "lucide-react";
import AdminLayout from "@/layouts/AdminLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/components/ui/use-toast";
import { supabase } from "@/lib/supabaseClient";

interface Claim {
  id: string;
  order_id: string;
  customer_id: string;
  issue_type: string;
  description: string;
  evidence_urls: string[];
  status: string;
  resolution?: string | null;
  admin_notes?: string | null;
  created_at: string;
}

const issueLabels: Record<string, string> = {
  wrong_product: "Wrong product",
  damaged_product: "Damaged product",
  missing_item: "Missing item",
  refund_request: "Refund request",
};

const statusClass = (status: string) => {
  if (status === "approved" || status === "resolved")
    return "bg-emerald-50 text-emerald-700";
  if (status === "rejected") return "bg-rose-50 text-rose-700";
  return "bg-amber-50 text-amber-700";
};

export default function AdminReturnRequests() {
  const [claims, setClaims] = useState<Claim[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Claim | null>(null);
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  const fetchClaims = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("return_refund_claims")
      .select("*")
      .order("created_at", { ascending: false });
    if (error)
      toast({
        title: "Could not load requests",
        description: error.message,
        variant: "destructive",
      });
    const rawClaims = (data || []) as Claim[];
    const claimsWithLinks = await Promise.all(
      rawClaims.map(async (claim) => {
        const paths = claim.evidence_urls || [];
        if (paths.length === 0) return claim;
        const { data: signedFiles } = await supabase.storage
          .from("return-refund-evidence")
          .createSignedUrls(paths, 60 * 60);
        return {
          ...claim,
          evidence_urls: (signedFiles || []).map(
            (file, index) => file.signedUrl || paths[index],
          ),
        };
      }),
    );
    setClaims(claimsWithLinks);
    setLoading(false);
  };

  useEffect(() => {
    fetchClaims();
    const channel = supabase
      .channel("return-refund-claims-live")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "return_refund_claims" },
        fetchClaims,
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const openClaim = (claim: Claim) => {
    setSelected(claim);
    setNotes(claim.admin_notes || "");
  };

  const updateClaim = async (
    status: "approved" | "rejected",
    resolution: "replacement" | "refund" | "none",
  ) => {
    if (!selected) return;
    setSaving(true);
    const { error } = await supabase
      .from("return_refund_claims")
      .update({
        status,
        resolution,
        admin_notes: notes.trim() || null,
        reviewed_by: (await supabase.auth.getUser()).data.user?.id,
      })
      .eq("id", selected.id);
    if (error) {
      toast({
        title: "Request update failed",
        description: error.message,
        variant: "destructive",
      });
    } else {
      await supabase.from("notifications").insert({
        user_id: selected.customer_id,
        type: "return_refund",
        message:
          status === "approved"
            ? `Your ${issueLabels[selected.issue_type].toLowerCase()} claim has been approved for ${resolution}.`
            : "Your return/refund claim was reviewed. Please check the claim notes for details.",
      });
      toast({
        title: "Request updated",
        description: "The customer can now see the decision in their order.",
      });
      setSelected(null);
      await fetchClaims();
    }
    setSaving(false);
  };

  return (
    <AdminLayout>
      <div className="mx-auto max-w-6xl space-y-8">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#7B8064]">
              Customer care
            </p>
            <h1 className="mt-2 font-serif text-4xl font-bold text-[#33381C]">
              Return / Refund Requests
            </h1>
            <p className="mt-2 text-sm text-[#777D70]">
              Review evidence, choose a resolution, and keep the customer
              informed.
            </p>
          </div>
          <Button variant="outline" onClick={fetchClaims} disabled={loading}>
            <RefreshCw className={loading ? "animate-spin" : ""} /> Refresh
          </Button>
        </div>

        {loading ? (
          <div className="h-48 animate-pulse rounded-2xl bg-white" />
        ) : claims.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-[#D8DED2] bg-white p-16 text-center text-sm text-[#8A877C]">
            No return or refund requests yet.
          </div>
        ) : (
          <div className="space-y-3">
            {claims.map((claim) => (
              <button
                key={claim.id}
                onClick={() => openClaim(claim)}
                className="grid w-full gap-4 rounded-2xl border border-[#E5E8E3] bg-white p-5 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md md:grid-cols-[1fr_auto_auto] md:items-center"
              >
                <div>
                  <p className="font-semibold text-[#303526]">
                    {issueLabels[claim.issue_type] || claim.issue_type}
                  </p>
                  <p className="mt-1 text-xs text-[#8A877C]">
                    Order #{claim.order_id.slice(0, 8)} ·{" "}
                    {new Date(claim.created_at).toLocaleString()}
                  </p>
                  <p className="mt-2 line-clamp-1 text-sm text-[#777D70]">
                    {claim.description}
                  </p>
                </div>
                <span className="text-xs text-[#8A877C]">
                  {claim.evidence_urls?.length || 0} attachment(s)
                </span>
                <Badge
                  className={`w-fit rounded-full capitalize ${statusClass(claim.status)}`}
                >
                  {claim.status.replace(/_/g, " ")}
                </Badge>
              </button>
            ))}
          </div>
        )}
      </div>

      <Dialog
        open={Boolean(selected)}
        onOpenChange={(open) => !open && setSelected(null)}
      >
        <DialogContent className="max-h-[90vh] overflow-y-auto border-[#E7E0D4] bg-[#FBF7F0] sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle className="font-serif text-2xl text-[#33381C]">
              Review customer request
            </DialogTitle>
            <DialogDescription>
              Order #{selected?.order_id.slice(0, 8)} ·{" "}
              {selected &&
                (issueLabels[selected.issue_type] || selected.issue_type)}
            </DialogDescription>
          </DialogHeader>
          {selected && (
            <div className="space-y-5">
              <div className="rounded-xl border border-[#E5E8E3] bg-white p-4 text-sm leading-6 text-[#4D5528]">
                {selected.description}
              </div>
              {selected.evidence_urls?.length > 0 && (
                <div className="space-y-2">
                  <p className="flex items-center gap-2 text-sm font-semibold text-[#303526]">
                    <FileText className="h-4 w-4" /> Evidence
                  </p>
                  {selected.evidence_urls.map((url) => (
                    <a
                      key={url}
                      href={url}
                      target="_blank"
                      rel="noreferrer"
                      className="block truncate text-sm text-[#59632F] underline"
                    >
                      {url}
                    </a>
                  ))}
                </div>
              )}
              <div>
                <label className="text-sm font-semibold text-[#777D70]">
                  Admin notes
                </label>
                <Textarea
                  value={notes}
                  onChange={(event) => setNotes(event.target.value)}
                  placeholder="Record verification details or next steps..."
                  className="mt-2 min-h-24 bg-white"
                />
              </div>
              <div className="grid gap-2 sm:grid-cols-3">
                <Button
                  onClick={() => updateClaim("approved", "replacement")}
                  disabled={saving}
                  className="bg-[#33381C]"
                >
                  <CheckCircle2 /> Approve replacement
                </Button>
                <Button
                  onClick={() => updateClaim("approved", "refund")}
                  disabled={saving}
                  variant="outline"
                >
                  <RotateCcw /> Approve refund
                </Button>
                <Button
                  onClick={() => updateClaim("rejected", "none")}
                  disabled={saving}
                  variant="outline"
                  className="text-rose-700"
                >
                  <XCircle /> Reject claim
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}
