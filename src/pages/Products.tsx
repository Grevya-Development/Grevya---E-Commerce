import React, { useState, useEffect } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import ProductCard from '@/components/ProductCard';
import { supabase } from '@/lib/supabaseClient';
import { Button } from '@/components/ui/button';
import { Filter, SlidersHorizontal, ChevronRight } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const CATEGORIES = ['all', 'bamboo', 'clay', 'coconut', 'coir', 'jute'];

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
    <div className="flex flex-col min-h-screen bg-cream/10">
      <Navbar />

      <main className="flex-grow pt-10 pb-20">
        <div className="container mx-auto px-4">
          
          {/* Breadcrumb */}
          <div className="flex items-center gap-1.5 text-xs text-neutral-400 font-semibold uppercase tracking-wider mb-6">
            <Link to="/" className="hover:text-green-700 transition-colors">Home</Link>
            <ChevronRight size={12} />
            <span className="text-neutral-800">Shop Catalog</span>
          </div>

          <div className="mb-8">
            <h1 className="text-4xl font-extrabold text-neutral-900 tracking-tight mb-2">
              {searchQuery
                ? `Search results for "${searchQuery}"`
                : categoryFilter === 'all'
                  ? 'Our Catalog'
                  : `${categoryFilter.charAt(0).toUpperCase() + categoryFilter.slice(1)} Collection`}
            </h1>
            <p className="text-neutral-500 text-sm max-w-lg">
              Explore our range of 100% natural, biodegradable, and hand-crafted sustainable items.
            </p>
          </div>

          {/* Controls Bar */}
          <div className="flex items-center justify-between border-y border-neutral-100 bg-white px-6 py-4 rounded-2xl mb-8 shadow-sm">
            <div className="flex items-center gap-2 text-sm text-neutral-500 font-medium">
              <span className="font-bold text-neutral-900">{filteredProducts.length}</span> items found
            </div>
            
            <div className="flex items-center gap-4">
              <div className="hidden md:flex items-center gap-2">
                <span className="text-xs uppercase font-bold text-neutral-400 tracking-wider">Sort By</span>
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}
                  className="rounded-xl border border-neutral-200 bg-white px-3 py-1.5 text-sm font-semibold text-neutral-700 outline-none focus:border-green-700 transition-colors"
                >
                  <option value="featured">Featured</option>
                  <option value="price-asc">Price: Low to High</option>
                  <option value="price-desc">Price: High to Low</option>
                  <option value="rating">Top Rated</option>
                </select>
              </div>

              <Button
                variant="outline"
                className="md:hidden flex items-center gap-2 rounded-xl"
                onClick={() => setShowMobileFilters(true)}
              >
                <Filter size={16} />
                Filters
              </Button>
            </div>
          </div>

          {/* Main Grid */}
          <div className="grid grid-cols-1 md:grid-cols-[240px_1fr] gap-8">
            
            {/* Desktop Sidebar Filter */}
            <aside className="hidden md:block space-y-6">
              <div>
                <h3 className="text-xs uppercase font-bold tracking-widest text-neutral-400 mb-3.5">Categories</h3>
                <div className="flex flex-col gap-1.5">
                  {CATEGORIES.map((cat) => {
                    const active = categoryFilter === cat;
                    return (
                      <button
                        key={cat}
                        onClick={() => handleCategorySelect(cat)}
                        className={`text-left px-4 py-2.5 rounded-xl text-sm font-semibold transition-all flex items-center justify-between ${
                          active 
                            ? 'bg-green-800 text-white shadow-md shadow-green-900/10' 
                            : 'hover:bg-neutral-50 text-neutral-600 hover:text-neutral-900'
                        }`}
                      >
                        <span className="capitalize">{cat}</span>
                        <ChevronRight size={14} className={active ? 'text-white' : 'text-neutral-400'} />
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="border-t border-neutral-100 pt-6">
                <h3 className="text-xs uppercase font-bold tracking-widest text-neutral-400 mb-3.5">Eco Certifications</h3>
                <div className="space-y-2.5 text-xs font-semibold text-neutral-600">
                  <div className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-green-600"></span>
                    100% Biodegradable
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-green-600"></span>
                    Rural Artisans Crafted
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-green-600"></span>
                    Zero Plastic Fillers
                  </div>
                </div>
              </div>
            </aside>

            {/* Products Listing Area */}
            <div>
              {loading ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                  {[1, 2, 3, 4, 5, 6].map((idx) => (
                    <div key={idx} className="h-96 rounded-2xl bg-white border border-neutral-100 animate-pulse" />
                  ))}
                </div>
              ) : error ? (
                <div className="text-center py-20 rounded-2xl bg-white border border-neutral-100 p-8">
                  <p className="text-red-600 font-semibold mb-2">Could not retrieve products</p>
                  <p className="text-sm text-neutral-500">{error}</p>
                </div>
              ) : filteredProducts.length === 0 ? (
                <div className="text-center py-20 rounded-2xl bg-white border border-neutral-100 p-8">
                  <SlidersHorizontal className="mx-auto w-12 h-12 text-neutral-300 mb-4" />
                  <p className="font-bold text-neutral-700 mb-1">No products found</p>
                  <p className="text-sm text-neutral-400">Try adjusting your filters or search criteria.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                  {filteredProducts.map((product) => {
                    const slug = (product.name || '').toLowerCase().replace(/\s+/g, '-');
                    const category = encodeURIComponent(product.category || 'general');

                    return (
                      <Link key={product.id} to={`/products/${category}/${slug}`}>
                        <ProductCard
                          id={product.id}
                          name={product.name}
                          price={product.price}
                          image={product.image}
                          category={product.category}
                          rating={product.rating}
                          slug={slug}
                        />
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>

          </div>
        </div>
      </main>

      {/* Mobile Filters Drawer */}
      <AnimatePresence>
        {showMobileFilters && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.4 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowMobileFilters(false)}
              className="fixed inset-0 z-50 bg-black"
            />
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="fixed right-0 top-0 bottom-0 z-50 w-full max-w-xs bg-white p-6 shadow-2xl flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between border-b border-neutral-100 pb-4 mb-6">
                  <h3 className="font-bold text-neutral-800 text-lg">Filters</h3>
                  <button onClick={() => setShowMobileFilters(false)} className="text-sm font-semibold text-neutral-400 hover:text-neutral-800">Close</button>
                </div>

                <div className="space-y-6">
                  <div>
                    <h4 className="text-xs uppercase font-bold tracking-widest text-neutral-400 mb-3">Categories</h4>
                    <div className="flex flex-col gap-1">
                      {CATEGORIES.map((cat) => {
                        const active = categoryFilter === cat;
                        return (
                          <button
                            key={cat}
                            onClick={() => handleCategorySelect(cat)}
                            className={`text-left px-3.5 py-2 rounded-xl text-sm font-semibold capitalize ${
                              active ? 'bg-green-50 text-green-800' : 'text-neutral-600'
                            }`}
                          >
                            {cat}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div>
                    <h4 className="text-xs uppercase font-bold tracking-widest text-neutral-400 mb-3">Sort</h4>
                    <select
                      value={sortBy}
                      onChange={(e) => setSortBy(e.target.value)}
                      className="w-full rounded-xl border border-neutral-200 bg-white px-3 py-2 text-sm font-semibold text-neutral-700 outline-none"
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