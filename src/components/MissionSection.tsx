
import React from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { ArrowRight } from 'lucide-react';
import { productImages } from '@/lib/product-images';

const MissionSection = () => {
  return (
    <section className="py-16 bg-white">
      <div className="container mx-auto px-4">
        <div className="flex flex-col md:flex-row items-center gap-10">
          <div className="md:w-1/2 order-2 md:order-1">
            <h2 className="section-heading">Our Mission</h2>
            <p className="text-brown-600 mb-6 leading-relaxed">
              At Grevya Industries, we're dedicated to creating mass employment opportunities
              in rural areas while promoting eco-friendly, sustainable products. By working with
              local communities, we're able to produce high-quality, natural goods that are
              good for consumers and the environment.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
              <div className="bg-cream rounded-lg p-4">
                <h3 className="font-serif text-lg font-semibold text-green-700 mb-2">Rural Employment</h3>
                <p className="text-sm text-brown-600">
                  Creating jobs and economic opportunities for rural communities across India.
                </p>
              </div>
              <div className="bg-cream rounded-lg p-4">
                <h3 className="font-serif text-lg font-semibold text-green-700 mb-2">Eco-Friendly Products</h3>
                <p className="text-sm text-brown-600">
                  100% natural, biodegradable products that reduce environmental impact.
                </p>
              </div>
              <div className="bg-cream rounded-lg p-4">
                <h3 className="font-serif text-lg font-semibold text-green-700 mb-2">Sustainable Sourcing</h3>
                <p className="text-sm text-brown-600">
                  Ethically harvested materials with minimal ecological footprint.
                </p>
              </div>
              <div className="bg-cream rounded-lg p-4">
                <h3 className="font-serif text-lg font-semibold text-green-700 mb-2">Community Development</h3>
                <p className="text-sm text-brown-600">
                  Reinvesting in local communities and traditional artisanal skills.
                </p>
              </div>
            </div>
            <Button asChild variant="outline" className="flex items-center">
              <Link to="/about">
                Learn About Our Story
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </div>
          <div className="md:w-1/2 order-1 md:order-2">
            <div className="relative">
              <div className="absolute -top-4 -right-4 w-32 h-32 bg-green-100 rounded-full z-0"></div>
              <img 
                src={productImages.backgrounds.rural}
                alt="Rural artisans creating eco-friendly products" 
                className="rounded-lg shadow-lg relative z-10 w-full"
              />
              <div className="absolute -bottom-4 -left-4 w-24 h-24 bg-brown-100 rounded-full z-0"></div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default MissionSection;
