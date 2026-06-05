import { useState } from "react";

import { supabase } from "@/lib/supabaseClient";

import { useAuthStore } from "@/store/authStore";

export default function AddProduct() {
  const { user } = useAuthStore();

  const [form, setForm] = useState({
    name: "",

    description: "",

    price: "",

    stock: "",

    category: "",

    image_url: "",
  });

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
  ) => {
    setForm({
      ...form,

      [e.target.name]: e.target.value,
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const { error } = await supabase

      .from("products")

      .insert({
        seller_id: user?.id,

        name: form.name,

        description: form.description,

        price: Number(form.price),

        stock: Number(form.stock),

        category: form.category,

        image_url: form.image_url,

        is_approved: false,

        is_featured: false,

        is_hidden: false,
      });

    if (error) {
      alert(error.message);

      return;
    }

    alert("Product created successfully");

    setForm({
      name: "",

      description: "",

      price: "",

      stock: "",

      category: "",

      image_url: "",
    });
  };

  return (
    <div className="max-w-3xl mx-auto p-8">
      <h1 className="text-3xl font-bold mb-8">Add Product</h1>

      <form onSubmit={handleSubmit} className="space-y-4">
        <input
          name="name"
          placeholder="Product Name"
          value={form.name}
          onChange={handleChange}
          className="w-full border p-3 rounded"
          required
        />

        <textarea
          name="description"
          placeholder="Description"
          value={form.description}
          onChange={handleChange}
          className="w-full border p-3 rounded"
          required
        />

        <input
          name="price"
          type="number"
          placeholder="Price"
          value={form.price}
          onChange={handleChange}
          className="w-full border p-3 rounded"
          required
        />

        <input
          name="stock"
          type="number"
          placeholder="Stock"
          value={form.stock}
          onChange={handleChange}
          className="w-full border p-3 rounded"
          required
        />

        <input
          name="category"
          placeholder="Category"
          value={form.category}
          onChange={handleChange}
          className="w-full border p-3 rounded"
          required
        />

        <input
          name="image_url"
          placeholder="Image URL"
          value={form.image_url}
          onChange={handleChange}
          className="w-full border p-3 rounded"
          required
        />

        <button
          type="submit"
          className="bg-green-600 text-white px-6 py-3 rounded"
        >
          Create Product
        </button>
      </form>
    </div>
  );
}
