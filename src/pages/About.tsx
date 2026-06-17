import React from 'react';
import { motion } from 'framer-motion';
import { Leaf, Heart, Users, Globe, Shield, Award, Sparkles, Star, ArrowRight } from 'lucide-react';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';

const About = () => {
  const timelineEvents = [
    {
      year: '2021',
      title: 'The Seed of Change',
      desc: 'Discovered the untapped potential of fallen Areca palm leaves in Nagaranai village, starting with a humble workshop.',
    },
    {
      year: '2022',
      title: 'Empowering Communities',
      desc: 'Partnered with local self-help groups to train rural women, transforming sustainable crafting into stable, dignified livelihoods.',
    },
    {
      year: '2023',
      title: 'Zero-Waste Engineering',
      desc: 'Optimized our manufacturing cycle to achieve 100% zero-waste status, returning all organic residues back to the soil.',
    },
    {
      year: '2024',
      title: 'Global Footprint',
      desc: 'Expanding our product suite from local dining alternatives to international organic lifestyle and home collections.',
    },
  ];

  const philosophyItems = [
    {
      icon: Leaf,
      title: 'Pure Earth Sourced',
      desc: '100% naturally fallen palm leaves, bamboo, and clay. No trees are harmed, and no toxic chemicals are introduced.',
    },
    {
      icon: Users,
      title: 'Empowerment First',
      desc: 'Dedicated to generating mass employment for rural women artisans, ensuring fair wages, healthcare, and safe work environments.',
    },
    {
      icon: Globe,
      title: 'Circular Ecology',
      desc: 'Everything we take from nature is designed to return back to it. Fully biodegradable and home-compostable packaging.',
    },
    {
      icon: Shield,
      title: 'Premium Integrity',
      desc: 'We combine traditional Indian handcrafting techniques with rigorous quality testing to deliver high-performing organic luxury.',
    },
  ];

  const counters = [
    { value: '200+', label: 'Artisans Employed' },
    { value: '5M+', label: 'Plastic Plates Saved' },
    { value: '100%', label: 'Zero-Waste Cycle' },
    { value: '15+', label: 'Rural Villages Elevated' },
  ];

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: { staggerChildren: 0.15 },
    },
  };

  const itemVariants = {
    hidden: { y: 25, opacity: 0 },
    visible: {
      y: 0,
      opacity: 1,
      transition: { duration: 0.6, ease: [0.16, 1, 0.3, 1] as [number, number, number, number] },
    },
  };

  return (
    <div className="flex flex-col min-h-screen bg-[#FBF9F6] text-[#1D1E19]">
      <Navbar />

      <main className="flex-grow overflow-hidden">
        {/* NARRATIVE HERO WITH BOTANICAL OVERLAYS */}
        <section className="relative py-24 md:py-32 bg-gradient-to-b from-[#F7EEE4] via-[#FBF9F6] to-[#FBF9F6] overflow-hidden">
          {/* Decorative ambient elements */}
          <div className="absolute top-0 right-0 w-[45vw] h-[45vw] bg-[#33381C]/5 rounded-full blur-[100px] -translate-y-1/3 translate-x-1/4" />
          <div className="absolute bottom-0 left-0 w-[35vw] h-[35vw] bg-[#A68D65]/5 rounded-full blur-[80px] translate-y-1/3 -translate-x-1/4" />
          
          <div className="container mx-auto px-4 max-w-5xl relative z-10">
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] as [number, number, number, number] }}
              className="text-center"
            >
              <span className="text-xs uppercase tracking-[0.25em] font-bold text-[#A68D65] mb-4 inline-block">
                Our Heritage & Mission
              </span>
              <h1 className="font-serif text-5xl md:text-6xl font-bold text-[#33381C] leading-[1.1] mb-6 tracking-tight">
                Crafting luxury items <br className="hidden md:inline" />
                directly from the earth.
              </h1>
              <p className="text-base md:text-lg text-neutral-600 max-w-2xl mx-auto leading-relaxed font-medium">
                Grevya Naturals was born out of a simple, beautiful vision: to elevate local rural craftsmanship 
                and introduce zero-waste organic products to the modern household.
              </p>
            </motion.div>
          </div>
        </section>

        {/* TIMELINE SECTION (NAGARANAI COMMUNITY ORIGINS) */}
        <section className="py-20 bg-white border-y border-[#A68D65]/10">
          <div className="container mx-auto px-4 max-w-5xl">
            <div className="text-center mb-16">
              <span className="text-xs uppercase tracking-[0.25em] font-bold text-[#A68D65] mb-2 inline-block">
                Our Journey
              </span>
              <h2 className="font-serif text-3xl md:text-4xl font-bold text-[#33381C]">
                How we sprouted
              </h2>
            </div>

            <div className="relative border-l border-[#A68D65]/20 ml-4 md:ml-0 md:left-1/2 md:border-l-2 md:-translate-x-1/2 space-y-12 py-4">
              {timelineEvents.map((event, idx) => (
                <motion.div
                  key={event.year}
                  initial={{ opacity: 0, x: idx % 2 === 0 ? -40 : 40 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true, margin: '-100px' }}
                  transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] as [number, number, number, number] }}
                  className={`relative flex flex-col md:flex-row items-start ${
                    idx % 2 === 0 ? 'md:flex-row-reverse' : ''
                  }`}
                >
                  {/* Timeline Dot */}
                  <div className="absolute left-[-17px] top-1.5 md:left-1/2 md:-translate-x-1/2 w-8 h-8 rounded-full bg-[#F7EEE4] border-4 border-[#33381C] flex items-center justify-center z-10 shadow-sm">
                    <div className="w-2 h-2 rounded-full bg-[#A68D65]" />
                  </div>

                  {/* Empty spacer for alignment */}
                  <div className="hidden md:block w-1/2 px-12" />

                  {/* Event Card */}
                  <div className="w-full md:w-1/2 px-4 md:px-12">
                    <div className="p-6 rounded-2xl bg-[#FBF9F6] border border-[#A68D65]/10 shadow-xs hover:border-[#A68D65]/35 transition-all">
                      <span className="font-serif text-3xl font-extrabold text-[#A68D65] block mb-2">
                        {event.year}
                      </span>
                      <h3 className="text-lg font-bold text-[#33381C] mb-2">{event.title}</h3>
                      <p className="text-sm text-neutral-600 leading-relaxed font-medium">{event.desc}</p>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* FOUNDER'S VISION PANEL */}
        <section className="py-24 bg-[#F7EEE4]/30">
          <div className="container mx-auto px-4 max-w-5xl">
            <div className="grid md:grid-cols-2 gap-12 items-center">
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                transition={{ duration: 0.7 }}
                className="relative rounded-3xl overflow-hidden aspect-[4/5] bg-gradient-to-tr from-[#33381C] to-[#252814] p-8 flex flex-col justify-end text-white shadow-xl border border-[#A68D65]/20 group"
              >
                <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1542601906990-b4d3fb778b09?auto=format&fit=crop&q=80&w=1000')] bg-cover bg-center opacity-25 mix-blend-overlay" />
                <div className="absolute top-4 right-4 w-12 h-12 rounded-full border border-white/20 bg-white/5 backdrop-blur-sm flex items-center justify-center">
                  <Leaf className="w-6 h-6 text-[#A68D65] animate-pulse-orb" />
                </div>
                <div className="relative z-10 space-y-4">
                  <p className="text-lg font-serif italic text-[#F7EEE4] leading-relaxed">
                    &ldquo;Real change is created in the villages. By giving rural artisans the canvas to express their traditional crafts, we return the spotlight back to natural earth cycles.&rdquo;
                  </p>
                  <div>
                    <h4 className="font-bold text-base tracking-wide">The Grevya Foundation</h4>
                    <span className="text-xs text-[#A68D65] uppercase font-bold tracking-wider">Nagaranai, Tamil Nadu</span>
                  </div>
                </div>
              </motion.div>

              <div className="space-y-6">
                <span className="text-xs uppercase tracking-[0.25em] font-bold text-[#A68D65] block">
                  Founders Vision
                </span>
                <h2 className="font-serif text-3xl md:text-4xl font-bold text-[#33381C] leading-[1.2]">
                  Elevating livelihoods, honoring the earth
                </h2>
                <div className="text-neutral-600 space-y-4 text-sm font-medium leading-relaxed">
                  <p>
                    Grevya Naturals started as a response to two primary issues: the migration of rural craft talent to crowded cities, and the massive amount of single-use plastics building up in our ecosystems.
                  </p>
                  <p>
                    We realized that nature already provided the perfect solutions. The naturally fallen leaves of the areca palm tree can be molded into incredibly robust, organic, and compostable tableware, while maintaining full integrity.
                  </p>
                  <p>
                    Today, we collaborate with rural self-help groups, mostly run by women, keeping our production local to empower communities directly at their source.
                  </p>
                </div>
                
                {/* Simulated handwritten signature */}
                <div className="pt-4 border-t border-[#A68D65]/20 flex items-center justify-between">
                  <div>
                    <p className="font-serif text-xl font-bold text-[#33381C] italic tracking-wide">Grevya Team</p>
                    <p className="text-xs text-neutral-400 font-bold uppercase tracking-wider">Sustainable Design Leads</p>
                  </div>
                  <div className="flex gap-1.5">
                    <Star className="w-4 h-4 text-[#A68D65] fill-[#A68D65]" />
                    <Star className="w-4 h-4 text-[#A68D65] fill-[#A68D65]" />
                    <Star className="w-4 h-4 text-[#A68D65] fill-[#A68D65]" />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* IMPACT COUNTERS */}
        <section className="py-20 bg-[#33381C] text-white relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(ellipse_at_center,rgba(166,141,101,0.12),transparent_70%)] pointer-events-none" />
          
          <div className="container mx-auto px-4 max-w-5xl relative z-10">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-8 md:gap-4 text-center">
              {counters.map((counter, idx) => (
                <motion.div
                  key={idx}
                  initial={{ opacity: 0, y: 15 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.5, delay: idx * 0.1 }}
                  className="space-y-2"
                >
                  <h3 className="font-serif text-4xl md:text-5xl font-extrabold text-[#A68D65] tracking-tight">
                    {counter.value}
                  </h3>
                  <p className="text-xs md:text-sm text-[#F7EEE4]/80 font-bold uppercase tracking-wider">
                    {counter.label}
                  </p>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* INGREDIENT & MATERIAL PHILOSOPHY */}
        <section className="py-24 bg-white">
          <div className="container mx-auto px-4 max-w-5xl">
            <div className="text-center mb-16 space-y-2">
              <span className="text-xs uppercase tracking-[0.25em] font-bold text-[#A68D65] block">
                Pure Standards
              </span>
              <h2 className="font-serif text-3xl md:text-4xl font-bold text-[#33381C]">
                Our Ingredient Philosophy
              </h2>
              <p className="text-neutral-500 text-sm max-w-xl mx-auto font-medium">
                We guarantee clean materials and transparent sourcing methods for everything we create.
              </p>
            </div>

            <motion.div
              variants={containerVariants}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: '-100px' }}
              className="grid sm:grid-cols-2 gap-8"
            >
              {philosophyItems.map((item, idx) => {
                const IconComponent = item.icon;
                return (
                  <motion.div
                    key={idx}
                    variants={itemVariants}
                    className="p-8 rounded-3xl bg-[#FBF9F6] border border-[#A68D65]/10 hover:border-[#A68D65]/30 hover:bg-white hover:shadow-lg transition-all duration-300 flex items-start space-x-5"
                  >
                    <div className="p-3.5 bg-[#F7EEE4] rounded-2xl text-[#33381C] shrink-0">
                      <IconComponent className="w-6 h-6" />
                    </div>
                    <div className="space-y-2">
                      <h3 className="text-lg font-bold text-[#33381C]">{item.title}</h3>
                      <p className="text-sm text-neutral-600 leading-relaxed font-medium">
                        {item.desc}
                      </p>
                    </div>
                  </motion.div>
                );
              })}
            </motion.div>
          </div>
        </section>

        {/* SUSTAINABILITY STANDARD BADGES */}
        <section className="py-16 bg-[#FBF9F6] border-t border-[#A68D65]/10">
          <div className="container mx-auto px-4 max-w-4xl text-center">
            <h3 className="text-xs uppercase tracking-[0.2em] font-bold text-[#A68D65] mb-8">
              Certified Sustainable Sourcing
            </h3>
            <div className="flex flex-wrap items-center justify-center gap-8 md:gap-16 opacity-75">
              <div className="flex items-center space-x-2.5">
                <Award className="w-6 h-6 text-[#33381C]" />
                <span className="text-xs font-bold text-[#33381C] uppercase tracking-wider">100% Biobased</span>
              </div>
              <div className="flex items-center space-x-2.5">
                <Leaf className="w-6 h-6 text-[#33381C]" />
                <span className="text-xs font-bold text-[#33381C] uppercase tracking-wider">Compostable</span>
              </div>
              <div className="flex items-center space-x-2.5">
                <Sparkles className="w-6 h-6 text-[#33381C]" />
                <span className="text-xs font-bold text-[#33381C] uppercase tracking-wider">Chemical Free</span>
              </div>
              <div className="flex items-center space-x-2.5">
                <Users className="w-6 h-6 text-[#33381C]" />
                <span className="text-xs font-bold text-[#33381C] uppercase tracking-wider">Fair Wage Certified</span>
              </div>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
};

export default About;
