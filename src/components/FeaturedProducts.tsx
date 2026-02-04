
import React from 'react';
import { Link } from 'react-router-dom';
import ProductCard, { ProductProps } from './ProductCard';
import { ArrowRight } from 'lucide-react';
import { productImages } from '@/lib/product-images';

const featuredProducts: ProductProps[] = [
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
];

const FeaturedProducts = () => {
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
        
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {featuredProducts.map((product) => (
            <ProductCard key={product.id} {...product} />
          ))}
        </div>
        
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
