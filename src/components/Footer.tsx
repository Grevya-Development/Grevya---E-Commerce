
import React from 'react';
import { Link } from 'react-router-dom';
import { Facebook, Twitter, Instagram, Mail, Phone, MapPin } from 'lucide-react';

// Official product slugs for correct routing
const PRODUCT_LINKS = [
  { to: "/products/areca/premium-areca-plates-10-inch", label: "Areca Leaf Plates" },
  { to: "/products/natural/organic-tomato-powder-100g", label: "Tomato Powder" },
  { to: "/products/natural/pure-coconut-oil-500ml", label: "Pure Coconut Oil" },
  { to: "/products/natural/natural-henna-powder-200g", label: "Natural Henna" },
  { to: "/products/natural/indigo-powder-100g", label: "Indigo Powder" },
];

const Footer = () => {
  return (
    <footer className="bg-green-900 text-green-50 pt-14 pb-6">
      <div className="container mx-auto px-4">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-10">
          {/* Company Info */}
          <div>
            <div className="flex items-center mb-4">
              <span className="font-serif text-xl font-bold text-green-200">Grevya</span>
              <span className="font-serif text-xl font-normal text-green-400 ml-1">Industries</span>
            </div>
            <p className="text-green-200 text-sm mb-6">
              Creating mass employment in rural areas and empowering local communities through eco-friendly,
              sustainable products.
            </p>
            <div className="flex space-x-4">
              <a href="#" aria-label="Facebook" className="bg-green-800 hover:bg-green-700 p-2 rounded-full transition-colors">
                <Facebook size={18} />
              </a>
              <a href="#" aria-label="Twitter" className="bg-green-800 hover:bg-green-700 p-2 rounded-full transition-colors">
                <Twitter size={18} />
              </a>
              <a href="#" aria-label="Instagram" className="bg-green-800 hover:bg-green-700 p-2 rounded-full transition-colors">
                <Instagram size={18} />
              </a>
            </div>
          </div>

          {/* Quick Links */}
          <div>
            <h3 className="font-serif text-lg font-bold mb-4 text-green-200">Quick Links</h3>
            <ul className="space-y-2">
              <li><Link to="/" className="text-green-100 hover:text-green-400 transition-colors">Home</Link></li>
              <li><Link to="/about" className="text-green-100 hover:text-green-400 transition-colors">About Us</Link></li>
              <li><Link to="/products" className="text-green-100 hover:text-green-400 transition-colors">Products</Link></li>
              <li><Link to="/contact" className="text-green-100 hover:text-green-400 transition-colors">Contact</Link></li>
              <li><Link to="/faq" className="text-green-100 hover:text-green-400 transition-colors">FAQs</Link></li>
            </ul>
          </div>

          {/* Product Categories */}
          <div>
            <h3 className="font-serif text-lg font-bold mb-4 text-green-200">Products</h3>
            <ul className="space-y-2">
              {PRODUCT_LINKS.map(({ to, label }) => (
                <li key={to}>
                  <Link to={to} className="text-green-100 hover:text-green-400 transition-colors">{label}</Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Contact Information */}
          <div>
            <h3 className="font-serif text-lg font-bold mb-4 text-green-200">Contact Us</h3>
            <div className="space-y-4">
              <div className="flex items-start">
                <MapPin className="w-5 h-5 mr-2 mt-0.5 text-green-400" />
                <span className="text-green-100">Nagaranai, Sathyamangalam, Erode, Tamil Nadu, India</span>
              </div>
              <div className="flex items-center">
                <Phone className="w-5 h-5 mr-2 text-green-400" />
                <span className="text-green-100">+91 9597375091</span>
              </div>
              <div className="flex items-center">
                <Mail className="w-5 h-5 mr-2 text-green-400" />
                <span className="text-green-100">contact@grevyaindustries.com</span>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="border-t border-green-700 mt-12 pt-6 flex flex-col md:flex-row justify-between items-center">
          <p className="text-green-200 text-sm mb-4 md:mb-0">
            &copy; {new Date().getFullYear()} Grevya Industries Pvt Ltd. All rights reserved.
          </p>
          <div className="flex space-x-6">
            <Link to="/privacy" className="text-green-100 hover:text-green-400 text-sm transition-colors">Privacy Policy</Link>
            <Link to="/terms" className="text-green-100 hover:text-green-400 text-sm transition-colors">Terms of Service</Link>
            <Link to="/return-policy" className="text-green-100 hover:text-green-400 text-sm transition-colors">Return Policy</Link>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
