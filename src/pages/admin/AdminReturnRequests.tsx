import { useEffect, useState } from "react";
import { useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import type { DateRange } from "react-day-picker";
import {
  AlertTriangle,
  CheckCircle2,
  Clock3,
  CalendarDays,
  FileText,
  Image as ImageIcon,
  Mail,
  Package,
  Phone,
  RefreshCw,
  RotateCcw,
  XCircle,
} from "lucide-react";
import AdminLayout from "@/layouts/AdminLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
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
  customer_name?: string;
  customer_email?: string;
  customer_phone?: string | null;
  product_names?: string;
  order_total?: number | null;
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

const issueIcon = (issueType: string) => {
  if (issueType === "damaged_product") return AlertTriangle;
  if (issueType === "refund_request") return RotateCcw;
  if (issueType === "missing_item") return Package;
  return FileText;
};

const statusLabel = (status: string) => status.replace(/_/g, " ");

export default function AdminReturnRequests() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [claims, setClaims] = useState<Claim[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Claim | null>(null);
  const [proofUrl, setProofUrl] = useState<string | null>(null);
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [dateRange, setDateRange] = useState<DateRange | undefined>();

  const activeFilter = searchParams.get("filter") || "all";

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
    const customerIds = [
      ...new Set(rawClaims.map((claim) => claim.customer_id)),
    ];
    const orderIds = [...new Set(rawClaims.map((claim) => claim.order_id))];
    const [{ data: profiles }, { data: orders }] = await Promise.all([
      customerIds.length
        ? supabase
            .from("profiles")
            .select("id,full_name,username,email,phone")
            .in("id", customerIds)
        : Promise.resolve({ data: [] }),
      orderIds.length
        ? supabase
            .from("orders")
            .select("id,total_amount,order_items(product_name)")
            .in("id", orderIds)
        : Promise.resolve({ data: [] }),
    ]);
    const profilesById = new Map(
      (
        (profiles || []) as Array<{
          id: string;
          full_name?: string | null;
          username?: string | null;
          email?: string | null;
          phone?: string | null;
        }>
      ).map((profile) => [profile.id, profile]),
    );
    const ordersById = new Map(
      (
        (orders || []) as Array<{
          id: string;
          total_amount?: number | null;
          order_items?: Array<{ product_name?: string | null }>;
        }>
      ).map((order) => [order.id, order]),
    );
    const claimsWithLinks = await Promise.all(
      rawClaims.map(async (claim) => {
        const paths = claim.evidence_urls || [];
        const [{ data: signedFiles }] = paths.length
          ? await Promise.all([
              supabase.storage
                .from("return-refund-evidence")
                .createSignedUrls(paths, 60 * 60),
            ])
          : [{ data: null }];
        const profile = profilesById.get(claim.customer_id);
        const order = ordersById.get(claim.order_id);
        return {
          ...claim,
          evidence_urls: paths.map(
            (path, index) => signedFiles?.[index]?.signedUrl || path,
          ),
          customer_name: profile?.full_name || profile?.username || "Customer",
          customer_email: profile?.email || "Email unavailable",
          customer_phone: profile?.phone,
          product_names:
            order?.order_items
              ?.map((item) => item.product_name)
              .filter(Boolean)
              .join(", ") || "Order items unavailable",
          order_total: order?.total_amount,
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
            ? `Your ${issueLabels[selected.issue_type].toLowerCase()} claim has been approved for ${resolution}. [return_refund_order:${selected.order_id}]`
            : `Your return/refund claim was reviewed. Please check the claim notes for details. [return_refund_order:${selected.order_id}]`,
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

  const filteredClaims = useMemo(() => {
    let filtered = claims;

    if (activeFilter === "open") {
      filtered = filtered.filter(
        (claim) => !["approved", "rejected", "resolved"].includes(claim.status),
      );
    } else if (activeFilter === "approved") {
      filtered = filtered.filter((claim) =>
        ["approved", "resolved"].includes(claim.status),
      );
    } else if (activeFilter === "needs-decision") {
      filtered = filtered.filter((claim) => claim.status === "submitted");
    }

    if (dateRange?.from) {
      const start = new Date(dateRange.from);
      start.setHours(0, 0, 0, 0);
      const end = new Date(dateRange.to || dateRange.from);
      end.setHours(23, 59, 59, 999);
      filtered = filtered.filter((claim) => {
        const submittedAt = new Date(claim.created_at).getTime();
        return submittedAt >= start.getTime() && submittedAt <= end.getTime();
      });
    }

    return filtered;
  }, [activeFilter, claims, dateRange]);

  const dateFilterLabel = dateRange?.from
    ? dateRange.to
      ? `${dateRange.from.toLocaleDateString("en-IN", { day: "numeric", month: "short" })} - ${dateRange.to.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}`
      : dateRange.from.toLocaleDateString("en-IN", {
          day: "numeric",
          month: "short",
          year: "numeric",
        })
    : "Filter by date";

  const navigateToFilter = (filter: string) => {
    if (filter === "all") {
      setSearchParams({});
    } else {
      setSearchParams({ filter });
    }
  };

  return (
    <AdminLayout>
      <div className="mx-auto max-w-6xl space-y-7">
        <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#7B8064]">
              Customer care
            </p>
            <h1 className="mt-2 font-serif text-3xl font-bold text-[#33381C] md:text-4xl">
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

        <div className="grid gap-3 sm:grid-cols-3">
          {[
            [
              "Open requests",
              claims.filter(
                (claim) =>
                  !["approved", "rejected", "resolved"].includes(claim.status),
              ).length,
              "bg-[#F5F7F0]",
              Clock3,
            ],
            [
              "Approved",
              claims.filter((claim) =>
                ["approved", "resolved"].includes(claim.status),
              ).length,
              "bg-emerald-50",
              CheckCircle2,
            ],
            [
              "Needs decision",
              claims.filter((claim) => claim.status === "submitted").length,
              "bg-amber-50",
              AlertTriangle,
            ],
          ].map(([label, count, background, Icon], index) => {
            const filter = ["open", "approved", "needs-decision"][index];
            const StatIcon = Icon as typeof Clock3;
            return (
              <button
                key={label as string}
                type="button"
                onClick={() => navigateToFilter(filter)}
                className={`flex items-center justify-between rounded-2xl border border-[#E5E8E3] ${background as string} px-5 py-4`}
                aria-pressed={activeFilter === filter}
              >
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[#777D70]">
                    {label as string}
                  </p>
                  <p className="mt-1 text-2xl font-bold text-[#33381C]">
                    {count as number}
                  </p>
                </div>
                <div className="flex flex-col items-end gap-2">
                  <StatIcon className="h-5 w-5 text-[#7B8064]" />
                  <span className="text-[10px] font-bold uppercase tracking-wider text-[#59632F]">
                    View
                  </span>
                </div>
              </button>
            );
          })}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#E5E8E3] pb-3">
          <p className="text-sm text-[#777D70]">
            {activeFilter === "all"
              ? "All requests"
              : `Showing ${activeFilter.replace(/-/g, " ")}`}{" "}
            · {filteredClaims.length} request
            {filteredClaims.length === 1 ? "" : "s"}
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  className={`h-9 rounded-xl border-[#DDE2D9] bg-white text-xs font-semibold ${dateRange?.from ? "text-[#33381C]" : "text-[#777D70]"}`}
                >
                  <CalendarDays className="h-4 w-4" />
                  {dateFilterLabel}
                </Button>
              </PopoverTrigger>
              <PopoverContent
                align="end"
                className="w-auto border-[#E7E0D4] bg-[#FBF7F0] p-0"
              >
                <div className="border-b border-[#E5E8E3] px-4 py-3">
                  <p className="text-sm font-semibold text-[#33381C]">
                    Filter by submission date
                  </p>
                  <p className="mt-1 text-xs text-[#8A877C]">
                    Choose one day or a date range.
                  </p>
                </div>
                <Calendar
                  mode="range"
                  selected={dateRange}
                  onSelect={setDateRange}
                  numberOfMonths={1}
                  initialFocus
                />
                {dateRange?.from && (
                  <div className="flex justify-end border-t border-[#E5E8E3] p-2">
                    <button
                      type="button"
                      onClick={() => setDateRange(undefined)}
                      className="rounded-lg px-3 py-1.5 text-xs font-semibold text-[#59632F] transition hover:bg-[#F1F3E8]"
                    >
                      Clear dates
                    </button>
                  </div>
                )}
              </PopoverContent>
            </Popover>
            {activeFilter !== "all" && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => navigateToFilter("all")}
                className="text-[#59632F]"
              >
                View all requests
              </Button>
            )}
          </div>
        </div>

        {loading ? (
          <div className="h-48 animate-pulse rounded-2xl bg-white" />
        ) : filteredClaims.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-[#D8DED2] bg-white p-16 text-center text-sm text-[#8A877C]">
            No requests in this view.
          </div>
        ) : (
          <div className="space-y-3">
            {filteredClaims.map((claim) => (
              <button
                key={claim.id}
                onClick={() => openClaim(claim)}
                className="group grid w-full gap-4 rounded-2xl border border-[#E5E8E3] bg-white p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-[#A68D65]/40 hover:shadow-md md:grid-cols-[auto_1fr_auto] md:items-center md:p-5"
              >
                <div
                  className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ${statusClass(claim.status)}`}
                >
                  {(() => {
                    const Icon = issueIcon(claim.issue_type);
                    return <Icon className="h-5 w-5" />;
                  })()}
                </div>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-semibold text-[#303526]">
                      {issueLabels[claim.issue_type] || claim.issue_type}
                    </p>
                    <span className="text-[11px] font-medium text-[#A09B90]">
                      #{claim.id.slice(0, 8)}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-[#8A877C]">
                    Order #{claim.order_id.slice(0, 8)} · Submitted{" "}
                    {new Date(claim.created_at).toLocaleDateString("en-IN", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                    })}
                  </p>
                  <p className="mt-2 line-clamp-1 text-sm text-[#777D70]">
                    {claim.description}
                  </p>
                  <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-[#8A877C]">
                    <span className="font-semibold text-[#59632F]">
                      {claim.customer_name}
                    </span>
                    <span className="flex items-center gap-1">
                      <Mail className="h-3 w-3" />
                      {claim.customer_email}
                    </span>
                    {claim.customer_phone && (
                      <span className="flex items-center gap-1">
                        <Phone className="h-3 w-3" />
                        {claim.customer_phone}
                      </span>
                    )}
                  </div>
                  <p className="mt-1 text-xs text-[#8A877C]">
                    Product: {claim.product_names}
                  </p>
                </div>
                <div className="flex items-center justify-between gap-4 md:flex-col md:items-end">
                  <span className="flex items-center gap-1.5 text-xs text-[#8A877C]">
                    <ImageIcon className="h-3.5 w-3.5" />
                    {claim.evidence_urls?.length || 0} files
                  </span>
                  <Badge
                    className={`w-fit rounded-full capitalize ${statusClass(claim.status)}`}
                  >
                    {statusLabel(claim.status)}
                  </Badge>
                  {claim.evidence_urls?.[0] && (
                    <span className="flex items-center gap-2">
                      <img
                        src={claim.evidence_urls[0]}
                        alt="Customer evidence"
                        className="h-12 w-12 rounded-lg border border-[#E5E8E3] object-cover"
                      />
                      <span className="hidden text-xs font-semibold text-[#59632F] group-hover:inline">
                        View proof
                      </span>
                    </span>
                  )}
                </div>
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
          <DialogHeader className="border-b border-[#E5E8E3] pb-4">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#F1F3E8] text-[#59632F]">
                {selected &&
                  (() => {
                    const Icon = issueIcon(selected.issue_type);
                    return <Icon className="h-5 w-5" />;
                  })()}
              </div>
              <div>
                <DialogTitle className="font-serif text-2xl text-[#33381C]">
                  Review customer request
                </DialogTitle>
                <DialogDescription className="mt-1">
                  Order #{selected?.order_id.slice(0, 8)} ·{" "}
                  {selected &&
                    (issueLabels[selected.issue_type] || selected.issue_type)}
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>
          {selected && (
            <div className="space-y-5">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-2xl border border-[#E5E8E3] bg-white p-4">
                  <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#8A877C]">
                    Customer
                  </p>
                  <p className="mt-2 font-semibold text-[#303526]">
                    {selected.customer_name}
                  </p>
                  <p className="mt-1 flex items-center gap-1.5 text-xs text-[#777D70]">
                    <Mail className="h-3.5 w-3.5" />
                    {selected.customer_email}
                  </p>
                  {selected.customer_phone && (
                    <p className="mt-1 flex items-center gap-1.5 text-xs text-[#777D70]">
                      <Phone className="h-3.5 w-3.5" />
                      {selected.customer_phone}
                    </p>
                  )}
                </div>
                <div className="rounded-2xl border border-[#E5E8E3] bg-white p-4">
                  <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#8A877C]">
                    Order summary
                  </p>
                  <p className="mt-2 flex items-center gap-1.5 text-sm font-semibold text-[#303526]">
                    <Package className="h-4 w-4 text-[#7B8064]" />
                    {selected.product_names}
                  </p>
                  {selected.order_total != null && (
                    <p className="mt-1 text-xs text-[#777D70]">
                      Order total: ₹{Number(selected.order_total).toFixed(2)}
                    </p>
                  )}
                </div>
              </div>
              <div className="rounded-2xl border border-[#E5E8E3] bg-white p-5 text-sm leading-6 text-[#4D5528] shadow-sm">
                {selected.description}
              </div>
              {selected.evidence_urls?.length > 0 && (
                <div className="rounded-2xl border border-[#E5E8E3] bg-[#F5F7F5] p-4">
                  <p className="mb-3 flex items-center gap-2 text-sm font-semibold text-[#303526]">
                    <FileText className="h-4 w-4" /> Evidence
                  </p>
                  <div className="grid gap-3 sm:grid-cols-2">
                    {selected.evidence_urls.map((url) => (
                      <button
                        key={url}
                        type="button"
                        onClick={() => setProofUrl(url)}
                        className="group overflow-hidden rounded-xl border border-white bg-white text-left text-sm text-[#59632F] transition hover:border-[#A68D65]/40"
                      >
                        <img
                          src={url}
                          alt="Customer proof"
                          className="h-28 w-full bg-[#F8F7F1] object-cover"
                          onError={(event) => {
                            event.currentTarget.style.display = "none";
                          }}
                        />
                        <span className="flex items-center gap-2 px-3 py-2">
                          <ImageIcon className="h-4 w-4 shrink-0" />
                          <span className="truncate">View full proof</span>
                        </span>
                      </button>
                    ))}
                  </div>
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
      <Dialog
        open={Boolean(proofUrl)}
        onOpenChange={(open) => !open && setProofUrl(null)}
      >
        <DialogContent className="border-[#E7E0D4] bg-[#FBF7F0] sm:max-w-4xl">
          <DialogHeader>
            <DialogTitle className="font-serif text-xl text-[#33381C]">
              Customer proof
            </DialogTitle>
            <DialogDescription>
              Uploaded evidence for this return or refund request.
            </DialogDescription>
          </DialogHeader>
          {proofUrl && (
            <img
              src={proofUrl}
              alt="Full customer proof"
              className="max-h-[70vh] w-full rounded-xl object-contain"
            />
          )}
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}
