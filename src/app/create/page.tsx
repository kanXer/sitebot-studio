'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Bot,
  Globe,
  Palette,
  Key,
  ShieldCheck,
  Zap,
  CheckCircle2,
  ArrowRight,
  ExternalLink,
  Layers,
  Search,
  Code2,
  Cpu,
  Loader2,
  Database,
  Info,
  Sliders,
  Trash2,
  Pencil,
  Plus,
  X,
  Play,
  RotateCcw,
  Phone,
  MessageCircle,
  Mail,
  Check,
  ChevronDown,
  ChevronUp,
  Lock,
  CreditCard,
} from 'lucide-react';
import { Navbar } from '@/components/Navbar';
import { Footer } from '@/components/Footer';
import { useAuth } from '@/lib/firebase/AuthContext';
import { AuthModal } from '@/components/AuthModal';
import { LAUNCHER_PRESETS, QUICK_LINK_PRESETS } from '@/lib/presets';

const COLOR_PRESETS = [
  { name: 'Indigo', hex: '#4f46e5' },
  { name: 'Emerald', hex: '#059669' },
  { name: 'Rose', hex: '#e11d48' },
  { name: 'Violet', hex: '#7c3aed' },
  { name: 'Cyan', hex: '#0891b2' },
  { name: 'Amber', hex: '#d97706' },
  { name: 'Dark Slate', hex: '#0f172a' },
];

export default function CreateBotPage() {
  const router = useRouter();
  const { user, loading: authLoading, signInWithGoogle } = useAuth();
  const [authModalOpen, setAuthModalOpen] = useState(false);

  // Wizard Step: 1 = Initial (URL + Name), 2 = Crawling, 3 = Autofilled Form
  const [step, setStep] = useState<1 | 2 | 3>(1);

  // Step 1: Initial Inputs & Tier Selection
  const [selectedPlanTier, setSelectedPlanTier] = useState<'free' | 'individual' | 'enterprise'>('individual');
  const [siteUrl, setSiteUrl] = useState('');
  const [botName, setBotName] = useState('');
  const [createdBotId, setCreatedBotId] = useState<string | null>(null);

  // Crawling Progress State
  const [crawlProgress, setCrawlProgress] = useState(0);
  const [crawlMessage, setCrawlMessage] = useState('Initializing website scanner...');
  const [discoveredInfo, setDiscoveredInfo] = useState<{
    brandName?: string;
    brandColor?: string;
    phone?: string;
    whatsapp?: string;
    email?: string;
    pagesCount?: number;
    chunksCount?: number;
  }>({});

  const [derivedBotConfig, setDerivedBotConfig] = useState<{
    bot_name?: string;
    company_name?: string;
    tone?: string;
    core_value_prop?: string;
    lead_triggers?: string[];
    qualification_questions?: {
      ask_for_email?: string;
      ask_for_phone?: string;
    };
    guardrails?: string[];
  } | null>(null);

  // Step 3: Detailed & Autofilled Customization Form State
  const [primaryColor, setPrimaryColor] = useState('#4f46e5');
  const [position, setPosition] = useState<'bottom-right' | 'bottom-left'>('bottom-right');
  const [launcherStyle, setLauncherStyle] = useState<string>('standard');
  const [greeting, setGreeting] = useState('');
  const [systemPrompt, setSystemPrompt] = useState('');
  const [phone, setPhone] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [email, setEmail] = useState('');
  const [customLinks, setCustomLinks] = useState<Array<{ label: string; url: string }>>([]);
  const [suggestedQuestions, setSuggestedQuestions] = useState<string[]>([]);

  // Suggested Questions Inline Editing State
  const [editingQuestionIdx, setEditingQuestionIdx] = useState<number | null>(null);
  const [editingQuestionText, setEditingQuestionText] = useState('');
  const [newQuestionInput, setNewQuestionInput] = useState('');
  const [isAddingQuestion, setIsAddingQuestion] = useState(false);

  const handleStartEditQuestion = (idx: number) => {
    setEditingQuestionIdx(idx);
    setEditingQuestionText(suggestedQuestions[idx] || '');
  };

  const handleSaveEditQuestion = () => {
    if (editingQuestionIdx !== null) {
      if (editingQuestionText.trim()) {
        const updated = [...suggestedQuestions];
        updated[editingQuestionIdx] = editingQuestionText.trim();
        setSuggestedQuestions(updated);
      }
      setEditingQuestionIdx(null);
      setEditingQuestionText('');
    }
  };

  const handleCancelEditQuestion = () => {
    setEditingQuestionIdx(null);
    setEditingQuestionText('');
  };

  const handleAddQuestion = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (newQuestionInput.trim()) {
      setSuggestedQuestions([...suggestedQuestions, newQuestionInput.trim()]);
      setNewQuestionInput('');
      setIsAddingQuestion(false);
    }
  };

  const handleDeleteQuestion = (idxToDelete: number) => {
    setSuggestedQuestions(suggestedQuestions.filter((_, i) => i !== idxToDelete));
    if (editingQuestionIdx === idxToDelete) {
      setEditingQuestionIdx(null);
      setEditingQuestionText('');
    }
  };

  // AI Provider & Model State
  const [activeProvider, setActiveProvider] = useState<'openai' | 'nvidia' | 'gemini' | 'openrouter'>('openai');
  const [chatModel, setChatModel] = useState('gpt-4o-mini');
  const [embedProvider, setEmbedProvider] = useState<'openai' | 'nvidia' | 'gemini'>('nvidia');
  const [embedModel, setEmbedModel] = useState('nvidia/llama-3.2-nv-embedqa-1b-v1');
  const [showAdvanced, setShowAdvanced] = useState(false);

  // BYOK Keys
  const [geminiKey, setGeminiKey] = useState('');
  const [openrouterKey, setOpenrouterKey] = useState('');
  const [openaiKey, setOpenaiKey] = useState('');
  const [nvidiaKey, setNvidiaKey] = useState('');

  // UI Status
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [savedBots, setSavedBots] = useState<any[]>([]);
  const [botLimitError, setBotLimitError] = useState<{
    message: string;
    plan: string;
    limit: number;
  } | null>(null);

  // Sync defaults from .env via /api/bot on mount
  useEffect(() => {
    fetch('/api/bot')
      .then((res) => res.json())
      .then((data) => {
        if (data.defaults) {
          if (data.defaults.chatProvider) setActiveProvider(data.defaults.chatProvider);
          if (data.defaults.chatModel) setChatModel(data.defaults.chatModel);
          if (data.defaults.embedProvider) setEmbedProvider(data.defaults.embedProvider);
          if (data.defaults.embedModel) setEmbedModel(data.defaults.embedModel);
        }
        if (data.bots) {
          setSavedBots(data.bots);
        }
      })
      .catch(() => {});
  }, []);

  // Auto-generate bot name from site URL
  const handleUrlChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setSiteUrl(val);

    if (!botName || botName.endsWith('Assistant')) {
      try {
        const cleaned = val.replace(/^https?:\/\//i, '').replace(/^www\./i, '');
        const domainParts = cleaned.split('/')[0].split('.');
        if (domainParts[0] && domainParts[0].length > 1) {
          const capitalized = domainParts[0].charAt(0).toUpperCase() + domainParts[0].slice(1);
          setBotName(`${capitalized} Assistant`);
        }
      } catch {}
    }
  };

  // STEP 1 -> STEP 2: Create initial bot and trigger crawler with SSE
  const handleStartCrawl = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!siteUrl.trim()) {
      setError('Please enter a target website URL.');
      return;
    }

    setLoading(true);
    setStep(2);
    setCrawlProgress(5);
    setCrawlMessage('Creating project workspace...');

    try {
      const botHeaders: Record<string, string> = { 'Content-Type': 'application/json' };
      if (user?.email) botHeaders['x-user-email'] = user.email;
      if (user?.uid) botHeaders['x-user-id'] = user.uid;
      if (user?.displayName) botHeaders['x-user-name'] = user.displayName;

      // 1. Create Bot in Database
      const createRes = await fetch('/api/bot', {
        method: 'POST',
        headers: botHeaders,
        body: JSON.stringify({
          name: botName.trim() || 'Site AI Assistant',
          siteUrl: siteUrl.trim(),
          primaryColor,
          position,
          planTier: selectedPlanTier,
          chatProvider: activeProvider,
          chatModel,
          embedProvider,
          embedModel,
          ownerId: user?.uid || '',
          ownerEmail: user?.email || '',
          ownerName: user?.displayName || '',
        }),
      });

      const createData = await createRes.json();
      if (!createRes.ok) {
        if (createRes.status === 402 && createData.code === 'BOT_LIMIT_REACHED') {
          setBotLimitError({
            message: createData.error || 'You have reached your chatbot limit.',
            plan: createData.plan || 'Free',
            limit: createData.limit || 1,
          });
          setLoading(false);
          return;
        }
        throw new Error(createData.error || 'Failed to initialize bot');
      }

      const botId = createData.bot.id;
      setCreatedBotId(botId);

      // Save initial state to localStorage
      try {
        const existing = JSON.parse(localStorage.getItem('sitebot_saved_bots') || '[]');
        const updated = [
          {
            id: botId,
            name: createData.bot.name,
            siteUrl: createData.bot.siteUrl,
            createdAt: createData.bot.createdAt,
          },
          ...existing.filter((b: any) => b.id !== botId),
        ].slice(0, 20);
        localStorage.setItem('sitebot_saved_bots', JSON.stringify(updated));
        window.dispatchEvent(new CustomEvent('sitebot_created', { detail: { id: botId } }));
      } catch {}

      // 2. Trigger Recursive Crawler with SSE
      setCrawlMessage(`Connecting to ${siteUrl}...`);
      const crawlRes = await fetch('/api/crawl', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'text/event-stream' },
        body: JSON.stringify({
          chatbotId: botId,
          maxPages: 15,
          resetExisting: true,
        }),
      });

      if (!crawlRes.ok) {
        const errJson = await crawlRes.json().catch(() => ({}));
        throw new Error(errJson.error || 'Crawl request failed');
      }

      const reader = crawlRes.body?.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (reader) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const events = buffer.split('\n\n');
        buffer = events.pop() || '';

        for (const evt of events) {
          const lines = evt.split('\n');
          let eventType = '';
          let dataStr = '';
          for (const line of lines) {
            if (line.startsWith('event: ')) eventType = line.slice(7).trim();
            if (line.startsWith('data: ')) dataStr = line.slice(6).trim();
          }

          if (eventType === 'progress') {
            try {
              const p = JSON.parse(dataStr);
              if (typeof p.percent === 'number') setCrawlProgress(p.percent);
              if (p.message) setCrawlMessage(p.message);
            } catch {}
          } else if (eventType === 'done') {
            try {
              const resData = JSON.parse(dataStr);
              const ident = resData.siteIdentity || {};

              // Update discovered info
              setDiscoveredInfo({
                brandName: ident.brandName,
                brandColor: ident.brandColor,
                phone: ident.phone,
                whatsapp: ident.whatsapp,
                email: ident.email,
                pagesCount: resData.pagesIndexed,
                chunksCount: resData.chunksIndexed,
              });

              // Pre-fill Step 3 form values with crawled details!
              if (ident.botName) setBotName(ident.botName);
              if (ident.brandColor) setPrimaryColor(ident.brandColor);
              if (ident.greeting) setGreeting(ident.greeting);
              if (ident.systemPrompt) setSystemPrompt(ident.systemPrompt);
              if (ident.phone) setPhone(ident.phone);
              if (ident.whatsapp) setWhatsapp(ident.whatsapp);
              if (ident.email) setEmail(ident.email);
              if (ident.quickLinks && ident.quickLinks.length > 0) {
                setCustomLinks((prev) => {
                  const merged = [...(prev || [])];
                  for (const link of ident.quickLinks) {
                    if (!merged.some((l) => l.url === link.url)) merged.push(link);
                  }
                  return merged.slice(0, 10);
                });
              }
              if (ident.suggestedQuestions && ident.suggestedQuestions.length > 0) {
                setSuggestedQuestions(ident.suggestedQuestions);
              }
              if (resData.botConfig) {
                setDerivedBotConfig(resData.botConfig);
              }
            } catch {}
          } else if (eventType === 'error') {
            try {
              const e = JSON.parse(dataStr);
              throw new Error(e.error || 'Crawl failed');
            } catch (err: any) {
              throw err;
            }
          }
        }
      }

      // Fetch freshly updated bot details from API to ensure complete autofill
      try {
        const freshHeaders: Record<string, string> = {};
        if (user?.email) freshHeaders['x-user-email'] = user.email;
        if (user?.uid) freshHeaders['x-user-id'] = user.uid;
        const freshRes = await fetch(`/api/bot/${botId}`, { headers: freshHeaders });
        if (freshRes.ok) {
          const freshData = await freshRes.json();
          const b = freshData.bot;
          if (b) {
            if (b.name) setBotName(b.name);
            if (b.primaryColor) setPrimaryColor(b.primaryColor);
            if (b.greeting) setGreeting(b.greeting);
            if (b.systemPrompt) setSystemPrompt(b.systemPrompt);
            if (b.phone) setPhone(b.phone);
            if (b.whatsapp) setWhatsapp(b.whatsapp);
            if (b.email) setEmail(b.email);
            if (b.customLinks && b.customLinks.length > 0) {
              setCustomLinks(b.customLinks);
            }
            if (b.suggestedQuestions && b.suggestedQuestions.length > 0) {
              setSuggestedQuestions(b.suggestedQuestions);
            }
          }
        }
      } catch {}

      // Guarantee fallback greeting, prompt & questions so they are NEVER blank
      const fallbackBrand = botName.trim() || 'our company';
      setGreeting((prev) => prev?.trim() || `Hi! 👋 Welcome to ${fallbackBrand}. How can I assist you with our services and solutions today?`);
      setSystemPrompt((prev) => prev?.trim() || `You are the official, helpful, and reliable AI assistant for ${fallbackBrand} (${siteUrl.trim()}).
PRIMARY INSTRUCTIONS:
1. Greet visitors warmly and introduce yourself as the official AI representative for ${fallbackBrand}.
2. Always answer questions accurately, professionally, and concisely using the verified knowledge base context.
3. If a visitor asks about services, pricing, or getting started, highlight what ${fallbackBrand} provides and offer clear next steps.
4. If a specific private or technical detail is not found in the verified context, politely state what you do know and invite them to contact the team.`);
      setSuggestedQuestions((prev) => (prev && prev.length > 0) ? prev : [
        `What services does ${fallbackBrand} offer?`,
        `How does your pricing work?`,
        `How can you help grow my business?`,
        `How can I get in touch with the team?`,
      ]);

      setCrawlProgress(100);
      setCrawlMessage('Website crawled and details autofilled successfully!');
      setTimeout(() => {
        setStep(3); // Smoothly unlock the detailed customization form!
      }, 700);
    } catch (err: any) {
      setError(err.message || 'An error occurred during crawling.');
      const fallbackBrand = botName.trim() || 'our company';
      setGreeting((prev) => prev?.trim() || `Hi! 👋 Welcome to ${fallbackBrand}. How can I assist you with our services and solutions today?`);
      setSystemPrompt((prev) => prev?.trim() || `You are the official, helpful, and reliable AI assistant for ${fallbackBrand} (${siteUrl.trim()}).
PRIMARY INSTRUCTIONS:
1. Greet visitors warmly and introduce yourself as the official AI representative for ${fallbackBrand}.
2. Always answer questions accurately, professionally, and concisely using the verified knowledge base context.
3. If a visitor asks about services, pricing, or getting started, highlight what ${fallbackBrand} provides and offer clear next steps.`);
      setSuggestedQuestions((prev) => (prev && prev.length > 0) ? prev : [
        `What services does ${fallbackBrand} offer?`,
        `How does your pricing work?`,
        `How can you help grow my business?`,
        `How can I get in touch with the team?`,
      ]);
      // Allow proceeding to customization even if crawl has warnings
      setStep(3);
    } finally {
      setLoading(false);
    }
  };

  // STEP 3: Final Save & Open Studio
  const handleFinalSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!createdBotId) return;

    setLoading(true);
    setError('');

    try {
      const payload: any = {
        name: botName.trim() || 'Site AI Assistant',
        siteUrl: siteUrl.trim(),
        primaryColor,
        position,
        launcherStyle,
        greeting,
        systemPrompt,
        suggestedQuestions,
        phone,
        whatsapp,
        email,
        customLinks,
        chatProvider: activeProvider,
        chatModel: chatModel.trim() || 'gpt-4o-mini',
        embedProvider,
        embedModel: embedModel.trim() || 'text-embedding-3-small',
      };

      if (geminiKey || openrouterKey || openaiKey || nvidiaKey) {
        payload.apiKeys = {
          gemini: geminiKey,
          openrouter: openrouterKey,
          openai: openaiKey,
          nvidia: nvidiaKey,
        };
      }

      const res = await fetch(`/api/bot/${createdBotId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to save final customization');
      }

      // Update localStorage name
      try {
        const existing = JSON.parse(localStorage.getItem('sitebot_saved_bots') || '[]');
        const updated = existing.map((item: any) =>
          item.id === createdBotId ? { ...item, name: botName, siteUrl } : item
        );
        localStorage.setItem('sitebot_saved_bots', JSON.stringify(updated));
      } catch {}

      router.push(`/bot/${createdBotId}`);
    } catch (err: any) {
      setError(err.message || 'Error saving settings.');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans flex min-w-0 flex-col selection:bg-indigo-500 selection:text-white">
      <Navbar />

      <main className="flex-1 py-6 sm:py-12 px-3.5 sm:px-6 lg:px-8 max-w-5xl mx-auto w-full min-w-0 pb-28 xl:pb-16">
        {authLoading ? (
          <div className="py-24 text-center space-y-3">
            <Loader2 className="w-8 h-8 animate-spin text-indigo-600 mx-auto" />
            <p className="text-xs font-semibold text-slate-500">Checking authentication...</p>
          </div>
        ) : !user ? (
          <div className="bg-white rounded-3xl p-5 sm:p-10 border border-slate-200/80 shadow-2xl text-center space-y-6 max-w-lg mx-auto relative overflow-hidden animate-in fade-in duration-300 my-8">
            <div className="h-1.5 w-full bg-gradient-to-r from-indigo-600 via-purple-600 to-rose-600 absolute top-0 left-0" />
            <div className="w-14 h-14 rounded-2xl bg-indigo-50 border border-indigo-100 text-indigo-600 flex items-center justify-center mx-auto shadow-sm">
              <Lock className="w-7 h-7" />
            </div>
            <div className="space-y-2">
              <h2 className="text-2xl font-black text-slate-900 font-heading tracking-tight">
                Sign In to Create Your Chatbot
              </h2>
              <p className="text-xs text-slate-500 leading-relaxed max-w-sm mx-auto">
                First user authentication is required. Please sign in with Google to create your bot project, crawl your domain, and deploy your live widget.
              </p>
            </div>

            <div className="space-y-3 pt-2">
              <button
                type="button"
                onClick={() => setAuthModalOpen(true)}
                className="w-full py-3.5 px-4 rounded-2xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-bold text-xs shadow-md shadow-indigo-600/25 transition-all flex items-center justify-center gap-2 cursor-pointer hover:scale-[1.01] active:scale-[0.99]"
              >
                <span>Continue with Google</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        ) : (
          <>
            {/* Step Progress Tracker */}
            <div className="mb-10 max-w-xl mx-auto">
              <div className="grid grid-cols-3 gap-2 text-center text-[10px] sm:text-xs font-bold text-slate-400">
                <span className={`min-w-0 leading-tight ${step >= 1 ? 'text-indigo-600' : ''}`}>
                  <span className="sm:hidden">1. Setup</span>
                  <span className="hidden sm:inline">1. Project Name &amp; URL</span>
                </span>
                <span className={`min-w-0 leading-tight ${step >= 2 ? 'text-indigo-600' : ''}`}>
                  <span className="sm:hidden">2. Crawl</span>
                  <span className="hidden sm:inline">2. Auto-Crawl &amp; Extract</span>
                </span>
                <span className={`min-w-0 leading-tight ${step >= 3 ? 'text-indigo-600' : ''}`}>
                  <span className="sm:hidden">3. Customize</span>
                  <span className="hidden sm:inline">3. Autofilled Customization</span>
                </span>
              </div>
              <div className="w-full bg-slate-200 h-1.5 rounded-full mt-2 overflow-hidden">
                <div
                  className="bg-gradient-to-r from-indigo-600 to-purple-600 h-full transition-all duration-500"
                  style={{ width: step === 1 ? '33%' : step === 2 ? '66%' : '100%' }}
                />
              </div>
            </div>

        {error && (
          <div className="mb-8 p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-semibold flex items-start gap-2 min-w-0">
            <span className="min-w-0 break-words">⚠️ {error}</span>
          </div>
        )}

        {botLimitError && (
          <div className="mb-8 rounded-3xl bg-gradient-to-br from-indigo-600 to-purple-600 p-6 sm:p-8 text-white shadow-xl shadow-indigo-600/20">
            <div className="flex items-start justify-between gap-3 min-w-0">
              <div className="flex min-w-0 items-center gap-3">
                <div className="w-11 h-11 rounded-2xl bg-white/15 flex items-center justify-center">
                  <CreditCard className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <h3 className="text-base font-extrabold font-heading">Bot limit reached</h3>
                  <p className="text-xs text-white/80 mt-0.5">
                    You have reached the {botLimitError.plan} plan limit of {botLimitError.limit}{' '}
                    chatbot(s).
                  </p>
                </div>
              </div>
              <button
                onClick={() => setBotLimitError(null)}
                className="p-1.5 rounded-lg hover:bg-white/10 transition-colors"
                aria-label="Dismiss"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-xs text-white/80 mt-4">
              Upgrade to Pro to unlock up to <strong>10 chatbots</strong>, 2.5M tokens/month, and
              WhatsApp &amp; Telegram lead alerts.
            </p>
            <div className="mt-4 flex flex-wrap gap-3">
              <Link
                href="/dashboard"
                className="px-5 py-2.5 rounded-xl bg-white text-indigo-700 font-extrabold text-xs shadow-lg hover:scale-[1.02] transition-all"
              >
                Upgrade to Pro — $9/mo
              </Link>
              <button
                onClick={() => setBotLimitError(null)}
                className="px-5 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white font-bold text-xs border border-white/20 transition-colors"
              >
                Manage existing bots
              </button>
            </div>
          </div>
        )}

        {/* ========================================================
            STEP 1: INITIAL SIMPLE SETUP (Name & Website URL)
            ======================================================== */}
        {step === 1 && (
          <div className="bg-white rounded-3xl p-5 sm:p-10 border border-slate-200/80 shadow-xl space-y-6 relative overflow-hidden animate-in fade-in duration-300">
            <div className="h-1.5 w-full bg-gradient-to-r from-indigo-600 via-purple-600 to-rose-600 absolute top-0 left-0" />

            <div className="space-y-2 text-center max-w-md mx-auto">
              <div className="w-12 h-12 rounded-2xl bg-indigo-50 border border-indigo-100 text-indigo-600 flex items-center justify-center mx-auto shadow-sm">
                <Bot className="w-6 h-6" />
              </div>
              <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
                Create Your AI Chatbot
              </h1>
              <p className="text-xs sm:text-sm text-slate-500">
                Enter your website URL and project name. We will automatically crawl your site, extract brand colors, and autofill your entire chatbot settings.
              </p>
            </div>

            <form onSubmit={handleStartCrawl} className="space-y-6 max-w-3xl mx-auto pt-2">
              {/* Plan Tier Selection: Free, Individual, Enterprise */}
              <div className="space-y-3">
                <div className="text-center sm:text-left">
                  <label className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5 justify-center sm:justify-start">
                    <span>Choose Your Chatbot Plan Tier</span>
                  </label>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Select a tier for this chatbot. You can adjust settings or upgrade any time.
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5 pt-1">
                  {/* Free Tier */}
                  <div
                    onClick={() => setSelectedPlanTier('free')}
                    className={`relative p-4 rounded-2xl border-2 cursor-pointer transition-all flex flex-col justify-between ${
                      selectedPlanTier === 'free'
                        ? 'border-indigo-600 bg-indigo-50/40 shadow-md ring-2 ring-indigo-500/20'
                        : 'border-slate-200 hover:border-slate-300 bg-slate-50/50 hover:bg-white'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between gap-2 mb-2">
                        <span className="font-extrabold text-sm text-slate-900 font-heading">
                          Free Starter
                        </span>
                        {selectedPlanTier === 'free' && (
                          <span className="w-5 h-5 rounded-full bg-indigo-600 text-white flex items-center justify-center">
                            <Check className="w-3 h-3 stroke-[3]" />
                          </span>
                        )}
                      </div>
                      <div className="text-lg font-black text-slate-900 mb-1">
                        $0 <span className="text-xs font-normal text-slate-500">/ forever</span>
                      </div>
                      <p className="text-[11px] text-slate-500 leading-tight mb-3">
                        Ideal for testing, hobby projects &amp; personal sites.
                      </p>
                      <ul className="space-y-1.5 text-[11px] text-slate-600">
                        <li className="flex items-center gap-1.5">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                          <span>1 Chatbot project</span>
                        </li>
                        <li className="flex items-center gap-1.5">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                          <span>Up to 15 crawled pages</span>
                        </li>
                        <li className="flex items-center gap-1.5">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                          <span>Standard AI responses</span>
                        </li>
                      </ul>
                    </div>
                  </div>

                  {/* Individual Tier (Popular) */}
                  <div
                    onClick={() => setSelectedPlanTier('individual')}
                    className={`relative p-4 rounded-2xl border-2 cursor-pointer transition-all flex flex-col justify-between ${
                      selectedPlanTier === 'individual'
                        ? 'border-indigo-600 bg-indigo-50/50 shadow-lg ring-2 ring-indigo-500/30'
                        : 'border-slate-200 hover:border-slate-300 bg-slate-50/50 hover:bg-white'
                    }`}
                  >
                    <div className="absolute -top-3 right-4 bg-gradient-to-r from-indigo-600 to-purple-600 text-white text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full shadow-sm">
                      Recommended
                    </div>
                    <div>
                      <div className="flex items-center justify-between gap-2 mb-2">
                        <span className="font-extrabold text-sm text-slate-900 font-heading">
                          Individual Pro
                        </span>
                        {selectedPlanTier === 'individual' && (
                          <span className="w-5 h-5 rounded-full bg-indigo-600 text-white flex items-center justify-center">
                            <Check className="w-3 h-3 stroke-[3]" />
                          </span>
                        )}
                      </div>
                      <div className="text-lg font-black text-indigo-600 mb-1">
                        $19 <span className="text-xs font-normal text-slate-500">/ month</span>
                      </div>
                      <p className="text-[11px] text-slate-500 leading-tight mb-3">
                        For solopreneurs, creators &amp; small business sites.
                      </p>
                      <ul className="space-y-1.5 text-[11px] text-slate-600">
                        <li className="flex items-center gap-1.5">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                          <span>Up to 5 Chatbots</span>
                        </li>
                        <li className="flex items-center gap-1.5">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                          <span>Unlimited crawled pages</span>
                        </li>
                        <li className="flex items-center gap-1.5">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                          <span>Lead capture &amp; alerts</span>
                        </li>
                        <li className="flex items-center gap-1.5">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                          <span>Custom brand styling</span>
                        </li>
                      </ul>
                    </div>
                  </div>

                  {/* Enterprise Tier */}
                  <div
                    onClick={() => setSelectedPlanTier('enterprise')}
                    className={`relative p-4 rounded-2xl border-2 cursor-pointer transition-all flex flex-col justify-between ${
                      selectedPlanTier === 'enterprise'
                        ? 'border-indigo-600 bg-indigo-50/40 shadow-md ring-2 ring-indigo-500/20'
                        : 'border-slate-200 hover:border-slate-300 bg-slate-50/50 hover:bg-white'
                    }`}
                  >
                    <div className="absolute -top-3 right-4 bg-slate-900 text-amber-300 text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full shadow-sm">
                      Max Scale
                    </div>
                    <div>
                      <div className="flex items-center justify-between gap-2 mb-2">
                        <span className="font-extrabold text-sm text-slate-900 font-heading">
                          Enterprise
                        </span>
                        {selectedPlanTier === 'enterprise' && (
                          <span className="w-5 h-5 rounded-full bg-indigo-600 text-white flex items-center justify-center">
                            <Check className="w-3 h-3 stroke-[3]" />
                          </span>
                        )}
                      </div>
                      <div className="text-lg font-black text-slate-900 mb-1">
                        $99 <span className="text-xs font-normal text-slate-500">/ month</span>
                      </div>
                      <p className="text-[11px] text-slate-500 leading-tight mb-3">
                        For agencies, high-traffic SaaS &amp; multi-brands.
                      </p>
                      <ul className="space-y-1.5 text-[11px] text-slate-600">
                        <li className="flex items-center gap-1.5">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                          <span>Unlimited chatbots</span>
                        </li>
                        <li className="flex items-center gap-1.5">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                          <span>Custom AI models &amp; keys</span>
                        </li>
                        <li className="flex items-center gap-1.5">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                          <span>Dedicated SLA &amp; webhooks</span>
                        </li>
                      </ul>
                    </div>
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Target Website URL <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                    <Globe className="w-4 h-4" />
                  </div>
                  <input
                    type="url"
                    required
                    value={siteUrl}
                    onChange={handleUrlChange}
                    placeholder="https://example.com"
                    className="w-full pl-10 pr-4 py-3 rounded-2xl bg-slate-50 border border-slate-300 text-sm text-slate-900 focus:bg-white focus:outline-none focus:border-indigo-600 font-mono shadow-inner"
                  />
                </div>
                <p className="text-[11px] text-slate-400 mt-1">
                  Our crawler will discover subpages, documentation, contact info, and FAQs automatically.
                </p>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Project / Chatbot Name <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={botName}
                  onChange={(e) => setBotName(e.target.value)}
                  placeholder="e.g. Nexus Digital Assistant"
                  className="w-full px-4 py-3 rounded-2xl bg-slate-50 border border-slate-300 text-sm text-slate-900 focus:bg-white focus:outline-none focus:border-indigo-600"
                />
              </div>

              <button
                type="submit"
                disabled={loading || !siteUrl.trim()}
                className="w-full py-4 rounded-2xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-extrabold text-sm shadow-xl shadow-indigo-600/25 transition-all hover:scale-[1.01] active:scale-[0.99] flex items-center justify-center gap-2 disabled:opacity-50"
              >
                <span>Start Crawl &amp; Auto-Discover Details</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </form>
          </div>
        )}

        {/* ========================================================
            STEP 2: LIVE CRAWLING & IDENTITY EXTRACTION IN-PROGRESS
            ======================================================== */}
        {step === 2 && (
          <div className="bg-white rounded-3xl p-5 sm:p-10 border border-slate-200/80 shadow-2xl text-center space-y-6 relative overflow-hidden animate-in fade-in duration-300">
            <div className="h-1.5 w-full bg-gradient-to-r from-indigo-600 via-purple-600 to-rose-600 absolute top-0 left-0" />

            <div className="relative w-16 h-16 mx-auto">
              <div className="w-16 h-16 rounded-full bg-indigo-50 border border-indigo-200 flex items-center justify-center text-indigo-600 animate-pulse">
                <Globe className="w-8 h-8 animate-spin [animation-duration:8s]" />
              </div>
            </div>

            <div className="space-y-1.5 max-w-md mx-auto">
              <h2 className="text-xl font-bold text-slate-900 break-words">
                Crawling &amp; Vectorizing {siteUrl}
              </h2>
              <p className="text-xs text-slate-500 leading-relaxed font-mono">
                {crawlMessage}
              </p>
            </div>

            {/* Live Progress Bar */}
            <div className="max-w-md mx-auto space-y-2">
              <div className="flex justify-between text-xs font-bold text-slate-600">
                <span>Indexing Knowledge</span>
                <span className="text-indigo-600">{crawlProgress}%</span>
              </div>
              <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden border border-slate-200">
                <div
                  className="bg-gradient-to-r from-indigo-600 via-purple-600 to-emerald-500 h-full transition-all duration-300 rounded-full"
                  style={{ width: `${Math.max(crawlProgress, 5)}%` }}
                />
              </div>
            </div>

            {/* Extracted Details Pill Grid (Pops in dynamically) */}
            <div className="pt-4 flex flex-wrap items-center justify-center gap-3 text-xs">
              <span className="max-w-full min-w-0 px-3 py-1.5 rounded-xl bg-slate-100 text-slate-700 border border-slate-200 flex items-center gap-1.5 break-words">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                <span>Recursive Link Traversal</span>
              </span>
              <span className="max-w-full min-w-0 px-3 py-1.5 rounded-xl bg-slate-100 text-slate-700 border border-slate-200 flex items-center gap-1.5 break-words">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                <span>Qdrant 768d Vector Memory</span>
              </span>
              <span className="max-w-full min-w-0 px-3 py-1.5 rounded-xl bg-slate-100 text-slate-700 border border-slate-200 flex items-center gap-1.5 break-words">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                <span>Identity &amp; Contact Detection</span>
              </span>
            </div>

            <div className="text-[11px] text-slate-400">
              Please wait a few seconds. The customization form will unlock automatically once indexing completes.
            </div>
          </div>
        )}

        {/* ========================================================
            STEP 3: AUTOFILLED CUSTOMIZATION FORM (Unlocked after crawl!)
            ======================================================== */}
        {step === 3 && (
          <form onSubmit={handleFinalSave} className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-300">
            {/* Success Banner */}
            <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-900 flex items-center justify-between gap-4">
              <div className="flex min-w-0 items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
                  <Check className="w-5 h-5 stroke-[2.5]" />
                </div>
                <div className="min-w-0">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-emerald-800">
                    Website Crawled &amp; Details Autofilled!
                  </h3>
                  <p className="text-xs text-emerald-700 mt-0.5">
                    We extracted your brand identity, contact information, and knowledge chunks. You can review or modify any details below.
                  </p>
                </div>
              </div>
              <button
                type="submit"
                disabled={loading}
                className="hidden sm:inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-md shadow-emerald-600/20 shrink-0 transition-all hover:scale-105"
              >
                <span>Save &amp; Open Studio</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* AI Meta-Analysis & Guardrails Derived Config Card */}
            {derivedBotConfig && (
              <div className="bg-gradient-to-br from-indigo-950 via-slate-900 to-purple-950 rounded-3xl p-7 sm:p-8 text-white border border-indigo-500/20 shadow-xl space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2 min-w-0">
                  <div className="inline-flex min-w-0 max-w-full items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/20 border border-indigo-400/30 text-indigo-300 text-xs font-bold uppercase tracking-wider">
                    <span>AI Meta-Analysis Derived Identity &amp; Guardrails</span>
                  </div>
                  <span className="text-xs px-2.5 py-1 rounded-lg bg-emerald-500/20 text-emerald-300 font-bold border border-emerald-400/30">
                    Strict RAG Active
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                  <div className="bg-white/5 border border-white/10 rounded-2xl p-4">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-indigo-300">
                      Detected Business Tone
                    </span>
                    <p className="text-sm font-semibold text-slate-100 mt-1 capitalize">
                      {derivedBotConfig.tone || 'Professional & Consultative'}
                    </p>
                  </div>
                  <div className="bg-white/5 border border-white/10 rounded-2xl p-4">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-indigo-300">
                      Core Value Proposition
                    </span>
                    <p className="text-xs text-slate-200 mt-1 line-clamp-2">
                      {derivedBotConfig.core_value_prop || 'Empowering visitors through tailored AI assistance.'}
                    </p>
                  </div>
                </div>

                {derivedBotConfig.lead_triggers && derivedBotConfig.lead_triggers.length > 0 && (
                  <div className="pt-1">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-indigo-300 block mb-2">
                      Dynamic Contextual Lead Triggers
                    </span>
                    <div className="flex flex-wrap gap-2">
                      {derivedBotConfig.lead_triggers.map((trigger, idx) => (
                        <span
                          key={idx}
                          className="px-3 py-1.5 rounded-xl bg-indigo-600/30 border border-indigo-500/30 text-xs font-semibold text-indigo-200"
                        >
                          ⚡ {trigger}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {derivedBotConfig.qualification_questions && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                    <div className="bg-black/20 border border-white/5 rounded-xl p-3">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-400">
                        Email Lead Question
                      </span>
                      <p className="text-xs text-slate-300 mt-0.5">
                        &ldquo;{derivedBotConfig.qualification_questions.ask_for_email}&rdquo;
                      </p>
                    </div>
                    <div className="bg-black/20 border border-white/5 rounded-xl p-3">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-400">
                        Phone Lead Question
                      </span>
                      <p className="text-xs text-slate-300 mt-0.5">
                        &ldquo;{derivedBotConfig.qualification_questions.ask_for_phone}&rdquo;
                      </p>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* 1. Brand & Appearance Card */}
            <div className="bg-white rounded-3xl p-4 sm:p-8 border border-slate-200/80 shadow-sm space-y-6">
              <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
                <Palette className="w-5 h-5 text-indigo-600" />
                <h3 className="text-sm font-bold uppercase tracking-wider text-slate-900">
                  Brand &amp; Appearance
                </h3>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Chatbot Display Name
                  </label>
                  <input
                    type="text"
                    required
                    value={botName}
                    onChange={(e) => setBotName(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-300 text-xs text-slate-900 focus:bg-white focus:outline-none focus:border-indigo-600 font-semibold"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Target Website URL
                  </label>
                  <input
                    type="url"
                    required
                    value={siteUrl}
                    onChange={(e) => setSiteUrl(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-300 text-xs text-slate-900 focus:bg-white focus:outline-none focus:border-indigo-600 font-mono"
                  />
                </div>
              </div>

              {/* Color Selection */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-2">
                  Primary Brand Color <span className="text-slate-400 font-normal">(Autofilled from Website)</span>
                </label>
                <div className="flex flex-wrap items-center gap-3">
                  {COLOR_PRESETS.map((c) => (
                    <button
                      key={c.hex}
                      type="button"
                      onClick={() => setPrimaryColor(c.hex)}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all ${
                        primaryColor.toLowerCase() === c.hex.toLowerCase()
                          ? 'border-slate-900 bg-slate-900 text-white shadow-sm'
                          : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      <span className="w-3.5 h-3.5 rounded-full" style={{ backgroundColor: c.hex }} />
                      <span>{c.name}</span>
                    </button>
                  ))}
                  <div className="flex items-center gap-2 px-3 py-1 rounded-xl border border-slate-200 bg-white">
                    <input
                      type="color"
                      value={primaryColor}
                      onChange={(e) => setPrimaryColor(e.target.value)}
                      className="w-6 h-6 rounded cursor-pointer border-0 bg-transparent"
                    />
                    <span className="text-xs font-mono font-bold text-slate-700 uppercase">
                      {primaryColor}
                    </span>
                  </div>
                </div>
              </div>

              {/* Launcher Style & Position */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 pt-2">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Launcher Button Style
                  </label>
                  <select
                    value={launcherStyle}
                    onChange={(e: any) => setLauncherStyle(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-300 text-xs text-slate-900 focus:bg-white focus:outline-none focus:border-indigo-600"
                  >
                    {LAUNCHER_PRESETS.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.emoji ? `${p.emoji} ` : ''}{p.label} — {p.desc}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Widget Screen Position
                  </label>
                  <select
                    value={position}
                    onChange={(e: any) => setPosition(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-300 text-xs text-slate-900 focus:bg-white focus:outline-none focus:border-indigo-600"
                  >
                    <option value="bottom-right">Bottom Right Corner</option>
                    <option value="bottom-left">Bottom Left Corner</option>
                  </select>
                </div>
              </div>
            </div>

            {/* 2. Fast Actions & Contact Links Card (Autofilled!) */}
            <div className="bg-white rounded-3xl p-4 sm:p-8 border border-slate-200/80 shadow-sm space-y-6">
              <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
                <Zap className="w-5 h-5 text-amber-500" />
                <div>
                  <h3 className="text-sm font-bold uppercase tracking-wider text-slate-900">
                    Contact &amp; Fast Action Buttons
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    Autofilled from your website. Leave any field empty to hide that button in the widget fast bar.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    📞 Phone Number &mdash; controls &ldquo;Call Now&rdquo; button
                  </label>
                  <input
                    type="text"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+91 96962 62007"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-300 text-xs text-slate-900 focus:bg-white focus:outline-none focus:border-indigo-600 font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    💬 WhatsApp Number &mdash; controls &ldquo;WhatsApp&rdquo; button
                  </label>
                  <input
                    type="text"
                    value={whatsapp}
                    onChange={(e) => setWhatsapp(e.target.value)}
                    placeholder="919696262007 (digits only)"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-300 text-xs text-slate-900 focus:bg-white focus:outline-none focus:border-indigo-600 font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    ✉️ Support Email &mdash; used by AI when asked for email
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="support@yoursite.com"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-300 text-xs text-slate-900 focus:bg-white focus:outline-none focus:border-indigo-600"
                  />
                </div>

                <div className="sm:col-span-2 min-w-0">
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    🔗 Quick Links <span className="text-slate-400 font-normal">(auto-added from crawling or you can add/remove)</span>
                  </label>
                  <div className="space-y-2">
                    {customLinks.map((link, linkIdx) => (
                      <div key={linkIdx} className="grid grid-cols-1 sm:grid-cols-[minmax(0,1fr)_minmax(0,2fr)_auto] items-center gap-2 min-w-0">
                        <input
                          type="text"
                          value={link.label}
                          onChange={(e) => {
                            const updated = [...customLinks];
                            updated[linkIdx] = { ...updated[linkIdx], label: e.target.value };
                            setCustomLinks(updated);
                          }}
                          placeholder="Button label, e.g. Book a Demo"
                          className="w-full min-w-0 px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-300 text-xs text-slate-900 focus:bg-white focus:outline-none focus:border-indigo-600"
                        />
                        <input
                          type="text"
                          value={link.url}
                          onChange={(e) => {
                            const updated = [...customLinks];
                            updated[linkIdx] = { ...updated[linkIdx], url: e.target.value };
                            setCustomLinks(updated);
                          }}
                          placeholder="https://yoursite.com/demo"
                          className="w-full min-w-0 px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-300 text-xs text-slate-900 focus:bg-white focus:outline-none focus:border-indigo-600 font-mono"
                        />
                        <button
                          type="button"
                          aria-label="Remove quick link"
                          title="Remove this quick link"
                          onClick={() => setCustomLinks(customLinks.filter((_, i) => i !== linkIdx))}
                          className="justify-self-end sm:justify-self-auto p-2.5 rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors shrink-0"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                    {customLinks.length === 0 && (
                      <p className="text-[11px] text-slate-400">
                        No quick links yet. Pick trending presets below or crawl your site to auto-detect them.
                      </p>
                    )}
                    <button
                      type="button"
                      onClick={() => setCustomLinks([...customLinks, { label: '', url: '' }])}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[11px] font-bold text-indigo-600 border border-dashed border-indigo-300 hover:bg-indigo-50 transition-colors"
                    >
                      <Plus className="w-3.5 h-3.5" /> Add Quick Link
                    </button>
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mt-3 mb-1.5">
                        Trending presets — tap to add
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        {QUICK_LINK_PRESETS.map((preset) => {
                          const exists = customLinks.some(
                            (l) =>
                              l.label.toLowerCase() === preset.label.toLowerCase() ||
                              l.url === preset.url
                          );
                          return (
                            <button
                              key={preset.label}
                              type="button"
                              disabled={exists}
                              onClick={() =>
                                setCustomLinks([...customLinks, { label: preset.label, url: preset.url }])
                              }
                              className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[10px] font-bold transition-colors ${
                                exists
                                  ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                                  : 'bg-slate-50 border border-slate-200 text-slate-600 hover:border-indigo-300 hover:text-indigo-600 hover:bg-indigo-50'
                              }`}
                            >
                              <span>{preset.emoji}</span>
                              {preset.label}
                              {!exists && <Plus className="w-3 h-3 opacity-60" />}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* 3. AI Behavior & Persona Card (Autofilled!) */}
            <div className="bg-white rounded-3xl p-4 sm:p-8 border border-slate-200/80 shadow-sm space-y-5">
              <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
                <Bot className="w-5 h-5 text-indigo-600" />
                <h3 className="text-sm font-bold uppercase tracking-wider text-slate-900">
                  AI Persona &amp; Greeting (Crafted from Knowledge)
                </h3>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Welcome Greeting Message
                </label>
                <textarea
                  rows={2}
                  value={greeting}
                  onChange={(e) => setGreeting(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-300 text-xs text-slate-900 focus:bg-white focus:outline-none focus:border-indigo-600 resize-none leading-relaxed"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  System Prompt &amp; Behavioral Guardrails
                </label>
                <textarea
                  rows={4}
                  value={systemPrompt}
                  onChange={(e) => setSystemPrompt(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-300 text-xs text-slate-900 focus:bg-white focus:outline-none focus:border-indigo-600 resize-none font-mono text-[11px] leading-relaxed"
                />
              </div>

              <div>
                <div className="flex flex-wrap items-center justify-between gap-2 mb-2 min-w-0">
                  <label className="block min-w-0 text-xs font-bold text-slate-700 dark:text-slate-200 break-words">
                    Auto-Generated Suggested Questions{' '}
                    <span className="text-slate-400 font-normal">(Click question text to edit)</span>
                  </label>
                  {!isAddingQuestion && (
                    <button
                      type="button"
                      onClick={() => setIsAddingQuestion(true)}
                      className="inline-flex items-center gap-1 text-[11px] font-bold text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Add Question</span>
                    </button>
                  )}
                </div>

                {/* Question Chips list */}
                <div className="flex flex-wrap gap-2 items-center">
                  {suggestedQuestions.map((q, qIdx) => {
                    const isEditing = editingQuestionIdx === qIdx;
                    if (isEditing) {
                      return (
                        <div
                          key={qIdx}
                          className="flex w-full sm:w-auto min-w-0 flex-wrap items-center gap-1.5 p-1 px-2.5 rounded-xl bg-white dark:bg-slate-800 border-2 border-indigo-500 shadow-md shadow-indigo-500/10"
                        >
                          <input
                            type="text"
                            value={editingQuestionText}
                            onChange={(e) => setEditingQuestionText(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.preventDefault();
                                handleSaveEditQuestion();
                              } else if (e.key === 'Escape') {
                                handleCancelEditQuestion();
                              }
                            }}
                            autoFocus
                            className="text-xs bg-transparent text-slate-900 dark:text-white outline-none w-full sm:w-[200px] min-w-0"
                          />
                          <button
                            type="button"
                            onClick={handleSaveEditQuestion}
                            className="p-1 rounded-md text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 cursor-pointer"
                            title="Save"
                          >
                            <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                          </button>
                          <button
                            type="button"
                            onClick={handleCancelEditQuestion}
                            className="p-1 rounded-md text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
                            title="Cancel"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      );
                    }

                    return (
                      <div
                        key={qIdx}
                        className="group flex min-w-0 max-w-full items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-indigo-50 dark:hover:bg-slate-700/80 border border-slate-200/80 dark:border-slate-700 text-xs text-slate-700 dark:text-slate-200 transition-all cursor-pointer select-none"
                      >
                        <span
                          onClick={() => handleStartEditQuestion(qIdx)}
                           className="min-w-0 hover:text-indigo-600 dark:hover:text-indigo-400 flex items-center gap-1.5 cursor-pointer"
                          title="Click to edit"
                        >
                           <span className="min-w-0 break-words">{q}</span>
                          <Pencil className="w-3 h-3 text-slate-400 opacity-60 group-hover:opacity-100 transition-opacity" />
                        </span>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteQuestion(qIdx);
                          }}
                          className="text-slate-400 hover:text-rose-500 font-bold ml-1 p-0.5 rounded cursor-pointer transition-colors"
                          title="Remove question"
                        >
                          <X className="w-3 h-3 stroke-[2.5]" />
                        </button>
                      </div>
                    );
                  })}

                  {/* Inline Add Question Input */}
                  {isAddingQuestion && (
                    <div className="flex w-full sm:w-auto min-w-0 flex-wrap items-center gap-1.5 p-1 px-2.5 rounded-xl bg-white dark:bg-slate-800 border-2 border-indigo-500 shadow-md shadow-indigo-500/10">
                      <input
                        type="text"
                        value={newQuestionInput}
                        onChange={(e) => setNewQuestionInput(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            handleAddQuestion();
                          } else if (e.key === 'Escape') {
                            setIsAddingQuestion(false);
                            setNewQuestionInput('');
                          }
                        }}
                        placeholder="Type suggested question..."
                        autoFocus
                        className="text-xs bg-transparent text-slate-900 dark:text-white outline-none w-full sm:w-[200px] min-w-0"
                      />
                      <button
                        type="button"
                        onClick={() => handleAddQuestion()}
                        disabled={!newQuestionInput.trim()}
                        className="p-1 rounded-md text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 disabled:opacity-40 cursor-pointer"
                        title="Add"
                      >
                        <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setIsAddingQuestion(false);
                          setNewQuestionInput('');
                        }}
                        className="p-1 rounded-md text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
                        title="Cancel"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* 4. AI Models & BYOK Keys Accordion */}
            <div className="bg-white rounded-3xl p-4 sm:p-6 border border-slate-200/80 shadow-sm space-y-4">
              <button
                type="button"
                onClick={() => setShowAdvanced(!showAdvanced)}
                className="w-full flex items-center justify-between gap-3 text-left min-w-0"
              >
                <div className="flex min-w-0 flex-wrap items-center gap-2">
                  <Cpu className="w-5 h-5 text-indigo-600" />
                  <span className="text-sm font-bold text-slate-900 min-w-0 break-words">
                    AI Models &amp; BYOK Keys Configuration
                  </span>
                  <span className="max-w-full truncate text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
                    {activeProvider.toUpperCase()} &bull; {chatModel}
                  </span>
                </div>
                {showAdvanced ? <ChevronUp className="w-4 h-4 text-slate-400 shrink-0" /> : <ChevronDown className="w-4 h-4 text-slate-400 shrink-0" />}
              </button>

              {showAdvanced && (
                <div className="pt-4 border-t border-slate-100 space-y-5 animate-in fade-in">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-2">
                      Choose AI LLM Provider
                    </label>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                      {(['openai', 'nvidia', 'gemini', 'openrouter'] as const).map((prov) => (
                        <button
                          key={prov}
                          type="button"
                          onClick={() => {
                            setActiveProvider(prov);
                            if (prov === 'openai') setChatModel('gpt-4o-mini');
                            if (prov === 'nvidia') setChatModel('meta/muse-glimmer-30b');
                            if (prov === 'gemini') setChatModel('gemini-2.5-flash');
                            if (prov === 'openrouter') setChatModel('meta-llama/llama-3-8b-instruct:free');
                          }}
                          className={`p-3 rounded-xl border text-xs font-bold uppercase transition-all ${
                            activeProvider === prov
                              ? 'border-indigo-600 bg-indigo-50 text-indigo-700'
                              : 'border-slate-200 hover:border-slate-300 text-slate-600'
                          }`}
                        >
                          {prov}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">Chat Model</label>
                      <input
                        type="text"
                        value={chatModel}
                        onChange={(e) => setChatModel(e.target.value.trim().toLowerCase())}
                        className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-300 text-xs font-mono"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        Optional {activeProvider.toUpperCase()} API Key (BYOK)
                      </label>
                      <input
                        type="password"
                        placeholder="Leave empty to use server default credentials"
                        value={
                          activeProvider === 'openai'
                            ? openaiKey
                            : activeProvider === 'nvidia'
                            ? nvidiaKey
                            : activeProvider === 'gemini'
                            ? geminiKey
                            : openrouterKey
                        }
                        onChange={(e) => {
                          const v = e.target.value;
                          if (activeProvider === 'openai') setOpenaiKey(v);
                          if (activeProvider === 'nvidia') setNvidiaKey(v);
                          if (activeProvider === 'gemini') setGeminiKey(v);
                          if (activeProvider === 'openrouter') setOpenrouterKey(v);
                        }}
                        className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-300 text-xs font-mono"
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Bottom Final Submit Bar */}
            <div className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-4">
              <button
                type="button"
                onClick={() => setStep(1)}
                className="text-xs font-semibold text-slate-500 hover:text-slate-800 transition-colors"
              >
                &larr; Start Over with Different URL
              </button>

              <button
                type="submit"
                disabled={loading}
                className="w-full sm:w-auto px-8 py-4 rounded-2xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-extrabold text-sm shadow-xl shadow-indigo-600/25 transition-all hover:scale-105 active:scale-95 flex items-center justify-center gap-2.5 disabled:opacity-50"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Saving Customization...</span>
                  </>
                ) : (
                  <>
                    <span>Save &amp; Open Chatbot Studio</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </div>
          </form>
        )}
          </>
        )}
      </main>

      <AuthModal
        isOpen={authModalOpen}
        onClose={() => setAuthModalOpen(false)}
        title="Sign In to Create Bot"
        subtitle="Sign in with your Google account to create and manage your website chatbots."
      />

      <Footer />
    </div>
  );
}
