import React, { useState, useEffect } from "react";
import { useSearchParams, Link } from "react-router-dom";

import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import ProductCard from "@/components/ProductCard";

import { supabase } from "@/lib/supabaseClient";

const Products = () => {
  const [searchParams] = useSearchParams();

  const categoryFilter = searchParams.get("category");
  const searchFilter = searchParams.get("search");

  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchProducts = async () => {
      try {
        setLoading(true);

        let query = supabase
          .from("products")
          .select("*")
          .eq("is_hidden", false)
          .eq("product_status", "approved")
          .order("id", { ascending: true });

        // Category filter
        if (categoryFilter) {
          query = query.ilike("category", `%${categoryFilter}%`);
        }

        // Search filter
        if (searchFilter) {
          query = query.ilike("name", `%${searchFilter}%`);
        }

        const { data, error: fetchError } = await query;

        const { data: reviewsData, error: reviewError } = await supabase
          .from("reviews")
          .select("product_id");

        if (reviewError) throw reviewError;

        if (fetchError) throw fetchError;

        const formatted = (data || []).map((item) => {
          const reviewCount =
            reviewsData?.filter((review) => review.product_id === item.id)
              .length || 0;

          return {
            ...item,
            image: item.image_url,
            rating: item.rating || 4,
            reviewCount,
          };
        });
        setProducts(formatted);
        console.log("FORMATTED PRODUCTS:", formatted);
      } catch (err: any) {
        console.error("FETCH ERROR:", err);
        setError(err.message || "Something went wrong");
      } finally {
        setLoading(false);
      }
    };

    fetchProducts();
  }, [categoryFilter, searchFilter]);

  return (
    <div className="flex flex-col min-h-screen">
      <Navbar />

      <main className="flex-grow bg-cream/30">
        <div className="container mx-auto px-4 py-16">
          <h1 className="text-4xl font-bold text-green-800 mb-2">
            {categoryFilter
              ? `${categoryFilter.charAt(0).toUpperCase() + categoryFilter.slice(1)} Products`
              : searchFilter
                ? `Search Results for "${searchFilter}"`
                : "All Products"}
          </h1>

          <p className="text-green-600 mb-8">
            Discover our range of eco-friendly products
          </p>

          {loading ? (
            <div className="flex justify-center items-center py-20">
              Loading...
            </div>
          ) : error ? (
            <div className="text-red-500 py-10">{error}</div>
          ) : products.length === 0 ? (
            <div className="text-gray-500 py-10">No products found.</div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {products.map((product) => {
                const slug = (product.name || "")
                  .toLowerCase()
                  .replace(/\s+/g, "-");

                const category = encodeURIComponent(
                  product.category || "general",
                );

                return (
                  <ProductCard
                    key={product.id}
                    id={product.id}
                    name={product.name}
                    price={product.price}
                    image={product.image}
                    category={product.category}
                    rating={product.rating}
                    reviewCount={product.reviewCount}
                    slug={slug}
                  />
                );
              })}
            </div>
          )}
        </div>
      </main>

      <Footer />
    </div>
  );
};

export default Products;
