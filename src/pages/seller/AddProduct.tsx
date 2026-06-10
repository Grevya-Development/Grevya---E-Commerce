import { useState } from "react";

import SellerLayout from "@/layouts/SellerLayout";
import { supabase } from "@/lib/supabaseClient";
import { useAuthStore } from "@/store/authStore";

const initialForm = {
  name: "",
  description: "",
  price: "",
  stock: "",
  category: "",
  image_url: "",
};

export default function AddProduct() {
  const { user } = useAuthStore();
  const [form, setForm] = useState(initialForm);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
  ) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
    setMessage(null);
    setError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!user?.id) {
      setError("You must be logged in to add a product.");
      return;
    }

    setLoading(true);
    setError(null);
    setMessage(null);

    const { error: insertError } = await supabase.from("products").insert({
      seller_id: user.id,
      name: form.name,
      description: form.description,
      price: Number(form.price),
      stock: Number(form.stock),
      category: form.category,
      image_url: form.image_url,
      is_featured: false,
      is_hidden: false,
      created_at: new Date().toISOString(),
    });

    if (insertError) {
      setError(insertError.message);
      setLoading(false);
      return;
    }

    setMessage("Product created successfully. It will appear once reviewed.");
    setForm(initialForm);
    setLoading(false);
  };

  return (
    <SellerLayout>
      <div className="mx-auto max-w-3xl p-8">
        <div className="mb-8 rounded-3xl border border-green-100 bg-emerald-50/70 p-7 shadow-sm">
          <h1 className="text-3xl font-bold text-green-900">Add Product</h1>
          <p className="mt-3 text-sm text-slate-600">
            Add your product to the marketplace with a concise title, category,
            stock, and image preview link.
          </p>
        </div>

        <div className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid gap-5 sm:grid-cols-2">
              <label className="block">
                <span className="text-sm font-medium text-slate-700">
                  Product Name
                </span>
                <input
                  name="name"
                  value={form.name}
                  onChange={handleChange}
                  placeholder="Eg: Organic Shampoo"
                  className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 shadow-sm focus:border-emerald-300 focus:outline-none focus:ring-2 focus:ring-emerald-100"
                  required
                />
              </label>

              <label className="block">
                <span className="text-sm font-medium text-slate-700">
                  Category
                </span>
                <input
                  name="category"
                  value={form.category}
                  onChange={handleChange}
                  placeholder="Eg: Hair Care"
                  className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 shadow-sm focus:border-emerald-300 focus:outline-none focus:ring-2 focus:ring-emerald-100"
                  required
                />
              </label>
            </div>

            <label className="block">
              <span className="text-sm font-medium text-slate-700">
                Description
              </span>
              <textarea
                name="description"
                value={form.description}
                onChange={handleChange}
                placeholder="Describe the product with features, benefits, and usage instructions."
                rows={5}
                className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 shadow-sm focus:border-emerald-300 focus:outline-none focus:ring-2 focus:ring-emerald-100"
                required
              />
            </label>

            <div className="grid gap-5 sm:grid-cols-2">
              <label className="block">
                <span className="text-sm font-medium text-slate-700">
                  Price
                </span>
                <input
                  name="price"
                  type="number"
                  value={form.price}
                  onChange={handleChange}
                  placeholder="Eg: 199"
                  min="0"
                  className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 shadow-sm focus:border-emerald-300 focus:outline-none focus:ring-2 focus:ring-emerald-100"
                  required
                />
              </label>

              <label className="block">
                <span className="text-sm font-medium text-slate-700">
                  Stock
                </span>
                <input
                  name="stock"
                  type="number"
                  value={form.stock}
                  onChange={handleChange}
                  placeholder="Eg: 12"
                  min="0"
                  className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 shadow-sm focus:border-emerald-300 focus:outline-none focus:ring-2 focus:ring-emerald-100"
                  required
                />
              </label>
            </div>

            <label className="block">
              <span className="text-sm font-medium text-slate-700">
                Image URL
              </span>
              <input
                name="image_url"
                value={form.image_url}
                onChange={handleChange}
                placeholder="Eg: https://example.com/product.jpg"
                className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 shadow-sm focus:border-emerald-300 focus:outline-none focus:ring-2 focus:ring-emerald-100"
                required
              />
            </label>

            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-slate-500">
                Products are submitted as pending approval, then reviewed by the
                admin.
              </p>
              <button
                type="submit"
                disabled={loading}
                className="inline-flex items-center justify-center rounded-full bg-green-600 px-6 py-3 text-sm font-semibold text-white transition hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loading ? "Creating…" : "Create Product"}
              </button>
            </div>

            {message && (
              <div className="rounded-2xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
                {message}
              </div>
            )}
            {error && (
              <div className="rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">
                {error}
              </div>
            )}
          </form>
        </div>
      </div>
    </SellerLayout>
  );
}
