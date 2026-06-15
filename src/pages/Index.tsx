import React from 'react';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import Hero from '@/components/Hero';
import FeaturedProducts from '@/components/FeaturedProducts';
import MissionSection from '@/components/MissionSection';
import CategoryHighlight from '@/components/CategoryHighlight';
import Newsletter from '@/components/Newsletter';
import PersonalizedHome from '@/components/PersonalizedHome';
import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';

const scrollReveal = {
  hidden: { opacity: 0, y: 30 },
  visible: { 
    opacity: 1, 
    y: 0, 
    transition: { 
      duration: 0.6, 
      ease: [0.16, 1, 0.3, 1] as const
    } 
  }
};

const Index = () => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#F7EEE4]/30">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-green-155 border-t-green-800" />
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen bg-gradient-mesh">
      <Navbar />
      
      <main className="flex-grow">
        {user ? (
          <>
            {/* Authenticated Dashboard */}
            <motion.div
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: "-80px" }}
              variants={scrollReveal}
            >
              <PersonalizedHome />
            </motion.div>

            <motion.div
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: "-80px" }}
              variants={scrollReveal}
            >
              <CategoryHighlight />
            </motion.div>
          </>
        ) : (
          <>
            {/* Guest Welcome Page */}
            <Hero />
            
            {/* Featured Catalog Items Section */}
            <motion.div
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: "-80px" }}
              variants={scrollReveal}
            >
              <FeaturedProducts />
            </motion.div>

            {/* Quick Benefits Banner Grid */}
            <motion.section 
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: "-80px" }}
              variants={scrollReveal}
              className="bg-white/60 py-10"
            >
              <div className="container mx-auto grid gap-4 px-4 md:grid-cols-3">
                {['Fast Account Setup', 'Wishlist-Ready Shopping', 'Real-time Order Updates'].map((item) => (
                  <div key={item} className="rounded-2xl border border-[#A68D65]/20 bg-white/50 p-5 text-center font-bold text-[#33381C] shadow-xs hover:border-[#33381C]/30 transition-colors">
                    {item}
                  </div>
                ))}
              </div>
            </motion.section>

            {/* Loyalty/Benefits Promotion Section */}
            <motion.section 
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: "-80px" }}
              variants={scrollReveal}
              className="bg-[#33381C] px-4 py-14 text-[#F7EEE4]"
            >
              <div className="container mx-auto flex flex-col items-start justify-between gap-6 md:flex-row md:items-center">
                <div>
                  <p className="text-xs font-extrabold uppercase tracking-widest text-[#A68D65]">Member Benefits</p>
                  <h2 className="mt-2 max-w-xl font-serif text-2xl md:text-3.5xl font-bold leading-tight">Create an account for saved addresses, faster checkout, and order tracking.</h2>
                </div>
                <div className="flex gap-3 shrink-0">
                  <Button asChild className="rounded-xl bg-[#F7EEE4] text-[#33381C] hover:bg-white font-bold cursor-pointer">
                    <Link to="/signup">Sign Up</Link>
                  </Button>
                  <Button asChild variant="outline" className="rounded-xl border-[#F7EEE4]/30 bg-transparent text-[#F7EEE4] hover:bg-[#F7EEE4]/10 font-bold cursor-pointer">
                    <Link to="/login">Login</Link>
                  </Button>
                </div>
              </div>
            </motion.section>

            {/* Corporate/Brand Mission */}
            <motion.div
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: "-80px" }}
              variants={scrollReveal}
            >
              <MissionSection />
            </motion.div>

            {/* Category Highlights */}
            <motion.div
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: "-80px" }}
              variants={scrollReveal}
            >
              <CategoryHighlight />
            </motion.div>

            {/* Newsletter Subscription */}
            <motion.div
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: "-80px" }}
              variants={scrollReveal}
            >
              <Newsletter />
            </motion.div>
          </>
        )}
      </main>
      <Footer />
    </div>
  );
};

export default Index;
