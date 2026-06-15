import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, X, TrendingUp, History, CornerDownLeft, Sparkles } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '@/lib/supabaseClient';
import { ProductProps } from './ProductCard';

export default function SpotlightSearch() {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [products, setProducts] = useState<ProductProps[]>([]);
  const [filteredProducts, setFilteredProducts] = useState<ProductProps[]>([]);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();

  // Trending items - hardcoded popular organic search terms
  const trendingSearches = [
    "Kumkumadi Face Serum",
    "Organic Rose Water",
    "Sandalwood Soap",
    "Hair Growth Oil",
    "Ubtan Face Pack"
  ];

  // Open on '/' key and custom event
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === '/' && document.activeElement?.tagName !== 'INPUT' && document.activeElement?.tagName !== 'TEXTAREA') {
        e.preventDefault();
        setIsOpen(true);
      }
      if (e.key === 'Escape') {
        setIsOpen(false);
      }
    };

    const handleOpenSearch = () => {
      setIsOpen(true);
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('open-grevya-search', handleOpenSearch);
    
    // Load recent searches
    const recents = localStorage.getItem('grevya-recent-searches');
    if (recents) {
      setRecentSearches(JSON.parse(recents));
    }

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('open-grevya-search', handleOpenSearch);
    };
  }, []);

  // Fetch products once on mount for instant searching
  useEffect(() => {
    const fetchAllProducts = async () => {
      try {
        const { data, error } = await supabase.from('products').select('*');
        if (error) throw error;
        const formatted = (data || []).map((item) => ({
          ...item,
          image: item.image_url,
          rating: item.rating || 4,
          slug: (item.name || '').toLowerCase().replace(/\s+/g, '-'),
        }));
        setProducts(formatted);
      } catch (err) {
        console.error('Error fetching spotlight search list:', err);
      }
    };
    fetchAllProducts();
  }, []);

  // Autofocus input when modal opens
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 80);
      setSelectedIndex(0);
    } else {
      setQuery('');
    }
  }, [isOpen]);

  // Filter products as user types
  useEffect(() => {
    if (!query) {
      setFilteredProducts([]);
      return;
    }

    const lowercaseQuery = query.toLowerCase();
    const matches = products.filter(
      (p) =>
        p.name.toLowerCase().includes(lowercaseQuery) ||
        p.category.toLowerCase().includes(lowercaseQuery)
    );
    setFilteredProducts(matches.slice(0, 5)); // Limit to top 5 hits
    setSelectedIndex(0);
  }, [query, products]);

  // Handle keyboard navigation inside search overlay
  const handleSearchKeyDown = (e: React.KeyboardEvent) => {
    if (filteredProducts.length === 0) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev + 1) % filteredProducts.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev - 1 + filteredProducts.length) % filteredProducts.length);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const selected = filteredProducts[selectedIndex];
      if (selected) {
        handleProductSelect(selected);
      }
    }
  };

  const handleProductSelect = (product: ProductProps) => {
    saveRecentSearch(product.name);
    setIsOpen(false);
    navigate(`/products/${product.category}/${product.slug}`);
  };

  const handleQuerySearchSubmit = (searchStr: string) => {
    saveRecentSearch(searchStr);
    setIsOpen(false);
    navigate(`/products?q=${encodeURIComponent(searchStr)}`);
  };

  const saveRecentSearch = (searchStr: string) => {
    const updated = [searchStr, ...recentSearches.filter((s) => s !== searchStr)].slice(0, 5);
    setRecentSearches(updated);
    localStorage.setItem('grevya-recent-searches', JSON.stringify(updated));
  };

  const clearRecents = (e: React.MouseEvent) => {
    e.stopPropagation();
    setRecentSearches([]);
    localStorage.removeItem('grevya-recent-searches');
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-start justify-center pt-[12vh] px-4">
          {/* Backdrop blur overlay */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setIsOpen(false)}
            className="fixed inset-0 bg-[#1D1E19]/40 backdrop-blur-md"
          />

          {/* Modal Container */}
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: -8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: -8 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            className="w-full max-w-2xl bg-[#F7EEE4] border border-[#A68D65]/25 rounded-2xl shadow-2xl overflow-hidden z-10 flex flex-col"
          >
            {/* Search Input bar */}
            <div className="flex items-center px-5 py-4 border-b border-[#A68D65]/15 relative">
              <Search className="h-5 w-5 text-[#33381C]/60" />
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={handleSearchKeyDown}
                placeholder="Search premium oils, face serums, natural soaps..."
                className="w-full ml-3 bg-transparent border-none outline-none text-base text-[#1D1E19] placeholder-[#1D1E19]/40 focus:ring-0"
              />
              <div className="flex items-center space-x-2">
                <span className="hidden sm:inline-block text-[10px] px-2 py-0.5 rounded border border-[#A68D65]/35 text-[#33381C]/50 font-mono shadow-sm">
                  ESC
                </span>
                <button
                  onClick={() => setIsOpen(false)}
                  className="p-1 rounded-full text-[#33381C]/50 hover:text-[#33381C] hover:bg-[#A68D65]/10 transition-colors"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* Results & Quick suggestions content */}
            <div className="max-h-[55vh] overflow-y-auto p-5 space-y-6 no-scrollbar">
              {query.length === 0 ? (
                <>
                  {/* Recent Searches */}
                  {recentSearches.length > 0 && (
                    <div>
                      <div className="flex items-center justify-between text-xs font-semibold tracking-wider uppercase text-[#33381C]/50 mb-2.5">
                        <span className="flex items-center"><History className="h-3.5 w-3.5 mr-1.5" /> Recent Searches</span>
                        <button
                          onClick={clearRecents}
                          className="hover:text-red-700 transition-colors lowercase font-normal"
                        >
                          Clear all
                        </button>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {recentSearches.map((term, idx) => (
                          <button
                            key={idx}
                            onClick={() => handleQuerySearchSubmit(term)}
                            className="flex items-center text-xs md:text-sm px-3.5 py-1.5 rounded-full bg-[#EAE2D5]/70 hover:bg-[#EAE2D5] text-[#33381C] font-medium transition-colors"
                          >
                            {term}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Trending suggestions */}
                  <div>
                    <h3 className="flex items-center text-xs font-semibold tracking-wider uppercase text-[#33381C]/50 mb-2.5">
                      <TrendingUp className="h-3.5 w-3.5 mr-1.5" /> Trending Searches
                    </h3>
                    <div className="flex flex-col space-y-1.5">
                      {trendingSearches.map((term, idx) => (
                        <button
                          key={idx}
                          onClick={() => handleQuerySearchSubmit(term)}
                          className="flex items-center text-left text-sm font-medium py-2 px-3 rounded-lg text-[#33381C] hover:bg-[#EAE2D5]/50 hover:-translate-x-0.5 transition-all"
                        >
                          <Sparkles className="h-4 w-4 text-[#A68D65] mr-2.5" />
                          {term}
                        </button>
                      ))}
                    </div>
                  </div>
                </>
              ) : filteredProducts.length > 0 ? (
                <div>
                  <h3 className="text-xs font-semibold tracking-wider uppercase text-[#33381C]/50 mb-3">
                    Products found ({filteredProducts.length})
                  </h3>
                  <div className="flex flex-col space-y-1.5">
                    {filteredProducts.map((p, idx) => (
                      <div
                        key={p.id}
                        onClick={() => handleProductSelect(p)}
                        onMouseEnter={() => setSelectedIndex(idx)}
                        className={`flex items-center justify-between p-2.5 rounded-xl cursor-pointer transition-all ${
                          idx === selectedIndex
                            ? 'bg-[#33381C] text-[#F7EEE4] translate-x-1.5'
                            : 'hover:bg-[#EAE2D5]/50 text-[#1D1E19]'
                        }`}
                      >
                        <div className="flex items-center space-x-3.5">
                          <img
                            src={p.image}
                            alt={p.name}
                            className="w-11 h-11 rounded-lg object-cover border border-[#A68D65]/10 shrink-0 bg-white"
                          />
                          <div>
                            <p className="font-semibold text-sm line-clamp-1">{p.name}</p>
                            <p className={`text-xs ${idx === selectedIndex ? 'text-[#F7EEE4]/70' : 'text-[#33381C]/60'}`}>
                              {p.category}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center space-x-3 pr-2">
                          <span className="font-bold text-sm">₹{p.price.toFixed(2)}</span>
                          {idx === selectedIndex && (
                            <CornerDownLeft className="h-3.5 w-3.5 opacity-60" />
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="mt-4 pt-3 border-t border-[#A68D65]/10 flex items-center justify-between text-xs text-[#33381C]/60">
                    <span>Use ↑↓ to navigate, Enter to select</span>
                    <button
                      onClick={() => handleQuerySearchSubmit(query)}
                      className="font-semibold text-[#33381C] hover:underline"
                    >
                      See all products matching &quot;{query}&quot;
                    </button>
                  </div>
                </div>
              ) : (
                <div className="py-8 text-center">
                  <p className="text-[#33381C] font-semibold text-lg mb-1">No products found</p>
                  <p className="text-xs text-[#33381C]/60 max-w-sm mx-auto">
                    We couldn&apos;t find any matches for &quot;{query}&quot;. Try checking the spelling or searching other terms.
                  </p>
                </div>
              )}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
