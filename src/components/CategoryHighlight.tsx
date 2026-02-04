
import React from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { productImages } from '@/lib/product-images';

const CategoryHighlight = () => {
  return (
    <section className="py-16 bg-green-50">
      <div className="container mx-auto px-4">
        <h2 className="section-heading text-center">Our Product Categories</h2>
        <p className="text-brown-600 text-center max-w-2xl mx-auto mb-12">
          Discover our range of eco-friendly products crafted with care for both you and the environment.
          All our products are sustainably sourced and support rural employment.
        </p>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Areca Products */}
          <div className="rounded-lg overflow-hidden shadow-md bg-white relative group">
            <div className="relative h-64 overflow-hidden">
              <img 
                src={productImages.areca.dinnerware} 
                alt="Areca Products" 
                className="w-full h-full object-cover transform group-hover:scale-105 transition-transform duration-500"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent"></div>
              <h3 className="absolute bottom-6 left-6 text-white font-serif text-2xl font-bold">Areca Products</h3>
            </div>
            <div className="p-6">
              <p className="text-brown-600 mb-4">
                Biodegradable dinnerware made from fallen areca palm leaves. No trees cut, no chemicals used. 
                Perfect for eco-conscious dining and events.
              </p>
              <div className="flex flex-wrap gap-2 mb-4">
                <span className="text-sm bg-cream text-brown-700 px-3 py-1 rounded-full">Plates</span>
                <span className="text-sm bg-cream text-brown-700 px-3 py-1 rounded-full">Bowls</span>
                <span className="text-sm bg-cream text-brown-700 px-3 py-1 rounded-full">Trays</span>
                <span className="text-sm bg-cream text-brown-700 px-3 py-1 rounded-full">Dinnerware</span>
              </div>
              <Button asChild variant="outline">
                <Link to="/products/areca">Explore Areca Products</Link>
              </Button>
            </div>
          </div>
          
          {/* Natural Products */}
          <div className="rounded-lg overflow-hidden shadow-md bg-white relative group">
            <div className="relative h-64 overflow-hidden">
              <img 
                src={productImages.natural.coconutOil} 
                alt="Natural Products" 
                className="w-full h-full object-cover transform group-hover:scale-105 transition-transform duration-500"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent"></div>
              <h3 className="absolute bottom-6 left-6 text-white font-serif text-2xl font-bold">Natural Products</h3>
            </div>
            <div className="p-6">
              <p className="text-brown-600 mb-4">
                Pure, organic food and cosmetic products sourced directly from farmers and processed without additives. 
                Experience nature's goodness in its purest form.
              </p>
              <div className="flex flex-wrap gap-2 mb-4">
                <span className="text-sm bg-cream text-brown-700 px-3 py-1 rounded-full">Tomato Powder</span>
                <span className="text-sm bg-cream text-brown-700 px-3 py-1 rounded-full">Coconut Oil</span>
                <span className="text-sm bg-cream text-brown-700 px-3 py-1 rounded-full">Natural Henna</span>
                <span className="text-sm bg-cream text-brown-700 px-3 py-1 rounded-full">Indigo Powder</span>
              </div>
              <Button asChild variant="outline">
                <Link to="/products/natural">Explore Natural Products</Link>
              </Button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default CategoryHighlight;
