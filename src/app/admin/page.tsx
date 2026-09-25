'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Shield,
  Bot,
  Users,
  Database,
  Layers,
  FileText,
  Activity,
  CheckCircle2,
  AlertCircle,
  Search,
  ExternalLink,
  Trash2,
  PauseCircle,
  PlayCircle,
  Plus,
  RefreshCw,
  Download,
  Lock,
  ArrowRight,
  Sparkles,
  Sliders,
  ChevronRight,
  UserCheck,
  UserX,
  Mail,
  Calendar,
  Globe,
  Loader2,
  Inbox,
  Filter,
} from 'lucide-react';
import { Navbar } from '@/components/Navbar';
import { Footer } from '@/components/Footer';
import { useAuth } from '@/lib/firebase/AuthContext';
import { AuthModal } from '@/components/AuthModal';

export default function AdminPanelPage() {
  const router = useRouter();
  const { user, role, isAdmin, isSuperAdmin, loading: authLoading } = useAuth();

  const [activeTab, setActiveTab] = useState<
    'overview' | 'bots' | 'submissions' | 'forms' | 'admins' | 'users' | 'ctas'
  >('overview');

  // Stats State
  const [stats, setStats] = useState<any>(null);
  const [systemHealth, setSystemHealth] = useState<any>(null);
  const [statsLoading, setStatsLoading] = useState(true);

  // Bots State
  const [bots, setBots] = useState<any[]>([]);
  const [botSearch, setBotSearch] = useState('');
  const [botStatusFilter, setBotStatusFilter] = useState<'all' | 'active' | 'disabled'>('all');
  const [togglingBotId, setTogglingBotId] = useState<string | null>(null);
  const [deletingBotId, setDeletingBotId] = useState<string | null>(null);

  // Submissions State
  const [submissions, setSubmissions] = useState<any[]>([]);
  const [selectedBotFilter, setSelectedBotFilter] = useState<string>('all');
  const [submissionSearch, setSubmissionSearch] = useState('');

  // Forms State
  const [forms, setForms] = useState<any[]>([]);

  // Admins State
  const [adminsList, setAdminsList] = useState<any[]>([]);
  const [newAdminEmail, setNewAdminEmail] = useState('');
  const [newAdminName, setNewAdminName] = useState('');
  const [addingAdmin, setAddingAdmin] = useState(false);
  const [revokingAdminEmail, setRevokingAdminEmail] = useState<string | null>(null);
  const [adminActionMsg, setAdminActionMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Users (usage/quota) State
  const [users, setUsers] = useState<any[]>([]);
  const [userSearch, setUserSearch] = useState('');
  const [usersLoading, setUsersLoading] = useState(false);

  // CTA submissions State
  const [ctas, setCtas] = useState<any[]>([]);
  const [ctaSearch, setCtaSearch] = useState('');
  const [ctasLoading, setCtasLoading] = useState(false);

  const [authModalOpen, setAuthModalOpen] = useState(false);

  // Fetch admin dashboard stats
  const fetchStats = async () => {
    if (!user?.email) return;
    try {
      setStatsLoading(true);
      const res = await fetch(`/api/admin/stats?email=${encodeURIComponent(user.email)}`, {
        headers: { 'x-user-email': user.email },
      });
      if (res.ok) {
        const data = await res.json();
        setStats(data.stats);
        setSystemHealth(data.systemHealth);
      }
    } catch (err) {
      console.error('Failed to load admin stats:', err);
    } finally {
      setStatsLoading(false);
    }
  };

  // Fetch all chatbots for admin
  const fetchBots = async () => {
    if (!user?.email) return;
    try {
      const res = await fetch(`/api/admin/bots?email=${encodeURIComponent(user.email)}`, {
        headers: { 'x-user-email': user.email },
      });
      if (res.ok) {
        const data = await res.json();
        setBots(data.bots || []);
      }
    } catch (err) {
      console.error('Failed to load bots for admin:', err);
    }
  };

  // Fetch form submissions
  const fetchSubmissions = async () => {
    if (!user?.email) return;
    try {
      const res = await fetch(`/api/admin/submissions?email=${encodeURIComponent(user.email)}`, {
        headers: { 'x-user-email': user.email },
      });
      if (res.ok) {
        const data = await res.json();
        setSubmissions(data.submissions || []);
      }
    } catch (err) {
      console.error('Failed to load submissions:', err);
    }
  };

  // Fetch detected forms
  const fetchForms = async () => {
    if (!user?.email) return;
    try {
      const res = await fetch(`/api/admin/forms?email=${encodeURIComponent(user.email)}`, {
        headers: { 'x-user-email': user.email },
      });
      if (res.ok) {
        const data = await res.json();
        setForms(data.forms || []);
      }
    } catch (err) {
      console.error('Failed to load forms:', err);
    }
  };

  // Fetch admins list
  const fetchAdmins = async () => {
    if (!user?.email) return;
    try {
      const res = await fetch('/api/admin/admins', {
        headers: { 'x-user-email': user.email },
      });
      if (res.ok) {
        const data = await res.json();
        setAdminsList(data.admins || []);
      }
    } catch (err) {
      console.error('Failed to load admins:', err);
    }
  };

  // Fetch all users with usage/quota
  const fetchUsers = async () => {
    if (!user?.email) return;
    setUsersLoading(true);
    try {
      const res = await fetch(`/api/admin/users?email=${encodeURIComponent(user.email)}`, {
        headers: { 'x-user-email': user.email },
      });
      if (res.ok) {
        const data = await res.json();
        setUsers(data.users || []);
      }
    } catch (err) {
      console.error('Failed to load users:', err);
    } finally {
      setUsersLoading(false);
    }
  };

  // Fetch CTA submissions
  const fetchCtas = async () => {
    if (!user?.email) return;
    setCtasLoading(true);
    try {
      const res = await fetch(`/api/admin/ctas?email=${encodeURIComponent(user.email)}`, {
        headers: { 'x-user-email': user.email },
      });
      if (res.ok) {
        const data = await res.json();
        setCtas(data.ctas || []);
      }
    } catch (err) {
      console.error('Failed to load CTAs:', err);
    } finally {
      setCtasLoading(false);
    }
  };

  useEffect(() => {
    if (isAdmin && user?.email) {
      fetchStats();
      fetchBots();
      fetchSubmissions();
      fetchForms();
      fetchAdmins();
      fetchUsers();
      fetchCtas();
    }
  }, [isAdmin, user?.email]);

  // Toggle Bot Active / Disabled status
  const handleToggleBotStatus = async (botId: string, currentStatus: string) => {
    if (!user?.email) return;
    const newStatus = currentStatus === 'disabled' ? 'active' : 'disabled';
    setTogglingBotId(botId);
    try {
      const res = await fetch('/api/admin/bots', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'x-user-email': user.email,
        },
        body: JSON.stringify({ botId, status: newStatus }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to update status');
      }
      setBots((prev) =>
        prev.map((b) => (b.id === botId ? { ...b, status: newStatus } : b))
      );
      fetchStats();
    } catch (err: any) {
      alert(err.message || 'Error updating status');
    } finally {
      setTogglingBotId(null);
    }
  };

  // Admin Delete Bot
  const handleDeleteBot = async (bot: any) => {
    if (!user?.email) return;
    if (
      !window.confirm(
        `[ADMIN ACTION] Permanently delete "${bot.name}"?\nThis removes the bot, its knowledge chunks, vector database points, detected forms, and leads.`
      )
    ) {
      return;
    }

    setDeletingBotId(bot.id);
    try {
      const res = await fetch(`/api/admin/bots?botId=${encodeURIComponent(bot.id)}`, {
        method: 'DELETE',
        headers: { 'x-user-email': user.email },
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to delete chatbot');
      }
      setBots((prev) => prev.filter((b) => b.id !== bot.id));
      fetchStats();
    } catch (err: any) {
      alert(err.message || 'Failed to delete bot');
    } finally {
      setDeletingBotId(null);
    }
  };

  // Super Admin: Add Admin User
  const handleAddAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.email || !newAdminEmail.trim()) return;

    setAddingAdmin(true);
    setAdminActionMsg(null);
    try {
      const res = await fetch('/api/admin/admins', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-email': user.email,
        },
        body: JSON.stringify({
          email: newAdminEmail.trim(),
          name: newAdminName.trim(),
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to add admin');
      }

      setAdminActionMsg({
        type: 'success',
        text: `Successfully granted admin access to ${newAdminEmail}!`,
      });
      setNewAdminEmail('');
      setNewAdminName('');
      fetchAdmins();
      fetchStats();
    } catch (err: any) {
      setAdminActionMsg({
        type: 'error',
        text: err.message || 'Failed to add admin',
      });
    } finally {
      setAddingAdmin(false);
    }
  };

  // Super Admin: Revoke Admin User
  const handleRevokeAdmin = async (email: string) => {
    if (!user?.email) return;
    if (
      !window.confirm(
        `Revoke administrator access for "${email}"?\nThey will immediately lose access to this admin panel.`
      )
    ) {
      return;
    }

    setRevokingAdminEmail(email);
    setAdminActionMsg(null);
    try {
      const res = await fetch(`/api/admin/admins?email=${encodeURIComponent(email)}`, {
        method: 'DELETE',
        headers: { 'x-user-email': user.email },
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to revoke admin');

      setAdminActionMsg({
        type: 'success',
        text: `Admin access revoked for ${email}`,
      });
      fetchAdmins();
      fetchStats();
    } catch (err: any) {
      setAdminActionMsg({
        type: 'error',
        text: err.message || 'Failed to revoke admin',
      });
    } finally {
      setRevokingAdminEmail(null);
    }
  };

  // Export submissions as CSV
  const handleExportCSV = () => {
    if (submissions.length === 0) return;
    const headers = ['ID', 'Chatbot', 'Site URL', 'Form Type', 'Created At', 'Status', 'Data Payload'];
    const rows = submissions.map((s) => [
      s.id,
      `"${s.botName.replace(/"/g, '""')}"`,
      `"${s.siteUrl.replace(/"/g, '""')}"`,
      s.formType,
      new Date(s.createdAt).toISOString(),
      s.status,
      `"${JSON.stringify(s.data).replace(/"/g, '""')}"`,
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `sitebot-leads-${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Filtered Bots
  const filteredBots = bots.filter((b) => {
    const matchesSearch =
      b.name.toLowerCase().includes(botSearch.toLowerCase()) ||
      b.siteUrl.toLowerCase().includes(botSearch.toLowerCase()) ||
      (b.ownerEmail && b.ownerEmail.toLowerCase().includes(botSearch.toLowerCase()));
    if (!matchesSearch) return false;
    if (botStatusFilter === 'active') return b.status !== 'disabled';
    if (botStatusFilter === 'disabled') return b.status === 'disabled';
    return true;
  });

  // Filtered Submissions
  const filteredSubmissions = submissions.filter((s) => {
    const matchesBot = selectedBotFilter === 'all' || s.botId === selectedBotFilter;
    if (!matchesBot) return false;
    if (!submissionSearch) return true;
    const str = `${s.botName} ${s.formType} ${JSON.stringify(s.data)}`.toLowerCase();
    return str.includes(submissionSearch.toLowerCase());
  });

  // 1. Loading State
  if (authLoading) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col">
        <Navbar />
        <div className="flex-1 flex items-center justify-center p-8">
          <div className="text-center space-y-3">
            <Loader2 className="w-8 h-8 animate-spin text-indigo-600 dark:text-indigo-400 mx-auto" />
            <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">
              Verifying administrative security credentials...
            </p>
          </div>
        </div>
      </div>
    );
  }

  // 2. Unauthenticated State
  if (!user) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col">
        <Navbar />
        <div className="flex-1 flex items-center justify-center p-6">
          <div className="w-full max-w-md p-8 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xl text-center space-y-5">
            <div className="w-14 h-14 rounded-2xl bg-rose-50 dark:bg-rose-950/60 border border-rose-100 dark:border-rose-900 flex items-center justify-center text-rose-600 dark:text-rose-400 mx-auto">
              <Lock className="w-7 h-7" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-900 dark:text-white font-heading">
                Admin Panel Protected
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1.5 leading-relaxed">
                Please sign in with your authorized Google Administrator account to access the SiteBot Studio management console.
              </p>
            </div>
            <button
              onClick={() => setAuthModalOpen(true)}
              className="w-full py-3 rounded-2xl bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-bold text-xs shadow-md shadow-indigo-600/25 hover:from-indigo-500 hover:to-purple-500 transition-all cursor-pointer"
            >
              Sign In with Google
            </button>
          </div>
        </div>
        <AuthModal
          isOpen={authModalOpen}
          onClose={() => setAuthModalOpen(false)}
          title="Admin Authentication"
          subtitle="Sign in with your Super Admin or Administrator account."
        />
      </div>
    );
  }

  // 3. Unauthorized State (Not an admin)
  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col">
        <Navbar />
        <div className="flex-1 flex items-center justify-center p-6">
          <div className="w-full max-w-md p-8 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xl text-center space-y-5">
            <div className="w-14 h-14 rounded-2xl bg-amber-50 dark:bg-amber-950/60 border border-amber-100 dark:border-amber-900 flex items-center justify-center text-amber-600 dark:text-amber-400 mx-auto">
              <Shield className="w-7 h-7" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-900 dark:text-white font-heading">
                403 — Administrator Access Required
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1.5 leading-relaxed">
                Your account (<strong className="text-slate-800 dark:text-slate-200">{user.email}</strong>) does not have administrator privileges.
              </p>
            </div>
            <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-800 text-left text-xs space-y-1.5 text-slate-600 dark:text-slate-300">
              <p className="font-semibold text-slate-900 dark:text-white">How to get access?</p>
              <p className="text-[11px] leading-relaxed">
                • Add this email to <code className="bg-slate-200 dark:bg-slate-700 px-1 py-0.5 rounded font-mono">SUPER_ADMIN_EMAILS</code> in your <code className="bg-slate-200 dark:bg-slate-700 px-1 py-0.5 rounded font-mono">.env</code> file.
              </p>
              <p className="text-[11px] leading-relaxed">
                • Or ask an existing Super Admin to add you through the Admin Management tab.
              </p>
            </div>
            <div className="flex gap-2">
              <Link
                href="/"
                className="flex-1 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-300 font-bold text-xs text-center transition-colors"
              >
                Go Home
              </Link>
              <button
                onClick={() => setAuthModalOpen(true)}
                className="flex-1 py-2.5 rounded-xl bg-indigo-600 text-white font-bold text-xs hover:bg-indigo-500 transition-colors cursor-pointer"
              >
                Switch Account
              </button>
            </div>
          </div>
        </div>
        <AuthModal
          isOpen={authModalOpen}
          onClose={() => setAuthModalOpen(false)}
          title="Switch Account"
        />
      </div>
    );
  }

  // 4. Authorized Admin Panel View
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col font-sans">
      <Navbar />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        {/* Top Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-slate-200/80 dark:border-slate-800">
          <div className="space-y-1">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-2xl bg-rose-600 flex items-center justify-center text-white shadow-md shadow-rose-600/30">
                <Shield className="w-5 h-5" />
              </div>
              <h1 className="text-2xl font-black tracking-tight text-slate-900 dark:text-white font-heading">
                Admin Control Center
              </h1>
              <span
                className={`text-[10px] font-extrabold uppercase px-2.5 py-0.5 rounded-full ${
                  isSuperAdmin
                    ? 'bg-rose-100 dark:bg-rose-900/60 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800'
                    : 'bg-purple-100 dark:bg-purple-900/60 text-purple-700 dark:text-purple-300'
                }`}
              >
                {isSuperAdmin ? 'Super Admin' : 'Admin'}
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Platform-wide telemetry, chatbot protection, leads monitoring, and administrator access control.
            </p>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-auto">
            <button
              onClick={() => {
                fetchStats();
                fetchBots();
                fetchSubmissions();
                fetchForms();
                fetchAdmins();
              }}
              title="Refresh Telemetry"
              className="p-2.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-indigo-400 hover:border-indigo-300 transition-all shadow-sm cursor-pointer"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
            <Link
              href="/create"
              className="flex items-center gap-1.5 px-4 py-2.5 text-xs font-bold rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white shadow-md shadow-indigo-600/25 transition-all"
            >
              <Plus className="w-4 h-4 stroke-[2.5]" />
              <span>New Chatbot</span>
            </Link>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex items-center gap-1.5 p-1 rounded-2xl bg-slate-200/60 dark:bg-slate-900/80 border border-slate-200/80 dark:border-slate-800 overflow-x-auto text-xs font-semibold">
          {[
            { id: 'overview', label: 'Overview & Health', icon: Activity },
            { id: 'bots', label: `Chatbots (${bots.length})`, icon: Bot },
            { id: 'submissions', label: `Captured Leads (${submissions.length})`, icon: Inbox },
            { id: 'ctas', label: `CTA Leads (${ctas.length})`, icon: Sparkles },
            { id: 'users', label: `Users & Quotas (${users.length})`, icon: Users },
            { id: 'forms', label: `Detected Forms (${forms.length})`, icon: FileText },
            { id: 'admins', label: `Admins & RBAC (${adminsList.length})`, icon: UserCheck },
          ].map((tab) => {
            const Icon = tab.icon;
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl transition-all whitespace-nowrap cursor-pointer ${
                  active
                    ? 'bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 shadow-sm font-bold'
                    : 'text-slate-600 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-300'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* ================= TAB 1: OVERVIEW ================= */}
        {activeTab === 'overview' && (
          <div className="space-y-6 animate-in fade-in duration-150">
            {/* Metric Stat Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3.5">
              {[
                {
                  label: 'Total Bots',
                  value: stats?.totalBots ?? '—',
                  sub: `${stats?.activeBots ?? 0} active • ${stats?.disabledBots ?? 0} paused`,
                  icon: Bot,
                  color: 'indigo',
                },
                {
                  label: 'Crawled Pages',
                  value: stats?.totalPages ?? '—',
                  sub: 'Across all websites',
                  icon: Globe,
                  color: 'emerald',
                },
                {
                  label: 'Vector Chunks',
                  value: stats?.totalChunks ?? '—',
                  sub: 'Embeddings indexed',
                  icon: Layers,
                  color: 'cyan',
                },
                {
                  label: 'Detected Forms',
                  value: stats?.totalForms ?? '—',
                  sub: 'Candidate actions',
                  icon: FileText,
                  color: 'amber',
                },
                {
                  label: 'Captured Leads',
                  value: stats?.totalSubmissions ?? '—',
                  sub: 'Conversational slots',
                  icon: Inbox,
                  color: 'purple',
                },
                {
                  label: 'Platform Admins',
                  value: stats?.totalAdmins ?? '—',
                  sub: isSuperAdmin ? 'Managed via RBAC' : 'Privileged accounts',
                  icon: Shield,
                  color: 'rose',
                },
              ].map((m, i) => {
                const Icon = m.icon;
                return (
                  <div
                    key={i}
                    className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-sm space-y-1.5"
                  >
                    <div className="flex items-center justify-between text-slate-400">
                      <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                        {m.label}
                      </span>
                      <Icon className="w-4 h-4 text-slate-400 dark:text-slate-500" />
                    </div>
                    <div className="text-2xl font-black tracking-tight text-slate-900 dark:text-white font-heading">
                      {m.value}
                    </div>
                    <p className="text-[10px] text-slate-400 dark:text-slate-500 truncate">
                      {m.sub}
                    </p>
                  </div>
                );
              })}
            </div>

            {/* System Status & Architecture Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {/* Database & Vector Status */}
              <div className="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-sm space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Database className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white font-heading">
                      Database & Vector Infrastructure
                    </h3>
                  </div>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400 font-bold border border-emerald-200 dark:border-emerald-800">
                    Online
                  </span>
                </div>

                <div className="space-y-3 text-xs">
                  <div className="flex items-center justify-between py-2 border-b border-slate-100 dark:border-slate-800/80">
                    <span className="text-slate-500 dark:text-slate-400">Database Driver:</span>
                    <span className="font-semibold text-slate-800 dark:text-slate-200">
                      {systemHealth?.database || 'Loading...'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between py-2 border-b border-slate-100 dark:border-slate-800/80">
                    <span className="text-slate-500 dark:text-slate-400">Vector Search Engine:</span>
                    <span className="font-semibold text-slate-800 dark:text-slate-200 font-mono">
                      {systemHealth?.vectorDatabase || 'Qdrant Cloud'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between py-2 border-b border-slate-100 dark:border-slate-800/80">
                    <span className="text-slate-500 dark:text-slate-400">Default Chat Provider:</span>
                    <span className="font-semibold text-slate-800 dark:text-slate-200 uppercase font-mono">
                      {systemHealth?.chatProvider || 'nvidia'} ({systemHealth?.chatModel || 'muse'})
                    </span>
                  </div>
                  <div className="flex items-center justify-between py-2">
                    <span className="text-slate-500 dark:text-slate-400">Super Admin Config:</span>
                    <span className="font-semibold text-slate-800 dark:text-slate-200 font-mono">
                      {systemHealth?.superAdminEmail || 'Configured via .env'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Security & Access Overview */}
              <div className="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-sm space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Shield className="w-4 h-4 text-rose-600 dark:text-rose-400" />
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white font-heading">
                      Security & Role-Based Access Control
                    </h3>
                  </div>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 font-bold border border-indigo-200 dark:border-indigo-800">
                    Firebase Protected
                  </span>
                </div>

                <div className="space-y-3 text-xs text-slate-600 dark:text-slate-300">
                  <p className="leading-relaxed">
                    Chatbot creation and studio access are strictly restricted to authenticated users. Only administrators designated in <code className="px-1 py-0.5 rounded bg-slate-100 dark:bg-slate-800 font-mono">SUPER_ADMIN_EMAILS</code> or added by Super Admins can access this panel.
                  </p>
                  <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/70 dark:border-slate-800 space-y-2">
                    <div className="flex items-center gap-2 text-slate-700 dark:text-slate-300 font-medium">
                      <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                      <span>Current User: <strong className="font-mono">{user.email}</strong></span>
                    </div>
                    <div className="flex items-center gap-2 text-slate-700 dark:text-slate-300 font-medium">
                      <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                      <span>Role Level: <strong className="uppercase">{role}</strong></span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Quick Actions Bar */}
            <div className="p-5 rounded-3xl bg-gradient-to-r from-indigo-900/90 to-purple-900/90 text-white flex flex-col sm:flex-row items-center justify-between gap-4 shadow-lg shadow-indigo-950/20">
              <div className="space-y-1 text-center sm:text-left">
                <h4 className="text-sm font-bold">Quick Administrative Tools</h4>
                <p className="text-xs text-indigo-200">
                  Manage bot lifecycle, export collected customer leads, or invite new administrative staff.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setActiveTab('bots')}
                  className="px-3.5 py-2 rounded-xl bg-white text-indigo-950 font-bold text-xs hover:bg-indigo-50 transition-colors cursor-pointer"
                >
                  Manage Bots
                </button>
                <button
                  onClick={() => setActiveTab('submissions')}
                  className="px-3.5 py-2 rounded-xl bg-indigo-700/80 hover:bg-indigo-700 text-white font-bold text-xs border border-indigo-400/30 transition-colors cursor-pointer"
                >
                  Export Leads
                </button>
                {isSuperAdmin && (
                  <button
                    onClick={() => setActiveTab('admins')}
                    className="px-3.5 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs shadow-md transition-colors cursor-pointer"
                  >
                    Add Admin
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ================= TAB: USERS & QUOTAS ================= */}
        {activeTab === 'users' && (
          <div className="space-y-4 animate-in fade-in duration-150">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-3.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-sm">
              <div className="relative w-full sm:w-80">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Search users by name, company, or email..."
                  value={userSearch}
                  onChange={(e) => setUserSearch(e.target.value)}
                  className="w-full pl-9 pr-3 py-1.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div className="flex items-center gap-2 w-full sm:w-auto">
                <span className="text-[11px] text-slate-400 font-semibold">{users.length} users</span>
                <button
                  onClick={() =>
                    window.open(`/api/admin/users?email=${encodeURIComponent(user?.email || '')}&export=csv`, '_blank')
                  }
                  className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-indigo-600 text-white text-xs font-bold hover:bg-indigo-500 transition-colors cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" /> Export All Users (CSV)
                </button>
              </div>
            </div>

            <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 overflow-hidden">
              <div className="p-5 border-b border-slate-200/80 dark:border-slate-800">
                <h3 className="text-sm font-bold text-slate-900 dark:text-white font-heading">
                  User-wise Analytics &amp; Quota Usage
                </h3>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  Token consumption, chat counts, leads, and remaining quota per account.
                </p>
              </div>

              {usersLoading ? (
                <div className="py-16 text-center">
                  <Loader2 className="w-6 h-6 animate-spin text-indigo-600 mx-auto" />
                </div>
              ) : users.length === 0 ? (
                <div className="py-16 text-center text-xs text-slate-400">
                  <Users className="w-10 h-10 mx-auto text-slate-300 dark:text-slate-600 mb-2" />
                  No user accounts yet. Profiles are auto-created on first sign-in or chat usage.
                </div>
              ) : (
                <div className="overflow-x-auto max-h-[70vh]">
                  <table className="w-full text-left">
                    <thead className="sticky top-0 bg-white dark:bg-slate-900">
                      <tr className="text-[10px] uppercase tracking-wider text-slate-400 border-b border-slate-200/80 dark:border-slate-800">
                        <th className="px-4 py-3 font-bold">User</th>
                        <th className="px-4 py-3 font-bold">Plan</th>
                        <th className="px-4 py-3 font-bold">Quota Used</th>
                        <th className="px-4 py-3 font-bold">Tokens (month)</th>
                        <th className="px-4 py-3 font-bold">Chats</th>
                        <th className="px-4 py-3 font-bold">Leads</th>
                        <th className="px-4 py-3 font-bold">Joined</th>
                      </tr>
                    </thead>
                    <tbody>
                      {users
                        .filter((u) => {
                          const q = userSearch.toLowerCase();
                          if (!q) return true;
                          return (
                            (u.email || '').toLowerCase().includes(q) ||
                            (u.name || '').toLowerCase().includes(q) ||
                            (u.companyName || '').toLowerCase().includes(q)
                          );
                        })
                        .map((u) => {
                          const qp = u.quotaPercent || { tokens: 0, chats: 0 };
                          return (
                            <tr key={u.email} className="border-b border-slate-100 dark:border-slate-800/60 hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                              <td className="px-4 py-3">
                                <p className="text-xs font-bold text-slate-900 dark:text-white truncate max-w-[180px]">
                                  {u.name || '—'}
                                </p>
                                <p className="text-[10px] text-slate-400 truncate max-w-[180px]">{u.email}</p>
                                {u.companyName && (
                                  <p className="text-[10px] text-indigo-500 dark:text-indigo-400 truncate max-w-[180px]">{u.companyName}</p>
                                )}
                              </td>
                              <td className="px-4 py-3">
                                <span className={`text-[10px] px-2 py-1 rounded-full font-extrabold uppercase ${
                                  u.plan === 'pro'
                                    ? 'bg-purple-100 dark:bg-purple-950 text-purple-700 dark:text-purple-300'
                                    : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400'
                                }`}>
                                  {u.plan === 'pro' ? 'Pro' : 'Free'}
                                </span>
                                <p className="text-[10px] text-slate-400 mt-1">{u.botLimit ?? 1} bot limit</p>
                              </td>
                              <td className="px-4 py-3 relative">
                                <div className="min-w-[120px]">
                                  <div className="flex items-center justify-between text-[10px] text-slate-500 dark:text-slate-400 mb-1">
                                    <span>Tokens</span>
                                    <span>{qp.tokens}%</span>
                                  </div>
                                  <div className="h-1.5 w-full rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                                    <div className={`h-full rounded-full ${qp.tokens >= 100 ? 'bg-rose-500' : 'bg-indigo-500'}`} style={{ width: `${Math.min(100, qp.tokens)}%` }} />
                                  </div>
                                  <div className="flex items-center justify-between text-[10px] text-slate-500 dark:text-slate-400 mt-1.5 mb-1">
                                    <span>Chats</span>
                                    <span>{qp.chats}%</span>
                                  </div>
                                  <div className="h-1.5 w-full rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                                    <div className={`h-full rounded-full ${qp.chats >= 100 ? 'bg-rose-500' : 'bg-emerald-500'}`} style={{ width: `${Math.min(100, qp.chats)}%` }} />
                                  </div>
                                </div>
                              </td>
                              <td className="px-4 py-3">
                                <p className="text-xs font-bold text-slate-800 dark:text-slate-100">
                                  {(u.usage?.monthTotalTokens ?? u.usage?.totalTokens ?? 0).toLocaleString()}
                                </p>
                                <p className="text-[10px] text-slate-400">/ {(u.tokenQuota ?? 0).toLocaleString()} quota</p>
                              </td>
                              <td className="px-4 py-3">
                                <p className="text-xs font-bold text-slate-800 dark:text-slate-100">
                                  {u.usage?.monthChats ?? u.usage?.chats ?? 0}
                                </p>
                                <p className="text-[10px] text-slate-400">this month</p>
                              </td>
                              <td className="px-4 py-3">
                                <p className="text-xs font-bold text-slate-800 dark:text-slate-100">
                                  {u.usage?.monthLeads ?? u.usage?.leads ?? 0}
                                </p>
                              </td>
                              <td className="px-4 py-3">
                                <p className="text-[11px] text-slate-400 whitespace-nowrap">
                                  {u.createdAt ? new Date(u.createdAt).toLocaleDateString() : '—'}
                                </p>
                              </td>
                            </tr>
                          );
                        })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ================= TAB: CTA SUBMISSIONS ================= */}
        {activeTab === 'ctas' && (
          <div className="space-y-4 animate-in fade-in duration-150">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-3.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-sm">
              <div className="relative w-full sm:w-80">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Search CTA leads by name, email, campaign..."
                  value={ctaSearch}
                  onChange={(e) => setCtaSearch(e.target.value)}
                  className="w-full pl-9 pr-3 py-1.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div className="flex items-center gap-2 w-full sm:w-auto">
                <span className="text-[11px] text-slate-400 font-semibold">{ctas.length} submissions</span>
                <button
                  onClick={() =>
                    window.open(`/api/admin/ctas?email=${encodeURIComponent(user?.email || '')}&export=csv`, '_blank')
                  }
                  className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-indigo-600 text-white text-xs font-bold hover:bg-indigo-500 transition-colors cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" /> Export CTAs (CSV)
                </button>
              </div>
            </div>

            <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 overflow-hidden">
              <div className="p-5 border-b border-slate-200/80 dark:border-slate-800">
                <h3 className="text-sm font-bold text-slate-900 dark:text-white font-heading">
                  Website CTA Form Submissions
                </h3>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  Leads captured through CTA lead-capture forms across the site, with campaign and source attribution.
                </p>
              </div>

              {ctasLoading ? (
                <div className="py-16 text-center">
                  <Loader2 className="w-6 h-6 animate-spin text-indigo-600 mx-auto" />
                </div>
              ) : ctas.length === 0 ? (
                <div className="py-16 text-center text-xs text-slate-400">
                  <Sparkles className="w-10 h-10 mx-auto text-slate-300 dark:text-slate-600 mb-2" />
                  No CTA submissions yet. They appear here whenever a visitor submits a lead form.
                </div>
              ) : (
                <div className="overflow-x-auto max-h-[70vh]">
                  <table className="w-full text-left">
                    <thead className="sticky top-0 bg-white dark:bg-slate-900">
                      <tr className="text-[10px] uppercase tracking-wider text-slate-400 border-b border-slate-200/80 dark:border-slate-800">
                        <th className="px-4 py-3 font-bold">Name / Contact</th>
                        <th className="px-4 py-3 font-bold">Campaign</th>
                        <th className="px-4 py-3 font-bold">Page</th>
                        <th className="px-4 py-3 font-bold">Message</th>
                        <th className="px-4 py-3 font-bold">Owner</th>
                        <th className="px-4 py-3 font-bold">Date</th>
                      </tr>
                    </thead>
                    <tbody>
                      {ctas
                        .filter((c) => {
                          const q = ctaSearch.toLowerCase();
                          if (!q) return true;
                          return (
                            (c.name || '').toLowerCase().includes(q) ||
                            (c.email || '').toLowerCase().includes(q) ||
                            (c.campaign || '').toLowerCase().includes(q) ||
                            (c.ownerEmail || '').toLowerCase().includes(q)
                          );
                        })
                        .map((c) => (
                          <tr key={c.id} className="border-b border-slate-100 dark:border-slate-800/60 hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                            <td className="px-4 py-3">
                              <p className="text-xs font-bold text-slate-900 dark:text-white">{c.name || 'Anonymous'}</p>
                              {c.email && <p className="text-[11px] text-slate-500 dark:text-slate-300 flex items-center gap-1"><Mail className="w-3 h-3 text-slate-400" />{c.email}</p>}
                              {c.phone && <p className="text-[11px] text-slate-500 dark:text-slate-300">{c.phone}</p>}
                            </td>
                            <td className="px-4 py-3">
                              <span className="text-[10px] px-2 py-1 rounded-full bg-purple-100 dark:bg-purple-950 text-purple-700 dark:text-purple-300 font-bold">
                                {c.campaign || 'default'}
                              </span>
                              <p className="text-[10px] text-slate-400 mt-1">{c.source || 'website_cta'}</p>
                            </td>
                            <td className="px-4 py-3">
                              <p className="text-[11px] text-slate-500 dark:text-slate-300 truncate max-w-[180px]">{c.page || c.botName || '—'}</p>
                            </td>
                            <td className="px-4 py-3">
                              <p className="text-[11px] text-slate-500 dark:text-slate-300 truncate max-w-[220px]">{c.message || '—'}</p>
                            </td>
                            <td className="px-4 py-3">
                              <p className="text-[11px] text-slate-600 dark:text-slate-300 truncate max-w-[160px]">{c.ownerEmail || '—'}</p>
                            </td>
                            <td className="px-4 py-3">
                              <p className="text-[11px] text-slate-400 whitespace-nowrap">
                                {new Date(c.createdAt).toLocaleString()}
                              </p>
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ================= TAB 2: CHATBOTS MANAGEMENT ================= */}
        {activeTab === 'bots' && (
          <div className="space-y-4 animate-in fade-in duration-150">
            {/* Search & Filter Bar */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-3.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-sm">
              <div className="relative w-full sm:w-80">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Search bots by name, domain, or owner..."
                  value={botSearch}
                  onChange={(e) => setBotSearch(e.target.value)}
                  className="w-full pl-9 pr-3 py-1.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="flex items-center gap-2 w-full sm:w-auto">
                <span className="text-xs text-slate-500 hidden sm:inline">Status:</span>
                <select
                  value={botStatusFilter}
                  onChange={(e: any) => setBotStatusFilter(e.target.value)}
                  className="px-3 py-1.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-semibold focus:outline-none"
                >
                  <option value="all">All Chatbots ({bots.length})</option>
                  <option value="active">Active Only</option>
                  <option value="disabled">Paused Only</option>
                </select>
              </div>
            </div>

            {/* Bots Table */}
            <div className="rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50/80 dark:bg-slate-800/60 border-b border-slate-200/80 dark:border-slate-800 text-slate-500 dark:text-slate-400 uppercase font-semibold text-[10px] tracking-wider">
                    <tr>
                      <th className="px-5 py-3.5">Chatbot</th>
                      <th className="px-4 py-3.5">Owner / Account</th>
                      <th className="px-4 py-3.5">Knowledge</th>
                      <th className="px-4 py-3.5">Model Engine</th>
                      <th className="px-4 py-3.5">Status</th>
                      <th className="px-4 py-3.5">Created</th>
                      <th className="px-5 py-3.5 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
                    {filteredBots.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="px-6 py-12 text-center text-slate-400">
                          <Bot className="w-8 h-8 mx-auto mb-2 opacity-50" />
                          <p>No chatbots found matching your criteria.</p>
                        </td>
                      </tr>
                    ) : (
                      filteredBots.map((b) => (
                        <tr
                          key={b.id}
                          className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors"
                        >
                          <td className="px-5 py-4">
                            <div className="flex items-center gap-3">
                              <span
                                className="w-3.5 h-3.5 rounded-full shrink-0 ring-2 ring-slate-200 dark:ring-slate-700"
                                style={{ backgroundColor: b.primaryColor || '#6366f1' }}
                              />
                              <div>
                                <Link
                                  href={`/bot/${b.id}`}
                                  className="font-bold text-slate-900 dark:text-white hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors truncate block max-w-[180px]"
                                >
                                  {b.name}
                                </Link>
                                <a
                                  href={b.siteUrl}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="text-[11px] text-slate-400 font-mono hover:underline truncate block max-w-[180px]"
                                >
                                  {b.siteUrl}
                                </a>
                              </div>
                            </div>
                          </td>

                          <td className="px-4 py-4 text-slate-600 dark:text-slate-300">
                            <span className="font-mono text-[11px]">
                              {b.ownerEmail || 'admin@sitebotstudio.com'}
                            </span>
                          </td>

                          <td className="px-4 py-4">
                            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-lg bg-indigo-50 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 text-[11px] font-bold font-mono">
                              {b.pagesCount}p • {b.chunksCount}ch
                            </span>
                          </td>

                          <td className="px-4 py-4 text-[11px] font-mono text-slate-500">
                            {b.chatModel?.split('/')[1] || b.chatModel || 'gpt-4o-mini'}
                          </td>

                          <td className="px-4 py-4">
                            {b.status === 'disabled' ? (
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300 text-[10px] font-extrabold">
                                Paused
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 text-[10px] font-extrabold">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                                Active
                              </span>
                            )}
                          </td>

                          <td className="px-4 py-4 text-[11px] text-slate-400">
                            {new Date(b.createdAt).toLocaleDateString()}
                          </td>

                          <td className="px-5 py-4 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              {/* Open in Studio */}
                              <Link
                                href={`/bot/${b.id}`}
                                title="Open in Studio"
                                className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                              >
                                <Sliders className="w-3.5 h-3.5" />
                              </Link>

                              {/* Open Sandbox Demo */}
                              <Link
                                href={`/demo/${b.id}`}
                                target="_blank"
                                title="Live Sandbox Demo"
                                className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                              >
                                <ExternalLink className="w-3.5 h-3.5" />
                              </Link>

                              {/* Toggle Status (Pause / Resume) */}
                              <button
                                onClick={() => handleToggleBotStatus(b.id, b.status)}
                                disabled={togglingBotId === b.id}
                                title={b.status === 'disabled' ? 'Resume Bot' : 'Pause Bot'}
                                className="p-1.5 rounded-lg text-slate-400 hover:text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950/40 transition-colors disabled:opacity-50 cursor-pointer"
                              >
                                {togglingBotId === b.id ? (
                                  <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-500" />
                                ) : b.status === 'disabled' ? (
                                  <PlayCircle className="w-3.5 h-3.5 text-emerald-600" />
                                ) : (
                                  <PauseCircle className="w-3.5 h-3.5" />
                                )}
                              </button>

                              {/* Delete Bot */}
                              <button
                                onClick={() => handleDeleteBot(b)}
                                disabled={deletingBotId === b.id}
                                title="Permanently Delete Chatbot"
                                className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors disabled:opacity-50 cursor-pointer"
                              >
                                {deletingBotId === b.id ? (
                                  <Loader2 className="w-3.5 h-3.5 animate-spin text-rose-500" />
                                ) : (
                                  <Trash2 className="w-3.5 h-3.5" />
                                )}
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ================= TAB 3: CAPTURED LEADS & SUBMISSIONS ================= */}
        {activeTab === 'submissions' && (
          <div className="space-y-4 animate-in fade-in duration-150">
            {/* Filter and Export Bar */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-3.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-sm">
              <div className="relative w-full sm:w-80">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Search leads by contact or field..."
                  value={submissionSearch}
                  onChange={(e) => setSubmissionSearch(e.target.value)}
                  className="w-full pl-9 pr-3 py-1.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="flex items-center gap-2 w-full sm:w-auto">
                <select
                  value={selectedBotFilter}
                  onChange={(e) => setSelectedBotFilter(e.target.value)}
                  className="px-3 py-1.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-semibold focus:outline-none"
                >
                  <option value="all">All Chatbots ({submissions.length} leads)</option>
                  {bots.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name}
                    </option>
                  ))}
                </select>

                <button
                  onClick={handleExportCSV}
                  disabled={submissions.length === 0}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-sm transition-all disabled:opacity-50 cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Export CSV</span>
                </button>
              </div>
            </div>

            {/* Submissions Table */}
            <div className="rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50/80 dark:bg-slate-800/60 border-b border-slate-200/80 dark:border-slate-800 text-slate-500 dark:text-slate-400 uppercase font-semibold text-[10px] tracking-wider">
                    <tr>
                      <th className="px-5 py-3.5">Chatbot</th>
                      <th className="px-4 py-3.5">Intent / Type</th>
                      <th className="px-4 py-3.5">Captured Data</th>
                      <th className="px-4 py-3.5">Status</th>
                      <th className="px-4 py-3.5">Timestamp</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
                    {filteredSubmissions.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="px-6 py-12 text-center text-slate-400">
                          <Inbox className="w-8 h-8 mx-auto mb-2 opacity-50" />
                          <p>No form submissions or leads captured yet.</p>
                        </td>
                      </tr>
                    ) : (
                      filteredSubmissions.map((s) => (
                        <tr
                          key={s.id}
                          className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors"
                        >
                          <td className="px-5 py-4">
                            <span className="font-bold text-slate-900 dark:text-white block">
                              {s.botName}
                            </span>
                            <span className="text-[11px] text-slate-400 font-mono">
                              {s.siteUrl}
                            </span>
                          </td>

                          <td className="px-4 py-4">
                            <span className="px-2 py-0.5 rounded-full bg-indigo-50 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 text-[10px] font-bold font-mono">
                              {s.formType}
                            </span>
                          </td>

                          <td className="px-4 py-4">
                            <div className="space-y-1 max-w-md">
                              {Object.entries(s.data || {}).map(([key, val]: any) => (
                                <div key={key} className="text-[11px]">
                                  <span className="text-slate-400 font-medium">{key}: </span>
                                  <span className="font-semibold text-slate-800 dark:text-slate-200">
                                    {String(val)}
                                  </span>
                                </div>
                              ))}
                            </div>
                          </td>

                          <td className="px-4 py-4">
                            <span
                              className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                s.status === 'completed'
                                  ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300'
                                  : 'bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300'
                              }`}
                            >
                              {s.status}
                            </span>
                          </td>

                          <td className="px-4 py-4 text-[11px] text-slate-400">
                            {new Date(s.createdAt).toLocaleString()}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ================= TAB 4: DETECTED FORMS ================= */}
        {activeTab === 'forms' && (
          <div className="space-y-4 animate-in fade-in duration-150">
            <div className="rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50/80 dark:bg-slate-800/60 border-b border-slate-200/80 dark:border-slate-800 text-slate-500 dark:text-slate-400 uppercase font-semibold text-[10px] tracking-wider">
                    <tr>
                      <th className="px-5 py-3.5">Chatbot</th>
                      <th className="px-4 py-3.5">Form Intent</th>
                      <th className="px-4 py-3.5">Target Web Page</th>
                      <th className="px-4 py-3.5">Fields Schema</th>
                      <th className="px-4 py-3.5">Submit Method</th>
                      <th className="px-4 py-3.5">Active</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
                    {forms.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="px-6 py-12 text-center text-slate-400">
                          <FileText className="w-8 h-8 mx-auto mb-2 opacity-50" />
                          <p>No forms detected across websites yet.</p>
                        </td>
                      </tr>
                    ) : (
                      forms.map((f) => (
                        <tr
                          key={f.id}
                          className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors"
                        >
                          <td className="px-5 py-4 font-bold text-slate-900 dark:text-white">
                            {f.botName}
                          </td>
                          <td className="px-4 py-4">
                            <span className="px-2 py-0.5 rounded-full bg-purple-50 dark:bg-purple-950 text-purple-700 dark:text-purple-300 text-[10px] font-bold font-mono">
                              {f.formType}
                            </span>
                          </td>
                          <td className="px-4 py-4 text-[11px] font-mono text-slate-500 truncate max-w-[200px]">
                            {f.targetUrl}
                          </td>
                          <td className="px-4 py-4">
                            <span className="text-slate-600 dark:text-slate-300 font-semibold">
                              {f.fieldsSchema?.length || 0} fields
                            </span>
                          </td>
                          <td className="px-4 py-4 text-[11px] font-mono text-slate-500">
                            {f.submitMethod || 'POST'}
                          </td>
                          <td className="px-4 py-4">
                            <span className="px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 text-[10px] font-bold">
                              {f.isActive ? 'Active' : 'Disabled'}
                            </span>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ================= TAB 5: ADMINS & RBAC ACCESS ================= */}
        {activeTab === 'admins' && (
          <div className="space-y-6 animate-in fade-in duration-150">
            {/* RBAC Rules Banner */}
            <div className="p-5 rounded-3xl bg-indigo-50/70 dark:bg-indigo-950/40 border border-indigo-200/80 dark:border-indigo-900 flex items-start gap-3.5 text-xs text-indigo-900 dark:text-indigo-200">
              <Shield className="w-5 h-5 text-indigo-600 dark:text-indigo-400 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <h4 className="font-bold">Admin Panel Access Control Architecture</h4>
                <p className="text-[11px] leading-relaxed text-indigo-700 dark:text-indigo-300">
                  • <strong>Super Admins:</strong> Configured via <code className="bg-indigo-100 dark:bg-indigo-900 px-1 py-0.2 rounded font-mono">SUPER_ADMIN_EMAILS</code> in your <code className="bg-indigo-100 dark:bg-indigo-900 px-1 py-0.2 rounded font-mono">.env</code>. Permanent and cannot be revoked through the UI.
                </p>
                <p className="text-[11px] leading-relaxed text-indigo-700 dark:text-indigo-300">
                  • <strong>Admins:</strong> Added by Super Admins only. Have full access to telemetry, chatbot monitoring, and captured leads, but cannot add other admins.
                </p>
              </div>
            </div>

            {/* Super Admin Add New Admin Form */}
            {isSuperAdmin ? (
              <div className="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-sm space-y-4">
                <div className="flex items-center gap-2">
                  <UserCheck className="w-4 h-4 text-rose-600 dark:text-rose-400" />
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white font-heading">
                    Add New Administrator
                  </h3>
                </div>

                {adminActionMsg && (
                  <div
                    className={`p-3 rounded-2xl text-xs flex items-center gap-2 ${
                      adminActionMsg.type === 'success'
                        ? 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
                        : 'bg-rose-50 dark:bg-rose-950/50 text-rose-800 dark:text-rose-300 border border-rose-200 dark:border-rose-800'
                    }`}
                  >
                    {adminActionMsg.type === 'success' ? (
                      <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
                    ) : (
                      <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
                    )}
                    <span>{adminActionMsg.text}</span>
                  </div>
                )}

                <form onSubmit={handleAddAdmin} className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-500 mb-1">
                      Admin Email *
                    </label>
                    <input
                      type="email"
                      required
                      placeholder="e.g. colleague@company.com"
                      value={newAdminEmail}
                      onChange={(e) => setNewAdminEmail(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs focus:ring-2 focus:ring-rose-500 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-500 mb-1">
                      Staff / Member Name
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Sarah Jenkins"
                      value={newAdminName}
                      onChange={(e) => setNewAdminName(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs focus:ring-2 focus:ring-rose-500 focus:outline-none"
                    />
                  </div>

                  <div className="flex items-end">
                    <button
                      type="submit"
                      disabled={addingAdmin}
                      className="w-full py-2 px-4 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs shadow-md shadow-rose-600/25 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                    >
                      {addingAdmin ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Plus className="w-4 h-4 stroke-[2.5]" />
                      )}
                      <span>Grant Admin Access</span>
                    </button>
                  </div>
                </form>
              </div>
            ) : (
              <div className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200/80 dark:border-amber-900 text-xs text-amber-800 dark:text-amber-300">
                You are viewing this as an <strong>Admin</strong>. Adding or revoking other administrators requires <strong>Super Admin</strong> privileges.
              </div>
            )}

            {/* Administrators Table */}
            <div className="rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50/80 dark:bg-slate-800/60 border-b border-slate-200/80 dark:border-slate-800 text-slate-500 dark:text-slate-400 uppercase font-semibold text-[10px] tracking-wider">
                    <tr>
                      <th className="px-5 py-3.5">Administrator</th>
                      <th className="px-4 py-3.5">Role Tier</th>
                      <th className="px-4 py-3.5">Added By</th>
                      <th className="px-4 py-3.5">Added Date</th>
                      {isSuperAdmin && <th className="px-5 py-3.5 text-right">Action</th>}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
                    {adminsList.map((a, i) => (
                      <tr
                        key={i}
                        className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors"
                      >
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-2.5">
                            <div className="w-7 h-7 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center font-bold text-slate-700 dark:text-slate-200 text-xs">
                              {(a.name || a.email)[0].toUpperCase()}
                            </div>
                            <div>
                              <p className="font-bold text-slate-900 dark:text-white">
                                {a.name || 'Admin User'}
                              </p>
                              <p className="text-[11px] text-slate-400 font-mono">{a.email}</p>
                            </div>
                          </div>
                        </td>

                        <td className="px-4 py-4">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase ${
                              a.isEnv
                                ? 'bg-rose-100 dark:bg-rose-900/60 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800'
                                : 'bg-purple-100 dark:bg-purple-900/60 text-purple-700 dark:text-purple-300'
                            }`}
                          >
                            {a.isEnv ? 'Super Admin (Env)' : 'Admin (DB)'}
                          </span>
                        </td>

                        <td className="px-4 py-4 text-[11px] font-mono text-slate-500">
                          {a.addedBy}
                        </td>

                        <td className="px-4 py-4 text-[11px] text-slate-400">
                          {new Date(a.createdAt).toLocaleDateString()}
                        </td>

                        {isSuperAdmin && (
                          <td className="px-5 py-4 text-right">
                            {a.isEnv ? (
                              <span className="text-[10px] text-slate-400 font-semibold italic">
                                Permanent
                              </span>
                            ) : (
                              <button
                                onClick={() => handleRevokeAdmin(a.email)}
                                disabled={revokingAdminEmail === a.email}
                                title="Revoke Admin Access"
                                className="px-2.5 py-1 rounded-lg text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 text-xs font-bold transition-colors disabled:opacity-50 cursor-pointer"
                              >
                                {revokingAdminEmail === a.email ? (
                                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                ) : (
                                  'Revoke'
                                )}
                              </button>
                            )}
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </main>
      <Footer />
    </div>
  );
}
