import React, { useState, useEffect } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import ProductCard from '@/components/ProductCard';
import { supabase } from '@/lib/supabaseClient';
import { Button } from '@/components/ui/button';
import { Filter, SlidersHorizontal, ChevronRight, Compass } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { productImages } from '@/lib/product-images';

const containerVariants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: {
      staggerChildren: 0.06
    }
  }
};

const itemVariants = {
  hidden: { opacity: 0, y: 15 },
  show: { 
    opacity: 1, 
    y: 0,
    transition: {
      type: "spring" as const,
      stiffness: 110,
      damping: 16
    }
  }
};

const Products = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const categoryFilter = searchParams.get('category') || 'all';
  const searchQuery = searchParams.get('q') || '';

  const [products, setProducts] = useState<any[]>([]);
  const [filteredProducts, setFilteredProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<string>('featured');
  const [showMobileFilters, setShowMobileFilters] = useState(false);

  const categories = ['all', ...Array.from(new Set(products.map((p) => p.category).filter(Boolean)))];

  // Curated category cards
  const categoryCards = [
    {
      id: 'all',
      name: 'All Collection',
      image: productImages.backgrounds.nature,
      tag: 'Seasonal Picks',
      desc: 'Explore everything natural'
    },
    {
      id: 'Home & Living',
      name: 'Home & Living',
      image: productImages.areca.dinnerware,
      tag: 'Popular Choice',
      desc: 'Areca dinnerware & plates'
    },
    {
      id: 'Personal Care',
      name: 'Personal Care',
      image: productImages.natural.coconutOil,
      tag: 'Trending Now',
      desc: 'Oils, henna & cosmetics'
    }
  ];

  useEffect(() => {
    const fetchProducts = async () => {
      try {
        setLoading(true);
        setError(null);

        const { data, error: fetchError } = await supabase
          .from('products')
          .select('*')
          .order('id', { ascending: true });

        if (fetchError) throw fetchError;

        const formatted = (data || []).map((item) => ({
          ...item,
          image: item.image_url,
          rating: item.rating || 4,
        }));

        setProducts(formatted);
      } catch (err: any) {
        console.error("FETCH ERROR:", err);
        setError(err.message || "Something went wrong");
      } finally {
        setLoading(false);
      }
    };

    fetchProducts();
  }, []);

  // Filter and Sort logic
  useEffect(() => {
    let result = [...products];

    // 1. Category Filter
    if (categoryFilter && categoryFilter !== 'all') {
      result = result.filter(
        (p) => (p.category || '').toLowerCase() === categoryFilter.toLowerCase()
      );
    }

    // 1b. Search Filter (by name or description)
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      result = result.filter(
        (p) =>
          (p.name || '').toLowerCase().includes(q) ||
          (p.description || '').toLowerCase().includes(q)
      );
    }

    // 2. Sorting
    if (sortBy === 'price-asc') {
      result.sort((a, b) => a.price - b.price);
    } else if (sortBy === 'price-desc') {
      result.sort((a, b) => b.price - a.price);
    } else if (sortBy === 'rating') {
      result.sort((a, b) => b.rating - a.rating);
    }

    setFilteredProducts(result);
  }, [products, categoryFilter, searchQuery, sortBy]);

  const handleCategorySelect = (category: string) => {
    if (category === 'all') {
      searchParams.delete('category');
    } else {
      searchParams.set('category', category);
    }
    setSearchParams(searchParams);
    setShowMobileFilters(false);
  };

  return (
    <div className="flex flex-col min-h-screen bg-[#F7EEE4]/30">
      <Navbar />

      <main className="flex-grow pt-6 pb-20">
        <div className="container mx-auto px-4">
          
          {/* Breadcrumb */}
          <div className="flex items-center gap-1.5 text-[9px] text-[#33381C]/50 font-bold uppercase tracking-wider mb-4">
            <Link to="/" className="hover:text-[#33381C] transition-colors">Home</Link>
            <ChevronRight size={9} />
            <span className="text-[#33381C]">Catalog</span>
          </div>

          {/* Page Header */}
          <div className="mb-6">
            <span className="text-[10px] font-bold uppercase tracking-wider text-[#A68D65]">Eco-Friendly Luxury</span>
            <h1 className="font-serif text-2xl md:text-3.5xl font-bold text-[#1D1E19] mt-0.5 mb-1.5">
              {searchQuery
                ? `Results for "${searchQuery}"`
                : categoryFilter === 'all'
                  ? 'Our Organic Catalog'
                  : `${categoryFilter.charAt(0).toUpperCase() + categoryFilter.slice(1)} Collection`}
            </h1>
            <p className="text-[#1D1E19]/60 text-xs md:text-sm max-w-lg">
              Explore our range of 100% natural, biodegradable, and hand-crafted sustainable items.
            </p>
          </div>

          {/* Horizontally Scrollable Category Cards */}
          <div className="mb-8 select-none">
            <h3 className="text-[10px] uppercase font-bold tracking-wider text-[#1D1E19]/45 mb-3 flex items-center">
              <Compass className="h-3.5 w-3.5 mr-1.5 text-[#A68D65]" /> Popular Collections
            </h3>
            
            <div className="flex space-x-3.5 overflow-x-auto pb-3.5 snap-x-mandatory no-scrollbar scroll-smooth">
              {categoryCards.map((cat) => {
                const active = categoryFilter.toLowerCase() === cat.id.toLowerCase();
                return (
                  <div
                    key={cat.id}
                    onClick={() => handleCategorySelect(cat.id)}
                    className={`snap-start shrink-0 w-56 md:w-72 h-28 md:h-32 rounded-2xl relative overflow-hidden group cursor-pointer border transition-all duration-300 ${
                      active 
                        ? 'border-[#33381C] ring-2 ring-[#33381C]/20 scale-[1.01]' 
                        : 'border-[#A68D65]/15 hover:border-[#A68D65]/40 shadow-xs'
                    }`}
                  >
                    <img 
                      src={cat.image} 
                      className="w-full h-full object-cover transition-transform duration-750 group-hover:scale-103" 
                      alt={cat.name} 
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-[#1D1E19]/90 via-[#1D1E19]/35 to-transparent" />
                    
                    <div className="absolute inset-0 p-3.5 flex flex-col justify-between z-10">
                      <div className="flex items-center justify-between">
                        <span className="bg-[#A68D65] text-[#F7EEE4] text-[8px] font-extrabold tracking-wider uppercase px-2 py-0.5 rounded-full shadow-xs">
                          {cat.tag}
                        </span>
                        {active && <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />}
                      </div>
                      <div>
                        <h4 className="font-serif text-sm md:text-base font-bold text-white leading-tight">
                          {cat.name}
                        </h4>
                        <p className="text-[9px] text-white/70 line-clamp-1">
                          {cat.desc}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Controls Bar */}
          <div className="sticky top-20 z-20 flex items-center justify-between border border-[#A68D65]/15 bg-white/90 backdrop-blur-md px-4 py-2.5 rounded-2xl mb-6 shadow-md select-none transition-all duration-300 md:relative md:top-0 md:bg-white md:shadow-xs">
            <div className="flex items-center gap-1.5 text-[10px] text-neutral-500 font-bold uppercase tracking-wider">
              <span className="font-extrabold text-[#33381C] text-xs md:text-sm">{filteredProducts.length}</span> items
            </div>
            
            <div className="flex items-center gap-3">
              <div className="hidden md:flex items-center gap-2">
                <span className="text-[9px] uppercase font-bold text-neutral-400 tracking-wider">Sort By</span>
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}
                  className="rounded-xl border border-neutral-200 bg-white px-3 py-1.5 text-xs font-semibold text-neutral-700 outline-none focus:border-[#33381C] cursor-pointer"
                >
                  <option value="featured">Featured</option>
                  <option value="price-asc">Price: Low to High</option>
                  <option value="price-desc">Price: High to Low</option>
                  <option value="rating">Top Rated</option>
                </select>
              </div>

              <Button
                variant="outline"
                className="md:hidden flex items-center gap-1.5 rounded-xl text-[10px] py-1.5 h-8.5 font-bold border-[#A68D65]/20 text-[#33381C] bg-white/50"
                onClick={() => setShowMobileFilters(true)}
              >
                <Filter size={12} />
                Filters
              </Button>
            </div>
          </div>

          {/* Mobile Swipeable Category Pills */}
          <div className="md:hidden overflow-x-auto no-scrollbar flex gap-2 mb-5 pb-1 select-none">
            {categories.map((cat) => {
              const active = categoryFilter === cat;
              return (
                <button
                  key={cat}
                  onClick={() => handleCategorySelect(cat)}
                  className={`px-4 py-2 rounded-full text-xs font-bold whitespace-nowrap transition-all border ${
                    active
                      ? 'bg-[#33381C] text-[#F7EEE4] border-[#33381C] shadow-sm'
                      : 'bg-white/80 border-[#A68D65]/15 text-neutral-600'
                  }`}
                >
                  <span className="capitalize">{cat}</span>
                </button>
              );
            })}
          </div>

          {/* Grid Layout */}
          <div className="grid grid-cols-1 md:grid-cols-[200px_1fr] gap-6 md:gap-8">
            
            {/* Desktop Sidebar Filter */}
            <aside className="hidden md:block space-y-5 select-none">
              <div>
                <h3 className="text-[10px] uppercase font-bold tracking-wider text-[#1D1E19]/45 mb-2.5">Categories</h3>
                <div className="flex flex-col gap-1.5">
                  {categories.map((cat) => {
                    const active = categoryFilter === cat;
                    return (
                      <button
                        key={cat}
                        onClick={() => handleCategorySelect(cat)}
                        className={`text-left px-3 py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-between ${
                          active 
                            ? 'bg-[#33381C] text-[#F7EEE4] shadow-md shadow-green-950/10' 
                            : 'hover:bg-white/60 text-neutral-600 hover:text-[#33381C] border border-transparent'
                        }`}
                      >
                        <span className="capitalize">{cat}</span>
                        <ChevronRight size={11} className={active ? 'text-[#F7EEE4]' : 'text-neutral-400'} />
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="border-t border-[#A68D65]/10 pt-5">
                <h3 className="text-[10px] uppercase font-bold tracking-wider text-[#1D1E19]/45 mb-2.5">Eco Guarantees</h3>
                <div className="space-y-2.5 text-[11px] font-semibold text-neutral-600">
                  <div className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#33381C]"></span>
                    100% Biodegradable
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#33381C]"></span>
                    Artisan Hand-crafted
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#33381C]"></span>
                    Zero Starch Fillers
                  </div>
                </div>
              </div>
            </aside>

            {/* Products Listing Area */}
            <div>
              {loading ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-3 gap-3 md:gap-6">
                  {[1, 2, 3, 4, 5, 6].map((idx) => (
                    <div key={idx} className="bg-[#FBF7F1] rounded-2xl border border-[#A68D65]/12 flex flex-col h-[320px] overflow-hidden animate-pulse">
                      <div className="bg-[#EAE2D5]/30 aspect-[4/5] w-full shimmer-bg" />
                      <div className="p-3 flex flex-col flex-grow">
                        <div className="h-3 bg-[#EAE2D5]/50 rounded w-1/3 mb-1.5" />
                        <div className="h-4 bg-[#EAE2D5]/50 rounded w-3/4 mb-2" />
                        <div className="h-3.5 bg-[#EAE2D5]/50 rounded w-1/4 mt-auto" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : error ? (
                <div className="text-center py-16 rounded-2xl bg-white border border-[#A68D65]/12 p-6">
                  <p className="text-red-600 font-semibold mb-2">Could not retrieve products</p>
                  <p className="text-xs text-neutral-500">{error}</p>
                </div>
              ) : filteredProducts.length === 0 ? (
                <div className="text-center py-16 rounded-2xl bg-white border border-[#A68D65]/12 p-6">
                  <SlidersHorizontal className="mx-auto w-8 h-8 text-neutral-300 mb-3" />
                  <p className="font-bold text-neutral-700 mb-0.5">No products found</p>
                  <p className="text-xs text-neutral-400">Try adjusting your filters or search criteria.</p>
                </div>
              ) : (
                <motion.div 
                  variants={containerVariants}
                  initial="hidden"
                  animate="show"
                  className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-3 gap-3 md:gap-6"
                >
                  {filteredProducts.map((product) => {
                    const slug = (product.name || '').toLowerCase().replace(/\s+/g, '-');
                    return (
                      <motion.div key={product.id} variants={itemVariants} className="gpu-accelerated">
                        <ProductCard
                          id={product.id}
                          name={product.name}
                          price={product.price}
                          image={product.image}
                          category={product.category}
                          rating={product.rating}
                          slug={slug}
                        />
                      </motion.div>
                    );
                  })}
                </motion.div>
              )}
            </div>

          </div>
        </div>
      </main>

      {/* Mobile Filters Slide-in Drawer */}
      <AnimatePresence>
        {showMobileFilters && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.45 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowMobileFilters(false)}
              className="fixed inset-0 z-50 bg-[#1D1E19]"
            />
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 220 }}
              className="fixed right-0 top-0 bottom-0 z-50 w-full max-w-xs bg-[#F7EEE4] p-5 shadow-2xl flex flex-col justify-between border-l border-[#A68D65]/20"
            >
              <div>
                <div className="flex items-center justify-between border-b border-[#A68D65]/15 pb-3.5 mb-5">
                  <h3 className="font-serif font-bold text-[#33381C] text-lg">Filters</h3>
                  <button 
                    onClick={() => setShowMobileFilters(false)} 
                    className="text-[10px] uppercase tracking-wider font-extrabold text-[#1D1E19]/45 hover:text-neutral-800"
                  >
                    Close
                  </button>
                </div>

                <div className="space-y-5">
                  <div>
                    <h4 className="text-[9px] uppercase font-bold tracking-wider text-[#1D1E19]/45 mb-2.5">Categories</h4>
                    <div className="flex flex-col gap-1">
                      {categories.map((cat) => {
                        const active = categoryFilter === cat;
                        return (
                          <button
                            key={cat}
                            onClick={() => handleCategorySelect(cat)}
                            className={`text-left px-3 py-2 rounded-xl text-xs font-bold capitalize ${
                              active ? 'bg-[#33381C] text-[#F7EEE4]' : 'text-neutral-600'
                            }`}
                          >
                            {cat}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div>
                    <h4 className="text-[9px] uppercase font-bold tracking-wider text-[#1D1E19]/45 mb-2.5">Sort</h4>
                    <select
                      value={sortBy}
                      onChange={(e) => setSortBy(e.target.value)}
                      className="w-full rounded-xl border border-neutral-200 bg-white px-3 py-2 text-xs font-semibold text-neutral-700 outline-none"
                    >
                      <option value="featured">Featured</option>
                      <option value="price-asc">Price: Low to High</option>
                      <option value="price-desc">Price: High to Low</option>
                      <option value="rating">Top Rated</option>
                    </select>
                  </div>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <Footer />
    </div>
  );
};

export default Products;