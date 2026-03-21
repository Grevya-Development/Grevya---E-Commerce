
import React from 'react';
import { Link } from 'react-router-dom';
import { Star, ShoppingCart } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useCartStore } from '@/store/useCartStore';
import { toast } from '@/components/ui/use-toast';
import { motion } from 'framer-motion';

export interface ProductProps {
  id: number;
  name: string;
  price: number;
  rating: number;
  image: string;
  category: string;
  featured?: boolean;
  eco?: boolean;
  slug: string;
}

const ProductCard = (props: ProductProps) => {
  const { id, name, price, rating, image, category, featured = false, eco = true, slug } = props;
  const addItem = useCartStore((state) => state.addItem);

  const addToCart = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    addItem(props, 1);
    toast({
      title: "Added to cart",
      description: `${name} added to your cart`,
    });
  };

  // Use a stable deterministic formula based on ID instead of Math.random
  const reviewCount = (id * 17) % 45 + 5;

  return (
    <motion.div
      className="product-card group relative bg-white rounded-lg shadow-sm border border-gray-100 overflow-hidden"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: "easeOut" }}
      whileHover={{ y: -5, boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)" }}
    >
      {featured && (
        <span className="absolute top-2 left-2 z-10 bg-amber-600 text-white px-2 py-1 text-xs rounded-full">
          Featured
        </span>
      )}
      {eco && (
        <span className="absolute top-2 right-2 z-10 bg-green-50 text-green-700 px-2 py-1 text-xs rounded-full flex items-center">
          <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
          Eco
        </span>
      )}

      <Link to={`/products/${category}/${slug}`} className="block">
        <div className="relative overflow-hidden h-64 bg-gray-100">
          <img
            src={image}
            alt={name}
            className="w-full h-full object-cover transform group-hover:scale-105 transition-transform duration-300"
          />
        </div>
      </Link>

      <div className="p-4">
        <Link to={`/products/${category}/${slug}`} className="block">
          <h3 className="font-medium text-lg text-brown-800 mb-1 hover:text-green-700 transition-colors">{name}</h3>
          <div className="flex items-center mb-2">
            <div className="flex">
              {[...Array(5)].map((_, i) => (
                <Star
                  key={i}
                  size={14}
                  fill={i < Math.floor(rating) ? "#FFA500" : "none"}
                  stroke={i < Math.floor(rating) ? "#FFA500" : "#C0C0C0"}
                  className={i < rating && i >= Math.floor(rating) ? "fill-[50%] text-amber-500" : "mr-0.5"}
                />
              ))}
            </div>
            <span className="text-xs text-gray-500 ml-1">({reviewCount})</span>
          </div>
          <p className="text-green-700 font-semibold">₹{price.toFixed(2)}</p>
        </Link>

        <div className="mt-3">
          {/* @ts-ignore */}
          <Button
            variant="outline"
            size="sm"
            className="w-full flex items-center justify-center hover:bg-green-50 hover:text-green-700 hover:border-green-700"
            onClick={addToCart}
          >
            <ShoppingCart className="h-4 w-4 mr-1" />
            Add to Cart
          </Button>
        </div>
      </div>
    </motion.div>
  );
};

export default ProductCard;
