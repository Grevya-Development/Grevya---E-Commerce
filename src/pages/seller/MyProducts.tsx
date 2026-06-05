import { useEffect, useState } from "react";

import { supabase } from "@/lib/supabaseClient";

import { useAuthStore } from "@/store/authStore";

interface Product {
  id: string;

  name: string;

  price: number;

  stock: number;

  is_approved: boolean;
}

export default function MyProducts() {
  const { user } = useAuthStore();

  const [products, setProducts] = useState<Product[]>([]);

  const [loading, setLoading] = useState(true);

  const fetchProducts = async () => {
    if (!user?.id) return;

    console.log('Current User ID:', user?.id)

    const { data, error } = await supabase

      .from("products")

      .select("*")

      .eq("seller_id", user.id)

      .order("name", {
        ascending: false,
      });

    if (!error && data) {
      setProducts(data);
    }
console.log('Products:', data)
console.log('Error:', error)

    setLoading(false);
  };

  useEffect(() => {
    fetchProducts();
  }, [user]);

  const deleteProduct = async (productId: string) => {
    const confirmDelete = window.confirm("Delete this product?");

    if (!confirmDelete) return;

    const { error } = await supabase

      .from("products")

      .delete()

      .eq("id", productId);

    if (error) {
      alert(error.message);

      return;

    }
    

    fetchProducts();
  };

  if (loading) {
    return <div className="p-8">Loading products...</div>;
  }

  return (
    <div className="p-8">
      <h1 className="text-3xl font-bold text-green-900 mb-6">My Products</h1>

      <div className="bg-white rounded-xl shadow overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-100">
            <tr>
              <th className="p-4 text-left">Name</th>

              <th className="p-4 text-left">Price</th>

              <th className="p-4 text-left">Stock</th>

              <th className="p-4 text-left">Status</th>

              <th className="p-4 text-left">Actions</th>
            </tr>
          </thead>

          <tbody>
            {products.length === 0 ? (
              <tr>
                <td colSpan={5} className="p-8 text-center text-gray-500">
                  No products found
                </td>
              </tr>
            ) : (
              products.map((product) => (
                <tr key={product.id} className="border-t">
                  <td className="p-4">{product.name}</td>

                  <td className="p-4">₹{product.price}</td>

                  <td className="p-4">{product.stock}</td>

                  <td className="p-4">
                    {product.is_approved ? (
                      <span className="text-green-600 font-medium">
                        Approved
                      </span>
                    ) : (
                      <span className="text-orange-500 font-medium">
                        Pending
                      </span>
                    )}
                  </td>

                  <td className="p-4">
                    <button
                      onClick={() => deleteProduct(product.id)}
                      className="bg-red-500 text-white px-3 py-2 rounded"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
