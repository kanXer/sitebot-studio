'use client';

import React, { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, ExternalLink, Shield, Zap, Star, Bot } from 'lucide-react';
import { useAuth } from '@/lib/firebase/AuthContext';

export default function DemoSandboxPage() {
  const params = useParams();
  const botId = params?.id as string;
  const { user } = useAuth();
  const [bot, setBot] = useState<any>(null);

  useEffect(() => {
    if (!botId) return;

    const headers: Record<string, string> = {};
    if (user?.email) headers['x-user-email'] = user.email;
    if (user?.uid) headers['x-user-id'] = user.uid;

    fetch(`/api/bot/${botId}`, { headers })
      .then(async (res) => {
        if (res.ok) return res.json();
        // Fallback to public widget configuration endpoint
        const pubRes = await fetch(`/api/chat/${botId}`, {
          headers: { 'x-sitebot-preview': 'true' },
        });
        if (pubRes.ok) {
          const pubData = await pubRes.json();
          return { bot: pubData };
        }
        return null;
      })
      .then((data) => {
        if (data?.bot) setBot(data.bot);
      })
      .catch(console.error);

    const script = document.createElement('script');
    script.src = '/widget.js';
    script.setAttribute('data-bot-id', botId);
    script.setAttribute('data-preview', 'true');
    script.defer = true;
    document.body.appendChild(script);

    return () => {
      const existingRoot = document.getElementById(`sitebot-studio-root-${botId}`);
      if (existingRoot) existingRoot.remove();
      if (script.parentNode) script.parentNode.removeChild(script);
    };
  }, [botId, user?.email, user?.uid]);

  return (
    <div className="min-h-screen bg-white text-slate-900 font-sans selection:bg-indigo-500 selection:text-white relative">
      {/* Top Testing Control Bar */}
      <div className="sticky top-0 z-40 bg-slate-900 text-slate-100 px-3 py-2 flex items-center justify-between text-xs shadow-md gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <Link
            href={`/bot/${botId}`}
            className="inline-flex items-center gap-1 text-slate-200 hover:text-white font-semibold bg-white/10 px-2.5 py-1 rounded-lg transition-colors shrink-0"
          >
            <ArrowLeft className="w-3 h-3" />
            <span className="hidden xs:inline">Back</span>
            <span className="xs:hidden">←</span>
          </Link>
          <div className="hidden sm:flex items-center gap-2 text-slate-300 min-w-0">
            <span className="shrink-0">Testing:</span>
            <strong className="text-white truncate">{bot?.name || 'Loading...'}</strong>
            {bot?.primaryColor && (
              <span
                className="w-2.5 h-2.5 rounded-full inline-block ring-2 ring-white/20 shrink-0"
                style={{ backgroundColor: bot.primaryColor }}
              />
            )}
          </div>
        </div>

        <div className="flex items-center gap-1.5 text-[10px] sm:text-[11px] text-indigo-300 font-medium text-right shrink-0">
          <span className="hidden sm:inline">Look at the bottom corner for your floating AI chat widget!</span>
          <span className="sm:hidden">Chat widget ↘</span>
        </div>
      </div>

      {/* Mock Showcase Website Content (Light Theme) */}
      <header className="max-w-7xl mx-auto px-4 sm:px-6 py-4 sm:py-6 flex items-center justify-between border-b border-slate-100 gap-4">
        <div className="flex items-center gap-2 font-extrabold text-lg sm:text-xl text-slate-900 min-w-0">
          <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-xl bg-indigo-600 flex items-center justify-center text-white text-xs sm:text-sm shadow-md shadow-indigo-600/20 shrink-0">
            ▲
          </div>
          <span className="truncate">ApexCloud Systems</span>
        </div>
        <nav className="hidden md:flex items-center gap-6 lg:gap-8 text-sm text-slate-600 font-semibold">
          <a href="#features" className="hover:text-indigo-600 transition-colors">Platform</a>
          <a href="#solutions" className="hover:text-indigo-600 transition-colors">Solutions</a>
          <a href="#pricing" className="hover:text-indigo-600 transition-colors">Pricing</a>
          <a href="#docs" className="hover:text-indigo-600 transition-colors">API Docs</a>
        </nav>
        <button className="px-3 sm:px-4 py-1.5 sm:py-2 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-xs font-bold text-indigo-700 transition-colors shrink-0">
          Client Portal
        </button>
      </header>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-10 sm:py-20 text-center space-y-6 sm:space-y-8">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-indigo-50 border border-indigo-200 text-[11px] sm:text-xs text-indigo-700 font-semibold shadow-sm">
          <Zap className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-indigo-600 shrink-0" />
          <span>Enterprise Cloud Architecture &bull; 99.99% Reliability</span>
        </div>

        <h1 className="text-3xl sm:text-5xl lg:text-6xl font-extrabold text-slate-900 tracking-tight leading-tight">
          Next-Generation Cloud Orchestration{' '}
          <span className="bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
            Built for Modern High-Growth Teams
          </span>
        </h1>

        <p className="text-sm sm:text-base lg:text-lg text-slate-600 max-w-2xl mx-auto leading-relaxed">
          Automate global server clusters, distributed memory caching, and real-time observability across 40+ global regions with zero DevOps friction.
        </p>

        <div className="flex flex-col sm:flex-row flex-wrap justify-center gap-3 sm:gap-4 pt-2 sm:pt-4">
          <button className="px-6 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-sm font-bold text-white shadow-lg shadow-indigo-600/20 transition-all hover:scale-105">
            Start Free 14-Day Trial
          </button>
          <button className="px-6 py-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-sm font-bold text-slate-700 border border-slate-200 transition-all">
            Schedule Demo Call
          </button>
        </div>

        {/* Feature Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 sm:gap-6 pt-10 sm:pt-16 text-left">
          <div className="p-5 sm:p-6 rounded-2xl bg-slate-50 border border-slate-200 space-y-3 shadow-sm">
            <Shield className="w-6 h-6 text-indigo-600" />
            <h3 className="font-bold text-slate-900 text-sm sm:text-base">SOC2 &amp; HIPAA Certified</h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              End-to-end hardware encryption with automated key rotation and auditing.
            </p>
          </div>

          <div className="p-5 sm:p-6 rounded-2xl bg-slate-50 border border-slate-200 space-y-3 shadow-sm">
            <Zap className="w-6 h-6 text-emerald-600" />
            <h3 className="font-bold text-slate-900 text-sm sm:text-base">Sub-Millisecond Edge</h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              Edge routing with smart multi-region failover and distributed memory caching.
            </p>
          </div>

          <div className="p-5 sm:p-6 rounded-2xl bg-slate-50 border border-slate-200 space-y-3 shadow-sm sm:col-span-2 md:col-span-1">
            <Star className="w-6 h-6 text-amber-500" />
            <h3 className="font-bold text-slate-900 text-sm sm:text-base">Continuous Scaling</h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              Scale automatically from zero to tens of millions of concurrent requests seamlessly.
            </p>
          </div>
        </div>

        {/* Callout */}
        <div className="mt-10 sm:mt-16 p-6 sm:p-8 rounded-3xl bg-indigo-50/50 border border-indigo-200 text-center space-y-3">
          <Bot className="w-7 h-7 sm:w-8 sm:h-8 text-indigo-600 mx-auto" />
          <h3 className="text-base sm:text-lg font-bold text-slate-900">Have questions about our cloud infrastructure?</h3>
          <p className="text-xs text-slate-600 max-w-md mx-auto">
            Click the AI chat bubble on the bottom corner of this page. It retrieves answers instantly using Qdrant vector search!
          </p>
        </div>
      </main>
    </div>
  );
}
