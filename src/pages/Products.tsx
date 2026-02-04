
import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import ProductCard, { ProductProps } from '@/components/ProductCard';
import { productImages } from '@/lib/product-images';

const Products = () => {
  const [searchParams] = useSearchParams();
  const categoryFilter = searchParams.get('category');
  const [filteredProducts, setFilteredProducts] = useState<ProductProps[]>([]);

  const allProducts: ProductProps[] = [
    // Areca Plates only (removed Bowls and Trays)
    {
      id: 1,
      name: "Premium Areca Leaf Plates (10\")",
      price: 249.00,
      rating: 4.5,
      image: productImages.areca.plates,
      category: "areca",
      featured: true,
      slug: "premium-areca-plates-10-inch"
    },
    {
      id: 2,
      name: "Areca Dinnerware Set",
      price: 599.00,
      rating: 4.7,
      image: productImages.areca.dinnerware,
      category: "areca",
      slug: "areca-dinnerware-set"
    },
    // Natural Products
    {
      id: 3,
      name: "Organic Tomato Powder (100g)",
      price: 199.00,
      rating: 4.2,
      image: productImages.natural.tomatoPowder,
      category: "natural",
      featured: true,
      slug: "organic-tomato-powder-100g"
    },
    {
      id: 4,
      name: "Pure Coconut Oil (500ml)",
      price: 350.00,
      rating: 4.9,
      image: productImages.natural.coconutOil,
      category: "natural",
      featured: true,
      slug: "pure-coconut-oil-500ml"
    },
    {
      id: 5,
      name: "Natural Henna Powder (200g)",
      price: 180.00,
      rating: 4.3,
      image: productImages.natural.henna,
      category: "natural",
      slug: "natural-henna-powder-200g"
    },
    {
      id: 6,
      name: "Indigo Powder (100g)",
      price: 220.00,
      rating: 4.4,
      image: productImages.natural.indigoPowder,
      category: "natural",
      slug: "indigo-powder-100g"
    },
  ];

  useEffect(() => {
    if (categoryFilter) {
      setFilteredProducts(allProducts.filter(product => product.category === categoryFilter));
    } else {
      setFilteredProducts(allProducts);
    }
  }, [categoryFilter]);

  return (
    <div className="flex flex-col min-h-screen">
      <Navbar />
      <main className="flex-grow bg-cream/30">
        <div className="container mx-auto px-4 py-16">
          <h1 className="text-4xl font-bold text-green-800 mb-2">
            {categoryFilter ? `${categoryFilter.charAt(0).toUpperCase() + categoryFilter.slice(1)} Products` : 'Our Products'}
          </h1>
          <p className="text-green-600 mb-8">Discover our range of eco-friendly products</p>
          
          {/* Products grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {filteredProducts.map((product) => (
              <ProductCard key={product.id} {...product} />
            ))}
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default Products;
