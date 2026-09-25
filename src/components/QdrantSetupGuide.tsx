'use client';

import React, { useState } from 'react';
import { Database, Copy, Check, Info, Server, Cpu } from 'lucide-react';

const DOCKER_CMD = 'docker run -p 6333:6333 -p 6334:6334 -v $(pwd)/qdrant_storage:/qdrant/storage:z qdrant/qdrant';

const ENV_SNIPPET = `# Qdrant Vector Database
QDRANT_URL=https://xyz-example.eu-central.aws.cloud.qdrant.io:6333
QDRANT_API_KEY=your_qdrant_api_key_here`;

export function QdrantSetupGuide() {
  const [copiedDocker, setCopiedDocker] = useState(false);
  const [copiedEnv, setCopiedEnv] = useState(false);

  const copyText = (text: string, type: 'docker' | 'env') => {
    navigator.clipboard.writeText(text);
    if (type === 'docker') {
      setCopiedDocker(true);
      setTimeout(() => setCopiedDocker(false), 2000);
    } else {
      setCopiedEnv(true);
      setTimeout(() => setCopiedEnv(false), 2000);
    }
  };

  return (
    <div className="rounded-3xl bg-white border border-slate-200 p-6 md:p-8 space-y-6 shadow-sm">
      {/* Title */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-5">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-indigo-50 border border-indigo-200 flex items-center justify-center text-indigo-600 shadow-sm">
            <Database className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-lg font-bold text-slate-900">Qdrant Vector Database Integration</h3>
              <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                High-Performance RAG
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Store and query 768-dimensional document chunks with sub-millisecond similarity search.
            </p>
          </div>
        </div>
      </div>

      {/* Architecture Alert */}
      <div className="flex items-start gap-3 p-4 rounded-2xl bg-indigo-50/60 border border-indigo-200 text-xs text-indigo-950">
        <Info className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />
        <div>
          <strong className="text-indigo-900 block mb-0.5">Automated Collection Management:</strong>
          SiteBot Studio automatically provisions the <code className="font-mono font-bold text-indigo-800 bg-white px-1.5 py-0.5 rounded border border-indigo-200">sitebot_chunks</code> collection (768 dimensions, Cosine distance) with payload index on <code className="font-mono font-bold text-indigo-800 bg-white px-1.5 py-0.5 rounded border border-indigo-200">chatbotId</code>. If Qdrant is offline or not yet configured, the system gracefully runs in-memory vector search with zero downtime.
        </div>
      </div>

      {/* Deployment Options Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Option 1: Qdrant Cloud */}
        <div className="p-5 rounded-2xl bg-slate-50 border border-slate-200 space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-2">
              <Server className="w-4 h-4 text-indigo-600" />
              Option 1: Qdrant Cloud (Managed)
            </h4>
            <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-white text-slate-600 border border-slate-200">
              Recommended
            </span>
          </div>

          <ol className="space-y-2.5 text-xs text-slate-600">
            <li className="flex items-start gap-2">
              <span className="w-5 h-5 rounded-full bg-white border border-slate-300 flex items-center justify-center font-bold text-[10px] text-indigo-600 shrink-0">
                1
              </span>
              <span>
                Create a free cluster at <strong className="text-slate-900">cloud.qdrant.io</strong>.
              </span>
            </li>
            <li className="flex items-start gap-2">
              <span className="w-5 h-5 rounded-full bg-white border border-slate-300 flex items-center justify-center font-bold text-[10px] text-indigo-600 shrink-0">
                2
              </span>
              <span>Copy your cluster URL and generate an API key.</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="w-5 h-5 rounded-full bg-white border border-slate-300 flex items-center justify-center font-bold text-[10px] text-indigo-600 shrink-0">
                3
              </span>
              <span>Paste them into your <code className="font-mono text-slate-800">.env</code> file.</span>
            </li>
          </ol>

          <div className="relative rounded-xl bg-slate-900 text-slate-100 p-3 font-mono text-[11px] overflow-x-auto">
            <pre>{ENV_SNIPPET}</pre>
            <button
              onClick={() => copyText(ENV_SNIPPET, 'env')}
              className="absolute top-2.5 right-2.5 px-2 py-1 rounded bg-indigo-600 hover:bg-indigo-500 text-[10px] font-semibold text-white transition-all flex items-center gap-1"
            >
              {copiedEnv ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
              <span>{copiedEnv ? 'Copied' : 'Copy'}</span>
            </button>
          </div>
        </div>

        {/* Option 2: Self-Hosted Docker */}
        <div className="p-5 rounded-2xl bg-slate-50 border border-slate-200 space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-2">
              <Cpu className="w-4 h-4 text-emerald-600" />
              Option 2: Local Docker
            </h4>
            <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-white text-slate-600 border border-slate-200">
              Self-Hosted
            </span>
          </div>

          <p className="text-xs text-slate-600 leading-relaxed">
            Run Qdrant on your local machine or VPS in a single command. It will expose REST and gRPC endpoints on port 6333.
          </p>

          <div className="relative rounded-xl bg-slate-900 text-slate-100 p-3 font-mono text-[11px] overflow-x-auto">
            <code>{DOCKER_CMD}</code>
            <button
              onClick={() => copyText(DOCKER_CMD, 'docker')}
              className="absolute top-2.5 right-2.5 px-2 py-1 rounded bg-indigo-600 hover:bg-indigo-500 text-[10px] font-semibold text-white transition-all flex items-center gap-1"
            >
              {copiedDocker ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
              <span>{copiedDocker ? 'Copied' : 'Copy'}</span>
            </button>
          </div>

          <p className="text-[11px] text-slate-500">
            For local setup, set <code className="font-mono text-slate-700">QDRANT_URL=http://localhost:6333</code> in <code className="font-mono text-slate-700">.env</code>.
          </p>
        </div>
      </div>
    </div>
  );
}
