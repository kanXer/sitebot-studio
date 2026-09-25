import React from 'react';
import type { Metadata } from 'next';
import Link from 'next/link';
import {
  Bot,
  ShieldCheck,
  Zap,
  Layers,
  Cpu,
  Database,
  Code2,
  Lock,
  ArrowRight,
  CheckCircle2,
  Globe,
  Sliders,
  Users,
  MessageSquare,
  HelpCircle,
} from 'lucide-react';
import { Navbar } from '@/components/Navbar';
import { Footer } from '@/components/Footer';

export const metadata: Metadata = {
  title: 'About Us — Next-Gen AI Website Chatbots & RAG Platform',
  description:
    'Discover SiteBot Studio: The multi-tenant AI chatbot platform providing shadow DOM encapsulated chat widgets, multi-model RAG, Qdrant vector memory, and automated website scraping.',
  keywords: [
    'About SiteBot Studio',
    'AI Chatbot Platform',
    'RAG Chatbot Technology',
    'Shadow DOM Chatbot',
    'Qdrant Vector Database',
    'NVIDIA NIM AI',
    'OpenAI Next.js Chatbot',
  ],
  openGraph: {
    title: 'About SiteBot Studio — Autonomous AI Chatbots for Any Website',
    description:
      'Engineered to convert static websites into 24/7 intelligent sales and support engines using multi-model AI and Shadow DOM isolation.',
    url: 'https://sitebotstudio.com/about',
    images: [{ url: '/og-image.jpg', width: 1200, height: 630, alt: 'About SiteBot Studio' }],
  },
};

export default function AboutPage() {
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'AboutPage',
    name: 'About SiteBot Studio',
    description:
      'Multi-Tenant AI Chatbot Platform providing shadow DOM encapsulated chat widgets, multi-model RAG, and automated website scraping.',
    publisher: {
      '@type': 'Organization',
      name: 'SiteBot Studio',
      logo: 'https://sitebotstudio.com/logo.png',
    },
  };

  const PILLARS = [
    {
      icon: <Code2 className="w-6 h-6 text-indigo-500" />,
      title: 'Zero-Leak Shadow DOM Isolation',
      desc: 'Our embedded widget runs entirely inside an open Shadow DOM root. Host site styles from Tailwind, Bootstrap, WordPress themes, or Webflow will never corrupt the chatbot UI, and widget CSS will never leak onto your website.',
    },
    {
      icon: <Database className="w-6 h-6 text-purple-500" />,
      title: 'Qdrant Vector Search Engine',
      desc: 'High-dimensional semantic embeddings stored in Qdrant collections. Fast cosine similarity search retrieves relevant documentation snippets within milliseconds to ground every answer with factual accuracy.',
    },
    {
      icon: <Cpu className="w-6 h-6 text-emerald-500" />,
      title: 'Multi-Model LLM Orchestration',
      desc: 'Choose between OpenAI GPT-4o-mini, NVIDIA NIM (Llama 3.1 70B/8B Instruct), Google Gemini 1.5, or OpenRouter. Bring Your Own Key (BYOK) with AES encryption or use studio defaults.',
    },
    {
      icon: <Globe className="w-6 h-6 text-sky-500" />,
      title: 'Autonomous Web Crawler & Parser',
      desc: 'Input any URL and our engine automatically navigates internal links, strips navigational boilerplate and ads, chunks content semantically, and indexes your entire knowledge base in under 60 seconds.',
    },
    {
      icon: <Lock className="w-6 h-6 text-rose-500" />,
      title: 'Enterprise Origin & Rate Limiting',
      desc: 'Protect your API credits and vector clusters with strict HTTP Origin whitelisting, customizable sliding-window token rate limiters, and per-tenant cryptographic isolation.',
    },
    {
      icon: <Zap className="w-6 h-6 text-amber-500" />,
      title: 'High-Conversion Fast Actions',
      desc: 'Bridge AI assistance with direct human revenue. Built-in Call Now (tel:), WhatsApp direct messaging, Free Audit triggers, custom consultation links, and pricing redirect buttons.',
    },
  ];

  const COMPARISONS = [
    { feature: 'CSS Isolation', sitebot: 'Native Shadow DOM (100% isolated)', others: 'iFrames or leaky ad-hoc divs' },
    { feature: 'Embed Script Size', sitebot: 'Zero external dependencies (~15KB)', others: 'Heavy 500KB+ bloated bundles' },
    { feature: 'RAG Vector Database', sitebot: 'Qdrant 768d Cosine Search', others: 'Generic keyword search or static FAQs' },
    { feature: 'LLM Choice & BYOK', sitebot: 'OpenAI, NVIDIA NIM, Gemini, OpenRouter', others: 'Locked into single proprietary model' },
    { feature: 'Website Crawling', sitebot: 'Automatic recursive crawler with SSE', others: 'Manual copy-paste document uploads' },
    { feature: 'Direct Conversion Bar', sitebot: 'WhatsApp, Phone, Audit, Plans built-in', others: 'Requires expensive 3rd party add-ons' },
  ];

  return (
    <div className="min-h-screen min-w-0 overflow-x-clip bg-slate-50 text-slate-900 font-sans flex flex-col selection:bg-indigo-500 selection:text-white">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <Navbar />

      <main className="flex-1 min-w-0">
        {/* Hero Section */}
        <section className="relative overflow-hidden pt-16 pb-20 lg:pt-24 lg:pb-28 bg-gradient-to-b from-white via-indigo-50/30 to-slate-50 border-b border-slate-200/80">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
            <div className="max-w-3xl mx-auto min-w-0 text-center space-y-6">
              <div className="inline-flex max-w-full flex-wrap items-center justify-center gap-2 px-3.5 py-1.5 rounded-full bg-indigo-50 border border-indigo-200/80 text-indigo-700 text-xs font-bold shadow-sm text-center leading-relaxed">
                <span>Next-Generation Architecture</span>
              </div>

              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold text-slate-950 tracking-tight leading-[1.15] break-words">
                Powering Intelligent Website Conversations with{' '}
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 via-purple-600 to-rose-600">
                  SiteBot Studio
                </span>
              </h1>

              <p className="text-base sm:text-lg text-slate-600 leading-relaxed">
                SiteBot Studio was built to eliminate the frustration of clunky, slow, and style-breaking web chatbots. We engineered an isolated Shadow DOM embed combined with state-of-the-art vector search to turn any website into an autonomous 24/7 conversion engine.
              </p>

              <div className="pt-2 flex min-w-0 flex-col sm:flex-row sm:flex-wrap items-center justify-center gap-4">
                <Link
                  href="/"
                  className="w-full sm:w-auto max-w-full px-6 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold shadow-lg shadow-indigo-600/25 transition-all hover:scale-[1.02] flex items-center justify-center gap-2 text-center"
                >
                  <span>Launch Free Chatbot</span>
                  <ArrowRight className="w-4 h-4" />
                </Link>
                <Link
                  href="/contact"
                  className="w-full sm:w-auto max-w-full px-6 py-3 rounded-xl bg-white hover:bg-slate-100 text-slate-800 text-sm font-bold border border-slate-200 shadow-sm transition-all text-center"
                >
                  <span>Talk to Sales &amp; Engineering</span>
                </Link>
              </div>
            </div>

            {/* Logo showcase card */}
            <div className="mt-14 max-w-xl mx-auto min-w-0 p-4 rounded-3xl bg-white/80 backdrop-blur-md border border-slate-200/80 shadow-xl flex flex-col sm:flex-row items-center justify-center gap-4 sm:gap-6 text-center sm:text-left">
              <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl overflow-hidden shadow-lg border border-slate-100 shrink-0">
                <img src="/logo.png" alt="SiteBot Studio Official Logo" className="w-full h-full object-cover" />
              </div>
              <div className="min-w-0 space-y-1">
                <h2 className="text-lg font-bold text-slate-900 break-words">SiteBot Studio Platform</h2>
                <p className="text-xs text-slate-500 leading-relaxed break-words">
                  Engineered with Next.js App Router, Qdrant Vector DB, OpenAI, and NVIDIA NIM AI. Zero bloat, instant setup.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Pillars of Engineering */}
        <section className="py-20 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto mb-14 space-y-3">
            <h2 className="text-xs font-bold uppercase tracking-wider text-indigo-600">
              Platform Capabilities
            </h2>
            <p className="text-3xl font-extrabold text-slate-900 tracking-tight">
              Engineered for Speed, Reliability, and Isolation
            </p>
            <p className="text-sm text-slate-600">
              Every detail is optimized for zero interference with your host application and maximum conversion.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {PILLARS.map((p, idx) => (
              <div
                key={idx}
                className="min-w-0 bg-white rounded-2xl p-7 border border-slate-200/80 shadow-sm hover:shadow-md transition-shadow space-y-4 relative group"
              >
                <div className="w-12 h-12 rounded-xl bg-slate-50 border border-slate-200/70 flex items-center justify-center group-hover:scale-105 transition-transform">
                  {p.icon}
                </div>
                <h3 className="text-base font-bold text-slate-900 break-words">{p.title}</h3>
                <p className="text-xs text-slate-600 leading-relaxed break-words">{p.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Comparison Table */}
        <section className="py-16 bg-white border-y border-slate-200">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center max-w-2xl mx-auto mb-12 space-y-2">
              <h2 className="text-xs font-bold uppercase tracking-wider text-indigo-600">
                Why SiteBot Studio
              </h2>
              <p className="text-2xl sm:text-3xl font-extrabold text-slate-900">
                How We Compare to Legacy Chatbots
              </p>
            </div>

            <div className="min-w-0 max-w-full overflow-x-auto rounded-2xl border border-slate-200 shadow-sm">
              <table className="w-full min-w-[680px] text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-900 text-white font-bold">
                    <th className="py-4 px-5">Capability</th>
                    <th className="py-4 px-5 text-indigo-300">SiteBot Studio</th>
                    <th className="py-4 px-5 text-slate-400">Legacy / Generic Chatbots</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {COMPARISONS.map((row, idx) => (
                    <tr key={idx} className={idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/60'}>
                      <td className="py-3.5 px-5 font-bold text-slate-900">{row.feature}</td>
                      <td className="py-3.5 px-5 font-semibold text-indigo-600 flex items-center gap-1.5">
                        <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                        <span>{row.sitebot}</span>
                      </td>
                      <td className="py-3.5 px-5 text-slate-500">{row.others}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        {/* CTA Section */}
        <section className="py-20 bg-gradient-to-tr from-slate-900 via-indigo-950 to-slate-900 text-white relative overflow-hidden">
          <div className="max-w-4xl mx-auto px-4 text-center space-y-6 relative z-10">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 text-indigo-300 text-xs font-semibold border border-white/15">
              <span>Ready in Under 60 Seconds</span>
            </div>

            <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight">
              Create Your Intelligent Website Assistant Today
            </h2>

            <p className="text-sm sm:text-base text-slate-300 max-w-2xl mx-auto leading-relaxed">
              No credit card required. Enter your website URL, let our AI crawl your knowledge base, and paste a single script tag into your website.
            </p>

            <div className="pt-2 flex min-w-0 flex-col sm:flex-row sm:flex-wrap items-center justify-center gap-4">
              <Link
                href="/"
                className="w-full sm:w-auto max-w-full px-7 py-3.5 rounded-xl bg-indigo-500 hover:bg-indigo-400 text-white font-bold text-sm shadow-xl shadow-indigo-500/25 transition-all hover:scale-105 text-center"
              >
                Get Started Now &mdash; It&apos;s Free
              </Link>
              <Link
                href="/contact"
                className="w-full sm:w-auto max-w-full px-7 py-3.5 rounded-xl bg-white/10 hover:bg-white/20 text-white font-bold text-sm border border-white/20 transition-all text-center"
              >
                Contact Enterprise Support
              </Link>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
