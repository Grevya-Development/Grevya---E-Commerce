import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Leaf, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { productImages } from '@/lib/product-images';
import { motion } from 'framer-motion';

const fadeInUp = {
  hidden: { opacity: 0, y: 20 },
  visible: { 
    opacity: 1, 
    y: 0, 
    transition: { 
      type: "spring" as const,
      stiffness: 90,
      damping: 18
    } 
  }
};

const staggerContainer = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.12 }
  }
};

const Hero = () => {
  return (
    <section className="relative bg-gradient-mesh overflow-hidden py-10 md:py-16 lg:py-20 border-b border-[#A68D65]/10 select-none">
      {/* Slow floating decorative mesh background orbs */}
      <motion.div 
        animate={{ 
          x: [0, 20, -15, 0],
          y: [0, -30, 20, 0]
        }}
        transition={{
          duration: 25,
          repeat: Infinity,
          ease: "easeInOut"
        }}
        className="absolute top-1/2 left-0 -translate-y-1/2 w-80 h-80 bg-[#E7E9DD]/60 rounded-full blur-3xl -z-10 pointer-events-none gpu-accelerated" 
      />
      <motion.div 
        animate={{ 
          x: [0, -30, 20, 0],
          y: [0, 25, -25, 0]
        }}
        transition={{
          duration: 30,
          repeat: Infinity,
          ease: "easeInOut"
        }}
        className="absolute top-10 right-10 w-96 h-96 bg-[#F1ECE3]/70 rounded-full blur-3xl -z-10 pointer-events-none gpu-accelerated" 
      />

      <div className="container mx-auto px-4">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-12 items-center">
          {/* Text Content Block (40% space on desktop) */}
          <div className="lg:col-span-5 flex flex-col justify-center">
            <motion.div
              variants={staggerContainer}
              initial="hidden"
              animate="visible"
              className="space-y-5 text-center lg:text-left"
            >
              {/* Premium micro badge */}
              <motion.div variants={fadeInUp} className="inline-flex justify-center lg:justify-start">
                <span className="eco-badge bg-[#33381C] text-[#F7EEE4] border-none px-3.5 py-1.5 text-xs font-bold tracking-wider rounded-full shadow-sm flex items-center">
                  <Leaf className="w-3.5 h-3.5 mr-1.5 text-[#A68D65]" />
                  100% Organic & Sustainable
                </span>
              </motion.div>

              {/* Hook Heading */}
              <motion.h1 
                variants={fadeInUp} 
                className="font-serif text-3xl sm:text-4xl md:text-5xl font-bold text-[#1D1E19] leading-tight"
              >
                Pure Botanical Luxury for <span className="text-[#33381C] italic">Conscious</span> Living
              </motion.h1>

              {/* Subtitle description */}
              <motion.p 
                variants={fadeInUp} 
                className="text-[#1D1E19]/70 text-sm sm:text-base md:text-lg leading-relaxed max-w-xl mx-auto lg:mx-0 font-medium"
              >
                Empowering rural communities through sustainable manufacturing. Explore our hand-harvested, chemical-free cold-pressed oils, pure powders, and bio-plates.
              </motion.p>

              {/* Call to Actions */}
              <motion.div 
                variants={fadeInUp} 
                className="flex flex-wrap items-center justify-center lg:justify-start gap-4 pt-2"
              >
                <Button asChild className="rounded-xl bg-[#33381C] hover:bg-[#262A14] text-[#F7EEE4] px-7 py-6 font-bold transition-all duration-300 shadow-md hover:shadow-xl hover:-translate-y-0.5 active:translate-y-0 text-sm cursor-pointer">
                  <Link to="/products">Shop Best Sellers</Link>
                </Button>
                <Button asChild variant="ghost" className="rounded-xl border border-[#33381C]/25 text-[#33381C] hover:bg-[#33381C]/5 px-7 py-6 font-bold transition-all duration-300 text-sm cursor-pointer">
                  <Link to="/about" className="flex items-center">
                    Our Story
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
              </motion.div>
            </motion.div>
          </div>

          {/* Imagery Block (60% space on desktop) */}
          <div className="lg:col-span-7 relative flex justify-center mt-6 lg:mt-0">
            <motion.div
              className="relative w-full max-w-xl md:max-w-2xl overflow-visible"
              initial={{ opacity: 0, scale: 0.96, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
            >
              {/* Slow automatic ambient float wrapper */}
              <motion.div
                animate={{ y: [0, -10, 0] }}
                transition={{
                  duration: 8,
                  repeat: Infinity,
                  ease: "easeInOut"
                }}
                className="relative gpu-accelerated"
              >
                {/* Abstract decorative accent lines */}
                <div className="absolute -top-4 -left-4 w-16 h-16 bg-[#A68D65]/10 rounded-full -z-10 animate-pulse-orb" />
                <div className="absolute -bottom-6 -right-6 w-28 h-28 bg-[#33381C]/8 rounded-full -z-10 animate-pulse-orb" />

                {/* Main dominant picture */}
                <img
                  src={productImages.backgrounds.nature}
                  alt="Premium botanical natural ingredients"
                  className="w-full h-[320px] sm:h-[400px] object-cover rounded-3xl shadow-2xl border border-[#A68D65]/15"
                />
              </motion.div>

              {/* Floating Featured Product Preview Card */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.85, duration: 0.7 }}
                className="absolute bottom-5 left-5 md:bottom-8 md:left-8 z-20 glass-card p-3 rounded-2xl shadow-xl flex items-center space-x-3.5 max-w-[270px] border border-[#A68D65]/25 hover:scale-105 active:scale-95 transition-all duration-300 cursor-pointer animate-bounce-subtle gpu-accelerated"
                onClick={() => window.dispatchEvent(new CustomEvent('open-grevya-quickview', { 
                  detail: {
                    id: 3, 
                    name: "Pure Coconut Oil", 
                    price: 299.00, 
                    rating: 4.8, 
                    image: productImages.natural.coconutOil, 
                    category: "natural", 
                    slug: "pure-coconut-oil"
                  } 
                }))}
              >
                <img 
                  src={productImages.natural.coconutOil} 
                  className="w-12 h-12 object-cover rounded-lg bg-white border border-[#A68D65]/10 shrink-0" 
                  alt="Pure Coconut Oil Thumbnail" 
                />
                <div className="flex-grow">
                  <span className="flex items-center text-[8px] font-bold text-[#A68D65] uppercase tracking-wider">
                    <Sparkles className="h-2 w-2 mr-1 text-[#A68D65]" /> Popular Choice
                  </span>
                  <h4 className="font-serif text-sm font-extrabold text-[#33381C] leading-none mt-0.5 animate-pulse">Pure Coconut Oil</h4>
                  <p className="text-[10px] text-[#33381C]/75 font-semibold mt-1">₹299.00 • Quick View</p>
                </div>
              </motion.div>
            </motion.div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default Hero;
