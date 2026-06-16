import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { productImages } from '@/lib/product-images';
import { ArrowRight } from 'lucide-react';

const CategoryHighlight = () => {
  const navigate = useNavigate();

  const handleCardClick = (link: string, e: React.MouseEvent) => {
    // If user clicks the inner link/button, let standard react-router Link handle it
    if ((e.target as HTMLElement).closest('a')) return;
    navigate(link);
  };

  return (
    <section className="py-20 bg-[#F7EEE4]/40 dark:bg-transparent select-none border-t border-[#A68D65]/10">
      <div className="container mx-auto px-4">
        
        <div className="max-w-3xl mx-auto text-center mb-16">
          <span className="text-[10px] font-bold uppercase tracking-wider text-[#A68D65]">Eco-Conscious Collections</span>
          <h2 className="font-serif text-3xl md:text-4.5xl font-bold text-[#33381C] dark:text-[#F7EEE4] mt-1.5 mb-4 leading-tight">Shop by Botanical Collective</h2>
          <p className="text-[#1D1E19]/70 dark:text-[#F7EEE4]/70 text-sm md:text-base leading-relaxed">
            Explore our range of sustainable solutions handcrafted by local rural communities. Discover natural wellness and eco-friendly home alternatives.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch">
          {/* Editorial Card 1 - Areca Dinnerware (occupies 7 columns on desktop) */}
          <div 
            onClick={(e) => handleCardClick('/products?category=Home%20%26%20Living', e)}
            className="lg:col-span-7 group relative rounded-3xl overflow-hidden shadow-lg border border-[#A68D65]/15 flex flex-col justify-end min-h-[440px] cursor-pointer"
          >
            {/* Background image with zoom transition */}
            <div className="absolute inset-0 z-0">
              <img
                src={productImages.areca.plates}
                alt="Areca Palm Tableware Collective"
                className="w-full h-full object-cover transform group-hover:scale-105 transition-transform duration-1000 ease-premium"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-black/10 to-transparent" />
            </div>
            
            {/* Layered Liquid-Glass Narrative Block */}
            <div className="relative z-10 m-5 p-6 md:p-8 rounded-2xl bg-white/75 dark:bg-[#1D1E19]/75 backdrop-blur-md border border-[#A68D65]/20 shadow-md transition-all duration-500 group-hover:bg-white/95 dark:group-hover:bg-[#1D1E19]/90 group-hover:-translate-y-1">
              <span className="text-[8px] md:text-[9.5px] font-extrabold uppercase tracking-widest text-[#A68D65] block mb-1">
                100% Compostable Tableware
              </span>
              <h3 className="font-serif text-xl md:text-2.5xl font-bold text-[#33381C] dark:text-[#F7EEE4] mb-2 leading-tight">
                Areca Dinnerware Collective
              </h3>
              <p className="text-xs text-[#1D1E19]/75 dark:text-[#F7EEE4]/75 mb-4 max-w-xl leading-relaxed">
                Artisan-molded plates, bowls, and trays handcrafted from naturally fallen Areca palm leaves. Highly durable, microwave-safe, chemical-free, and compostable in 60 days.
              </p>
              <Link 
                to="/products?category=Home%20%26%20Living"
                className="inline-flex items-center text-xs font-bold text-[#33381C] dark:text-[#F7EEE4] hover:text-[#A68D65] dark:hover:text-[#A68D65] transition-colors gap-1.5 group/link"
              >
                <span>Browse Collection</span>
                <ArrowRight size={12} className="group-hover/link:translate-x-1 transition-transform" />
              </Link>
            </div>
          </div>

          {/* Editorial Card 2 - Botanical Personal Care (occupies 5 columns on desktop) */}
          <div 
            onClick={(e) => handleCardClick('/products?category=Personal%20Care', e)}
            className="lg:col-span-5 group relative rounded-3xl overflow-hidden shadow-lg border border-[#A68D65]/15 flex flex-col justify-end min-h-[440px] cursor-pointer"
          >
            {/* Background image with zoom transition */}
            <div className="absolute inset-0 z-0">
              <img
                src={productImages.natural.coconutOil}
                alt="Botanical & Personal Care Collective"
                className="w-full h-full object-cover transform group-hover:scale-105 transition-transform duration-1000 ease-premium"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-black/10 to-transparent" />
            </div>
            
            {/* Layered Liquid-Glass Narrative Block */}
            <div className="relative z-10 m-5 p-6 md:p-8 rounded-2xl bg-white/75 dark:bg-[#1D1E19]/75 backdrop-blur-md border border-[#A68D65]/20 shadow-md transition-all duration-500 group-hover:bg-white/95 dark:group-hover:bg-[#1D1E19]/90 group-hover:-translate-y-1">
              <span className="text-[8px] md:text-[9.5px] font-extrabold uppercase tracking-widest text-[#A68D65] block mb-1">
                100% Pure Botanical Extracts
              </span>
              <h3 className="font-serif text-xl md:text-2.5xl font-bold text-[#33381C] dark:text-[#F7EEE4] mb-2 leading-tight">
                Botanical Personal Care
              </h3>
              <p className="text-xs text-[#1D1E19]/75 dark:text-[#F7EEE4]/75 mb-4 leading-relaxed">
                Cold-pressed oils, hair colors, and organic powders processed without artificial additives. Sourced ethically to support smallholder farmers.
              </p>
              <Link 
                to="/products?category=Personal%20Care"
                className="inline-flex items-center text-xs font-bold text-[#33381C] dark:text-[#F7EEE4] hover:text-[#A68D65] dark:hover:text-[#A68D65] transition-colors gap-1.5 group/link"
              >
                <span>Browse Collection</span>
                <ArrowRight size={12} className="group-hover/link:translate-x-1 transition-transform" />
              </Link>
            </div>
          </div>
        </div>

      </div>
    </section>
  );
};

export default CategoryHighlight;
