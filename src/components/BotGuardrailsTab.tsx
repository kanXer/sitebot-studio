'use client';

import React from 'react';
import {
  ShieldAlert,
  ShieldCheck,
  Lock,
  Sparkles,
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
    <div className="space-y-6">
      {/* Overview Banner */}
      <div className="bg-gradient-to-r from-rose-950 via-slate-900 to-indigo-950 rounded-3xl p-6 sm:p-8 text-white border border-rose-500/20 shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-80 h-80 bg-rose-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 max-w-2xl">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-rose-500/20 border border-rose-400/30 text-rose-300 text-xs font-bold uppercase tracking-wider mb-3">
            <ShieldAlert className="w-3.5 h-3.5" />
            <span>Strict RAG Guardrails Engine</span>
          </div>
          <h2 className="text-xl sm:text-2xl font-black tracking-tight mb-2">
            Enterprise Hallucination &amp; Injection Defenses
          </h2>
          <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
            Protect your brand integrity. Enforce strict factual grounding against crawled site
            content, block adversarial jailbreak attempts, and ensure the chatbot never invents
            unverified pricing, contact details, or false claims.
          </p>
        </div>
      </div>

      <form onSubmit={onSave} className="space-y-6">
        {/* Master Guardrails Switch */}
        <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-rose-50 flex items-center justify-center text-rose-600">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900">Enforce Guardrails Engine</h3>
              <p className="text-xs text-slate-500">
                Activate all behavioral restrictions, scope filters, and anti-hallucination policies.
              </p>
            </div>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
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
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Strict Grounding (Anti-Hallucination) */}
              <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-xl bg-indigo-50 flex items-center justify-center text-indigo-600">
                      <Sparkles className="w-4 h-4" />
                    </div>
                    <h4 className="text-xs font-bold text-slate-900">Strict RAG Grounding</h4>
                  </div>
                  <input
                    type="checkbox"
                    checked={formData.strictRAG}
                    onChange={(e) =>
                      setFormData((prev: any) => ({ ...prev, strictRAG: e.target.checked }))
                    }
                    className="w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500"
                  />
                </div>
                <p className="text-xs text-slate-500 leading-relaxed">
                  Forces the LLM to formulate factual answers <strong>strictly</strong> from crawled
                  chunks. Prohibits outside guesswork or inventing details not present on the site.
                </p>
              </div>

              {/* Prompt Injection Shield */}
              <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-xl bg-amber-50 flex items-center justify-center text-amber-600">
                      <Lock className="w-4 h-4" />
                    </div>
                    <h4 className="text-xs font-bold text-slate-900">Prompt Injection Shield</h4>
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
                    className="w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500"
                  />
                </div>
                <p className="text-xs text-slate-500 leading-relaxed">
                  Detects and neutralizes jailbreak signatures, system prompt override attempts, and
                  delimiter breakouts before queries reach the vector database or LLM.
                </p>
              </div>

              {/* Domain & Scope Enforcement */}
              <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-xl bg-blue-50 flex items-center justify-center text-blue-600">
                      <AlertTriangle className="w-4 h-4" />
                    </div>
                    <h4 className="text-xs font-bold text-slate-900">Domain Scope Enforcement</h4>
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
                    className="w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500"
                  />
                </div>
                <p className="text-xs text-slate-500 leading-relaxed">
                  Prevents users from abusing the chatbot as a free general AI. Rejects off-topic
                  programming tasks, math equations, political debates, and arbitrary queries.
                </p>
              </div>

              {/* PII & System Data Masking */}
              <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-600">
                      <ShieldCheck className="w-4 h-4" />
                    </div>
                    <h4 className="text-xs font-bold text-slate-900">PII &amp; Secret Masking</h4>
                  </div>
                  <input
                    type="checkbox"
                    checked={formData.piiMasking}
                    onChange={(e) =>
                      setFormData((prev: any) => ({ ...prev, piiMasking: e.target.checked }))
                    }
                    className="w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500"
                  />
                </div>
                <p className="text-xs text-slate-500 leading-relaxed">
                  Post-filters generated responses to guarantee system prompts, API keys, database
                  credentials, or raw internal IDs are never leaked to the public visitor.
                </p>
              </div>
            </div>

            {/* Similarity Threshold Slider */}
            <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                    <Sliders className="w-4 h-4 text-rose-600" />
                    Semantic Similarity Relevance Threshold
                  </h4>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Minimum cosine similarity required for a retrieved context chunk to be considered
                    relevant. Chunks below this threshold trigger the fallback message.
                  </p>
                </div>
                <span className="px-3 py-1 rounded-xl bg-rose-50 text-rose-700 font-mono font-bold text-xs border border-rose-200">
                  {Number(formData.similarityThreshold || 0.4).toFixed(2)}
                </span>
              </div>

              <div className="space-y-2">
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
                  className="w-full accent-rose-600 cursor-pointer"
                />
                <div className="flex justify-between text-[10px] text-slate-400 font-medium">
                  <span>0.10 (Permissive — May introduce loose context)</span>
                  <span className="text-rose-600 font-bold">0.40 (Recommended)</span>
                  <span>0.85 (Ultra-Strict — Exact match required)</span>
                </div>
              </div>
            </div>

            {/* Custom Fallback Message */}
            <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm space-y-3">
              <div>
                <h4 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                  <HelpCircle className="w-4 h-4 text-indigo-600" />
                  Out-of-Context Fallback Response
                </h4>
                <p className="text-xs text-slate-500 mt-0.5">
                  Polite refusal message delivered when the knowledge base has no verified facts
                  matching the user's specific query.
                </p>
              </div>

              <textarea
                rows={3}
                value={formData.fallbackMessage}
                onChange={(e) =>
                  setFormData((prev: any) => ({ ...prev, fallbackMessage: e.target.value }))
                }
                placeholder="I do not have verified information on that specific topic from this website..."
                className="w-full px-4 py-3 rounded-2xl bg-slate-50 border border-slate-300 text-xs text-slate-900 focus:bg-white focus:outline-none focus:border-rose-600 leading-relaxed shadow-inner"
              />
            </div>
          </>
        )}

        {/* Save Bar */}
        <div className="pt-4 border-t border-slate-200 flex items-center justify-between">
          <div>
            {saveSuccess && (
              <span className="text-xs text-emerald-600 font-bold flex items-center gap-1">
                <Check className="w-4 h-4" /> Guardrails updated successfully!
              </span>
            )}
          </div>
          <button
            type="submit"
            className="px-6 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold shadow-md transition-all flex items-center gap-1.5"
          >
            <ShieldCheck className="w-4 h-4" />
            <span>Save Guardrails Policy</span>
          </button>
        </div>
      </form>
    </div>
  );
}
