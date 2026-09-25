'use client';

import React from 'react';
import Link from 'next/link';
import { Check, Bot, Rocket } from 'lucide-react';
import { PLANS, formatMoney } from '@/lib/plans';
import { CTALeadForm } from '@/components/CTALeadForm';
import { Navbar } from '@/components/Navbar';
import { Footer } from '@/components/Footer';

const FAQS = [
  {
    q: 'What happens when I hit my token or chat quota?',
    a: 'The Free plan includes 250K tokens and 5,000 chat messages every month. When you reach either limit, the chatbot gracefully pauses AI answers and connects visitors to your team instead. Upgrade to Pro anytime for 10x the usage.',
  },
  {
    q: 'How do lead notifications work?',
    a: 'Whenever a visitor shares contact details in your chat widget or submits a CTA form, you get an instant alert by email, WhatsApp, and/or Telegram — with your project name right in the message so you always know the source.',
  },
  {
    q: 'Can I upgrade from within my dashboard?',
    a: 'Yes. Open your Account Dashboard and click "Upgrade to Pro". Payment is processed securely through PayPal and your plan is upgraded instantly.',
  },
  {
    q: 'Can I cancel my subscription?',
    a: 'Absolutely. You can cancel anytime from your dashboard. Your Pro perks remain active until the end of your current billing month, then your account returns to the Free plan.',
  },
];

function ContactCTAForm({ plan }: { plan: string }) {
  return (
    <CTALeadForm
      campaign={`pricing-${plan.toLowerCase()}`}
      source="pricing_page_cta"
      submitLabel="Request this plan"
    />
  );
}

export default function PricingPage() {
  const plans = [PLANS.free, PLANS.pro];

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col">
      <Navbar />

      {/* Hero */}
      <section className="relative overflow-hidden pt-12 pb-12 text-center px-4">
        <div className="absolute inset-0 bg-gradient-to-b from-indigo-50 dark:from-indigo-950/30 to-transparent pointer-events-none" />
        <div className="relative max-w-3xl mx-auto">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 text-[11px] font-bold mb-5">
            Simple, transparent pricing
          </span>
          <h1 className="text-4xl sm:text-5xl font-extrabold text-slate-900 dark:text-white font-heading tracking-tight">
            AI chatbots that{' '}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 to-purple-600">
              deliver leads
            </span>
          </h1>
          <p className="text-sm sm:text-base text-slate-500 dark:text-slate-400 mt-4 max-w-xl mx-auto">
            Start free with 1 chatbot. Upgrade when your business grows — every lead you capture
            is saved to your dashboard and instantly delivered to your email, WhatsApp, or Telegram.
          </p>
        </div>
      </section>

      {/* Plan cards */}
      <section className="max-w-5xl mx-auto px-4 sm:px-6 pb-16">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-stretch">
          {plans.map((plan) => {
            const isPro = plan.id === 'pro';
            return (
              <div
                key={plan.id}
                className={`relative flex flex-col rounded-3xl border p-8 shadow-sm transition-all ${
                  isPro
                    ? 'bg-gradient-to-b from-indigo-600 to-purple-700 text-white border-transparent shadow-xl shadow-purple-600/25 md:scale-[1.03]'
                    : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800'
                }`}
              >
                {isPro && (
                  <span className="absolute -top-3.5 left-1/2 -translate-x-1/2 px-3.5 py-1 rounded-full bg-white text-indigo-700 text-[10px] font-extrabold uppercase tracking-wider shadow-md">
                    Most Popular
                  </span>
                )}

                <div className="flex items-center gap-2 mb-3">
                  {isPro ? (
                    <Rocket className="w-5 h-5 text-white" />
                  ) : (
                    <Bot className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                  )}
                  <h2 className={`text-lg font-extrabold font-heading ${isPro ? 'text-white' : 'text-slate-900 dark:text-white'}`}>
                    {plan.label}
                  </h2>
                </div>

                <p className={`text-[11px] ${isPro ? 'text-indigo-100' : 'text-slate-500 dark:text-slate-400'}`}>
                  {isPro
                    ? 'For growing businesses that need multiple bots & advanced alerts.'
                    : 'Perfect for trying out your first AI website assistant.'}
                </p>

                <div className="mt-5 mb-6">
                  <span className={`text-4xl font-extrabold font-heading ${isPro ? 'text-white' : 'text-slate-900 dark:text-white'}`}>
                    {plan.monthlyPrice === 0 ? '$0' : formatMoney(plan.monthlyPrice)}
                  </span>
                  <span className={`text-xs font-semibold ${isPro ? 'text-indigo-100' : 'text-slate-400'}`}>
                    {' '}/ month per account
                  </span>
                </div>

                <ul className="space-y-2.5 flex-1 mb-7">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-start gap-2.5">
                      <Check className={`w-4 h-4 mt-0.5 shrink-0 ${isPro ? 'text-white' : 'text-emerald-600'}`} />
                      <span className={`text-xs font-semibold ${isPro ? 'text-white/95' : 'text-slate-700 dark:text-slate-200'}`}>
                        {f}
                      </span>
                    </li>
                  ))}
                </ul>

                {isPro ? (
                  <Link
                    href="/dashboard"
                    className="w-full py-3 rounded-2xl bg-white text-indigo-700 text-sm font-extrabold text-center shadow-lg hover:scale-[1.01] transition-all"
                  >
                    Upgrade from Dashboard
                  </Link>
                ) : (
                  <Link
                    href="/create"
                    className="w-full py-3 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 text-sm font-extrabold text-center border border-slate-200 dark:border-slate-700 hover:scale-[1.01] transition-all"
                  >
                    Start Free
                  </Link>
                )}
              </div>
            );
          })}
        </div>

        <p className="text-center text-[11px] text-slate-400 mt-6">
          Prices in USD. One-time subscriptions billed monthly. Upgrade, downgrade, or cancel anytime.
        </p>
      </section>

      {/* CTA lead forms */}
      <section className="max-w-5xl mx-auto px-4 sm:px-6 pb-20">
        <div className="rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-8">
          <div className="text-center mb-7">
            <h2 className="text-2xl font-extrabold text-slate-900 dark:text-white font-heading">
              Not sure which plan fits?
            </h2>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-2">
              Leave your details and our team will help you pick the right setup for your business.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="rounded-2xl border border-slate-200 dark:border-slate-800 p-6">
              <p className="text-xs font-bold text-slate-800 dark:text-slate-100 mb-1 flex items-center gap-2">
                <Bot className="w-4 h-4 text-indigo-600" /> Free plan help
              </p>
              <p className="text-[11px] text-slate-400 mb-4">Getting started with your first bot</p>
              <ContactCTAForm plan="Free" />
            </div>
            <div className="rounded-2xl border border-slate-200 dark:border-slate-800 p-6">
              <p className="text-xs font-bold text-slate-800 dark:text-slate-100 mb-1 flex items-center gap-2">
                <Rocket className="w-4 h-4 text-purple-600" /> Talk to sales
              </p>
              <p className="text-[11px] text-slate-400 mb-4">Multi-bot teams, agencies & Pro queries</p>
              <ContactCTAForm plan="Pro" />
            </div>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="max-w-3xl mx-auto px-4 sm:px-6 pb-24">
        <h2 className="text-2xl font-extrabold text-slate-900 dark:text-white font-heading text-center mb-8">
          Frequently Asked Questions
        </h2>
        <div className="space-y-3">
          {FAQS.map((f) => (
            <details
              key={f.q}
              className="group rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 open:border-indigo-300 dark:open:border-indigo-800 transition-all"
            >
              <summary className="flex items-center justify-between cursor-pointer list-none">
                <span className="text-sm font-bold text-slate-800 dark:text-slate-100">{f.q}</span>
                <span className="w-6 h-6 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-500 group-open:rotate-45 transition-transform shrink-0 ml-3">
                  +
                </span>
              </summary>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-3 leading-relaxed">{f.a}</p>
            </details>
          ))}
        </div>
      </section>

      <Footer />
    </div>
  );
}