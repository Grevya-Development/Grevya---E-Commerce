import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { toast } from '@/components/ui/use-toast';
import { AspectRatio } from '@/components/ui/aspect-ratio';
import { Star, ShoppingCart, Package, Leaf, TruckIcon, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import { productImages } from '@/lib/product-images';
import { ProductProps } from '@/components/ProductCard';

const ProductDetail = () => {
  const { category, slug } = useParams();
  const [product, setProduct] = useState<ProductProps | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [loading, setLoading] = useState(true);

  // This should be replaced with actual cart state management
  const addToCart = () => {
    toast({
      title: "Added to cart",
      description: `${quantity} × ${product?.name} added to your cart`,
    });
  };

  useEffect(() => {
    // In a real app, this would be an API call
    // For now, we'll simulate finding the product based on slug
    setLoading(true);
    
    // All products data (removed Bowls and Trays)
    const allProducts = [
      // Areca Products
      {
        id: 1,
        name: "Premium Areca Leaf Plates (10\")",
        price: 249.00,
        rating: 4.5,
        image: productImages.areca.plates,
        category: "areca",
        featured: true,
        slug: "premium-areca-plates-10-inch"
      },
      {
        id: 2,
        name: "Areca Dinnerware Set",
        price: 599.00,
        rating: 4.7,
        image: productImages.areca.dinnerware,
        category: "areca",
        slug: "areca-dinnerware-set"
      },
      // Natural Products
      {
        id: 3,
        name: "Organic Tomato Powder (100g)",
        price: 199.00,
        rating: 4.2,
        image: productImages.natural.tomatoPowder,
        category: "natural",
        featured: true,
        slug: "organic-tomato-powder-100g"
      },
      {
        id: 4,
        name: "Pure Coconut Oil (500ml)",
        price: 350.00,
        rating: 4.9,
        image: productImages.natural.coconutOil,
        category: "natural",
        featured: true,
        slug: "pure-coconut-oil-500ml"
      },
      {
        id: 5,
        name: "Natural Henna Powder (200g)",
        price: 180.00,
        rating: 4.3,
        image: productImages.natural.henna,
        category: "natural",
        slug: "natural-henna-powder-200g"
      },
      {
        id: 6,
        name: "Indigo Powder (100g)",
        price: 220.00,
        rating: 4.4,
        image: productImages.natural.indigoPowder,
        category: "natural",
        slug: "indigo-powder-100g"
      },
    ];
    
    const foundProduct = allProducts.find(
      (p) => p.slug === slug && p.category === category
    );
    
    setProduct(foundProduct || null);
    setLoading(false);
  }, [category, slug]);

  if (loading) {
    return (
      <div className="flex flex-col min-h-screen">
        <Navbar />
        <main className="flex-grow bg-cream/30 py-16">
          <div className="container mx-auto px-4">
            <div className="animate-pulse">
              <div className="h-8 bg-gray-200 rounded w-1/3 mb-4"></div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="bg-gray-200 h-96 rounded-lg"></div>
                <div>
                  <div className="h-8 bg-gray-200 rounded w-2/3 mb-4"></div>
                  <div className="h-4 bg-gray-200 rounded w-1/2 mb-6"></div>
                  <div className="h-6 bg-gray-200 rounded w-1/4 mb-8"></div>
                  <div className="h-32 bg-gray-200 rounded mb-6"></div>
                  <div className="h-12 bg-gray-200 rounded w-2/3"></div>
                </div>
              </div>
            </div>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  if (!product) {
    return (
      <div className="flex flex-col min-h-screen">
        <Navbar />
        <main className="flex-grow bg-cream/30 py-16">
          <div className="container mx-auto px-4 text-center py-16">
            <h2 className="text-2xl font-bold text-brown-800 mb-4">Product Not Found</h2>
            <p className="text-brown-600 mb-8">The product you're looking for doesn't exist or has been removed.</p>
            <Button asChild>
              <Link to="/products">Browse All Products</Link>
            </Button>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen">
      <Navbar />
      <main className="flex-grow bg-cream/30">
        <div className="container mx-auto px-4 py-16">
          <Link to="/products" className="inline-flex items-center text-brown-600 hover:text-green-700 mb-8">
            <ArrowLeft className="h-4 w-4 mr-1" />
            Back to Products
          </Link>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
            {/* Product Image */}
            <div>
              <AspectRatio ratio={1 / 1} className="bg-white rounded-lg overflow-hidden border border-gray-200">
                <img 
                  src={product.image} 
                  alt={product.name}
                  className="object-contain h-full w-full"
                />
              </AspectRatio>
            </div>
            
            {/* Product Details */}
            <div>
              {product.featured && (
                <span className="inline-block bg-brown-500 text-white text-xs px-2 py-1 rounded-full mb-3">
                  Featured Product
                </span>
              )}
              <h1 className="text-3xl font-bold text-brown-800 mb-2">{product.name}</h1>
              
              <div className="flex items-center mb-4">
                <div className="flex">
                  {[...Array(5)].map((_, i) => (
                    <Star
                      key={i}
                      size={16}
                      fill={i < product.rating ? "#FFA500" : "none"}
                      stroke={i < product.rating ? "#FFA500" : "#C0C0C0"}
                      className="mr-0.5"
                    />
                  ))}
                </div>
                <span className="text-sm text-gray-500 ml-2">({Math.floor(Math.random() * 50) + 5} reviews)</span>
              </div>
              
              <p className="text-2xl font-semibold text-green-700 mb-6">₹{product.price.toFixed(2)}</p>
              
              <div className="prose prose-green mb-6">
                <p className="text-brown-600">
                  {product.category === 'areca' 
                    ? 'Made from 100% natural fallen areca palm leaves, this eco-friendly product is biodegradable, chemical-free, and perfect for serving food while reducing plastic waste.' 
                    : 'Sourced from local farms using traditional methods, our natural products are organic, chemical-free, and ethically harvested to ensure the highest quality and sustainability.'}
                </p>
              </div>
              
              <div className="flex flex-col space-y-3 mb-6">
                <div className="flex items-center text-brown-600">
                  <Package className="h-5 w-5 mr-2 text-green-700" />
                  <span>In stock and ready to ship</span>
                </div>
                <div className="flex items-center text-brown-600">
                  <Leaf className="h-5 w-5 mr-2 text-green-700" />
                  <span>100% Eco-friendly and biodegradable</span>
                </div>
                <div className="flex items-center text-brown-600">
                  <TruckIcon className="h-5 w-5 mr-2 text-green-700" />
                  <span>Free shipping on orders over ₹500</span>
                </div>
              </div>
              
              <div className="flex items-center space-x-4 mb-8">
                <div className="border border-gray-300 rounded-md flex items-center">
                  <button 
                    className="px-3 py-1 text-lg"
                    onClick={() => setQuantity(Math.max(1, quantity - 1))}
                    disabled={quantity <= 1}
                  >
                    -
                  </button>
                  <span className="px-3 py-1 border-l border-r border-gray-300">
                    {quantity}
                  </span>
                  <button 
                    className="px-3 py-1 text-lg"
                    onClick={() => setQuantity(quantity + 1)}
                  >
                    +
                  </button>
                </div>
                <Button 
                  className="flex-1 flex items-center justify-center"
                  onClick={addToCart}
                >
                  <ShoppingCart className="h-5 w-5 mr-2" />
                  Add to Cart
                </Button>
              </div>
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default ProductDetail;
