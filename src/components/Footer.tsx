'use client';

import React from 'react';
import Link from 'next/link';
import { Bot, Shield, Zap,  Globe, ArrowUpRight } from 'lucide-react';

export function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="min-w-0 border-t border-slate-200/80 dark:border-slate-800/80 bg-white/80 dark:bg-slate-950/80 backdrop-blur-xl text-slate-500 dark:text-slate-400 text-xs mt-auto relative z-20">
      <div className="max-w-7xl mx-auto min-w-0 px-4 sm:px-6 lg:px-8 pt-12 pb-28 sm:pb-16">
        <div className="grid min-w-0 grid-cols-1 md:grid-cols-4 gap-8 lg:gap-12 mb-12">
          {/* Brand Col */}
          <div className="min-w-0 space-y-4 md:col-span-1">
            <Link href="/" className="flex min-w-0 max-w-full items-center gap-3 group inline-flex">
              <div className="w-9 h-9 rounded-xl overflow-hidden shrink-0 border border-slate-200 dark:border-slate-700 shadow-sm group-hover:scale-105 transition-transform bg-white">
                <img
                  src="/favicon.png"
                  alt="SiteBot Studio Logo"
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    (e.target as HTMLElement).style.display = 'none';
                  }}
                />
              </div>
              <div className="min-w-0">
                <span className="text-sm font-extrabold text-slate-900 dark:text-white block font-heading tracking-tight group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors break-words">
                  SiteBot Studio
                </span>
                <span className="text-[11px] text-slate-400 dark:text-slate-500 font-medium block break-words">
                  AI Chatbot &amp; Agent Platform
                </span>
              </div>
            </Link>

            <p className="min-w-0 text-xs text-slate-500 dark:text-slate-400 leading-relaxed pr-2 break-words">
              Autonomous AI chatbots with Shadow DOM zero-leak CSS, dynamic web crawling, multi-model vector RAG, and live human agent handoff.
            </p>

            <div className="inline-flex max-w-full flex-wrap items-center gap-2 px-2.5 py-1 rounded-full bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800/80 text-[11px] font-semibold text-emerald-700 dark:text-emerald-300">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span>All Systems Operational</span>
            </div>
          </div>

          {/* Product Links */}
          <div className="min-w-0">
            <h3 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider mb-4 font-heading">
              Platform &amp; Tools
            </h3>
            <ul className="min-w-0 space-y-2.5 font-medium">
              <li>
                <Link href="/" className="hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors min-w-0 break-words">
                  Home
                </Link>
              </li>
              <li>
                <Link href="/create" className="hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors min-w-0 break-words flex items-center gap-1.5">
                  <span>Create AI Bot</span>
                  <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-indigo-50 dark:bg-indigo-950/80 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800">
                    New
                  </span>
                </Link>
              </li>
              <li>
                <Link href="/dashboard" className="hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors min-w-0 break-words">
                  User Dashboard
                </Link>
              </li>
              <li>
                <Link href="/pricing" className="hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors min-w-0 break-words">
                  Plans &amp; Pricing
                </Link>
              </li>
              <li>
                <Link href="/help" className="hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors min-w-0 break-words">
                  Help &amp; Integration Guide
                </Link>
              </li>
            </ul>
          </div>

          {/* Company & Support */}
          <div className="min-w-0">
            <h3 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider mb-4 font-heading">
              Company &amp; Resources
            </h3>
            <ul className="min-w-0 space-y-2.5 font-medium">
              <li>
                <Link href="/about" className="hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors min-w-0 break-words">
                  About SiteBot Studio
                </Link>
              </li>
              <li>
                <Link href="/contact" className="hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors min-w-0 break-words">
                  Contact &amp; Support
                </Link>
              </li>
              <li>
                <Link href="/terms" className="hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors min-w-0 break-words">
                  Terms of Service
                </Link>
              </li>
              <li>
                <Link href="/privacy" className="hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors min-w-0 break-words">
                  Privacy Policy
                </Link>
              </li>
              <li>
                <Link href="/admin" className="hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors min-w-0 break-words flex items-center gap-1">
                  <span>Admin Panel</span>
                  <Shield className="w-3 h-3 text-rose-500" />
                </Link>
              </li>
              <li>
                <a
                  href="https://sitebotstudio.app"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors min-w-0 break-words inline-flex items-center gap-1"
                >
                  <span>Production Status</span>
                  <ArrowUpRight className="w-3 h-3" />
                </a>
              </li>
            </ul>
          </div>

          {/* Architecture Highlights */}
          <div className="min-w-0 space-y-3">
            <h3 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider mb-4 font-heading">
              Technology Stack
            </h3>
            <div className="space-y-2 text-[11px] text-slate-500 dark:text-slate-400">
              <div className="flex min-w-0 items-start gap-2">
                <Bot className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                <span className="min-w-0 break-words">Multi-Model (Gemini 2.5, GPT-4o, Llama 3.3)</span>
              </div>
              <div className="flex min-w-0 items-start gap-2">
                <Globe className="w-3.5 h-3.5 text-purple-500 shrink-0" />
                <span className="min-w-0 break-words">Open Shadow DOM Component Isolation</span>
              </div>
              <div className="flex min-w-0 items-start gap-2">
                <Zap className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                <span className="min-w-0 break-words">Qdrant Cloud &amp; Hybrid Vector Memory</span>
              </div>
              <div className="flex min-w-0 items-start gap-2">
                <Shield className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                <span className="min-w-0 break-words">Anti-Prompt Injection &amp; Domain Guardrails</span>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="min-w-0 pt-8 border-t border-slate-200/60 dark:border-slate-800/60 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex min-w-0 flex-wrap items-center justify-center gap-2 text-[11px] text-slate-400 dark:text-slate-500">
            <span className="min-w-0 break-words">&copy; {currentYear} SiteBot Studio. All rights reserved.</span>
          </div>

          <div className="flex min-w-0 flex-wrap items-center justify-center gap-x-6 gap-y-2 text-[11px] font-semibold text-slate-500 dark:text-slate-400">
            <Link href="/privacy" className="hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors min-w-0 break-words">
              Privacy Policy
            </Link>
            <Link href="/terms" className="hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors min-w-0 break-words">
              Terms of Service
            </Link>
            <Link href="/contact" className="hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors min-w-0 break-words">
              Security &amp; Support
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
