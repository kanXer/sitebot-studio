'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { usePathname } from 'next/navigation';
import { ChevronUp } from 'lucide-react';
import { useAuth } from '@/lib/firebase/AuthContext';

export function ScrollToTop() {
  const [progress, setProgress] = useState(0);
  const pathname = usePathname();
  const { user } = useAuth();

  // Scroll to top on route change
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' });
  }, [pathname]);

  useEffect(() => {
    const handleScroll = () => {
      const doc = document.documentElement;
      const max = doc.scrollHeight - window.innerHeight;
      const scrollY = window.scrollY || doc.scrollTop;
      const pct = max > 0 ? Math.min(100, Math.max(0, Math.round((scrollY / max) * 100))) : 0;
      setProgress(scrollY > 200 ? pct : 0);
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    window.addEventListener('resize', handleScroll, { passive: true });
    handleScroll();

    return () => {
      window.removeEventListener('scroll', handleScroll);
      window.removeEventListener('resize', handleScroll);
    };
  }, []);

  const scrollToTop = useCallback(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  // Don't render if at top of page or on live widget demo sandbox pages
  if (progress <= 0 || pathname?.startsWith('/demo/')) return null;

  const diameter = 46;
  const stroke = 4;
  const radius = (diameter - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const dashOffset = circumference * (1 - progress / 100);

  return (
    <div className={`fixed right-4 sm:right-7 z-40 pointer-events-auto animate-in fade-in slide-in-from-bottom-2 ${user ? 'bottom-[96px]' : 'bottom-6'} md:bottom-6`}>
      <button
        onClick={scrollToTop}
        aria-label={`Scroll to top of page (${progress}%)`}
        title="Scroll to top"
        className="group flex items-center justify-center rounded-full bg-slate-900/95 dark:bg-white/95 shadow-xl shadow-slate-950/25 hover:shadow-indigo-500/40 border border-slate-700/60 dark:border-slate-200/90 backdrop-blur-xl transition-all duration-200 hover:-translate-y-0.5 active:scale-95 cursor-pointer"
        style={{ width: diameter, height: diameter }}
      >
        <svg width={diameter} height={diameter} className="absolute inset-0 -rotate-90">
          <circle
            cx={diameter / 2}
            cy={diameter / 2}
            r={radius}
            fill="none"
            stroke="rgba(148, 163, 184, 0.25)"
            strokeWidth={stroke}
          />
          <circle
            cx={diameter / 2}
            cy={diameter / 2}
            r={radius}
            fill="none"
            stroke="url(#sitebotTopGradient)"
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={dashOffset}
            className="transition-[stroke-dashoffset] duration-150 ease-out"
          />
          <defs>
            <linearGradient id="sitebotTopGradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#6366f1" />
              <stop offset="100%" stopColor="#c026d3" />
            </linearGradient>
          </defs>
        </svg>
        <span className="flex flex-col items-center leading-none text-slate-100 dark:text-slate-900">
          <ChevronUp className="w-3 h-3 stroke-[3] text-indigo-400 dark:text-indigo-600 group-hover:-translate-y-0.5 transition-transform duration-200" />
          <span className="text-[9px] font-extrabold">{progress}%</span>
        </span>
      </button>
    </div>
  );
}