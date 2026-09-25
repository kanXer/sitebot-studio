'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import {
  HelpCircle,
  Code2,
  Copy,
  Check,
  Globe,
  Layers,
  Bot,
  Zap,
  Phone,
  MessageCircle,
  Sliders,
  Database,
  ArrowRight,
  ShieldCheck,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  BookOpen,
  CheckCircle2,
} from 'lucide-react';
import { Navbar } from '@/components/Navbar';
import { Footer } from '@/components/Footer';

export default function HelpPage() {
  const [activePlatform, setActivePlatform] = useState<
    'html' | 'wordpress' | 'shopify' | 'webflow' | 'react' | 'wix'
  >('html');
  const [copiedCode, setCopiedCode] = useState(false);
  const [openFaq, setOpenFaq] = useState<number | null>(0);

  const sampleScript = `<script src="https://sitebotstudio.com/widget.js" data-bot-id="YOUR_BOT_ID" defer></script>`;

  const handleCopy = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  const platforms = [
    {
      id: 'html',
      name: 'HTML5 / Any Site',
      icon: '🌐',
      snippet: `<!-- Paste this right before the closing </body> tag -->
<script src="https://sitebotstudio.com/widget.js" data-bot-id="YOUR_BOT_ID" defer></script>`,
      steps: [
        'Open your website’s HTML template file (index.html or footer file).',
        'Scroll down to the bottom and find the closing </body> tag.',
        'Paste the single-line script right before </body>.',
        'Save and reload your website. Your floating AI chatbot appears instantly!',
      ],
    },
    {
      id: 'wordpress',
      name: 'WordPress',
      icon: '📝',
      snippet: `<!-- Add via WPCode Plugin or Theme Footer (footer.php) -->
<script src="https://sitebotstudio.com/widget.js" data-bot-id="YOUR_BOT_ID" defer></script>`,
      steps: [
        'Log in to your WordPress Admin Dashboard (wp-admin).',
        'Install the free plugin "WPCode" (Insert Headers and Footers).',
        'Go to Code Snippets → + Add Snippet → Add Your Custom Code.',
        'Select "HTML Snippet" and set Insertion to "Site Wide Footer".',
        'Paste the script code, toggle to "Active", and click "Save Snippet".',
      ],
    },
    {
      id: 'shopify',
      name: 'Shopify',
      icon: '🛍️',
      snippet: `<!-- Inside theme.liquid before </body> -->
<script src="https://sitebotstudio.com/widget.js" data-bot-id="YOUR_BOT_ID" defer></script>`,
      steps: [
        'Log in to your Shopify Admin Panel.',
        'Navigate to Online Store → Themes.',
        'Click the "..." (Actions) button next to your active theme and click "Edit code".',
        'In the left sidebar, click layout/theme.liquid.',
        'Scroll to the very bottom, find </body>, and paste the script directly above it.',
        'Click "Save". The widget is now live across your entire store!',
      ],
    },
    {
      id: 'webflow',
      name: 'Webflow',
      icon: '🎨',
      snippet: `<!-- Project Settings -> Custom Code -> Footer Code -->
<script src="https://sitebotstudio.com/widget.js" data-bot-id="YOUR_BOT_ID" defer></script>`,
      steps: [
        'Open your Webflow Dashboard and go to your Project Settings.',
        'Click the "Custom Code" tab.',
        'Under "Footer Code" (Before </body> tag), paste your SiteBot script.',
        'Click "Save Changes" and then "Publish" to your domains.',
      ],
    },
    {
      id: 'react',
      name: 'React / Next.js',
      icon: '⚛️',
      snippet: `// In Next.js app/layout.tsx:
import Script from 'next/script';

export default function RootLayout({ children }) {
  return (
    <html>
      <body>
        {children}
        <Script
          src="https://sitebotstudio.com/widget.js"
          data-bot-id="YOUR_BOT_ID"
          strategy="lazyOnload"
        />
      </body>
    </html>
  );
}`,
      steps: [
        'In Next.js (App Router), import the Script component in app/layout.tsx.',
        'Add the <Script> tag with strategy="lazyOnload" before </body>.',
        'In standard React (Vite / CRA), you can paste the script in public/index.html.',
      ],
    },
    {
      id: 'wix',
      name: 'Wix / Squarespace',
      icon: '⚡',
      snippet: `<!-- Add under Settings -> Custom Code -> Body - End -->
<script src="https://sitebotstudio.com/widget.js" data-bot-id="YOUR_BOT_ID" defer></script>`,
      steps: [
        'Go to your Wix Dashboard → Settings → Custom Code.',
        'Click "+ Add Custom Code" and paste your widget script.',
        'Set "Add Code to Pages" to "All pages" and place code in "Body - end".',
        'Click Apply and publish your site.',
      ],
    },
  ];

  const faqs = [
    {
      q: 'Will this chatbot slow down or break my website CSS?',
      a: 'Absolutely not! SiteBot Studio runs inside an isolated, encapsulated Shadow DOM root. It has zero external CSS stylesheets and zero dependencies, meaning it will never clash with your website fonts, colors, or Tailwind classes.',
    },
    {
      q: 'How does the automatic website crawler work?',
      a: 'When you enter your website URL, our recursive crawler reads public pages (up to 15-20 pages), extracts text, brand colors, contact info, and FAQs, and automatically generates 768-dimensional vector embeddings stored in a dedicated knowledge base.',
    },
    {
      q: 'Can I hide the WhatsApp, Phone, or Audit buttons?',
      a: 'Yes! All contact and action buttons are 100% optional. If you leave the Phone Number, WhatsApp, Free Audit, or Pricing URL empty, those buttons will not appear in your chatbot widget.',
    },
    {
      q: 'How do I change colors, greetings, or suggested questions later?',
      a: 'Anytime you want to update your bot, simply visit your Bot Studio dashboard (/bot/[id]). Change any setting and click "Save Settings". All updates reflect live on your website instantly without re-pasting the script!',
    },
    {
      q: 'Can I test the chatbot before adding it to my live site?',
      a: 'Yes! In the Bot Studio dashboard, you have a Live Playground where you can chat in real-time, test suggested questions, and click "Live Web Demo" to view the floating widget exactly as visitors will see it.',
    },
    {
      q: 'Which AI models are supported?',
      a: 'We support NVIDIA NIM (default high-speed Llama 3 models), OpenAI (GPT-4o, GPT-4o-mini), Google Gemini 2.5 Flash, and OpenRouter. You can also connect your own custom Qdrant Vector Database.',
    },
  ];

  return (
    <div className="min-h-screen min-w-0 overflow-x-clip bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col selection:bg-indigo-500 selection:text-white">
      <Navbar />

      <main className="flex-1 min-w-0 pb-28 sm:pb-20">
        {/* Hero Section */}
        <section className="relative pt-12 pb-16 px-4 sm:px-6 lg:px-8 max-w-6xl mx-auto text-center overflow-hidden">
          <div className="inline-flex max-w-full flex-wrap items-center justify-center gap-2 px-3.5 py-1.5 rounded-full bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200 dark:border-indigo-800/80 text-indigo-700 dark:text-indigo-300 text-xs font-bold mb-5 animate-in fade-in slide-in-from-top-2 text-center leading-relaxed">
            <BookOpen className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
            <span>SiteBot Studio Documentation &amp; Step-by-Step Guide</span>
          </div>

          <h1 className="text-3xl sm:text-5xl font-black tracking-tight text-slate-900 dark:text-white max-w-3xl mx-auto leading-tight break-words">
            How to Build, Train &amp; Embed Your AI Chatbot in{' '}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 to-purple-600 dark:from-indigo-400 dark:to-purple-400">
              60 Seconds
            </span>
          </h1>

          <p className="mt-4 text-sm sm:text-base text-slate-600 dark:text-slate-400 max-w-2xl mx-auto leading-relaxed break-words">
            Follow this simple guide to create your chatbot, customize its personality, and install it on WordPress, Shopify, Webflow, React, or any custom website with a single line of script.
          </p>

          <div className="mt-7 flex min-w-0 flex-col sm:flex-row sm:flex-wrap items-center justify-center gap-3">
            <Link
              href="/create"
              className="w-full sm:w-auto max-w-full inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-bold text-xs shadow-lg shadow-indigo-600/25 transition-all hover:scale-105 active:scale-95 cursor-pointer text-center"
            >
              <Bot className="w-4 h-4" />
              <span>Create Your Bot Now</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
            <a
              href="#installation-guides"
              className="w-full sm:w-auto max-w-full inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 font-bold text-xs transition-all hover:scale-105 cursor-pointer text-center"
            >
              <Code2 className="w-4 h-4 text-indigo-600" />
              <span>Jump to Embed Codes</span>
            </a>
          </div>
        </section>

        {/* 3 Simple Steps Workflow Cards */}
        <section className="max-w-6xl mx-auto min-w-0 px-4 sm:px-6 lg:px-8 mb-16">
          <div className="text-center mb-8">
            <h2 className="text-xs font-extrabold uppercase tracking-widest text-indigo-600 dark:text-indigo-400">
              Quick Overview
            </h2>
            <p className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white mt-1">
              3 Simple Steps to Go Live
            </p>
          </div>

          <div className="grid min-w-0 grid-cols-1 md:grid-cols-3 gap-6">
            {/* Step 1 */}
            <div className="min-w-0 rounded-3xl p-7 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-sm relative overflow-hidden group hover:border-indigo-500/50 transition-all">
              <div className="w-10 h-10 rounded-2xl bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-100 dark:border-indigo-900 text-indigo-600 dark:text-indigo-400 font-extrabold flex items-center justify-center text-sm mb-4">
                01
              </div>
              <h3 className="text-base font-extrabold text-slate-900 dark:text-white mb-2 break-words">
                1. Enter Site URL &amp; Name
              </h3>
              <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed break-words">
                Go to the <Link href="/create" className="text-indigo-600 dark:text-indigo-400 font-bold hover:underline">Create Bot page</Link>, type your website URL and project name, then click <strong>&ldquo;Start Crawl &amp; Auto-Discover&rdquo;</strong>.
              </p>
            </div>

            {/* Step 2 */}
            <div className="min-w-0 rounded-3xl p-7 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-sm relative overflow-hidden group hover:border-indigo-500/50 transition-all">
              <div className="w-10 h-10 rounded-2xl bg-purple-50 dark:bg-purple-950/60 border border-purple-100 dark:border-purple-900 text-purple-600 dark:text-purple-400 font-extrabold flex items-center justify-center text-sm mb-4">
                02
              </div>
              <h3 className="text-base font-extrabold text-slate-900 dark:text-white mb-2 break-words">
                2. AI Scans &amp; Pre-Fills Details
              </h3>
              <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed break-words">
                Our crawler reads your website, extracts brand color, support phone, WhatsApp, email, greeting, and suggested questions automatically.
              </p>
            </div>

            {/* Step 3 */}
            <div className="min-w-0 rounded-3xl p-7 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-sm relative overflow-hidden group hover:border-indigo-500/50 transition-all">
              <div className="w-10 h-10 rounded-2xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-100 dark:border-emerald-900 text-emerald-600 dark:emerald-400 font-extrabold flex items-center justify-center text-sm mb-4">
                03
              </div>
              <h3 className="text-base font-extrabold text-slate-900 dark:text-white mb-2 break-words">
                3. Copy &amp; Paste Single Script
              </h3>
              <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed break-words">
                Save your chatbot, copy the 1-line script tag from your studio dashboard, and paste it before the <code className="break-all">&lt;/body&gt;</code> tag on your website!
              </p>
            </div>
          </div>
        </section>

        {/* Platform Integration Guide Section */}
        <section id="installation-guides" className="max-w-5xl mx-auto min-w-0 px-4 sm:px-6 lg:px-8 mb-16 scroll-mt-24">
          <div className="text-center mb-8">
            <h2 className="text-xs font-extrabold uppercase tracking-widest text-indigo-600 dark:text-indigo-400">
              Platform Guides
            </h2>
            <p className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white mt-1">
              How to Install on Your CMS or Framework
            </p>
            <p className="text-xs text-slate-500 mt-1.5">
              Select your platform below to view exact installation steps and code snippet:
            </p>
          </div>

          {/* Platform Tab Buttons */}
          <div className="flex min-w-0 w-full flex-wrap items-center justify-center gap-2 p-1.5 rounded-2xl bg-slate-200/60 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 max-w-3xl mx-auto mb-8">
            {platforms.map((p) => {
              const active = activePlatform === p.id;
              return (
                <button
                  key={p.id}
                  onClick={() => setActivePlatform(p.id as any)}
                  className={`flex min-w-0 max-w-full items-center justify-center gap-2 px-3 sm:px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer text-center ${
                    active
                      ? 'bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 shadow-sm'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  <span>{p.icon}</span>
                  <span className="min-w-0 break-words">{p.name}</span>
                </button>
              );
            })}
          </div>

          {/* Active Platform Card */}
          {(() => {
            const current = platforms.find((p) => p.id === activePlatform) || platforms[0];
            return (
              <div className="min-w-0 max-w-full rounded-3xl p-6 sm:p-8 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-md space-y-6">
                <div className="flex min-w-0 flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-4 border-b border-slate-100 dark:border-slate-800">
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="text-2xl">{current.icon}</span>
                    <div className="min-w-0">
                      <h3 className="text-base font-extrabold text-slate-900 dark:text-white break-words">
                        {current.name} Integration Steps
                      </h3>
                      <p className="text-xs text-slate-500">Takes less than 2 minutes</p>
                    </div>
                  </div>
                  <button
                    onClick={() => handleCopy(current.snippet)}
                    className="w-full sm:w-auto max-w-full flex shrink-0 items-center justify-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800 text-xs font-bold hover:bg-indigo-100 transition-colors cursor-pointer"
                  >
                    {copiedCode ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedCode ? 'Copied!' : 'Copy Code'}</span>
                  </button>
                </div>

                {/* Steps List */}
                <div className="space-y-3">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                    Step-by-Step Instructions:
                  </h4>
                  <ol className="space-y-2.5">
                    {current.steps.map((st, sIdx) => (
                      <li key={sIdx} className="flex min-w-0 items-start gap-3 text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                        <span className="w-5 h-5 rounded-full bg-indigo-100 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 font-bold flex items-center justify-center shrink-0 text-[11px] mt-0.5">
                          {sIdx + 1}
                        </span>
                        <span className="min-w-0 break-words">{st}</span>
                      </li>
                    ))}
                  </ol>
                </div>

                {/* Code Snippet Box */}
                <div className="min-w-0 max-w-full overflow-hidden">
                  <div className="flex min-w-0 flex-col sm:flex-row sm:items-center sm:justify-between gap-1 sm:gap-2 mb-2">
                    <span className="min-w-0 text-xs font-bold text-slate-700 dark:text-slate-300">
                      Embed Code Snippet:
                    </span>
                    <span className="min-w-0 text-[11px] text-slate-400 font-mono break-words sm:text-right">Replace YOUR_BOT_ID with your Bot ID</span>
                  </div>
                  <pre className="w-full max-w-full min-w-0 p-4 rounded-2xl bg-slate-950 text-indigo-200 text-xs font-mono overflow-x-auto border border-slate-800 leading-relaxed selection:bg-indigo-700">
                    <code>{current.snippet}</code>
                  </pre>
                </div>
              </div>
            );
          })()}
        </section>

        {/* Customization Details & Action Buttons Explanation */}
        <section className="max-w-5xl mx-auto min-w-0 px-4 sm:px-6 lg:px-8 mb-16">
          <div className="text-center mb-8">
            <h2 className="text-xs font-extrabold uppercase tracking-widest text-indigo-600 dark:text-indigo-400">
              Features &amp; Fast Actions
            </h2>
            <p className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white mt-1">
              How Contact &amp; Fast Action Buttons Work
            </p>
          </div>

          <div className="grid min-w-0 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            <div className="min-w-0 p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-sm space-y-2">
              <div className="w-9 h-9 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 text-emerald-600 flex items-center justify-center">
                <Phone className="w-4 h-4" />
              </div>
              <h4 className="text-sm font-extrabold text-slate-900 dark:text-white break-words">Call Now Button</h4>
              <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed break-words">
                Add your phone number (e.g. <code className="break-all">+91 96962 62007</code>). Visitors can tap to call your support team directly from the chat header.
              </p>
            </div>

            <div className="min-w-0 p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-sm space-y-2">
              <div className="w-9 h-9 rounded-xl bg-green-50 dark:bg-green-950/60 border border-green-200 dark:border-green-800 text-green-600 flex items-center justify-center">
                <MessageCircle className="w-4 h-4" />
              </div>
              <h4 className="text-sm font-extrabold text-slate-900 dark:text-white break-words">WhatsApp Button</h4>
              <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed break-words">
                Enter your WhatsApp number with country code digits (e.g. <code className="break-all">919696262007</code>). Opens a direct WhatsApp chat window with pre-filled greeting.
              </p>
            </div>

            <div className="min-w-0 p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-sm space-y-2">
              <div className="w-9 h-9 rounded-xl bg-amber-50 dark:bg-amber-950/60 border border-amber-200 dark:border-amber-800 text-amber-600 flex items-center justify-center">
                <Zap className="w-4 h-4" />
              </div>
              <h4 className="text-sm font-extrabold text-slate-900 dark:text-white break-words">Free Audit Button</h4>
              <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed break-words">
                Add your landing page or audit URL. If left empty, the button automatically hides so your widget stays ultra-clean.
              </p>
            </div>

            <div className="min-w-0 p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-sm space-y-2">
              <div className="w-9 h-9 rounded-xl bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800 text-rose-600 flex items-center justify-center">
                <Sliders className="w-4 h-4" />
              </div>
              <h4 className="text-sm font-extrabold text-slate-900 dark:text-white break-words">Plans &amp; Pricing</h4>
              <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed break-words">
                Add your pricing table link. Visitors asking about plans can immediately click through to your conversion checkout.
              </p>
            </div>
          </div>
        </section>

        {/* FAQs Section */}
        <section className="max-w-4xl mx-auto min-w-0 px-4 sm:px-6 lg:px-8 mb-16">
          <div className="text-center mb-8">
            <h2 className="text-xs font-extrabold uppercase tracking-widest text-indigo-600 dark:text-indigo-400">
              Frequently Asked Questions
            </h2>
            <p className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white mt-1">
              Common Questions &amp; Troubleshooting
            </p>
          </div>

          <div className="space-y-3">
            {faqs.map((f, fIdx) => {
              const isOpen = openFaq === fIdx;
              return (
                <div
                  key={fIdx}
                  className="min-w-0 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm transition-all"
                >
                  <button
                    type="button"
                    onClick={() => setOpenFaq(isOpen ? null : fIdx)}
                    className="w-full px-5 py-4 text-left flex items-center justify-between gap-4 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
                  >
                    <span className="min-w-0 text-xs sm:text-sm font-extrabold text-slate-900 dark:text-white break-words">
                      {f.q}
                    </span>
                    {isOpen ? (
                      <ChevronUp className="w-4 h-4 text-indigo-600 shrink-0" />
                    ) : (
                      <ChevronDown className="w-4 h-4 text-slate-400 shrink-0" />
                    )}
                  </button>
                  {isOpen && (
                    <div className="min-w-0 px-5 pb-4 pt-1 text-xs text-slate-600 dark:text-slate-400 border-t border-slate-100 dark:border-slate-800 leading-relaxed break-words">
                      {f.a}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>

        {/* Final CTA Strip */}
        <section className="max-w-4xl mx-auto min-w-0 px-4 sm:px-6 lg:px-8 text-center">
          <div className="min-w-0 rounded-3xl p-8 sm:p-10 bg-gradient-to-r from-indigo-900 via-indigo-800 to-purple-900 text-white shadow-xl relative overflow-hidden">
            <h3 className="text-xl sm:text-3xl font-extrabold mb-3 break-words">
              Ready to create your custom AI chatbot?
            </h3>
            <p className="text-xs sm:text-sm text-indigo-200 max-w-xl mx-auto mb-6 leading-relaxed">
              No credit card required. Paste your website URL, let the AI crawl your content, and get your embed script in under 60 seconds.
            </p>
            <Link
              href="/create"
              className="w-full sm:w-auto max-w-full inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-white text-indigo-900 font-extrabold text-xs shadow-lg hover:bg-indigo-50 transition-all hover:scale-105 active:scale-95 cursor-pointer text-center"
            >
              <span>Get Started &mdash; It&apos;s Free</span>
            </Link>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
