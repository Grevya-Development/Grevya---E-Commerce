import React, { useEffect, useState } from "react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import ProductCard from "@/components/ProductCard";
import { supabase } from "@/lib/supabaseClient";

const Wishlist = () => {
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchWishlist = async () => {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (!user) {
          setLoading(false);
          return;
        }

        const { data: wishlist } = await supabase
          .from("wishlist")
          .select("product_id")
          .eq("user_id", user.id);

        if (!wishlist || wishlist.length === 0) {
          setProducts([]);
          setLoading(false);
          return;
        }

        const productIds = wishlist.map(
          (item) => item.product_id
        );

        const { data: productsData } = await supabase
          .from("products")
          .select("*")
          .in("id", productIds);

        setProducts(productsData || []);
      } catch (error) {
        console.error(error);
      } finally {
        setLoading(false);
      }
    };

    fetchWishlist();
  }, []);

  return (
    <div className="flex flex-col min-h-screen">
      <Navbar />

      <main className="flex-grow container mx-auto px-4 py-10">
        <h1 className="text-3xl font-bold mb-6">
          My Wishlist
        </h1>

        {loading ? (
          <p>Loading...</p>
        ) : products.length === 0 ? (
          <p>No wishlist items found.</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {products.map((product) => (
              <ProductCard
                key={product.id}
                id={product.id}
                name={product.name}
                price={product.price}
                image={product.image_url}
                category={product.category}
                rating={product.rating || 0}
                reviewCount={product.review_count || 0}
                slug={product.slug}
                  onWishlistRemoved={(removedId) =>
                setProducts((prev) =>
                prev.filter((p) => p.id !== removedId)
                )
            }
              />
            ))}
          </div>
        )}
      </main>

      <Footer />
    </div>
  );
};

export default Wishlist;
