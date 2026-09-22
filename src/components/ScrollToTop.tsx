'use client';

import React, { useState, useEffect } from 'react';
import { ChevronUp } from 'lucide-react';

export function ScrollToTop() {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      // Appear once scrolled down past 260px
      if (window.scrollY > 260) {
        setIsVisible(true);
      } else {
        setIsVisible(false);
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll();

    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const scrollToTop = () => {
    window.scrollTo({
      top: 0,
      behavior: 'smooth',
    });
  };

  if (!isVisible) return null;

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 pointer-events-auto transition-all duration-300 animate-in fade-in slide-in-from-bottom-3 duration-200">
      <button
        onClick={scrollToTop}
        aria-label="Scroll to top of page"
        title="Scroll to top"
        className="group flex items-center gap-1.5 px-4 py-2 rounded-full bg-slate-950/90 dark:bg-white/95 text-white dark:text-slate-900 shadow-xl shadow-indigo-600/25 hover:shadow-indigo-600/40 border border-slate-700/60 dark:border-slate-200/90 backdrop-blur-xl transition-all duration-200 hover:-translate-y-1 active:scale-95 cursor-pointer"
      >
        <ChevronUp className="w-4 h-4 stroke-[2.5] text-indigo-400 dark:text-indigo-600 group-hover:-translate-y-0.5 transition-transform duration-200" />
        <span className="text-xs font-bold tracking-wide">Top</span>
      </button>
    </div>
  );
}
