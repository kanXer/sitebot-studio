'use client';

import React, { Suspense, useEffect, useMemo, useState, useCallback } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  LayoutDashboard,
  Users,
  UserCircle2,
  Shield,
  Bot,
  Plus,
  Mail,
  MessageCircle,
  Send,
  Building2,
  MapPin,
  CreditCard,
  Loader2,
  ExternalLink,
  Cpu,
  Phone,
  ChevronRight,
  CheckCircle2,
  AlertTriangle,
  X,
  Copy,
  Check,
  Globe,
  Code2,
  Crown,
  Search,
  ArrowRight,
  Sliders,
  Play,
  Database,
  Calendar,
  Layers,
  HelpCircle,
  Trash2,
} from 'lucide-react';
import { Navbar } from '@/components/Navbar';
import { Footer } from '@/components/Footer';
import { useAuth } from '@/lib/firebase/AuthContext';
import { AuthModal } from '@/components/AuthModal';
import { DeleteBotModal } from '@/components/DeleteBotModal';
import { OnboardingModal } from '@/components/OnboardingModal';

export interface UserBot {
  id: string;
  slug?: string;
  name: string;
  siteUrl: string;
  primaryColor?: string;
  position?: string;
  planTier?: 'free' | 'individual' | 'enterprise';
  chatModel?: string;
  ownerEmail?: string;
  status?: string;
  createdAt?: string;
}

export interface Lead {
  id: string;
  kind: 'cta' | 'chat';
  source: string;
  botId?: string;
  botName?: string;
  campaign?: string;
  page?: string;
  name?: string;
  email?: string;
  phone?: string;
  message?: string;
  data?: Record<string, any>;
  createdAt?: string;
}

export interface ProfileData {
  email: string;
  name: string;
  avatar: string;
  companyName: string;
  phone: string;
  address: {
    street: string;
    city: string;
    state: string;
    country: string;
    zip: string;
  };
  payment: { paypalEmail: string; payerId: string };
  plan: string;
  planExpiresAt?: string;
  botLimit: number;
  tokenQuota: number;
  chatQuota: number;
  notifications: {
    email: { enabled: boolean; to: string };
    whatsapp: { enabled: boolean; number: string };
    telegram: { enabled: boolean; chatId: string; botToken: string };
  };
  usage: {
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
    chats: number;
    leads: number;
  };
  quotaPercent: { tokens: number; chats: number };
  botCount: number;
}

const EMPTY_ADDRESS = { street: '', city: '', state: '', country: '', zip: '' };
const EMPTY_NOTIFS = {
  email: { enabled: false, to: '' },
  whatsapp: { enabled: false, number: '' },
  telegram: { enabled: false, chatId: '', botToken: '' },
};

function DashboardContent() {
  const { user, isAdmin, isSuperAdmin, loading, signInWithGoogle } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();

  const [tab, setTab] = useState<'overview' | 'bots' | 'leads' | 'profile'>('overview');
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [bots, setBots] = useState<UserBot[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [loadingBots, setLoadingBots] = useState(false);
  const [saving, setSaving] = useState(false);
  const [paying, setPaying] = useState(false);
  const [paypalError, setPaypalError] = useState('');
  const [upgradeMsg, setUpgradeMsg] = useState('');
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [draft, setDraft] = useState<any>(null);

  // Bot Delete & Onboarding Modal States
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deletedBotName, setDeletedBotName] = useState('');
  const [onboardingOpen, setOnboardingOpen] = useState(false);

  // Embed Modal State
  const [embedBotModal, setEmbedBotModal] = useState<UserBot | null>(null);
  const [copiedScript, setCopiedScript] = useState(false);

  const fetchProfile = useCallback(async () => {
    if (!user?.email) return;
    try {
      const res = await fetch(`/api/profile?email=${encodeURIComponent(user.email)}`, {
        headers: { 'x-user-email': user.email, 'x-user-id': user.uid || '' },
        cache: 'no-store',
      });
      if (res.ok) {
        const data = await res.json();
        setProfile(data.profile);
        if (data.profile && data.profile.profileCompleted === false) {
          if (typeof window !== 'undefined' && !sessionStorage.getItem('onboarding_dismissed')) {
            setOnboardingOpen(true);
          }
        }
        setDraft({
          name: data.profile.name || '',
          companyName: data.profile.companyName || '',
          phone: data.profile.phone || '',
          address: { ...EMPTY_ADDRESS, ...(data.profile.address || {}) },
          payment: { paypalEmail: '', payerId: '', ...(data.profile.payment || {}) },
          notifications: {
            email: { ...EMPTY_NOTIFS.email, ...(data.profile.notifications?.email || {}) },
            whatsapp: { ...EMPTY_NOTIFS.whatsapp, ...(data.profile.notifications?.whatsapp || {}) },
            telegram: { ...EMPTY_NOTIFS.telegram, ...(data.profile.notifications?.telegram || {}) },
          },
        });
      }
    } catch {}
  }, [user?.email, user?.uid]);

  // Smoothly scroll to top whenever active tab changes
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [tab]);

  const handleDeleteDashboardBot = async (b: UserBot) => {
    if (!confirm(`Are you sure you want to delete chatbot "${b.name}"? This permanently removes the bot, its vector points, and all crawled knowledge.`)) {
      return;
    }
    try {
      const headers: Record<string, string> = {};
      if (user?.email) headers['x-user-email'] = user.email;
      if (user?.uid) headers['x-user-id'] = user.uid;

      const res = await fetch(`/api/bot/${b.id}`, { method: 'DELETE', headers });
      if (res.ok) {
        setBots((prev) => prev.filter((item) => item.id !== b.id));
        setDeletedBotName(b.name);
        setDeleteModalOpen(true);
        window.dispatchEvent(new CustomEvent('sitebot_deleted', { detail: { id: b.id } }));
      } else {
        const err = await res.json().catch(() => ({}));
        alert(err.error || 'Failed to delete chatbot.');
      }
    } catch (err: any) {
      console.error('Delete error:', err);
      alert(err.message || 'Error deleting chatbot.');
    }
  };

  const fetchLeads = useCallback(async () => {
    if (!user?.email) return;
    try {
      const res = await fetch(`/api/leads?email=${encodeURIComponent(user.email)}`, {
        headers: { 'x-user-email': user.email },
        cache: 'no-store',
      });
      if (res.ok) {
        const data = await res.json();
        setLeads(data.leads || []);
      }
    } catch {}
  }, [user?.email]);

  const fetchBots = useCallback(async () => {
    if (!user?.email) return;
    setLoadingBots(true);
    try {
      const res = await fetch(`/api/bot?email=${encodeURIComponent(user.email)}`, {
        headers: { 'x-user-email': user.email, 'x-user-id': user.uid || '' },
        cache: 'no-store',
      });
      if (res.ok) {
        const data = await res.json();
        setBots(data.bots || []);
      }
    } catch {} finally {
      setLoadingBots(false);
    }
  }, [user?.email, user?.uid]);

  useEffect(() => {
    if (!user?.email) return;
    setLoadingData(true);
    Promise.all([fetchProfile(), fetchLeads(), fetchBots()]).finally(() => setLoadingData(false));
  }, [user?.email, fetchProfile, fetchLeads, fetchBots]);

  // Handle PayPal return callback
  useEffect(() => {
    if (!user?.email) return;
    const paypal = searchParams.get('paypal');
    const orderId = searchParams.get('token') || searchParams.get('orderId');
    if (paypal === 'success' && orderId) {
      setPaying(true);
      fetch(`/api/paypal/capture?email=${encodeURIComponent(user.email)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-user-email': user.email },
        body: JSON.stringify({ orderId }),
      })
        .then((r) => r.json())
        .then((data) => {
          if (data.success) {
            setUpgradeMsg('Pro plan activated successfully! Welcome aboard.');
            fetchProfile();
          } else {
            setPaypalError(data.error || 'Payment could not be confirmed.');
          }
        })
        .catch(() => setPaypalError('Payment could not be confirmed.'))
        .finally(() => {
          setPaying(false);
          router.replace('/dashboard', { scroll: false });
        });
    }
    if (paypal === 'cancelled') {
      setPaypalError('Payment was cancelled.');
      router.replace('/dashboard', { scroll: false });
    }
  }, [searchParams, user?.email, router, fetchProfile]);

  const upgradeToPro = async () => {
    if (!user?.email) return;
    setPaying(true);
    setPaypalError('');
    try {
      const res = await fetch('/api/paypal/create-order', {
        method: 'POST',
        headers: { 'x-user-email': user.email, 'x-user-id': user.uid || '' },
      });
      const data = await res.json();
      if (!res.ok || !data.approveUrl) {
        throw new Error(data.error || 'Could not create payment. PayPal may not be configured yet.');
      }
      window.location.href = data.approveUrl;
    } catch (err: any) {
      setPaypalError(err.message || 'Could not start payment.');
    } finally {
      setPaying(false);
    }
  };

  const saveProfile = async () => {
    if (!user?.email || !draft) return;
    setSaving(true);
    try {
      const res = await fetch('/api/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'x-user-email': user.email },
        body: JSON.stringify(draft),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to save');
      await fetchProfile();
    } catch (err: any) {
      alert(err.message || 'Failed to save profile.');
    } finally {
      setSaving(false);
    }
  };

  const setDraftNotif = (channel: 'email' | 'whatsapp' | 'telegram', field: string, value: any) => {
    setDraft((d: any) => ({
      ...d,
      notifications: {
        ...d.notifications,
        [channel]: { ...d.notifications[channel], [field]: value },
      },
    }));
  };

  const stats = useMemo(() => {
    const u = profile?.usage || { totalTokens: 0, chats: 0, leads: 0 };
    const p = profile?.quotaPercent || { tokens: 0, chats: 0 };
    return {
      tokens: u.totalTokens,
      chats: u.chats,
      leads: u.leads,
      tokenPct: p.tokens,
      chatPct: p.chats,
    };
  }, [profile]);

  const handleCopyScript = (bot: UserBot) => {
    const origin = typeof window !== 'undefined' ? window.location.origin : 'https://rivafy.com';
    const script = `<!-- Rivafy Studio AI Chatbot Widget -->\n<script src="${origin}/widget.js" data-bot-id="${bot.id}" defer></script>`;
    navigator.clipboard.writeText(script);
    setCopiedScript(true);
    setTimeout(() => setCopiedScript(false), 2000);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col selection:bg-indigo-500 selection:text-white">
        <Navbar />
        <div className="flex-1 flex items-center justify-center py-24">
          <div className="text-center space-y-3">
            <Loader2 className="w-8 h-8 animate-spin text-indigo-600 mx-auto" />
            <p className="text-xs font-semibold text-slate-500">Loading your dashboard...</p>
          </div>
        </div>
        <Footer />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col selection:bg-indigo-500 selection:text-white">
        <Navbar />
        <div className="flex-1 flex items-center justify-center px-4 py-16">
          <div className="w-full max-w-md rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl p-8 text-center relative overflow-hidden animate-in fade-in duration-300">
            <div className="h-1.5 w-full bg-gradient-to-r from-indigo-600 via-purple-600 to-rose-600 absolute top-0 left-0" />
            <div className="w-14 h-14 mx-auto rounded-2xl bg-indigo-50 dark:bg-indigo-950/80 border border-indigo-100 dark:border-indigo-800 flex items-center justify-center mb-4 text-indigo-600 dark:text-indigo-400 shadow-sm">
              <UserCircle2 className="w-7 h-7" />
            </div>
            <h1 className="text-2xl font-black text-slate-900 dark:text-white font-heading tracking-tight">
              Sign In to Your Dashboard
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-2 leading-relaxed">
              Access your chatbots, view real-time incoming leads, monitor AI token quotas, and configure notification alerts.
            </p>
            <div className="mt-6 space-y-3">
              <button
                type="button"
                onClick={() => signInWithGoogle().catch(() => setAuthModalOpen(true))}
                className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white text-xs font-bold shadow-lg shadow-indigo-600/25 hover:scale-[1.01] active:scale-[0.99] transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                <span>Continue with Google</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
          <AuthModal
            isOpen={authModalOpen}
            onClose={() => setAuthModalOpen(false)}
            onLoginSuccess={() => setOnboardingOpen(true)}
          />
        </div>
        <Footer />
      </div>
    );
  }

  const tabs = [
    {
      id: 'overview' as const,
      label: 'Overview',
      icon: LayoutDashboard,
    },
    {
      id: 'bots' as const,
      label: 'My Chatbots',
      icon: Bot,
      badge: bots.length,
    },
    {
      id: 'leads' as const,
      label: 'Leads & CRM',
      icon: Users,
      badge: leads.length,
    },
    {
      id: 'profile' as const,
      label: 'Settings & Alerts',
      icon: UserCircle2,
    },
  ];

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex min-w-0 flex-col selection:bg-indigo-500 selection:text-white">
      <Navbar />

      <main className="flex-1 max-w-7xl mx-auto px-3.5 sm:px-6 lg:px-8 py-6 sm:py-8 w-full min-w-0 pb-28 xl:pb-12">
        {/* Header Hero */}
        <div className="bg-white dark:bg-slate-900 rounded-3xl p-4 sm:p-7 lg:p-8 border border-slate-200/80 dark:border-slate-800 shadow-sm mb-8 relative overflow-hidden">
          <div className="h-1.5 w-full bg-gradient-to-r from-indigo-600 via-purple-600 to-rose-600 absolute top-0 left-0" />

          <div className="flex flex-col md:flex-row md:items-center justify-between gap-5 sm:gap-6">
            <div className="flex items-center gap-3.5 sm:gap-4 min-w-0 flex-1">
              <div className="relative shrink-0">
                <img
                  src={user.photoURL || `https://api.dicebear.com/7.x/bottts/svg?seed=${user.email}`}
                  alt={user.displayName || 'User'}
                  referrerPolicy="no-referrer"
                  crossOrigin="anonymous"
                  onError={(e) => {
                    e.currentTarget.onerror = null;
                    e.currentTarget.src = `https://api.dicebear.com/7.x/bottts/svg?seed=${user.email}`;
                  }}
                  className="w-12 h-12 sm:w-16 sm:h-16 rounded-2xl ring-2 ring-indigo-500/30 object-cover shadow-sm bg-slate-100 dark:bg-slate-800"
                />
                <span className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 sm:w-4 sm:h-4 bg-emerald-500 rounded-full border-2 border-white dark:border-slate-900" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
                  <h1 className="text-base sm:text-2xl font-black text-slate-900 dark:text-white font-heading tracking-tight truncate">
                    Welcome, {user.displayName || 'Creator'}! 👋
                  </h1>
                  <span
                    className={`px-2 sm:px-2.5 py-0.5 rounded-full text-[9px] sm:text-[10px] font-black uppercase tracking-wider shrink-0 ${
                      profile?.plan === 'pro'
                        ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-sm'
                        : 'bg-indigo-50 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800'
                    }`}
                  >
                    {profile?.plan === 'pro' ? 'Pro Member' : 'Free Tier'}
                  </span>
                  {(isAdmin || isSuperAdmin) && (
                    <span className="px-2 py-0.5 rounded-full text-[9px] sm:text-[10px] font-black uppercase tracking-wider bg-rose-50 dark:bg-rose-950 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-900 flex items-center gap-1 shrink-0">
                      <Shield className="w-3 h-3" />
                      <span>{isSuperAdmin ? 'Super Admin' : 'Admin'}</span>
                    </span>
                  )}
                </div>
                <p className="text-[11px] sm:text-xs text-slate-500 dark:text-slate-400 font-medium truncate mt-0.5">
                  {user.email}
                </p>
              </div>
            </div>

            <div className="grid w-full grid-cols-1 sm:flex sm:w-auto sm:items-center gap-2 sm:gap-3 sm:flex-nowrap shrink-0">
              <Link
                href="/create"
                className="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 sm:gap-2 px-3.5 sm:px-4 py-2 sm:py-2.5 text-xs font-extrabold rounded-2xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white shadow-md shadow-indigo-600/25 hover:scale-[1.02] active:scale-[0.98] transition-all cursor-pointer whitespace-nowrap"
              >
                <Plus className="w-4 h-4 stroke-[2.5]" />
                <span>Create Chatbot</span>
              </Link>

              <Link
                href="/help"
                className="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-3 sm:px-3.5 py-2 sm:py-2.5 text-xs font-bold rounded-2xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 transition-colors whitespace-nowrap"
              >
                <HelpCircle className="w-4 h-4 text-indigo-500" />
                <span>Docs &amp; Setup</span>
              </Link>

              {(isAdmin || isSuperAdmin) && (
                <Link
                  href="/admin"
                  className="w-full sm:w-auto flex items-center justify-center gap-1.5 px-3.5 py-2 sm:py-2.5 text-xs font-bold rounded-2xl bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-900 transition-colors whitespace-nowrap"
                >
                  <Shield className="w-3.5 h-3.5" />
                  <span>Admin Panel</span>
                </Link>
              )}
            </div>
          </div>
        </div>

        {/* Notifications & Banner Alerts */}
        {upgradeMsg && (
          <div className="mb-6 flex items-center gap-2.5 p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-900 text-emerald-800 dark:text-emerald-300 text-xs font-bold">
            <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
            <span className="min-w-0 break-words">{upgradeMsg}</span>
          </div>
        )}

        {paypalError && (
          <div className="mb-6 flex items-center justify-between gap-2.5 p-4 rounded-2xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-900 text-rose-800 dark:text-rose-300 text-xs font-bold">
            <div className="flex min-w-0 items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600" />
              <span className="min-w-0 break-words">{paypalError}</span>
            </div>
            <button onClick={() => setPaypalError('')} aria-label="Dismiss" className="p-1 hover:bg-rose-100 rounded-lg">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Navigation Tabs */}
        <div className="grid grid-cols-2 sm:flex sm:items-center gap-2 min-w-0 max-w-full pb-2 mb-8">
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex w-full sm:w-auto min-w-0 items-center justify-center gap-1.5 sm:gap-2 px-2 sm:px-4 py-2.5 rounded-2xl text-[11px] sm:text-xs font-extrabold whitespace-nowrap transition-all border cursor-pointer ${
                tab === t.id
                  ? 'bg-indigo-600 text-white border-indigo-600 shadow-md shadow-indigo-600/25'
                  : 'bg-white dark:bg-slate-900 border-slate-200/80 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:border-indigo-300 dark:hover:border-slate-700'
              }`}
            >
              <t.icon className="w-4 h-4" />
              <span className="min-w-0 truncate">{t.label}</span>
              {typeof t.badge === 'number' && (
                <span
                  className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
                    tab === t.id
                      ? 'bg-white/20 text-white'
                      : 'bg-indigo-50 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300'
                  }`}
                >
                  {t.badge}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Tab Content Rendering */}
        {loadingData && !profile ? (
          <div className="flex items-center justify-center py-24">
            <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
          </div>
        ) : tab === 'overview' ? (
          <OverviewTab
            stats={stats}
            profile={profile}
            bots={bots}
            leads={leads}
            paying={paying}
            onUpgrade={upgradeToPro}
            onGoBots={() => setTab('bots')}
            onGoLeads={() => setTab('leads')}
            onGetEmbedCode={(bot) => setEmbedBotModal(bot)}
          />
        ) : tab === 'bots' ? (
          <BotsTab
            bots={bots}
            loading={loadingBots}
            onGetEmbedCode={(bot) => setEmbedBotModal(bot)}
            onDeleteBot={handleDeleteDashboardBot}
          />
        ) : tab === 'leads' ? (
          <LeadsTab leads={leads} loading={loadingData} />
        ) : (
          <ProfileTab
            profile={profile}
            draft={draft}
            saving={saving}
            setDraft={setDraft}
            setDraftNotif={setDraftNotif}
            onSave={saveProfile}
          />
        )}
      </main>

      {/* Embed Script Modal */}
      {embedBotModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-lg w-full max-h-[calc(100dvh-2rem)] overflow-y-auto p-4 sm:p-8 shadow-2xl relative space-y-4">
            <button
              onClick={() => setEmbedBotModal(null)}
              className="absolute top-5 right-5 p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-950/80 border border-indigo-100 dark:border-indigo-800 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
                <Code2 className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <h3 className="text-base font-extrabold text-slate-900 dark:text-white font-heading break-words">
                  Embed {embedBotModal.name}
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Paste this snippet right before the closing <code className="text-indigo-600 dark:text-indigo-400 font-mono font-bold">&lt;/body&gt;</code> tag of your website.
                </p>
              </div>
            </div>

            <div className="relative bg-slate-900 rounded-2xl p-4 border border-slate-800 text-xs font-mono text-slate-200 overflow-x-auto">
              <code>
                {`<!-- Rivafy Studio AI Chatbot Widget -->\n<script src="${typeof window !== 'undefined' ? window.location.origin : 'https://rivafy.com'}/widget.js" data-bot-id="${embedBotModal.id}" defer></script>`}
              </code>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
              <Link
                href="/help"
                className="text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1"
              >
                <span>Read Platform Setup Guides</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </Link>

              <button
                type="button"
                onClick={() => handleCopyScript(embedBotModal)}
                className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-extrabold text-xs shadow-md shadow-indigo-600/25 flex items-center gap-2 cursor-pointer transition-all hover:scale-105 active:scale-95"
              >
                {copiedScript ? (
                  <>
                    <Check className="w-4 h-4 stroke-[3]" />
                    <span>Copied!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4" />
                    <span>Copy Script Tag</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Chatbot Redirect/Action Modal */}
      <DeleteBotModal
        isOpen={deleteModalOpen}
        onClose={() => setDeleteModalOpen(false)}
        botName={deletedBotName}
        type="deleted"
      />

      {/* New User Role & Onboarding Setup Modal */}
      <OnboardingModal
        isOpen={onboardingOpen}
        onClose={() => {
          if (typeof window !== 'undefined') {
            sessionStorage.setItem('onboarding_dismissed', '1');
          }
          setOnboardingOpen(false);
        }}
        onComplete={() => {
          if (typeof window !== 'undefined') {
            sessionStorage.removeItem('onboarding_dismissed');
          }
          fetchProfile();
        }}
      />

      <Footer />
    </div>
  );
}

export default function DashboardPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950">
          <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
        </div>
      }
    >
      <DashboardContent />
    </Suspense>
  );
}

/* ========================================================
   OVERVIEW TAB COMPONENT
   ======================================================== */
function OverviewTab({
  stats,
  profile,
  bots,
  leads,
  paying,
  onUpgrade,
  onGoBots,
  onGoLeads,
  onGetEmbedCode,
}: {
  stats: { tokens: number; chats: number; leads: number; tokenPct: number; chatPct: number };
  profile: ProfileData | null;
  bots: UserBot[];
  leads: Lead[];
  paying: boolean;
  onUpgrade: () => void;
  onGoBots: () => void;
  onGoLeads: () => void;
  onGetEmbedCode: (bot: UserBot) => void;
}) {
  const plan = profile?.plan === 'pro' ? 'Pro' : 'Free';
  const botCap = profile?.botLimit ?? 1;

  const statCards = [
    {
      label: 'Active Chatbots',
      value: `${bots.length} / ${botCap}`,
      sub: `${Math.max(0, botCap - bots.length)} available project slot(s)`,
      color: 'from-blue-600 to-indigo-600',
      icon: Bot,
      pct: Math.min(100, (bots.length / (botCap || 1)) * 100),
      onClick: onGoBots,
    },
    {
      label: 'Conversations & Messages',
      value: `${stats.chats.toLocaleString()}`,
      sub: `of ${(profile?.chatQuota || 0).toLocaleString()} (${stats.chatPct}%)`,
      color: 'from-emerald-500 to-teal-500',
      icon: MessageCircle,
      pct: stats.chatPct,
    },
    {
      label: 'Customer Leads Captured',
      value: `${stats.leads.toLocaleString()}`,
      sub: 'via AI Chat & CTA Lead forms',
      color: 'from-rose-500 to-orange-500',
      icon: Users,
      pct: null,
      onClick: onGoLeads,
    },
    {
      label: 'AI Tokens Consumed',
      value: `${stats.tokens.toLocaleString()}`,
      sub: `of ${(profile?.tokenQuota || 0).toLocaleString()} (${stats.tokenPct}%)`,
      color: 'from-purple-500 to-violet-600',
      icon: Cpu,
      pct: stats.tokenPct,
    },
  ];

  return (
    <div className="space-y-8">
      {/* 4 Quick Stat Metric Cards (2x2 on Mobile, 4x1 on Desktop) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {statCards.map((s) => (
          <div
            key={s.label}
            onClick={s.onClick}
            className={`min-w-0 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 p-4 sm:p-5 shadow-sm transition-all ${
              s.onClick ? 'cursor-pointer hover:border-indigo-300 dark:hover:border-slate-700 hover:shadow-md' : ''
            }`}
          >
            <div className="flex items-start justify-between mb-2.5 sm:mb-3">
              <div className={`w-9 h-9 sm:w-10 sm:h-10 rounded-2xl bg-gradient-to-br ${s.color} flex items-center justify-center text-white shadow-sm`}>
                <s.icon className="w-4 h-4 sm:w-5 sm:h-5" />
              </div>
              {s.onClick && (
                <span className="p-1 rounded-lg text-slate-400 hover:text-indigo-600 transition-colors">
                  <ChevronRight className="w-4 h-4" />
                </span>
              )}
            </div>
            <p className="text-2xl font-black text-slate-900 dark:text-white font-heading">
              {s.value}
            </p>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 font-bold mt-0.5 break-words">{s.label}</p>
            {s.pct !== null && (
              <div className="mt-3 h-1.5 w-full rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-purple-500 transition-all duration-500"
                  style={{ width: `${Math.min(100, s.pct)}%` }}
                />
              </div>
            )}
            <p className="text-[10px] text-slate-400 mt-1.5 font-medium break-words">{s.sub}</p>
          </div>
        ))}
      </div>

      {/* Main 2-Column Dashboard Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column: Chatbots & Recent Leads (2 cols wide) */}
        <div className="lg:col-span-2 space-y-8">
          {/* Your Chatbots Showcase */}
          <div className="rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 p-4 sm:p-7 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
              <div className="flex min-w-0 items-center gap-2.5">
                <Bot className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                <h3 className="text-base font-extrabold text-slate-900 dark:text-white font-heading">
                  Your AI Chatbots ({bots.length})
                </h3>
              </div>
              <Link
                href="/create"
                className="text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1"
              >
                <Plus className="w-3.5 h-3.5" /> Create New
              </Link>
            </div>

            {bots.length === 0 ? (
              <div className="text-center py-12 px-4 rounded-2xl bg-slate-50/50 dark:bg-slate-800/30 border border-dashed border-slate-200 dark:border-slate-800 space-y-3">
                <div className="w-12 h-12 rounded-2xl bg-indigo-50 dark:bg-indigo-950/80 text-indigo-600 dark:text-indigo-400 flex items-center justify-center mx-auto shadow-sm">
                  <Bot className="w-6 h-6" />
                </div>
                <h4 className="text-sm font-bold text-slate-900 dark:text-white">No chatbots deployed yet</h4>
                <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto leading-relaxed">
                  Enter your target website URL and our intelligent recursive crawler will configure your custom assistant in 60 seconds.
                </p>
                <Link
                  href="/create"
                  className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs shadow-md shadow-indigo-600/25 transition-all hover:scale-105 active:scale-95"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Create Your First Chatbot</span>
                </Link>
              </div>
            ) : (
              <div className="space-y-3">
                {bots.slice(0, 4).map((b) => (
                  <div
                    key={b.id}
                    className="p-3 sm:p-4 rounded-2xl bg-slate-50/60 dark:bg-slate-800/40 border border-slate-200/70 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4 hover:border-indigo-300 dark:hover:border-slate-700 transition-all min-w-0"
                  >
                    <div className="flex items-start gap-3.5 min-w-0">
                      <div
                        className="w-10 h-10 rounded-xl flex items-center justify-center text-white shrink-0 shadow-sm"
                        style={{ backgroundColor: b.primaryColor || '#4f46e5' }}
                      >
                        <Bot className="w-5 h-5" />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs font-bold text-slate-900 dark:text-white truncate">
                            {b.name}
                          </span>
                          {/* Plan Tier Badge */}
                          <span
                            className={`px-2 py-0.5 rounded-md text-[9px] font-black uppercase tracking-wider ${
                              b.planTier === 'enterprise'
                                ? 'bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800'
                                : b.planTier === 'individual'
                                ? 'bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800'
                                : 'bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                            }`}
                          >
                            {b.planTier === 'enterprise'
                              ? 'Enterprise'
                              : b.planTier === 'individual'
                              ? 'Individual'
                              : 'Free'}
                          </span>
                          {/* Active Indicator */}
                          <span className="flex items-center gap-1 text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                            <span>Active</span>
                          </span>
                        </div>
                        <a
                          href={b.siteUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[11px] text-slate-500 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 flex items-center gap-1 mt-0.5 truncate"
                        >
                          <Globe className="w-3 h-3 shrink-0" />
                          <span className="truncate">{b.siteUrl.replace(/^https?:\/\//, '')}</span>
                          <ExternalLink className="w-2.5 h-2.5 shrink-0 opacity-60" />
                        </a>
                      </div>
                    </div>

                    <div className="grid w-full grid-cols-3 gap-1.5 sm:flex sm:w-auto sm:items-center sm:gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => onGetEmbedCode(b)}
                        className="min-w-0 px-1.5 sm:px-3 py-1.5 rounded-xl bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-[10px] sm:text-xs font-bold border border-slate-200 dark:border-slate-700 transition-colors flex items-center justify-center gap-0.5 sm:gap-1 cursor-pointer whitespace-nowrap"
                        title="Get Embed Code"
                      >
                        <Code2 className="w-3.5 h-3.5 text-indigo-500" />
                        <span>Embed</span>
                      </button>

                      <Link
                        href={`/demo/${b.id}`}
                        target="_blank"
                        className="min-w-0 px-1.5 sm:px-3 py-1.5 rounded-xl bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/60 dark:hover:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300 text-[10px] sm:text-xs font-bold border border-indigo-200 dark:border-indigo-800 transition-colors flex items-center justify-center gap-0.5 sm:gap-1 whitespace-nowrap"
                      >
                        <Play className="w-3.5 h-3.5" />
                        <span>Live Test</span>
                      </Link>

                      <Link
                        href={`/bot/${b.id}`}
                        className="min-w-0 px-1.5 sm:px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white text-[10px] sm:text-xs font-bold shadow-sm transition-all hover:scale-105 active:scale-95 flex items-center justify-center gap-0.5 sm:gap-1 whitespace-nowrap"
                      >
                        <span>Studio</span>
                        <ChevronRight className="w-3.5 h-3.5" />
                      </Link>
                    </div>
                  </div>
                ))}

                {bots.length > 4 && (
                  <button
                    type="button"
                    onClick={onGoBots}
                    className="w-full text-center py-2.5 text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:underline block"
                  >
                    View all {bots.length} chatbots &rarr;
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Recent Leads Preview */}
          <div className="rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 p-4 sm:p-7 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
              <div className="flex min-w-0 items-center gap-2.5">
                <Users className="w-5 h-5 text-rose-500" />
                <h3 className="text-base font-extrabold text-slate-900 dark:text-white font-heading">
                  Recent Captured Leads ({leads.length})
                </h3>
              </div>
              <button
                type="button"
                onClick={onGoLeads}
                className="text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1 cursor-pointer"
              >
                <span>View Full CRM</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>

            {leads.length === 0 ? (
              <div className="text-center py-10 px-4 rounded-2xl bg-slate-50/50 dark:bg-slate-800/30 border border-dashed border-slate-200 dark:border-slate-800 space-y-2">
                <Users className="w-8 h-8 mx-auto text-slate-300 dark:text-slate-600" />
                <p className="text-xs font-semibold text-slate-600 dark:text-slate-400">No leads captured yet</p>
                <p className="text-[11px] text-slate-400 max-w-sm mx-auto">
                  When visitors share their contact email or phone number in your chat widget, they appear here instantly.
                </p>
              </div>
            ) : (
              <div className="space-y-2.5">
                {leads.slice(0, 4).map((l) => (
                  <div
                    key={l.id}
                    className="p-3.5 rounded-2xl bg-slate-50/60 dark:bg-slate-800/40 border border-slate-200/70 dark:border-slate-800 flex items-center justify-between gap-4"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div
                        className={`w-9 h-9 rounded-xl flex items-center justify-center text-white text-xs font-extrabold shrink-0 shadow-sm ${
                          l.kind === 'cta'
                            ? 'bg-gradient-to-br from-rose-500 to-orange-500'
                            : 'bg-gradient-to-br from-indigo-500 to-purple-500'
                        }`}
                      >
                        {(l.name || 'V')[0]?.toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-xs font-bold text-slate-900 dark:text-white truncate">
                            {l.name || 'Anonymous Visitor'}
                          </p>
                          <span
                            className={`text-[9px] px-1.5 py-0.2 rounded-full font-bold ${
                              l.kind === 'cta'
                                ? 'bg-rose-100 dark:bg-rose-950 text-rose-600 dark:text-rose-400'
                                : 'bg-indigo-100 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400'
                            }`}
                          >
                            {l.kind === 'cta' ? 'CTA Form' : 'Chat'}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate flex items-center gap-2 mt-0.5">
                          {l.email && <span>{l.email}</span>}
                          {l.phone && <span>&bull; {l.phone}</span>}
                          {!l.email && !l.phone && <span>No direct contact provided</span>}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      {l.email && (
                        <a
                          href={`mailto:${l.email}`}
                          className="p-2 rounded-xl bg-white dark:bg-slate-800 hover:bg-slate-100 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 transition-colors"
                          title="Send Email"
                        >
                          <Mail className="w-3.5 h-3.5" />
                        </a>
                      )}
                      {l.phone && (
                        <a
                          href={`tel:${l.phone}`}
                          className="p-2 rounded-xl bg-white dark:bg-slate-800 hover:bg-slate-100 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 transition-colors"
                          title="Call Phone"
                        >
                          <Phone className="w-3.5 h-3.5 text-emerald-600" />
                        </a>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Plan Card & Quick Guides (1 col wide) */}
        <div className="space-y-8">
          {/* Plan Card */}
          <div className="rounded-3xl bg-gradient-to-br from-indigo-600 via-purple-600 to-rose-600 p-6 sm:p-7 text-white shadow-xl shadow-purple-600/20 relative overflow-hidden">
            <div className="absolute -top-10 -right-10 w-40 h-40 rounded-full bg-white/10" />
            <div className="absolute top-10 right-6 w-20 h-20 rounded-full bg-white/10" />
            <div className="relative space-y-4">
              <div className="flex items-center gap-2">
                <Crown className="w-5 h-5 text-amber-300" />
                <span className="text-[11px] font-black uppercase tracking-widest text-white/90">
                  Current Membership
                </span>
              </div>

              <div>
                <h2 className="text-3xl font-black font-heading tracking-tight">
                  {plan === 'Pro' ? 'Pro Plan' : 'Free Starter'}
                </h2>
                <p className="text-white/80 text-xs mt-1 leading-relaxed">
                  {plan === 'Pro'
                    ? '10 Chatbots &bull; 2.5M Tokens/mo &bull; WhatsApp + Telegram alerts'
                    : '1 Chatbot &bull; 250K Tokens/mo &bull; Email lead alerts'}
                </p>
              </div>

              <div className="space-y-2.5 pt-2 border-t border-white/15">
                {[
                  `${bots.length} / ${botCap} chatbots active`,
                  plan === 'Pro' ? 'Multi-bot project slots' : 'Upgrade for 10x bot capacity',
                  plan === 'Pro' ? 'Instant WhatsApp & Telegram alerts' : 'Standard Email notifications',
                  plan === 'Pro' ? 'Dedicated SLA & priority support' : 'Community & standard support',
                ].map((f) => (
                  <div key={f} className="flex items-center gap-2 text-xs text-white/90">
                    <CheckCircle2 className="w-4 h-4 text-emerald-300 shrink-0" />
                    <span>{f}</span>
                  </div>
                ))}
              </div>

              <div className="pt-2">
                {plan === 'Free' ? (
                  <button
                    type="button"
                    onClick={onUpgrade}
                    disabled={paying}
                    className="w-full py-3.5 rounded-2xl bg-white text-indigo-700 hover:bg-slate-50 font-extrabold text-xs shadow-lg hover:scale-[1.01] active:scale-[0.99] transition-all disabled:opacity-60 flex items-center justify-center gap-2 cursor-pointer"
                  >
                    {paying ? <Loader2 className="w-4 h-4 animate-spin" /> : <CreditCard className="w-4 h-4" />}
                    <span>{paying ? 'Starting payment…' : 'Upgrade to Pro — $9/mo'}</span>
                  </button>
                ) : (
                  <div className="text-center text-white/90 text-xs font-bold py-2 bg-white/15 rounded-xl border border-white/20">
                    Plan active{profile?.planExpiresAt ? ` until ${new Date(profile.planExpiresAt).toLocaleDateString()}` : ''}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Quick Integration Card */}
          <div className="rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 p-4 sm:p-6 shadow-sm space-y-4">
                <div className="flex min-w-0 items-center gap-2.5">
              <Code2 className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
              <h3 className="text-sm font-extrabold text-slate-900 dark:text-white font-heading">
                1-Step Embed Widget
              </h3>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
              Add our isolated Shadow DOM chat widget to any HTML, WordPress, Webflow, or Shopify site without any framework dependencies.
            </p>

            <div className="p-3 bg-slate-900 rounded-xl text-[11px] font-mono text-indigo-300 overflow-x-auto border border-slate-800">
              <code>{'<script src=".../widget.js" data-bot-id="YOUR_BOT" defer></script>'}</code>
            </div>

            <Link
              href="/help"
              className="inline-flex items-center gap-1.5 text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:underline"
            >
              <span>Explore Platform Integration Guides</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ========================================================
   MY CHATBOTS TAB COMPONENT
   ======================================================== */
function BotsTab({
  bots,
  loading,
  onGetEmbedCode,
  onDeleteBot,
}: {
  bots: UserBot[];
  loading: boolean;
  onGetEmbedCode: (bot: UserBot) => void;
  onDeleteBot: (bot: UserBot) => void;
}) {
  const [searchTerm, setSearchTerm] = useState('');
  const [tierFilter, setTierFilter] = useState<'all' | 'free' | 'individual' | 'enterprise'>('all');

  const filteredBots = useMemo(() => {
    return bots.filter((b) => {
      const matchSearch =
        b.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        b.siteUrl.toLowerCase().includes(searchTerm.toLowerCase());
      const matchTier = tierFilter === 'all' || (b.planTier || 'free') === tierFilter;
      return matchSearch && matchTier;
    });
  }, [bots, searchTerm, tierFilter]);

  return (
    <div className="space-y-6">
      {/* Search & Filter Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-white dark:bg-slate-900 p-4 rounded-3xl border border-slate-200/80 dark:border-slate-800 shadow-sm">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3 pointer-events-none" />
          <input
            type="text"
            placeholder="Search by chatbot name or website..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white outline-none focus:border-indigo-500"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto min-w-0">
          {(['all', 'free', 'individual', 'enterprise'] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTierFilter(t)}
              className={`min-w-0 flex-1 sm:flex-initial px-2 sm:px-3 py-1.5 rounded-xl text-[10px] sm:text-xs font-bold uppercase tracking-wider transition-all cursor-pointer ${
                tierFilter === t
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200'
              }`}
            >
              {t}
            </button>
          ))}

          <Link
            href="/create"
            className="w-full sm:w-auto ml-0 sm:ml-2 flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-extrabold text-xs shadow-md shadow-indigo-600/25 transition-all shrink-0 whitespace-nowrap"
          >
            <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
            <span>New Chatbot</span>
          </Link>
        </div>
      </div>

      {/* Bots Grid */}
      {loading ? (
        <div className="py-20 text-center">
          <Loader2 className="w-8 h-8 animate-spin text-indigo-600 mx-auto" />
          <p className="text-xs text-slate-400 mt-2 font-semibold">Loading chatbots...</p>
        </div>
      ) : filteredBots.length === 0 ? (
        <div className="rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 p-6 sm:p-12 text-center space-y-3">
          <Bot className="w-10 h-10 text-slate-300 dark:text-slate-600 mx-auto" />
          <h3 className="text-base font-bold text-slate-900 dark:text-white">No Chatbots Found</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto">
            {searchTerm || tierFilter !== 'all'
              ? 'No chatbots match your search filters.'
              : 'You have not created any chatbots yet.'}
          </p>
          <Link
            href="/create"
            className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-indigo-600 text-white font-bold text-xs shadow-md shadow-indigo-600/25 hover:scale-105 transition-all"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Create New Chatbot</span>
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
          {filteredBots.map((b) => (
            <div
              key={b.id}
              className="min-w-0 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 p-4 sm:p-6 shadow-sm hover:shadow-md hover:border-indigo-300 dark:hover:border-slate-700 transition-all flex flex-col justify-between"
            >
              <div className="space-y-4">
                <div className="flex flex-wrap items-start justify-between gap-3 min-w-0">
                  <div className="flex items-center gap-3">
                    <div
                      className="w-11 h-11 rounded-2xl flex items-center justify-center text-white shadow-sm shrink-0"
                      style={{ backgroundColor: b.primaryColor || '#4f46e5' }}
                    >
                      <Bot className="w-6 h-6" />
                    </div>
                    <div className="min-w-0">
                      <h4 className="text-sm font-extrabold text-slate-900 dark:text-white font-heading truncate">
                        {b.name}
                      </h4>
                      <a
                        href={b.siteUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[11px] text-slate-400 hover:text-indigo-600 truncate flex items-center gap-1 mt-0.5"
                      >
                        <Globe className="w-3 h-3 shrink-0" />
                        <span className="truncate">{b.siteUrl.replace(/^https?:\/\//, '')}</span>
                      </a>
                    </div>
                  </div>

                  <span
                    className={`max-w-full truncate px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider shrink-0 ${
                      b.planTier === 'enterprise'
                        ? 'bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800'
                        : b.planTier === 'individual'
                        ? 'bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
                    }`}
                  >
                    {b.planTier || 'Free'}
                  </span>
                </div>

                <div className="pt-2 border-t border-slate-100 dark:border-slate-800/80 grid grid-cols-2 gap-2 text-[11px] text-slate-500 dark:text-slate-400">
                  <div>
                    <span className="text-[10px] text-slate-400 uppercase font-bold block">Status</span>
                    <span className="inline-flex items-center gap-1 font-bold text-emerald-600 dark:text-emerald-400">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                      Active
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 uppercase font-bold block">Model</span>
                    <span className="font-semibold text-slate-700 dark:text-slate-300 truncate block">
                      {b.chatModel || 'gpt-4o-mini'}
                    </span>
                  </div>
                </div>
              </div>

              <div className="pt-5 mt-5 border-t border-slate-100 dark:border-slate-800/80 grid grid-cols-4 gap-1 sm:flex sm:items-center sm:gap-2">
                <button
                  type="button"
                  onClick={() => onGetEmbedCode(b)}
                  className="min-w-0 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-[10px] sm:text-xs font-bold transition-colors flex items-center justify-center gap-0.5 sm:gap-1 cursor-pointer whitespace-nowrap"
                  title="Copy Embed Script"
                >
                  <Code2 className="w-3.5 h-3.5 text-indigo-500" />
                  <span>Embed</span>
                </button>

                <Link
                  href={`/demo/${b.id}`}
                  target="_blank"
                  className="min-w-0 py-2 rounded-xl bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/60 dark:hover:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300 text-[10px] sm:text-xs font-bold border border-indigo-200 dark:border-indigo-800 transition-colors flex items-center justify-center gap-0.5 sm:gap-1 whitespace-nowrap"
                >
                  <Play className="w-3.5 h-3.5" />
                  <span>Demo</span>
                </Link>

                <Link
                  href={`/bot/${b.id}`}
                  className="min-w-0 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-[10px] sm:text-xs font-bold shadow-sm transition-all hover:scale-105 active:scale-95 flex items-center justify-center gap-0.5 sm:gap-1 whitespace-nowrap flex-1"
                >
                  <span>Studio</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </Link>

                <button
                  type="button"
                  onClick={() => onDeleteBot(b)}
                  className="min-w-0 p-2 rounded-xl bg-red-50 hover:bg-red-100 dark:bg-red-950/50 dark:hover:bg-red-900/50 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-800/60 transition-colors flex items-center justify-center cursor-pointer shrink-0"
                  title="Delete chatbot"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ========================================================
   LEADS & CRM TAB COMPONENT
   ======================================================== */
function LeadsTab({ leads, loading }: { leads: Lead[]; loading: boolean }) {
  return (
    <div className="rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm">
      <div className="p-4 sm:p-6 border-b border-slate-200/80 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3 min-w-0">
        <div className="min-w-0">
          <h3 className="text-base font-extrabold text-slate-900 dark:text-white font-heading">
            Captured Leads &amp; CTA Submissions
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Every customer inquiry captured across your live widgets and CTA forms is safely stored and delivered.
          </p>
        </div>
        <span className="px-3 py-1 rounded-full bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 text-xs font-black">
          {leads.length} Leads
        </span>
      </div>

      {loading && leads.length === 0 ? (
        <div className="py-20 text-center">
          <Loader2 className="w-8 h-8 animate-spin text-indigo-600 mx-auto" />
        </div>
      ) : leads.length === 0 ? (
        <div className="py-20 text-center text-xs text-slate-400 space-y-2">
          <Users className="w-10 h-10 mx-auto text-slate-300 dark:text-slate-600" />
          <p className="text-sm font-bold text-slate-700 dark:text-slate-300">No leads captured yet.</p>
          <p className="text-xs max-w-sm mx-auto text-slate-500">
            Leads automatically arrive when visitors share their contact details in your live chat widget or submit a website CTA form.
          </p>
        </div>
      ) : (
        <div className="min-w-0 max-w-full overflow-x-auto">
          <table className="min-w-[720px] w-full text-left">
            <thead>
              <tr className="text-[10px] uppercase tracking-wider text-slate-400 border-b border-slate-200/80 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30">
                <th className="px-6 py-3.5 font-bold">Contact Name</th>
                <th className="px-6 py-3.5 font-bold">Contact Details</th>
                <th className="px-6 py-3.5 font-bold hidden md:table-cell">Channel / Source</th>
                <th className="px-6 py-3.5 font-bold hidden sm:table-cell">Origin Campaign / Bot</th>
                <th className="px-6 py-3.5 font-bold">Inquiry Message</th>
                <th className="px-6 py-3.5 font-bold">Captured Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
              {leads.map((l) => (
                <tr
                  key={l.id}
                  className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition-colors"
                >
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3 min-w-[150px]">
                      <div
                        className={`w-9 h-9 rounded-xl flex items-center justify-center text-white text-xs font-black shrink-0 shadow-sm ${
                          l.kind === 'cta'
                            ? 'bg-gradient-to-br from-rose-500 to-orange-500'
                            : 'bg-gradient-to-br from-indigo-500 to-purple-500'
                        }`}
                      >
                        {(l.name || 'V')[0]?.toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-slate-900 dark:text-white truncate">
                          {l.name || 'Anonymous Visitor'}
                        </p>
                        <span
                          className={`text-[9px] px-2 py-0.5 rounded-full font-bold ${
                            l.kind === 'cta'
                              ? 'bg-rose-100 dark:bg-rose-950 text-rose-600 dark:text-rose-400'
                              : 'bg-indigo-100 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400'
                          }`}
                        >
                          {l.kind === 'cta' ? 'CTA Form' : 'Live Chat'}
                        </span>
                      </div>
                    </div>
                  </td>

                  <td className="px-6 py-4">
                    <div className="space-y-1 min-w-[160px]">
                      {l.email && (
                        <a
                          href={`mailto:${l.email}`}
                          className="text-xs font-semibold text-slate-700 dark:text-slate-200 hover:text-indigo-600 dark:hover:text-indigo-400 flex items-center gap-1.5"
                        >
                          <Mail className="w-3.5 h-3.5 text-slate-400" />
                          <span>{l.email}</span>
                        </a>
                      )}
                      {l.phone && (
                        <a
                          href={`tel:${l.phone}`}
                          className="text-xs font-semibold text-slate-700 dark:text-slate-200 hover:text-emerald-600 flex items-center gap-1.5"
                        >
                          <Phone className="w-3.5 h-3.5 text-emerald-500" />
                          <span>{l.phone}</span>
                        </a>
                      )}
                      {!l.email && !l.phone && (
                        <span className="text-[11px] text-slate-400 italic">No contact specified</span>
                      )}
                    </div>
                  </td>

                  <td className="px-6 py-4 hidden md:table-cell">
                    <span className="text-[10px] px-2.5 py-1 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-bold">
                      {l.source || (l.kind === 'cta' ? 'website_cta' : 'chat_assistant')}
                    </span>
                  </td>

                  <td className="px-6 py-4 hidden sm:table-cell min-w-[140px]">
                    <p className="text-xs font-semibold text-slate-700 dark:text-slate-300 truncate max-w-[180px]">
                      {l.campaign || l.botName || (l.page ? l.page.replace(/^https?:\/\//, '') : '—')}
                    </p>
                    {l.page && (
                      <p className="text-[10px] text-slate-400 truncate max-w-[180px]">{l.page}</p>
                    )}
                  </td>

                  <td className="px-6 py-4">
                    <p className="text-xs text-slate-600 dark:text-slate-300 max-w-[220px] truncate">
                      {l.message || l.data?.message || '—'}
                    </p>
                  </td>

                  <td className="px-6 py-4">
                    <p className="text-xs text-slate-400 whitespace-nowrap">
                      {l.createdAt ? new Date(l.createdAt).toLocaleDateString() : '—'}
                    </p>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

/* ========================================================
   PROFILE & NOTIFICATIONS TAB COMPONENT
   ======================================================== */
function ProfileTab({
  profile,
  draft,
  saving,
  setDraft,
  setDraftNotif,
  onSave,
}: {
  profile: ProfileData | null;
  draft: any;
  saving: boolean;
  setDraft: (d: any) => void;
  setDraftNotif: (c: 'email' | 'whatsapp' | 'telegram', f: string, v: any) => void;
  onSave: () => void;
}) {
  const { user } = useAuth();

  if (!draft) return null;

  const input =
    'w-full px-4 py-2.5 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all';
  const label = 'block text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5';

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
      <div className="lg:col-span-2 space-y-6">
        {/* User Account Card */}
        <div className="rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 p-4 sm:p-6 shadow-sm">
          <div className="flex items-center gap-3.5 sm:gap-4 min-w-0">
            <img
              src={user?.photoURL || `https://api.dicebear.com/7.x/bottts/svg?seed=${user?.email || 'user'}`}
              alt={user?.displayName || 'User'}
              referrerPolicy="no-referrer"
              crossOrigin="anonymous"
              onError={(e) => {
                e.currentTarget.onerror = null;
                e.currentTarget.src = `https://api.dicebear.com/7.x/bottts/svg?seed=${user?.email || 'user'}`;
              }}
              className="w-12 h-12 sm:w-16 sm:h-16 rounded-2xl ring-2 ring-indigo-500/30 object-cover shadow-sm shrink-0 bg-slate-100 dark:bg-slate-800"
            />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-sm sm:text-base font-extrabold text-slate-900 dark:text-white font-heading truncate">
                  {user?.displayName || 'Your Account'}
                </h3>
                <span
                  className={`text-[9px] sm:text-[10px] px-2.5 py-0.5 rounded-full font-black uppercase tracking-wider shrink-0 ${
                    profile?.plan === 'pro'
                      ? 'bg-purple-100 dark:bg-purple-950 text-purple-700 dark:text-purple-300'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                  }`}
                >
                  {profile?.plan === 'pro' ? 'Pro Plan' : 'Free Plan'}
                </span>
              </div>
              <p className="text-[11px] sm:text-xs text-slate-500 dark:text-slate-400 truncate flex items-center gap-1.5 mt-0.5">
                <Mail className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                <span className="truncate">{user?.email}</span>
              </p>
            </div>
          </div>
        </div>

        {/* Business Details Form */}
        <div className="rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 p-4 sm:p-6 shadow-sm space-y-4">
          <h3 className="text-sm font-extrabold text-slate-900 dark:text-white font-heading">
            Personal &amp; Business Information
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className={label}>Display Name</label>
              <input
                className={input}
                value={draft.name}
                onChange={(e) => setDraft((d: any) => ({ ...d, name: e.target.value }))}
                placeholder="Full Name"
              />
            </div>
            <div>
              <label className={label}>Company / Agency Name</label>
              <input
                className={input}
                value={draft.companyName}
                onChange={(e) => setDraft((d: any) => ({ ...d, companyName: e.target.value }))}
                placeholder="Company Name"
              />
            </div>
            <div>
              <label className={label}>Business Phone</label>
              <input
                className={input}
                value={draft.phone}
                onChange={(e) => setDraft((d: any) => ({ ...d, phone: e.target.value }))}
                placeholder="+1 (555) 000-0000"
              />
            </div>
            <div>
              <label className={label}>Street Address</label>
              <input
                className={input}
                value={draft.address?.street || ''}
                onChange={(e) =>
                  setDraft((d: any) => ({
                    ...d,
                    address: { ...d.address, street: e.target.value },
                  }))
                }
                placeholder="123 Innovation Blvd"
              />
            </div>
            <div>
              <label className={label}>City</label>
              <input
                className={input}
                value={draft.address?.city || ''}
                onChange={(e) =>
                  setDraft((d: any) => ({
                    ...d,
                    address: { ...d.address, city: e.target.value },
                  }))
                }
                placeholder="City"
              />
            </div>
            <div>
              <label className={label}>Country</label>
              <input
                className={input}
                value={draft.address?.country || ''}
                onChange={(e) =>
                  setDraft((d: any) => ({
                    ...d,
                    address: { ...d.address, country: e.target.value },
                  }))
                }
                placeholder="Country"
              />
            </div>
          </div>
        </div>

        {/* Lead Alert Notifications */}
        <div className="rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 p-4 sm:p-6 shadow-sm space-y-4">
          <div className="flex items-center gap-2.5">
            <Mail className="w-4 h-4 text-indigo-600" />
            <h3 className="text-sm font-extrabold text-slate-900 dark:text-white font-heading">
              Real-Time Lead Delivery Channels
            </h3>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Configure where instant notifications are dispatched whenever a visitor shares their contact info or submits a form.
          </p>

          <div className="space-y-3 pt-2">
            {/* Email Channel */}
            <div className="rounded-2xl border border-slate-200 dark:border-slate-800 p-4">
              <div className="flex items-center justify-between gap-3">
                <div className="flex min-w-0 items-center gap-2.5">
                  <Mail className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-slate-900 dark:text-slate-100">Email Notification</p>
                    <p className="text-[10px] text-slate-400">Dispatches an instant lead summary to your email</p>
                  </div>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    className="sr-only peer"
                    checked={draft.notifications.email.enabled}
                    onChange={(e) => setDraftNotif('email', 'enabled', e.target.checked)}
                  />
                  <div className="w-9 h-5 rounded-full bg-slate-300 dark:bg-slate-700 peer-checked:bg-indigo-600 after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:bg-white after:rounded-full after:w-4 after:h-4 after:transition-all peer-checked:after:translate-x-4" />
                </label>
              </div>
              {draft.notifications.email.enabled && (
                <input
                  className={`${input} mt-3`}
                  placeholder="Notification email address (e.g. leads@company.com)"
                  value={draft.notifications.email.to}
                  onChange={(e) => setDraftNotif('email', 'to', e.target.value)}
                />
              )}
            </div>

            {/* WhatsApp Channel */}
            <div className="rounded-2xl border border-slate-200 dark:border-slate-800 p-4">
              <div className="flex items-center justify-between gap-3">
                <div className="flex min-w-0 items-center gap-2.5">
                  <MessageCircle className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-slate-900 dark:text-slate-100">WhatsApp Alert</p>
                    <p className="text-[10px] text-slate-400">Receives direct WhatsApp alert upon lead capture</p>
                  </div>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    className="sr-only peer"
                    checked={draft.notifications.whatsapp.enabled}
                    onChange={(e) => setDraftNotif('whatsapp', 'enabled', e.target.checked)}
                  />
                  <div className="w-9 h-5 rounded-full bg-slate-300 dark:bg-slate-700 peer-checked:bg-emerald-600 after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:bg-white after:rounded-full after:w-4 after:h-4 after:transition-all peer-checked:after:translate-x-4" />
                </label>
              </div>
              {draft.notifications.whatsapp.enabled && (
                <input
                  className={`${input} mt-3`}
                  placeholder="WhatsApp number with country code (e.g. +14155552671)"
                  value={draft.notifications.whatsapp.number}
                  onChange={(e) => setDraftNotif('whatsapp', 'number', e.target.value)}
                />
              )}
            </div>

            {/* Telegram Channel */}
            <div className="rounded-2xl border border-slate-200 dark:border-slate-800 p-4">
              <div className="flex items-center justify-between gap-3">
                <div className="flex min-w-0 items-center gap-2.5">
                  <Send className="w-4 h-4 text-sky-600 dark:text-sky-400" />
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-slate-900 dark:text-slate-100">Telegram Bot Alert</p>
                    <p className="text-[10px] text-slate-400">Bot token and Chat ID for instant Telegram notifications</p>
                  </div>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    className="sr-only peer"
                    checked={draft.notifications.telegram.enabled}
                    onChange={(e) => setDraftNotif('telegram', 'enabled', e.target.checked)}
                  />
                  <div className="w-9 h-5 rounded-full bg-slate-300 dark:bg-slate-700 peer-checked:bg-sky-600 after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:bg-white after:rounded-full after:w-4 after:h-4 after:transition-all peer-checked:after:translate-x-4" />
                </label>
              </div>
              {draft.notifications.telegram.enabled && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3">
                  <input
                    className={input}
                    placeholder="Telegram Bot Token"
                    value={draft.notifications.telegram.botToken}
                    onChange={(e) => setDraftNotif('telegram', 'botToken', e.target.value)}
                  />
                  <input
                    className={input}
                    placeholder="Telegram Chat ID"
                    value={draft.notifications.telegram.chatId}
                    onChange={(e) => setDraftNotif('telegram', 'chatId', e.target.value)}
                  />
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Save Settings Sidebar */}
      <div className="space-y-6">
        <div className="rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 p-4 sm:p-6 shadow-sm static lg:sticky lg:top-24 space-y-4">
          <h3 className="text-sm font-extrabold text-slate-900 dark:text-white font-heading">Save Changes</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
            Your profile details and notification settings are applied across all chatbots created under this account.
          </p>
          <button
            type="button"
            onClick={onSave}
            disabled={saving}
            className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white text-xs font-bold shadow-md shadow-indigo-600/25 hover:scale-[1.01] active:scale-[0.99] transition-all disabled:opacity-60 flex items-center justify-center gap-2 cursor-pointer"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
            <span>{saving ? 'Saving Profile...' : 'Save Settings'}</span>
          </button>
        </div>
      </div>
    </div>
  );
}