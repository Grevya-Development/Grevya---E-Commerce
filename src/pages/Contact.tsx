
import React from 'react';
import { Mail, Phone, MapPin, Send } from 'lucide-react';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import { Button } from '@/components/ui/button';

const Contact = () => {
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Form submission logic would be implemented here
  };

  return (
    <div className="flex flex-col min-h-screen">
      <Navbar />
      <main className="flex-grow">
        {/* Hero Section */}
        <section className="bg-cream py-16">
          <div className="container mx-auto px-4">
            <h1 className="text-4xl md:text-5xl font-serif font-bold text-brown-800 mb-4 text-center">Contact Us</h1>
            <p className="text-brown-600 text-center max-w-2xl mx-auto">
              We'd love to hear from you! Reach out to us with any questions, inquiries, or partnership opportunities.
            </p>
          </div>
        </section>

        {/* Contact Info & Form Section */}
        <section className="py-16">
          <div className="container mx-auto px-4">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
              {/* Contact Information */}
              <div className="bg-white rounded-lg shadow-md p-8">
                <h2 className="font-serif text-2xl font-bold text-brown-800 mb-6">Get In Touch</h2>
                
                <div className="space-y-6">
                  <div className="flex items-start">
                    <div className="bg-green-100 p-3 rounded-full mr-4">
                      <MapPin className="text-green-700 h-6 w-6" />
                    </div>
                    <div>
                      <h3 className="font-medium text-brown-800 mb-1">Our Location</h3>
                      <p className="text-brown-600">
                        4th South Cross St., Kovai Thiru Nagar,<br />
                        Kalapatty (E), Coimbatore 641014.
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex items-start">
                    <div className="bg-green-100 p-3 rounded-full mr-4">
                      <Phone className="text-green-700 h-6 w-6" />
                    </div>
                    <div>
                      <h3 className="font-medium text-brown-800 mb-1">Phone Number</h3>
                      <p className="text-brown-600">95669 66054</p>
                      <p className="text-brown-600 text-sm mt-1">
                        Monday to Friday, 9am to 6pm IST
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex items-start">
                    <div className="bg-green-100 p-3 rounded-full mr-4">
                      <Mail className="text-green-700 h-6 w-6" />
                    </div>
                    <div>
                      <h3 className="font-medium text-brown-800 mb-1">Email Address</h3>
                      <p className="text-brown-600">info@grevya.com</p>
                      <p className="text-brown-600 text-sm mt-1">
                        We'll respond as soon as possible
                      </p>
                    </div>
                  </div>
                </div>

                {/* Google Maps or Location Image would go here */}
                <div className="mt-8 bg-muted h-64 rounded-lg flex items-center justify-center">
                  <p className="text-gray-500">Map placeholder - Google Maps would be integrated here</p>
                </div>
              </div>

              {/* Contact Form */}
              <div className="bg-white rounded-lg shadow-md p-8">
                <h2 className="font-serif text-2xl font-bold text-brown-800 mb-6">Send Us a Message</h2>
                
                <form onSubmit={handleSubmit} className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label htmlFor="name" className="block text-brown-700 mb-1">Your Name</label>
                      <input 
                        type="text" 
                        id="name" 
                        className="w-full border border-input rounded px-4 py-2 focus:outline-none focus:ring-2 focus:ring-green-500"
                        required
                      />
                    </div>
                    <div>
                      <label htmlFor="email" className="block text-brown-700 mb-1">Email Address</label>
                      <input 
                        type="email" 
                        id="email" 
                        className="w-full border border-input rounded px-4 py-2 focus:outline-none focus:ring-2 focus:ring-green-500"
                        required
                      />
                    </div>
                  </div>
                  <div>
                    <label htmlFor="subject" className="block text-brown-700 mb-1">Subject</label>
                    <input 
                      type="text" 
                      id="subject" 
                      className="w-full border border-input rounded px-4 py-2 focus:outline-none focus:ring-2 focus:ring-green-500"
                      required
                    />
                  </div>
                  <div>
                    <label htmlFor="message" className="block text-brown-700 mb-1">Your Message</label>
                    <textarea 
                      id="message" 
                      rows={5} 
                      className="w-full border border-input rounded px-4 py-2 focus:outline-none focus:ring-2 focus:ring-green-500"
                      required
                    ></textarea>
                  </div>
                  <div>
                    <Button type="submit" className="bg-green-700 hover:bg-green-800 text-white flex items-center">
                      Send Message
                      <Send className="ml-2 h-4 w-4" />
                    </Button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        </section>

        {/* Bulk Order Section */}
        <section className="bg-brown-100 py-16">
          <div className="container mx-auto px-4 text-center">
            <h2 className="font-serif text-3xl font-bold text-brown-800 mb-4">Interested in Wholesale Orders?</h2>
            <p className="text-brown-600 max-w-2xl mx-auto mb-8">
              We offer special pricing and arrangements for bulk and wholesale orders. 
              Contact our team for more information.
            </p>
            <Button className="bg-brown-700 hover:bg-brown-800 text-white">
              Inquire About Wholesale
            </Button>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
};

export default Contact;
