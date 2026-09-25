'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/firebase/AuthContext';
import {
  Bot,
  Sparkles,
  Code2,
  GraduationCap,
  Building2,
  Briefcase,
  TrendingUp,
  ShoppingBag,
  Globe,
  Rocket,
  CheckCircle2,
  ArrowRight,
  Loader2,
  FolderPlus,
  HelpCircle,
} from 'lucide-react';

interface OnboardingModalProps {
  isOpen: boolean;
  onClose: () => void;
  onComplete?: () => void;
}

const ROLES = [
  {
    id: 'developer',
    title: 'Developer / Engineer',
    icon: Code2,
    badge: 'Code & APIs',
    desc: 'Building custom AI tools, webhooks & embedding widgets',
  },
  {
    id: 'student',
    title: 'Student / Researcher',
    icon: GraduationCap,
    badge: 'Academic / Learn',
    desc: 'Learning AI, class assignments, thesis & exploration',
  },
  {
    id: 'founder',
    title: 'Founder / Business Owner',
    icon: Building2,
    badge: 'Startup / SMB',
    desc: 'Automating 24/7 customer support & capturing leads',
  },
  {
    id: 'agency',
    title: 'Freelancer / Agency',
    icon: Briefcase,
    badge: 'Client Solutions',
    desc: 'Creating & managing AI chatbots for external clients',
  },
  {
    id: 'marketer',
    title: 'Marketer / Sales Pro',
    icon: TrendingUp,
    badge: 'Growth & Funnels',
    desc: 'Boosting site engagement & qualification conversions',
  },
  {
    id: 'ecommerce',
    title: 'E-commerce Merchant',
    icon: ShoppingBag,
    badge: 'Shopify / Stores',
    desc: 'Guiding shoppers, answering product FAQs & orders',
  },
  {
    id: 'creator',
    title: 'Content Creator',
    icon: Globe,
    badge: 'Audience / Blog',
    desc: 'Engaging audience with an interactive knowledge bot',
  },
  {
    id: 'other',
    title: 'Other Professional',
    icon: Rocket,
    badge: 'General',
    desc: 'Exploring conversational AI solutions for my workflow',
  },
];

const USE_CASES = [
  { id: 'support', label: '24/7 Automated Customer Support & FAQs' },
  { id: 'leads', label: 'Lead Capture & Contact Form Qualification' },
  { id: 'knowledge', label: 'Website Knowledge Base & Documentation Search' },
  { id: 'ecommerce', label: 'Product Recommendations & E-Commerce Sales' },
  { id: 'portfolio', label: 'Personal Portfolio & Resume AI Assistant' },
];

export function OnboardingModal({ isOpen, onClose, onComplete }: OnboardingModalProps) {
  const router = useRouter();
  const { user } = useAuth();

  const [step, setStep] = useState<1 | 2>(1);
  const [name, setName] = useState(user?.displayName || '');
  const [selectedRole, setSelectedRole] = useState('developer');
  const [selectedUseCase, setSelectedUseCase] = useState('support');
  const [projectName, setProjectName] = useState('My First Chatbot');
  const [websiteUrl, setWebsiteUrl] = useState('');
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const modalRef = React.useRef<HTMLDivElement>(null);

  // Smooth scroll modal to top whenever step changes
  React.useEffect(() => {
    if (modalRef.current) {
      modalRef.current.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, [step]);

  if (!isOpen) return null;

  const handleNext = () => {
    if (!name.trim()) {
      setName(user?.displayName || user?.email?.split('@')[0] || 'User');
    }
    setStep(2);
    if (modalRef.current) {
      modalRef.current.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handleSaveAndContinue = async () => {
    setSaving(true);
    setErrorMsg('');

    try {
      const email = user?.email;
      if (!email) {
        throw new Error('Please sign in to complete onboarding.');
      }

      const res = await fetch('/api/profile', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'x-user-email': email,
          ...(user?.uid ? { 'x-user-id': user.uid } : {}),
        },
        body: JSON.stringify({
          name: name.trim() || user.displayName || 'User',
          occupation: selectedRole,
          useCase: selectedUseCase,
          projectName: projectName.trim() || 'My First Chatbot',
          profileCompleted: true,
        }),
      });

      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error || 'Failed to save profile');
      }

      if (onComplete) onComplete();
      onClose();

      // Seamlessly navigate to create bot wizard with project name and website prefilled!
      const queryParams = new URLSearchParams();
      if (projectName.trim()) queryParams.set('name', projectName.trim());
      if (websiteUrl.trim()) queryParams.set('url', websiteUrl.trim());
      const queryStr = queryParams.toString() ? `?${queryParams.toString()}` : '';

      router.push(`/create${queryStr}`);
    } catch (err: any) {
      console.error('Onboarding save error:', err);
      setErrorMsg(err.message || 'Could not save profile. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-3 sm:p-4 bg-slate-950/70 backdrop-blur-md animate-in fade-in duration-200">
      <div ref={modalRef} className="w-full max-w-2xl max-h-[92vh] overflow-y-auto rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl p-5 sm:p-8 relative text-slate-900 dark:text-slate-100">
        {/* Top Progress Line */}
        <div className="h-1.5 w-full bg-slate-100 dark:bg-slate-800 absolute top-0 left-0 overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-500 transition-all duration-300"
            style={{ width: step === 1 ? '50%' : '100%' }}
          />
        </div>

        {/* Modal Header */}
        <div className="flex items-start justify-between gap-4 mb-6">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-indigo-600 to-purple-600 flex items-center justify-center text-white shadow-lg shadow-indigo-600/30 shrink-0">
              {step === 1 ? <Sparkles className="w-6 h-6 stroke-[2.2]" /> : <FolderPlus className="w-6 h-6 stroke-[2.2]" />}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded-md bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800">
                  Step {step} of 2
                </span>
                <span className="text-xs text-slate-400 font-medium">Quick Workspace Setup</span>
              </div>
              <h2 className="text-lg sm:text-xl font-extrabold text-slate-900 dark:text-white mt-1">
                {step === 1 ? 'Kon Ho Bhai? Tell Us About Yourself' : 'Create Your First AI Chatbot Project'}
              </h2>
            </div>
          </div>
        </div>

        {errorMsg && (
          <div className="p-3 mb-5 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-xs text-rose-700 dark:text-rose-300">
            {errorMsg}
          </div>
        )}

        {/* STEP 1: PROFESSION & ROLE SELECTION */}
        {step === 1 && (
          <div className="space-y-6">
            {/* Display Name Input */}
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                Your Full Name or Username
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Rahul Sharma"
                className="w-full px-4 py-2.5 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all font-medium"
              />
            </div>

            {/* Profession Grid ("Aap kaun ho?") */}
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-2">
                Which best describes your role? (Aapka primary profession kya hai?)
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {ROLES.map((r) => {
                  const Icon = r.icon;
                  const isSelected = selectedRole === r.id;
                  return (
                    <button
                      key={r.id}
                      type="button"
                      onClick={() => setSelectedRole(r.id)}
                      className={`p-3 rounded-2xl border text-left transition-all cursor-pointer flex items-start gap-3 ${
                        isSelected
                          ? 'bg-indigo-50/80 dark:bg-indigo-950/40 border-indigo-600 dark:border-indigo-500 shadow-sm ring-1 ring-indigo-500'
                          : 'bg-white dark:bg-slate-800/60 border-slate-200 dark:border-slate-700 hover:border-indigo-300 dark:hover:border-slate-600'
                      }`}
                    >
                      <div
                        className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                          isSelected
                            ? 'bg-indigo-600 text-white'
                            : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300'
                        }`}
                      >
                        <Icon className="w-4.5 h-4.5" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-1">
                          <h4 className="text-xs font-bold text-slate-900 dark:text-white truncate">
                            {r.title}
                          </h4>
                          <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400 shrink-0">
                            {r.badge}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 leading-snug line-clamp-2">
                          {r.desc}
                        </p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Primary Goal / Use Case */}
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-2">
                What is your main goal with SiteBot Studio?
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {USE_CASES.map((uc) => {
                  const isSelected = selectedUseCase === uc.id;
                  return (
                    <button
                      key={uc.id}
                      type="button"
                      onClick={() => setSelectedUseCase(uc.id)}
                      className={`p-2.5 rounded-xl border text-left text-xs font-semibold transition-all flex items-center gap-2 cursor-pointer ${
                        isSelected
                          ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                          : 'bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700'
                      }`}
                    >
                      <CheckCircle2
                        className={`w-3.5 h-3.5 shrink-0 ${
                          isSelected ? 'text-white' : 'text-slate-300 dark:text-slate-600'
                        }`}
                      />
                      <span className="truncate">{uc.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Bottom Button Step 1 */}
            <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex justify-end">
              <button
                type="button"
                onClick={handleNext}
                className="w-full sm:w-auto px-6 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-extrabold text-xs shadow-md shadow-indigo-600/25 transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                <span>Continue to Project Setup</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* STEP 2: PROJECT CREATION & WEBSITE SCAN TARGET */}
        {step === 2 && (
          <div className="space-y-6">
            <div className="p-4 rounded-2xl bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800/60">
              <div className="flex items-center gap-2 text-indigo-900 dark:text-indigo-200 text-xs font-bold">
                <Bot className="w-4 h-4 text-indigo-600" />
                <span>Creating Project for: {name || user?.displayName || 'User'} ({selectedRole})</span>
              </div>
              <p className="text-[11px] text-indigo-700 dark:text-indigo-300 mt-1 leading-relaxed">
                Give your chatbot project a name and enter your target website URL. SiteBot will crawl your pages, extract knowledge chunks, and set up your interactive AI widget.
              </p>
            </div>

            {/* Project Name Input */}
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                Chatbot Project Name
              </label>
              <input
                type="text"
                value={projectName}
                onChange={(e) => setProjectName(e.target.value)}
                placeholder="e.g. Acme Support Assistant or My Store Bot"
                className="w-full px-4 py-2.5 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all font-medium"
              />
              <p className="text-[11px] text-slate-400 mt-1">
                This will appear as the header title on your live chat widget.
              </p>
            </div>

            {/* Target Website URL Input */}
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                Website URL to Scan &amp; Learn From
              </label>
              <div className="relative">
                <Globe className="w-4 h-4 text-slate-400 absolute left-3.5 top-3 pointer-events-none" />
                <input
                  type="url"
                  value={websiteUrl}
                  onChange={(e) => setWebsiteUrl(e.target.value)}
                  placeholder="https://yourwebsite.com"
                  className="w-full pl-10 pr-4 py-2.5 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all font-mono"
                />
              </div>
              <p className="text-[11px] text-slate-400 mt-1">
                Enter your live website, documentation, or landing page URL to start auto-indexing.
              </p>
            </div>

            {/* Bottom Actions */}
            <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => setStep(1)}
                className="px-4 py-2.5 rounded-xl text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 text-xs font-bold transition-colors cursor-pointer"
              >
                Back
              </button>

              <button
                type="button"
                onClick={handleSaveAndContinue}
                disabled={saving}
                className="px-6 py-3 rounded-xl bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 hover:from-indigo-500 hover:to-pink-500 text-white font-extrabold text-xs shadow-md shadow-indigo-600/25 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
              >
                {saving ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Saving Profile &amp; Project...</span>
                  </>
                ) : (
                  <>
                    <span>Save &amp; Start Website Scanner</span>
                    <Rocket className="w-4 h-4" />
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
