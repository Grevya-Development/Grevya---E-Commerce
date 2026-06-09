import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { toast } from '@/components/ui/use-toast';
import { AspectRatio } from '@/components/ui/aspect-ratio';
import { Star, ShoppingCart, Package, Leaf, TruckIcon, ArrowLeft, ShieldCheck, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import { useCartStore } from '@/store/useCartStore';
import { supabase } from '@/lib/supabaseClient';
import { motion } from 'framer-motion';

interface Review {
  id: string;
  product_id: string;
  rating: number;
  comment: string;
  created_at: string;
}

const ProductDetail = () => {
  const { slug } = useParams();
  const [quantity, setQuantity] = useState(1);
  const addItem = useCartStore((state) => state.addItem);

  const [product, setProduct] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Reviews State
  const [reviews, setReviews] = useState<Review[]>([]);
  const [averageRating, setAverageRating] = useState(0);
  const [newRating, setNewRating] = useState(5);
  const [newComment, setNewComment] = useState("");
  const [isSubmittingReview, setIsSubmittingReview] = useState(false);

  // Fetch reviews logic abstracted so we can re-call it after submitting
  const fetchReviews = async (productId: string) => {
    try {
      const { data: revData, error: revError } = await supabase
        .from('reviews')
        .select('*')
        .eq('product_id', productId)
        .order('created_at', { ascending: false });

      if (revError && !(revError.message || '').includes('relation')) {
        console.error("Reviews fetch error:", revError);
      } else if (revData) {
        setReviews(revData);
        if (revData.length > 0) {
          const sum = revData.reduce((acc, curr) => acc + curr.rating, 0);
          setAverageRating(Math.round((sum / revData.length) * 10) / 10);
        }
      }
    } catch (e) {
      console.warn("Reviews logic fallback triggered", e);
    }
  };

  useEffect(() => {
    const fetchProduct = async () => {
      try {
        setLoading(true);

        const formattedName = slug
          ?.replace(/-/g, ' ')
          ?.toLowerCase()
          ?.trim();

        const { data, error } = await supabase
          .from('products')
          .select('*')
          .ilike('name', `%${formattedName}%`);

        if (error) throw error;

        const matchedProduct = data && data.length > 0 ? data[0] : null;
        setProduct(matchedProduct);

        if (matchedProduct) {
          await fetchReviews(matchedProduct.id);
        }

      } catch (err: any) {
        console.error("Error fetching product details:", err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    if (slug) fetchProduct();
  }, [slug]);

  const addToCart = () => {
    if (product) {
      const slugValue = (product.name || '').toLowerCase().replace(/\s+/g, '-');
      addItem({
        id: product.id,
        name: product.name,
        price: product.price,
        rating: averageRating || product.rating || 4,
        image: product.image_url || product.image,
        category: product.category || 'general',
        slug: slugValue,
      }, quantity);
      toast({
        title: "Added to cart",
        description: `${quantity} × ${product.name} added to your cart`,
      });
    }
  };

  const submitReview = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!product || !newComment.trim()) return;

    try {
      setIsSubmittingReview(true);
      const { error: insertError } = await supabase
        .from('reviews')
        .insert({
          product_id: product.id,
          rating: newRating,
          comment: newComment.trim()
        });

      if (insertError) throw insertError;

      toast({
        title: "Review submitted",
        description: "Thank you for your feedback!",
      });

      setNewComment("");
      setNewRating(5);

      await fetchReviews(product.id);
    } catch (err: any) {
      console.error("Failed to submit review:", err);
      toast({
        title: "Submission failed",
        description: "Could not submit your review. Please try again later.",
        variant: "destructive"
      });
    } finally {
      setIsSubmittingReview(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col min-h-screen">
        <Navbar />
        <main className="flex-grow bg-background py-12 md:py-20">
          <div className="container mx-auto px-4 max-w-6xl">
            <div className="animate-pulse">
              <div className="h-6 bg-neutral-200 rounded w-1/4 mb-10"></div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-12 lg:gap-20">
                <div className="bg-neutral-100 h-[500px] rounded-3xl"></div>
                <div className="py-6">
                  <div className="h-10 bg-neutral-200 rounded w-3/4 mb-6"></div>
                  <div className="h-6 bg-neutral-200 rounded w-1/3 mb-10"></div>
                  <div className="h-12 bg-neutral-200 rounded w-1/4 mb-10"></div>
                  <div className="h-4 bg-neutral-200 rounded w-full mb-3"></div>
                  <div className="h-4 bg-neutral-200 rounded w-5/6 mb-3"></div>
                  <div className="h-4 bg-neutral-200 rounded w-4/6 mb-12"></div>
                  <div className="h-14 bg-neutral-200 rounded-xl w-full"></div>
                </div>
              </div>
            </div>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  if (error || !product) {
    return (
      <div className="flex flex-col min-h-screen">
        <Navbar />
        <main className="flex-grow bg-background py-20 flex items-center justify-center">
          <div className="max-w-md w-full px-4 text-center">
             <div className="bg-red-50 border border-red-100 rounded-3xl p-10 shadow-sm">
                <h2 className="text-3xl font-extrabold text-red-600 mb-4">Product Not Found</h2>
                <p className="text-red-900/70 mb-8 text-lg">
                  {error || "The product you're looking for doesn't exist."}
                </p>
                <Button asChild className="w-full bg-red-600 hover:bg-red-700 text-white rounded-xl h-12">
                  <Link to="/products">Browse All Products</Link>
                </Button>
             </div>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen">
      <Navbar />
      <main className="flex-grow bg-background selection:bg-green-100 selection:text-green-900">
        <div className="container mx-auto px-4 py-8 md:py-16 max-w-7xl">
          <Link to="/products" className="inline-flex items-center text-neutral-500 hover:text-green-800 font-medium mb-8 transition-colors group">
            <ArrowLeft className="h-5 w-5 mr-2 transform group-hover:-translate-x-1 transition-transform" />
            Back to Products
          </Link>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-12 lg:gap-20 items-start">

            {/* Image (Apple-style premium card) */}
            <motion.div 
               initial={{ opacity: 0, x: -30 }} 
               animate={{ opacity: 1, x: 0 }} 
               transition={{ duration: 0.6, ease: "easeOut" }}
               className="sticky top-24"
            >
              <div className="bg-neutral-50 rounded-[2rem] overflow-hidden p-8 sm:p-12 border border-neutral-100 relative group max-h-[700px] flex items-center justify-center">
                 <div className="absolute inset-0 bg-gradient-to-tr from-green-50/50 to-clay/10 opacity-0 group-hover:opacity-100 transition-opacity duration-700"></div>
                 <img
                   src={product.image_url}
                   alt={product.name}
                   className="object-contain w-full h-auto max-h-[500px] drop-shadow-2xl mix-blend-multiply transform group-hover:scale-105 transition-transform duration-700 ease-out z-10"
                 />
              </div>
            </motion.div>

            {/* Details */}
            <motion.div 
               initial={{ opacity: 0, y: 30 }} 
               animate={{ opacity: 1, y: 0 }} 
               transition={{ duration: 0.6, ease: "easeOut", delay: 0.1 }}
               className="py-4 md:py-10"
            >
              <h1 className="text-4xl md:text-5xl font-extrabold text-neutral-900 mb-4 tracking-tight leading-tight">{product.name}</h1>

              <div className="flex items-center gap-3 mb-8">
                <div className="flex">
                  {[...Array(5)].map((_, i) => (
                    <Star
                      key={i}
                      size={20}
                      fill={i < Math.floor(averageRating > 0 ? averageRating : 0) ? "currentColor" : "none"}
                      stroke="currentColor"
                      className={i < averageRating && i >= Math.floor(averageRating) ? "fill-[50%] text-clay" : (i < Math.floor(averageRating > 0 ? averageRating : 0) ? "text-clay" : "text-neutral-300")}
                    />
                  ))}
                </div>
                <span className="text-base font-bold text-neutral-800">
                  {averageRating > 0 ? averageRating.toFixed(1) : 'No ratings'}
                </span>
                <span className="text-base text-neutral-400">
                  ({reviews.length} {reviews.length === 1 ? 'review' : 'reviews'})
                </span>
              </div>

              <p className="text-4xl md:text-5xl font-extrabold text-green-800 mb-8 tracking-tighter">
                ₹{product.price}
              </p>

              <div className="prose prose-lg text-neutral-600 mb-10 leading-relaxed max-w-none">
                <p>{product.description}</p>
              </div>

              <div className="w-full h-px bg-neutral-200 mb-10"></div>

              {/* Trust Signals Grid */}
              <div className="grid grid-cols-2 gap-4 mb-10">
                <div className="flex items-center text-neutral-700 bg-neutral-50 px-4 py-3 rounded-2xl border border-neutral-100">
                  <Package className="h-6 w-6 mr-3 text-green-700" />
                  <span className="font-medium text-sm">In stock ({product.stock})</span>
                </div>
                <div className="flex items-center text-neutral-700 bg-neutral-50 px-4 py-3 rounded-2xl border border-neutral-100">
                  <Leaf className="h-6 w-6 mr-3 text-green-700" />
                  <span className="font-medium text-sm">Eco-friendly</span>
                </div>
                <div className="flex items-center text-neutral-700 bg-neutral-50 px-4 py-3 rounded-2xl border border-neutral-100">
                  <TruckIcon className="h-6 w-6 mr-3 text-green-700" />
                  <span className="font-medium text-sm">Free shipping</span>
                </div>
                <div className="flex items-center text-neutral-700 bg-neutral-50 px-4 py-3 rounded-2xl border border-neutral-100">
                  <RefreshCw className="h-6 w-6 mr-3 text-green-700" />
                  <span className="font-medium text-sm">14-Day Returns</span>
                </div>
              </div>

              {/* CTA Section */}
              <div className="flex flex-col sm:flex-row gap-4 mb-4 mt-12 bg-white p-2 rounded-2xl border border-neutral-200 shadow-sm">
                <div className="flex items-center bg-neutral-50 rounded-xl px-2 w-full sm:w-auto overflow-hidden">
                  <button
                    className="h-12 w-12 flex justify-center items-center text-neutral-500 hover:text-neutral-900 transition-colors"
                    onClick={() => setQuantity(Math.max(1, quantity - 1))}
                  >
                    <span className="text-2xl font-light">-</span>
                  </button>
                  <span className="w-12 text-center text-lg font-bold text-neutral-900">{quantity}</span>
                  <button
                    className="h-12 w-12 flex justify-center items-center text-neutral-500 hover:text-neutral-900 transition-colors"
                    onClick={() => setQuantity(quantity + 1)}
                  >
                    <span className="text-2xl font-light">+</span>
                  </button>
                </div>

                <Button className="flex-1 h-16 text-lg font-bold w-full rounded-xl flex items-center justify-center shadow-lg shadow-green-900/20 bg-green-800 hover:bg-green-900 text-white transition-all hover:scale-[1.02] active:scale-[0.98]" onClick={addToCart}>
                  <ShoppingCart className="mr-3 h-6 w-6" />
                  Add to Cart
                </Button>
              </div>
              
              <div className="flex items-center justify-center mt-6 text-sm text-neutral-500 font-medium">
                 <ShieldCheck className="w-5 h-5 mr-2 text-green-700" /> Secure SSL Checkout
              </div>

            </motion.div>
          </div>

          {/* Reviews Section */}
          <div className="mt-24 pt-16 border-t border-neutral-200">
            <h2 className="text-3xl md:text-4xl font-extrabold text-neutral-900 mb-12 tracking-tight">Customer Reviews</h2>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-12 lg:gap-20">
              {/* Write Review Card */}
              <div className="lg:col-span-1">
                <div className="bg-white p-8 rounded-3xl shadow-lg shadow-black/5 border border-neutral-100 sticky top-24">
                  <h3 className="text-2xl font-bold text-neutral-900 mb-6">Write a Review</h3>
                  <form onSubmit={submitReview}>
                    <div className="mb-6">
                      <label className="block text-sm font-bold text-neutral-700 mb-3">Rating</label>
                      <div className="flex gap-2">
                        {[1, 2, 3, 4, 5].map((star) => (
                          <button
                            key={star}
                            type="button"
                            onClick={() => setNewRating(star)}
                            className="focus:outline-none transition-transform hover:scale-110 active:scale-95"
                          >
                            <Star
                              size={32}
                              fill={star <= newRating ? "currentColor" : "none"}
                              stroke="currentColor"
                              strokeWidth={1.5}
                              className={star <= newRating ? "text-clay" : "text-neutral-200"}
                            />
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="mb-6">
                      <label htmlFor="comment" className="block text-sm font-bold text-neutral-700 mb-3">Review</label>
                      <textarea
                        id="comment"
                        rows={4}
                        className="w-full border border-neutral-200 rounded-2xl p-4 focus:ring-2 focus:ring-green-800 focus:border-green-800 outline-none transition-all resize-none shadow-sm"
                        placeholder="What do you think about this product?"
                        value={newComment}
                        onChange={(e) => setNewComment(e.target.value)}
                        required
                      />
                    </div>
                    <Button
                      type="submit"
                      className="w-full h-14 text-base font-bold rounded-xl shadow-md bg-green-800 hover:bg-green-900 text-white transition-all transform hover:-translate-y-0.5"
                      disabled={isSubmittingReview || !newComment.trim()}
                    >
                      {isSubmittingReview ? "Submitting..." : "Submit Review"}
                    </Button>
                  </form>
                </div>
              </div>

               {/* Reviews List */}
              <div className="lg:col-span-2 space-y-6">
                {reviews.length === 0 ? (
                  <div className="text-center py-20 bg-neutral-50 rounded-3xl border border-neutral-100">
                    <Star className="w-16 h-16 mx-auto text-neutral-300 mb-4" />
                    <h4 className="text-xl font-bold text-neutral-500 mb-2">No reviews yet</h4>
                    <p className="text-neutral-400">Be the first to share your thoughts!</p>
                  </div>
                ) : (
                  reviews.map((review, index) => (
                    <motion.div 
                       initial={{ opacity: 0, y: 20 }} 
                       whileInView={{ opacity: 1, y: 0 }} 
                       viewport={{ once: true }}
                       transition={{ duration: 0.5, delay: index * 0.1 }}
                       key={review.id} 
                       className="bg-white p-8 rounded-3xl shadow-sm border border-neutral-100 hover:shadow-md transition-shadow"
                    >
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-3">
                          <div className="flex">
                            {[...Array(5)].map((_, i) => (
                              <Star
                                key={i}
                                size={18}
                                fill={i < review.rating ? "currentColor" : "none"}
                                stroke="currentColor"
                                className={i < review.rating ? "text-clay" : "text-neutral-200"}
                              />
                            ))}
                          </div>
                          <span className="text-sm font-extrabold text-neutral-800">
                            {review.rating}.0
                          </span>
                        </div>
                        <p className="text-sm font-medium text-neutral-400">
                          {new Date(review.created_at).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric'})}
                        </p>
                      </div>
                      <p className="text-neutral-600 leading-relaxed text-lg">{review.comment}</p>
                    </motion.div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
};
export default ProductDetail;
