
import React from 'react';
import { Star } from 'lucide-react';

const testimonials = [
  {
    id: 1,
    name: "Priya Sharma",
    role: "Event Planner",
    content: "We used Grevya's areca plates for our sustainable corporate event and received many compliments. The quality is excellent and knowing they're eco-friendly made them an even better choice.",
    rating: 5,
    image: "https://randomuser.me/api/portraits/women/32.jpg",
  },
  {
    id: 2,
    name: "Rahul Mehta",
    role: "Restaurant Owner",
    content: "Since switching to Grevya's biodegradable dinnerware, our customers have been impressed with our commitment to sustainability. The products are sturdy and look premium.",
    rating: 5,
    image: "https://randomuser.me/api/portraits/men/22.jpg",
  },
  {
    id: 3,
    name: "Amina Patel",
    role: "Wellness Coach",
    content: "The natural henna and coconut oil from Grevya are pure and effective. I recommend these products to all my clients who are looking for chemical-free alternatives.",
    rating: 4,
    image: "https://randomuser.me/api/portraits/women/46.jpg",
  },
];

const Testimonials = () => {
  return (
    <section className="py-16 bg-white">
      <div className="container mx-auto px-4">
        <h2 className="section-heading text-center">What Our Customers Say</h2>
        <p className="text-brown-600 text-center max-w-2xl mx-auto mb-12">
          Don't just take our word for it. Here's what our customers have to say about our eco-friendly products.
        </p>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {testimonials.map((testimonial) => (
            <div key={testimonial.id} className="bg-cream rounded-lg p-6 shadow-sm">
              <div className="flex items-center mb-4">
                <img 
                  src={testimonial.image} 
                  alt={testimonial.name} 
                  className="w-12 h-12 rounded-full mr-4 object-cover"
                />
                <div>
                  <h4 className="font-medium text-brown-800">{testimonial.name}</h4>
                  <p className="text-sm text-brown-600">{testimonial.role}</p>
                </div>
              </div>
              <div className="mb-4">
                {[...Array(5)].map((_, i) => (
                  <Star
                    key={i}
                    size={16}
                    className="inline mr-1"
                    fill={i < testimonial.rating ? "#FFA500" : "none"}
                    stroke={i < testimonial.rating ? "#FFA500" : "#C0C0C0"}
                  />
                ))}
              </div>
              <p className="text-brown-700 italic">"{testimonial.content}"</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default Testimonials;
