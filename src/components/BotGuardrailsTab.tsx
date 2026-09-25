'use client';

import React from 'react';
import {
  ShieldAlert,
  ShieldCheck,
  Lock,
  AlertTriangle,
  Sliders,
  Check,
  HelpCircle,
} from 'lucide-react';

interface GuardrailsTabProps {
  formData: {
    guardrailsEnabled: boolean;
    strictRAG: boolean;
    promptInjectionDefense: boolean;
    domainScopeEnforcement: boolean;
    piiMasking: boolean;
    similarityThreshold: number;
    fallbackMessage: string;
  };
  setFormData: React.Dispatch<React.SetStateAction<any>>;
  onSave: (e: React.FormEvent) => void;
  saveSuccess: boolean;
}

export function BotGuardrailsTab({
  formData,
  setFormData,
  onSave,
  saveSuccess,
}: GuardrailsTabProps) {
  return (
    <div className="w-full min-w-0 max-w-full space-y-6">
      {/* Overview Banner */}
      <div className="relative w-full min-w-0 max-w-full overflow-hidden bg-gradient-to-r from-rose-950 via-slate-900 to-indigo-950 rounded-3xl p-4 sm:p-6 lg:p-8 text-white border border-rose-500/20 shadow-xl">
        <div className="absolute top-0 right-0 w-80 h-80 bg-rose-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 min-w-0 max-w-2xl">
          <div className="mb-3 inline-flex max-w-full items-center gap-2 rounded-full bg-rose-500/20 border border-rose-400/30 px-3 py-1 text-rose-300 text-xs font-bold uppercase tracking-wider">
            <ShieldAlert className="w-3.5 h-3.5 shrink-0" />
            <span className="min-w-0 break-words">Strict RAG Guardrails Engine</span>
          </div>
          <h2 className="mb-2 break-words text-xl sm:text-2xl font-black tracking-tight">
            Enterprise Hallucination &amp; Injection Defenses
          </h2>
          <p className="break-words text-xs sm:text-sm text-slate-300 leading-relaxed">
            Protect your brand integrity. Enforce strict factual grounding against crawled site
            content, block adversarial jailbreak attempts, and ensure the chatbot never invents
            unverified pricing, contact details, or false claims.
          </p>
        </div>
      </div>

      <form onSubmit={onSave} className="w-full min-w-0 max-w-full space-y-6">
        {/* Master Guardrails Switch */}
        <div className="flex w-full min-w-0 max-w-full flex-col items-start justify-between gap-4 rounded-3xl bg-white p-4 border border-slate-200 shadow-sm sm:flex-row sm:items-center sm:p-6">
          <div className="flex min-w-0 flex-1 items-start gap-3">
            <div className="flex w-10 h-10 shrink-0 items-center justify-center rounded-2xl bg-rose-50 text-rose-600">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h3 className="break-words text-sm font-bold text-slate-900">Enforce Guardrails Engine</h3>
              <p className="break-words text-xs text-slate-500">
                Activate all behavioral restrictions, scope filters, and anti-hallucination policies.
              </p>
            </div>
          </div>
          <label className="relative inline-flex shrink-0 items-center cursor-pointer">
            <input
              type="checkbox"
              checked={formData.guardrailsEnabled}
              onChange={(e) =>
                setFormData((prev: any) => ({ ...prev, guardrailsEnabled: e.target.checked }))
              }
              className="sr-only peer"
            />
            <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-rose-600"></div>
          </label>
        </div>

        {formData.guardrailsEnabled && (
          <>
            {/* Defensive Toggles Grid */}
            <div className="grid w-full min-w-0 max-w-full grid-cols-1 gap-4 md:grid-cols-2">
              {/* Strict Grounding (Anti-Hallucination) */}
              <div className="w-full min-w-0 max-w-full space-y-3 rounded-3xl bg-white p-4 border border-slate-200 shadow-sm sm:p-6">
                <div className="flex min-w-0 items-start justify-between gap-3">
                  <div className="flex min-w-0 items-start gap-2.5">
                    <div className="flex w-8 h-8 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
                      <ShieldCheck className="w-4 h-4" />
                    </div>
                    <h4 className="min-w-0 break-words text-xs font-bold text-slate-900">
                      Strict RAG Grounding
                    </h4>
                  </div>
                  <input
                    type="checkbox"
                    checked={formData.strictRAG}
                    onChange={(e) =>
                      setFormData((prev: any) => ({ ...prev, strictRAG: e.target.checked }))
                    }
                    className="w-4 h-4 shrink-0 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500"
                  />
                </div>
                <p className="break-words text-xs text-slate-500 leading-relaxed">
                  Forces the LLM to formulate factual answers <strong>strictly</strong> from crawled
                  chunks. Prohibits outside guesswork or inventing details not present on the site.
                </p>
              </div>

              {/* Prompt Injection Shield */}
              <div className="w-full min-w-0 max-w-full space-y-3 rounded-3xl bg-white p-4 border border-slate-200 shadow-sm sm:p-6">
                <div className="flex min-w-0 items-start justify-between gap-3">
                  <div className="flex min-w-0 items-start gap-2.5">
                    <div className="flex w-8 h-8 shrink-0 items-center justify-center rounded-xl bg-amber-50 text-amber-600">
                      <Lock className="w-4 h-4" />
                    </div>
                    <h4 className="min-w-0 break-words text-xs font-bold text-slate-900">
                      Prompt Injection Shield
                    </h4>
                  </div>
                  <input
                    type="checkbox"
                    checked={formData.promptInjectionDefense}
                    onChange={(e) =>
                      setFormData((prev: any) => ({
                        ...prev,
                        promptInjectionDefense: e.target.checked,
                      }))
                    }
                    className="w-4 h-4 shrink-0 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500"
                  />
                </div>
                <p className="break-words text-xs text-slate-500 leading-relaxed">
                  Detects and neutralizes jailbreak signatures, system prompt override attempts, and
                  delimiter breakouts before queries reach the vector database or LLM.
                </p>
              </div>

              {/* Domain & Scope Enforcement */}
              <div className="w-full min-w-0 max-w-full space-y-3 rounded-3xl bg-white p-4 border border-slate-200 shadow-sm sm:p-6">
                <div className="flex min-w-0 items-start justify-between gap-3">
                  <div className="flex min-w-0 items-start gap-2.5">
                    <div className="flex w-8 h-8 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
                      <AlertTriangle className="w-4 h-4" />
                    </div>
                    <h4 className="min-w-0 break-words text-xs font-bold text-slate-900">
                      Domain Scope Enforcement
                    </h4>
                  </div>
                  <input
                    type="checkbox"
                    checked={formData.domainScopeEnforcement}
                    onChange={(e) =>
                      setFormData((prev: any) => ({
                        ...prev,
                        domainScopeEnforcement: e.target.checked,
                      }))
                    }
                    className="w-4 h-4 shrink-0 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500"
                  />
                </div>
                <p className="break-words text-xs text-slate-500 leading-relaxed">
                  Prevents users from abusing the chatbot as a free general AI. Rejects off-topic
                  programming tasks, math equations, political debates, and arbitrary queries.
                </p>
              </div>

              {/* PII & System Data Masking */}
              <div className="w-full min-w-0 max-w-full space-y-3 rounded-3xl bg-white p-4 border border-slate-200 shadow-sm sm:p-6">
                <div className="flex min-w-0 items-start justify-between gap-3">
                  <div className="flex min-w-0 items-start gap-2.5">
                    <div className="flex w-8 h-8 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
                      <ShieldCheck className="w-4 h-4" />
                    </div>
                    <h4 className="min-w-0 break-words text-xs font-bold text-slate-900">
                      PII &amp; Secret Masking
                    </h4>
                  </div>
                  <input
                    type="checkbox"
                    checked={formData.piiMasking}
                    onChange={(e) =>
                      setFormData((prev: any) => ({ ...prev, piiMasking: e.target.checked }))
                    }
                    className="w-4 h-4 shrink-0 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500"
                  />
                </div>
                <p className="break-words text-xs text-slate-500 leading-relaxed">
                  Post-filters generated responses to guarantee system prompts, API keys, database
                  credentials, or raw internal IDs are never leaked to the public visitor.
                </p>
              </div>
            </div>

            {/* Similarity Threshold Slider */}
            <div className="w-full min-w-0 max-w-full space-y-4 rounded-3xl bg-white p-4 border border-slate-200 shadow-sm sm:p-6">
              <div className="flex min-w-0 flex-col items-start justify-between gap-3 sm:flex-row sm:items-center">
                <div className="min-w-0">
                  <h4 className="flex min-w-0 items-start gap-2 break-words text-sm font-bold text-slate-900">
                    <Sliders className="w-4 h-4 shrink-0 text-rose-600" />
                    <span>Semantic Similarity Relevance Threshold</span>
                  </h4>
                  <p className="mt-0.5 break-words text-xs text-slate-500">
                    Minimum cosine similarity required for a retrieved context chunk to be considered
                    relevant. Chunks below this threshold trigger the fallback message.
                  </p>
                </div>
                <span className="shrink-0 rounded-xl border border-rose-200 bg-rose-50 px-3 py-1 font-mono text-xs font-bold text-rose-700">
                  {Number(formData.similarityThreshold || 0.4).toFixed(2)}
                </span>
              </div>

              <div className="min-w-0 space-y-2">
                <input
                  type="range"
                  min="0.10"
                  max="0.85"
                  step="0.05"
                  value={formData.similarityThreshold || 0.4}
                  onChange={(e) =>
                    setFormData((prev: any) => ({
                      ...prev,
                      similarityThreshold: parseFloat(e.target.value),
                    }))
                  }
                  className="w-full min-w-0 max-w-full cursor-pointer accent-rose-600"
                />
                <div className="grid min-w-0 grid-cols-1 gap-1 text-[10px] font-medium text-slate-400 sm:grid-cols-3 sm:gap-3">
                  <span className="min-w-0 break-words">
                    0.10 (Permissive — May introduce loose context)
                  </span>
                  <span className="min-w-0 break-words font-bold text-rose-600">
                    0.40 (Recommended)
                  </span>
                  <span className="min-w-0 break-words sm:text-right">
                    0.85 (Ultra-Strict — Exact match required)
                  </span>
                </div>
              </div>
            </div>

            {/* Custom Fallback Message */}
            <div className="w-full min-w-0 max-w-full space-y-3 rounded-3xl bg-white p-4 border border-slate-200 shadow-sm sm:p-6">
              <div className="min-w-0">
                <h4 className="flex min-w-0 items-start gap-1.5 break-words text-sm font-bold text-slate-900">
                  <HelpCircle className="w-4 h-4 shrink-0 text-indigo-600" />
                  <span>Out-of-Context Fallback Response</span>
                </h4>
                <p className="mt-0.5 break-words text-xs text-slate-500">
                  Polite refusal message delivered when the knowledge base has no verified facts
                  matching the user&apos;s specific query.
                </p>
              </div>

              <textarea
                rows={3}
                value={formData.fallbackMessage}
                onChange={(e) =>
                  setFormData((prev: any) => ({ ...prev, fallbackMessage: e.target.value }))
                }
                placeholder="I do not have verified information on that specific topic from this website..."
                className="w-full min-w-0 max-w-full whitespace-pre-wrap break-words rounded-2xl bg-slate-50 px-4 py-3 text-xs leading-relaxed text-slate-900 shadow-inner focus:border-rose-600 focus:bg-white focus:outline-none"
              />
            </div>
          </>
        )}

        {/* Save Bar */}
        <div className="flex w-full min-w-0 max-w-full flex-col items-stretch justify-between gap-3 pt-4 border-t border-slate-200 sm:flex-row sm:items-center">
          <div className="min-w-0">
            {saveSuccess && (
              <span className="flex min-w-0 break-words items-center gap-1 text-xs font-bold text-emerald-600">
                <Check className="w-4 h-4 shrink-0" /> Guardrails updated successfully!
              </span>
            )}
          </div>
          <button
            type="submit"
            className="flex w-full min-w-0 max-w-full items-center justify-center gap-1.5 rounded-xl bg-rose-600 px-6 py-2.5 text-xs font-bold text-white shadow-md transition-all hover:bg-rose-700 sm:w-auto sm:shrink-0"
          >
            <ShieldCheck className="w-4 h-4 shrink-0" />
            <span>Save Guardrails Policy</span>
          </button>
        </div>
      </form>
    </div>
  );
}
