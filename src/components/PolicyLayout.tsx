import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, Compass, BookOpen, Clock, ArrowRight } from 'lucide-react';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';

interface PolicyLayoutProps {
  title: string;
  updated?: string;
  children: React.ReactNode;
}

interface SectionInfo {
  id: string;
  title: string;
}

const PolicyLayout = ({ title, updated, children }: PolicyLayoutProps) => {
  const [sections, setSections] = useState<SectionInfo[]>([]);
  const [activeSectionId, setActiveSectionId] = useState<string>('');
  const [readingProgress, setReadingProgress] = useState(0);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);

  // Parse children H2 headers to generate Table of Contents
  useEffect(() => {
    if (!contentRef.current) return;

    const h2s = contentRef.current.getElementsByTagName('h2');
    const items: SectionInfo[] = [];

    Array.from(h2s).forEach((h2, idx) => {
      const originalText = h2.textContent || '';
      const cleanId = `section-${originalText.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${idx}`;
      h2.id = cleanId;
      items.push({ id: cleanId, title: originalText });
    });

    setSections(items);

    if (items.length > 0) {
      setActiveSectionId(items[0].id);
    }

    // Scroll & Intersection Observer to track active section
    const observerCallback = (entries: IntersectionObserverEntry[]) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          setActiveSectionId(entry.target.id);
        }
      });
    };

    const observerOptions = {
      root: null,
      rootMargin: '-15% 0px -70% 0px',
      threshold: 0,
    };

    const observer = new IntersectionObserver(observerCallback, observerOptions);
    Array.from(h2s).forEach((h2) => observer.observe(h2));

    // Scroll progress handler
    const handleScroll = () => {
      const scrollHeight = document.documentElement.scrollHeight - window.innerHeight;
      if (scrollHeight > 0) {
        setReadingProgress((window.scrollY / scrollHeight) * 100);
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });

    return () => {
      observer.disconnect();
      window.removeEventListener('scroll', handleScroll);
    };
  }, [children]);

  // Dynamically update active H2 style to slide and grow a forest green underline
  useEffect(() => {
    if (!contentRef.current) return;
    const h2s = contentRef.current.getElementsByTagName('h2');
    Array.from(h2s).forEach((h2) => {
      const isActive = h2.id === activeSectionId;
      h2.className = `font-serif text-2xl md:text-3xl font-bold mt-12 mb-6 pb-3 border-b scroll-mt-28 flex items-center transition-all duration-500 ease-premium ${
        isActive 
          ? 'text-[#33381C] border-[#33381C] translate-x-1 shadow-[inset_0_-2px_0_0_#33381C] pl-3' 
          : 'text-[#33381C]/75 border-[#A68D65]/15 pl-0'
      }`;
    });
  }, [activeSectionId, sections]);

  // Smooth scroll to target section
  const handleScrollTo = (id: string) => {
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      setIsMobileMenuOpen(false);
    }
  };

  return (
    <div className="flex flex-col min-h-screen bg-[#FBF9F6] text-[#1D1E19] overflow-x-hidden">
      <Navbar />

      {/* READING PROGRESS INDICATOR BAR */}
      <div className="fixed top-0 left-0 w-full h-1.5 z-50 bg-[#EAE2D5]">
        <motion.div
          className="h-full bg-gradient-to-r from-[#A68D65] to-[#33381C]"
          style={{ width: `${readingProgress}%` }}
        />
      </div>

      <main className="flex-grow pt-16 pb-28 relative">
        {/* Layered Blurred Ambient backgrounds */}
        <div className="absolute top-16 left-1/4 w-[600px] h-[600px] bg-gradient-radial from-[#A68D65]/8 to-transparent rounded-full blur-[120px] pointer-events-none animate-pulse-orb" style={{ animationDuration: '24s' }} />
        <div className="absolute top-1/3 right-1/4 w-[700px] h-[700px] bg-gradient-radial from-[#33381C]/5 to-transparent rounded-full blur-[140px] pointer-events-none animate-pulse-orb" style={{ animationDuration: '30s', animationDelay: '-6s' }} />
        <div className="absolute bottom-16 left-1/3 w-[500px] h-[500px] bg-gradient-radial from-[#A68D65]/6 to-transparent rounded-full blur-[100px] pointer-events-none animate-pulse-orb" style={{ animationDuration: '28s', animationDelay: '-12s' }} />

        <div className="container mx-auto px-4 max-w-7xl relative z-10">
          
          {/* Header Panel */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.65, ease: [0.16, 1, 0.3, 1] }}
            className="mb-14 border-b border-[#A68D65]/12 pb-8 max-w-4xl"
          >
            <span className="text-[10px] uppercase tracking-[0.3em] font-extrabold text-[#A68D65] mb-3 inline-block">
              Grevya Integrity & Policies
            </span>
            <h1 className="font-serif text-4xl md:text-5xl lg:text-6xl font-bold text-[#33381C] tracking-tight">
              {title}
            </h1>
            {updated && (
              <div className="flex items-center gap-1.5 mt-4 text-xs text-neutral-400 font-bold">
                <Clock className="w-3.5 h-3.5 text-[#A68D65]" />
                <span>Last updated: {updated}</span>
              </div>
            )}
          </motion.div>

          {/* MOBILE TOC FLOATING NAVIGATOR */}
          {sections.length > 0 && (
            <div className="lg:hidden mb-6 z-30 sticky top-20">
              <button
                onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                className="w-full liquid-glass border-[#A68D65]/25 rounded-2xl py-3.5 px-5 flex items-center justify-between text-xs font-bold text-[#33381C] shadow-md select-none"
              >
                <span className="flex items-center">
                  <Compass className="w-4 h-4 mr-2 text-[#A68D65]" />
                  {sections.find((s) => s.id === activeSectionId)?.title || 'Navigate Sections'}
                </span>
                <ChevronDown className={`w-4 h-4 text-[#A68D65] transition-transform duration-300 ${isMobileMenuOpen ? 'rotate-180' : ''}`} />
              </button>
              
              <AnimatePresence>
                {isMobileMenuOpen && (
                  <motion.div
                    initial={{ opacity: 0, y: -8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    className="absolute left-0 right-0 mt-1.5 rounded-2xl bg-white border border-[#A68D65]/20 shadow-xl overflow-hidden p-2 space-y-1 z-40 max-h-60 overflow-y-auto no-scrollbar"
                  >
                    {sections.map((sect) => (
                      <button
                        key={sect.id}
                        onClick={() => handleScrollTo(sect.id)}
                        className={`w-full text-left px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all block ${
                          activeSectionId === sect.id
                            ? 'bg-[#33381C] text-[#F7EEE4]'
                            : 'hover:bg-[#F7EEE4]/50 text-neutral-600'
                        }`}
                      >
                        {sect.title}
                      </button>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}

          {/* DOUBLE-PANE MAIN LAYOUT */}
          <div className="grid lg:grid-cols-[260px_1fr] gap-12 lg:gap-16 items-start">
            
            {/* LEFT COLUMN: STICKY TOC NAVIGATION */}
            {sections.length > 0 && (
              <aside className="hidden lg:block sticky top-28 self-start">
                <div className="liquid-glass rounded-3xl p-5.5 shadow-md space-y-4">
                  <h3 className="text-[10px] font-extrabold text-neutral-400 uppercase tracking-widest flex items-center mb-1">
                    <BookOpen className="w-3.5 h-3.5 mr-1.5 text-[#A68D65]" /> Document Sections
                  </h3>
                  <div className="flex flex-col space-y-1 relative">
                    {sections.map((sect) => {
                      const isActive = activeSectionId === sect.id;
                      return (
                        <button
                          key={sect.id}
                          onClick={() => handleScrollTo(sect.id)}
                          className={`relative text-left py-2.5 px-4 rounded-xl text-xs font-bold transition-all flex items-center group cursor-pointer ${
                            isActive 
                              ? 'text-[#33381C] bg-[#F7EEE4] shadow-xs' 
                              : 'text-neutral-500 hover:text-[#33381C] hover:translate-x-1.5'
                          }`}
                        >
                          {isActive && (
                            <motion.div
                              layoutId="activeTOCIndicator"
                              className="absolute left-0 w-1 h-1/2 bg-[#33381C] rounded-full"
                              transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                            />
                          )}
                          <span className="truncate">{sect.title}</span>
                          {!isActive && (
                            <ArrowRight className="w-3 h-3 ml-auto opacity-0 group-hover:opacity-100 text-[#A68D65] transition-all transform translate-x-[-4px] group-hover:translate-x-0" />
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </aside>
            )}

            {/* RIGHT COLUMN: MAIN CONTENT PANEL */}
            <motion.div
              initial={{ opacity: 0, x: 15 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.65, delay: 0.1 }}
              ref={contentRef}
              id="policy-content"
              className="liquid-glass rounded-[2.5rem] p-8 md:p-14 shadow-lg space-y-7 text-[#1D1E19]/90 text-sm md:text-base leading-relaxed font-medium max-w-4xl"
            >
              {children}
            </motion.div>

          </div>

        </div>
      </main>

      <Footer />
    </div>
  );
};

export default PolicyLayout;
