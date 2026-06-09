
import React from 'react';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';

const About = () => {
  return (
    <div className="flex flex-col min-h-screen">
      <Navbar />
      <main className="flex-grow">
        <div className="bg-cream py-16">
          <div className="container mx-auto px-4">
            <h1 className="text-4xl font-bold text-center text-brown-800 mb-8">About Us</h1>
            <div className="max-w-3xl mx-auto bg-white rounded-lg shadow-md p-8">
              <h2 className="text-2xl font-serif text-green-700 mb-4">Our Story</h2>
              <p className="text-brown-600 mb-6">
                Grevya Naturals was founded with a vision to create sustainable employment opportunities in rural
                areas while promoting eco-friendly alternatives to everyday products. Our journey began in the 
                serene village of Nagaranai, where we identified the potential of areca palm leaves as a sustainable 
                alternative to plastic disposables.
              </p>
              
              <h2 className="text-2xl font-serif text-green-700 mb-4">Our Mission</h2>
              <p className="text-brown-600 mb-6">
                At Grevya Naturals, we're dedicated to creating mass employment opportunities in rural areas
                while promoting sustainable and eco-friendly products. By working with local communities, we produce 
                high-quality goods that benefit both consumers and the environment.
              </p>
              
              <h2 className="text-2xl font-serif text-green-700 mb-4">Our Values</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                <div className="bg-cream p-5 rounded-lg">
                  <h3 className="font-semibold text-brown-800 mb-2">Sustainability</h3>
                  <p className="text-brown-600">We are committed to sustainable practices throughout our supply chain, 
                  from sourcing raw materials to manufacturing and packaging.</p>
                </div>
                <div className="bg-cream p-5 rounded-lg">
                  <h3 className="font-semibold text-brown-800 mb-2">Rural Empowerment</h3>
                  <p className="text-brown-600">We believe in the potential of rural communities and work to create 
                  stable employment opportunities that preserve traditional skills.</p>
                </div>
                <div className="bg-cream p-5 rounded-lg">
                  <h3 className="font-semibold text-brown-800 mb-2">Quality & Innovation</h3>
                  <p className="text-brown-600">We continuously innovate to improve our products while maintaining 
                  the highest standards of quality and craftsmanship.</p>
                </div>
                <div className="bg-cream p-5 rounded-lg">
                  <h3 className="font-semibold text-brown-800 mb-2">Community Focus</h3>
                  <p className="text-brown-600">We invest back into the communities we work with, supporting education, 
                  healthcare, and infrastructure development.</p>
                </div>
              </div>
              
              <h2 className="text-2xl font-serif text-green-700 mb-4">Our Impact</h2>
              <p className="text-brown-600">
                Through our initiatives, we are planning to create employment for over 200 rural artisans, mostly women. Our 
                production processes have zero waste, and we have replaced millions of plastic disposables with 
                biodegradable alternatives. We continue to expand our reach and impact through sustainable practices 
                and community engagement.
              </p>
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default About;
