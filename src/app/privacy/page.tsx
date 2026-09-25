import React from 'react';
import type { Metadata } from 'next';
import Link from 'next/link';
import {
  ShieldCheck,
  Lock,
  Clock,
  CheckCircle2,
  Database,
  Eye,
  Key,
  Globe,
  FileCheck,
  HelpCircle,
  ArrowRight,
  Server,
} from 'lucide-react';
import { Navbar } from '@/components/Navbar';
import { Footer } from '@/components/Footer';

export const metadata: Metadata = {
  title: 'Privacy Policy — SiteBot Studio',
  description:
    'Learn how SiteBot Studio collects, processes, and protects your personal data, scraped website content, vector embeddings, and customer leads.',
};

export default function PrivacyPage() {
  const lastUpdated = 'September 24, 2026';

  const sections = [
    {
      id: 'overview',
      title: '1. Overview & Commitment to Privacy',
      icon: ShieldCheck,
      content: (
        <>
          <p className="leading-relaxed">
            At SiteBot Studio (&ldquo;we&rdquo;, &ldquo;us&rdquo;, or &ldquo;our&rdquo;), we take your privacy and the security of
            your data seriously. This Privacy Policy describes how we collect, use, store, and disclose information
            when you use our website, developer APIs, web crawling tools, user dashboard, and embedded chatbot widgets
            (collectively, the &ldquo;Platform&rdquo;).
          </p>
          <p className="mt-3 leading-relaxed">
            We are committed to operating transparently, adhering to global privacy regulations including the General Data
            Protection Regulation (GDPR) and the California Consumer Privacy Act (CCPA).
          </p>
        </>
      ),
    },
    {
      id: 'information-collected',
      title: '2. Information We Collect',
      icon: Eye,
      content: (
        <>
          <p className="leading-relaxed">
            We collect the following categories of information to provide and operate the Platform:
          </p>
          <ul className="mt-3 space-y-2 pl-5 list-disc text-slate-600 dark:text-slate-300">
            <li>
              <strong>Account &amp; Profile Details:</strong> When you register or authenticate via Google OAuth or credentials,
              we collect your email address, display name, profile avatar photo, and chosen workspace plan.
            </li>
            <li>
              <strong>Website Content &amp; URLs:</strong> When you submit a domain to create an AI assistant, our crawler
              extracts public page text, headings, metadata, FAQs, and contact links to generate your knowledge base.
            </li>
            <li>
              <strong>Customer Leads &amp; Form Inquiries:</strong> Any contact information (such as visitor names, emails,
              phone numbers, and messages) submitted through your live chat widget or CTA forms is stored in your private
              tenant database.
            </li>
            <li>
              <strong>Operational Telemetry:</strong> Log data including client IP addresses (anonymized), browser user agents,
              referral origins, and token usage counts to ensure rate limiting and system integrity.
            </li>
          </ul>
        </>
      ),
    },
    {
      id: 'vector-processing',
      title: '3. Vector Embeddings & AI Processing',
      icon: Database,
      content: (
        <>
          <p className="leading-relaxed">
            When your website is scanned, extracted textual segments are transformed into high-dimensional vector representations
            (768d or 1536d embeddings) and indexed in our isolated Qdrant vector database collections.
          </p>
          <div className="min-w-0 mt-3 p-4 rounded-2xl bg-indigo-50/50 dark:bg-indigo-950/40 border border-indigo-100 dark:border-indigo-900/60 text-xs">
            <p className="font-bold text-indigo-900 dark:text-indigo-200">Zero AI Model Training Guarantee</p>
            <p className="text-slate-600 dark:text-slate-300 mt-1 leading-relaxed">
              We do <strong>NOT</strong> use your private customer chat logs, website knowledge chunks, or captured leads to train
              or fine-tune public foundation AI models. Your content is strictly used for real-time Retrieval-Augmented Generation (RAG)
              exclusively for your specific chatbots.
            </p>
          </div>
        </>
      ),
    },
    {
      id: 'byok-security',
      title: '4. API Key Protection & BYOK Security',
      icon: Key,
      content: (
        <>
          <p className="leading-relaxed">
            SiteBot Studio supports Bring Your Own Key (BYOK) for OpenAI, NVIDIA NIM, Google Gemini, and OpenRouter:
          </p>
          <ul className="mt-3 space-y-2 pl-5 list-disc text-slate-600 dark:text-slate-300">
            <li>Customer API keys are encrypted at rest using AES-256 standard encryption before storage.</li>
            <li>Decryption only occurs transiently in-memory on our edge servers when an authorized chat query is dispatched.</li>
            <li>API keys are never logged in plaintext and are never exposed to browser clients or chatbot visitors.</li>
          </ul>
        </>
      ),
    },
    {
      id: 'subprocessors',
      title: '5. Third-Party Service Providers',
      icon: Server,
      content: (
        <>
          <p className="leading-relaxed">
            We partner with trusted third-party service providers to power our infrastructure:
          </p>
          <ul className="mt-3 space-y-2 pl-5 list-disc text-slate-600 dark:text-slate-300">
            <li>
              <strong>Inference Providers:</strong> OpenAI, NVIDIA NIM, and Google Cloud Vertex AI (for generative language modeling).
            </li>
            <li>
              <strong>Vector Database:</strong> Qdrant Cloud (for isolated, high-speed cosine vector search).
            </li>
            <li>
              <strong>Payment Gateways:</strong> PayPal (for PCI-compliant, secure subscription processing).
            </li>
            <li>
              <strong>Notification Dispatchers:</strong> Resend / SendGrid (for email notifications) and official WhatsApp / Telegram Webhook APIs.
            </li>
          </ul>
        </>
      ),
    },
    {
      id: 'retention-deletion',
      title: '6. Data Retention & Your Rights',
      icon: FileCheck,
      content: (
        <>
          <p className="leading-relaxed">
            You retain complete control over your data at all times:
          </p>
          <ul className="mt-3 space-y-2 pl-5 list-disc text-slate-600 dark:text-slate-300">
            <li>
              <strong>Right to Deletion:</strong> Whenever you delete a chatbot from your dashboard, its configuration,
              conversation history, and vector embeddings in Qdrant are permanently purged.
            </li>
            <li>
              <strong>Right to Access &amp; Portability:</strong> You can view, search, and export all captured customer leads
              directly from your dashboard CRM table at any time.
            </li>
            <li>
              <strong>Account Removal:</strong> You may request the full closure of your user account and removal of all associated
              records by contacting <span className="break-all">support@sitebotstudio.com</span>.
            </li>
          </ul>
        </>
      ),
    },
    {
      id: 'security',
      title: '7. Security Safeguards',
      icon: Lock,
      content: (
        <>
          <p className="leading-relaxed">
            We employ modern multi-layered security controls to protect your data, including:
          </p>
          <ul className="mt-3 space-y-2 pl-5 list-disc text-slate-600 dark:text-slate-300">
            <li>Enforced HTTPS / TLS 1.3 encryption across all website and API endpoints.</li>
            <li>Shadow DOM isolation to eliminate client-side script pollution or data scraping.</li>
            <li>Strict HTTP Origin whitelisting to block unauthorized domains from invoking your chatbot endpoints.</li>
            <li>Sliding-window IP and token rate limiters to defend against abuse and automated scrapers.</li>
          </ul>
        </>
      ),
    },
    {
      id: 'contact',
      title: '8. Privacy Inquiries & Contact',
      icon: HelpCircle,
      content: (
        <>
          <p className="leading-relaxed">
            If you have questions regarding this Privacy Policy or wish to exercise your legal data rights, please contact our
            Data Protection Officer:
          </p>
          <div className="min-w-0 mt-4 p-4 rounded-2xl bg-slate-100 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 text-xs">
            <p className="font-bold text-slate-900 dark:text-white">SiteBot Studio Privacy Office</p>
            <p className="text-slate-600 dark:text-slate-300 mt-1">Email: <span className="break-all">privacy@sitebotstudio.com</span></p>
            <p className="text-slate-600 dark:text-slate-300">Support: <span className="break-all">support@sitebotstudio.com</span></p>
          </div>
        </>
      ),
    },
  ];

  return (
    <div className="min-h-screen min-w-0 overflow-x-clip bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col selection:bg-indigo-500 selection:text-white">
      <Navbar />

      <main className="flex-1 min-w-0 pb-28 sm:pb-20">
        {/* Hero Section */}
        <section className="relative min-w-0 pt-12 pb-12 px-4 sm:px-6 lg:px-8 max-w-4xl mx-auto text-center">
          <div className="inline-flex max-w-full flex-wrap items-center justify-center gap-2 px-3.5 py-1.5 rounded-full bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800/80 text-emerald-700 dark:text-emerald-300 text-xs font-bold mb-4 text-center leading-relaxed">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
            <span>Data Protection &amp; Privacy Standards</span>
          </div>

          <h1 className="text-3xl sm:text-5xl font-black tracking-tight text-slate-900 dark:text-white font-heading break-words">
            Privacy Policy
          </h1>

          <p className="mt-3 text-xs sm:text-sm text-slate-500 dark:text-slate-400 flex min-w-0 flex-wrap items-center justify-center gap-1.5 text-center">
            <Clock className="w-4 h-4 text-slate-400" />
            <span className="min-w-0 break-words">Last updated: {lastUpdated}</span>
          </p>

          <p className="mt-4 text-xs sm:text-sm text-slate-600 dark:text-slate-400 leading-relaxed max-w-2xl mx-auto break-words">
            Your privacy matters to us. We never sell your personal data, never train public models on your private
            content, and protect all customer records with enterprise-grade encryption.
          </p>
        </section>

        {/* Policy Sections */}
        <section className="max-w-4xl mx-auto min-w-0 px-4 sm:px-6 lg:px-8 space-y-6">
          {sections.map((sec) => (
            <div
              key={sec.id}
              id={sec.id}
              className="min-w-0 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 p-6 sm:p-8 shadow-sm transition-all"
            >
              <div className="flex min-w-0 items-center gap-3 mb-4 pb-3 border-b border-slate-100 dark:border-slate-800">
                <div className="w-9 h-9 rounded-xl bg-emerald-50 dark:bg-emerald-950/70 border border-emerald-100 dark:border-emerald-900 flex items-center justify-center text-emerald-600 dark:text-emerald-400 shrink-0">
                  <sec.icon className="w-4 h-4" />
                </div>
                <h2 className="min-w-0 text-base sm:text-lg font-extrabold text-slate-900 dark:text-white font-heading break-words">
                  {sec.title}
                </h2>
              </div>

              <div className="min-w-0 text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed break-words">
                {sec.content}
              </div>
            </div>
          ))}
        </section>

        {/* Privacy Inquiries Card */}
        <section className="max-w-4xl mx-auto min-w-0 px-4 sm:px-6 lg:px-8 mt-12 text-center">
          <div className="min-w-0 rounded-3xl p-6 sm:p-8 bg-gradient-to-r from-emerald-950 via-slate-900 to-indigo-950 text-white shadow-xl flex flex-col sm:flex-row items-center justify-between gap-6 text-left border border-emerald-900/30">
            <div className="min-w-0">
              <h3 className="text-base sm:text-lg font-extrabold break-words">Need custom DPA or GDPR compliance documentation?</h3>
              <p className="min-w-0 text-xs text-emerald-200 mt-1 max-w-md break-words">
                We provide signed Data Processing Addendums (DPA) and SOC2 security verification upon request for enterprise plans.
              </p>
            </div>
            <Link
              href="/contact"
              className="w-full sm:w-auto max-w-full px-5 py-2.5 rounded-xl bg-white text-slate-900 font-extrabold text-xs shadow-md hover:bg-slate-100 transition-all hover:scale-105 active:scale-95 shrink-0 inline-flex items-center justify-center gap-1.5 text-center"
            >
              <span>Request DPA</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
