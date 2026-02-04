
import React from 'react';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import Hero from '@/components/Hero';
import FeaturedProducts from '@/components/FeaturedProducts';
import MissionSection from '@/components/MissionSection';
import CategoryHighlight from '@/components/CategoryHighlight';
import Newsletter from '@/components/Newsletter';

const Index = () => {
  return (
    <div className="flex flex-col min-h-screen">
      <Navbar />
      <main className="flex-grow">
        <Hero />
        <FeaturedProducts />
        <MissionSection />
        <CategoryHighlight />
        <Newsletter />
      </main>
      <Footer />
    </div>
  );
};

export default Index;
