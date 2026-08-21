import { useEffect, useState, useMemo } from "react";
import AdminLayout from "@/layouts/AdminLayout";
import { supabase } from "@/lib/supabaseClient";
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
  Check,
  X,
  Eye,
  ImageOff,
  Loader2,
  ArrowUpDown,
  Search,
  Package,
  RefreshCw,
  SlidersHorizontal,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  Clock3,
  XCircle,
  Store,
  CircleDollarSign,
} from "lucide-react";

interface Product {
  id: string;
  name: string;
  category: string;
  status?: string;
  product_status: string;
  seller_id: string;
  seller_name?: string | null;
  price?: number;
  stock?: number;
  description?: string;
  image_url?: string;
  created_at?: string;
}

interface ImageLoadState {
  [key: string]: "loading" | "loaded" | "error";
}

type StatusFilter = "all" | "pending" | "approved" | "rejected";
type SortOption = "newest" | "oldest" | "price_high" | "price_low" | "name_az";

// The production catalog exposes both status columns. Keep them synchronized
// for every moderation action so catalog visibility and request management use
// the same decision.
const moderationStatusUpdate = (status: Exclude<StatusFilter, "all">) => ({
  status,
  product_status: status,
});

const SORT_LABELS: Record<SortOption, string> = {
  newest: "Newest first",
  oldest: "Oldest first",
  price_high: "Price: high to low",
  price_low: "Price: low to high",
  name_az: "Name: A to Z",
};

const QUICK_REJECT_REASONS = [
  "Image quality is too low — please upload clearer photos.",
  "Missing required product details (category, price, or stock).",
  "Description doesn't match AYUSH/FSSAI labeling requirements.",
  "Price seems inconsistent with similar listings — please double-check.",
];

const PAGE_SIZE = 20;

// Signature palette: warm ledger paper + a single forest-green accent.
// Custom hex values are applied via inline style (not Tailwind arbitrary
// classes) — matches the earlier fix for the Tailwind build-caching issue.
const C = {
  bg: "#F7EEE4",
  surface: "#FFFFFF",
  border: "#E5D7C8",
  borderStrong: "#CDB79D",
  ink: "#33381C",
  muted: "#68695C",
  mutedLight: "#9A9588",
  primary: "#33381C",
  primaryHover: "#262A14",
  primaryLight: "#E7E9DD",
  pending: "#A6701A",
  pendingLight: "#FAF0DE",
  approved: "#4B7651",
  approvedLight: "#E5F0E3",
  rejected: "#A23F2E",
  rejectedLight: "#F9E9E4",
  selectedRow: "#F1F3E9",
  headerBg: "#F3EBDD",
};

const monoStyle = {
  fontFamily:
    'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace',
};

function StatusTag({ status }: { status: string }) {
  const map: Record<
    string,
    { fg: string; bg: string; border: string; icon: typeof Clock3 }
  > = {
    pending: {
      fg: C.pending,
      bg: C.pendingLight,
      border: "#E9D4A7",
      icon: Clock3,
    },
    approved: {
      fg: C.approved,
      bg: C.approvedLight,
      border: "#C9DFC9",
      icon: CheckCircle2,
    },
    rejected: {
      fg: C.rejected,
      bg: C.rejectedLight,
      border: "#E8C5BD",
      icon: XCircle,
    },
  };

  const s = map[status] || {
    fg: C.muted,
    bg: C.bg,
    border: C.border,
    icon: Clock3,
  };
  const Icon = s.icon;

  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.12em]"
      style={{
        color: s.fg,
        backgroundColor: s.bg,
        border: `1px solid ${s.border}`,
      }}
    >
      <Icon className="h-3 w-3" strokeWidth={2.4} />
      {status}
    </span>
  );
}

export default function AdminProductRequests() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [rejectMessage, setRejectMessage] = useState("");
  const [rejectTarget, setRejectTarget] = useState<Product | null>(null);
  const [rejectTargets, setRejectTargets] = useState<Product[] | null>(null);
  const [searchInput, setSearchInput] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("pending");
  const [sortOption, setSortOption] = useState<SortOption>("newest");
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [bulkActionLoading, setBulkActionLoading] = useState(false);
  const [imageLoadState, setImageLoadState] = useState<ImageLoadState>({});
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [page, setPage] = useState(1);

  const fetchAllProducts = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("products")
      .select("*")
      .in("product_status", ["pending", "approved", "rejected"]);

    if (error || !data) {
      setLoading(false);
      toast({
        title: "Error",
        description: "Failed to load product requests",
        variant: "destructive",
      });
      return;
    }

    setProducts(data.map((product) => ({ ...product, seller_name: null })));
    setLoading(false);

    const sellerIds = Array.from(
      new Set(data.map((product) => product.seller_id).filter(Boolean)),
    );
    const { data: profiles } = sellerIds.length
      ? await supabase
          .from("profiles")
          .select("id, username, full_name")
          .in("id", sellerIds)
      : { data: [] };

    const sellerNames = new Map(
      (profiles || []).map((profile) => [
        profile.id,
        profile.username || profile.full_name || null,
      ]),
    );

    setProducts((current) =>
      current.map((product) =>
        product.seller_id
          ? {
              ...product,
              seller_name: sellerNames.get(product.seller_id) || null,
            }
          : product,
      ),
    );
  };

  useEffect(() => {
    fetchAllProducts();
  }, []);

  useEffect(() => {
    const handle = setTimeout(() => {
      setSearchTerm(searchInput);
      setPage(1);
    }, 250);
    return () => clearTimeout(handle);
  }, [searchInput]);

  useEffect(() => {
    setPage(1);
  }, [statusFilter, sortOption]);

  const approveProduct = async (id: string, product: Product) => {
    setActionLoading(id);
    const originalProducts = products;
    // Keep the product in local state with its new status so its destination
    // tab and count update immediately, without waiting for a refetch.
    setProducts((current) =>
      current.map((p) =>
        p.id === id
          ? { ...p, ...moderationStatusUpdate("approved") }
          : p,
      ),
    );
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
    if (selectedProduct?.id === id) setSelectedProduct(null);

    try {
      const user = await supabase.auth.getUser();
      const adminId = user.data.user?.id;

      const { error: updateError } = await supabase
        .from("products")
        .update(moderationStatusUpdate("approved"))
        .eq("id", id);
      if (updateError) throw updateError;

      if (adminId) {
        const { error: logError } = await supabase
          .from("product_moderation_logs")
          .insert({
            product_id: id,
            moderator_id: adminId,
            action: "approve",
            reason: null,
          });
        if (logError) console.error("Failed to log approval:", logError);
      }

      toast({ title: "Success", description: `${product.name} approved` });
    } catch (err: any) {
      setProducts(originalProducts);
      toast({
        title: "Error",
        description: err.message || "Failed to approve product",
        variant: "destructive",
      });
    } finally {
      setActionLoading(null);
    }
  };

  const rejectProduct = (product: Product) => {
    setRejectTarget(product);
    setRejectTargets(null);
    setRejectMessage("");
    setRejectDialogOpen(true);
  };

  const rejectSelected = () => {
    const targets = products.filter((p) => selectedIds.has(p.id));
    if (targets.length === 0) return;
    setRejectTargets(targets);
    setRejectTarget(null);
    setRejectMessage("");
    setRejectDialogOpen(true);
  };

  const performRejectProduct = async (id: string) => {
    setActionLoading(id);
    const originalProducts = products;
    // Optimistically move the product to Rejected. The original state is
    // restored below if Supabase rejects the update.
    setProducts((current) =>
      current.map((p) =>
        p.id === id
          ? { ...p, ...moderationStatusUpdate("rejected") }
          : p,
      ),
    );
    setRejectDialogOpen(false);
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
    if (selectedProduct?.id === id) setSelectedProduct(null);

    try {
      const user = await supabase.auth.getUser();
      const adminId = user.data.user?.id;

      const { error: updateError } = await supabase
        .from("products")
        .update(moderationStatusUpdate("rejected"))
        .eq("id", id);
      if (updateError) throw updateError;

      if (adminId) {
        const { error: logError } = await supabase
          .from("product_moderation_logs")
          .insert({
            product_id: id,
            moderator_id: adminId,
            action: "reject",
            reason: rejectMessage.trim() || null,
          });
        if (logError) console.error("Failed to log rejection:", logError);
      }

      if (rejectTarget) {
        const baseMessage =
          rejectMessage.trim() || "Your product was rejected.";
        const notifMessage = `${baseMessage} [product_rejection::${id}]`;
        const { error: notifErr } = await supabase
          .from("notifications")
          .insert({
            user_id: rejectTarget.seller_id,
            title: "Product Rejected",
            message: notifMessage,
            type: "alert",
          });
        if (notifErr) console.error("Failed to send notification:", notifErr);
      }

      toast({ title: "Success", description: "Product rejected" });
      setRejectTarget(null);
    } catch (err: any) {
      setProducts(originalProducts);
      setRejectDialogOpen(true);
      toast({
        title: "Error",
        description: err.message || "Failed to reject product",
        variant: "destructive",
      });
    } finally {
      setActionLoading(null);
    }
  };

  const performBulkReject = async () => {
    if (!rejectTargets || rejectTargets.length === 0) return;
    setBulkActionLoading(true);
    const idsToReject = new Set(rejectTargets.map((p) => p.id));
    const originalProducts = products;
    setProducts((current) =>
      current.map((p) =>
        idsToReject.has(p.id)
          ? { ...p, ...moderationStatusUpdate("rejected") }
          : p,
      ),
    );
    setRejectDialogOpen(false);
    setSelectedIds(new Set());

    try {
      const user = await supabase.auth.getUser();
      const adminId = user.data.user?.id;
      const reasonText = rejectMessage.trim() || null;

      const { error: updateError } = await supabase
        .from("products")
        .update(moderationStatusUpdate("rejected"))
        .in("id", Array.from(idsToReject));
      if (updateError) throw updateError;

      if (adminId) {
        const logRows = rejectTargets.map((p) => ({
          product_id: p.id,
          moderator_id: adminId,
          action: "reject",
          reason: reasonText,
        }));
        const { error: logError } = await supabase
          .from("product_moderation_logs")
          .insert(logRows);
        if (logError) console.error("Failed to log bulk rejection:", logError);
      }

      const baseMessage = reasonText || "Your product was rejected.";
      const notifRows = rejectTargets.map((p) => ({
        user_id: p.seller_id,
        title: "Product Rejected",
        message: `${baseMessage} [product_rejection::${p.id}]`,
        type: "alert",
      }));
      const { error: notifErr } = await supabase
        .from("notifications")
        .insert(notifRows);
      if (notifErr)
        console.error("Failed to send bulk notifications:", notifErr);

      toast({
        title: "Success",
        description: `${rejectTargets.length} product${rejectTargets.length === 1 ? "" : "s"} rejected`,
      });
      setRejectTargets(null);
    } catch (err: any) {
      setProducts(originalProducts);
      setRejectDialogOpen(true);
      toast({
        title: "Error",
        description: err.message || "Failed to reject selected products",
        variant: "destructive",
      });
    } finally {
      setBulkActionLoading(false);
    }
  };

  const performBulkApprove = async () => {
    const targets = products.filter(
      (p) => selectedIds.has(p.id) && p.product_status === "pending",
    );
    if (targets.length === 0) return;
    setBulkActionLoading(true);
    const idsToApprove = new Set(targets.map((p) => p.id));
    const originalProducts = products;
    setProducts((current) =>
      current.map((p) =>
        idsToApprove.has(p.id)
          ? { ...p, ...moderationStatusUpdate("approved") }
          : p,
      ),
    );
    setSelectedIds(new Set());

    try {
      const user = await supabase.auth.getUser();
      const adminId = user.data.user?.id;

      const { error: updateError } = await supabase
        .from("products")
        .update(moderationStatusUpdate("approved"))
        .in("id", Array.from(idsToApprove));
      if (updateError) throw updateError;

      if (adminId) {
        const logRows = targets.map((p) => ({
          product_id: p.id,
          moderator_id: adminId,
          action: "approve",
          reason: null,
        }));
        const { error: logError } = await supabase
          .from("product_moderation_logs")
          .insert(logRows);
        if (logError) console.error("Failed to log bulk approval:", logError);
      }

      toast({
        title: "Success",
        description: `${targets.length} product${targets.length === 1 ? "" : "s"} approved`,
      });
    } catch (err: any) {
      setProducts(originalProducts);
      toast({
        title: "Error",
        description: err.message || "Failed to approve selected products",
        variant: "destructive",
      });
    } finally {
      setBulkActionLoading(false);
    }
  };

  const toggleSelected = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const filteredProducts = useMemo(() => {
    let filtered = products;
    if (statusFilter !== "all") {
      filtered = filtered.filter((p) => p.product_status === statusFilter);
    }
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(
        (product) =>
          product.name.toLowerCase().includes(term) ||
          product.seller_name?.toLowerCase().includes(term) ||
          product.category.toLowerCase().includes(term),
      );
    }
    const sorted = [...filtered];
    switch (sortOption) {
      case "newest":
        sorted.sort(
          (a, b) =>
            new Date(b.created_at || 0).getTime() -
            new Date(a.created_at || 0).getTime(),
        );
        break;
      case "oldest":
        sorted.sort(
          (a, b) =>
            new Date(a.created_at || 0).getTime() -
            new Date(b.created_at || 0).getTime(),
        );
        break;
      case "price_high":
        sorted.sort((a, b) => (b.price || 0) - (a.price || 0));
        break;
      case "price_low":
        sorted.sort((a, b) => (a.price || 0) - (b.price || 0));
        break;
      case "name_az":
        sorted.sort((a, b) => a.name.localeCompare(b.name));
        break;
    }
    return sorted;
  }, [products, statusFilter, searchTerm, sortOption]);

  const totalPages = Math.max(
    1,
    Math.ceil(filteredProducts.length / PAGE_SIZE),
  );
  const paginatedProducts = useMemo(
    () => filteredProducts.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE),
    [filteredProducts, page],
  );

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [totalPages, page]);

  const stats = useMemo(
    () => ({
      pending: products.filter((p) => p.product_status === "pending").length,
      approved: products.filter((p) => p.product_status === "approved").length,
      rejected: products.filter((p) => p.product_status === "rejected").length,
      total: products.length,
    }),
    [products],
  );

  const selectedOnPageCount = paginatedProducts.filter((p) =>
    selectedIds.has(p.id),
  ).length;
  const allOnPageSelected =
    paginatedProducts.length > 0 &&
    selectedOnPageCount === paginatedProducts.length;

  const toggleSelectAllOnPage = () => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (allOnPageSelected) {
        paginatedProducts.forEach((p) => next.delete(p.id));
      } else {
        paginatedProducts.forEach((p) => next.add(p.id));
      }
      return next;
    });
  };

  const selectedPendingCount = useMemo(
    () =>
      products.filter(
        (p) => selectedIds.has(p.id) && p.product_status === "pending",
      ).length,
    [products, selectedIds],
  );

  const formatPrice = (price?: number) =>
    `₹${(price || 0).toLocaleString("en-IN")}`;

  const formatDate = (d?: string) =>
    d
      ? new Date(d).toLocaleDateString("en-IN", {
          year: "2-digit",
          month: "short",
          day: "2-digit",
        })
      : "—";

  const handleImageLoad = (id: string) =>
    setImageLoadState((prev) => ({ ...prev, [id]: "loaded" }));
  const handleImageError = (id: string) =>
    setImageLoadState((prev) => ({ ...prev, [id]: "error" }));

  const iconBtn = (color: string, bg: string) => ({
    style: { color, backgroundColor: bg } as React.CSSProperties,
    className:
      "h-7 w-7 rounded flex items-center justify-center transition-opacity hover:opacity-75 disabled:opacity-30 disabled:cursor-not-allowed",
  });

  return (
    <AdminLayout>
      <div
        className="min-h-screen -m-6 px-4 py-5 sm:px-6 lg:px-8"
        style={{
          background:
            "radial-gradient(circle at top right, rgba(166,141,101,0.08), transparent 28%), linear-gradient(180deg, #F7EEE4 0%, #F3E8DA 100%)",
        }}
      >
        <div className="mx-auto max-w-[1500px] space-y-6">
          {/* Page heading */}
          <section
            className="relative overflow-hidden rounded-3xl border shadow-[0_18px_55px_rgba(35,49,40,0.07)]"
            style={{
              background: "linear-gradient(135deg, #FFFFFF 0%, #FBF5ED 100%)",
              borderColor: C.border,
            }}
          >
            <div
              className="absolute -right-20 -top-24 h-64 w-64 rounded-full"
              style={{ background: "rgba(166,141,101,0.08)" }}
            />
            <div
              className="absolute right-24 bottom-[-70px] h-40 w-40 rounded-full"
              style={{ background: "rgba(198,174,104,0.08)" }}
            />

            <div className="relative flex flex-col gap-5 p-5 sm:p-7 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <div
                  className="mb-3 inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.16em]"
                  style={{
                    color: C.primary,
                    backgroundColor: C.primaryLight,
                    borderColor: "#CFE0D1",
                  }}
                >
                  <Package className="h-3.5 w-3.5" />
                  Catalog moderation
                </div>

                <h1
                  className="text-3xl font-semibold tracking-[-0.035em] sm:text-4xl"
                  style={{ color: C.ink }}
                >
                  Product Requests
                </h1>
                <p
                  className="mt-2 max-w-2xl text-sm leading-6 sm:text-[15px]"
                  style={{ color: C.muted }}
                >
                  Review marketplace submissions, verify product information,
                  and keep the public catalog clean and trustworthy.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={fetchAllProducts}
                  disabled={loading}
                  className="inline-flex h-10 items-center gap-2 rounded-xl border px-3.5 text-sm font-semibold transition-all hover:-translate-y-0.5 hover:shadow-sm disabled:cursor-not-allowed disabled:opacity-50"
                  style={{
                    color: C.ink,
                    backgroundColor: C.surface,
                    borderColor: C.border,
                  }}
                >
                  <RefreshCw
                    className={`h-4 w-4 ${loading ? "animate-spin" : ""}`}
                  />
                  Refresh
                </button>
              </div>
            </div>
          </section>

          {/* Overview cards */}
          <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {[
              {
                label: "Pending review",
                value: stats.pending,
                icon: Clock3,
                color: C.pending,
                bg: C.pendingLight,
                note: "Needs attention",
              },
              {
                label: "Approved",
                value: stats.approved,
                icon: CheckCircle2,
                color: C.approved,
                bg: C.approvedLight,
                note: "Live catalog",
              },
              {
                label: "Rejected",
                value: stats.rejected,
                icon: XCircle,
                color: C.rejected,
                bg: C.rejectedLight,
                note: "Needs changes",
              },
              {
                label: "Total submissions",
                value: stats.total,
                icon: Store,
                color: C.ink,
                bg: C.bg,
                note: "All statuses",
              },
            ].map((card) => {
              const Icon = card.icon;
              return (
                <div
                  key={card.label}
                  className="group rounded-2xl border p-4 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_12px_30px_rgba(35,49,40,0.07)]"
                  style={{
                    backgroundColor: C.surface,
                    borderColor: C.border,
                  }}
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <p
                        className="text-[10px] font-bold uppercase tracking-[0.14em]"
                        style={{ color: C.muted }}
                      >
                        {card.label}
                      </p>
                      <p
                        className="mt-2 text-3xl font-semibold tracking-tight"
                        style={{ color: C.ink }}
                      >
                        {loading ? "—" : card.value}
                      </p>
                      <p
                        className="mt-1 text-xs"
                        style={{ color: C.mutedLight }}
                      >
                        {card.note}
                      </p>
                    </div>
                    <div
                      className="flex h-10 w-10 items-center justify-center rounded-xl"
                      style={{ color: card.color, backgroundColor: card.bg }}
                    >
                      <Icon className="h-5 w-5" />
                    </div>
                  </div>
                </div>
              );
            })}
          </section>

          {/* Main moderation workspace */}
          <section
            className="overflow-hidden rounded-3xl border shadow-[0_15px_45px_rgba(35,49,40,0.055)]"
            style={{ backgroundColor: C.surface, borderColor: C.border }}
          >
            {/* Toolbar */}
            <div
              className="border-b p-4 sm:p-5"
              style={{ borderColor: C.border }}
            >
              <div className="flex flex-col gap-4 xl:flex-row xl:items-center">
                <div className="flex items-center gap-2">
                  <div
                    className="flex h-9 w-9 items-center justify-center rounded-xl"
                    style={{
                      color: C.primary,
                      backgroundColor: C.primaryLight,
                    }}
                  >
                    <SlidersHorizontal className="h-4 w-4" />
                  </div>
                  <div>
                    <p
                      className="text-sm font-semibold"
                      style={{ color: C.ink }}
                    >
                      Moderation queue
                    </p>
                    <p className="text-xs" style={{ color: C.muted }}>
                      Filter and review catalog submissions
                    </p>
                  </div>
                </div>

                <div className="flex flex-1 flex-col gap-2 sm:flex-row xl:justify-end">
                  <div
                    className="flex overflow-x-auto rounded-xl border p-1"
                    style={{ borderColor: C.border, backgroundColor: C.bg }}
                  >
                    {(
                      [
                        "pending",
                        "approved",
                        "rejected",
                        "all",
                      ] as StatusFilter[]
                    ).map((status) => (
                      <button
                        key={status}
                        onClick={() => setStatusFilter(status)}
                        disabled={loading}
                        aria-pressed={statusFilter === status}
                        className="whitespace-nowrap rounded-lg px-3 py-2 text-[11px] font-bold uppercase tracking-[0.08em] transition-all disabled:opacity-50"
                        style={{
                          color: statusFilter === status ? C.surface : C.muted,
                          backgroundColor:
                            statusFilter === status ? C.primary : "transparent",
                          boxShadow:
                            statusFilter === status
                              ? "0 2px 8px rgba(63,107,74,0.18)"
                              : "none",
                        }}
                      >
                        {status}
                        <span className="ml-1 opacity-75">
                          {loading
                            ? "—"
                            : status === "all"
                              ? stats.total
                              : stats[status as keyof typeof stats]}
                        </span>
                      </button>
                    ))}
                  </div>

                  <div className="relative min-w-0 flex-1 sm:min-w-[250px] xl:max-w-[340px]">
                    <Search
                      className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2"
                      style={{ color: C.mutedLight }}
                    />
                    <input
                      type="text"
                      placeholder="Search products, sellers or categories"
                      value={searchInput}
                      onChange={(e) => setSearchInput(e.target.value)}
                      className="h-10 w-full rounded-xl border bg-transparent pl-10 pr-4 text-sm outline-none transition-all placeholder:text-[#A4A996] focus:ring-4"
                      style={{
                        borderColor: C.border,
                        color: C.ink,
                        boxShadow: "0 0 0 0 rgba(63,107,74,0)",
                      }}
                    />
                  </div>

                  <div
                    className="flex h-10 items-center gap-2 rounded-xl border px-3"
                    style={{ borderColor: C.border, backgroundColor: C.bg }}
                  >
                    <ArrowUpDown
                      className="h-3.5 w-3.5"
                      style={{ color: C.muted }}
                    />
                    <select
                      value={sortOption}
                      onChange={(e) =>
                        setSortOption(e.target.value as SortOption)
                      }
                      aria-label="Sort products"
                      className="min-w-[145px] bg-transparent text-xs font-semibold outline-none"
                      style={{ color: C.ink }}
                    >
                      {Object.entries(SORT_LABELS).map(([value, label]) => (
                        <option key={value} value={value}>
                          {label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              {(searchTerm || filteredProducts.length !== products.length) && (
                <div
                  className="mt-3 flex items-center justify-between rounded-xl border px-3 py-2"
                  style={{ borderColor: C.border, backgroundColor: C.bg }}
                >
                  <span className="text-xs" style={{ color: C.muted }}>
                    Showing{" "}
                    <b style={{ color: C.ink }}>{filteredProducts.length}</b> of{" "}
                    <b style={{ color: C.ink }}>{products.length}</b>{" "}
                    submissions
                  </span>
                  {searchTerm && (
                    <span
                      className="rounded-full px-2 py-1 text-[10px] font-bold"
                      style={{
                        color: C.primary,
                        backgroundColor: C.primaryLight,
                      }}
                    >
                      Search active
                    </span>
                  )}
                </div>
              )}
            </div>

            {/* Bulk actions */}
            {selectedIds.size > 0 && (
              <div
                className="flex flex-col gap-3 border-b px-4 py-3 sm:flex-row sm:items-center"
                style={{
                  backgroundColor: C.selectedRow,
                  borderColor: C.border,
                }}
              >
                <div className="flex items-center gap-2">
                  <span
                    className="flex h-7 min-w-7 items-center justify-center rounded-full px-2 text-xs font-bold"
                    style={{
                      color: C.primary,
                      backgroundColor: C.primaryLight,
                    }}
                  >
                    {selectedIds.size}
                  </span>
                  <span
                    className="text-sm font-semibold"
                    style={{ color: C.ink }}
                  >
                    selected
                  </span>
                </div>

                <div className="flex flex-wrap gap-2 sm:ml-auto">
                  {selectedPendingCount > 0 && (
                    <button
                      onClick={performBulkApprove}
                      disabled={bulkActionLoading}
                      className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-bold transition-all hover:-translate-y-0.5 disabled:opacity-50"
                      style={{ backgroundColor: C.primary, color: C.surface }}
                    >
                      <Check className="h-3.5 w-3.5" />
                      Approve {selectedPendingCount}
                    </button>
                  )}
                  <button
                    onClick={rejectSelected}
                    disabled={bulkActionLoading}
                    className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-bold transition-all hover:-translate-y-0.5 disabled:opacity-50"
                    style={{ backgroundColor: C.rejected, color: C.surface }}
                  >
                    <X className="h-3.5 w-3.5" />
                    Reject selected
                  </button>
                  <button
                    onClick={() => setSelectedIds(new Set())}
                    className="rounded-lg border px-3 py-2 text-xs font-semibold"
                    style={{
                      borderColor: C.border,
                      color: C.muted,
                      backgroundColor: C.surface,
                    }}
                  >
                    Clear
                  </button>
                </div>
              </div>
            )}

            {/* Table */}
            <div className="overflow-x-auto">
              {loading ? (
                <div
                  className="min-w-[900px] divide-y"
                  style={{ borderColor: C.border }}
                >
                  {[...Array(7)].map((_, i) => (
                    <div
                      key={i}
                      className="flex items-center gap-4 px-5 py-4 animate-pulse"
                    >
                      <div className="h-4 w-4 rounded bg-gray-200" />
                      <div className="h-11 w-11 rounded-xl bg-gray-200" />
                      <div className="h-4 w-44 rounded bg-gray-200" />
                      <div className="h-4 w-28 rounded bg-gray-200" />
                      <div className="ml-auto h-4 w-20 rounded bg-gray-200" />
                      <div className="h-6 w-20 rounded-full bg-gray-200" />
                      <div className="h-8 w-20 rounded-lg bg-gray-200" />
                    </div>
                  ))}
                </div>
              ) : filteredProducts.length === 0 ? (
                <div className="py-24 text-center">
                  <div
                    className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl"
                    style={{ backgroundColor: C.bg, color: C.mutedLight }}
                  >
                    <Package className="h-7 w-7" />
                  </div>
                  <p
                    className="text-base font-semibold"
                    style={{ color: C.ink }}
                  >
                    {searchTerm
                      ? "No matching products"
                      : `No ${statusFilter === "all" ? "" : statusFilter + " "}products`}
                  </p>
                  <p className="mt-1 text-sm" style={{ color: C.muted }}>
                    {searchTerm
                      ? "Try another product, seller, or category."
                      : "Nothing needs your attention here right now."}
                  </p>
                </div>
              ) : (
                <>
                  <table className="w-full min-w-[1050px] border-collapse text-sm">
                    <thead>
                      <tr
                        className="border-b text-left"
                        style={{
                          backgroundColor: "#F7F6F0",
                          borderColor: C.border,
                        }}
                      >
                        <th className="w-12 px-5 py-3.5">
                          <input
                            type="checkbox"
                            checked={allOnPageSelected}
                            onChange={toggleSelectAllOnPage}
                            aria-label="Select all on page"
                            className="h-4 w-4 cursor-pointer"
                            style={{ accentColor: C.primary }}
                          />
                        </th>
                        <th className="w-16 px-2 py-3.5" />
                        {[
                          "Product",
                          "Seller",
                          "Price",
                          "Stock",
                          "Submitted",
                          "Status",
                          "Actions",
                        ].map((heading, index) => (
                          <th
                            key={heading}
                            className={`px-3 py-3.5 text-[10px] font-bold uppercase tracking-[0.13em] ${
                              index >= 2 ? "text-right" : ""
                            }`}
                            style={{ color: C.muted }}
                          >
                            {heading}
                          </th>
                        ))}
                      </tr>
                    </thead>

                    <tbody>
                      {paginatedProducts.map((product) => {
                        const barColor =
                          product.product_status === "pending"
                            ? C.pending
                            : product.product_status === "approved"
                              ? C.approved
                              : C.rejected;
                        const isSelected = selectedIds.has(product.id);

                        return (
                          <tr
                            key={product.id}
                            className="group border-b transition-all duration-150 hover:bg-[#FAFAF7]"
                            style={{
                              borderColor: C.border,
                              backgroundColor: isSelected
                                ? C.selectedRow
                                : C.surface,
                            }}
                          >
                            <td className="relative px-5 py-3.5 align-middle">
                              <span
                                className="absolute left-0 top-0 h-full w-[3px]"
                                style={{ backgroundColor: barColor }}
                              />
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={() => toggleSelected(product.id)}
                                aria-label={`Select ${product.name}`}
                                className="h-4 w-4 cursor-pointer"
                                style={{ accentColor: C.primary }}
                              />
                            </td>

                            <td className="px-2 py-3.5 align-middle">
                              <div
                                className="h-12 w-12 overflow-hidden rounded-xl border shadow-sm"
                                style={{
                                  borderColor: C.border,
                                  backgroundColor: C.bg,
                                }}
                              >
                                {product.image_url &&
                                imageLoadState[product.id] !== "error" ? (
                                  <img
                                    src={product.image_url}
                                    alt={product.name}
                                    onLoad={() => handleImageLoad(product.id)}
                                    onError={() => handleImageError(product.id)}
                                    className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                                  />
                                ) : (
                                  <div className="flex h-full w-full items-center justify-center">
                                    <ImageOff
                                      className="h-5 w-5"
                                      style={{ color: C.mutedLight }}
                                    />
                                  </div>
                                )}
                              </div>
                            </td>

                            <td className="max-w-[280px] px-3 py-3.5 align-middle">
                              <button
                                type="button"
                                onClick={() => setSelectedProduct(product)}
                                className="text-left"
                              >
                                <p
                                  className="truncate font-semibold transition-colors hover:underline"
                                  style={{ color: C.ink }}
                                  title={product.name}
                                >
                                  {product.name}
                                </p>
                                <p
                                  className="mt-1 truncate text-[10px] font-bold uppercase tracking-[0.1em]"
                                  style={{ color: C.mutedLight }}
                                >
                                  {product.category}
                                </p>
                              </button>
                            </td>

                            <td className="px-3 py-3.5 align-middle">
                              <div className="flex items-center gap-2">
                                <div
                                  className="flex h-7 w-7 items-center justify-center rounded-full"
                                  style={{
                                    color: C.primary,
                                    backgroundColor: C.primaryLight,
                                  }}
                                >
                                  <Store className="h-3.5 w-3.5" />
                                </div>
                                <span
                                  className="max-w-[150px] truncate font-medium"
                                  style={{ color: C.muted }}
                                >
                                  {product.seller_name || "Unknown seller"}
                                </span>
                              </div>
                            </td>

                            <td
                              className="px-3 py-3.5 text-right align-middle font-semibold tabular-nums"
                              style={{ color: C.ink }}
                            >
                              <span className="inline-flex items-center gap-1">
                                <CircleDollarSign
                                  className="h-3.5 w-3.5"
                                  style={{ color: C.mutedLight }}
                                />
                                {formatPrice(product.price)}
                              </span>
                            </td>

                            <td
                              className="px-3 py-3.5 text-right align-middle tabular-nums"
                              style={{ color: C.muted }}
                            >
                              {product.stock ?? 0}
                            </td>

                            <td
                              className="px-3 py-3.5 align-middle text-xs"
                              style={{ color: C.muted }}
                            >
                              {formatDate(product.created_at)}
                            </td>

                            <td className="px-3 py-3.5 align-middle">
                              <StatusTag status={product.product_status} />
                            </td>

                            <td className="px-5 py-3.5 align-middle">
                              <div className="flex items-center justify-end gap-1.5">
                                <button
                                  onClick={() => setSelectedProduct(product)}
                                  aria-label={`View ${product.name}`}
                                  className="flex h-9 w-9 items-center justify-center rounded-lg border transition-all hover:-translate-y-0.5 hover:shadow-sm"
                                  style={{
                                    color: C.muted,
                                    backgroundColor: C.surface,
                                    borderColor: C.border,
                                  }}
                                >
                                  <Eye className="h-4 w-4" />
                                </button>

                                {product.product_status === "pending" ? (
                                  <>
                                    <button
                                      onClick={() =>
                                        approveProduct(product.id, product)
                                      }
                                      disabled={actionLoading === product.id}
                                      aria-label={`Approve ${product.name}`}
                                      className="flex h-9 w-9 items-center justify-center rounded-lg border transition-all hover:-translate-y-0.5 hover:shadow-sm disabled:opacity-30"
                                      style={{
                                        color: C.approved,
                                        backgroundColor: C.approvedLight,
                                        borderColor: "#C9DFC9",
                                      }}
                                    >
                                      {actionLoading === product.id ? (
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                      ) : (
                                        <Check className="h-4 w-4" />
                                      )}
                                    </button>
                                    <button
                                      onClick={() => rejectProduct(product)}
                                      disabled={actionLoading === product.id}
                                      aria-label={`Reject ${product.name}`}
                                      className="flex h-9 w-9 items-center justify-center rounded-lg border transition-all hover:-translate-y-0.5 hover:shadow-sm disabled:opacity-30"
                                      style={{
                                        color: C.rejected,
                                        backgroundColor: C.rejectedLight,
                                        borderColor: "#E8C5BD",
                                      }}
                                    >
                                      <X className="h-4 w-4" />
                                    </button>
                                  </>
                                ) : product.product_status === "approved" ? (
                                  <button
                                    onClick={() => rejectProduct(product)}
                                    disabled={actionLoading === product.id}
                                    aria-label={`Revoke ${product.name}`}
                                    className="flex h-9 w-9 items-center justify-center rounded-lg border transition-all hover:-translate-y-0.5 hover:shadow-sm disabled:opacity-30"
                                    style={{
                                      color: C.rejected,
                                      backgroundColor: C.rejectedLight,
                                      borderColor: "#E8C5BD",
                                    }}
                                  >
                                    <X className="h-4 w-4" />
                                  </button>
                                ) : (
                                  <button
                                    onClick={() =>
                                      approveProduct(product.id, product)
                                    }
                                    disabled={actionLoading === product.id}
                                    aria-label={`Reconsider ${product.name}`}
                                    className="flex h-9 w-9 items-center justify-center rounded-lg border transition-all hover:-translate-y-0.5 hover:shadow-sm disabled:opacity-30"
                                    style={{
                                      color: C.approved,
                                      backgroundColor: C.approvedLight,
                                      borderColor: "#C9DFC9",
                                    }}
                                  >
                                    <Check className="h-4 w-4" />
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>

                  <div
                    className="flex flex-col gap-3 border-t px-5 py-4 text-xs sm:flex-row sm:items-center sm:justify-between"
                    style={{
                      borderColor: C.border,
                      backgroundColor: "#FBFAF6",
                    }}
                  >
                    <span style={{ color: C.muted }}>
                      Showing{" "}
                      <b style={{ color: C.ink }}>
                        {(page - 1) * PAGE_SIZE + 1}–
                        {Math.min(page * PAGE_SIZE, filteredProducts.length)}
                      </b>{" "}
                      of{" "}
                      <b style={{ color: C.ink }}>{filteredProducts.length}</b>
                    </span>

                    {totalPages > 1 && (
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => setPage((p) => Math.max(1, p - 1))}
                          disabled={page === 1}
                          className="inline-flex h-9 items-center gap-1 rounded-lg border px-3 font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-30"
                          style={{
                            borderColor: C.border,
                            color: C.ink,
                            backgroundColor: C.surface,
                          }}
                        >
                          <ChevronLeft className="h-4 w-4" />
                          Prev
                        </button>
                        <span
                          className="rounded-lg px-3 py-2 font-semibold"
                          style={{
                            color: C.primary,
                            backgroundColor: C.primaryLight,
                          }}
                        >
                          {page} / {totalPages}
                        </span>
                        <button
                          onClick={() =>
                            setPage((p) => Math.min(totalPages, p + 1))
                          }
                          disabled={page === totalPages}
                          className="inline-flex h-9 items-center gap-1 rounded-lg border px-3 font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-30"
                          style={{
                            borderColor: C.border,
                            color: C.ink,
                            backgroundColor: C.surface,
                          }}
                        >
                          Next
                          <ChevronRight className="h-4 w-4" />
                        </button>
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          </section>
        </div>

        {/* Product Detail Modal */}
        <Dialog
          open={!!selectedProduct}
          onOpenChange={() => setSelectedProduct(null)}
        >
          <DialogContent
            className="max-h-[92vh] max-w-3xl overflow-y-auto rounded-3xl border p-0"
            style={{ borderColor: C.border }}
          >
            {selectedProduct && (
              <>
                <div
                  className="sticky top-0 z-10 border-b px-6 py-5 backdrop-blur"
                  style={{
                    backgroundColor: "rgba(255,255,255,0.94)",
                    borderColor: C.border,
                  }}
                >
                  <DialogHeader>
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <div className="mb-2">
                          <StatusTag status={selectedProduct.product_status} />
                        </div>
                        <DialogTitle
                          className="text-2xl font-semibold tracking-tight"
                          style={{ color: C.ink }}
                        >
                          {selectedProduct.name}
                        </DialogTitle>
                        <DialogDescription
                          className="mt-1 text-sm"
                          style={{ color: C.muted }}
                        >
                          Review product information before making a moderation
                          decision.
                        </DialogDescription>
                      </div>
                    </div>
                  </DialogHeader>
                </div>

                <div className="space-y-6 p-6">
                  {selectedProduct.image_url && (
                    <div
                      className="flex min-h-[300px] items-center justify-center overflow-hidden rounded-2xl border p-5"
                      style={{
                        background:
                          "radial-gradient(circle at center, #FFFFFF 0%, #F2F1E9 100%)",
                        borderColor: C.border,
                      }}
                    >
                      {imageLoadState[selectedProduct.id] === "error" ? (
                        <div className="flex flex-col items-center gap-2">
                          <ImageOff
                            className="h-12 w-12"
                            style={{ color: C.mutedLight }}
                          />
                          <p className="text-sm" style={{ color: C.muted }}>
                            Failed to load image
                          </p>
                        </div>
                      ) : (
                        <img
                          src={selectedProduct.image_url}
                          alt={selectedProduct.name}
                          onLoad={() => handleImageLoad(selectedProduct.id)}
                          onError={() => handleImageError(selectedProduct.id)}
                          className="max-h-[360px] max-w-full rounded-xl object-contain shadow-sm"
                        />
                      )}
                    </div>
                  )}

                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    {[
                      ["Category", selectedProduct.category],
                      ["Price", formatPrice(selectedProduct.price)],
                      ["Stock", String(selectedProduct.stock ?? 0)],
                      [
                        "Seller",
                        selectedProduct.seller_name || "Unknown seller",
                      ],
                    ].map(([label, value]) => (
                      <div
                        key={label}
                        className="rounded-2xl border p-4"
                        style={{ borderColor: C.border, backgroundColor: C.bg }}
                      >
                        <p
                          className="text-[10px] font-bold uppercase tracking-[0.14em]"
                          style={{ color: C.muted }}
                        >
                          {label}
                        </p>
                        <p
                          className="mt-2 font-semibold"
                          style={{ color: C.ink }}
                        >
                          {value}
                        </p>
                      </div>
                    ))}
                  </div>

                  <div>
                    <p
                      className="mb-2 text-[10px] font-bold uppercase tracking-[0.14em]"
                      style={{ color: C.muted }}
                    >
                      Product description
                    </p>
                    <p
                      className="rounded-2xl border p-4 text-sm leading-7"
                      style={{
                        borderColor: C.border,
                        backgroundColor: C.surface,
                        color: C.ink,
                      }}
                    >
                      {selectedProduct.description ||
                        "No description provided."}
                    </p>
                  </div>

                  {selectedProduct.created_at && (
                    <div
                      className="flex items-center gap-2 rounded-xl px-3 py-2 text-xs"
                      style={{ color: C.muted, backgroundColor: C.bg }}
                    >
                      <Clock3 className="h-3.5 w-3.5" />
                      Submitted{" "}
                      {new Date(selectedProduct.created_at).toLocaleString()}
                    </div>
                  )}
                </div>

                <DialogFooter
                  className="flex flex-col gap-2 border-t p-6 sm:flex-row"
                  style={{ borderColor: C.border }}
                >
                  <Button
                    variant="outline"
                    onClick={() => setSelectedProduct(null)}
                    className="h-11 rounded-xl sm:flex-1"
                  >
                    Close
                  </Button>

                  {selectedProduct.product_status === "pending" ? (
                    <>
                      <Button
                        onClick={() => rejectProduct(selectedProduct)}
                        disabled={actionLoading === selectedProduct.id}
                        variant="destructive"
                        className="h-11 rounded-xl sm:flex-1"
                      >
                        <X className="mr-2 h-4 w-4" />
                        Reject
                      </Button>
                      <Button
                        onClick={() =>
                          approveProduct(selectedProduct.id, selectedProduct)
                        }
                        disabled={actionLoading === selectedProduct.id}
                        className="h-11 rounded-xl sm:flex-1"
                        style={{ backgroundColor: C.primary }}
                      >
                        <Check className="mr-2 h-4 w-4" />
                        Approve
                      </Button>
                    </>
                  ) : selectedProduct.product_status === "approved" ? (
                    <Button
                      onClick={() => rejectProduct(selectedProduct)}
                      disabled={actionLoading === selectedProduct.id}
                      variant="destructive"
                      className="h-11 rounded-xl sm:flex-1"
                    >
                      <X className="mr-2 h-4 w-4" />
                      Revoke Approval
                    </Button>
                  ) : (
                    <Button
                      onClick={() =>
                        approveProduct(selectedProduct.id, selectedProduct)
                      }
                      disabled={actionLoading === selectedProduct.id}
                      className="h-11 rounded-xl sm:flex-1"
                      style={{ backgroundColor: C.primary }}
                    >
                      <Check className="mr-2 h-4 w-4" />
                      Reconsider
                    </Button>
                  )}
                </DialogFooter>
              </>
            )}
          </DialogContent>
        </Dialog>

        {/* Reject Dialog */}
        <Dialog
          open={rejectDialogOpen}
          onOpenChange={() => setRejectDialogOpen(false)}
        >
          <DialogContent className="max-w-xl rounded-3xl">
            <DialogHeader>
              <div
                className="mb-3 flex h-11 w-11 items-center justify-center rounded-xl"
                style={{ color: C.rejected, backgroundColor: C.rejectedLight }}
              >
                <XCircle className="h-5 w-5" />
              </div>
              <DialogTitle
                className="text-xl font-semibold"
                style={{ color: C.ink }}
              >
                {rejectTargets ? "Reject selected products" : "Reject product"}
              </DialogTitle>
              <DialogDescription
                className="text-sm leading-6"
                style={{ color: C.muted }}
              >
                Send a clear reason to the seller so they know what needs to be
                corrected.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-5 py-3">
              <div
                className="rounded-2xl border p-4"
                style={{ borderColor: C.border, backgroundColor: C.bg }}
              >
                <p className="text-sm" style={{ color: C.ink }}>
                  {rejectTargets ? (
                    <>
                      You are rejecting{" "}
                      <b style={{ color: C.rejected }}>
                        {rejectTargets.length} product
                        {rejectTargets.length === 1 ? "" : "s"}
                      </b>
                      .
                    </>
                  ) : (
                    <>
                      Product:{" "}
                      <b style={{ color: C.ink }}>{rejectTarget?.name}</b>
                    </>
                  )}
                </p>
              </div>

              <div>
                <span
                  className="mb-2 block text-[10px] font-bold uppercase tracking-[0.14em]"
                  style={{ color: C.muted }}
                >
                  Quick reasons
                </span>
                <div className="flex flex-wrap gap-2">
                  {QUICK_REJECT_REASONS.map((reason) => (
                    <button
                      key={reason}
                      type="button"
                      onClick={() => setRejectMessage(reason)}
                      className="rounded-full border px-3 py-1.5 text-xs font-medium transition-colors hover:bg-[#F5F4ED]"
                      style={{ borderColor: C.border, color: C.muted }}
                    >
                      {reason.split(" — ")[0]}
                    </button>
                  ))}
                </div>
              </div>

              <label className="block">
                <span
                  className="mb-2 block text-sm font-semibold"
                  style={{ color: C.ink }}
                >
                  Message to seller
                </span>
                <textarea
                  value={rejectMessage}
                  onChange={(e) =>
                    setRejectMessage(e.target.value.slice(0, 500))
                  }
                  placeholder="Explain why the product was rejected and how the seller can improve it..."
                  rows={6}
                  className="w-full resize-none rounded-2xl border px-4 py-3 text-sm leading-6 outline-none transition-all focus:ring-4"
                  style={{
                    borderColor: C.border,
                    color: C.ink,
                    backgroundColor: C.surface,
                  }}
                />
                <p
                  className="mt-1.5 text-right text-[10px]"
                  style={{ color: C.mutedLight }}
                >
                  {rejectMessage.length}/500
                </p>
              </label>
            </div>

            <DialogFooter className="flex flex-col gap-2 pt-2 sm:flex-row">
              <Button
                variant="outline"
                onClick={() => setRejectDialogOpen(false)}
                className="h-11 rounded-xl sm:flex-1"
              >
                Cancel
              </Button>
              <Button
                onClick={() =>
                  rejectTargets
                    ? performBulkReject()
                    : rejectTarget && performRejectProduct(rejectTarget.id)
                }
                disabled={
                  rejectTargets
                    ? bulkActionLoading
                    : !rejectTarget || actionLoading === rejectTarget?.id
                }
                className="h-11 rounded-xl sm:flex-1"
                style={{ backgroundColor: C.rejected }}
              >
                {bulkActionLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <>
                    <X className="mr-2 h-4 w-4" />
                    Send & Reject
                  </>
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AdminLayout>
  );
}
