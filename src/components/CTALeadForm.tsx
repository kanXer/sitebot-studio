'use client';

import React, { useState } from 'react';
import { Loader2, Send, CheckCircle2 } from 'lucide-react';

interface CTALeadFormProps {
  campaign: string;
  source?: string;
  submitLabel?: string;
  heading?: string;
  subtext?: string;
  siteUrl?: string;
}

export function CTALeadForm({
  campaign,
  source = 'website_cta_form',
  submitLabel = 'Send my details',
  heading,
  subtext,
  siteUrl,
}: CTALeadFormProps) {
  const [form, setForm] = useState({ name: '', email: '', phone: '', message: '' });
  const [status, setStatus] = useState<'idle' | 'loading' | 'done' | 'error'>('idle');
  const [error, setError] = useState('');

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name && !form.email && !form.phone) {
      setStatus('error');
      setError('Please enter at least your name or a contact email/phone.');
      return;
    }
    setStatus('loading');
    setError('');
    try {
      const res = await fetch('/api/cta', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name,
          email: form.email,
          phone: form.phone,
          message: form.message,
          campaign,
          page: typeof window !== 'undefined' ? window.location.pathname : '',
          source,
          siteUrl,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Submission failed');
      setStatus('done');
      setForm({ name: '', email: '', phone: '', message: '' });
    } catch (err: unknown) {
      setStatus('error');
      setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.');
    }
  };

  if (status === 'done') {
    return (
      <div className="text-center py-8">
        <div className="w-12 h-12 mx-auto rounded-2xl bg-emerald-100 dark:bg-emerald-950 flex items-center justify-center text-emerald-600 mb-3">
          <CheckCircle2 className="w-6 h-6" />
        </div>
        <p className="text-sm font-bold text-slate-900 dark:text-white font-heading">Thank you!</p>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
          Your details have been received. Our team will reach out shortly.
        </p>
      </div>
    );
  }

  const input =
    'w-full px-3.5 py-2.5 text-xs rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-500/20 transition-all';

  return (
    <div>
      {(heading || subtext) && (
        <div className="mb-4">
          {heading && (
            <p className="text-sm font-bold text-slate-800 dark:text-slate-100">{heading}</p>
          )}
          {subtext && (
            <p className="text-[11px] text-slate-500 dark:text-slate-400">{subtext}</p>
          )}
        </div>
      )}
      <form onSubmit={submit} className="space-y-3">
        <div>
          <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5">
            Name *
          </label>
          <input
            className={input}
            placeholder="Your full name"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            required
          />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5">
              Email <span className="text-slate-300 dark:text-slate-600">(optional)</span>
            </label>
            <input
              className={input}
              type="email"
              placeholder="you@company.com"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
            />
          </div>
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5">
              Phone <span className="text-slate-300 dark:text-slate-600">(optional)</span>
            </label>
            <input
              className={input}
              placeholder="+91 …"
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
            />
          </div>
        </div>
        <div>
          <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5">
            Message <span className="text-slate-300 dark:text-slate-600">(optional)</span>
          </label>
          <textarea
            className={`${input} resize-none`}
            rows={3}
            placeholder="Tell us how we can help…"
            value={form.message}
            onChange={(e) => setForm({ ...form, message: e.target.value })}
          />
        </div>
        {status === 'error' && (
          <p className="text-[11px] text-rose-600 dark:text-rose-400 font-semibold">{error}</p>
        )}
        <button
          type="submit"
          disabled={status === 'loading'}
          className="w-full py-3 rounded-2xl bg-gradient-to-r from-indigo-600 to-purple-600 text-white text-sm font-extrabold shadow-md shadow-indigo-600/25 hover:scale-[1.01] transition-all disabled:opacity-60 flex items-center justify-center gap-2"
        >
          {status === 'loading' ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Send className="w-4 h-4" />
          )}
          {status === 'loading' ? 'Submitting…' : submitLabel}
        </button>
      </form>
    </div>
  );
}