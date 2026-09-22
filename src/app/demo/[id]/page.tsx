'use client';

import React, { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, ExternalLink, Sparkles, Shield, Zap, Star, Bot } from 'lucide-react';

export default function DemoSandboxPage() {
  const params = useParams();
  const botId = params?.id as string;
  const [bot, setBot] = useState<any>(null);

  useEffect(() => {
    if (!botId) return;

    fetch(`/api/bot/${botId}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.bot) setBot(data.bot);
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
  }, [botId]);

  return (
    <div className="min-h-screen bg-white text-slate-900 font-sans selection:bg-indigo-500 selection:text-white relative">
      {/* Top Testing Control Bar */}
      <div className="sticky top-0 z-40 bg-slate-900 text-slate-100 px-4 py-2.5 flex items-center justify-between text-xs shadow-md">
        <div className="flex items-center gap-3">
          <Link
            href={`/bot/${botId}`}
            className="inline-flex items-center gap-1.5 text-slate-200 hover:text-white font-semibold bg-white/10 px-3 py-1 rounded-lg transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back to Studio</span>
          </Link>
          <div className="hidden sm:flex items-center gap-2 text-slate-300">
            <span>Testing Live Widget:</span>
            <strong className="text-white">{bot?.name || 'Loading Bot...'}</strong>
            {bot?.primaryColor && (
              <span
                className="w-2.5 h-2.5 rounded-full inline-block ring-2 ring-white/20"
                style={{ backgroundColor: bot.primaryColor }}
              />
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 text-[11px] text-indigo-300 font-medium">
          <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
          <span>Look at the bottom corner for your floating AI chat widget!</span>
        </div>
      </div>

      {/* Mock Showcase Website Content (Light Theme) */}
      <header className="max-w-7xl mx-auto px-6 py-6 flex items-center justify-between border-b border-slate-100">
        <div className="flex items-center gap-2.5 font-extrabold text-xl text-slate-900">
          <div className="w-8 h-8 rounded-xl bg-indigo-600 flex items-center justify-center text-white text-sm shadow-md shadow-indigo-600/20">
            ▲
          </div>
          <span>ApexCloud Systems</span>
        </div>
        <nav className="hidden md:flex items-center gap-8 text-sm text-slate-600 font-semibold">
          <a href="#features" className="hover:text-indigo-600 transition-colors">Platform</a>
          <a href="#solutions" className="hover:text-indigo-600 transition-colors">Solutions</a>
          <a href="#pricing" className="hover:text-indigo-600 transition-colors">Pricing</a>
          <a href="#docs" className="hover:text-indigo-600 transition-colors">API Docs</a>
        </nav>
        <button className="px-4 py-2 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-xs font-bold text-indigo-700 transition-colors">
          Client Portal
        </button>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-20 text-center space-y-8">
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-indigo-50 border border-indigo-200 text-xs text-indigo-700 font-semibold shadow-sm">
          <Zap className="w-3.5 h-3.5 text-indigo-600" />
          <span>Enterprise Cloud Architecture &bull; 99.99% Reliability</span>
        </div>

        <h1 className="text-4xl sm:text-6xl font-extrabold text-slate-900 tracking-tight leading-tight">
          Next-Generation Cloud Orchestration <br />
          <span className="bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
            Built for Modern High-Growth Teams
          </span>
        </h1>

        <p className="text-base sm:text-lg text-slate-600 max-w-2xl mx-auto leading-relaxed">
          Automate global server clusters, distributed memory caching, and real-time observability across 40+ global regions with zero DevOps friction.
        </p>

        <div className="flex flex-wrap justify-center gap-4 pt-4">
          <button className="px-6 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-sm font-bold text-white shadow-lg shadow-indigo-600/20 transition-all hover:scale-105">
            Start Free 14-Day Trial
          </button>
          <button className="px-6 py-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-sm font-bold text-slate-700 border border-slate-200 transition-all">
            Schedule Demo Call
          </button>
        </div>

        {/* Feature Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-16 text-left">
          <div className="p-6 rounded-2xl bg-slate-50 border border-slate-200 space-y-3 shadow-sm">
            <Shield className="w-6 h-6 text-indigo-600" />
            <h3 className="font-bold text-slate-900 text-base">SOC2 &amp; HIPAA Certified</h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              End-to-end hardware encryption with automated key rotation and auditing.
            </p>
          </div>

          <div className="p-6 rounded-2xl bg-slate-50 border border-slate-200 space-y-3 shadow-sm">
            <Zap className="w-6 h-6 text-emerald-600" />
            <h3 className="font-bold text-slate-900 text-base">Sub-Millisecond Edge</h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              Edge routing with smart multi-region failover and distributed memory caching.
            </p>
          </div>

          <div className="p-6 rounded-2xl bg-slate-50 border border-slate-200 space-y-3 shadow-sm">
            <Star className="w-6 h-6 text-amber-500" />
            <h3 className="font-bold text-slate-900 text-base">Continuous Scaling</h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              Scale automatically from zero to tens of millions of concurrent requests seamlessly.
            </p>
          </div>
        </div>

        {/* Callout */}
        <div className="mt-16 p-8 rounded-3xl bg-indigo-50/50 border border-indigo-200 text-center space-y-3">
          <Bot className="w-8 h-8 text-indigo-600 mx-auto" />
          <h3 className="text-lg font-bold text-slate-900">Have questions about our cloud infrastructure?</h3>
          <p className="text-xs text-slate-600 max-w-md mx-auto">
            Click the AI chat bubble on the bottom corner of this page. It retrieves answers instantly using Qdrant vector search!
          </p>
        </div>
      </main>
    </div>
  );
}
