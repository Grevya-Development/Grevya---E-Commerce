import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import ProductCard from './ProductCard';
import { ArrowRight } from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';
import { motion } from 'framer-motion';

const FeaturedProducts = () => {
  const [featuredProducts, setFeaturedProducts] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchFeatured = async () => {
      try {
        setIsLoading(true);

        const { data, error } = await supabase
          .from('products')
          .select('*')
          .limit(4);

        if (error) throw error;
        console.log("FEATURED PRODUCT:", data?.[0]);

        // ✅ Normalize data
        const { data: reviewsData, error: reviewError } = await supabase
          .from('reviews')
          .select('product_id');

        if (reviewError) throw reviewError;

        const formatted = (data || []).map((item) => {
          const reviewCount =
            reviewsData?.filter(
              (review) => review.product_id === item.id
            ).length || 0;

          return {
            ...item,
            image: item.image_url,
            rating: item.rating || 4,
            reviewCount,
          };
        });

        setFeaturedProducts(formatted);

        console.log("FEATURED FORMATTED:", formatted);

      } catch (err: any) {
        console.error("Error fetching featured products:", err);
        setError(err.message || "Failed to load products");
      } finally {
        setIsLoading(false);
      }
    };

    fetchFeatured();
  }, []);

  const containerVariants = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: {
        staggerChildren: 0.15
      }
    }
  };

  return (
    <section className="py-20 bg-background overflow-hidden relative">
      {/* Subtle decorative background blobs if desired, keep it very light */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none z-0">
        <div className="absolute -top-24 -left-24 w-96 h-96 bg-green-50 rounded-full blur-3xl opacity-50 mix-blend-multiply"></div>
        <div className="absolute bottom-10 right-10 w-80 h-80 bg-amber-50 rounded-full blur-3xl opacity-50 mix-blend-multiply"></div>
      </div>

      <div className="container mx-auto px-4 relative z-10">

        <div className="flex justify-between items-end mb-12">
          <div>
             <h2 className="section-heading mb-0 relative inline-block">
               Featured Products
               <div className="absolute -bottom-2 right-0 w-1/2 h-1 bg-amber-400 rounded-full"></div>
             </h2>
          </div>

          <Link
            to="/products"
            className="hidden md:flex items-center text-green-800 hover:text-green-900 font-bold transition-colors group"
          >
            View All Products
            <ArrowRight className="ml-2 h-5 w-5 transform group-hover:translate-x-1 transition-transform" />
          </Link>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {[1, 2, 3, 4].map((n) => (
              <div key={n} className="bg-white rounded-2xl shadow-sm border border-neutral-100 flex flex-col h-[480px] overflow-hidden animate-pulse">
                 <div className="bg-neutral-200 h-72 w-full"></div>
                 <div className="p-5 flex flex-col flex-grow">
                   <div className="h-6 bg-neutral-200 rounded w-3/4 mb-3"></div>
                   <div className="h-4 bg-neutral-200 rounded w-1/4 mb-4"></div>
                   <div className="h-8 bg-neutral-200 rounded w-1/3 mb-5"></div>
                   <div className="h-11 bg-neutral-200 rounded-xl w-full mt-auto"></div>
                 </div>
              </div>
            ))}
          </div>
        ) : error ? (
           <div className="bg-red-50 text-red-600 p-8 rounded-2xl text-center border border-red-100 mb-10 max-w-2xl mx-auto shadow-sm">
             <h3 className="text-xl font-bold mb-2">Oops!</h3>
             <p>{error}</p>
           </div>
        ) : (
          <motion.div 
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6"
            variants={containerVariants}
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, margin: "-50px" }}
          >
            {featuredProducts.map((product) => {
              const slug = (product.name || '')
                .toLowerCase()
                .replace(/\s+/g, '-');

              return (
                <ProductCard
                  key={product.id}
                  id={product.id}
                  name={product.name}
                  price={product.price}
                  image={product.image} // ✅ FIXED
                  category={product.category}
                  rating={product.rating}
                  reviewCount={product.reviewCount}
                  slug={slug}
                />
              );
            })}
          </motion.div>
        )}

        <div className="mt-10 text-center md:hidden">
          <Link
            to="/products"
            className="inline-flex items-center text-green-800 font-bold bg-green-50 px-6 py-3 rounded-xl"
          >
            View All Products
            <ArrowRight className="ml-2 h-5 w-5" />
          </Link>
        </div>

      </div>
    </section>
  );
};

export default FeaturedProducts;