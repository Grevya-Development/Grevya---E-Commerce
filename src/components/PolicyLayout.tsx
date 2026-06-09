import React from 'react';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';

interface PolicyLayoutProps {
  title: string;
  updated?: string;
  children: React.ReactNode;
}

const PolicyLayout = ({ title, updated, children }: PolicyLayoutProps) => {
  return (
    <div className="flex flex-col min-h-screen">
      <Navbar />
      <main className="flex-grow bg-cream py-16">
        <div className="container mx-auto px-4">
          <div className="max-w-3xl mx-auto">
            <h1 className="text-4xl font-serif font-bold text-green-800 mb-2">{title}</h1>
            {updated && (
              <p className="text-sm text-gray-500 mb-8">Last updated: {updated}</p>
            )}
            <div className="bg-white rounded-lg shadow-md p-8 space-y-6 text-gray-700 leading-relaxed">
              {children}
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default PolicyLayout;
