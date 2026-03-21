
import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import ProductCard from '@/components/ProductCard';
import { getProducts } from '@/api/products';
// @ts-ignore
import { useQuery } from '@tanstack/react-query';

const Products = () => {
  const [searchParams] = useSearchParams();
  const categoryFilter = searchParams.get('category');

  const { data: products = [], isLoading: loading, error } = useQuery({
    queryKey: ['products', categoryFilter],
    queryFn: () => getProducts(categoryFilter || undefined)
  });

  return (
    <div className="flex flex-col min-h-screen">
      <Navbar />
      <main className="flex-grow bg-cream/30">
        <div className="container mx-auto px-4 py-16">
          <h1 className="text-4xl font-bold text-green-800 mb-2">
            {categoryFilter ? `${categoryFilter.charAt(0).toUpperCase() + categoryFilter.slice(1)} Products` : 'Our Products'}
          </h1>
          <p className="text-green-600 mb-8">Discover our range of eco-friendly products</p>

          {loading ? (
            <div className="flex justify-center items-center py-20">Loading...</div>
          ) : error ? (
            <div className="text-red-500 py-10">Failed to load products.</div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {products.map((product) => (
                <ProductCard key={product.id} {...product} />
              ))}
            </div>
          )}
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default Products;
