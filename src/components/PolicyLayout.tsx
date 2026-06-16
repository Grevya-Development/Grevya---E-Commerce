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
      // Generate clean ID
      const cleanId = `section-${originalText.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${idx}`;
      h2.id = cleanId;
      
      // Update h2 styles to match our luxury layout
      h2.className = "font-serif text-2xl font-bold text-[#33381C] mt-10 mb-4 pb-2 border-b border-[#A68D65]/20 scroll-mt-24 flex items-center";
      
      items.push({ id: cleanId, title: originalText });
    });

    setSections(items);

    // Set active section on load
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
      rootMargin: '-15% 0px -75% 0px',
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

  // Smooth scroll to target section
  const handleScrollTo = (id: string) => {
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      setIsMobileMenuOpen(false);
    }
  };

  return (
    <div className="flex flex-col min-h-screen bg-[#FBF9F6] text-[#1D1E19]">
      <Navbar />

      {/* READING PROGRESS INDICATOR BAR */}
      <div className="fixed top-0 left-0 w-full h-1 z-50 bg-[#EAE2D5]">
        <motion.div
          className="h-full bg-[#33381C]"
          style={{ width: `${readingProgress}%` }}
        />
      </div>

      <main className="flex-grow pt-12 pb-24 relative">
        {/* Background Ambient Glow */}
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[60vw] h-[35vw] bg-gradient-to-tr from-[#A68D65]/5 to-[#33381C]/5 rounded-full blur-[100px] pointer-events-none" />

        <div className="container mx-auto px-4 max-w-6xl relative z-10">
          
          {/* Header Panel */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] as [number, number, number, number] }}
            className="mb-12 border-b border-[#A68D65]/10 pb-8"
          >
            <span className="text-xs uppercase tracking-[0.25em] font-bold text-[#A68D65] mb-2.5 inline-block">
              Grevya Integrity & Policies
            </span>
            <h1 className="font-serif text-4xl md:text-5xl font-bold text-[#33381C] tracking-tight">
              {title}
            </h1>
            {updated && (
              <div className="flex items-center gap-1.5 mt-3 text-xs text-neutral-400 font-bold">
                <Clock className="w-3.5 h-3.5" />
                <span>Last updated: {updated}</span>
              </div>
            )}
          </motion.div>

          {/* MOBILE TOC FLOATING NAVIGATOR */}
          {sections.length > 0 && (
            <div className="lg:hidden mb-6 z-30 sticky top-16">
              <button
                onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                className="w-full bg-[#F7EEE4] border border-[#A68D65]/25 rounded-2xl py-3 px-4 flex items-center justify-between text-xs font-bold text-[#33381C] shadow-sm select-none"
              >
                <span className="flex items-center">
                  <Compass className="w-4 h-4 mr-2 text-[#A68D65]" />
                  {sections.find((s) => s.id === activeSectionId)?.title || 'Navigate Sections'}
                </span>
                <ChevronDown className={`w-4 h-4 transition-transform duration-300 ${isMobileMenuOpen ? 'rotate-180' : ''}`} />
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
          <div className="grid lg:grid-cols-[250px_1fr] gap-12 items-start">
            
            {/* LEFT COLUMN: STICKY TOC NAVIGATION */}
            {sections.length > 0 && (
              <aside className="hidden lg:block sticky top-24 self-start">
                <div className="rounded-3xl bg-white/60 backdrop-blur-md border border-[#A68D65]/15 p-5 shadow-xs space-y-4">
                  <h3 className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest flex items-center">
                    <BookOpen className="w-3.5 h-3.5 mr-1.5 text-[#A68D65]" /> Document Sections
                  </h3>
                  <div className="flex flex-col space-y-1 relative">
                    {sections.map((sect) => {
                      const isActive = activeSectionId === sect.id;
                      return (
                        <button
                          key={sect.id}
                          onClick={() => handleScrollTo(sect.id)}
                          className={`relative text-left py-2 px-3.5 rounded-xl text-xs font-bold transition-all flex items-center group cursor-pointer ${
                            isActive 
                              ? 'text-[#33381C] bg-[#F7EEE4] shadow-2xs' 
                              : 'text-neutral-500 hover:text-[#33381C] hover:translate-x-1'
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
                            <ArrowRight className="w-3 h-3 ml-auto opacity-0 group-hover:opacity-150 text-[#A68D65] transition-all" />
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
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.6, delay: 0.15 }}
              ref={contentRef}
              id="policy-content"
              className="bg-white/70 backdrop-blur-md rounded-[2.5rem] border border-[#A68D65]/15 p-8 md:p-12 shadow-sm space-y-6 text-[#1D1E19]/90 text-sm md:text-base leading-relaxed font-medium"
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
