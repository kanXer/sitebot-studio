'use client';

import React, { useState } from 'react';
import { Database, Copy, Check, Info } from 'lucide-react';

const INDEX_JSON = `{
  "fields": [
    {
      "type": "vector",
      "path": "embedding",
      "numDimensions": 768,
      "similarity": "cosine"
    },
    {
      "type": "filter",
      "path": "chatbotId"
    }
  ]
}`;

export function AtlasSetupGuide() {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(INDEX_JSON);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="rounded-2xl bg-gradient-to-b from-slate-900 to-slate-950 border border-indigo-500/20 p-6 md:p-8 space-y-6">
      {/* Title */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/10 pb-5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
            <Database className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-lg font-bold text-white">MongoDB Atlas Vector Search Setup</h3>
              <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                100% Free M0 Tier
              </span>
            </div>
            <p className="text-xs text-slate-400">
              Configure the 768-dimension vector index on your MongoDB Atlas cluster in 60 seconds.
            </p>
          </div>
        </div>

        <button
          onClick={handleCopy}
          className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-semibold rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white shadow-sm transition-all"
        >
          {copied ? <Check className="w-4 h-4 text-emerald-300" /> : <Copy className="w-4 h-4" />}
          <span>{copied ? 'Index JSON Copied!' : 'Copy Index Definition'}</span>
        </button>
      </div>

      {/* Zero downtime banner */}
      <div className="flex items-start gap-3 p-4 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-xs text-indigo-200">
        <Info className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" />
        <div>
          <strong className="text-white block mb-0.5">Resilient Dual-Mode Vector Engine:</strong>
          SiteBot Studio automatically attempts native Atlas <code className="text-indigo-300 font-mono font-semibold">$vectorSearch</code>. If you haven&apos;t created the index yet or are working locally, it seamlessly runs <span className="text-emerald-400 font-semibold">in-memory cosine similarity</span> on the fly! Your bots work immediately with zero downtime.
        </div>
      </div>

      {/* Step by Step list */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-3.5">
          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">
            Quick Setup Steps (Atlas Console)
          </h4>
          <ol className="space-y-3 text-xs text-slate-300">
            <li className="flex items-start gap-2.5">
              <span className="w-5 h-5 rounded-full bg-slate-800 border border-white/10 flex items-center justify-center font-bold text-[10px] text-indigo-400 shrink-0">
                1
              </span>
              <span>
                Log into <strong className="text-white">MongoDB Atlas</strong> and select your Free M0 Cluster.
              </span>
            </li>
            <li className="flex items-start gap-2.5">
              <span className="w-5 h-5 rounded-full bg-slate-800 border border-white/10 flex items-center justify-center font-bold text-[10px] text-indigo-400 shrink-0">
                2
              </span>
              <span>
                Click the <strong className="text-white">Atlas Search</strong> tab (or &quot;Search&quot; on your database view).
              </span>
            </li>
            <li className="flex items-start gap-2.5">
              <span className="w-5 h-5 rounded-full bg-slate-800 border border-white/10 flex items-center justify-center font-bold text-[10px] text-indigo-400 shrink-0">
                3
              </span>
              <span>
                Click <strong className="text-white">Create Search Index</strong> &rarr; Select{' '}
                <strong className="text-indigo-300">Atlas Vector Search (JSON Editor)</strong>.
              </span>
            </li>
            <li className="flex items-start gap-2.5">
              <span className="w-5 h-5 rounded-full bg-slate-800 border border-white/10 flex items-center justify-center font-bold text-[10px] text-indigo-400 shrink-0">
                4
              </span>
              <span>
                Select your database and the collection: <code className="text-emerald-300 font-mono font-semibold">documentchunks</code>.
              </span>
            </li>
            <li className="flex items-start gap-2.5">
              <span className="w-5 h-5 rounded-full bg-slate-800 border border-white/10 flex items-center justify-center font-bold text-[10px] text-indigo-400 shrink-0">
                5
              </span>
              <span>
                Name the Index: <code className="text-emerald-300 font-mono font-semibold">vector_index</code>.
              </span>
            </li>
            <li className="flex items-start gap-2.5">
              <span className="w-5 h-5 rounded-full bg-slate-800 border border-white/10 flex items-center justify-center font-bold text-[10px] text-indigo-400 shrink-0">
                6
              </span>
              <span>
                Paste the JSON snippet and click <strong className="text-white">Create Vector Search Index</strong>.
              </span>
            </li>
          </ol>
        </div>

        {/* Code Snippet Box */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span className="font-mono">vector_index (JSON Editor)</span>
            <button
              onClick={handleCopy}
              className="text-xs text-indigo-400 hover:text-indigo-300 flex items-center gap-1"
            >
              {copied ? 'Copied' : 'Copy'}
            </button>
          </div>
          <div className="relative rounded-xl bg-black/60 border border-white/10 p-4 font-mono text-xs text-slate-300 overflow-x-auto">
            <pre>{INDEX_JSON}</pre>
          </div>
          <p className="text-[11px] text-slate-500">
            768 dimensions match Google Gemini <code className="text-slate-400">gemini-embedding-001</code>.
          </p>
        </div>
      </div>
    </div>
  );
}
