
import React from 'react';
import { Link } from 'react-router-dom';
import ProductCard from './ProductCard';
import { ArrowRight } from 'lucide-react';
import { getProducts } from '@/api/products';
// @ts-ignore
import { useQuery } from '@tanstack/react-query';

const FeaturedProducts = () => {
  const { data: allProducts = [], isLoading, error } = useQuery({
    queryKey: ['featured-products'],
    queryFn: () => getProducts()
  });

  const featuredProducts = allProducts.filter(p => p.featured).slice(0, 4);

  return (
    <section className="py-16 bg-cream/50">
      <div className="container mx-auto px-4">
        <div className="flex justify-between items-center mb-10">
          <h2 className="section-heading">Featured Products</h2>
          <Link
            to="/products"
            className="hidden md:flex items-center text-green-700 hover:text-green-800 transition-colors"
          >
            View All Products
            <ArrowRight className="ml-2 h-4 w-4" />
          </Link>
        </div>

        {isLoading ? (
          <div className="flex justify-center items-center py-10">Loading featured products...</div>
        ) : error ? (
          <div className="text-red-500 py-10">Failed to load products.</div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {featuredProducts.map((product) => (
              <ProductCard key={product.id} {...product} />
            ))}
          </div>
        )}

        <div className="mt-8 text-center md:hidden">
          <Link
            to="/products"
            className="inline-flex items-center text-green-700 hover:text-green-800 transition-colors"
          >
            View All Products
            <ArrowRight className="ml-2 h-4 w-4" />
          </Link>
        </div>
      </div>
    </section>
  );
};

export default FeaturedProducts;
