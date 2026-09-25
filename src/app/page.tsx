import React from 'react';
import type { Metadata } from 'next';
import Link from 'next/link';
import {
  Bot,
  Sparkles,
  Zap,
  ShieldCheck,
  Cpu,
  Database,
  Code2,
  Globe,
  Layers,
  ArrowRight,
  CheckCircle2,
  Lock,
  Play,
  MessageCircle,
  Phone,
  BarChart3,
  ExternalLink,
  ChevronRight,
  Star,
  Terminal,
  HelpCircle,
} from 'lucide-react';
import { Navbar } from '@/components/Navbar';
import { Footer } from '@/components/Footer';
import { CTALeadForm } from '@/components/CTALeadForm';

export const metadata: Metadata = {
  title: 'SiteBot Studio — Multi-Tenant AI Chatbot Platform for Any Website',
  description:
    'Build, train, and embed intelligent RAG AI chatbots on any website in 60 seconds with zero runtime dependencies and isolated Shadow DOM technology. Powered by Qdrant, NVIDIA NIM, and OpenAI.',
  keywords: [
    'AI Chatbot Builder',
    'Website AI Chatbot',
    'RAG Chatbot Platform',
    'Shadow DOM Chatbot',
    'Qdrant Vector Search Chatbot',
    'Autonomous Web Crawler',
    'OpenAI GPT-4o Chatbot',
    'NVIDIA NIM Llama 3',
    'Customer Support AI Widget',
    'WordPress AI Chatbot',
    'Shopify AI Chatbot',
    'Webflow AI Assistant',
  ],
  openGraph: {
    title: 'SiteBot Studio — Multi-Tenant AI Chatbot Platform for Any Website',
    description:
      'Train AI on your website knowledge and embed an isolated, customizable floating chatbot on WordPress, Webflow, Shopify, or React.',
    url: 'https://sitebotstudio.com',
    images: [{ url: '/og-image.jpg', width: 1200, height: 630, alt: 'SiteBot Studio' }],
  },
};

export default function LandingHomePage() {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://sitebotstudio.com';

  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'SoftwareApplication',
        name: 'SiteBot Studio',
        applicationCategory: 'BusinessApplication',
        operatingSystem: 'All',
        offers: {
          '@type': 'Offer',
          price: '0',
          priceCurrency: 'USD',
        },
        description:
          'Multi-Tenant AI Chatbot Platform providing shadow DOM encapsulated chat widgets, multi-model RAG, and automated website scraping.',
        url: baseUrl,
        image: `${baseUrl}/logo.png`,
      },
      {
        '@type': 'FAQPage',
        mainEntity: [
          {
            '@type': 'Question',
            name: 'How does SiteBot embed on websites without breaking styles?',
            acceptedAnswer: {
              '@type': 'Answer',
              text: 'SiteBot Studio uses native Web Component Shadow DOM isolation. Styles from the host site cannot affect the chat widget, and widget styles will never alter host HTML.',
            },
          },
          {
            '@type': 'Question',
            name: 'Can I connect my own vector database or API keys?',
            acceptedAnswer: {
              '@type': 'Answer',
              text: 'Yes! SiteBot Studio supports BYOK (Bring Your Own Key) for OpenAI, NVIDIA NIM, Gemini, and OpenRouter, as well as custom cloud or self-hosted Qdrant instances.',
            },
          },
        ],
      },
    ],
  };

  const KEY_METRICS = [
    { value: '< 60s', label: 'Setup to Live Deployment' },
    { value: '100%', label: 'Shadow DOM CSS Isolated' },
    { value: '768d', label: 'Qdrant Vector Accuracy' },
    { value: 'Zero', label: 'External Runtime Dependencies' },
  ];

  const PLATFORMS = [
    'WordPress',
    'Shopify',
    'Webflow',
    'Next.js',
    'React',
    'Wix',
    'Squarespace',
    'Custom HTML5',
  ];

  const FEATURES = [
    {
      icon: <Code2 className="w-6 h-6 text-indigo-500" />,
      badge: 'Zero Conflict',
      title: 'Isolated Shadow DOM Architecture',
      desc: 'Never worry about CSS conflicts again. Host styles from Bootstrap, Tailwind, or WordPress themes cannot bleed in, and widget styles cannot leak out.',
    },
    {
      icon: <Database className="w-6 h-6 text-purple-500" />,
      badge: 'Real-Time RAG',
      title: 'Qdrant Vector Search Engine',
      desc: 'Semantic cosine similarity search retrieves the exact knowledge chunks needed to answer user questions factually, eliminating hallucinations with source citations.',
    },
    {
      icon: <Cpu className="w-6 h-6 text-emerald-500" />,
      badge: 'Multi-Provider',
      title: 'OpenAI, NVIDIA NIM & Gemini',
      desc: 'Seamlessly switch models between OpenAI GPT-4o-mini, NVIDIA Llama 3.1 70B, Google Gemini 1.5, or OpenRouter. Bring Your Own Keys (BYOK) with AES encryption.',
    },
    {
      icon: <Globe className="w-6 h-6 text-sky-500" />,
      badge: 'Autonomous',
      title: 'Recursive Website Crawler',
      desc: 'Provide your website URL and our crawler automatically discovers subpages, strips boilerplate navigation and footers, chunks content, and vectorizes in seconds.',
    },
    {
      icon: <Zap className="w-6 h-6 text-amber-500" />,
      badge: 'Conversion Engine',
      title: 'Direct Fast Action Triggers',
      desc: 'Convert conversations into revenue with integrated Call Now, WhatsApp direct messaging, Free Audit requests, and custom consultation link buttons.',
    },
    {
      icon: <Lock className="w-6 h-6 text-rose-500" />,
      badge: 'Enterprise Grade',
      title: 'Origin Whitelisting & Rate Limiting',
      desc: 'Prevent API key abuse with strict HTTP Origin verification, custom sliding-window token rate limits, and full multi-tenant workspace isolation.',
    },
  ];

  const STEPS = [
    {
      step: '01',
      title: 'Enter Your Website URL',
      desc: 'Give us your domain. Our intelligent crawler parses your documentation, service pages, and FAQs with live progress streaming.',
    },
    {
      step: '02',
      title: 'Customize Your Brand & Models',
      desc: 'Pick your launcher bubble style, brand colors, LLM provider (NVIDIA, OpenAI, Gemini), greeting prompt, and conversion links.',
    },
    {
      step: '03',
      title: 'Paste One Script Tag',
      desc: 'Copy your single <script> embed tag before </body> on any CMS or framework. Enjoy isolated, intelligent 24/7 AI chat.',
    },
  ];

  return (
    <div className="min-h-screen bg-white text-slate-900 font-sans flex flex-col selection:bg-indigo-500 selection:text-white">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <Navbar />

      <main className="flex-1">
        {/* Hero Section */}
        <section className="relative overflow-hidden pt-16 pb-24 lg:pt-24 lg:pb-32 bg-gradient-to-b from-slate-950 via-slate-900 to-indigo-950 text-white">
          {/* Subtle Ambient Glows */}
          <div className="absolute -top-40 -left-40 w-96 h-96 bg-indigo-500/20 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute top-1/2 -right-40 w-96 h-96 bg-purple-500/20 rounded-full blur-3xl pointer-events-none" />

          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
            <div className="max-w-3xl mx-auto text-center space-y-6">
              {/* Eyebrow badge */}
              <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/10 backdrop-blur-md border border-white/15 text-xs font-semibold text-indigo-300 shadow-inner">
                <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
                <span>Next-Gen RAG AI Chatbot Platform</span>
              </div>

              {/* Primary SEO H1 */}
              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black tracking-tight leading-[1.12]">
                Build, Train &amp; Embed Intelligent AI Chatbots on{' '}
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 via-purple-300 to-rose-400">
                  Any Website in 60 Seconds
                </span>
              </h1>

              {/* Subheadline with high-value keywords */}
              <p className="text-base sm:text-lg text-slate-300 max-w-2xl mx-auto leading-relaxed">
                Autonomous knowledge base crawling, isolated Shadow DOM encapsulation, and state-of-the-art vector memory. Powered by Qdrant, NVIDIA NIM, and OpenAI.
              </p>

              {/* Action Buttons */}
              <div className="pt-3 flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-4 w-full">
                <Link
                  href="/create"
                  className="w-full sm:w-auto px-7 py-3.5 rounded-2xl bg-gradient-to-r from-indigo-500 via-indigo-600 to-purple-600 hover:from-indigo-400 hover:to-purple-500 text-white text-sm font-bold shadow-xl shadow-indigo-500/30 transition-all hover:scale-105 active:scale-95 flex items-center justify-center gap-2.5 cursor-pointer"
                >
                  <Bot className="w-4 h-4" />
                  <span>Deploy Your Chatbot Free</span>
                  <ArrowRight className="w-4 h-4" />
                </Link>

                <Link
                  href="/about"
                  className="w-full sm:w-auto px-6 py-3.5 rounded-2xl bg-white/10 hover:bg-white/20 text-white text-sm font-bold border border-white/15 backdrop-blur-md transition-all hover:scale-[1.02] flex items-center justify-center cursor-pointer"
                >
                  <span>Explore Architecture</span>
                </Link>
              </div>

              {/* Quick Trust Badges */}
              <div className="pt-6 flex flex-wrap items-center justify-center gap-6 text-xs text-slate-400">
                <span className="flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  No credit card required
                </span>
                <span className="flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  Zero runtime dependencies
                </span>
                <span className="flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  Complete CSS isolation
                </span>
              </div>
            </div>

            {/* Hero Visual Preview Card */}
            <div className="mt-16 max-w-5xl mx-auto rounded-3xl p-3 bg-white/5 backdrop-blur-xl border border-white/15 shadow-2xl relative">
              <div className="rounded-2xl overflow-hidden shadow-inner border border-slate-800">
                <img
                  src="/og-image.jpg"
                  alt="SiteBot Studio Platform Dashboard &amp; Floating Chat Widget"
                  className="w-full h-auto object-cover"
                />
              </div>
            </div>
          </div>
        </section>

        {/* Metrics Bar */}
        <section className="border-y border-slate-200 bg-slate-50 py-10">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
              {KEY_METRICS.map((metric, idx) => (
                <div key={idx} className="space-y-1">
                  <div className="text-3xl sm:text-4xl font-black text-slate-900 tracking-tight">
                    {metric.value}
                  </div>
                  <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    {metric.label}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Supported Platforms Strip */}
        <section className="py-8 bg-white border-b border-slate-100 overflow-hidden">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col md:flex-row items-center justify-between gap-4">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider shrink-0">
              Integrates with any website:
            </span>
            <div className="flex flex-wrap items-center justify-center gap-4 sm:gap-6 text-xs font-bold text-slate-600">
              {PLATFORMS.map((plat, idx) => (
                <span
                  key={idx}
                  className="px-3 py-1.5 rounded-xl bg-slate-100/80 border border-slate-200/80 hover:bg-indigo-50 hover:text-indigo-600 transition-colors"
                >
                  {plat}
                </span>
              ))}
            </div>
          </div>
        </section>

        {/* How It Works (3 Steps) */}
        <section className="py-20 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto mb-16 space-y-3">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-50 text-indigo-700 text-xs font-bold border border-indigo-200">
              <span>Simple 3-Step Setup</span>
            </div>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">
              From URL to Live AI Chatbot in Under 60 Seconds
            </h2>
            <p className="text-sm text-slate-600">
              No machine learning knowledge needed. SiteBot handles crawling, chunking, embedding, and streaming automatically.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 relative">
            {STEPS.map((s, idx) => (
              <div
                key={idx}
                className="bg-white rounded-3xl p-8 border border-slate-200/80 shadow-sm hover:shadow-md transition-all relative group"
              >
                <div className="text-5xl font-black text-slate-100 group-hover:text-indigo-100 transition-colors mb-4">
                  {s.step}
                </div>
                <h3 className="text-lg font-bold text-slate-900 mb-2">{s.title}</h3>
                <p className="text-xs text-slate-600 leading-relaxed">{s.desc}</p>
              </div>
            ))}
          </div>

          <div className="mt-12 text-center">
            <Link
              href="/create"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-md shadow-indigo-600/20 transition-all hover:scale-105"
            >
              <span>Try the 60-Second Setup Now</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </section>

        {/* Core Architectural Features Grid */}
        <section className="py-20 bg-slate-50 border-t border-slate-200/80">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center max-w-2xl mx-auto mb-16 space-y-3">
              <span className="text-xs font-bold uppercase tracking-wider text-indigo-600">
                Enterprise AI Architecture
              </span>
              <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">
                Engineered for Reliability, Zero-CSS Conflict &amp; Accuracy
              </h2>
              <p className="text-sm text-slate-600">
                Every component is built with modern web standards and high-speed vector retrieval.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {FEATURES.map((f, idx) => (
                <div
                  key={idx}
                  className="bg-white rounded-3xl p-7 border border-slate-200/80 shadow-sm hover:shadow-md transition-shadow space-y-3.5 relative group"
                >
                  <div className="flex items-center justify-between">
                    <div className="w-12 h-12 rounded-2xl bg-slate-50 border border-slate-200/70 flex items-center justify-center group-hover:scale-105 transition-transform">
                      {f.icon}
                    </div>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 font-mono">
                      {f.badge}
                    </span>
                  </div>
                  <h3 className="text-base font-bold text-slate-900">{f.title}</h3>
                  <p className="text-xs text-slate-600 leading-relaxed">{f.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Live Embed Code Snippet Demonstration */}
        <section className="py-20 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="bg-slate-950 rounded-3xl p-8 sm:p-12 text-white border border-slate-800 shadow-2xl relative overflow-hidden">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-center">
              <div className="lg:col-span-6 space-y-5">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-bold">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Single Line Integration</span>
                </div>

                <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight">
                  One Script Tag. No NPM Modules. No CSS Collisions.
                </h2>

                <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
                  Unlike traditional widgets that require bundling heavy CSS stylesheets or complex React wrappers, SiteBot Studio encapsulates everything into a single lightweight Javascript file.
                </p>

                <div className="space-y-2.5 text-xs text-slate-300">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-indigo-400 shrink-0" />
                    <span>Instant asynchronous deferred loading</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-indigo-400 shrink-0" />
                    <span>Full isolation with Shadow DOM Root</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-indigo-400 shrink-0" />
                    <span>Real-time SSE streaming for instant response</span>
                  </div>
                </div>

                <div className="pt-2">
                  <Link
                    href="/create"
                    className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-indigo-500 hover:bg-indigo-400 text-white font-bold text-xs transition-all shadow-lg shadow-indigo-500/25"
                  >
                    <span>Get Your Embed Tag</span>
                    <ArrowRight className="w-4 h-4" />
                  </Link>
                </div>
              </div>

              <div className="lg:col-span-6">
                <div className="rounded-2xl bg-slate-900 border border-slate-800 p-5 font-mono text-xs shadow-inner space-y-3">
                  <div className="flex items-center justify-between text-slate-500 pb-2 border-b border-slate-800">
                    <span className="flex items-center gap-1.5">
                      <Terminal className="w-3.5 h-3.5 text-indigo-400" />
                      index.html
                    </span>
                    <span className="text-[10px] text-emerald-400 font-semibold">Ready to Embed</span>
                  </div>
                  <pre className="text-slate-300 overflow-x-auto leading-relaxed text-[11px]">
                    <code>{`<!-- Place before closing </body> tag -->
<!-- Replace YOUR_BOT_ID with your bot's ID from: /bot/<your-bot-id> -->
<script 
  src="${baseUrl}/widget.js" 
  data-bot-id="YOUR_BOT_ID" 
  defer>
</script>`}</code>
                  </pre>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Final CTA Banner */}
        <section className="py-16 sm:py-20 bg-gradient-to-tr from-indigo-900 via-indigo-950 to-slate-950 text-white text-center relative overflow-hidden">
          <div className="max-w-6xl mx-auto px-4 grid grid-cols-1 lg:grid-cols-2 gap-10 items-center relative z-10">
            <div className="text-left space-y-6">
              <h2 className="text-3xl sm:text-5xl font-black tracking-tight">
                Ready to Upgrade Your Website with Autonomous AI?
              </h2>

              <p className="text-sm sm:text-base text-slate-300 leading-relaxed">
                Launch your first customized AI chatbot in under 60 seconds. Train on your pages and
                convert visitors 24/7 — every lead lands in your dashboard instantly.
              </p>

              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 sm:gap-4 w-full">
                <Link
                  href="/create"
                  className="w-full sm:w-auto text-center px-7 py-3.5 rounded-2xl bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-400 hover:to-purple-500 text-white font-extrabold text-sm shadow-xl shadow-indigo-500/30 transition-all hover:scale-105"
                >
                  Create Your Free Chatbot
                </Link>
                <Link
                  href="/pricing"
                  className="w-full sm:w-auto text-center px-7 py-3.5 rounded-2xl bg-white/10 hover:bg-white/20 text-white font-bold text-sm border border-white/20 transition-all"
                >
                  See Pricing
                </Link>
              </div>

              <div className="pt-2 flex flex-wrap gap-4 text-xs text-slate-400">
                <span>✓ Free plan: 1 bot, 250K tokens/mo</span>
                <span>✓ Lead alerts via Email, WhatsApp & Telegram</span>
              </div>
            </div>

            {/* Lead capture CTA form */}
            <div className="rounded-3xl bg-white dark:bg-slate-900 border border-white/10 dark:border-slate-800 shadow-2xl p-6 sm:p-7 text-left">
              <CTALeadForm
                campaign="homepage-cta"
                source="homepage_cta_form"
                submitLabel="Talk to our team"
                heading="Not sure where to start?"
                subtext="Share your name and contact — our team will get back to you with a free recommendation."
              />
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
