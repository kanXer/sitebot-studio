import React from 'react';
import type { Metadata } from 'next';
import Link from 'next/link';
import {
  ShieldCheck,
  FileText,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Scale,
  Users,
  CreditCard,
  Lock,
  HelpCircle,
  ArrowRight,
  Bot,
} from 'lucide-react';
import { Navbar } from '@/components/Navbar';
import { Footer } from '@/components/Footer';

export const metadata: Metadata = {
  title: 'Terms of Service — SiteBot Studio',
  description:
    'Read the official Terms of Service and user agreement for SiteBot Studio AI chatbot platform, website crawler, and embedded widgets.',
};

export default function TermsPage() {
  const lastUpdated = 'September 24, 2026';

  const sections = [
    {
      id: 'acceptance',
      title: '1. Acceptance of Terms',
      icon: Scale,
      content: (
        <>
          <p className="leading-relaxed">
            By accessing or using the SiteBot Studio platform, including our website, dashboard, API services,
            crawler utilities, and embeddable JavaScript chat widgets (collectively, the &ldquo;Service&rdquo;),
            you agree to be bound by these Terms of Service (&ldquo;Terms&rdquo;). If you do not agree to these Terms,
            you may not access or use any part of the Service.
          </p>
          <p className="mt-3 leading-relaxed">
            These Terms apply to all registered users, website owners, site visitors, and administrators who
            interact with our platform or deploy SiteBot Studio widgets on their domains.
          </p>
        </>
      ),
    },
    {
      id: 'service-description',
      title: '2. Description of Service',
      icon: Bot,
      content: (
        <>
          <p className="leading-relaxed">
            SiteBot Studio provides an AI-powered conversational platform allowing customers to:
          </p>
          <ul className="mt-3 space-y-2 pl-5 list-disc text-slate-600 dark:text-slate-300">
            <li>Crawl and extract public textual content from their authorized web domains.</li>
            <li>
              Generate high-dimensional vector embeddings stored in managed vector databases (such as Qdrant)
              for Retrieval-Augmented Generation (RAG).
            </li>
            <li>
              Embed self-contained, isolated Shadow DOM chat widgets onto websites without framework dependencies.
            </li>
            <li>Capture visitor leads, inquiry messages, and contact details with real-time multi-channel alerts.</li>
            <li>
              Connect external LLM providers (including OpenAI, NVIDIA NIM, Google Gemini, and OpenRouter) via Bring Your Own Key (BYOK) or studio managed keys.
            </li>
          </ul>
        </>
      ),
    },
    {
      id: 'accounts',
      title: '3. User Accounts & Security',
      icon: Users,
      content: (
        <>
          <p className="leading-relaxed">
            To create chatbots and manage workspaces, you must register for an account using verified authentication
            (such as Google OAuth or authorized credentials). You represent that the information provided is accurate
            and complete.
          </p>
          <p className="mt-3 leading-relaxed">
            You are solely responsible for maintaining the confidentiality of your credentials, API keys, and session tokens.
            You must promptly notify SiteBot Studio of any unauthorized use or security compromise regarding your account.
          </p>
        </>
      ),
    },
    {
      id: 'subscriptions',
      title: '4. Plans, Quotas & Billing',
      icon: CreditCard,
      content: (
        <>
          <p className="leading-relaxed">
            SiteBot Studio offers free starter tiers and paid recurring subscriptions (such as Pro and Enterprise tiers):
          </p>
          <ul className="mt-3 space-y-2 pl-5 list-disc text-slate-600 dark:text-slate-300">
            <li>
              <strong>Free Starter Plan:</strong> Provides 1 chatbot project, up to 15 crawled pages, 250,000 monthly
              AI tokens, and standard email notifications.
            </li>
            <li>
              <strong>Pro Membership ($9/month):</strong> Unlocks up to 10 chatbot projects, 2,500,000 monthly AI tokens,
              multi-channel alerts (WhatsApp, Telegram, and Email), and priority processing.
            </li>
            <li>
              <strong>Billing &amp; Payments:</strong> Subscription fees are billed in advance on a recurring monthly cycle
              via secure payment gateways (including PayPal). You may cancel renewal at any time directly through your dashboard.
            </li>
            <li>
              <strong>Quota Enforcement:</strong> If your monthly token or conversation quota is exhausted, AI responses
              gracefully pause and fall back to your designated human contact channels until reset or upgrade.
            </li>
          </ul>
        </>
      ),
    },
    {
      id: 'acceptable-use',
      title: '5. Acceptable Use Policy',
      icon: Lock,
      content: (
        <>
          <p className="leading-relaxed">
            You agree not to misuse the Service or assist any third party in doing so. Specifically, you agree NOT to:
          </p>
          <ul className="mt-3 space-y-2 pl-5 list-disc text-slate-600 dark:text-slate-300">
            <li>Submit websites or URLs for crawling that you do not own, control, or have explicit permission to scan.</li>
            <li>Use the chatbot widget to distribute malware, phishing links, hate speech, or defamatory material.</li>
            <li>
              Attempt prompt injection, jailbreaking, or denial-of-service attacks against our platform, vector clusters, or LLM proxies.
            </li>
            <li>Reverse-engineer, decompile, or copy the proprietary Shadow DOM widget source or crawler algorithms.</li>
            <li>Bypass domain origin verification or sliding-window rate limiters.</li>
          </ul>
        </>
      ),
    },
    {
      id: 'ai-disclaimer',
      title: '6. AI Output & Verification Disclaimer',
      icon: AlertTriangle,
      content: (
        <>
          <p className="leading-relaxed">
            SiteBot Studio utilizes advanced Large Language Models and vector retrieval to generate conversational responses.
            While our platform incorporates strict anti-hallucination guardrails and knowledge base grounding, generative AI
            outputs may occasionally contain inaccuracies or incomplete answers.
          </p>
          <p className="mt-3 leading-relaxed">
            You acknowledge that SiteBot Studio is not a substitute for licensed legal, medical, or financial counsel.
            Website owners are encouraged to review their chatbot suggested questions, prompts, and knowledge chunks
            regularly in the Bot Studio playground.
          </p>
        </>
      ),
    },
    {
      id: 'intellectual-property',
      title: '7. Intellectual Property & Data Ownership',
      icon: ShieldCheck,
      content: (
        <>
          <p className="leading-relaxed">
            <strong>Your Content:</strong> You retain full copyright and ownership over all website copy, brand assets, logos,
            and customer inquiries captured by your chatbots.
          </p>
          <p className="mt-3 leading-relaxed">
            <strong>Our Technology:</strong> SiteBot Studio, its logos, Shadow DOM widget engine, crawling infrastructure,
            and software interfaces remain the exclusive intellectual property of SiteBot Studio and its licensors.
          </p>
        </>
      ),
    },
    {
      id: 'limitation-of-liability',
      title: '8. Limitation of Liability',
      icon: Scale,
      content: (
        <>
          <p className="leading-relaxed">
            To the maximum extent permitted by applicable law, SiteBot Studio and its affiliates shall not be liable for any
            indirect, incidental, special, consequential, or punitive damages, including loss of profits, data, goodwill,
            or service interruptions arising from your use of or inability to use the Service.
          </p>
          <p className="mt-3 leading-relaxed">
            The Service is provided on an &ldquo;AS IS&rdquo; and &ldquo;AS AVAILABLE&rdquo; basis without warranties of any kind,
            either express or implied.
          </p>
        </>
      ),
    },
    {
      id: 'contact',
      title: '9. Contact & Inquiries',
      icon: HelpCircle,
      content: (
        <>
          <p className="leading-relaxed">
            If you have questions, concerns, or legal notices regarding these Terms of Service, please reach out to our team:
          </p>
          <div className="mt-4 p-4 rounded-2xl bg-slate-100 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 text-xs">
            <p className="font-bold text-slate-900 dark:text-white">SiteBot Studio Legal Department</p>
            <p className="text-slate-600 dark:text-slate-300 mt-1">Email: support@sitebotstudio.com</p>
            <p className="text-slate-600 dark:text-slate-300">Website: https://sitebotstudio.com</p>
          </div>
        </>
      ),
    },
  ];

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col selection:bg-indigo-500 selection:text-white">
      <Navbar />

      <main className="flex-1 pb-28 sm:pb-20">
        {/* Hero Section */}
        <section className="relative pt-12 pb-12 px-4 sm:px-6 lg:px-8 max-w-4xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200 dark:border-indigo-800/80 text-indigo-700 dark:text-indigo-300 text-xs font-bold mb-4">
            <FileText className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
            <span>Legal Documentation &amp; User Agreement</span>
          </div>

          <h1 className="text-3xl sm:text-5xl font-black tracking-tight text-slate-900 dark:text-white font-heading">
            Terms of Service
          </h1>

          <p className="mt-3 text-xs sm:text-sm text-slate-500 dark:text-slate-400 flex items-center justify-center gap-1.5">
            <Clock className="w-4 h-4 text-slate-400" />
            <span>Last updated: {lastUpdated}</span>
          </p>

          <p className="mt-4 text-xs sm:text-sm text-slate-600 dark:text-slate-400 leading-relaxed max-w-2xl mx-auto">
            Please read these terms carefully before deploying our chatbots, crawling your website, or subscribing to our
            services. These terms ensure a reliable, safe, and transparent environment for all users.
          </p>
        </section>

        {/* Terms Content Sections */}
        <section className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6">
          {sections.map((sec) => (
            <div
              key={sec.id}
              id={sec.id}
              className="rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 p-6 sm:p-8 shadow-sm transition-all"
            >
              <div className="flex items-center gap-3 mb-4 pb-3 border-b border-slate-100 dark:border-slate-800">
                <div className="w-9 h-9 rounded-xl bg-indigo-50 dark:bg-indigo-950/70 border border-indigo-100 dark:border-indigo-900 flex items-center justify-center text-indigo-600 dark:text-indigo-400 shrink-0">
                  <sec.icon className="w-4 h-4" />
                </div>
                <h2 className="text-base sm:text-lg font-extrabold text-slate-900 dark:text-white font-heading">
                  {sec.title}
                </h2>
              </div>

              <div className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                {sec.content}
              </div>
            </div>
          ))}
        </section>

        {/* Quick Contact & Questions Footer Box */}
        <section className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 mt-12 text-center">
          <div className="rounded-3xl p-6 sm:p-8 bg-gradient-to-r from-indigo-900 via-indigo-950 to-slate-950 text-white shadow-xl flex flex-col sm:flex-row items-center justify-between gap-6 text-left">
            <div>
              <h3 className="text-base sm:text-lg font-extrabold">Have questions about our terms?</h3>
              <p className="text-xs text-indigo-200 mt-1 max-w-md">
                Our support and compliance team is available to assist with custom enterprise licensing, SLA agreements, or data processing questions.
              </p>
            </div>
            <Link
              href="/contact"
              className="px-5 py-2.5 rounded-xl bg-white text-indigo-900 font-extrabold text-xs shadow-md hover:bg-indigo-50 transition-all hover:scale-105 active:scale-95 shrink-0 inline-flex items-center gap-1.5"
            >
              <span>Contact Support</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
