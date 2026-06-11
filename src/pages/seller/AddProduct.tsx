import { useMemo, useState } from "react";
import type { ChangeEvent, FormEvent, ReactNode } from "react";
import {
  BadgeCheck,
  CheckCircle2,
  ImagePlus,
  IndianRupee,
  Leaf,
  PackageCheck,
  Recycle,
  RotateCcw,
  Send,
  ShieldCheck,
  Sparkles,
  Sprout,
  Warehouse,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

import SellerLayout from "@/layouts/SellerLayout";
import { supabase } from "@/lib/supabaseClient";
import { useAuthStore } from "@/store/authStore";

type ProductForm = {
  name: string;
  description: string;
  price: string;
  stock: string;
  category: string;
  image_url: string;
};

const initialForm: ProductForm = {
  name: "",
  description: "",
  price: "",
  stock: "",
  category: "",
  image_url: "",
};

const categoryOptions = [
  "Areca Tableware",
  "Natural Personal Care",
  "Organic Pantry",
  "Eco Home",
  "Reusable Essentials",
  "Wellness",
];

const placeholderImage =
  "https://images.unsplash.com/photo-1501004318641-b39e6451bec6?auto=format&fit=crop&w=900&q=80";

const inputClass =
  "w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 shadow-sm transition placeholder:text-slate-400 focus:border-emerald-300 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-100";

export default function AddProduct() {
  const { user } = useAuthStore();
  const [form, setForm] = useState<ProductForm>(initialForm);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [imageBroken, setImageBroken] = useState(false);

  const readiness = useMemo(() => {
    const checks = [
      Boolean(form.name.trim()),
      Boolean(form.category.trim()),
      Boolean(form.description.trim() && form.description.trim().length >= 30),
      Number(form.price) > 0,
      Number(form.stock) >= 0 && form.stock !== "",
      Boolean(form.image_url.trim()),
    ];

    return Math.round(
      (checks.filter(Boolean).length / checks.length) * 100,
    );
  }, [form]);

  const previewPrice = Number(form.price || 0);
  const previewStock = Number(form.stock || 0);
  const canSubmit =
    readiness === 100 && !loading && Number.isFinite(previewPrice);

  const handleChange = (
    e:
      | ChangeEvent<HTMLInputElement>
      | ChangeEvent<HTMLTextAreaElement>
      | ChangeEvent<HTMLSelectElement>,
  ) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
    setMessage(null);
    setError(null);

    if (name === "image_url") {
      setImageBroken(false);
    }
  };

  const resetForm = () => {
    setForm(initialForm);
    setMessage(null);
    setError(null);
    setImageBroken(false);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

    if (!user?.id) {
      setError("You must be logged in to add a product.");
      return;
    }

    if (!canSubmit) {
      setError("Complete every required field before submitting.");
      return;
    }

    setLoading(true);
    setError(null);
    setMessage(null);

    const { error: insertError } = await supabase.from("products").insert({
      seller_id: user.id,
      name: form.name.trim(),
      description: form.description.trim(),
      price: previewPrice,
      stock: previewStock,
      category: form.category.trim(),
      image_url: form.image_url.trim(),
      is_featured: false,
      is_hidden: false,
      product_status: "pending",
      created_at: new Date().toISOString(),
    });

    if (insertError) {
      setError(insertError.message);
      setLoading(false);
      return;
    }

    setMessage("Product submitted for review. Admin approval is now pending.");
    setForm(initialForm);
    setImageBroken(false);
    setLoading(false);
  };

  return (
    <SellerLayout>
      <div className="space-y-8">
        <section className="overflow-hidden rounded-[2rem] border border-emerald-100 bg-white shadow-sm">
          <div className="grid gap-8 bg-[linear-gradient(135deg,#f0fdf4_0%,#ecfeff_52%,#fff7ed_100%)] p-6 sm:p-8 xl:grid-cols-[1.1fr_0.9fr]">
            <div className="flex flex-col justify-between gap-8">
              <div>
                <div className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-white/80 px-4 py-2 text-sm font-semibold text-emerald-800 shadow-sm">
                  <Sprout className="h-4 w-4" />
                  Natural marketplace listing
                </div>
                <h1 className="mt-6 max-w-3xl text-4xl font-bold leading-tight text-slate-950 md:text-5xl">
                  Add a product with a story customers can trust.
                </h1>
                <p className="mt-4 max-w-2xl text-base leading-7 text-slate-600">
                  Build a clean product listing for Grevya's eco-conscious
                  buyers. Highlight natural materials, honest pricing, stock,
                  and a clear image before sending it for approval.
                </p>
              </div>

              <div className="grid gap-3 sm:grid-cols-3">
                <TrustPill
                  icon={Leaf}
                  label="Eco first"
                  value="Biodegradable focus"
                />
                <TrustPill
                  icon={ShieldCheck}
                  label="Reviewed"
                  value="Admin approval"
                />
                <TrustPill
                  icon={PackageCheck}
                  label="Seller ready"
                  value="Inventory tracked"
                />
              </div>
            </div>

            <div className="rounded-[1.5rem] border border-white/80 bg-white/75 p-5 shadow-xl shadow-emerald-900/5 backdrop-blur">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm font-semibold text-slate-500">
                    Listing readiness
                  </p>
                  <p className="mt-1 text-3xl font-bold text-emerald-800">
                    {readiness}%
                  </p>
                </div>
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-600 text-white shadow-lg shadow-emerald-200">
                  <Sparkles className="h-6 w-6" />
                </div>
              </div>
              <div className="mt-5 h-3 overflow-hidden rounded-full bg-emerald-100">
                <div
                  className="h-full rounded-full bg-emerald-600 transition-all duration-500"
                  style={{ width: `${readiness}%` }}
                />
              </div>
              <div className="mt-5 grid gap-3 text-sm text-slate-600">
                <ChecklistItem done={Boolean(form.name.trim())}>
                  Product name is clear
                </ChecklistItem>
                <ChecklistItem done={Boolean(form.category.trim())}>
                  Category is selected
                </ChecklistItem>
                <ChecklistItem
                  done={
                    Boolean(form.description.trim()) &&
                    form.description.trim().length >= 30
                  }
                >
                  Description has enough detail
                </ChecklistItem>
                <ChecklistItem done={Number(form.price) > 0}>
                  Price is valid
                </ChecklistItem>
                <ChecklistItem done={Number(form.stock) >= 0 && form.stock !== ""}>
                  Stock is available
                </ChecklistItem>
                <ChecklistItem done={Boolean(form.image_url.trim())}>
                  Image link is added
                </ChecklistItem>
              </div>
            </div>
          </div>
        </section>

        <form
          onSubmit={handleSubmit}
          className="grid gap-8 xl:grid-cols-[minmax(0,1fr)_380px]"
        >
          <div className="space-y-6">
            <section className="rounded-[1.75rem] border border-slate-200 bg-white p-6 shadow-sm">
              <SectionHeader
                icon={Leaf}
                title="Product identity"
                description="Name the item and place it in the right natural product family."
              />

              <div className="mt-6 grid gap-5 md:grid-cols-2">
                <Field label="Product Name">
                  <input
                    name="name"
                    value={form.name}
                    onChange={handleChange}
                    placeholder="Eg: Compostable Areca Dinner Plates"
                    className={inputClass}
                    required
                  />
                </Field>

                <Field label="Category">
                  <select
                    name="category"
                    value={form.category}
                    onChange={handleChange}
                    className={inputClass}
                    required
                  >
                    <option value="">Choose a category</option>
                    {categoryOptions.map((category) => (
                      <option key={category} value={category}>
                        {category}
                      </option>
                    ))}
                  </select>
                </Field>
              </div>

              <div className="mt-5">
                <Field label="Description">
                  <textarea
                    name="description"
                    value={form.description}
                    onChange={handleChange}
                    placeholder="Describe materials, sourcing, use cases, care instructions, and why this product is better for the planet."
                    rows={7}
                    className={`${inputClass} resize-none`}
                    required
                  />
                </Field>
                <div className="mt-2 flex justify-between text-xs text-slate-500">
                  <span>Minimum 30 characters recommended</span>
                  <span>{form.description.trim().length} characters</span>
                </div>
              </div>
            </section>

            <section className="rounded-[1.75rem] border border-slate-200 bg-white p-6 shadow-sm">
              <SectionHeader
                icon={Warehouse}
                title="Pricing and stock"
                description="Keep product economics simple, transparent, and ready for orders."
              />

              <div className="mt-6 grid gap-5 md:grid-cols-2">
                <Field label="Price">
                  <div className="relative">
                    <IndianRupee className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <input
                      name="price"
                      type="number"
                      value={form.price}
                      onChange={handleChange}
                      placeholder="199"
                      min="1"
                      step="0.01"
                      className={`${inputClass} pl-10`}
                      required
                    />
                  </div>
                </Field>

                <Field label="Stock Quantity">
                  <input
                    name="stock"
                    type="number"
                    value={form.stock}
                    onChange={handleChange}
                    placeholder="25"
                    min="0"
                    className={inputClass}
                    required
                  />
                </Field>
              </div>
            </section>

            <section className="rounded-[1.75rem] border border-slate-200 bg-white p-6 shadow-sm">
              <SectionHeader
                icon={ImagePlus}
                title="Product image"
                description="Use a bright, real product photo so buyers can inspect quality quickly."
              />

              <div className="mt-6">
                <Field label="Image URL">
                  <input
                    name="image_url"
                    value={form.image_url}
                    onChange={handleChange}
                    placeholder="https://example.com/your-product-photo.jpg"
                    className={inputClass}
                    required
                  />
                </Field>
              </div>
            </section>

            <div className="flex flex-col gap-3 rounded-[1.5rem] border border-emerald-100 bg-emerald-50 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-start gap-3 text-sm text-emerald-900">
                <BadgeCheck className="mt-0.5 h-5 w-5 flex-none" />
                <p>
                  New products are saved as pending and become visible after
                  admin review.
                </p>
              </div>

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={resetForm}
                  className="inline-flex items-center justify-center gap-2 rounded-full border border-emerald-200 bg-white px-5 py-3 text-sm font-semibold text-emerald-800 transition hover:border-emerald-300 hover:bg-emerald-50"
                >
                  <RotateCcw className="h-4 w-4" />
                  Reset
                </button>
                <button
                  type="submit"
                  disabled={!canSubmit}
                  className="inline-flex items-center justify-center gap-2 rounded-full bg-emerald-700 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-emerald-200 transition hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <Send className="h-4 w-4" />
                  {loading ? "Submitting..." : "Submit for Review"}
                </button>
              </div>
            </div>

            {message && (
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-5 py-4 text-sm font-medium text-emerald-800">
                {message}
              </div>
            )}
            {error && (
              <div className="rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-sm font-medium text-red-700">
                {error}
              </div>
            )}
          </div>

          <aside className="space-y-6 xl:sticky xl:top-8 xl:self-start">
            <section className="overflow-hidden rounded-[1.75rem] border border-slate-200 bg-white shadow-sm">
              <div className="relative h-64 bg-slate-100">
                {form.image_url && !imageBroken ? (
                  <img
                    src={form.image_url}
                    alt={form.name || "Product preview"}
                    onError={() => setImageBroken(true)}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <img
                    src={placeholderImage}
                    alt="Natural product placeholder"
                    className="h-full w-full object-cover"
                  />
                )}
                <div className="absolute left-4 top-4 rounded-full bg-white/90 px-3 py-1 text-xs font-bold text-emerald-800 shadow-sm">
                  Eco listing
                </div>
              </div>

              <div className="p-5">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-700">
                  Live preview
                </p>
                <h2 className="mt-3 line-clamp-2 text-2xl font-bold text-slate-950">
                  {form.name || "Your natural product name"}
                </h2>
                <p className="mt-2 text-sm font-medium text-slate-500">
                  {form.category || "Category"}
                </p>

                <p className="mt-4 line-clamp-4 text-sm leading-6 text-slate-600">
                  {form.description ||
                    "A thoughtful product description will appear here as you type."}
                </p>

                <div className="mt-5 grid grid-cols-2 gap-3">
                  <PreviewMetric
                    label="Price"
                    value={previewPrice > 0 ? `₹${previewPrice.toFixed(2)}` : "₹0.00"}
                  />
                  <PreviewMetric
                    label="Stock"
                    value={form.stock ? `${previewStock} units` : "0 units"}
                  />
                </div>
              </div>
            </section>

            <section className="rounded-[1.75rem] border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-amber-100 text-amber-700">
                  <Recycle className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-950">Listing tips</h3>
                  <p className="text-sm text-slate-500">Small details sell trust.</p>
                </div>
              </div>

              <div className="mt-5 space-y-3 text-sm leading-6 text-slate-600">
                <p>Use product photos with natural light and plain backgrounds.</p>
                <p>Mention material, size, quantity, usage, and care instructions.</p>
                <p>Keep claims honest: compostable, reusable, handmade, or organic only when true.</p>
              </div>
            </section>
          </aside>
        </form>
      </div>
    </SellerLayout>
  );
}

function TrustPill({
  icon: Icon,
  label,
  value,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-2xl border border-white/80 bg-white/70 p-4 shadow-sm backdrop-blur">
      <Icon className="h-5 w-5 text-emerald-700" />
      <p className="mt-3 text-sm font-bold text-slate-900">{label}</p>
      <p className="mt-1 text-xs text-slate-500">{value}</p>
    </div>
  );
}

function SectionHeader({
  icon: Icon,
  title,
  description,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
}) {
  return (
    <div className="flex items-start gap-4">
      <div className="flex h-12 w-12 flex-none items-center justify-center rounded-2xl bg-emerald-100 text-emerald-700">
        <Icon className="h-5 w-5" />
      </div>
      <div>
        <h2 className="text-xl font-bold text-slate-950">{title}</h2>
        <p className="mt-1 text-sm leading-6 text-slate-500">{description}</p>
      </div>
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <label className="block">
      <span className="text-sm font-semibold text-slate-700">{label}</span>
      <div className="mt-2">{children}</div>
    </label>
  );
}

function ChecklistItem({
  done,
  children,
}: {
  done: boolean;
  children: ReactNode;
}) {
  return (
    <div className="flex items-center gap-2">
      <CheckCircle2
        className={`h-4 w-4 ${done ? "text-emerald-600" : "text-slate-300"}`}
      />
      <span className={done ? "text-slate-700" : "text-slate-400"}>
        {children}
      </span>
    </div>
  );
}

function PreviewMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-slate-50 p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
        {label}
      </p>
      <p className="mt-2 text-lg font-bold text-slate-950">{value}</p>
    </div>
  );
}
