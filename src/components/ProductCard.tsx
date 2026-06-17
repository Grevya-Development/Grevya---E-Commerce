import React from 'react';
import { Link } from 'react-router-dom';
import { Star, ShoppingCart, Heart, Eye, Leaf } from 'lucide-react';
import { useCartStore } from '@/store/useCartStore';
import { useWishlistStore } from '@/store/useWishlistStore';
import { toast } from '@/components/ui/use-toast';
import { motion, useMotionValue, useTransform } from 'framer-motion';

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
  reviewCount?: number;
  image_secondary?: string;
}

const ProductCard = (props: ProductProps) => {
  const { id, name, price, rating, image, category, featured = false, eco = true, slug, reviewCount, image_secondary } = props;
  const addItem = useCartStore((state) => state.addItem);
  const { toggleWishlist, isInWishlist } = useWishlistStore();
  const isWishlisted = isInWishlist(id);

  // Dynamic 3D hover tilt variables
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const rotateX = useTransform(y, [-150, 150], [6, -6]);
  const rotateY = useTransform(x, [-100, 100], [-6, 6]);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const mouseX = e.clientX - rect.left - rect.width / 2;
    const mouseY = e.clientY - rect.top - rect.height / 2;
    x.set(mouseX);
    y.set(mouseY);
  };

  const handleMouseLeave = () => {
    x.set(0);
    y.set(0);
  };

  const addToCart = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    addItem(props, 1);
    toast({
      title: "Added to cart",
      description: `${name} added to your cart`,
    });
  };

  const handleWishlistToggle = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const added = toggleWishlist(props);
    toast({
      title: added ? "Added to wishlist" : "Removed from wishlist",
      description: `${name} has been ${added ? "added to" : "removed from"} your wishlist.`,
    });
  };

  const triggerQuickView = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    window.dispatchEvent(new CustomEvent('open-grevya-quickview', { detail: props }));
  };

  const displayReviewCount = reviewCount !== undefined ? reviewCount : ((id * 17) % 45 + 5);

  return (
    <motion.div
      className="group relative bg-white/70 border border-[#A68D65]/15 overflow-hidden flex flex-col h-full rounded-2xl shadow-xs cursor-pointer select-none"
      initial={{ opacity: 0, y: 15 }}
      whileInView={{ opacity: 1, y: 0 }}
      whileTap={{ scale: 0.96 }}
      viewport={{ once: true, margin: "-40px" }}
      style={{
        rotateX,
        rotateY,
        transformStyle: 'preserve-3d',
        willChange: 'transform'
      }}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1] as [number, number, number, number] }}
    >
      {/* Image Container with locked aspect ratio */}
      <div className="relative aspect-[4/5] overflow-hidden bg-[#EAE2D5]/20 shrink-0 select-none">
        
        {/* Product image with zoom transitions */}
        <Link to={`/products/${category}/${slug}`} className="block w-full h-full">
          <img
            src={image}
            alt={name}
            loading="lazy"
            className="w-full h-full object-cover group-hover:scale-106"
            style={{ transition: 'transform 850ms cubic-bezier(0.16, 1, 0.3, 1)' }}
          />
          {image_secondary && (
            <img
              src={image_secondary}
              alt={`${name} secondary view`}
              loading="lazy"
              className="absolute inset-0 w-full h-full object-cover opacity-0 group-hover:opacity-100 transition-opacity duration-500 ease-out"
            />
          )}
          {/* Subtle vignette shadow overlay */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/15 via-transparent to-transparent opacity-60 group-hover:opacity-80 transition-opacity duration-300" />
        </Link>

        {/* Badges overlaid top-left */}
        <div className="absolute top-2 left-2 z-10 flex flex-col space-y-1 pointer-events-none">
          {featured && (
            <span className="bg-[#A68D65] text-[#F7EEE4] px-2 py-0.5 text-[8px] md:text-[9px] font-extrabold tracking-wider uppercase rounded-md shadow-xs">
              Best Seller
            </span>
          )}
          {eco && (
            <span className="bg-[#33381C] text-[#F7EEE4] px-1.5 py-0.5 text-[8px] md:text-[9px] font-bold rounded-md shadow-xs flex items-center">
              <Leaf className="w-2.5 h-2.5 mr-0.5 text-[#A68D65]" /> Organic
            </span>
          )}
        </div>

        {/* Action icons stack overlaid top-right */}
        <div className="absolute top-2 right-2 sm:top-2.5 sm:right-2.5 z-20 flex flex-col space-y-1.5">
          {/* Wishlist Button - Always visible for touch comfort */}
          <motion.button
            onClick={handleWishlistToggle}
            whileHover={{ scale: 1.12 }}
            whileTap={{ scale: 0.8 }}
            className={`p-2 rounded-full shadow-md backdrop-blur-xs border transition-all duration-300 cursor-pointer ${
              isWishlisted
                ? 'bg-[#33381C] text-[#F7EEE4] border-[#33381C]'
                : 'bg-white/80 hover:bg-[#33381C] text-[#33381C] hover:text-[#F7EEE4] border-[#A68D65]/20'
            }`}
            title={isWishlisted ? "Remove from wishlist" : "Add to wishlist"}
            aria-label="Toggle wishlist"
          >
            <motion.div
              animate={isWishlisted ? { scale: [1, 1.35, 0.95, 1.05, 1] } : { scale: 1 }}
              transition={{ duration: 0.5, ease: 'easeInOut' }}
            >
              <Heart className={`h-3.5 w-3.5 ${isWishlisted ? 'fill-current' : ''}`} />
            </motion.div>
          </motion.button>

          {/* Quick View Button - Desktop hover only */}
          <div className="hidden sm:block">
            <motion.button
              onClick={triggerQuickView}
              whileHover={{ scale: 1.12 }}
              whileTap={{ scale: 0.88 }}
              className="p-2 rounded-full bg-white/80 hover:bg-[#33381C] text-[#33381C] hover:text-[#F7EEE4] border border-[#A68D65]/20 shadow-md backdrop-blur-xs transition-all duration-300 cursor-pointer w-full"
              title="Quick View"
              aria-label="Quick view product"
            >
              <Eye className="h-3.5 w-3.5 mx-auto" />
            </motion.button>
          </div>
        </div>

        {/* Quick Add Shopping Cart overlay - Desktop hover only */}
        <motion.button
          onClick={addToCart}
          whileHover={{ scale: 1.15, backgroundColor: '#33381C', color: '#F7EEE4', transition: { type: 'spring', stiffness: 400, damping: 10 } }}
          whileTap={{ scale: 0.88 }}
          className="absolute bottom-2.5 right-2.5 z-20 p-2.5 rounded-full bg-white text-[#33381C] border border-[#A68D65]/20 shadow-md backdrop-blur-xs cursor-pointer sm:opacity-0 sm:translate-y-2 sm:group-hover:opacity-100 sm:group-hover:translate-y-0 transition-all duration-300 hidden sm:flex"
          title="Add to Cart"
          aria-label="Add to cart"
        >
          <ShoppingCart className="h-3.5 w-3.5" />
        </motion.button>
      </div>

      {/* Details Container */}
      <div className="p-2.5 sm:p-3 md:p-4 flex flex-col flex-grow bg-white/40">
        <Link to={`/products/${category}/${slug}`} className="block mb-auto">
          {/* Category */}
          <span className="text-[7.5px] md:text-[9px] font-bold uppercase tracking-wider text-[#A68D65] block mb-0.5">
            {category}
          </span>
          {/* Title */}
          <h3 className="font-serif text-xs md:text-base text-[#1D1E19] font-bold mb-0.5 group-hover:text-[#33381C] transition-colors line-clamp-1 leading-snug">
            {name}
          </h3>

          {/* Rating & Price row */}
          <div className="flex items-center justify-between mt-1.5 md:mt-2.5 pt-0.5">
            <div className="flex items-center">
              <Star size={10} fill="currentColor" className="text-[#A68D65] mr-0.5" />
              <span className="text-[9px] md:text-[10px] font-bold text-[#1D1E19]/70">
                {rating.toFixed(1)}
              </span>
              <span className="text-[8px] text-[#1D1E19]/45 ml-1 hidden sm:inline">
                ({displayReviewCount})
              </span>
            </div>
            <p className="text-xs md:text-base font-extrabold text-[#33381C] tracking-tight">
              ₹{price.toFixed(0)}
            </p>
          </div>
        </Link>

        {/* Mobile Quick Add CTA Button */}
        <div className="mt-2.5 block sm:hidden">
          <button
            onClick={addToCart}
            className="w-full py-1.5 px-2.5 bg-[#33381C] hover:bg-[#262A14] text-[#F7EEE4] text-[10px] font-bold rounded-lg flex items-center justify-center gap-1.5 active:scale-95 transition-all shadow-xs cursor-pointer"
          >
            <ShoppingCart size={11} />
            <span>Add to Cart</span>
          </button>
        </div>
      </div>
    </motion.div>
  );
};

export default ProductCard;
