
import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { productImages } from '@/lib/product-images';
import { motion } from 'framer-motion';

const fadeInUp = {
  hidden: { opacity: 0, y: 30 },
  visible: { opacity: 1, y: 0 }
};

const staggerContainer = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.15 }
  }
};

const Hero = () => {
  return (
    <div className="relative bg-cream">
      {/* Desktop hero */}
      <div className="hidden lg:block">
        <div className="container mx-auto px-4 py-20">
          <div className="flex flex-col lg:flex-row items-center">
            <div className="lg:w-1/2 lg:pr-12">
              <motion.div
                className="animate-fade-in"
                variants={staggerContainer}
                initial="hidden"
                animate="visible"
              >
                <motion.span variants={fadeInUp} className="eco-badge mb-3">
                  <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  Eco-friendly & Sustainable
                </motion.span>
                <motion.h1 variants={fadeInUp} className="text-4xl lg:text-5xl font-bold text-brown-800 mb-4 leading-tight">
                  Natural Products for <span className="text-green-700">Sustainable</span> Living
                </motion.h1>
                <motion.p variants={fadeInUp} className="text-brown-600 text-lg mb-8 max-w-lg">
                  Empowering rural communities through eco-friendly manufacturing. Our products are 100% natural,
                  biodegradable, and sustainably sourced.
                </motion.p>
                <motion.div variants={fadeInUp} className="flex flex-wrap gap-4">
                  {/* @ts-ignore */}
                  <Button asChild className="btn-primary">
                    <Link to="/products">Shop Now</Link>
                  </Button>
                  {/* @ts-ignore */}
                  <Button asChild variant="outline" className="flex items-center">
                    <Link to="/about">
                      Learn More
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </Link>
                  </Button>
                </motion.div>
              </motion.div>
            </div>
            <div className="lg:w-1/2 mt-10 lg:mt-0">
              <motion.div
                className="relative"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.6, delay: 0.3, ease: "easeOut" }}
              >
                <div className="absolute -top-6 -left-6 w-24 h-24 bg-green-100 rounded-full z-0"></div>
                <div className="absolute -bottom-6 -right-6 w-32 h-32 bg-brown-100 rounded-full z-0"></div>
                <img
                  src={productImages.backgrounds.sustainability}
                  alt="Nature inspired products"
                  className="w-full h-auto rounded-lg shadow-lg relative z-10"
                />
              </motion.div>
            </div>
          </div>
        </div>
      </div>

      {/* Mobile hero with simplified design */}
      <div className="lg:hidden">
        <img
          src={productImages.backgrounds.sustainability}
          alt="Nature inspired products"
          className="w-full h-64 object-cover"
        />
        <div className="container mx-auto px-4 py-10">
          <span className="eco-badge mb-3 inline-flex">
            <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            Eco-friendly & Sustainable
          </span>
          <h1 className="text-3xl font-bold text-brown-800 mb-4">
            Natural Products for <span className="text-green-700">Sustainable</span> Living
          </h1>
          <p className="text-brown-600 mb-6">
            Empowering rural communities through eco-friendly manufacturing. Our products are 100% natural,
            biodegradable, and sustainably sourced.
          </p>
          <div className="flex flex-wrap gap-3">
            {/* @ts-ignore */}
            <Button asChild className="btn-primary">
              <Link to="/products">Shop Now</Link>
            </Button>
            {/* @ts-ignore */}
            <Button asChild variant="outline" className="flex items-center">
              <Link to="/about">
                Learn More
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Hero;
