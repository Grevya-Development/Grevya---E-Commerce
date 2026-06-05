import React from 'react';
import { Link } from 'react-router-dom';
import { Star, ShoppingCart } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useCartStore } from '@/store/useCartStore';
import { toast } from '@/components/ui/use-toast';
import { motion } from 'framer-motion';
import { supabase } from '@/lib/supabaseClient';
import { Heart } from 'lucide-react';
import { useWishlistStore } from '@/store/useWishlistStore';

export interface ProductProps {
  id: string;
  name: string;
  price: number;
  rating: number;
  image: string;
  category: string;
  featured?: boolean;
  eco?: boolean;
  slug: string;
  reviewCount?: number;
  onWishlistRemoved?: (id: string) => void;

}

const ProductCard = (props: ProductProps) => {
  const { id, name, price, rating, image, category, featured = false, eco = true, slug, reviewCount,  onWishlistRemoved,
 } = props;
  const addItem = useCartStore((state) => state.addItem);
  const wishlistItems = useWishlistStore((state) => state.items);
  const addWishlistItem = useWishlistStore((state) => state.addItem);
  const removeWishlistItem = useWishlistStore((state) => state.removeItem);
  const isWishlisted = wishlistItems.includes(id);

  const addToCart = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    addItem(props, 1);
    toast({
      title: "Added to cart",
      description: `${name} added to your cart`,
    });
  };
  const addToWishlist = async (e: React.MouseEvent) => {
  e.preventDefault();
  e.stopPropagation();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    toast({
      title: "Login Required",
      description: "Please login to use wishlist",
    });
    return;
  }

  // Remove from wishlist
  if (isWishlisted) {
    const { error } = await supabase
      .from("wishlist")
      .delete()
      .eq("user_id", user.id)
      .eq("product_id", id);

    if (error) {
      toast({
        title: "Wishlist Error",
        description: error.message,
      });
      return;
    }

    removeWishlistItem(id);
    onWishlistRemoved?.(id);

    toast({
      title: "Wishlist",
      description: "Removed from wishlist",
    });

    return;
  }

  // Add to wishlist
  const { error } = await supabase
    .from("wishlist")
    .insert({
      user_id: user.id,
      product_id: id,
    });

  if (error) {
    toast({
      title: "Wishlist Error",
      description: error.message,
    });
    return;
  }

  addWishlistItem(id);

  toast({
    title: "Wishlist",
    description: "Added to wishlist",
  });
};
 

    const displayReviewCount = reviewCount ?? 0;
  return (
    <motion.div
      className="group relative bg-white rounded-2xl shadow-sm border border-neutral-100 overflow-hidden flex flex-col h-full transition-all duration-300"
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-50px" }}
      transition={{ duration: 0.5, ease: "easeOut" }}
      whileHover={{ y: -8, boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)" }}
    >
      {featured && (
        <span className="absolute top-3 left-3 z-10 bg-amber-400 text-neutral-900 px-3 py-1 text-xs font-bold rounded-full shadow-md">
          Featured
        </span>
      )}
      {eco && (
        <span className="absolute top-3 right-3 z-10 eco-badge shadow-md shadow-black/5 bg-white backdrop-blur-sm bg-opacity-90">
          <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
          </svg>
          Eco
        </span>
      )}

      <Link to={`/products/${category}/${slug}`} className="block relative overflow-hidden h-72 bg-neutral-50/50">
      <button
      onClick={addToWishlist}
      className="absolute top-3 left-3 z-20 bg-white/95 backdrop-blur-sm rounded-full p-2 shadow-md hover:shadow-lg transition-all duration-300"    >
      {/* <Heart
        size={18}
        className={
          isWishlisted
            ? "text-red-500 fill-red-500"
            : "text-gray-500"
        }
      />
       */}
       <motion.div
        whileTap={{ scale: 0.8 }}
        animate={
        isWishlisted
          ? {
              scale: [1, 1.4, 0.95, 1],
            }
          : {
              scale: 1,
            }
      }
        transition={{
          duration: 0.25,
          ease: "easeOut",
        }}
      >
  <Heart
    size={18}
    className={`transition-all duration-300 ${
      isWishlisted
        ? "text-red-500 fill-red-500"
        : "text-gray-500"
    }`}
  />
</motion.div>
    </button>  
      <img
          src={image}
          alt={name}
          className="w-full h-full object-cover transform group-hover:scale-105 transition-transform duration-700 ease-out"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/10 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
      </Link>

      <div className="p-5 flex flex-col flex-grow">
        <Link to={`/products/${category}/${slug}`} className="block mb-auto">
          <h3 className="font-semibold text-lg text-neutral-900 mb-1.5 group-hover:text-green-800 transition-colors line-clamp-1">{name}</h3>
      <div className="flex items-center mb-3">
          {displayReviewCount > 0 ? (
            <>
              <div className="flex">
                {[...Array(5)].map((_, i) => (
                  <Star
                    key={i}
                    size={14}
                    fill={i < Math.round(rating) ? "currentColor" : "none"}
                    className={
                      i < Math.round(rating)
                        ? "text-amber-400"
                        : "text-neutral-300"
                    }
                  />
                ))}
              </div>

              <span className="text-xs font-medium text-neutral-500 ml-2">
               ({displayReviewCount} review{displayReviewCount !== 1 ? "s" : ""})
              </span>
            </>
          ) : (
            <span className="text-xs text-neutral-400 italic">
              No reviews yet
            </span>
          )}
        </div>
          <p className="text-xl font-extrabold text-green-800 tracking-tight">₹{price.toFixed(2)}</p>
        </Link>

        <div className="mt-5 pt-1">
          {/* @ts-ignore */}
          <Button
            variant="outline"
            className="w-full flex items-center justify-center rounded-xl border-green-200 bg-green-50/50 text-green-800 hover:bg-green-800 hover:text-white hover:border-green-800 transition-all duration-300 shadow-sm hover:shadow-md hover:-translate-y-0.5 active:translate-y-0 h-11 font-semibold"
            onClick={addToCart}
          >
            <ShoppingCart className="h-4 w-4 mr-2" />
            Add to Cart
          </Button>
        </div>
      </div>
    </motion.div>
  );
};

export default ProductCard;
