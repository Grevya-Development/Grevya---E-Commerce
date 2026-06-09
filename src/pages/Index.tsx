
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

const Index = () => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-cream/30">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-green-100 border-t-green-800" />
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen">
      <Navbar />
      <main className="flex-grow">
        {user ? (
          <>
            <PersonalizedHome />
            <CategoryHighlight />
          </>
        ) : (
          <>
            <Hero />
            <FeaturedProducts />
            <section className="bg-white py-8">
              <div className="container mx-auto grid gap-4 px-4 md:grid-cols-3">
                {['Fast account setup', 'Wishlist-ready shopping', 'Realtime order updates'].map((item) => (
                  <div key={item} className="rounded-2xl border border-green-100 bg-green-50/60 p-5 text-center font-semibold text-green-900 shadow-sm">
                    {item}
                  </div>
                ))}
              </div>
            </section>
            <section className="bg-green-900 px-4 py-16 text-white">
              <div className="container mx-auto flex flex-col items-start justify-between gap-6 md:flex-row md:items-center">
                <div>
                  <p className="text-sm font-bold uppercase tracking-[0.2em] text-clay">Member benefits</p>
                  <h2 className="mt-2 max-w-2xl text-3xl font-extrabold md:text-4xl">Create an account for saved addresses, faster checkout, and order tracking.</h2>
                </div>
                <div className="flex gap-3">
                  <Button asChild className="rounded-xl bg-white text-green-900 hover:bg-green-50">
                    <Link to="/signup">Sign up</Link>
                  </Button>
                  <Button asChild variant="outline" className="rounded-xl border-white/30 bg-transparent text-white hover:bg-white/10">
                    <Link to="/login">Login</Link>
                  </Button>
                </div>
              </div>
            </section>
            <MissionSection />
            <CategoryHighlight />
            <Newsletter />
          </>
        )}
      </main>
      <Footer />
    </div>
  );
};

export default Index;
