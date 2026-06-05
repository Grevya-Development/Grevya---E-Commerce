import { useEffect, useState } from "react";
import AdminLayout from "@/layouts/AdminLayout";
import { supabase } from "@/lib/supabaseClient";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface Product {
  id: string;
  name: string;
  price: number;
  stock: number;
  category: string;
  is_featured: boolean;
  is_hidden: boolean;
}

export default function AdminProducts() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchProducts = async () => {
    const { data, error } = await supabase
      .from("products")
      .select("*")
      .order("name");
      

    if (!error && data) {
      setProducts(data);
    }

    setLoading(false);
  };

  useEffect(() => {
    fetchProducts();
  }, []);

  const deleteProduct = async (id: string) => {
    const confirmed = window.confirm(
      "Delete this product?"
    );

    if (!confirmed) return;

    const { error } = await supabase
      .from("products")
      .delete()
      .eq("id", id);

    if (!error) {
      fetchProducts();
    }
  };

  const toggleFeatured = async (
    id: string,
    current: boolean
  ) => {
    await supabase
      .from("products")
      .update({
        is_featured: !current,
      })
      .eq("id", id);

    fetchProducts();
  };

  const toggleHidden = async (
    id: string,
    current: boolean
  ) => {
    await supabase
      .from("products")
      .update({
        is_hidden: !current,
      })
      .eq("id", id);

    fetchProducts();
  };

  return (
    <AdminLayout>
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-green-900">
          Product Management
        </h1>

        <p className="text-gray-600 mt-2">
          Manage all products
        </p>
      </div>

      <div className="bg-white rounded-2xl border shadow-sm">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Price</TableHead>
              <TableHead>Stock</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>Featured</TableHead>
              <TableHead>Hidden</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>

          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={7}>
                  Loading...
                </TableCell>
              </TableRow>
            ) : (
              products.map((product) => (
                <TableRow key={product.id}>
                  <TableCell>
                    {product.name}
                  </TableCell>

                  <TableCell>
                    ₹{product.price}
                  </TableCell>

                  <TableCell>
                    {product.stock}
                  </TableCell>

                  <TableCell>
                    {product.category}
                  </TableCell>

                  <TableCell>
                    <button
                      onClick={() =>
                        toggleFeatured(
                          product.id,
                          product.is_featured
                        )
                      }
                      className={`px-3 py-1 rounded text-white ${
                        product.is_featured
                          ? "bg-green-600"
                          : "bg-gray-400"
                      }`}
                    >
                      {product.is_featured
                        ? "Featured"
                        : "No"}
                    </button>
                  </TableCell>

                  <TableCell>
                    <button
                      onClick={() =>
                        toggleHidden(
                          product.id,
                          product.is_hidden
                        )
                      }
                      className={`px-3 py-1 rounded text-white ${
                        product.is_hidden
                          ? "bg-red-500"
                          : "bg-green-600"
                      }`}
                    >
                      {product.is_hidden
                        ? "Hidden"
                        : "Visible"}
                    </button>
                  </TableCell>

                  <TableCell>
                    <button
                      onClick={() =>
                        deleteProduct(product.id)
                      }
                      className="bg-red-500 text-white px-3 py-1 rounded"
                    >
                      Delete
                    </button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </AdminLayout>
  );
}