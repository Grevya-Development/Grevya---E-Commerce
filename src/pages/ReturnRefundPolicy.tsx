import React, { useRef, useState } from "react";
import { Link } from "react-router-dom";
import PolicyLayout from "@/components/PolicyLayout";
import {
  AlertTriangle,
  CheckCircle,
  ChevronRight,
  FileUp,
  HelpCircle,
  Image as ImageIcon,
  PackageCheck,
  PackageSearch,
  RotateCcw,
  ShieldCheck,
  Truck,
  X,
} from "lucide-react";
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

const resolutionSteps = [
  {
    title: "Document the issue",
    desc: "Take a clear photograph or short video of the damaged item and the shipping label on the box.",
  },
  {
    title: "Contact our team",
    desc: "Send your claim within 48 hours of delivery with your Order ID and documentation attached.",
  },
  {
    title: "Receive your resolution",
    desc: "We verify the claim and dispatch a replacement or process a refund within 24 hours.",
  },
];

const MAX_FILES = 5;

const fieldClass =
  "mt-2 w-full rounded-lg border border-[#E2DBCD] bg-white px-3 py-2.5 text-sm text-[#2B2F18] outline-none transition placeholder:text-[#B3AFA3] focus:border-[#A68D65] focus:ring-4 focus:ring-[#A68D65]/15 disabled:bg-[#F6F3EC] disabled:text-[#8A8678]";

const labelClass = "block text-sm font-medium text-[#4A4A42]";

interface CustomerOrderOption {
  id: string;
  created_at: string;
  total_amount: number | null;
  status: string | null;
  order_items: CustomerOrderItem[] | null;
}

interface CustomerOrderItem {
  id: string;
  product_name: string | null;
  product_image: string | null;
  quantity: number;
  price: number | null;
}

const ReturnRefundPolicy = () => {
  const { user, profile } = useAuth();
  const [supportOpen, setSupportOpen] = useState(false);
  const [customerOrders, setCustomerOrders] = useState<CustomerOrderOption[]>(
    [],
  );
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [selectedOrderItemId, setSelectedOrderItemId] = useState("");
  const [issueType, setIssueType] = useState("wrong_product");
  const [description, setDescription] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const orderItemSelectRef = useRef<HTMLInputElement>(null);
  const changeProductRef = useRef<HTMLButtonElement>(null);
  const dialogTitleRef = useRef<HTMLHeadingElement>(null);

  const eligibleOrders = customerOrders.filter(
    (order) =>
      order.status?.trim().toLowerCase() === "delivered" &&
      (order.order_items?.length || 0) > 0,
  );
  const selectedOrder = eligibleOrders.find((order) =>
    order.order_items?.some((item) => item.id === selectedOrderItemId),
  );
  const selectedOrderItem = selectedOrder?.order_items?.find(
    (item) => item.id === selectedOrderItemId,
  );

  const openSupportRequest = async () => {
    setSupportOpen(true);
    setSubmitted(false);
    setError(null);
    setCustomerOrders([]);
    setSelectedOrderItemId("");

    if (!user) return;

    setOrdersLoading(true);
    try {
      const { data, error: ordersError } = await supabase
        .from("orders")
        .select(
          "id,created_at,total_amount,status,order_items(id,product_name,product_image,quantity,price)",
        )
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (ordersError) {
        setError(`Unable to load your orders: ${ordersError.message}`);
      } else {
        setCustomerOrders((data || []) as CustomerOrderOption[]);
      }
    } catch (loadError: unknown) {
      setError(
        `Unable to load your orders: ${
          loadError instanceof Error ? loadError.message : String(loadError)
        }`,
      );
    } finally {
      setOrdersLoading(false);
    }
  };

  const submitSupportRequest = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!user || !selectedOrder || !selectedOrderItem || !description.trim())
      return;

    setSubmitting(true);
    setError(null);

    try {
      const { data: ownedOrder, error: ownershipError } = await supabase
        .from("orders")
        .select("id,status,order_items(id)")
        .eq("id", selectedOrder.id)
        .eq("user_id", user.id)
        .eq("status", "delivered")
        .maybeSingle();

      if (ownershipError || !ownedOrder) {
        setError(
          ownershipError
            ? `Unable to verify this order: ${ownershipError.message}`
            : "This order is no longer eligible or does not belong to your account.",
        );
        return;
      }

      const verifiedItems = ownedOrder.order_items as
        | Array<{ id: string }>
        | null;
      if (!verifiedItems?.some((item) => item.id === selectedOrderItem.id)) {
        setError(
          "The selected product is no longer part of this order. Please choose another item.",
        );
        setSelectedOrderItemId("");
        return;
      }

      const claimId = crypto.randomUUID();
      const evidenceUrls: string[] = [];
      for (const [index, file] of files.entries()) {
        const safeName = file.name.replace(/[^\w.-]+/g, "_");
        const path = `${user.id}/${claimId}/${index}-${safeName}`;
        const { error: uploadError } = await supabase.storage
          .from("return-refund-evidence")
          .upload(path, file);
        if (uploadError) {
          setError(`Upload failed for ${file.name}: ${uploadError.message}`);
          return;
        }
        evidenceUrls.push(path);
      }

      const { error: insertError } = await supabase
        .from("return_refund_claims")
        .insert({
          id: claimId,
          order_id: ownedOrder.id,
          customer_id: user.id,
          issue_type: issueType,
          description: `Selected product: ${
            selectedOrderItem.product_name || "Product"
          } (order item ${selectedOrderItem.id}, quantity ${
            selectedOrderItem.quantity
          })\n\n${description.trim()}`,
          evidence_urls: evidenceUrls,
        });

      if (insertError) {
        setError(insertError.message);
        return;
      }

      setSubmitted(true);
      setSelectedOrderItemId("");
      setDescription("");
      setFiles([]);
    } catch (submitError: unknown) {
      setError(
        `Unable to submit your request: ${
          submitError instanceof Error
            ? submitError.message
            : String(submitError)
        }`,
      );
    } finally {
      setSubmitting(false);
    }
  };

  const addFiles = (selectedFiles: File[]) => {
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
        .slice(0, MAX_FILES);
    });
  };

  return (
    <PolicyLayout title="Return & Refund Policy" updated="June 2026">
      {/* Introduction */}
      <blockquote className="mb-14 border-l-2 border-[#A68D65]/60 pl-6">
        <p className="font-serif text-xl italic leading-[1.7] text-[#3A3F22] md:text-2xl md:leading-[1.65]">
          At Grevya Naturals, each formulation is a fresh, botanical composition
          handcrafted in small, active batches. To preserve the purity, hygiene
          and freshness of our organic lifestyle goods, we keep a careful policy
          on returns and fulfillment.
        </p>
      </blockquote>

      <div className="divide-y divide-[#ECE6DA]">
        {/* 1 */}
        <section className="space-y-5 pb-12">
          <h2 className="font-serif text-2xl font-semibold tracking-tight text-[#2B2F18] md:text-[1.75rem]">
            1. Purity and hygiene
          </h2>
          <div className="flex gap-5 rounded-2xl bg-[#F8F4EC] p-6 md:p-7">
            <ShieldCheck className="mt-0.5 h-6 w-6 shrink-0 text-[#A68D65]" />
            <div className="max-w-prose space-y-2">
              <p className="font-semibold text-[#2B2F18]">
                Why all sales are final
              </p>
              <p className="text-[15px] leading-7 text-[#5C5A50]">
                Our skincare, wellness and lifestyle preparations are organic,
                free of chemical preservatives and sensitive to their
                environment. Once a product leaves our temperature-controlled
                fulfillment center, we cannot accept returns or refunds. This
                guarantees that every customer receives an untouched, untampered
                and fresh product.
              </p>
            </div>
          </div>
        </section>

        {/* 2 */}
        <section className="space-y-5 py-12">
          <h2 className="font-serif text-2xl font-semibold tracking-tight text-[#2B2F18] md:text-[1.75rem]">
            2. Transit and damage cover
          </h2>
          <p className="max-w-prose text-[15px] leading-7 text-[#5C5A50]">
            Although all items are final sale, we insure every shipment. If your
            package is harmed in transit, we take full responsibility for
            putting it right.
          </p>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-2xl border border-[#ECE6DA] bg-white p-6">
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-rose-50 text-rose-600">
                <AlertTriangle className="h-4 w-4" />
              </span>
              <h3 className="mt-4 font-semibold text-[#2B2F18]">
                Damaged shipments
              </h3>
              <p className="mt-2 text-sm leading-6 text-[#5C5A50]">
                If a glass jar, botanical vial or the packaging arrives broken
                or leaking, tell us within 48 hours of receipt. We will send a
                complimentary replacement or refund.
              </p>
            </div>
            <div className="rounded-2xl border border-[#ECE6DA] bg-white p-6">
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-emerald-50 text-emerald-700">
                <Truck className="h-4 w-4" />
              </span>
              <h3 className="mt-4 font-semibold text-[#2B2F18]">
                Delivery discrepancies
              </h3>
              <p className="mt-2 text-sm leading-6 text-[#5C5A50]">
                If our logistics partner marks your order delivered but it has
                not arrived, or a shipment is lost, contact us straight away. We
                will start a trace and work out a resolution with you.
              </p>
            </div>
          </div>
        </section>

        {/* 3 */}
        <section className="space-y-5 py-12">
          <h2 className="font-serif text-2xl font-semibold tracking-tight text-[#2B2F18] md:text-[1.75rem]">
            3. Fulfillment and accuracy
          </h2>
          <div className="flex gap-5 rounded-2xl bg-[#F8F4EC] p-6 md:p-7">
            <RotateCcw className="mt-0.5 h-6 w-6 shrink-0 text-[#A68D65]" />
            <div className="max-w-prose space-y-2">
              <p className="font-semibold text-[#2B2F18]">
                Incorrect items dispatched
              </p>
              <p className="text-[15px] leading-7 text-[#5C5A50]">
                If our packing team sends the wrong blend, size or product, we
                will ship the correct item at no cost. You do not need to send
                the incorrect item back.
              </p>
            </div>
          </div>
        </section>

        {/* 4 */}
        <section className="space-y-6 pt-12">
          <h2 className="font-serif text-2xl font-semibold tracking-tight text-[#2B2F18] md:text-[1.75rem]">
            4. How to raise a claim
          </h2>
          <p className="max-w-prose text-[15px] leading-7 text-[#5C5A50]">
            For a transit-damaged or incorrect shipment, follow these three
            steps.
          </p>

          <ol className="relative space-y-8">
            <span
              aria-hidden
              className="absolute bottom-3 left-[17px] top-3 w-px bg-[#E5DFD2]"
            />
            {resolutionSteps.map((item, idx) => (
              <li key={item.title} className="relative flex gap-5">
                <span className="z-10 flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-[#D9CFBC] bg-white font-serif text-sm font-semibold text-[#4D5528]">
                  {idx + 1}
                </span>
                <div className="max-w-prose pt-1">
                  <h3 className="font-semibold text-[#2B2F18]">{item.title}</h3>
                  <p className="mt-1 text-sm leading-6 text-[#5C5A50]">
                    {item.desc}
                  </p>
                </div>
              </li>
            ))}
          </ol>
        </section>
      </div>

      {/* Support CTA */}
      <div className="mt-16 flex flex-col items-start justify-between gap-6 rounded-3xl bg-[#2B2F18] p-8 text-white sm:flex-row sm:items-center md:p-10">
        <div className="max-w-md">
          <h3 className="flex items-center gap-2.5 font-serif text-2xl font-semibold text-[#F7EEE4]">
            <HelpCircle className="h-5 w-5 text-[#C9AE7E]" />
            Need help with an order?
          </h3>
          <p className="mt-2 text-sm leading-6 text-white/65">
            Tell us what happened and our support team will review it with you.
          </p>
        </div>
        <Button
          type="button"
          onClick={openSupportRequest}
          className="h-11 shrink-0 rounded-lg bg-[#F7EEE4] px-6 text-sm font-semibold text-[#2B2F18] shadow-none transition hover:bg-white"
        >
          Contact support
        </Button>
      </div>

      {/* Support request dialog */}
      <Dialog open={supportOpen} onOpenChange={setSupportOpen}>
        <DialogContent
          onOpenAutoFocus={(event) => {
            event.preventDefault();
            dialogTitleRef.current?.focus();
          }}
          className="max-h-[90dvh] overflow-y-auto rounded-2xl border-[#ECE6DA] bg-white p-5 sm:max-w-xl sm:p-6"
        >
          <DialogHeader className="text-left">
            <DialogTitle
              ref={dialogTitleRef}
              tabIndex={-1}
              className="font-serif text-2xl font-semibold text-[#2B2F18]"
            >
              Report an issue with an order
            </DialogTitle>
            <DialogDescription className="text-[#7A776C]">
              Share the details below. Our team will review your order and post
              updates on your order page.
            </DialogDescription>
          </DialogHeader>

          {!user ? (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
              Sign in to submit a support request.
            </div>
          ) : submitted ? (
            <div className="space-y-4 rounded-2xl bg-emerald-50 px-6 py-8 text-center">
              <CheckCircle className="mx-auto h-10 w-10 text-emerald-600" />
              <p className="font-serif text-xl font-semibold text-emerald-900">
                Request submitted
              </p>
              <p className="mx-auto max-w-sm text-sm leading-6 text-emerald-800">
                We will review your evidence and update the claim status on your
                order page.
              </p>
              <Button
                type="button"
                onClick={() => setSupportOpen(false)}
                className="h-10 rounded-lg bg-[#2B2F18] px-6 shadow-none hover:bg-[#4D5528]"
              >
                Close
              </Button>
            </div>
          ) : (
            <form onSubmit={submitSupportRequest} className="space-y-5">
              <fieldset>
                <legend className={`${labelClass} mb-2`}>
                  Select the product
                </legend>
                <div className="mb-2 flex items-center justify-between gap-3">
                  {selectedOrderItem && (
                    <button
                      ref={changeProductRef}
                      type="button"
                      onClick={() => {
                        setSelectedOrderItemId("");
                        setError(null);
                        requestAnimationFrame(() =>
                          orderItemSelectRef.current?.focus(),
                        );
                      }}
                      className="rounded-md text-sm font-medium text-[#59612F] underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#A68D65]"
                    >
                      Change product
                    </button>
                  )}
                </div>

                {ordersLoading ? (
                  <div
                    role="status"
                    className="flex items-center gap-3 rounded-xl border border-[#ECE6DA] bg-[#FBF9F4] p-4 text-sm text-[#6E6A5D]"
                  >
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-[#A68D65] border-t-transparent" />
                    Loading your delivered orders…
                  </div>
                ) : selectedOrder && selectedOrderItem ? (
                  <div className="flex min-w-0 gap-4 rounded-xl border border-[#A68D65] bg-[#F8F4EC] p-3 shadow-sm sm:p-4">
                    <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-lg border border-[#E2DBCD] bg-white sm:h-24 sm:w-24">
                      <ImageIcon
                        aria-hidden="true"
                        className="absolute inset-0 m-auto h-7 w-7 text-[#B3AFA3]"
                      />
                      {selectedOrderItem.product_image && (
                        <img
                          src={selectedOrderItem.product_image}
                          alt={selectedOrderItem.product_name || "Selected product"}
                          onError={(event) => {
                            event.currentTarget.style.display = "none";
                          }}
                          className="absolute inset-0 h-full w-full object-cover"
                        />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <h3 className="min-w-0 break-words font-semibold text-[#2B2F18]">
                          {selectedOrderItem.product_name || "Product details unavailable"}
                        </h3>
                        <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-semibold text-emerald-800">
                          Delivered
                        </span>
                      </div>
                      <p className="mt-1 text-sm text-[#69665C]">
                        Quantity: {selectedOrderItem.quantity}
                      </p>
                      <p className="mt-1 break-all text-xs text-[#8A8678]">
                        Order #{selectedOrder.id.slice(0, 8)} ·{" "}
                        {new Date(selectedOrder.created_at).toLocaleDateString(
                          "en-IN",
                          { day: "numeric", month: "short", year: "numeric" },
                        )}
                      </p>
                      <p className="mt-1 text-xs text-[#8A8678]">
                        Item reference: #{selectedOrderItem.id.slice(0, 8)}
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="rounded-xl border border-[#ECE6DA] bg-[#FBF9F4] p-3 sm:p-4">
                    {eligibleOrders.length ? (
                      <div
                        role="radiogroup"
                        aria-label="Delivered order products"
                        className="max-h-64 space-y-3 overflow-y-auto pr-1"
                      >
                        {eligibleOrders.flatMap((order) =>
                          (order.order_items || []).map((item, index) => {
                            const orderDate = new Date(
                              order.created_at,
                            ).toLocaleDateString("en-IN", {
                              day: "numeric",
                              month: "short",
                              year: "numeric",
                            });
                            return (
                              <label
                                key={item.id}
                                className="group flex min-w-0 cursor-pointer gap-3 rounded-xl border border-[#E2DBCD] bg-white p-3 shadow-sm transition duration-200 hover:-translate-y-0.5 hover:border-[#C9AE7E] hover:shadow-md focus-within:outline-none focus-within:ring-2 focus-within:ring-[#A68D65] has-[:checked]:border-[#A68D65] has-[:checked]:bg-[#F8F4EC] has-[:checked]:ring-2 has-[:checked]:ring-[#A68D65]/20"
                              >
                                <input
                                  ref={
                                    order.id === eligibleOrders[0]?.id &&
                                    index === 0
                                      ? orderItemSelectRef
                                      : undefined
                                  }
                                  type="radio"
                                  name="selected-order-item"
                                  required
                                  value={item.id}
                                  checked={selectedOrderItemId === item.id}
                                  onChange={() => {
                                    setSelectedOrderItemId(item.id)
                                    setError(null);
                                    requestAnimationFrame(() =>
                                      changeProductRef.current?.focus(),
                                    );
                                  }}
                                  aria-label={`Select ${
                                    item.product_name || "product"
                                  }, quantity ${item.quantity}, order placed ${orderDate}`}
                                  className="sr-only"
                                />
                                <span className="relative h-[4.5rem] w-[4.5rem] shrink-0 overflow-hidden rounded-lg border border-[#ECE6DA] bg-[#F8F4EC]">
                                  <ImageIcon
                                    aria-hidden="true"
                                    className="absolute inset-0 m-auto h-6 w-6 text-[#B3AFA3]"
                                  />
                                  {item.product_image && (
                                    <img
                                      src={item.product_image}
                                      alt=""
                                      onError={(event) => {
                                        event.currentTarget.style.display =
                                          "none";
                                      }}
                                      className="absolute inset-0 h-full w-full object-cover"
                                    />
                                  )}
                                </span>
                                <span className="min-w-0 flex-1">
                                  <span className="flex flex-wrap items-start justify-between gap-2">
                                    <span className="break-words font-semibold leading-5 text-[#2B2F18]">
                                      {item.product_name ||
                                        "Product details unavailable"}
                                    </span>
                                    <span className="shrink-0 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-800">
                                      Delivered
                                    </span>
                                  </span>
                                  <span className="mt-1 block text-xs text-[#69665C]">
                                    Qty {item.quantity}
                                    {order.total_amount != null &&
                                      ` · Order total ₹${Number(
                                        order.total_amount,
                                      ).toLocaleString("en-IN", {
                                        minimumFractionDigits: 2,
                                      })}`}
                                  </span>
                                  <span className="mt-1 block break-all text-xs text-[#8A8678]">
                                    Order #{order.id.slice(0, 8)} · {orderDate}
                                  </span>
                                </span>
                                <span
                                  aria-hidden="true"
                                  className="mt-1 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-[#CFC0A6] text-transparent transition group-has-[:checked]:border-[#59612F] group-has-[:checked]:bg-[#59612F] group-has-[:checked]:text-white"
                                >
                                  <CheckCircle className="h-3.5 w-3.5" />
                                </span>
                              </label>
                            );
                          }),
                        )}
                      </div>
                    ) : (
                      <div className="py-5 text-center">
                        <PackageSearch className="mx-auto h-8 w-8 text-[#A68D65]" />
                        <p className="mt-2 font-medium text-[#2B2F18]">
                          No eligible delivered orders
                        </p>
                        <p className="mx-auto mt-1 max-w-sm text-sm leading-5 text-[#777367]">
                          You don't have any eligible delivered orders for a
                          return or refund yet.
                        </p>
                        <Button
                          asChild
                          type="button"
                          variant="outline"
                          className="mt-4 h-9 rounded-lg border-[#D9CFBC] text-[#3F4723]"
                        >
                          <Link to="/orders">
                            View order history
                            <ChevronRight className="ml-1 h-4 w-4" />
                          </Link>
                        </Button>
                      </div>
                    )}
                  </div>
                )}
              </fieldset>

              <div className="grid gap-4 sm:grid-cols-2">
                <label className={labelClass}>
                  Name
                  <input
                    readOnly
                    value={
                      profile?.full_name || profile?.username || "Customer"
                    }
                    className={`${fieldClass} cursor-default bg-[#F6F3EC]`}
                  />
                </label>
                <label className={labelClass}>
                  Email
                  <input
                    readOnly
                    value={profile?.email || user.email || ""}
                    className={`${fieldClass} cursor-default bg-[#F6F3EC]`}
                  />
                </label>
              </div>

              <label className={labelClass}>
                What went wrong?
                <select
                  value={issueType}
                  onChange={(event) => setIssueType(event.target.value)}
                  className={fieldClass}
                >
                  {issueTypes.map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>

              <label className={labelClass}>
                Description
                <Textarea
                  required
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                  placeholder="Describe the problem, including which items are affected"
                  className="mt-2 min-h-28 rounded-lg border-[#E2DBCD] bg-white text-sm focus-visible:border-[#A68D65] focus-visible:ring-[#A68D65]/15"
                />
              </label>

              <div>
                <p className={labelClass}>Photo or video evidence</p>
                <label
                  htmlFor="claim-evidence"
                  className={`mt-2 flex cursor-pointer flex-col items-center gap-1.5 rounded-xl border border-dashed border-[#CFC0A6] bg-[#FBF9F4] px-4 py-6 text-center transition hover:border-[#A68D65] hover:bg-[#F8F4EC] focus-within:ring-4 focus-within:ring-[#A68D65]/15 ${
                    files.length >= MAX_FILES
                      ? "pointer-events-none opacity-50"
                      : ""
                  }`}
                >
                  <FileUp className="h-5 w-5 text-[#A68D65]" />
                  <span className="text-sm font-medium text-[#3F4723]">
                    Choose photos or videos
                  </span>
                  <span className="text-xs text-[#8A8678]">
                    Add up to {MAX_FILES} files ({files.length} added)
                  </span>
                  <input
                    id="claim-evidence"
                    type="file"
                    accept="image/*,video/*"
                    multiple
                    disabled={files.length >= MAX_FILES}
                    onChange={(event) => {
                      addFiles(Array.from(event.target.files || []));
                      event.currentTarget.value = "";
                    }}
                    className="sr-only"
                  />
                </label>

                {files.length > 0 && (
                  <ul className="mt-3 space-y-1.5">
                    {files.map((file) => (
                      <li
                        key={`${file.name}-${file.lastModified}`}
                        className="flex items-center justify-between gap-3 rounded-lg border border-[#ECE6DA] bg-white px-3 py-2 text-sm text-[#3F4723]"
                      >
                        <span className="flex min-w-0 items-center gap-2">
                          <PackageCheck className="h-4 w-4 shrink-0 text-emerald-600" />
                          <span className="truncate">{file.name}</span>
                        </span>
                        <button
                          type="button"
                          title={`Remove ${file.name}`}
                          aria-label={`Remove ${file.name}`}
                          onClick={() =>
                            setFiles((currentFiles) =>
                              currentFiles.filter(
                                (currentFile) => currentFile !== file,
                              ),
                            )
                          }
                          className="shrink-0 rounded-full p-1 text-[#8A8678] transition hover:bg-[#F6F3EC] hover:text-[#2B2F18] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#A68D65]"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              {error && (
                <p
                  role="alert"
                  className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800"
                >
                  {error}
                </p>
              )}

              <Button
                type="submit"
                disabled={
                  submitting ||
                  ordersLoading ||
                  !selectedOrderItemId ||
                  !description.trim()
                }
                className="h-11 w-full rounded-lg bg-[#2B2F18] text-sm font-semibold shadow-none hover:bg-[#4D5528]"
              >
                {submitting ? "Submitting…" : "Submit request"}
              </Button>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </PolicyLayout>
  );
};

export default ReturnRefundPolicy;
