'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Bot,
  Sparkles,
  Globe,
  Code2,
  Copy,
  Check,
  Play,
  RotateCcw,
  Settings,
  Database,
  Key,
  Trash2,
  ExternalLink,
  ChevronRight,
  Plus,
  Send,
  Loader2,
  AlertCircle,
  FileText,
  HelpCircle,
  Layers,
  Palette,
  CheckCircle2,
  X,
  RefreshCw,
  Search,
  Sliders,
  Cpu,
  Phone,
  MessageCircle,
  Zap,
  ArrowRight,
  Link2,
  ShieldCheck,
  User,
} from 'lucide-react';
import { Navbar } from '@/components/Navbar';
import { QdrantSetupGuide } from '@/components/QdrantSetupGuide';

interface BotDetail {
  id: string;
  name: string;
  siteUrl: string;
  systemPrompt: string;
  primaryColor: string;
  position: 'bottom-right' | 'bottom-left';
  chatProvider: string;
  chatModel: string;
  embedProvider: string;
  embedModel: string;
  greeting: string;
  suggestedQuestions: string[];
  phone?: string;
  whatsapp?: string;
  email?: string;
  auditUrl?: string;
  pricingUrl?: string;
  customLinks?: Array<{ label: string; url: string }>;
  maskedKeys?: {
    gemini?: string;
    openrouter?: string;
    openai?: string;
    nvidia?: string;
  };
  apiKeysConfigured?: {
    gemini: boolean;
    openrouter: boolean;
    openai: boolean;
    nvidia: boolean;
  };
  customVectorDb?: {
    enabled: boolean;
    provider: string;
    url: string;
    apiKey?: string;
    hasApiKey?: boolean;
    collectionName?: string;
  };
}

interface CrawledPageItem {
  id: string;
  url: string;
  title: string;
  status: string;
  chunkCount: number;
  error?: string;
  updatedAt: string;
}

interface ChunkItem {
  id: string;
  pageUrl: string;
  content: string;
  metadata?: any;
  createdAt: string;
}

export default function BotDashboardPage() {
  const params = useParams();
  const router = useRouter();
  const botId = params?.id as string;

  const [bot, setBot] = useState<BotDetail | null>(null);
  const [stats, setStats] = useState({ totalPages: 0, indexedPages: 0, totalChunks: 0 });
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'playground' | 'crawler' | 'appearance' | 'ai' | 'security' | 'qdrant'>('playground');
  const [copiedCode, setCopiedCode] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [toastMsg, setToastMsg] = useState<{
    id: number;
    message: string;
    type: 'success' | 'error';
  } | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToastMsg({ id: Date.now(), message, type });
    toastTimer.current = setTimeout(() => setToastMsg(null), 3000);
  };

  // Crawler State
  const [pages, setPages] = useState<CrawledPageItem[]>([]);
  const [chunks, setChunks] = useState<ChunkItem[]>([]);
  const [crawling, setCrawling] = useState(false);
  const [crawlMessage, setCrawlMessage] = useState('');
  const [crawlProgress, setCrawlProgress] = useState(0);
  const [maxCrawlPages, setMaxCrawlPages] = useState(15);
  const [showManualModal, setShowManualModal] = useState(false);
  const [manualTitle, setManualTitle] = useState('');
  const [manualContent, setManualContent] = useState('');
  const [addingManual, setAddingManual] = useState(false);

  // Form State
  const [formData, setFormData] = useState({
    name: '',
    siteUrl: '',
    primaryColor: '#BE123C',
    position: 'bottom-right' as 'bottom-right' | 'bottom-left',
    launcherStyle: 'standard' as 'standard' | 'minimal' | 'pill' | 'chat',
    greeting: '',
    systemPrompt: '',
    suggestedQuestions: [] as string[],
    phone: '',
    whatsapp: '',
    email: '',
    auditUrl: '',
    pricingUrl: '',
    chatProvider: 'openai',
    chatModel: 'gpt-4o-mini',
    embedProvider: 'openai',
    embedModel: 'text-embedding-3-small',
    geminiKey: '',
    openrouterKey: '',
    openaiKey: '',
    nvidiaKey: '',
    customDbEnabled: false,
    customDbUrl: '',
    customDbApiKey: '',
    customDbCollection: '',
    customLinks: [] as Array<{ label: string; url: string }>,
    slug: '',
    allowedOrigins: '',
    rateLimitEnabled: false,
    rateLimitMax: 20,
    rateLimitWindow: 60,
  });

  // Custom DB test state
  const [testingDb, setTestingDb] = useState(false);
  const [dbTestResult, setDbTestResult] = useState<{ success: boolean; message: string } | null>(null);

  // Playground Chat State
  const [chatMessages, setChatMessages] = useState<
    Array<{ role: 'user' | 'assistant'; content: string; sources?: any[] }>
  >([]);
  const [chatInput, setChatInput] = useState('');
  const [isChatStreaming, setIsChatStreaming] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Fetch bot details
  const fetchBot = async () => {
    try {
      const res = await fetch(`/api/bot/${botId}`);
      if (!res.ok) throw new Error('Bot not found');
      const data = await res.json();
      setBot(data.bot);
      setStats(data.stats);

      setFormData({
        name: data.bot.name,
        siteUrl: data.bot.siteUrl,
        primaryColor: data.bot.primaryColor,
        position: data.bot.position,
        launcherStyle: (data.bot.launcherStyle || 'standard') as 'standard' | 'minimal' | 'pill' | 'chat',
        greeting: data.bot.greeting,
        systemPrompt: data.bot.systemPrompt,
        suggestedQuestions: data.bot.suggestedQuestions || [],
        phone: data.bot.phone || '',
        whatsapp: data.bot.whatsapp || '',
        email: data.bot.email || '',
        auditUrl: data.bot.auditUrl || '',
        pricingUrl: data.bot.pricingUrl || '',
        chatProvider: data.bot.chatProvider || 'openai',
        chatModel: data.bot.chatModel || 'gpt-4o-mini',
        embedProvider: data.bot.embedProvider || 'openai',
        embedModel: data.bot.embedModel || 'text-embedding-3-small',
        geminiKey: '',
        openrouterKey: '',
        openaiKey: '',
        nvidiaKey: '',
        customDbEnabled: data.bot.customVectorDb?.enabled || false,
        customDbUrl: data.bot.customVectorDb?.url || '',
        customDbApiKey: data.bot.customVectorDb?.apiKey || '',
        customDbCollection: data.bot.customVectorDb?.collectionName || '',
        customLinks: data.bot.customLinks || [],
        slug: data.bot.slug || '',
        allowedOrigins: (data.bot.allowedOrigins || []).join(''),
        rateLimitEnabled: data.bot.rateLimit?.enabled || false,
        rateLimitMax: data.bot.rateLimit?.maxRequests || 20,
        rateLimitWindow: Math.round((data.bot.rateLimit?.windowMs || 60000) / 1000),
      });

      if (chatMessages.length === 0) {
        setChatMessages([
          {
            role: 'assistant',
            content: data.bot.greeting || 'Hi there! How can I help you today?',
          },
        ]);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const fetchKnowledge = async () => {
    try {
      const res = await fetch(`/api/knowledge/${botId}`);
      if (res.ok) {
        const data = await res.json();
        setPages(data.pages || []);
        setChunks(data.chunks || []);
      }
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    if (botId) {
      fetchBot();
      fetchKnowledge();
    }
  }, [botId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages, isChatStreaming]);

  const handleStartCrawl = async () => {
    setCrawling(true);
    setCrawlProgress(0);
    setCrawlMessage('Preparing crawl...');
    try {
      const res = await fetch('/api/crawl', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'text/event-stream' },
        body: JSON.stringify({
          chatbotId: botId,
          maxPages: maxCrawlPages,
          resetExisting: true,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Crawl failed');
      }

      const reader = res.body?.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let result: { message?: string } | null = null;
      let streamError: Error | null = null;

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
              result = JSON.parse(dataStr);
            } catch {}
          } else if (eventType === 'error') {
            try {
              const e = JSON.parse(dataStr);
              streamError = new Error(e.error || 'Crawl failed');
            } catch {
              streamError = new Error('Crawl failed');
            }
          }
        }
      }

      if (streamError) throw streamError;

      setCrawlProgress(100);
      setCrawlMessage(result?.message || 'Crawl complete!');
      showToast(result?.message || 'Crawl complete!');
      await fetchBot();
      await fetchKnowledge();
    } catch (err: any) {
      setCrawlMessage(`Error: ${err.message}`);
      showToast(err.message, 'error');
    } finally {
      setCrawling(false);
    }
  };

  const handleAddManualSnippet = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualTitle || !manualContent) return;
    setAddingManual(true);
    try {
      const res = await fetch(`/api/knowledge/${botId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: manualTitle,
          content: manualContent,
        }),
      });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error || 'Failed to add snippet');
      }
      setManualTitle('');
      setManualContent('');
      setShowManualModal(false);
      showToast('Manual Q&amp;A added to knowledge base');
      await fetchBot();
      await fetchKnowledge();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setAddingManual(false);
    }
  };

  const handleDeleteKnowledge = async (type: 'page' | 'chunk', id: string) => {
    if (!confirm(`Are you sure you want to delete this ${type}?`)) return;
    try {
      const param = type === 'page' ? `pageId=${id}` : `chunkId=${id}`;
      await fetch(`/api/knowledge/${botId}?${param}`, { method: 'DELETE' });
      showToast(`${type === 'page' ? 'Page' : 'Chunk'} removed from knowledge base`);
      await fetchBot();
      await fetchKnowledge();
    } catch (err) {
      console.error(err);
    }
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const payload: any = {
        name: formData.name,
        siteUrl: formData.siteUrl,
        primaryColor: formData.primaryColor,
        position: formData.position,
        greeting: formData.greeting,
        systemPrompt: formData.systemPrompt,
        suggestedQuestions: formData.suggestedQuestions,
        phone: formData.phone,
        whatsapp: formData.whatsapp,
        email: formData.email,
        auditUrl: formData.auditUrl,
        pricingUrl: formData.pricingUrl,
        launcherStyle: formData.launcherStyle,
        customLinks: formData.customLinks
          .map((l) => ({ label: l.label?.trim() || '', url: l.url?.trim() || '' }))
          .filter((l) => l.label && l.url),
        chatProvider: formData.chatProvider,
        chatModel: formData.chatModel,
        embedProvider: formData.embedProvider,
        embedModel: formData.embedModel,
        customVectorDb: {
          enabled: formData.customDbEnabled,
          provider: 'qdrant',
          url: formData.customDbUrl,
          apiKey: formData.customDbApiKey,
          collectionName: formData.customDbCollection,
        },
        slug: formData.slug.trim() || null,
        allowedOrigins: formData.allowedOrigins,
        rateLimit: {
          enabled: formData.rateLimitEnabled,
          maxRequests: Math.max(1, Number(formData.rateLimitMax) || 20),
          windowMs: Math.max(10, Number(formData.rateLimitWindow) || 60) * 1000,
        },
      };

      if (
        formData.geminiKey ||
        formData.openrouterKey ||
        formData.openaiKey ||
        formData.nvidiaKey
      ) {
        payload.apiKeys = {
          gemini: formData.geminiKey,
          openrouter: formData.openrouterKey,
          openai: formData.openaiKey,
          nvidia: formData.nvidiaKey,
        };
      }

      const res = await fetch(`/api/bot/${botId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || 'Failed to save settings');
      }
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2500);
      showToast('Settings saved successfully');
      await fetchBot();
    } catch (err: any) {
      showToast(err.message || 'Error updating settings', 'error');
    }
  };

  const handleTestCustomDb = async () => {
    if (!formData.customDbUrl) {
      setDbTestResult({
        success: false,
        message: 'Please enter a valid Qdrant URL starting with https:// or http://',
      });
      return;
    }
    setTestingDb(true);
    setDbTestResult(null);
    try {
      const res = await fetch('/api/database/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: formData.customDbUrl,
          apiKey: formData.customDbApiKey || undefined,
        }),
      });
      const data = await res.json();
      setDbTestResult({
        success: data.success,
        message: data.message || (data.success ? 'Connected successfully!' : 'Connection failed'),
      });
    } catch (err: any) {
      setDbTestResult({ success: false, message: err.message || 'Connection test failed' });
    } finally {
      setTestingDb(false);
    }
  };

  const handleDeleteBot = async () => {
    if (!confirm('Are you sure you want to delete this chatbot and its vector index points?')) {
      return;
    }
    try {
      const res = await fetch(`/api/bot/${botId}`, { method: 'DELETE' });
      if (res.ok) {
        try {
          const stored = JSON.parse(localStorage.getItem('sitebot_saved_bots') || '[]');
          const updated = stored.filter((b: any) => b.id !== botId);
          localStorage.setItem('sitebot_saved_bots', JSON.stringify(updated));
        } catch {}
        router.push('/');
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handlePlaygroundSend = async () => {
    const text = chatInput.trim();
    if (!text || isChatStreaming) return;

    setChatInput('');
    const newHistory = [...chatMessages, { role: 'user' as const, content: text }];
    setChatMessages(newHistory);
    setIsChatStreaming(true);

    setChatMessages((prev) => [
      ...prev,
      { role: 'assistant', content: '', sources: [] },
    ]);

    try {
      const res = await fetch(`/api/chat/${botId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-SiteBot-Preview': 'true',
        },
        body: JSON.stringify({
          message: text,
          history: newHistory.map((m) => ({ role: m.role, content: m.content })),
        }),
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || `HTTP ${res.status}`);
      }

      const reader = res.body?.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let botResponse = '';
      let sourcesList: any[] = [];

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

          if (eventType === 'sources') {
            try {
              sourcesList = JSON.parse(dataStr);
            } catch {}
          } else if (eventType === 'token') {
            try {
              const { token } = JSON.parse(dataStr);
              botResponse += token;
              setChatMessages((prev) => {
                const next = [...prev];
                const last = next[next.length - 1];
                if (last && last.role === 'assistant') {
                  last.content = botResponse;
                  last.sources = sourcesList;
                }
                return next;
              });
            } catch {}
          } else if (eventType === 'error') {
            try {
              const { error } = JSON.parse(dataStr);
              throw new Error(error);
            } catch (e) {
              throw e;
            }
          }
        }
      }
    } catch (err: any) {
      setChatMessages((prev) => {
        const next = [...prev];
        const last = next[next.length - 1];
        if (last && last.role === 'assistant') {
          last.content = `⚠️ Error: ${err.message || 'Failed to stream response.'}`;
        }
        return next;
      });
    } finally {
      setIsChatStreaming(false);
    }
  };

  const hostOrigin =
    process.env.NEXT_PUBLIC_APP_URL ||
    (typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000');
  const embedBotId = formData.slug || botId;
  const embedCode = `<script src="${hostOrigin}/widget.js" data-bot-id="${embedBotId}" defer></script>`;

  const copyEmbedCode = () => {
    navigator.clipboard.writeText(embedCode);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
    showToast('Widget code copied to clipboard');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center text-slate-500">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-600 mb-3" />
        <p className="text-sm font-medium">Loading Chatbot Studio...</p>
      </div>
    );
  }

  if (!bot) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center text-slate-500">
        <AlertCircle className="w-10 h-10 text-red-500 mb-3" />
        <h2 className="text-lg font-bold text-slate-900 mb-1">Chatbot Not Found</h2>
        <p className="text-xs text-slate-500 mb-4">The chatbot ID is invalid or does not exist.</p>
        <Link href="/" className="px-4 py-2 rounded-xl bg-indigo-600 text-white text-xs font-semibold">
          Back to Home
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 flex flex-col selection:bg-indigo-500 selection:text-white">
      {/* Success / Error Notification Toast */}
      {toastMsg && (
        <div
          key={toastMsg.id}
          className={`fixed top-5 right-5 z-[100] flex items-center gap-2 px-4 py-3 rounded-2xl text-sm font-semibold shadow-2xl border animate-in fade-in slide-in-from-top-2 ${
            toastMsg.type === 'success'
              ? 'bg-emerald-600 text-white border-emerald-500'
              : 'bg-red-600 text-white border-red-500'
          }`}
        >
          {toastMsg.type === 'success' ? (
            <CheckCircle2 className="w-5 h-5 shrink-0" />
          ) : (
            <AlertCircle className="w-5 h-5 shrink-0" />
          )}
          <span>{toastMsg.message}</span>
          <button
            onClick={() => setToastMsg(null)}
            className="ml-2 text-white/70 hover:text-white transition-colors"
            aria-label="Dismiss"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      <Navbar />

      {/* Studio Header (Light Theme) */}
      <div className="border-b border-slate-200 bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-3.5">
              <div
                className="w-12 h-12 rounded-2xl flex items-center justify-center font-bold text-white shadow-md"
                style={{ backgroundColor: bot.primaryColor }}
              >
                <Bot className="w-6 h-6" />
              </div>
              <div>
                <div className="flex items-center gap-2.5">
                  <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900">{bot.name}</h1>
                  <span
                    className="w-2.5 h-2.5 rounded-full ring-2 ring-white"
                    style={{ backgroundColor: bot.primaryColor }}
                    title={`Color: ${bot.primaryColor}`}
                  />
                  <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 uppercase font-mono border border-slate-200">
                    {bot.chatProvider}
                  </span>
                </div>
                <div className="flex items-center gap-3 text-xs text-slate-500 mt-1">
                  <a
                    href={bot.siteUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 hover:text-indigo-600 font-mono transition-colors"
                  >
                    <Globe className="w-3.5 h-3.5 text-indigo-600" />
                    <span>{bot.siteUrl}</span>
                    <ExternalLink className="w-3 h-3 text-slate-400" />
                  </a>
                  <span>&bull;</span>
                  <span>{stats.indexedPages} pages indexed</span>
                  <span>&bull;</span>
                  <span className="text-emerald-600 font-semibold font-mono">{stats.totalChunks} vector chunks</span>
                </div>
              </div>
            </div>

            {/* Quick Actions */}
            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={handleStartCrawl}
                disabled={crawling}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold shadow-sm transition-all disabled:opacity-50"
              >
                {crawling ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <RotateCcw className="w-3.5 h-3.5" />
                )}
                <span>{crawling ? 'Crawling...' : 'Re-Crawl'}</span>
              </button>

              <Link
                href={`/demo/${botId}`}
                target="_blank"
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-semibold border border-slate-200 transition-all"
              >
                <Play className="w-3.5 h-3.5 text-emerald-600" />
                <span>Live Demo</span>
              </Link>

              <button
                onClick={handleDeleteBot}
                title="Delete chatbot"
                className="p-2 rounded-xl bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 transition-colors"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Tab Navigation */}
          <div className="flex items-center gap-1 mt-6 border-b border-slate-200 -mb-5 overflow-x-auto pb-1 scrollbar-thin">
            <button
              onClick={() => setActiveTab('playground')}
              className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold border-b-2 transition-colors whitespace-nowrap ${
                activeTab === 'playground'
                  ? 'border-indigo-600 text-indigo-600'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              <Code2 className="w-4 h-4" />
              <span>Live Test &amp; Embed Code</span>
            </button>

            <button
              onClick={() => setActiveTab('crawler')}
              className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold border-b-2 transition-colors whitespace-nowrap ${
                activeTab === 'crawler'
                  ? 'border-indigo-600 text-indigo-600'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              <Database className="w-4 h-4" />
              <span>Knowledge Base &amp; Crawler ({stats.indexedPages})</span>
            </button>

            <button
              onClick={() => setActiveTab('appearance')}
              className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold border-b-2 transition-colors whitespace-nowrap ${
                activeTab === 'appearance'
                  ? 'border-indigo-600 text-indigo-600'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              <Palette className="w-4 h-4" />
              <span>Widget Customization</span>
            </button>

            <button
              onClick={() => setActiveTab('ai')}
              className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold border-b-2 transition-colors whitespace-nowrap ${
                activeTab === 'ai'
                  ? 'border-indigo-600 text-indigo-600'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              <Sliders className="w-4 h-4" />
              <span>AI Models &amp; BYOK Keys</span>
            </button>

            <button
              onClick={() => setActiveTab('security')}
              className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold border-b-2 transition-colors whitespace-nowrap ${
                activeTab === 'security'
                  ? 'border-indigo-600 text-indigo-600'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              <ShieldCheck className="w-4 h-4" />
              <span>Security &amp; Access</span>
            </button>

            <button
              onClick={() => setActiveTab('qdrant')}
              className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold border-b-2 transition-colors whitespace-nowrap ${
                activeTab === 'qdrant'
                  ? 'border-indigo-600 text-indigo-600'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              <Database className="w-4 h-4 text-indigo-600" />
              <span>Qdrant Vector Database</span>
            </button>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* TAB 1: Live Playground & Embed Code */}
        {activeTab === 'playground' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            {/* Left Col: Embed Snippets */}
            <div className="lg:col-span-6 space-y-6">
              {/* Embed Script Card */}
              <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                    <Code2 className="w-4 h-4 text-indigo-600" />
                    Embed on Any Website
                  </h3>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200">
                    Shadow DOM Isolated
                  </span>
                </div>

                <p className="text-xs text-slate-600 leading-relaxed">
                  Paste this single script tag before the closing{' '}
                  <code className="text-indigo-600 font-mono font-semibold">&lt;/body&gt;</code> tag of your HTML, WordPress, Webflow, Shopify, or React website.
                </p>

                <div className="relative rounded-2xl bg-slate-900 text-slate-100 p-4 font-mono text-xs overflow-x-auto shadow-inner">
                  <code>{embedCode}</code>
                  <button
                    onClick={copyEmbedCode}
                    className="absolute top-3 right-3 p-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white transition-all shadow-md"
                    title="Copy embed snippet"
                  >
                    {copiedCode ? <Check className="w-4 h-4 text-emerald-300" /> : <Copy className="w-4 h-4" />}
                  </button>
                </div>

                <div className="pt-2 flex items-center justify-between text-xs text-slate-500">
                  <span>Zero runtime dependencies</span>
                  <button
                    onClick={copyEmbedCode}
                    className="text-indigo-600 hover:text-indigo-700 font-semibold"
                  >
                    {copiedCode ? 'Copied to Clipboard!' : 'Click to copy script tag'}
                  </button>
                </div>

                {/* Production vs Preview Status Indicator */}
                {Boolean(
                  bot.apiKeysConfigured?.openai ||
                  bot.apiKeysConfigured?.nvidia ||
                  bot.apiKeysConfigured?.gemini ||
                  bot.apiKeysConfigured?.openrouter
                ) ? (
                  <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-2xl text-xs text-emerald-800 flex items-center gap-2.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                    <div>
                      <span className="font-bold">Production Ready:</span>{' '}
                      <span>Widget is configured with an API key and ready for external websites.</span>
                    </div>
                  </div>
                ) : (
                  <div className="p-3 bg-amber-50 border border-amber-200 rounded-2xl text-xs text-amber-900 flex items-start gap-2.5">
                    <AlertCircle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="font-bold">Studio Preview Active</p>
                      <p className="text-amber-700 text-[11px] mt-0.5 leading-relaxed">
                        Internal testing and the Live Demo sandbox use your server .env credentials. To embed this widget live on an external website, add your provider API key in the{' '}
                        <button
                          type="button"
                          onClick={() => setActiveTab('ai')}
                          className="font-bold underline hover:text-amber-950"
                        >
                          AI Models tab
                        </button>.
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {/* Demo Sandbox Card */}
              <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm space-y-4">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-2">
                  <Play className="w-4 h-4 text-emerald-600" />
                  Live Website Sandbox
                </h4>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Test the floating launcher bubble and chat window in a realistic website environment to experience the smooth animations and responsive behavior.
                </p>
                <Link
                  href={`/demo/${botId}`}
                  target="_blank"
                  className="w-full py-2.5 px-4 rounded-xl bg-slate-100 hover:bg-slate-200 text-xs font-bold text-slate-800 text-center transition-all flex items-center justify-center gap-2"
                >
                  <span>Open Live Demo Website</span>
                  <ExternalLink className="w-3.5 h-3.5 text-slate-500" />
                </Link>
              </div>

              {/* Config Details */}
              <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm space-y-3 text-xs">
                <h4 className="font-bold text-slate-900 uppercase text-[11px] tracking-wider">
                  Active Model Configuration
                </h4>
                <div className="grid grid-cols-2 gap-3">
                  <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                    <span className="text-[10px] text-slate-500 uppercase block font-semibold">Provider &amp; Model</span>
                    <span className="font-mono text-slate-900 font-bold">{bot.chatProvider} &bull; {bot.chatModel}</span>
                  </div>
                  <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                    <span className="text-[10px] text-slate-500 uppercase block font-semibold">Vector Search</span>
                    <span className="font-mono text-slate-900 font-bold">Qdrant &bull; 768d</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Right Col: Interactive Chat Test Bench */}
            <div className="lg:col-span-6">
              <div className="bg-white rounded-3xl p-6 border border-slate-200 flex flex-col h-[680px] shadow-sm relative overflow-hidden">
                {/* Top gradient bar */}
                <div className="h-[3.5px] w-full bg-gradient-brand shrink-0 -mt-6 -mx-6 mb-3 rounded-t-3xl" />

                {/* Header */}
                <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                  <div className="flex items-center gap-2.5">
                    <div className="relative">
                      <div
                        className="w-9 h-9 rounded-full bg-gradient-brand flex items-center justify-center text-white font-bold text-xs shadow-glow-sm ring-2 ring-white/30"
                      >
                        <Bot className="w-4.5 h-4.5 text-white" />
                      </div>
                      <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-emerald-500 ring-1 ring-white" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-sm font-bold text-slate-900">{bot.name}</h3>
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-[9px] font-extrabold uppercase tracking-wider">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                          Online
                        </span>
                      </div>
                      <span className="text-[11px] text-slate-500 flex items-center gap-1 mt-0.5">
                        <Sparkles className="w-3 h-3 text-rose-500" />
                        AI Growth Strategist &bull; RAG Active
                      </span>
                    </div>
                  </div>

                  <button
                    onClick={() =>
                      setChatMessages([
                        {
                          role: 'assistant',
                          content: bot.greeting || 'Hi there! How can I help you today?',
                        },
                      ])
                    }
                    className="text-xs text-slate-400 hover:text-slate-700 p-1.5 rounded-lg hover:bg-slate-100 transition-colors"
                    title="Reset test conversation"
                  >
                    <RotateCcw className="w-4 h-4" />
                  </button>
                </div>

                {/* Fast Bar preview */}
                <div className="py-2 px-1 flex items-center gap-1 border-b border-slate-100 text-[11px] font-bold overflow-x-auto">
                  {bot.phone && (
                    <a
                      href={`tel:${(bot.phone).replace(/[^\d+]/g, '')}`}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 transition-colors shrink-0"
                    >
                      <Phone className="w-3 h-3" />
                      <span>Call Now</span>
                    </a>
                  )}
                  {bot.whatsapp && (
                    <a
                      href={`https://wa.me/${(bot.whatsapp).replace(/[^\d]/g, '')}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-800 border border-emerald-300 hover:bg-emerald-100 transition-colors shrink-0"
                    >
                      <MessageCircle className="w-3 h-3 text-emerald-600" />
                      <span>WhatsApp</span>
                    </a>
                  )}
                  {/* Free Audit: only show when auditUrl is set */}
                  {Boolean(bot.auditUrl?.trim()) && (
                    <a
                      href={bot.auditUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-amber-50 text-amber-800 border border-amber-200 hover:bg-amber-100 transition-colors shrink-0"
                    >
                      <Zap className="w-3 h-3 text-amber-600" />
                      <span>Free Audit</span>
                    </a>
                  )}
                  {bot.pricingUrl && (
                    <a
                      href={bot.pricingUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-rose-50 text-rose-800 border border-rose-200 hover:bg-rose-100 transition-colors shrink-0"
                    >
                      <span>Plans</span>
                      <ArrowRight className="w-3 h-3 text-rose-500" />
                    </a>
                  )}
                  {(bot.customLinks || [])
                    .filter((l) => l.label && l.url)
                    .map((link, linkIdx) => (
                      <a
                        key={linkIdx}
                        href={link.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-sky-50 text-sky-800 border border-sky-200 hover:bg-sky-100 transition-colors shrink-0"
                      >
                        <Link2 className="w-3 h-3 text-sky-600" />
                        <span>{link.label}</span>
                      </a>
                    ))}
                </div>

                {/* Messages Container */}
                <div className="flex-1 overflow-y-auto py-4 space-y-4 pr-1">
                  {chatMessages.map((msg, idx) => (
                    <div
                      key={idx}
                      className={`flex items-end gap-2.5 max-w-[88%] ${
                        msg.role === 'user' ? 'ml-auto flex-row-reverse' : 'mr-auto'
                      }`}
                    >
                      {/* Avatar */}
                      <div className="flex flex-col items-center gap-0.5 shrink-0 w-8">
                        {msg.role === 'user' ? (
                          <div className="w-7 h-7 rounded-full bg-slate-100 border border-slate-300 text-slate-700 flex items-center justify-center shadow-sm" title="You">
                            <User className="w-3.5 h-3.5" />
                          </div>
                        ) : (
                          <div className="w-7 h-7 rounded-full bg-gradient-brand text-white flex items-center justify-center shadow-sm ring-1 ring-white/20">
                            <Bot className="w-3.5 h-3.5" />
                          </div>
                        )}
                        <span className="text-[8px] font-bold text-slate-400 leading-none truncate max-w-[34px]">
                          {msg.role === 'user' ? 'You' : (bot.name || 'Bot')}
                        </span>
                      </div>

                      {/* Bubble */}
                      <div className="flex flex-col">
                        <div
                          className={`p-3.5 rounded-2xl text-xs sm:text-sm leading-relaxed ${
                            msg.role === 'user'
                              ? 'bg-gradient-brand text-white rounded-br-none shadow-md'
                              : 'bg-slate-100 text-slate-800 border border-slate-200/70 rounded-bl-none'
                          }`}
                        >
                          {msg.content || (
                            <div className="flex items-center gap-1.5 py-1">
                              <span className="w-1.5 h-1.5 rounded-full bg-slate-400 animate-bounce" />
                              <span className="w-1.5 h-1.5 rounded-full bg-slate-400 animate-bounce [animation-delay:0.2s]" />
                              <span className="w-1.5 h-1.5 rounded-full bg-slate-400 animate-bounce [animation-delay:0.4s]" />
                            </div>
                          )}
                        </div>

                        {/* Source attribution badges */}
                        {msg.sources && msg.sources.length > 0 && (
                          <div className="flex flex-wrap gap-1.5 mt-2">
                            {msg.sources.map((s: any, sIdx: number) => (
                              <a
                                key={sIdx}
                                href={s.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 text-[10px] px-2.5 py-0.5 rounded-md bg-slate-100 hover:bg-indigo-50 text-slate-600 hover:text-indigo-600 border border-slate-200 transition-colors"
                              >
                                <span>🔗 {s.title || 'Source'}</span>
                              </a>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                  <div ref={messagesEndRef} />
                </div>

                {/* Suggested question chips */}
                {bot.suggestedQuestions && bot.suggestedQuestions.length > 0 && (
                  <div className="py-2 flex flex-wrap gap-1.5 border-t border-slate-100">
                    {bot.suggestedQuestions.slice(0, 3).map((q, idx) => (
                      <button
                        key={idx}
                        onClick={() => setChatInput(q)}
                        className="text-[11px] px-2.5 py-1 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium border border-slate-200 transition-colors"
                      >
                        {q}
                      </button>
                    ))}
                  </div>
                )}

                {/* Input area */}
                <div className="pt-3 border-t border-slate-100 flex items-center gap-2">
                  <input
                    type="text"
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        handlePlaygroundSend();
                      }
                    }}
                    placeholder="Type a test query..."
                    className="flex-1 px-4 py-2.5 rounded-xl bg-slate-50 border border-slate-300 text-xs text-slate-900 placeholder-slate-400 focus:bg-white focus:outline-none focus:border-indigo-600"
                  />
                  <button
                    onClick={handlePlaygroundSend}
                    disabled={!chatInput.trim() || isChatStreaming}
                    className="p-2.5 rounded-xl bg-gradient-brand text-white disabled:opacity-40 transition-transform hover:scale-105 active:scale-95 shadow-sm"
                  >
                    <Send className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: Crawler & Knowledge Base */}
        {activeTab === 'crawler' && (
          <div className="space-y-8">
            <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-sm space-y-5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                    <Search className="w-5 h-5 text-indigo-600" />
                    Resource-Safe Website Crawler
                  </h3>
                  <p className="text-xs text-slate-500 mt-1">
                    Extracts clean text up to depth 2 (capped at 15–20 pages) and indexes vector embeddings into Qdrant.
                  </p>
                </div>

                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-2 text-xs text-slate-500">
                    <span>Page Cap:</span>
                    <select
                      value={maxCrawlPages}
                      onChange={(e) => setMaxCrawlPages(Number(e.target.value))}
                      className="px-2.5 py-1.5 rounded-lg bg-slate-50 border border-slate-300 text-slate-900 text-xs font-medium"
                    >
                      <option value={5}>5 Pages (Fast)</option>
                      <option value={10}>10 Pages</option>
                      <option value={15}>15 Pages (Standard)</option>
                      <option value={20}>20 Pages (Maximum)</option>
                    </select>
                  </div>

                  <button
                    onClick={handleStartCrawl}
                    disabled={crawling}
                    className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold flex items-center gap-2 shadow-sm transition-all disabled:opacity-50"
                  >
                    {crawling ? <Loader2 className="w-4 h-4 animate-spin" /> : <RotateCcw className="w-4 h-4" />}
                    <span>{crawling ? 'Crawling Website...' : 'Trigger Re-Crawl'}</span>
                  </button>

                  <button
                    onClick={() => setShowManualModal(true)}
                    className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center gap-2 shadow-sm transition-all"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Add Manual Q&amp;A</span>
                  </button>
                </div>
              </div>

              {crawlMessage && (
                <div className={`p-3.5 rounded-xl border text-xs flex items-start gap-2 ${
                  crawlMessage.startsWith('Error:')
                    ? 'bg-red-50 border-red-200 text-red-900'
                    : crawlMessage.includes('Successfully') || crawlMessage.includes('complete') || crawlProgress >= 100
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                    : 'bg-indigo-50 border-indigo-200 text-indigo-900'
                }`}>
                  {crawling ? (
                    <Loader2 className="w-4 h-4 animate-spin text-indigo-600 shrink-0 mt-0.5" />
                  ) : crawlMessage.startsWith('Error:') ? (
                    <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                  ) : (
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  )}
                  <div className="flex-1 min-w-0 space-y-2">
                    <span className="font-medium">{crawlMessage}</span>
                    {crawling && (
                      <div className="w-full">
                        <div className="flex justify-between items-center text-[10px] font-bold text-indigo-600 mb-1">
                          <span>Indexing pages &amp; generating embeddings</span>
                          <span>{crawlProgress}%</span>
                        </div>
                        <div className="h-2 w-full bg-indigo-100 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-gradient-to-r from-indigo-500 to-indigo-600 rounded-full transition-all duration-300"
                            style={{ width: `${Math.max(2, crawlProgress)}%` }}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Crawled Pages Table */}
            <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <Globe className="w-4 h-4 text-indigo-600" />
                  Indexed Web Pages ({pages.length})
                </h4>
                <span className="text-xs text-slate-500">Total Chunks: {chunks.length}</span>
              </div>

              {pages.length === 0 ? (
                <div className="text-center py-12 text-slate-400 text-xs space-y-2">
                  <Database className="w-8 h-8 mx-auto text-slate-300" />
                  <p>No pages indexed yet. Click &quot;Trigger Re-Crawl&quot; above to crawl your website.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs text-slate-700">
                    <thead className="bg-slate-50 text-slate-600 uppercase text-[10px] tracking-wider border-b border-slate-200">
                      <tr>
                        <th className="py-3 px-4">Title &amp; URL</th>
                        <th className="py-3 px-4">Status</th>
                        <th className="py-3 px-4">Chunks</th>
                        <th className="py-3 px-4">Last Indexed</th>
                        <th className="py-3 px-4 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {pages.map((p) => (
                        <tr key={p.id} className="hover:bg-slate-50/80 transition-colors">
                          <td className="py-3.5 px-4 max-w-sm">
                            <div className="font-semibold text-slate-900 truncate">{p.title || 'Untitled'}</div>
                            <div className="text-[11px] text-slate-500 truncate font-mono">{p.url}</div>
                          </td>
                          <td className="py-3.5 px-4">
                            <span
                              className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                                p.status === 'indexed'
                                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                  : p.status === 'indexing'
                                  ? 'bg-indigo-50 text-indigo-700 border border-indigo-200'
                                  : 'bg-red-50 text-red-700 border border-red-200'
                              }`}
                            >
                              {p.status}
                            </span>
                          </td>
                          <td className="py-3.5 px-4 font-mono font-semibold text-indigo-700">{p.chunkCount}</td>
                          <td className="py-3.5 px-4 text-slate-500">
                            {new Date(p.updatedAt).toLocaleDateString()}
                          </td>
                          <td className="py-3.5 px-4 text-right">
                            <button
                              onClick={() => handleDeleteKnowledge('page', p.id)}
                              className="text-slate-400 hover:text-red-600 p-1.5 rounded hover:bg-red-50 transition-colors"
                              title="Delete page"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Chunks Inspector */}
            <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm space-y-4">
              <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <FileText className="w-4 h-4 text-indigo-600" />
                Vector Chunks Preview ({chunks.length})
              </h4>
              <p className="text-xs text-slate-500">
                Segmented at ~700 characters with 100 character overlap, indexed in Qdrant Vector Database.
              </p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-h-96 overflow-y-auto pr-1">
                {chunks.map((c) => (
                  <div
                    key={c.id}
                    className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-2 text-xs relative group hover:border-indigo-300 transition-all"
                  >
                    <div className="flex items-center justify-between text-[11px] text-slate-600">
                      <span className="font-bold text-slate-900 truncate max-w-[200px]">
                        {c.metadata?.title || 'Document Chunk'}
                      </span>
                      <button
                        onClick={() => handleDeleteKnowledge('chunk', c.id)}
                        className="text-slate-400 hover:text-red-600 opacity-0 group-hover:opacity-100 transition-opacity"
                        title="Delete chunk"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    <p className="text-slate-700 leading-relaxed line-clamp-4 font-mono text-[11px]">
                      {c.content}
                    </p>
                    <div className="pt-2 border-t border-slate-200 flex items-center justify-between text-[10px] text-slate-500 font-mono">
                      <span>{c.content.length} chars</span>
                      <span className="text-indigo-600 font-bold">768-dim Qdrant vector</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: Widget Customization */}
        {activeTab === 'appearance' && (
          <form onSubmit={handleSaveSettings} className="max-w-3xl space-y-6">
            <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-sm space-y-6">
              <div className="flex items-center justify-between pb-4 border-b border-slate-100">
                <div>
                  <h3 className="text-lg font-bold text-slate-900">Widget Customization</h3>
                  <p className="text-xs text-slate-500">
                    Adjust how your chat widget looks and behaves on your website.
                  </p>
                </div>
                {saveSuccess && (
                  <div className="flex items-center gap-1.5 text-xs text-emerald-600 font-bold animate-in fade-in">
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Saved!</span>
                  </div>
                )}
              </div>

              {/* Bot Name & Site */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                    Bot Display Name
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-4 py-2.5 rounded-xl bg-slate-50 border border-slate-300 text-xs text-slate-900 focus:bg-white focus:outline-none focus:border-indigo-600"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                    Target Site URL
                  </label>
                  <input
                    type="text"
                    value={formData.siteUrl}
                    onChange={(e) => setFormData({ ...formData, siteUrl: e.target.value })}
                    className="w-full px-4 py-2.5 rounded-xl bg-slate-50 border border-slate-300 text-xs text-slate-900 focus:bg-white focus:outline-none focus:border-indigo-600 font-mono"
                  />
                </div>
              </div>

              {/* Color & Position */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                    Primary Accent Color
                  </label>
                  <div className="flex items-center gap-3">
                    <input
                      type="color"
                      value={formData.primaryColor}
                      onChange={(e) => setFormData({ ...formData, primaryColor: e.target.value })}
                      className="w-9 h-9 rounded-xl cursor-pointer bg-transparent border-none"
                    />
                    <input
                      type="text"
                      value={formData.primaryColor}
                      onChange={(e) => setFormData({ ...formData, primaryColor: e.target.value })}
                      className="w-28 px-3 py-1.5 rounded-lg bg-slate-50 border border-slate-300 text-xs font-mono text-slate-900"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                    Launcher Position
                  </label>
                  <select
                    value={formData.position}
                    onChange={(e) =>
                      setFormData({ ...formData, position: e.target.value as any })
                    }
                    className="w-full px-3 py-2.5 rounded-xl bg-slate-50 border border-slate-300 text-xs text-slate-900 focus:bg-white focus:outline-none focus:border-indigo-600"
                  >
                    <option value="bottom-right">Bottom Right (Standard)</option>
                    <option value="bottom-left">Bottom Left</option>
                  </select>
                </div>
              </div>

              {/* Greeting */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                  Welcome Greeting
                </label>
                <input
                  type="text"
                  value={formData.greeting}
                  onChange={(e) => setFormData({ ...formData, greeting: e.target.value })}
                  placeholder="e.g. Hi there! How can I help you today?"
                  className="w-full px-4 py-2.5 rounded-xl bg-slate-50 border border-slate-300 text-xs text-slate-900 focus:bg-white focus:outline-none focus:border-indigo-600"
                />
              </div>

              {/* Floating Button Style Picker */}
              <div className="pt-2 border-t border-slate-100">
                <div className="mb-3">
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
                    Floating Button Style
                  </label>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Choose how the launcher button looks on your embedded website. All styles include bundled CSS — no separate stylesheet needed.
                  </p>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {(
                    [
                      {
                        id: 'standard',
                        label: 'Standard',
                        desc: 'Round with halo glow & sparkle',
                        preview: (
                          <div className="relative flex items-center justify-center">
                            <div className="absolute inset-0 rounded-full opacity-50" style={{ background: `conic-gradient(${formData.primaryColor}, #F43F5E, #F59E0B, ${formData.primaryColor})`, filter: 'blur(4px)' }} />
                            <div className="relative w-10 h-10 rounded-full flex items-center justify-center" style={{ background: `linear-gradient(135deg, ${formData.primaryColor}, #E11D48 50%, #F59E0B)` }}>
                              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M12 8V4m0 0H8m4 0h4m-7 4h6a4 4 0 0 1 4 4v5a4 4 0 0 1-4 4H9a4 4 0 0 1-4-4v-5a4 4 0 0 1 4-4Z"/><circle cx="9" cy="13" r="1" fill="currentColor"/><circle cx="15" cy="13" r="1" fill="currentColor"/></svg>
                              <span className="absolute top-1 right-1 text-[7px]">✦</span>
                            </div>
                          </div>
                        ),
                      },
                      {
                        id: 'minimal',
                        label: 'Minimal',
                        desc: 'Clean round button, no effects',
                        preview: (
                          <div className="w-10 h-10 rounded-full flex items-center justify-center mx-auto" style={{ background: `linear-gradient(135deg, ${formData.primaryColor}, #E11D48)`, boxShadow: `0 4px 12px ${formData.primaryColor}55` }}>
                            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M12 8V4m0 0H8m4 0h4m-7 4h6a4 4 0 0 1 4 4v5a4 4 0 0 1-4 4H9a4 4 0 0 1-4-4v-5a4 4 0 0 1 4-4Z"/><circle cx="9" cy="13" r="1" fill="currentColor"/><circle cx="15" cy="13" r="1" fill="currentColor"/></svg>
                          </div>
                        ),
                      },
                      {
                        id: 'pill',
                        label: 'Pill',
                        desc: 'Elongated with bot name text',
                        preview: (
                          <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full mx-auto" style={{ background: `linear-gradient(135deg, ${formData.primaryColor}, #E11D48)` }}>
                            <svg className="w-3.5 h-3.5 text-white flex-shrink-0" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M12 8V4m0 0H8m4 0h4m-7 4h6a4 4 0 0 1 4 4v5a4 4 0 0 1-4 4H9a4 4 0 0 1-4-4v-5a4 4 0 0 1 4-4Z"/></svg>
                            <span className="text-white text-[10px] font-bold whitespace-nowrap">Chat with us</span>
                          </div>
                        ),
                      },
                      {
                        id: 'chat',
                        label: 'Chat',
                        desc: 'White button with brand border',
                        preview: (
                          <div className="w-10 h-10 rounded-full flex items-center justify-center mx-auto bg-white" style={{ border: `2.5px solid ${formData.primaryColor}`, boxShadow: `0 4px 14px ${formData.primaryColor}33, 0 0 0 5px ${formData.primaryColor}11` }}>
                            <svg className="w-5 h-5" fill="none" stroke={formData.primaryColor} strokeWidth="2" viewBox="0 0 24 24"><path d="M12 8V4m0 0H8m4 0h4m-7 4h6a4 4 0 0 1 4 4v5a4 4 0 0 1-4 4H9a4 4 0 0 1-4-4v-5a4 4 0 0 1 4-4Z"/><circle cx="9" cy="13" r="1" fill={formData.primaryColor}/><circle cx="15" cy="13" r="1" fill={formData.primaryColor}/></svg>
                          </div>
                        ),
                      },
                    ] as const
                  ).map((s) => (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => setFormData({ ...formData, launcherStyle: s.id })}
                      className={`relative p-3 rounded-2xl border-2 transition-all text-left flex flex-col items-center gap-2.5 ${
                        formData.launcherStyle === s.id
                          ? 'border-indigo-500 bg-indigo-50 shadow-sm'
                          : 'border-slate-200 bg-slate-50 hover:border-slate-300 hover:bg-white'
                      }`}
                    >
                      {formData.launcherStyle === s.id && (
                        <span className="absolute top-2 right-2 w-4 h-4 rounded-full bg-indigo-500 flex items-center justify-center">
                          <svg className="w-2.5 h-2.5 text-white" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd"/></svg>
                        </span>
                      )}
                      <div className="h-12 flex items-center justify-center w-full">{s.preview}</div>
                      <div className="text-center">
                        <p className={`text-[11px] font-bold ${formData.launcherStyle === s.id ? 'text-indigo-700' : 'text-slate-800'}`}>{s.label}</p>
                        <p className="text-[10px] text-slate-400 mt-0.5 leading-tight">{s.desc}</p>
                      </div>
                    </button>
                  ))}
                </div>
                <p className="text-[10px] text-slate-400 mt-2 flex items-center gap-1">
                  <svg className="w-3 h-3 flex-shrink-0" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/></svg>
                  All CSS is bundled inside widget.js — your embed tag needs only the single &lt;script&gt; tag, no separate stylesheet.
                </p>
              </div>



              {/* Fast Connect Hub Settings */}
              <div className="pt-2 border-t border-slate-100">
                <div className="mb-4">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-800 flex items-center gap-2">
                    <Sparkles className="w-3.5 h-3.5 text-rose-500" />
                    Contact &amp; Action Links
                  </h4>
                  <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">
                    These values appear in the chatbot&apos;s quick-action bar and are also injected into the AI prompt so the bot
                    always replies with real contact details instead of placeholders. Leave a field empty to hide that button.
                  </p>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 mb-0.5">
                      📞 Phone Number — controls &ldquo;Call Now&rdquo; button
                    </label>
                    <input
                      type="text"
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                      placeholder="+91 96962 62007"
                      className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-300 text-xs text-slate-900 focus:bg-white focus:outline-none focus:border-indigo-600"
                    />
                    <p className="text-[10px] text-slate-400 mt-0.5">The AI will also share this when users ask how to call you.</p>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 mb-0.5">
                      💬 WhatsApp — controls &ldquo;WhatsApp&rdquo; button (digits only)
                    </label>
                    <input
                      type="text"
                      value={formData.whatsapp}
                      onChange={(e) => setFormData({ ...formData, whatsapp: e.target.value })}
                      placeholder="919696262007"
                      className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-300 text-xs text-slate-900 focus:bg-white focus:outline-none focus:border-indigo-600 font-mono"
                    />
                    <p className="text-[10px] text-slate-400 mt-0.5">Country code + number, e.g. 919696262007 for India.</p>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 mb-0.5">
                      ✉️ Support Email — used by AI when asked for email
                    </label>
                    <input
                      type="email"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      placeholder="hello@yourcompany.com"
                      className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-300 text-xs text-slate-900 focus:bg-white focus:outline-none focus:border-indigo-600"
                    />
                    <p className="text-[10px] text-slate-400 mt-0.5">The AI will share this exact email address when a user asks.</p>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 mb-0.5">
                      💸 Pricing / Plans URL — controls &ldquo;Plans&rdquo; button <span className="text-slate-400 font-normal">(optional)</span>
                    </label>
                    <input
                      type="text"
                      value={formData.pricingUrl}
                      onChange={(e) => setFormData({ ...formData, pricingUrl: e.target.value })}
                      placeholder="/pricing  or  https://yoursite.com/pricing"
                      className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-300 text-xs text-slate-900 focus:bg-white focus:outline-none focus:border-indigo-600 font-mono"
                    />
                    <p className="text-[10px] text-slate-400 mt-0.5">Leave empty to hide the &ldquo;Plans →&rdquo; button in the chat.</p>
                  </div>

                  <div className="sm:col-span-2">
                    <label className="block text-[11px] font-bold text-slate-600 mb-0.5">
                      ⚡ Free Audit URL — controls &ldquo;Free Audit&rdquo; button <span className="text-slate-400 font-normal">(optional)</span>
                    </label>
                    <input
                      type="text"
                      value={formData.auditUrl}
                      onChange={(e) => setFormData({ ...formData, auditUrl: e.target.value })}
                      placeholder="https://yoursite.com/audit  or  leave empty to hide button"
                      className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-300 text-xs text-slate-900 focus:bg-white focus:outline-none focus:border-indigo-600 font-mono"
                    />
                    <p className="text-[10px] text-slate-400 mt-0.5">
                      Leave empty to hide the &ldquo;Free Audit&rdquo; button in the chat.
                    </p>
                  </div>

                  <div className="sm:col-span-2">
                    <label className="block text-[11px] font-bold text-slate-600 mb-0.5">
                      🔗 Custom Links <span className="text-slate-400 font-normal">(optional)</span>
                    </label>
                    <div className="space-y-2">
                      {formData.customLinks.map((link, linkIdx) => (
                        <div key={linkIdx} className="flex items-center gap-2">
                          <input
                            type="text"
                            value={link.label}
                            onChange={(e) => {
                              const updated = [...formData.customLinks];
                              updated[linkIdx] = { ...updated[linkIdx], label: e.target.value };
                              setFormData({ ...formData, customLinks: updated });
                            }}
                            placeholder="Button label, e.g. Book a Demo"
                            className="w-1/3 px-3 py-2 rounded-xl bg-slate-50 border border-slate-300 text-xs text-slate-900 focus:bg-white focus:outline-none focus:border-indigo-600"
                          />
                          <input
                            type="text"
                            value={link.url}
                            onChange={(e) => {
                              const updated = [...formData.customLinks];
                              updated[linkIdx] = { ...updated[linkIdx], url: e.target.value };
                              setFormData({ ...formData, customLinks: updated });
                            }}
                            placeholder="https://yoursite.com/demo"
                            className="flex-1 px-3 py-2 rounded-xl bg-slate-50 border border-slate-300 text-xs text-slate-900 focus:bg-white focus:outline-none focus:border-indigo-600 font-mono"
                          />
                          <button
                            type="button"
                            onClick={() =>
                              setFormData({
                                ...formData,
                                customLinks: formData.customLinks.filter((_, i) => i !== linkIdx),
                              })
                            }
                            className="p-2 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors shrink-0"
                            title="Remove link"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      ))}
                      <button
                        type="button"
                        onClick={() =>
                          setFormData({ ...formData, customLinks: [...formData.customLinks, { label: '', url: '' }] })
                        }
                        className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 border border-slate-300 text-xs font-bold text-slate-700 transition-colors"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        Add Custom Link
                      </button>
                    </div>
                    <p className="text-[10px] text-slate-400 mt-2">
                      Rows with both a label and URL appear as quick-action buttons in the chat. Leave a row blank to preview it.
                    </p>
                  </div>
                </div>
              </div>

              {/* System Prompt */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                  AI System Prompt (RAG Instructions)
                </label>
                <textarea
                  rows={4}
                  value={formData.systemPrompt}
                  onChange={(e) => setFormData({ ...formData, systemPrompt: e.target.value })}
                  className="w-full px-4 py-3 rounded-xl bg-slate-50 border border-slate-300 text-xs text-slate-900 leading-relaxed focus:bg-white focus:outline-none focus:border-indigo-600 font-mono"
                />
              </div>

              <div className="pt-4 border-t border-slate-100 flex justify-end">
                <button
                  type="submit"
                  className="px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-md transition-all"
                >
                  Save Appearance
                </button>
              </div>
            </div>
          </form>
        )}

        {/* TAB 4: AI Models & BYOK Keys */}
        {activeTab === 'ai' && (
          <form onSubmit={handleSaveSettings} className="max-w-3xl space-y-6">
            <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-sm space-y-6">
              <div className="flex items-center justify-between pb-4 border-b border-slate-100">
                <div>
                  <h3 className="text-lg font-bold text-slate-900">AI Providers &amp; BYOK Settings</h3>
                  <p className="text-xs text-slate-500">
                    Switch between NVIDIA NIM, OpenAI, Google Gemini, or OpenRouter.
                  </p>
                </div>
                {saveSuccess && (
                  <div className="flex items-center gap-1.5 text-xs text-emerald-600 font-bold animate-in fade-in">
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Saved!</span>
                  </div>
                )}
              </div>

              {/* Chat Provider & Model */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                    Chat Completion Provider
                  </label>
                  <select
                    value={formData.chatProvider}
                    onChange={(e) => {
                      const newProvider = e.target.value;
                      let defaultModel = formData.chatModel;
                      if (newProvider === 'openai') defaultModel = 'gpt-4o-mini';
                      else if (newProvider === 'nvidia') defaultModel = 'meta/llama-3.1-8b-instruct';
                      else if (newProvider === 'gemini') defaultModel = 'gemini-1.5-flash';
                      else if (newProvider === 'openrouter') defaultModel = 'meta-llama/llama-3-8b-instruct:free';
                      setFormData({ ...formData, chatProvider: newProvider, chatModel: defaultModel });
                    }}
                    className="w-full px-3 py-2.5 rounded-xl bg-slate-50 border border-slate-300 text-xs text-slate-900 focus:bg-white focus:outline-none focus:border-indigo-600 font-semibold"
                  >
                    <option value="openai">OpenAI (GPT-4o, GPT-4o-mini)</option>
                    <option value="nvidia">NVIDIA NIM (Llama 3.1 8B/70B)</option>
                    <option value="gemini">Google Gemini (Gemini 1.5 Flash)</option>
                    <option value="openrouter">OpenRouter (Multi-Model Hub)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                    Chat Model (Custom or Preset)
                  </label>
                  <input
                    type="text"
                    value={formData.chatModel}
                    onChange={(e) => setFormData({ ...formData, chatModel: e.target.value })}
                    placeholder="Enter any model ID (e.g. gpt-4o, deepseek/deepseek-chat)"
                    className="w-full px-4 py-2.5 rounded-xl bg-slate-50 border border-slate-300 text-xs text-slate-900 font-mono focus:bg-white focus:outline-none focus:border-indigo-600"
                  />
                  <div className="flex flex-wrap gap-1.5 mt-1.5">
                    {formData.chatProvider === 'openai' && (
                      <>
                        {['gpt-4o-mini', 'gpt-4o', 'gpt-4-turbo'].map((m) => (
                          <button
                            key={m}
                            type="button"
                            onClick={() => setFormData({ ...formData, chatModel: m })}
                            className={`text-[10px] px-2 py-0.5 rounded-md font-mono transition-all ${
                              formData.chatModel === m
                                ? 'bg-indigo-600 text-white font-bold'
                                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                            }`}
                          >
                            {m}
                          </button>
                        ))}
                      </>
                    )}
                    {formData.chatProvider === 'nvidia' && (
                      <>
                        {[
                          'meta/muse-glimmer-30b',
                          'meta/llama-3.1-8b-instruct',
                          'nvidia/llama-3.1-nemotron-70b-instruct',
                        ].map((m) => (
                          <button
                            key={m}
                            type="button"
                            onClick={() => setFormData({ ...formData, chatModel: m })}
                            className={`text-[10px] px-2 py-0.5 rounded-md font-mono transition-all ${
                              formData.chatModel === m
                                ? 'bg-emerald-700 text-white font-bold'
                                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                            }`}
                          >
                            {m.split('/')[1] || m}
                          </button>
                        ))}
                      </>
                    )}
                    {formData.chatProvider === 'gemini' && (
                      <>
                        {['gemini-1.5-flash', 'gemini-1.5-pro', 'gemini-2.0-flash-exp'].map((m) => (
                          <button
                            key={m}
                            type="button"
                            onClick={() => setFormData({ ...formData, chatModel: m })}
                            className={`text-[10px] px-2 py-0.5 rounded-md font-mono transition-all ${
                              formData.chatModel === m
                                ? 'bg-indigo-600 text-white font-bold'
                                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                            }`}
                          >
                            {m}
                          </button>
                        ))}
                      </>
                    )}
                    {formData.chatProvider === 'openrouter' && (
                      <>
                        {['meta-llama/llama-3-8b-instruct:free', 'google/gemini-2.0-flash-exp:free', 'deepseek/deepseek-chat'].map((m) => (
                          <button
                            key={m}
                            type="button"
                            onClick={() => setFormData({ ...formData, chatModel: m })}
                            className={`text-[10px] px-2 py-0.5 rounded-md font-mono transition-all ${
                              formData.chatModel === m
                                ? 'bg-purple-600 text-white font-bold'
                                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                            }`}
                          >
                            {m.split('/')[1] || m}
                          </button>
                        ))}
                      </>
                    )}
                  </div>
                </div>
              </div>

              {/* Embeddings Provider & Model */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                    Embeddings Provider
                  </label>
                  <select
                    value={formData.embedProvider}
                    onChange={(e) => {
                      const newProvider = e.target.value;
                      let defaultEmbed = 'nvidia/llama-3.2-nv-embedqa-1b-v1';
                      if (newProvider === 'openai') defaultEmbed = 'text-embedding-3-small';
                      else if (newProvider === 'gemini') defaultEmbed = 'text-embedding-004';
                      setFormData({ ...formData, embedProvider: newProvider, embedModel: defaultEmbed });
                    }}
                    className="w-full px-3 py-2.5 rounded-xl bg-slate-50 border border-slate-300 text-xs text-slate-900 focus:bg-white focus:outline-none focus:border-indigo-600 font-semibold"
                  >
                    <option value="nvidia">NVIDIA NIM</option>
                    <option value="openai">OpenAI (768 dims)</option>
                    <option value="gemini">Google Gemini (768 dims)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                    Embedding Model (Custom or Preset)
                  </label>
                  <input
                    type="text"
                    value={formData.embedModel}
                    onChange={(e) => setFormData({ ...formData, embedModel: e.target.value })}
                    placeholder="e.g. nvidia/llama-3.2-nv-embedqa-1b-v1"
                    className="w-full px-4 py-2.5 rounded-xl bg-slate-50 border border-slate-300 text-xs text-slate-900 font-mono focus:bg-white focus:outline-none focus:border-indigo-600"
                  />
                  <div className="flex flex-wrap gap-1.5 mt-1.5">
                    {formData.embedProvider === 'nvidia' && (
                      <>
                        {[
                          'nvidia/llama-3.2-nv-embedqa-1b-v1',
                          'nvidia/nv-embedqa-mistral-7b-v2',
                          'snowflake/arctic-embed-l',
                        ].map((m) => (
                          <button
                            key={m}
                            type="button"
                            onClick={() => setFormData({ ...formData, embedModel: m })}
                            className={`text-[10px] px-2 py-0.5 rounded-md font-mono transition-all ${
                              formData.embedModel === m
                                ? 'bg-emerald-700 text-white font-bold'
                                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                            }`}
                          >
                            {m.split('/')[1] || m}
                          </button>
                        ))}
                      </>
                    )}
                    {formData.embedProvider === 'openai' && (
                      <>
                        {['text-embedding-3-small', 'text-embedding-3-large', 'text-embedding-ada-002'].map((m) => (
                          <button
                            key={m}
                            type="button"
                            onClick={() => setFormData({ ...formData, embedModel: m })}
                            className={`text-[10px] px-2 py-0.5 rounded-md font-mono transition-all ${
                              formData.embedModel === m
                                ? 'bg-indigo-600 text-white font-bold'
                                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                            }`}
                          >
                            {m}
                          </button>
                        ))}
                      </>
                    )}
                    {formData.embedProvider === 'gemini' && (
                      <>
                        {['text-embedding-004'].map((m) => (
                          <button
                            key={m}
                            type="button"
                            onClick={() => setFormData({ ...formData, embedModel: m })}
                            className={`text-[10px] px-2 py-0.5 rounded-md font-mono transition-all ${
                              formData.embedModel === m
                                ? 'bg-indigo-600 text-white font-bold'
                                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                            }`}
                          >
                            {m}
                          </button>
                        ))}
                      </>
                    )}
                  </div>
                </div>
              </div>

              {/* Vector Database Info */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                  Vector Database
                </label>
                <input
                  type="text"
                  readOnly
                  value="Qdrant Vector Database (768-dim, Cosine Distance)"
                  className="w-full px-4 py-2.5 rounded-xl bg-slate-100 border border-slate-200 text-xs text-slate-600 font-mono font-semibold"
                />
              </div>

              {/* API Keys BYOK */}
              <div className="space-y-4 pt-4 border-t border-slate-100">
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                    Manage Provider Keys
                  </h4>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Keys configured here unlock live production widget embedding on any external website. Internal Studio previews and testing use your server .env credentials.
                  </p>
                </div>

                {/* OpenAI Key */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs text-slate-700 font-semibold">OpenAI API Key</span>
                    {bot.maskedKeys?.openai && (
                      <span className="text-[11px] font-mono text-emerald-600 font-bold">
                        Configured: {bot.maskedKeys.openai}
                      </span>
                    )}
                  </div>
                  <input
                    type="password"
                    placeholder="Enter OpenAI key (sk-proj-...)"
                    value={formData.openaiKey}
                    onChange={(e) => setFormData({ ...formData, openaiKey: e.target.value })}
                    className="w-full px-4 py-2.5 rounded-xl bg-slate-50 border border-slate-300 text-xs text-slate-900 font-mono focus:bg-white focus:outline-none focus:border-indigo-600"
                  />
                </div>

                {/* NVIDIA Key */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs text-slate-700 font-semibold">NVIDIA NIM API Key</span>
                    {bot.maskedKeys?.nvidia && (
                      <span className="text-[11px] font-mono text-emerald-600 font-bold">
                        Configured: {bot.maskedKeys.nvidia}
                      </span>
                    )}
                  </div>
                  <input
                    type="password"
                    placeholder="Enter NVIDIA NIM key (nvapi-...)"
                    value={formData.nvidiaKey}
                    onChange={(e) => setFormData({ ...formData, nvidiaKey: e.target.value })}
                    className="w-full px-4 py-2.5 rounded-xl bg-slate-50 border border-slate-300 text-xs text-slate-900 font-mono focus:bg-white focus:outline-none focus:border-indigo-600"
                  />
                </div>

                {/* Gemini Key */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs text-slate-700 font-semibold">Google Gemini API Key</span>
                    {bot.maskedKeys?.gemini && (
                      <span className="text-[11px] font-mono text-emerald-600 font-bold">
                        Configured: {bot.maskedKeys.gemini}
                      </span>
                    )}
                  </div>
                  <input
                    type="password"
                    placeholder="Enter Google Gemini key..."
                    value={formData.geminiKey}
                    onChange={(e) => setFormData({ ...formData, geminiKey: e.target.value })}
                    className="w-full px-4 py-2.5 rounded-xl bg-slate-50 border border-slate-300 text-xs text-slate-900 font-mono focus:bg-white focus:outline-none focus:border-indigo-600"
                  />
                </div>

                {/* OpenRouter Key */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs text-slate-700 font-semibold">OpenRouter API Key</span>
                    {bot.maskedKeys?.openrouter && (
                      <span className="text-[11px] font-mono text-emerald-600 font-bold">
                        Configured: {bot.maskedKeys.openrouter}
                      </span>
                    )}
                  </div>
                  <input
                    type="password"
                    placeholder="Enter OpenRouter key..."
                    value={formData.openrouterKey}
                    onChange={(e) => setFormData({ ...formData, openrouterKey: e.target.value })}
                    className="w-full px-4 py-2.5 rounded-xl bg-slate-50 border border-slate-300 text-xs text-slate-900 font-mono focus:bg-white focus:outline-none focus:border-indigo-600"
                  />
                </div>
              </div>

              <div className="pt-4 border-t border-slate-100 flex justify-end">
                <button
                  type="submit"
                  className="px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-md transition-all"
                >
                  Save Model &amp; Key Settings
                </button>
              </div>
            </div>
          </form>
        )}

        {/* TAB: Security & Access */}
        {activeTab === 'security' && (
          <form onSubmit={handleSaveSettings} className="max-w-3xl space-y-6">
            <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
              <div className="flex items-center gap-2 mb-1">
                <ShieldCheck className="w-5 h-5 text-indigo-600" />
                <h2 className="text-lg font-bold text-slate-900">Security & Access</h2>
              </div>
              <p className="text-sm text-slate-500 mb-6">
                Control who can load your widget, give it a friendly embed ID, and protect it from
                abuse with rate limits.
              </p>

              {/* Custom Bot ID */}
              <div className="border border-slate-200 rounded-xl p-5 mb-5">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-sm text-slate-700 font-bold">Custom Bot ID (for embed)</span>
                  <span className="text-[11px] px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-600 font-bold">
                    Recommended
                  </span>
                </div>
                <p className="text-xs text-slate-500 mb-3">
                  Use a short friendly ID like <span className="font-mono font-bold">my-ai-bot</span>{' '}
                  instead of the long internal ID in your embed code. Current embed uses:{' '}
                  <span className="font-mono font-bold text-indigo-600">
                    {formData.slug || botId}
                  </span>
                </p>
                <input
                  type="text"
                  placeholder="e.g. my-ai-bot"
                  value={formData.slug}
                  onChange={(e) => setFormData({ ...formData, slug: e.target.value })}
                  className="w-full px-4 py-2.5 rounded-xl bg-slate-50 border border-slate-300 text-xs text-slate-900 font-mono focus:bg-white focus:outline-none focus:border-indigo-600"
                />
                <p className="text-[11px] text-slate-400 mt-1.5">
                  Lowercase letters, numbers and dashes only (3–40 chars). Leave empty to use the
                  default internal ID.
                </p>
              </div>

              {/* Allowed Origins (CORS) */}
              <div className="border border-slate-200 rounded-xl p-5 mb-5">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-sm text-slate-700 font-bold">Allowed Origins (CORS)</span>
                  <span className="text-[11px] px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-600 font-bold">
                    Saved website always allowed
                  </span>
                </div>
                <p className="text-xs text-slate-500 mb-3">
                  Requests are rejected unless they come from the saved website
                  ({formData.siteUrl || 'not set yet — set it in Widget Customization'}) or a domain
                  listed below. Non-browser API calls (no Origin header) are always allowed.
                </p>
                <textarea
                  value={formData.allowedOrigins}
                  onChange={(e) => setFormData({ ...formData, allowedOrigins: e.target.value })}
                  placeholder={'e.g.\nhttps://mywebsite.com\nhttps://app.mywebsite.com'}
                  rows={3}
                  className="w-full px-4 py-2.5 rounded-xl bg-slate-50 border border-slate-300 text-xs text-slate-900 font-mono focus:bg-white focus:outline-none focus:border-indigo-600"
                />
                <p className="text-[11px] text-slate-400 mt-1.5">
                  One origin per line, or comma separated. Enter a single <span className="font-mono">*</span> to
                  allow every website.
                </p>
              </div>

              {/* Rate Limiting */}
              <div className="border border-slate-200 rounded-xl p-5">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-sm text-slate-700 font-bold">Rate Limiting</span>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.rateLimitEnabled}
                      onChange={(e) =>
                        setFormData({ ...formData, rateLimitEnabled: e.target.checked })
                      }
                      className="sr-only peer"
                    />
                    <div className="w-10 h-5.5 rounded-full bg-slate-300 peer-checked:bg-indigo-600 transition-colors relative after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:bg-white after:rounded-full after:h-4.5 after:w-4.5 after:transition-all peer-checked:after:translate-x-4.5" />
                  </label>
                </div>
                <p className="text-xs text-slate-500 mb-3">
                  Limit how many messages a single visitor/IP can send to your bot to prevent abuse.
                </p>
                <div className={`grid grid-cols-2 gap-3 transition-opacity ${formData.rateLimitEnabled ? '' : 'opacity-40 pointer-events-none'}`}>
                  <div>
                    <span className="text-xs text-slate-700 font-semibold">Max requests</span>
                    <input
                      type="number"
                      min={1}
                      value={formData.rateLimitMax}
                      onChange={(e) => setFormData({ ...formData, rateLimitMax: Number(e.target.value) })}
                      className="w-full mt-1 px-4 py-2.5 rounded-xl bg-slate-50 border border-slate-300 text-xs text-slate-900 font-mono focus:bg-white focus:outline-none focus:border-indigo-600"
                    />
                  </div>
                  <div>
                    <span className="text-xs text-slate-700 font-semibold">Per window (seconds)</span>
                    <input
                      type="number"
                      min={10}
                      value={formData.rateLimitWindow}
                      onChange={(e) => setFormData({ ...formData, rateLimitWindow: Number(e.target.value) })}
                      className="w-full mt-1 px-4 py-2.5 rounded-xl bg-slate-50 border border-slate-300 text-xs text-slate-900 font-mono focus:bg-white focus:outline-none focus:border-indigo-600"
                    />
                  </div>
                </div>
              </div>

              <div className="pt-4 pb-2 flex justify-end">
                <button
                  type="submit"
                  className="px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-md transition-all"
                >
                  Save Security Settings
                </button>
              </div>
            </div>
          </form>
        )}

        {/* TAB 5: Qdrant Vector Database */}
        {activeTab === 'qdrant' && (
          <div className="max-w-4xl space-y-6">
            {/* Custom Database Config Card */}
            <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-sm space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-slate-200">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-indigo-50 border border-indigo-200 flex items-center justify-center text-indigo-600">
                    <Database className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-slate-900">Vector Database Connection</h3>
                    <p className="text-xs text-slate-500">
                      Configure how vector embeddings and semantic search chunks are stored for this chatbot.
                    </p>
                  </div>
                </div>

                <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold ${
                  formData.customDbEnabled
                    ? 'bg-purple-50 text-purple-700 border border-purple-200'
                    : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                }`}>
                  <span className={`w-2 h-2 rounded-full ${formData.customDbEnabled ? 'bg-purple-500' : 'bg-emerald-500'} animate-pulse`} />
                  {formData.customDbEnabled ? 'Custom Database Active' : 'Default Platform Qdrant'}
                </span>
              </div>

              {/* Database Mode Switcher */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div
                  onClick={() => setFormData({ ...formData, customDbEnabled: false })}
                  className={`p-4 rounded-2xl border-2 cursor-pointer transition-all ${
                    !formData.customDbEnabled
                      ? 'border-indigo-600 bg-indigo-50/40 shadow-sm'
                      : 'border-slate-200 hover:border-slate-300 bg-slate-50/50'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold text-slate-900 flex items-center gap-2">
                      <Layers className="w-4 h-4 text-indigo-600" />
                      Platform Managed Qdrant
                    </span>
                    <input
                      type="radio"
                      checked={!formData.customDbEnabled}
                      onChange={() => setFormData({ ...formData, customDbEnabled: false })}
                      className="accent-indigo-600"
                    />
                  </div>
                  <p className="text-[11px] text-slate-500 leading-relaxed">
                    Uses the platform’s default high-performance Qdrant cluster automatically configured in the server environment. Zero setup needed.
                  </p>
                </div>

                <div
                  onClick={() => setFormData({ ...formData, customDbEnabled: true })}
                  className={`p-4 rounded-2xl border-2 cursor-pointer transition-all ${
                    formData.customDbEnabled
                      ? 'border-indigo-600 bg-indigo-50/40 shadow-sm'
                      : 'border-slate-200 hover:border-slate-300 bg-slate-50/50'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold text-slate-900 flex items-center gap-2">
                      <Database className="w-4 h-4 text-purple-600" />
                      Bring Your Own Database (Custom Qdrant)
                    </span>
                    <input
                      type="radio"
                      checked={formData.customDbEnabled}
                      onChange={() => setFormData({ ...formData, customDbEnabled: true })}
                      className="accent-indigo-600"
                    />
                  </div>
                  <p className="text-[11px] text-slate-500 leading-relaxed">
                    Connect your own Qdrant Cloud or self-hosted Docker cluster. You retain 100% control over your vector storage and collections.
                  </p>
                </div>
              </div>

              {/* Custom Credentials Form */}
              {formData.customDbEnabled && (
                <div className="p-5 rounded-2xl bg-slate-50 border border-slate-200 space-y-4 animate-in fade-in">
                  <div className="flex items-center gap-2 pb-2 border-b border-slate-200">
                    <Cpu className="w-4 h-4 text-indigo-600" />
                    <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                      Custom Qdrant Instance Credentials
                    </h4>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-12 gap-4">
                    {/* Qdrant URL */}
                    <div className="sm:col-span-8">
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Qdrant Cluster URL <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="url"
                        placeholder="https://xyz-example.aws.cloud.qdrant.io:6333"
                        value={formData.customDbUrl}
                        onChange={(e) => setFormData({ ...formData, customDbUrl: e.target.value })}
                        className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-slate-300 text-xs text-slate-900 font-mono focus:outline-none focus:border-indigo-600 shadow-sm"
                      />
                      <span className="text-[11px] text-slate-400 mt-1 block">
                        Include port 6333 for Cloud or self-hosted instances (e.g. https://...:6333).
                      </span>
                    </div>

                    {/* Collection Prefix */}
                    <div className="sm:col-span-4">
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Collection Name
                      </label>
                      <input
                        type="text"
                        placeholder="sitebot_chunks (default)"
                        value={formData.customDbCollection}
                        onChange={(e) => setFormData({ ...formData, customDbCollection: e.target.value })}
                        className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-slate-300 text-xs text-slate-900 font-mono focus:outline-none focus:border-indigo-600 shadow-sm"
                      />
                      <span className="text-[11px] text-slate-400 mt-1 block">
                        Will be auto-suffixed with dimension (e.g. _2048).
                      </span>
                    </div>

                    {/* Qdrant API Key */}
                    <div className="sm:col-span-12">
                      <div className="flex items-center justify-between mb-1">
                        <label className="text-xs font-semibold text-slate-700">
                          Qdrant API Key (Optional for local/unprotected instances)
                        </label>
                        {bot?.customVectorDb?.hasApiKey && (
                          <span className="text-[11px] font-mono text-emerald-600 font-bold">
                            Configured: {bot.customVectorDb.apiKey}
                          </span>
                        )}
                      </div>
                      <input
                        type="password"
                        placeholder="Enter Qdrant API Key (leave empty if none)..."
                        value={formData.customDbApiKey}
                        onChange={(e) => setFormData({ ...formData, customDbApiKey: e.target.value })}
                        className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-slate-300 text-xs text-slate-900 font-mono focus:outline-none focus:border-indigo-600 shadow-sm"
                      />
                    </div>
                  </div>

                  {/* Test Connection Button & Result Alert */}
                  <div className="pt-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <button
                      type="button"
                      onClick={handleTestCustomDb}
                      disabled={testingDb || !formData.customDbUrl}
                      className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-900 text-white text-xs font-semibold shadow-sm transition-all disabled:opacity-40"
                    >
                      {testingDb ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                      )}
                      <span>{testingDb ? 'Testing Connection...' : 'Test Connection'}</span>
                    </button>

                    {dbTestResult && (
                      <div className={`text-xs px-3 py-1.5 rounded-xl border flex items-center gap-1.5 ${
                        dbTestResult.success
                          ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                          : 'bg-red-50 text-red-800 border-red-200'
                      }`}>
                        {dbTestResult.success ? (
                          <Check className="w-3.5 h-3.5 text-emerald-600" />
                        ) : (
                          <AlertCircle className="w-3.5 h-3.5 text-red-600" />
                        )}
                        <span>{dbTestResult.message}</span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Save Button */}
              <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
                <div>
                  {saveSuccess && (
                    <span className="text-xs text-emerald-600 font-bold flex items-center gap-1">
                      <Check className="w-4 h-4" /> Database configuration saved!
                    </span>
                  )}
                </div>
                <button
                  type="button"
                  onClick={handleSaveSettings}
                  className="px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-md transition-all flex items-center gap-1.5"
                >
                  <span>Save Database Settings</span>
                </button>
              </div>
            </div>

            {/* Setup Guide Accordion / Information */}
            <QdrantSetupGuide />
          </div>
        )}
      </main>

      {/* Manual FAQ Modal (Light Theme) */}
      {showManualModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-lg rounded-3xl bg-white border border-slate-200 shadow-2xl p-6 sm:p-8 relative">
            <button
              onClick={() => setShowManualModal(false)}
              className="absolute top-5 right-5 text-slate-400 hover:text-slate-700 p-1 rounded-lg hover:bg-slate-100"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-2 mb-2">
              <Plus className="w-5 h-5 text-indigo-600" />
              <h3 className="text-lg font-bold text-slate-900">Add Knowledge Snippet</h3>
            </div>
            <p className="text-xs text-slate-500 mb-5">
              Inject custom FAQs, pricing notes, or policies directly into your Qdrant vector index.
            </p>

            <form onSubmit={handleAddManualSnippet} className="space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                  Topic / Question Title <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={manualTitle}
                  onChange={(e) => setManualTitle(e.target.value)}
                  placeholder="e.g. Enterprise SLA or Refund Policy"
                  className="w-full px-4 py-2.5 rounded-xl bg-slate-50 border border-slate-300 text-xs text-slate-900 placeholder-slate-400 focus:bg-white focus:outline-none focus:border-indigo-600"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                  Answer / Content Details <span className="text-red-500">*</span>
                </label>
                <textarea
                  required
                  rows={5}
                  value={manualContent}
                  onChange={(e) => setManualContent(e.target.value)}
                  placeholder="Enter detailed facts. This will be vectorized into 768 dimensions in Qdrant..."
                  className="w-full px-4 py-3 rounded-xl bg-slate-50 border border-slate-300 text-xs text-slate-900 placeholder-slate-400 leading-relaxed focus:bg-white focus:outline-none focus:border-indigo-600"
                />
              </div>

              <div className="pt-3 border-t border-slate-100 flex justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setShowManualModal(false)}
                  className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-xs font-semibold text-slate-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={addingManual}
                  className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-sm transition-all disabled:opacity-50 flex items-center gap-1.5"
                >
                  {addingManual && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>{addingManual ? 'Embedding into Qdrant...' : 'Save & Embed Vector'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
