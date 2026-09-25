import React from 'react';
import type { Metadata } from 'next';
import Link from 'next/link';
import {
  Mail,
  MessageCircle,
  Phone,
  Clock,
  HelpCircle,
  ShieldCheck,
  CheckCircle2,
  Globe,
  ArrowRight,
  ExternalLink,
} from 'lucide-react';
import { Navbar } from '@/components/Navbar';
import { Footer } from '@/components/Footer';
import { ContactForm } from '@/components/ContactForm';

export const metadata: Metadata = {
  title: 'Contact Us — Enterprise AI Sales & Support',
  description:
    'Get in touch with the SiteBot Studio team for enterprise deployments, custom AI integrations, technical support, or partnership inquiries.',
  keywords: [
    'Contact SiteBot Studio',
    'AI Chatbot Support',
    'Enterprise AI Integrations',
    'SiteBot Customer Service',
    'AI Website Widget Help',
  ],
  openGraph: {
    title: 'Contact SiteBot Studio — Enterprise AI Sales & Support',
    description:
      'Have questions about enterprise deployment or embedding SiteBot on complex platforms? Contact our engineering team.',
    url: 'https://sitebotstudio.com/contact',
    images: [{ url: '/og-image.jpg', width: 1200, height: 630, alt: 'Contact SiteBot Studio' }],
  },
};

export default function ContactPage() {
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'ContactPage',
    name: 'Contact SiteBot Studio',
    description: 'Contact our engineering and enterprise AI sales team.',
    publisher: {
      '@type': 'Organization',
      name: 'SiteBot Studio',
      logo: 'https://sitebotstudio.com/logo.png',
    },
  };

  const FAQS = [
    {
      q: 'Will SiteBot conflict with my existing website CSS?',
      a: 'Never. SiteBot is encapsulated inside a native Shadow DOM root. Host site styles from Tailwind, Bootstrap, or custom CSS cannot penetrate into the widget, and widget styles will never alter your host layout.',
    },
    {
      q: 'Can I bring my own OpenAI or NVIDIA API keys?',
      a: 'Yes. SiteBot Studio features full BYOK (Bring Your Own Key) support with client-side key masking and AES server encryption. You can also use our built-in test sandbox credentials.',
    },
    {
      q: 'How long does it take to crawl and vectorize my website?',
      a: 'Most websites with 10–25 pages are scraped, cleaned, chunked, and vectorized into Qdrant within 30 to 60 seconds with live Server-Sent Events (SSE) progress tracking.',
    },
    {
      q: 'What platforms can I embed SiteBot on?',
      a: 'Any website with HTML access. We officially support WordPress, Shopify, Webflow, React, Next.js, Vue, Wix, Squarespace, and custom HTML/PHP sites with a single <script> tag.',
    },
  ];

  return (
    <div className="min-h-screen min-w-0 overflow-x-clip bg-slate-50 text-slate-900 font-sans flex flex-col selection:bg-indigo-500 selection:text-white">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <Navbar />

      <main className="flex-1 min-w-0">
        {/* Header Hero */}
        <section className="pt-16 pb-12 lg:pt-20 lg:pb-16 bg-gradient-to-b from-white to-slate-50 border-b border-slate-200/80">
          <div className="max-w-7xl mx-auto min-w-0 px-4 sm:px-6 lg:px-8 text-center space-y-4">
            <div className="inline-flex max-w-full flex-wrap items-center justify-center gap-2 px-3.5 py-1.5 rounded-full bg-indigo-50 border border-indigo-200 text-indigo-700 text-xs font-bold shadow-sm text-center leading-relaxed">
              <span>We&apos;re Here to Help</span>
            </div>

            <h1 className="text-4xl sm:text-5xl font-extrabold text-slate-950 tracking-tight break-words">
              Get in Touch with{' '}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 to-purple-600">
                SiteBot Studio
              </span>
            </h1>

            <p className="text-sm sm:text-base text-slate-600 max-w-2xl mx-auto leading-relaxed break-words">
              Have questions about integrating SiteBot on your platform, setting up custom Qdrant vector databases, or enterprise licensing? Our engineers are ready to assist you.
            </p>
          </div>
        </section>

        {/* Form + Channel Cards Grid */}
        <section className="py-16 max-w-7xl mx-auto min-w-0 px-4 sm:px-6 lg:px-8">
          <div className="grid min-w-0 grid-cols-1 lg:grid-cols-12 gap-10 items-start">
            {/* Left: Contact Form (7 cols) */}
            <div className="min-w-0 lg:col-span-7">
              <ContactForm />
            </div>

            {/* Right: Direct Channels & Guarantee (5 cols) */}
            <div className="min-w-0 lg:col-span-5 space-y-6">
              {/* Direct Support Channels */}
              <div className="min-w-0 bg-white rounded-3xl p-7 border border-slate-200/80 shadow-sm space-y-5">
                <h3 className="min-w-0 text-sm font-bold uppercase tracking-wider text-slate-900 flex items-center gap-2 break-words">
                  <Globe className="w-4 h-4 text-indigo-600" />
                  Direct Channels
                </h3>

                <div className="space-y-4">
                  <a
                    href="mailto:support@sitebotstudio.com"
                    className="flex min-w-0 items-start gap-3.5 p-3.5 rounded-2xl bg-slate-50 hover:bg-indigo-50/60 border border-slate-200 hover:border-indigo-200 transition-colors group"
                  >
                    <div className="w-10 h-10 rounded-xl bg-indigo-100 text-indigo-600 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                      <Mail className="w-5 h-5" />
                    </div>
                    <div className="min-w-0">
                      <span className="text-[11px] font-bold text-slate-500 block uppercase">Technical Support</span>
                      <span className="min-w-0 text-xs font-bold text-slate-900 group-hover:text-indigo-600 transition-colors break-all">
                        support@sitebotstudio.com
                      </span>
                      <p className="min-w-0 text-[11px] text-slate-500 mt-0.5 break-words">Assistance with embedding, crawling, and RAG configuration</p>
                    </div>
                  </a>

                  <a
                    href="https://wa.me/919696262007"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex min-w-0 items-start gap-3.5 p-3.5 rounded-2xl bg-slate-50 hover:bg-emerald-50/60 border border-slate-200 hover:border-emerald-200 transition-colors group"
                  >
                    <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                      <MessageCircle className="w-5 h-5" />
                    </div>
                    <div className="min-w-0">
                      <span className="text-[11px] font-bold text-slate-500 block uppercase">WhatsApp Direct</span>
                      <span className="min-w-0 text-xs font-bold text-slate-900 group-hover:text-emerald-700 transition-colors break-words">
                        +91 96962 62007
                      </span>
                      <p className="min-w-0 text-[11px] text-slate-500 mt-0.5 break-words">Quick answers for sales and urgent integration inquiries</p>
                    </div>
                  </a>

                  <div className="flex items-start gap-3.5 p-3.5 rounded-2xl bg-slate-50 border border-slate-200">
                    <div className="w-10 h-10 rounded-xl bg-purple-100 text-purple-600 flex items-center justify-center shrink-0">
                      <Clock className="w-5 h-5" />
                    </div>
                    <div className="min-w-0">
                      <span className="text-[11px] font-bold text-slate-500 block uppercase">Response Guarantee</span>
                      <span className="min-w-0 text-xs font-bold text-slate-900 break-words">Under 2 Hours</span>
                      <p className="min-w-0 text-[11px] text-slate-500 mt-0.5 break-words">Standard support hours: Mon &ndash; Sat, 9:00 AM &ndash; 8:00 PM IST</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Live Sandbox Quick Test */}
              <div className="min-w-0 p-6 rounded-3xl bg-gradient-to-tr from-slate-900 to-indigo-950 text-white shadow-xl space-y-3">
                <div className="flex min-w-0 flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <h4 className="min-w-0 text-sm font-bold flex items-center gap-2 break-words">
                    Try Before You Contact
                  </h4>
                  <span className="self-start sm:self-auto shrink-0 text-[10px] uppercase font-bold px-2 py-0.5 rounded bg-white/10 border border-white/15">
                    Live Demo
                  </span>
                </div>
                <p className="text-xs text-slate-300 leading-relaxed">
                  Want to see the floating launcher, chat animations, and knowledge search in action right now? Launch the demo sandbox in seconds.
                </p>
                <Link
                  href="/"
                  className="inline-flex items-center gap-1.5 text-xs font-bold text-indigo-300 hover:text-white transition-colors"
                >
                  <span>Build your bot now</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>
            </div>
          </div>
        </section>

        {/* FAQs */}
        <section className="py-16 bg-white border-t border-slate-200">
          <div className="max-w-4xl mx-auto min-w-0 px-4 sm:px-6 lg:px-8">
            <div className="text-center max-w-xl mx-auto mb-12 space-y-2">
              <h2 className="min-w-0 text-xs font-bold uppercase tracking-wider text-indigo-600 flex items-center justify-center gap-1.5 break-words">
                <HelpCircle className="w-4 h-4" />
                Frequently Asked Questions
              </h2>
              <p className="min-w-0 text-2xl font-extrabold text-slate-900 break-words">
                Common Questions &amp; Integration Details
              </p>
            </div>

            <div className="grid min-w-0 grid-cols-1 md:grid-cols-2 gap-6">
              {FAQS.map((faq, idx) => (
                <div
                  key={idx}
                  className="min-w-0 p-6 rounded-2xl bg-slate-50 border border-slate-200 space-y-2"
                >
                  <h3 className="min-w-0 text-xs font-bold text-slate-900 flex items-start gap-2 break-words">
                    <span className="text-indigo-600 font-extrabold">Q.</span>
                    <span className="min-w-0 break-words">{faq.q}</span>
                  </h3>
                  <p className="min-w-0 text-xs text-slate-600 leading-relaxed pl-4 break-words">
                    {faq.a}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
