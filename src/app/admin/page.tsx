'use client';

import React, { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import Image from 'next/image';
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
  QrCode,
  LogOut,
  Headphones,
  Plus,
  RefreshCw,
  Download,
  Lock,
  ArrowRight,
  MousePointerClick,
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
  CreditCard,
  Sparkles,
  MessageSquare,
  Clock,
  TrendingUp,
  BarChart3,
  PieChart,
  Zap,
  Check,
  X,
  Eye,
  Server,
  HardDrive,
  DollarSign,
  Workflow,
  Send,
  Phone,
  Building2,
  ArrowUpRight,
} from 'lucide-react';
import { Navbar } from '@/components/Navbar';
import { Footer } from '@/components/Footer';
import { useAuth } from '@/lib/firebase/AuthContext';
import { AuthModal } from '@/components/AuthModal';

export default function AdminPanelPage() {
  const router = useRouter();
  const { user, role, isAdmin, isSuperAdmin, loading: authLoading } = useAuth();

  const [activeTab, setActiveTab] = useState<
    | 'overview'
    | 'analytics'
    | 'conversations'
    | 'bots'
    | 'users'
    | 'leads'
    | 'whatsapp'
    | 'activity'
    | 'admins'
    | 'settings'
  >('overview');

  // Real-time clock & telemetry state
  const [currentTime, setCurrentTime] = useState<string>('');
  const [refreshingAll, setRefreshingAll] = useState(false);

  // Settings State (Plans, Models, Quotas)
  const [settings, setSettings] = useState<any>({
    defaultChatProvider: 'nvidia',
    defaultChatModel: 'meta/muse-glimmer-30b',
    defaultEmbedProvider: 'nvidia',
    defaultEmbedModel: 'nvidia/llama-nemotron-embed-vl-1b-v2',
    freePlan: { botLimit: 1, tokenQuota: 25000, chatQuota: 50, monthlyPrice: 0 },
    proPlan: { botLimit: 10, tokenQuota: 2500000, chatQuota: 50000, monthlyPrice: 9 },
    byokBypassQuota: true,
  });
  const [loadingSettings, setLoadingSettings] = useState(false);
  const [savingSettings, setSavingSettings] = useState(false);
  const [settingsMsg, setSettingsMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

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

  // Leads State (Submissions + CTAs)
  const [submissions, setSubmissions] = useState<any[]>([]);
  const [ctas, setCtas] = useState<any[]>([]);
  const [leadTypeFilter, setLeadTypeFilter] = useState<'all' | 'forms' | 'ctas'>('all');
  const [leadSearch, setLeadSearch] = useState('');
  const [leadsLoading, setLeadsLoading] = useState(false);

  // Forms State
  const [forms, setForms] = useState<any[]>([]);

  // Admins State
  const [adminsList, setAdminsList] = useState<any[]>([]);
  const [newAdminEmail, setNewAdminEmail] = useState('');
  const [newAdminName, setNewAdminName] = useState('');
  const [addingAdmin, setAddingAdmin] = useState(false);
  const [revokingAdminEmail, setRevokingAdminEmail] = useState<string | null>(null);
  const [adminActionMsg, setAdminActionMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Users State
  const [users, setUsers] = useState<any[]>([]);
  const [userSearch, setUserSearch] = useState('');
  const [userPlanFilter, setUserPlanFilter] = useState<'all' | 'free' | 'pro'>('all');
  const [usersLoading, setUsersLoading] = useState(false);
  const [modifyingUserEmail, setModifyingUserEmail] = useState<string | null>(null);

  // Live Conversations State
  const [conversations, setConversations] = useState<any[]>([]);
  const [convSearch, setConvSearch] = useState('');
  const [convStatusFilter, setConvStatusFilter] = useState<string>('all');
  const [conversationsLoading, setConversationsLoading] = useState(false);
  const [selectedConversation, setSelectedConversation] = useState<any | null>(null);

  // Live Activity & Audit Stream State
  const [activityEvents, setActivityEvents] = useState<any[]>([]);
  const [activityCategory, setActivityCategory] = useState<string>('all');
  const [activitySearch, setActivitySearch] = useState('');
  const [activityLoading, setActivityLoading] = useState(false);

  const [authModalOpen, setAuthModalOpen] = useState(false);

  // WhatsApp Gateway & Live Relay State
  const [waStatus, setWaStatus] = useState<any>({
    status: 'disconnected',
    qrCode: '',
    phoneNumber: '',
    pushName: '',
    openTickets: 0,
  });
  const [waTickets, setWaTickets] = useState<any[]>([]);
  const [waConnecting, setWaConnecting] = useState(false);
  const [waLoggingOut, setWaLoggingOut] = useState(false);
  const [waActionMsg, setWaActionMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const fetchWaStatus = async () => {
    if (!user?.email) return;
    try {
      const res = await fetch('/api/admin/whatsapp/status', {
        headers: { 'x-user-email': user.email },
      });
      if (res.ok) {
        const data = await res.json();
        setWaStatus(data);
      }
    } catch {
      // non-fatal
    }
  };

  const fetchWaTickets = async () => {
    if (!user?.email) return;
    try {
      const res = await fetch('/api/admin/whatsapp/tickets', {
        headers: { 'x-user-email': user.email },
      });
      if (res.ok) {
        const data = await res.json();
        setWaTickets(data.tickets || []);
      }
    } catch {
      // non-fatal
    }
  };

  const handleWaConnect = async (forceNew = false) => {
    if (!user?.email) return;
    setWaConnecting(true);
    setWaActionMsg(null);
    try {
      const res = await fetch('/api/admin/whatsapp/connect', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-email': user.email,
        },
        body: JSON.stringify({ forceNew }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to start WhatsApp pairing');
      setWaStatus((prev: any) => ({
        ...prev,
        status: data.status,
        qrCode: data.qrCode || prev.qrCode,
        phoneNumber: data.phoneNumber || prev.phoneNumber,
      }));
      setWaActionMsg({ type: 'success', text: 'WhatsApp pairing started. Scan the QR code below.' });
    } catch (err: any) {
      setWaActionMsg({ type: 'error', text: err.message || 'Failed to connect' });
    } finally {
      setWaConnecting(false);
    }
  };

  const handleWaLogout = async () => {
    if (!user?.email) return;
    if (!window.confirm('Disconnect WhatsApp and clear saved MongoDB auth session?')) return;
    setWaLoggingOut(true);
    setWaActionMsg(null);
    try {
      const res = await fetch('/api/admin/whatsapp/logout', {
        method: 'POST',
        headers: { 'x-user-email': user.email },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to logout');
      setWaStatus({ status: 'disconnected', qrCode: '', phoneNumber: '', openTickets: 0 });
      setWaActionMsg({ type: 'success', text: 'WhatsApp disconnected and session removed.' });
    } catch (err: any) {
      setWaActionMsg({ type: 'error', text: err.message || 'Logout failed' });
    } finally {
      setWaLoggingOut(false);
    }
  };

  // Clock ticker
  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setCurrentTime(
        now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true }) +
          ' UTC ' +
          (now.getTimezoneOffset() <= 0 ? '+' : '-') +
          Math.abs(Math.floor(now.getTimezoneOffset() / 60))
      );
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

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
    setLeadsLoading(true);
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
      setLeadsLoading(false);
    }
  };

  // Fetch live conversations
  const fetchConversations = async () => {
    if (!user?.email) return;
    setConversationsLoading(true);
    try {
      const res = await fetch(`/api/admin/conversations?email=${encodeURIComponent(user.email)}&limit=100`, {
        headers: { 'x-user-email': user.email },
      });
      if (res.ok) {
        const data = await res.json();
        setConversations(data.conversations || []);
      }
    } catch (err) {
      console.error('Failed to load conversations:', err);
    } finally {
      setConversationsLoading(false);
    }
  };

  // Fetch real-time activity feed
  const fetchActivity = async () => {
    if (!user?.email) return;
    setActivityLoading(true);
    try {
      const res = await fetch(`/api/admin/activity?email=${encodeURIComponent(user.email)}&limit=100`, {
        headers: { 'x-user-email': user.email },
      });
      if (res.ok) {
        const data = await res.json();
        setActivityEvents(data.events || []);
      }
    } catch (err) {
      console.error('Failed to load activity stream:', err);
    } finally {
      setActivityLoading(false);
    }
  };

  const fetchSettings = async () => {
    if (!user?.email) return;
    setLoadingSettings(true);
    try {
      const res = await fetch(`/api/admin/settings?email=${encodeURIComponent(user.email)}`, {
        headers: { 'x-user-email': user.email },
      });
      if (res.ok) {
        const data = await res.json();
        if (data.settings) {
          setSettings(data.settings);
        }
      }
    } catch (err) {
      console.error('Failed to load settings:', err);
    } finally {
      setLoadingSettings(false);
    }
  };

  // Refresh All Telemetry
  const refreshAll = async () => {
    setRefreshingAll(true);
    await Promise.all([
      fetchStats(),
      fetchBots(),
      fetchSubmissions(),
      fetchForms(),
      fetchAdmins(),
      fetchUsers(),
      fetchCtas(),
      fetchConversations(),
      fetchActivity(),
      fetchSettings(),
      fetchWaStatus(),
      fetchWaTickets(),
    ]);
    setRefreshingAll(false);
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.email) return;
    setSavingSettings(true);
    setSettingsMsg(null);
    try {
      const res = await fetch(`/api/admin/settings?email=${encodeURIComponent(user.email)}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'x-user-email': user.email,
        },
        body: JSON.stringify(settings),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to save settings');
      }
      setSettingsMsg({ type: 'success', text: 'Platform AI models and plan quotas saved successfully!' });
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err: any) {
      setSettingsMsg({ type: 'error', text: err.message || 'Error saving settings' });
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } finally {
      setSavingSettings(false);
    }
  };

  useEffect(() => {
    if (isAdmin && user?.email) {
      refreshAll();
    }
  }, [isAdmin, user?.email]);

  // Smooth scroll to top whenever admin tab changes
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [activeTab]);

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
      fetchActivity();
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
      fetchActivity();
    } catch (err: any) {
      alert(err.message || 'Failed to delete bot');
    } finally {
      setDeletingBotId(null);
    }
  };

  // Admin Change User Plan (Free <-> Pro)
  const handleChangeUserPlan = async (targetEmail: string, newPlan: 'free' | 'pro') => {
    if (!user?.email) return;
    setModifyingUserEmail(targetEmail);
    try {
      const res = await fetch('/api/admin/users', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'x-user-email': user.email,
        },
        body: JSON.stringify({ email: targetEmail, plan: newPlan }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to change plan');
      }
      setUsers((prev) =>
        prev.map((u) => (u.email === targetEmail ? { ...u, plan: newPlan } : u))
      );
      fetchStats();
      fetchActivity();
    } catch (err: any) {
      alert(err.message || 'Failed to update user plan');
    } finally {
      setModifyingUserEmail(null);
    }
  };

  // Admin Reset User Usage
  const handleResetUserUsage = async (targetEmail: string) => {
    if (!user?.email) return;
    if (!window.confirm(`Reset monthly token & message usage for ${targetEmail}?`)) return;
    setModifyingUserEmail(targetEmail);
    try {
      const res = await fetch('/api/admin/users', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'x-user-email': user.email,
        },
        body: JSON.stringify({ email: targetEmail, resetUsage: true }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to reset usage');
      }
      setUsers((prev) =>
        prev.map((u) =>
          u.email === targetEmail
            ? { ...u, usage: { ...u.usage, inputTokens: 0, outputTokens: 0, chats: 0 } }
            : u
        )
      );
      fetchStats();
    } catch (err: any) {
      alert(err.message || 'Failed to reset usage');
    } finally {
      setModifyingUserEmail(null);
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
      fetchActivity();
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
      fetchActivity();
    } catch (err: any) {
      setAdminActionMsg({
        type: 'error',
        text: err.message || 'Failed to revoke admin',
      });
    } finally {
      setRevokingAdminEmail(null);
    }
  };

  // Unified Leads List (Form Submissions + CTAs)
  const unifiedLeads = useMemo(() => {
    const list: any[] = [];
    for (const s of submissions) {
      list.push({
        id: s.id,
        type: 'Form Submission',
        sourceName: s.botName,
        sourceUrl: s.siteUrl,
        primaryContact: s.data?.email || s.data?.phone || s.data?.name || 'Visitor',
        data: s.data,
        createdAt: s.createdAt,
        status: s.status,
      });
    }
    for (const c of ctas) {
      list.push({
        id: c.id,
        type: 'CTA Click / Action',
        sourceName: c.botName || 'Chatbot CTA',
        sourceUrl: c.siteUrl || c.campaign,
        primaryContact: c.email || c.phone || c.name || 'Visitor',
        data: { name: c.name, email: c.email, phone: c.phone, campaign: c.campaign },
        createdAt: c.createdAt,
        status: 'new',
      });
    }
    list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    return list;
  }, [submissions, ctas]);

  // Export Unified Leads as CSV
  const handleExportLeadsCSV = () => {
    if (unifiedLeads.length === 0) return;
    const headers = ['ID', 'Type', 'Chatbot', 'Site/Campaign', 'Primary Contact', 'Date', 'Full Payload'];
    const rows = unifiedLeads.map((l) => [
      l.id,
      l.type,
      `"${String(l.sourceName).replace(/"/g, '""')}"`,
      `"${String(l.sourceUrl).replace(/"/g, '""')}"`,
      `"${String(l.primaryContact).replace(/"/g, '""')}"`,
      new Date(l.createdAt).toISOString(),
      `"${JSON.stringify(l.data).replace(/"/g, '""')}"`,
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `sitebot-unified-leads-${new Date().toISOString().slice(0, 10)}.csv`);
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

  // Filtered Users
  const filteredUsers = users.filter((u) => {
    const matchesSearch =
      (u.name || '').toLowerCase().includes(userSearch.toLowerCase()) ||
      (u.email || '').toLowerCase().includes(userSearch.toLowerCase()) ||
      (u.companyName || '').toLowerCase().includes(userSearch.toLowerCase()) ||
      (u.occupation || '').toLowerCase().includes(userSearch.toLowerCase());
    if (!matchesSearch) return false;
    if (userPlanFilter === 'free') return u.plan !== 'pro';
    if (userPlanFilter === 'pro') return u.plan === 'pro';
    return true;
  });

  // Filtered Conversations
  const filteredConversations = conversations.filter((c) => {
    const matchesSearch =
      c.botName.toLowerCase().includes(convSearch.toLowerCase()) ||
      (c.visitor?.name || '').toLowerCase().includes(convSearch.toLowerCase()) ||
      (c.visitor?.email || '').toLowerCase().includes(convSearch.toLowerCase()) ||
      (c.lastMessage?.content || '').toLowerCase().includes(convSearch.toLowerCase());
    if (!matchesSearch) return false;
    if (convStatusFilter !== 'all' && c.status !== convStatusFilter) return false;
    return true;
  });

  // Filtered Activity
  const filteredActivity = activityEvents.filter((e) => {
    if (activityCategory !== 'all' && e.category !== activityCategory) return false;
    if (!activitySearch) return true;
    const q = activitySearch.toLowerCase();
    return (
      e.title.toLowerCase().includes(q) ||
      e.description.toLowerCase().includes(q) ||
      e.actor.toLowerCase().includes(q)
    );
  });

  // 1. Loading State
  if (authLoading) {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex flex-col overflow-x-hidden">
        <Navbar />
        <div className="flex-1 flex items-center justify-center p-8">
          <div className="text-center space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center mx-auto text-indigo-400">
              <Loader2 className="w-6 h-6 animate-spin" />
            </div>
            <p className="text-xs font-semibold text-slate-400">
              Authenticating privileged administrative environment...
            </p>
          </div>
        </div>
      </div>
    );
  }

  // 2. Unauthenticated State
  if (!user) {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex flex-col overflow-x-hidden">
        <Navbar />
        <div className="flex-1 flex items-center justify-center p-6">
          <div className="w-full max-w-md p-8 rounded-3xl bg-slate-900 border border-slate-800 shadow-2xl text-center space-y-5">
            <div className="w-14 h-14 rounded-2xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-400 mx-auto">
              <Lock className="w-7 h-7" />
            </div>
            <div>
              <h2 className="text-xl font-black font-heading text-white">
                Admin Center Protected
              </h2>
              <p className="text-xs text-slate-400 mt-2 leading-relaxed">
                Please sign in with your authorized administrator account to access platform metrics, chatbots, and settings.
              </p>
            </div>
            <button
              onClick={() => setAuthModalOpen(true)}
              className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-extrabold text-xs shadow-lg shadow-indigo-600/30 hover:scale-[1.02] transition-all cursor-pointer"
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
      <div className="min-h-screen bg-slate-950 text-white flex flex-col overflow-x-hidden">
        <Navbar />
        <div className="flex-1 flex items-center justify-center p-6">
          <div className="w-full max-w-md p-8 rounded-3xl bg-slate-900 border border-slate-800 shadow-2xl text-center space-y-5">
            <div className="w-14 h-14 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 mx-auto">
              <Shield className="w-7 h-7" />
            </div>
            <div>
              <h2 className="text-xl font-black font-heading text-white">
                403 — Unauthorized
              </h2>
              <p className="text-xs text-slate-400 mt-2 leading-relaxed">
                Your account (<span className="text-slate-200 font-mono font-bold">{user.email}</span>) does not have administrative rights.
              </p>
            </div>
            <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 text-left text-xs space-y-2 text-slate-400">
              <p className="font-bold text-slate-200">How to grant access:</p>
              <p className="text-[11px] leading-relaxed">
                • Add this email to <code className="bg-slate-800 text-indigo-300 px-1.5 py-0.5 rounded font-mono">SUPER_ADMIN_EMAIL</code> in your <code className="bg-slate-800 text-indigo-300 px-1.5 py-0.5 rounded font-mono">.env</code>.
              </p>
              <p className="text-[11px] leading-relaxed">
                • Or ask an existing administrator to invite you via the Admin RBAC tab.
              </p>
            </div>
            <div className="flex gap-2.5">
              <Link
                href="/"
                className="flex-1 py-3 rounded-2xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs text-center transition-colors"
              >
                Go Home
              </Link>
              <button
                onClick={() => setAuthModalOpen(true)}
                className="flex-1 py-3 rounded-2xl bg-indigo-600 text-white font-bold text-xs hover:bg-indigo-500 transition-colors cursor-pointer"
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

  // 4. Authorized Admin Panel View (PREMIUM COMMAND CENTER)
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-indigo-500 selection:text-white overflow-x-hidden w-full max-w-full">
      <Navbar />

      {/* Premium Glassmorphic Top Command Bar */}
      <div className="border-b border-slate-800/80 bg-slate-900/50 backdrop-blur-xl sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 sm:py-3.5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 sm:gap-3 min-w-0 w-full sm:w-auto">
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-2xl bg-gradient-to-tr from-rose-600 via-indigo-600 to-purple-600 p-[1px] shadow-lg shadow-indigo-600/20 shrink-0">
              <div className="w-full h-full bg-slate-950 rounded-[15px] flex items-center justify-center text-white">
                <Shield className="w-4 h-4 sm:w-5 sm:h-5 text-indigo-400" />
              </div>
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-sm sm:text-lg font-black tracking-tight text-white font-heading truncate">
                  Rivafy Studio Command Center
                </h1>
                <span
                  className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full whitespace-nowrap ${
                    isSuperAdmin
                      ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                      : 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
                  }`}
                >
                  {isSuperAdmin ? 'Super Admin' : 'Admin'}
                </span>
              </div>
              <div className="flex items-center gap-2 text-[10px] sm:text-[11px] text-slate-400">
                <span className="flex items-center gap-1.5 text-emerald-400 font-semibold whitespace-nowrap">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                  </span>
                  LIVE TELEMETRY
                </span>
                <span>•</span>
                <span className="font-mono text-slate-400 truncate">{currentTime || 'ONLINE'}</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-3 w-full sm:w-auto justify-end border-t sm:border-t-0 pt-2 sm:pt-0 border-slate-800/80">
            <button
              onClick={refreshAll}
              disabled={refreshingAll}
              title="Refresh All Telemetry"
              className="p-2 sm:p-2.5 rounded-xl bg-slate-800/80 hover:bg-slate-700/80 border border-slate-700 text-slate-300 hover:text-white transition-all shadow-sm cursor-pointer disabled:opacity-50 shrink-0"
            >
              <RefreshCw className={`w-3.5 h-3.5 sm:w-4 sm:h-4 ${refreshingAll ? 'animate-spin text-indigo-400' : ''}`} />
            </button>

            <button
              onClick={handleExportLeadsCSV}
              title="Export Full Leads Database"
              className="hidden sm:inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-slate-800/80 hover:bg-slate-700/80 border border-slate-700 text-xs font-bold text-slate-300 hover:text-white transition-all cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export Leads</span>
            </button>

            <Link
              href="/create"
              className="flex-1 sm:flex-initial text-center inline-flex items-center justify-center gap-1.5 px-3.5 sm:px-4 py-2 sm:py-2.5 text-xs font-extrabold rounded-xl bg-gradient-to-r from-indigo-600 via-purple-600 to-rose-600 hover:scale-105 text-white shadow-lg shadow-indigo-600/25 transition-all"
            >
              <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
              <span>Deploy Chatbot</span>
            </Link>
          </div>
        </div>
      </div>

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-5 sm:py-8 space-y-7 overflow-x-hidden">
        {/* Navigation Tabs Bar */}
        <div className="flex w-full items-center gap-1.5 p-1.5 rounded-2xl bg-slate-900/90 border border-slate-800 overflow-x-auto text-xs font-semibold -mx-4 px-4 sm:mx-0 sm:px-1.5 touch-pan-x">
          {[
            { id: 'overview', label: 'Executive Overview', icon: Activity },
            { id: 'analytics', label: 'Telemetry & Usage', icon: BarChart3 },
            { id: 'conversations', label: `Live Chats (${conversations.length})`, icon: MessageSquare },
            { id: 'bots', label: `Chatbots (${bots.length})`, icon: Bot },
            { id: 'users', label: `Users & Quotas (${users.length})`, icon: Users },
            { id: 'leads', label: `Leads & CRM (${unifiedLeads.length})`, icon: Inbox },
            { id: 'activity', label: `Audit Stream (${activityEvents.length})`, icon: Clock },
            { id: 'admins', label: `RBAC Staff (${adminsList.length})`, icon: UserCheck },
            {
              id: 'whatsapp',
              label: `WhatsApp Live Hub ${waStatus.openTickets ? `(${waStatus.openTickets})` : ''}`,
              icon: Phone,
            },
            { id: 'settings', label: 'Platform Engine Settings', icon: Sliders },
          ].map((tab) => {
            const Icon = tab.icon;
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex shrink-0 items-center gap-2 px-3.5 sm:px-4 py-2 sm:py-2.5 rounded-xl transition-all whitespace-nowrap cursor-pointer ${
                  active
                    ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-md font-bold'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
                }`}
              >
                <Icon className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* ========================================================
            TAB 1: EXECUTIVE OVERVIEW
            ======================================================== */}
        {activeTab === 'overview' && (
          <div className="space-y-7 animate-in fade-in duration-200">
            {/* Top Tier Metric Cards */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2.5 sm:gap-3.5">
              {/* Users */}
              <div className="p-3.5 sm:p-5 rounded-2xl sm:rounded-3xl bg-slate-900/70 border border-slate-800/80 relative overflow-hidden group hover:border-indigo-500/40 transition-all flex flex-col justify-between">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 truncate">Total Users</span>
                  <div className="w-7 h-7 rounded-xl bg-indigo-500/10 text-indigo-400 flex items-center justify-center shrink-0">
                    <Users className="w-4 h-4" />
                  </div>
                </div>
                <div className="mt-3">
                  <div className="text-xl sm:text-2xl font-black text-white font-heading truncate">
                    {stats?.totalUsers ?? '—'}
                  </div>
                  <div className="text-[10px] font-semibold text-emerald-400 mt-1 flex flex-wrap items-center gap-1">
                    <span>{stats?.proUsers ?? 0} Pro</span>
                    <span className="text-slate-500">•</span>
                    <span className="text-slate-400">{stats?.freeUsers ?? 0} Free</span>
                  </div>
                </div>
              </div>

              {/* Chatbots */}
              <div className="p-3.5 sm:p-5 rounded-2xl sm:rounded-3xl bg-slate-900/70 border border-slate-800/80 relative overflow-hidden group hover:border-emerald-500/40 transition-all flex flex-col justify-between">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 truncate">Chatbots</span>
                  <div className="w-7 h-7 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center shrink-0">
                    <Bot className="w-4 h-4" />
                  </div>
                </div>
                <div className="mt-3">
                  <div className="text-xl sm:text-2xl font-black text-white font-heading truncate">
                    {stats?.totalBots ?? '—'}
                  </div>
                  <div className="text-[10px] font-semibold text-slate-400 mt-1 flex flex-wrap items-center gap-1">
                    <span className="text-emerald-400">{stats?.activeBots ?? 0} active</span>
                    <span>• {stats?.disabledBots ?? 0} off</span>
                  </div>
                </div>
              </div>

              {/* Conversations */}
              <div className="p-3.5 sm:p-5 rounded-2xl sm:rounded-3xl bg-slate-900/70 border border-slate-800/80 relative overflow-hidden group hover:border-purple-500/40 transition-all flex flex-col justify-between">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 truncate">Conversations</span>
                  <div className="w-7 h-7 rounded-xl bg-purple-500/10 text-purple-400 flex items-center justify-center shrink-0">
                    <MessageSquare className="w-4 h-4" />
                  </div>
                </div>
                <div className="mt-3">
                  <div className="text-xl sm:text-2xl font-black text-white font-heading truncate">
                    {stats?.totalConversations ?? conversations.length}
                  </div>
                  <div className="text-[10px] font-semibold text-purple-400 mt-1 truncate">
                    <span>{stats?.activeConversations ?? 0} active</span>
                  </div>
                </div>
              </div>

              {/* Total Tokens */}
              <div className="p-3.5 sm:p-5 rounded-2xl sm:rounded-3xl bg-slate-900/70 border border-slate-800/80 relative overflow-hidden group hover:border-cyan-500/40 transition-all flex flex-col justify-between">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 truncate">Tokens Processed</span>
                  <div className="w-7 h-7 rounded-xl bg-cyan-500/10 text-cyan-400 flex items-center justify-center shrink-0">
                    <Zap className="w-4 h-4" />
                  </div>
                </div>
                <div className="mt-3">
                  <div className="text-xl sm:text-2xl font-black text-white font-heading truncate">
                    {stats?.totalTokensUsed
                      ? stats.totalTokensUsed > 1000000
                        ? `${(stats.totalTokensUsed / 1000000).toFixed(1)}M`
                        : `${(stats.totalTokensUsed / 1000).toFixed(0)}k`
                      : '0'}
                  </div>
                  <div className="text-[10px] font-semibold text-cyan-400 mt-1 truncate">
                    <span>Platform tokens</span>
                  </div>
                </div>
              </div>

              {/* Captured Leads */}
              <div className="p-3.5 sm:p-5 rounded-2xl sm:rounded-3xl bg-slate-900/70 border border-slate-800/80 relative overflow-hidden group hover:border-amber-500/40 transition-all flex flex-col justify-between">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 truncate">Captured Leads</span>
                  <div className="w-7 h-7 rounded-xl bg-amber-500/10 text-amber-400 flex items-center justify-center shrink-0">
                    <Inbox className="w-4 h-4" />
                  </div>
                </div>
                <div className="mt-3">
                  <div className="text-xl sm:text-2xl font-black text-white font-heading truncate">
                    {unifiedLeads.length}
                  </div>
                  <div className="text-[10px] font-semibold text-amber-400 mt-1 truncate">
                    <span>{submissions.length} forms • {ctas.length} CTAs</span>
                  </div>
                </div>
              </div>

              {/* MRR / Revenue */}
              <div className="p-3.5 sm:p-5 rounded-2xl sm:rounded-3xl bg-slate-900/70 border border-slate-800/80 relative overflow-hidden group hover:border-rose-500/40 transition-all flex flex-col justify-between">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 truncate">Estimated MRR</span>
                  <div className="w-7 h-7 rounded-xl bg-rose-500/10 text-rose-400 flex items-center justify-center shrink-0">
                    <DollarSign className="w-4 h-4" />
                  </div>
                </div>
                <div className="mt-3">
                  <div className="text-xl sm:text-2xl font-black text-emerald-400 font-heading truncate">
                    ${stats?.financials?.estimatedMRR ?? 0}
                  </div>
                  <div className="text-[10px] font-semibold text-slate-400 mt-1 truncate">
                    <span>ARR: ${(stats?.financials?.estimatedARR ?? 0).toLocaleString()}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* AI Providers & User Demographics Breakdown */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* AI Model Providers Breakdown */}
              <div className="p-4 sm:p-6 rounded-2xl sm:rounded-3xl bg-slate-900 border border-slate-800 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-xl bg-indigo-500/10 text-indigo-400 flex items-center justify-center shrink-0">
                      <PieChart className="w-4 h-4" />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-white">AI Provider Distribution</h3>
                      <p className="text-[11px] text-slate-400">Active engine powering chatbots</p>
                    </div>
                  </div>
                  <span className="text-[10px] font-bold text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded-full border border-indigo-500/20 whitespace-nowrap">
                    {stats?.totalBots ?? bots.length} Bots
                  </span>
                </div>

                <div className="space-y-3 pt-2">
                  {[
                    { label: 'OpenAI (GPT-4o & mini)', key: 'openai', color: 'bg-emerald-500' },
                    { label: 'Google Gemini', key: 'gemini', color: 'bg-indigo-500' },
                    { label: 'NVIDIA NIM', key: 'nvidia', color: 'bg-cyan-500' },
                    { label: 'OpenRouter / Open Source', key: 'openrouter', color: 'bg-purple-500' },
                  ].map((p) => {
                    const count = stats?.providers?.[p.key] ?? bots.filter((b) => (b.chatProvider || '').toLowerCase() === p.key).length;
                    const total = Math.max(1, stats?.totalBots ?? bots.length);
                    const pct = Math.round((count / total) * 100);
                    return (
                      <div key={p.key} className="space-y-1">
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-slate-300 font-semibold truncate mr-2">{p.label}</span>
                          <span className="text-slate-400 font-mono text-[11px] shrink-0">{count} ({pct}%)</span>
                        </div>
                        <div className="h-2 w-full bg-slate-800 rounded-full overflow-hidden">
                          <div className={`h-full ${p.color} rounded-full transition-all duration-500`} style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="pt-3 border-t border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-1 text-xs text-slate-400">
                  <span>BYOK (Custom Keys): <strong className="text-white">{stats?.byokBots ?? 0}</strong></span>
                  <span>Studio Managed: <strong className="text-white">{stats?.systemBots ?? bots.length}</strong></span>
                </div>
              </div>

              {/* User Roles & Occupation Breakdown */}
              <div className="p-4 sm:p-6 rounded-2xl sm:rounded-3xl bg-slate-900 border border-slate-800 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-xl bg-purple-500/10 text-purple-400 flex items-center justify-center shrink-0">
                      <BarChart3 className="w-4 h-4" />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-white">User Occupation &amp; Use-Cases</h3>
                      <p className="text-[11px] text-slate-400">Onboarding survey results</p>
                    </div>
                  </div>
                  <span className="text-[10px] font-bold text-purple-400 bg-purple-500/10 px-2 py-0.5 rounded-full border border-purple-500/20 whitespace-nowrap">
                    {stats?.onboardedUsers ?? 0} Profiled
                  </span>
                </div>

                <div className="space-y-3 pt-2">
                  {Object.entries(stats?.occupations || { Developer: 0, Student: 0, 'Business Owner': 0, 'Agency Owner': 0 }).map(
                    ([roleName, count]: [string, any]) => {
                      const total = Math.max(1, stats?.totalUsers ?? users.length);
                      const pct = Math.round(((count || 0) / total) * 100);
                      return (
                        <div key={roleName} className="space-y-1">
                          <div className="flex items-center justify-between text-xs">
                            <span className="text-slate-300 font-semibold truncate mr-2">{roleName}</span>
                            <span className="text-slate-400 font-mono text-[11px] shrink-0">{count} ({pct}%)</span>
                          </div>
                          <div className="h-2 w-full bg-slate-800 rounded-full overflow-hidden">
                            <div className="h-full bg-purple-500 rounded-full transition-all duration-500" style={{ width: `${pct}%` }} />
                          </div>
                        </div>
                      );
                    }
                  )}
                </div>

                <div className="pt-3 border-t border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-1 text-xs text-slate-400">
                  <span>Free Tier: <strong className="text-white">{stats?.freeUsers ?? 0}</strong></span>
                  <span>Pro Subscribers: <strong className="text-emerald-400">{stats?.proUsers ?? 0}</strong></span>
                </div>
              </div>

              {/* Infrastructure & Health Card */}
              <div className="p-4 sm:p-6 rounded-2xl sm:rounded-3xl bg-slate-900 border border-slate-800 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-xl bg-cyan-500/10 text-cyan-400 flex items-center justify-center shrink-0">
                      <Server className="w-4 h-4" />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-white">System Architecture</h3>
                      <p className="text-[11px] text-slate-400">Health &amp; cloud services</p>
                    </div>
                  </div>
                  <span className="text-[10px] font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20 whitespace-nowrap">
                    OPERATIONAL
                  </span>
                </div>

                <div className="space-y-2.5 pt-1 text-xs">
                  <div className="p-3 rounded-2xl bg-slate-950 border border-slate-800 flex items-center justify-between">
                    <span className="text-slate-400">Primary Database</span>
                    <span className="font-semibold text-slate-200">{systemHealth?.database || 'MongoDB Atlas'}</span>
                  </div>
                  <div className="p-3 rounded-2xl bg-slate-950 border border-slate-800 flex items-center justify-between">
                    <span className="text-slate-400">Vector Engine</span>
                    <span className="font-semibold text-indigo-400">{systemHealth?.vectorDatabase || 'Qdrant Cloud'}</span>
                  </div>
                  <div className="p-3 rounded-2xl bg-slate-950 border border-slate-800 flex items-center justify-between">
                    <span className="text-slate-400">Default AI Model</span>
                    <span className="font-mono text-slate-200">{systemHealth?.chatModel || 'gpt-4o-mini'}</span>
                  </div>
                  <div className="p-3 rounded-2xl bg-slate-950 border border-slate-800 flex items-center justify-between">
                    <span className="text-slate-400">PayPal Gateway</span>
                    <span className={systemHealth?.hasPaypalConfig ? 'text-emerald-400 font-bold' : 'text-amber-400'}>
                      {systemHealth?.hasPaypalConfig ? 'Configured (Live)' : 'Mock / Local'}
                    </span>
                  </div>
                </div>

                <div className="pt-2">
                  <button
                    onClick={() => setActiveTab('settings')}
                    className="w-full py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-bold text-slate-200 transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <Sliders className="w-3.5 h-3.5" />
                    <span>Manage Models &amp; Engine</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Quick Actions & Live Stream Snippet */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Quick Jump Grid */}
              <div className="p-4 sm:p-6 rounded-2xl sm:rounded-3xl bg-gradient-to-br from-indigo-950/60 via-slate-900 to-purple-950/60 border border-indigo-500/20 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <h3 className="text-sm font-extrabold text-white flex items-center gap-2">
                      <Zap className="w-4 h-4 text-indigo-400 shrink-0" />
                      <span>Administrative Tools &amp; Actions</span>
                    </h3>
                    <p className="text-xs text-slate-400">Direct shortcuts to platform control operations</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 sm:gap-3 pt-2">
                  <button
                    onClick={() => setActiveTab('conversations')}
                    className="p-3.5 rounded-2xl bg-slate-900/90 hover:bg-slate-800 border border-slate-800 hover:border-indigo-500/50 text-left transition-all group cursor-pointer"
                  >
                    <MessageSquare className="w-5 h-5 text-indigo-400 group-hover:scale-110 transition-transform mb-2" />
                    <div className="text-xs font-bold text-white">Live Chats</div>
                    <div className="text-[10px] text-slate-400 mt-0.5">Inspect user dialogues</div>
                  </button>

                  <button
                    onClick={() => setActiveTab('bots')}
                    className="p-3.5 rounded-2xl bg-slate-900/90 hover:bg-slate-800 border border-slate-800 hover:border-emerald-500/50 text-left transition-all group cursor-pointer"
                  >
                    <Bot className="w-5 h-5 text-emerald-400 group-hover:scale-110 transition-transform mb-2" />
                    <div className="text-xs font-bold text-white">Manage Fleet</div>
                    <div className="text-[10px] text-slate-400 mt-0.5">Pause, edit, or delete bots</div>
                  </button>

                  <button
                    onClick={() => setActiveTab('users')}
                    className="p-3.5 rounded-2xl bg-slate-900/90 hover:bg-slate-800 border border-slate-800 hover:border-purple-500/50 text-left transition-all group cursor-pointer"
                  >
                    <Users className="w-5 h-5 text-purple-400 group-hover:scale-110 transition-transform mb-2" />
                    <div className="text-xs font-bold text-white">User Accounts</div>
                    <div className="text-[10px] text-slate-400 mt-0.5">Adjust plans &amp; quotas</div>
                  </button>

                  <button
                    onClick={() => setActiveTab('leads')}
                    className="p-3.5 rounded-2xl bg-slate-900/90 hover:bg-slate-800 border border-slate-800 hover:border-amber-500/50 text-left transition-all group cursor-pointer"
                  >
                    <Inbox className="w-5 h-5 text-amber-400 group-hover:scale-110 transition-transform mb-2" />
                    <div className="text-xs font-bold text-white">CRM &amp; Leads</div>
                    <div className="text-[10px] text-slate-400 mt-0.5">Download customer data</div>
                  </button>
                </div>
              </div>

              {/* Recent Activity Teaser */}
              <div className="p-4 sm:p-6 rounded-2xl sm:rounded-3xl bg-slate-900 border border-slate-800 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4 text-slate-400 shrink-0" />
                    <h3 className="text-sm font-bold text-white">Recent Platform Activity</h3>
                  </div>
                  <button
                    onClick={() => setActiveTab('activity')}
                    className="text-xs font-bold text-indigo-400 hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    <span>View All</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div className="space-y-2.5 max-h-56 overflow-y-auto pr-1">
                  {activityEvents.slice(0, 5).map((e) => (
                    <div
                      key={e.id}
                      className="p-3 rounded-2xl bg-slate-950/70 border border-slate-800 flex items-start gap-3 text-xs"
                    >
                      <div className="w-2 h-2 rounded-full bg-indigo-500 shrink-0 mt-1.5" />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <h4 className="font-bold text-white truncate">{e.title}</h4>
                          <span className="text-[10px] text-slate-500 shrink-0 font-mono">
                            {new Date(e.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-400 truncate mt-0.5">{e.description}</p>
                      </div>
                    </div>
                  ))}
                  {activityEvents.length === 0 && (
                    <div className="text-center py-6 text-xs text-slate-500">
                      No activity events recorded yet.
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================
            TAB 2: TELEMETRY & ANALYTICS
            ======================================================== */}
        {activeTab === 'analytics' && (
          <div className="space-y-6 animate-in fade-in duration-150">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              <div className="p-6 rounded-3xl bg-slate-900 border border-slate-800 space-y-2">
                <span className="text-xs font-bold text-slate-400">Total Platform Messages</span>
                <div className="text-3xl font-black text-white font-heading">{stats?.totalChats || 0}</div>
                <p className="text-xs text-slate-500">Queries resolved by chatbot engine</p>
              </div>

              <div className="p-6 rounded-3xl bg-slate-900 border border-slate-800 space-y-2">
                <span className="text-xs font-bold text-slate-400">Indexed Knowledge Pages</span>
                <div className="text-3xl font-black text-emerald-400 font-heading">{stats?.totalPages || 0}</div>
                <p className="text-xs text-slate-500">{stats?.totalChunks || 0} high-dimensional vector chunks</p>
              </div>

              <div className="p-6 rounded-3xl bg-slate-900 border border-slate-800 space-y-2">
                <span className="text-xs font-bold text-slate-400">Platform Admins</span>
                <div className="text-3xl font-black text-purple-400 font-heading">{adminsList.length + (systemHealth?.superAdminConfigured ? 1 : 0)}</div>
                <p className="text-xs text-slate-500">Privileged personnel with RBAC access</p>
              </div>
            </div>

            {/* In-depth provider cards */}
            <div className="p-6 rounded-3xl bg-slate-900 border border-slate-800 space-y-5">
              <h3 className="text-base font-extrabold text-white">AI Engine Health &amp; Model Credentials</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {[
                  { name: 'Google Gemini', key: 'GEMINI_API_KEY', status: systemHealth?.hasGeminiKey, provider: 'gemini' },
                  { name: 'OpenAI', key: 'OPENAI_API_KEY', status: systemHealth?.hasOpenaiKey, provider: 'openai' },
                  { name: 'NVIDIA NIM', key: 'NVIDIA_API_KEY', status: systemHealth?.hasNvidiaKey, provider: 'nvidia' },
                  { name: 'OpenRouter', key: 'OPENROUTER_API_KEY', status: systemHealth?.hasOpenrouterKey, provider: 'openrouter' },
                ].map((item) => (
                  <div key={item.name} className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-xs text-white">{item.name}</span>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${item.status ? 'bg-emerald-500/20 text-emerald-400' : 'bg-rose-500/20 text-rose-400'}`}>
                        {item.status ? 'Configured' : 'Missing Key'}
                      </span>
                    </div>
                    <p className="text-[11px] font-mono text-slate-500">{item.key}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ========================================================
            TAB 3: LIVE CHATS & DIALOGUES INSPECTOR
            ======================================================== */}
        {activeTab === 'conversations' && (
          <div className="space-y-5 animate-in fade-in duration-150">
            {/* Filter and Search Bar */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 p-3.5 sm:p-4 rounded-2xl bg-slate-900 border border-slate-800">
              <div className="relative w-full sm:w-80">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Search chats by bot, visitor or message..."
                  value={convSearch}
                  onChange={(e) => setConvSearch(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="flex items-center gap-2 w-full sm:w-auto justify-between sm:justify-end">
                <select
                  value={convStatusFilter}
                  onChange={(e) => setConvStatusFilter(e.target.value)}
                  className="flex-1 sm:flex-initial px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-xs font-semibold text-white outline-none"
                >
                  <option value="all">All Statuses</option>
                  <option value="bot">Bot AI Active</option>
                  <option value="waiting_agent">Waiting for Agent</option>
                  <option value="agent_active">Agent Active</option>
                  <option value="resolved">Resolved</option>
                </select>

                <button
                  onClick={fetchConversations}
                  className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors shrink-0"
                  title="Refresh chats"
                >
                  <RefreshCw className={`w-4 h-4 ${conversationsLoading ? 'animate-spin text-indigo-400' : ''}`} />
                </button>
              </div>
            </div>

            {/* Conversations Table */}
            <div className="rounded-3xl bg-slate-900 border border-slate-800 overflow-hidden shadow-xl">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[700px] text-left text-xs">
                  <thead className="bg-slate-950/80 border-b border-slate-800 text-slate-400 uppercase font-semibold text-[10px] tracking-wider">
                    <tr>
                      <th className="px-5 py-4">Chatbot</th>
                      <th className="px-4 py-4">Visitor / Contact</th>
                      <th className="px-4 py-4">Status</th>
                      <th className="px-4 py-4">Messages</th>
                      <th className="px-4 py-4">Latest Message</th>
                      <th className="px-4 py-4">Time</th>
                      <th className="px-5 py-4 text-right">Inspect</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 font-medium">
                    {filteredConversations.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="px-6 py-12 text-center text-slate-500 text-xs">
                          {conversationsLoading ? 'Loading conversations...' : 'No conversations recorded yet.'}
                        </td>
                      </tr>
                    ) : (
                      filteredConversations.map((c) => (
                        <tr key={c.id} className="hover:bg-slate-800/40 transition-colors">
                          <td className="px-5 py-3.5">
                            <div className="flex items-center gap-2">
                              <Bot className="w-4 h-4 text-indigo-400 shrink-0" />
                              <span className="font-bold text-white truncate max-w-[150px]">{c.botName}</span>
                            </div>
                          </td>
                          <td className="px-4 py-3.5">
                            <div className="text-white font-semibold truncate max-w-[140px]">
                              {c.visitor?.name || 'Anonymous Visitor'}
                            </div>
                            {(c.visitor?.email || c.visitor?.phone) && (
                              <div className="text-[10px] text-slate-400 truncate max-w-[140px]">
                                {c.visitor.email || c.visitor.phone}
                              </div>
                            )}
                          </td>
                          <td className="px-4 py-3.5">
                            <span
                              className={`text-[9px] font-bold uppercase px-2 py-0.5 rounded-full ${
                                c.status === 'waiting_agent'
                                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                                  : c.status === 'agent_active'
                                  ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
                                  : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                              }`}
                            >
                              {c.status}
                            </span>
                          </td>
                          <td className="px-4 py-3.5 font-mono text-slate-400">{c.messagesCount} msgs</td>
                          <td className="px-4 py-3.5 text-slate-300 max-w-xs truncate">
                            {c.lastMessage?.content || '—'}
                          </td>
                          <td className="px-4 py-3.5 text-slate-400 font-mono text-[11px] whitespace-nowrap">
                            {new Date(c.lastMessageAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </td>
                          <td className="px-5 py-3.5 text-right">
                            <button
                              onClick={() => setSelectedConversation(c)}
                              className="px-3 py-1.5 rounded-xl bg-indigo-600/80 hover:bg-indigo-600 text-white font-bold text-xs transition-colors cursor-pointer inline-flex items-center gap-1"
                            >
                              <Eye className="w-3.5 h-3.5" />
                              <span>View</span>
                            </button>
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

        {/* ========================================================
            TAB 4: CHATBOTS FLEET MANAGEMENT
            ======================================================== */}
        {activeTab === 'bots' && (
          <div className="space-y-5 animate-in fade-in duration-150">
            {/* Filter and Search */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 p-3.5 sm:p-4 rounded-2xl bg-slate-900 border border-slate-800">
              <div className="relative w-full sm:w-80">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Search chatbots by name, URL, or owner..."
                  value={botSearch}
                  onChange={(e) => setBotSearch(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="flex items-center gap-2 w-full sm:w-auto">
                <select
                  value={botStatusFilter}
                  onChange={(e) => setBotStatusFilter(e.target.value as any)}
                  className="w-full sm:w-auto px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-xs font-semibold text-white outline-none"
                >
                  <option value="all">All Chatbots ({bots.length})</option>
                  <option value="active">Active Only</option>
                  <option value="disabled">Paused Only</option>
                </select>
              </div>
            </div>

            {/* Bots Table */}
            <div className="rounded-3xl bg-slate-900 border border-slate-800 overflow-hidden shadow-xl">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[780px] text-left text-xs">
                  <thead className="bg-slate-950/80 border-b border-slate-800 text-slate-400 uppercase font-semibold text-[10px] tracking-wider">
                    <tr>
                      <th className="px-5 py-4">Chatbot</th>
                      <th className="px-4 py-4">Target Website</th>
                      <th className="px-4 py-4">AI Model &amp; Provider</th>
                      <th className="px-4 py-4">Owner Account</th>
                      <th className="px-4 py-4">Knowledge</th>
                      <th className="px-4 py-4">Status</th>
                      <th className="px-5 py-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 font-medium">
                    {filteredBots.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="px-6 py-12 text-center text-slate-500 text-xs">
                          No chatbots matching your search filter.
                        </td>
                      </tr>
                    ) : (
                      filteredBots.map((b) => (
                        <tr key={b.id} className="hover:bg-slate-800/40 transition-colors">
                          <td className="px-5 py-3.5">
                            <div className="flex items-center gap-2.5">
                              <div
                                className="w-7 h-7 rounded-xl flex items-center justify-center text-white shrink-0"
                                style={{ backgroundColor: b.primaryColor || '#4f46e5' }}
                              >
                                <Bot className="w-3.5 h-3.5" />
                              </div>
                              <span className="font-bold text-white truncate max-w-[160px]">{b.name}</span>
                            </div>
                          </td>
                          <td className="px-4 py-3.5 text-slate-400 font-mono text-[11px] truncate max-w-[160px]">
                            <a href={b.siteUrl} target="_blank" rel="noreferrer" className="hover:underline hover:text-indigo-400 flex items-center gap-1">
                              <span>{b.siteUrl.replace(/^https?:\/\//, '')}</span>
                              <ArrowUpRight className="w-3 h-3 shrink-0" />
                            </a>
                          </td>
                          <td className="px-4 py-3.5">
                            <span className="font-semibold text-slate-300 uppercase text-[10px] px-1.5 py-0.5 rounded bg-slate-800 border border-slate-700">
                              {b.chatProvider}
                            </span>
                            <span className="text-slate-400 font-mono text-[10px] ml-1.5">{b.chatModel}</span>
                          </td>
                          <td className="px-4 py-3.5 text-slate-400 truncate max-w-[140px]">{b.ownerEmail || 'Unassigned'}</td>
                          <td className="px-4 py-3.5 text-slate-400 font-mono text-[11px]">
                            {b.pagesCount || 0} pgs • {b.chunksCount || 0} chunks
                          </td>
                          <td className="px-4 py-3.5">
                            <button
                              onClick={() => handleToggleBotStatus(b.id, b.status)}
                              disabled={togglingBotId === b.id}
                              className={`text-[9px] font-black uppercase px-2.5 py-1 rounded-full border transition-all cursor-pointer ${
                                b.status === 'disabled'
                                  ? 'bg-amber-500/20 text-amber-300 border-amber-500/30 hover:bg-emerald-500/20 hover:text-emerald-300'
                                  : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30 hover:bg-amber-500/20 hover:text-amber-300'
                              }`}
                            >
                              {b.status === 'disabled' ? 'Paused (Click to Enable)' : 'Active (Click to Pause)'}
                            </button>
                          </td>
                          <td className="px-5 py-3.5 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              <Link
                                href={`/bot/${b.id}`}
                                className="px-2.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs transition-colors"
                              >
                                Studio
                              </Link>
                              <Link
                                href={`/demo/${b.id}`}
                                target="_blank"
                                className="p-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors"
                                title="Open Live Sandbox Demo"
                              >
                                <ExternalLink className="w-3.5 h-3.5" />
                              </Link>
                              <button
                                onClick={() => handleDeleteBot(b)}
                                disabled={deletingBotId === b.id}
                                className="p-1.5 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 hover:text-rose-300 transition-colors cursor-pointer"
                                title="Delete bot"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
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

        {/* ========================================================
            TAB 5: USERS & QUOTA MANAGEMENT
            ======================================================== */}
        {activeTab === 'users' && (
          <div className="space-y-5 animate-in fade-in duration-150">
            {/* Filter bar */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 p-3.5 sm:p-4 rounded-2xl bg-slate-900 border border-slate-800">
              <div className="relative w-full sm:w-80">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Search users by name, email, company, role..."
                  value={userSearch}
                  onChange={(e) => setUserSearch(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="flex items-center gap-2 w-full sm:w-auto">
                <select
                  value={userPlanFilter}
                  onChange={(e) => setUserPlanFilter(e.target.value as any)}
                  className="w-full sm:w-auto px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-xs font-semibold text-white outline-none"
                >
                  <option value="all">All Plans ({users.length})</option>
                  <option value="free">Free Users</option>
                  <option value="pro">Pro Subscribers</option>
                </select>
              </div>
            </div>

            {/* Users Table */}
            <div className="rounded-3xl bg-slate-900 border border-slate-800 overflow-hidden shadow-xl">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[750px] text-left text-xs">
                  <thead className="bg-slate-950/80 border-b border-slate-800 text-slate-400 uppercase font-semibold text-[10px] tracking-wider">
                    <tr>
                      <th className="px-5 py-4">User</th>
                      <th className="px-4 py-4">Role / Occupation</th>
                      <th className="px-4 py-4">Company</th>
                      <th className="px-4 py-4">Plan</th>
                      <th className="px-4 py-4">Token Quota &amp; Usage</th>
                      <th className="px-4 py-4">Chats</th>
                      <th className="px-5 py-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 font-medium">
                    {filteredUsers.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="px-6 py-12 text-center text-slate-500 text-xs">
                          {usersLoading ? 'Loading users...' : 'No users matching your search.'}
                        </td>
                      </tr>
                    ) : (
                      filteredUsers.map((u) => {
                        const totalTokens = (u.usage?.inputTokens || 0) + (u.usage?.outputTokens || 0);
                        const quota = u.tokenQuota || 25000;
                        const pct = Math.min(100, Math.round((totalTokens / quota) * 100));

                        return (
                          <tr key={u.email} className="hover:bg-slate-800/40 transition-colors">
                            <td className="px-5 py-3.5">
                              <div className="font-bold text-white">{u.name || u.email.split('@')[0]}</div>
                              <div className="text-[11px] font-mono text-slate-400">{u.email}</div>
                            </td>
                            <td className="px-4 py-3.5">
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-800 text-indigo-300 border border-slate-700">
                                {u.occupation || 'User'}
                              </span>
                            </td>
                            <td className="px-4 py-3.5 text-slate-300">{u.companyName || '—'}</td>
                            <td className="px-4 py-3.5">
                              <span
                                className={`text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full ${
                                  u.plan === 'pro'
                                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                                    : 'bg-slate-800 text-slate-400 border border-slate-700'
                                }`}
                              >
                                {u.plan || 'free'}
                              </span>
                            </td>
                            <td className="px-4 py-3.5">
                              <div className="space-y-1 w-36">
                                <div className="flex justify-between text-[10px] font-mono text-slate-400">
                                  <span>{totalTokens.toLocaleString()}</span>
                                  <span>{quota.toLocaleString()} ({pct}%)</span>
                                </div>
                                <div className="h-1.5 w-full bg-slate-800 rounded-full overflow-hidden">
                                  <div
                                    className={`h-full rounded-full ${pct > 90 ? 'bg-rose-500' : pct > 70 ? 'bg-amber-500' : 'bg-indigo-500'}`}
                                    style={{ width: `${pct}%` }}
                                  />
                                </div>
                              </div>
                            </td>
                            <td className="px-4 py-3.5 font-mono text-slate-300">{u.usage?.chats || 0} chats</td>
                            <td className="px-5 py-3.5 text-right">
                              <div className="flex items-center justify-end gap-1.5">
                                <button
                                  onClick={() =>
                                    handleChangeUserPlan(u.email, u.plan === 'pro' ? 'free' : 'pro')
                                  }
                                  disabled={modifyingUserEmail === u.email}
                                  className="px-2.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs transition-colors cursor-pointer"
                                  title="Toggle Plan"
                                >
                                  {u.plan === 'pro' ? 'Downgrade' : 'Upgrade Pro'}
                                </button>
                                <button
                                  onClick={() => handleResetUserUsage(u.email)}
                                  disabled={modifyingUserEmail === u.email}
                                  className="p-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors cursor-pointer"
                                  title="Reset Quota Usage"
                                >
                                  <RefreshCw className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================
            TAB 6: UNIFIED LEADS & CRM HUB
            ======================================================== */}
        {activeTab === 'leads' && (
          <div className="space-y-5 animate-in fade-in duration-150">
            {/* Filter and Export Bar */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 p-3.5 sm:p-4 rounded-2xl bg-slate-900 border border-slate-800">
              <div className="relative w-full sm:w-80">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Search leads by contact info, campaign, bot..."
                  value={leadSearch}
                  onChange={(e) => setLeadSearch(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="flex items-center gap-2 w-full sm:w-auto justify-between sm:justify-end">
                <select
                  value={leadTypeFilter}
                  onChange={(e) => setLeadTypeFilter(e.target.value as any)}
                  className="flex-1 sm:flex-initial px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-xs font-semibold text-white outline-none"
                >
                  <option value="all">All Leads ({unifiedLeads.length})</option>
                  <option value="forms">Form Leads ({submissions.length})</option>
                  <option value="ctas">CTA Leads ({ctas.length})</option>
                </select>

                <button
                  onClick={handleExportLeadsCSV}
                  className="flex-1 sm:flex-initial justify-center px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download CSV</span>
                </button>
              </div>
            </div>

            {/* Leads Table */}
            <div className="rounded-3xl bg-slate-900 border border-slate-800 overflow-hidden shadow-xl">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[720px] text-left text-xs">
                  <thead className="bg-slate-950/80 border-b border-slate-800 text-slate-400 uppercase font-semibold text-[10px] tracking-wider">
                    <tr>
                      <th className="px-5 py-4">Source &amp; Type</th>
                      <th className="px-4 py-4">Primary Contact</th>
                      <th className="px-4 py-4">Captured Data Fields</th>
                      <th className="px-4 py-4">Date</th>
                      <th className="px-5 py-4 text-right">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 font-medium">
                    {unifiedLeads.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="px-6 py-12 text-center text-slate-500 text-xs">
                          {leadsLoading ? 'Loading leads...' : 'No leads collected yet.'}
                        </td>
                      </tr>
                    ) : (
                      unifiedLeads
                        .filter((l) => {
                          if (leadTypeFilter === 'forms' && l.type !== 'Form Submission') return false;
                          if (leadTypeFilter === 'ctas' && l.type !== 'CTA Click / Action') return false;
                          if (!leadSearch) return true;
                          const str = `${l.sourceName} ${l.primaryContact} ${JSON.stringify(l.data)}`.toLowerCase();
                          return str.includes(leadSearch.toLowerCase());
                        })
                        .map((l) => (
                          <tr key={l.id} className="hover:bg-slate-800/40 transition-colors">
                            <td className="px-5 py-3.5">
                              <div className="font-bold text-white">{l.sourceName}</div>
                              <div className="text-[10px] text-indigo-400 font-semibold">{l.type}</div>
                            </td>
                            <td className="px-4 py-3.5">
                              <span className="font-bold text-emerald-400">{l.primaryContact}</span>
                            </td>
                            <td className="px-4 py-3.5">
                              <div className="flex flex-wrap gap-1 max-w-md">
                                {Object.entries(l.data || {}).map(([k, v]) => (
                                  <span key={k} className="text-[10px] px-2 py-0.5 rounded bg-slate-800 border border-slate-700 text-slate-300">
                                    <strong className="text-slate-400">{k}:</strong> {String(v)}
                                  </span>
                                ))}
                              </div>
                            </td>
                            <td className="px-4 py-3.5 text-slate-400 font-mono text-[11px] whitespace-nowrap">
                              {new Date(l.createdAt).toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                            </td>
                            <td className="px-5 py-3.5 text-right">
                              <span className="text-[9px] font-bold uppercase px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                                captured
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

        {/* ========================================================
            TAB 7: LIVE ACTIVITY & AUDIT STREAM
            ======================================================== */}
        {activeTab === 'activity' && (
          <div className="space-y-5 animate-in fade-in duration-150">
            {/* Filter Bar */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 p-3.5 sm:p-4 rounded-2xl bg-slate-900 border border-slate-800">
              <div className="relative w-full sm:w-80">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Filter activity by keyword or actor..."
                  value={activitySearch}
                  onChange={(e) => setActivitySearch(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="flex items-center gap-1.5 flex-wrap">
                {['all', 'bot', 'user', 'lead', 'billing', 'chat', 'admin'].map((cat) => (
                  <button
                    key={cat}
                    onClick={() => setActivityCategory(cat)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold capitalize transition-all cursor-pointer ${
                      activityCategory === cat
                        ? 'bg-indigo-600 text-white'
                        : 'bg-slate-800 text-slate-400 hover:text-white'
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>

            {/* Events Timeline */}
            <div className="rounded-3xl bg-slate-900 border border-slate-800 p-4 sm:p-6 space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                <h3 className="text-sm font-extrabold text-white flex items-center gap-2">
                  <Clock className="w-4 h-4 text-indigo-400" />
                  <span>Real-time Event Audit Feed ({filteredActivity.length})</span>
                </h3>
                <button
                  onClick={fetchActivity}
                  className="text-xs font-bold text-indigo-400 hover:underline flex items-center gap-1 cursor-pointer"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Refresh Stream</span>
                </button>
              </div>

              <div className="space-y-3">
                {filteredActivity.length === 0 ? (
                  <div className="text-center py-12 text-xs text-slate-500">
                    No activity events matching your current filter.
                  </div>
                ) : (
                  filteredActivity.map((e) => (
                    <div
                      key={e.id}
                      className="p-4 rounded-2xl bg-slate-950/70 border border-slate-800/80 flex items-start gap-4 hover:border-slate-700 transition-colors"
                    >
                      <div className="w-9 h-9 rounded-xl bg-slate-800 flex items-center justify-center shrink-0 text-indigo-400 mt-0.5">
                        {e.category === 'bot' && <Bot className="w-4 h-4 text-emerald-400" />}
                        {e.category === 'user' && <Users className="w-4 h-4 text-indigo-400" />}
                        {e.category === 'lead' && <Inbox className="w-4 h-4 text-amber-400" />}
                        {e.category === 'billing' && <DollarSign className="w-4 h-4 text-emerald-400" />}
                        {e.category === 'chat' && <MessageSquare className="w-4 h-4 text-purple-400" />}
                        {e.category === 'admin' && <Shield className="w-4 h-4 text-rose-400" />}
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <h4 className="font-bold text-white text-xs">{e.title}</h4>
                          <span className="text-[10px] text-slate-500 font-mono shrink-0">
                            {new Date(e.timestamp).toLocaleString([], {
                              month: 'short',
                              day: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </span>
                        </div>
                        <p className="text-xs text-slate-400 mt-1">{e.description}</p>
                        <div className="flex items-center gap-3 mt-2 text-[10px] font-mono text-slate-500">
                          <span>Actor: <strong className="text-slate-300">{e.actor}</strong></span>
                          {e.target && (
                            <span>Target: <strong className="text-slate-300">{e.target}</strong></span>
                          )}
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}

        {/* ========================================================
            TAB 8: RBAC & ADMIN STAFF MANAGEMENT
            ======================================================== */}
        {activeTab === 'admins' && (
          <div className="space-y-6 animate-in fade-in duration-150">
            {/* Super Admin Notice */}
            <div className="p-5 rounded-3xl bg-indigo-950/40 border border-indigo-900/60 flex items-start gap-3.5 text-xs text-indigo-200">
              <Shield className="w-5 h-5 text-indigo-400 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <h4 className="font-bold text-white">Privileged RBAC Security Architecture</h4>
                <p className="text-[11px] text-slate-300 leading-relaxed">
                  Super Admins are set via <code className="bg-indigo-900/60 text-indigo-300 px-1 py-0.2 rounded font-mono">SUPER_ADMIN_EMAIL</code> in <code className="bg-indigo-900/60 text-indigo-300 px-1 py-0.2 rounded font-mono">.env</code>. You can invite additional administrators below who will have full telemetry, chatbot moderation, and lead viewing privileges.
                </p>
              </div>
            </div>

            {/* Invite Form */}
            {isSuperAdmin && (
              <form onSubmit={handleAddAdmin} className="p-5 sm:p-6 rounded-3xl bg-slate-900 border border-slate-800 space-y-4">
                <h3 className="text-sm font-bold text-white">Grant Administrator Privileges</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-400 mb-1">Google Email Address</label>
                    <input
                      type="email"
                      required
                      placeholder="admin@example.com"
                      value={newAdminEmail}
                      onChange={(e) => setNewAdminEmail(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-xs text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-400 mb-1">Full Name</label>
                    <input
                      type="text"
                      placeholder="Jane Doe"
                      value={newAdminName}
                      onChange={(e) => setNewAdminName(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-xs text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                </div>

                {adminActionMsg && (
                  <div className={`p-3 rounded-xl text-xs font-semibold ${adminActionMsg.type === 'success' ? 'bg-emerald-500/20 text-emerald-300' : 'bg-rose-500/20 text-rose-300'}`}>
                    {adminActionMsg.text}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={addingAdmin}
                  className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs transition-colors cursor-pointer text-center"
                >
                  {addingAdmin ? 'Authorizing...' : 'Grant Admin Privileges'}
                </button>
              </form>
            )}

            {/* Admins Table */}
            <div className="rounded-3xl bg-slate-900 border border-slate-800 overflow-hidden shadow-xl">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[550px] text-left text-xs">
                  <thead className="bg-slate-950/80 border-b border-slate-800 text-slate-400 uppercase font-semibold text-[10px] tracking-wider">
                    <tr>
                      <th className="px-5 py-4">Administrator</th>
                      <th className="px-4 py-4">Role</th>
                      <th className="px-4 py-4">Assigned By</th>
                      <th className="px-5 py-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 font-medium">
                    {adminsList.map((a) => (
                      <tr key={a.email} className="hover:bg-slate-800/40 transition-colors">
                        <td className="px-5 py-3.5">
                          <div className="font-bold text-white">{a.name || a.email.split('@')[0]}</div>
                          <div className="text-[11px] font-mono text-slate-400">{a.email}</div>
                        </td>
                        <td className="px-4 py-3.5">
                          <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                            {a.role || 'Admin'}
                          </span>
                        </td>
                        <td className="px-4 py-3.5 text-slate-400 font-mono text-[11px]">{a.assignedBy || 'Super Admin'}</td>
                        <td className="px-5 py-3.5 text-right">
                          {isSuperAdmin && (
                            <button
                              onClick={() => handleRevokeAdmin(a.email)}
                              disabled={revokingAdminEmail === a.email}
                              className="px-3 py-1.5 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 text-xs font-bold transition-colors cursor-pointer"
                            >
                              Revoke
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================
            TAB: WHATSAPP LIVE GATEWAY & TWO-WAY RELAY
            ======================================================== */}
        {activeTab === 'whatsapp' && (
          <div className="space-y-6 animate-in fade-in duration-150">
            {waActionMsg && (
              <div
                className={`p-4 rounded-2xl text-xs font-semibold flex items-center justify-between gap-3 ${
                  waActionMsg.type === 'success'
                    ? 'bg-emerald-500/20 border border-emerald-500/30 text-emerald-300'
                    : 'bg-rose-500/20 border border-rose-500/30 text-rose-300'
                }`}
              >
                <span>{waActionMsg.text}</span>
                <button
                  type="button"
                  onClick={() => setWaActionMsg(null)}
                  className="font-bold underline text-[11px] cursor-pointer"
                >
                  Dismiss
                </button>
              </div>
            )}

            {/* Top Bar for WhatsApp Tab */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-5 sm:p-6 rounded-3xl bg-slate-900/60 border border-slate-800">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 shrink-0">
                  <Phone className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-white">WhatsApp Integration & Two-Way Live Relay</h2>
                  <p className="text-xs text-slate-400">
                    Pair Baileys WhatsApp client, deliver proactive user alerts, and relay live visitor handoffs.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3 w-full sm:w-auto">
                <Link
                  href="/admin/whatsapp"
                  className="w-full sm:w-auto text-center justify-center px-4 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:scale-105 text-white font-extrabold text-xs shadow-lg shadow-emerald-600/20 transition-all flex items-center gap-2"
                >
                  <span>Open Full WhatsApp Hub</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>
            </div>

            {/* 3 Metric Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-5 rounded-3xl bg-slate-900/60 border border-slate-800 flex flex-col justify-between">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-black uppercase text-slate-400">Connection State</span>
                  <span
                    className={`text-xs font-bold px-2.5 py-1 rounded-full ${
                      waStatus.status === 'connected'
                        ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                        : waStatus.status === 'connecting'
                        ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                        : 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                    }`}
                  >
                    {waStatus.status === 'connected'
                      ? 'Connected'
                      : waStatus.status === 'connecting'
                      ? 'Connecting'
                      : 'Disconnected'}
                  </span>
                </div>
                <div className="mt-3">
                  <div className="text-lg font-black text-white">
                    {waStatus.status === 'connected' ? `+${waStatus.phoneNumber}` : 'No Active Session'}
                  </div>
                  <div className="text-xs text-slate-400 mt-1">
                    {waStatus.pushName ? `Push Name: ${waStatus.pushName}` : 'Offline'}
                  </div>
                </div>
              </div>

              <div className="p-5 rounded-3xl bg-slate-900/60 border border-slate-800 flex flex-col justify-between">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-black uppercase text-slate-400">Human Handoff Tickets</span>
                  <Headphones className="w-4 h-4 text-indigo-400" />
                </div>
                <div className="mt-3">
                  <div className="text-lg font-black text-white">
                    {waTickets.filter((t) => t.status !== 'closed').length} Active
                  </div>
                  <div className="text-xs text-slate-400 mt-1">
                    Total: {waTickets.length} tickets recorded
                  </div>
                </div>
              </div>

              <div className="p-5 rounded-3xl bg-slate-900/60 border border-slate-800 flex flex-col justify-between">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-black uppercase text-slate-400">Auth Persistence</span>
                  <Shield className="w-4 h-4 text-emerald-400" />
                </div>
                <div className="mt-3">
                  <div className="text-lg font-black text-white font-mono">MongoDB Cache</div>
                  <div className="text-xs text-slate-400 mt-1">
                    BufferJSON keys preserved across restarts
                  </div>
                </div>
              </div>
            </div>

            {/* Quick Action Panel */}
            <div className="p-5 sm:p-6 rounded-3xl bg-slate-900/60 border border-slate-800 space-y-5">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <h3 className="text-sm font-bold text-white">WhatsApp Web Pairing</h3>
                {waStatus.status === 'connected' ? (
                  <button
                    onClick={handleWaLogout}
                    disabled={waLoggingOut}
                    className="w-full sm:w-auto justify-center px-3.5 py-1.5 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border border-rose-500/30 text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    <span>{waLoggingOut ? 'Disconnecting...' : 'Disconnect WhatsApp'}</span>
                  </button>
                ) : (
                  <button
                    onClick={() => handleWaConnect(true)}
                    disabled={waConnecting}
                    className="w-full sm:w-auto justify-center px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${waConnecting ? 'animate-spin' : ''}`} />
                    <span>{waConnecting ? 'Initializing...' : 'Generate Pairing QR'}</span>
                  </button>
                )}
              </div>

              {waStatus.status === 'connected' ? (
                <div className="p-5 sm:p-6 rounded-2xl bg-slate-950/60 border border-slate-800 flex flex-col sm:flex-row items-start sm:items-center gap-4">
                  <div className="w-12 h-12 rounded-full bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0">
                    <CheckCircle2 className="w-6 h-6" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-white">WhatsApp Client Connected & Ready</h4>
                    <p className="text-xs text-slate-400 mt-1">
                      Outbound lead notifications and visitor human handoffs are operating directly via WhatsApp.
                    </p>
                  </div>
                </div>
              ) : waStatus.qrCode ? (
                <div className="p-6 rounded-2xl bg-slate-950/60 border border-slate-800 text-center space-y-3 max-w-full">
                  <div className="inline-block p-3 bg-white rounded-2xl border-4 border-slate-800 shadow-xl max-w-full">
                    <Image
                      src={waStatus.qrCode}
                      alt="WhatsApp Pairing QR"
                      width={180}
                      height={180}
                      unoptimized
                      className="rounded-lg max-w-full h-auto mx-auto"
                    />
                  </div>
                  <div className="text-xs text-emerald-400 font-bold">
                    Scan with WhatsApp &gt; Linked Devices
                  </div>
                </div>
              ) : (
                <div className="p-6 rounded-2xl bg-slate-950/60 border border-slate-800 text-center space-y-3">
                  <QrCode className="w-10 h-10 text-slate-600 mx-auto" />
                  <p className="text-xs text-slate-400">
                    Click &quot;Generate Pairing QR&quot; or open the dedicated WhatsApp hub to scan and link your phone.
                  </p>
                </div>
              )}
            </div>

            {/* Quick Tickets Preview */}
            <div className="p-5 sm:p-6 rounded-3xl bg-slate-900/60 border border-slate-800 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <Headphones className="w-4 h-4 text-emerald-400" />
                  <span>Recent Live Support Tickets ({waTickets.length})</span>
                </h3>
                <Link
                  href="/admin/whatsapp"
                  className="text-xs text-emerald-400 hover:text-emerald-300 font-bold flex items-center gap-1"
                >
                  <span>Manage in Hub</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </Link>
              </div>

              {waTickets.length === 0 ? (
                <div className="text-center py-8 text-slate-500 text-xs">
                  No live handoff tickets yet. When visitors request human support, tickets will appear here and trigger WhatsApp alerts.
                </div>
              ) : (
                <div className="space-y-2">
                  {waTickets.slice(0, 5).map((t: any) => (
                    <div
                      key={t.ticketId}
                      className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800/80 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs"
                    >
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono text-emerald-400 font-bold">#{t.ticketId}</span>
                        <span className="text-slate-300 font-semibold">{t.visitor?.name || 'Visitor'}</span>
                        <span className="text-slate-500">•</span>
                        <span className="text-slate-400 truncate max-w-xs">{t.lastUserMessage || t.botName}</span>
                      </div>
                      <span
                        className={`text-[9px] font-extrabold uppercase px-2 py-0.5 rounded-full w-fit ${
                          t.status === 'closed'
                            ? 'bg-slate-800 text-slate-400 border border-slate-700'
                            : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                        }`}
                      >
                        {t.status}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ========================================================
            TAB 9: PLATFORM ENGINE & AI MODELS SETTINGS
            ======================================================== */}
        {activeTab === 'settings' && (
          <div className="space-y-6 animate-in fade-in duration-150">
            {settingsMsg && (
              <div
                className={`p-4 rounded-2xl text-xs font-semibold flex items-center justify-between gap-3 ${
                  settingsMsg.type === 'success'
                    ? 'bg-emerald-500/20 border border-emerald-500/30 text-emerald-300'
                    : 'bg-rose-500/20 border border-rose-500/30 text-rose-300'
                }`}
              >
                <span>{settingsMsg.text}</span>
                <button
                  type="button"
                  onClick={() => setSettingsMsg(null)}
                  className="font-bold underline text-[11px] cursor-pointer"
                >
                  Dismiss
                </button>
              </div>
            )}

            <form onSubmit={handleSaveSettings} className="space-y-6">
              {/* Section 1: Default AI Models & Providers */}
              <div className="p-4 sm:p-6 rounded-2xl sm:rounded-3xl bg-slate-900 border border-slate-800 space-y-5">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-4 border-b border-slate-800">
                  <div className="space-y-1">
                    <h3 className="text-base font-extrabold text-white font-heading flex items-center gap-2">
                      <Sliders className="w-4 h-4 text-indigo-400 shrink-0" />
                      <span>Default AI Models &amp; Engine</span>
                    </h3>
                    <p className="text-xs text-slate-400">
                      Models are loaded dynamically from database settings without modifying server .env files.
                    </p>
                  </div>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 whitespace-nowrap">
                    Live Engine
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                  {/* Default Chat Provider */}
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-1.5">
                      Default Chat Provider
                    </label>
                    <select
                      value={settings.defaultChatProvider}
                      onChange={(e) => {
                        const prov = e.target.value;
                        let defModel = 'gpt-4o-mini';
                        if (prov === 'nvidia') defModel = 'meta/muse-glimmer-30b';
                        else if (prov === 'gemini') defModel = 'gemini-2.5-flash';
                        else if (prov === 'openrouter') defModel = 'meta-llama/llama-3-8b-instruct:free';
                        setSettings({
                          ...settings,
                          defaultChatProvider: prov,
                          defaultChatModel: defModel,
                        });
                      }}
                      className="w-full px-3.5 py-2.5 text-xs rounded-xl bg-slate-800 border border-slate-700 text-white font-semibold outline-none focus:border-indigo-500"
                    >
                      <option value="openai">OpenAI</option>
                      <option value="nvidia">NVIDIA NIM</option>
                      <option value="gemini">Google Gemini</option>
                      <option value="openrouter">OpenRouter</option>
                    </select>
                  </div>

                  {/* Default Chat Model */}
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-1.5">
                      Default Chat Model ID
                    </label>
                    <input
                      type="text"
                      value={settings.defaultChatModel}
                      onChange={(e) => setSettings({ ...settings, defaultChatModel: e.target.value })}
                      placeholder="e.g. gpt-4o-mini, gemini-2.5-flash"
                      className="w-full px-3.5 py-2.5 text-xs rounded-xl bg-slate-800 border border-slate-700 text-white font-mono outline-none focus:border-indigo-500"
                    />
                  </div>

                  {/* Default Embeddings Provider */}
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-1.5">
                      Default Embeddings Provider
                    </label>
                    <select
                      value={settings.defaultEmbedProvider}
                      onChange={(e) => {
                        const prov = e.target.value;
                        let defEmbed = 'text-embedding-3-small';
                        if (prov === 'nvidia') defEmbed = 'nvidia/llama-nemotron-embed-vl-1b-v2';
                        else if (prov === 'gemini') defEmbed = 'gemini-embedding-001';
                        setSettings({
                          ...settings,
                          defaultEmbedProvider: prov,
                          defaultEmbedModel: defEmbed,
                        });
                      }}
                      className="w-full px-3.5 py-2.5 text-xs rounded-xl bg-slate-800 border border-slate-700 text-white font-semibold outline-none focus:border-indigo-500"
                    >
                      <option value="openai">OpenAI (text-embedding-3-small)</option>
                      <option value="nvidia">NVIDIA NIM (llama-nemotron-embed-vl-1b-v2)</option>
                      <option value="gemini">Google Gemini (gemini-embedding-001)</option>
                    </select>
                  </div>

                  {/* Default Embeddings Model */}
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-1.5">
                      Default Embeddings Model ID
                    </label>
                    <input
                      type="text"
                      value={settings.defaultEmbedModel}
                      onChange={(e) => setSettings({ ...settings, defaultEmbedModel: e.target.value })}
                      placeholder="e.g. text-embedding-3-small"
                      className="w-full px-3.5 py-2.5 text-xs rounded-xl bg-slate-800 border border-slate-700 text-white font-mono outline-none focus:border-indigo-500"
                    />
                  </div>
                </div>
              </div>

              {/* Section 2: Plan Quotas & Bot Restrictions */}
              <div className="p-4 sm:p-6 rounded-2xl sm:rounded-3xl bg-slate-900 border border-slate-800 space-y-5">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-4 border-b border-slate-800">
                  <div className="space-y-1">
                    <h3 className="text-base font-extrabold text-white font-heading flex items-center gap-2">
                      <CreditCard className="w-4 h-4 text-emerald-400 shrink-0" />
                      <span>Plan Quotas &amp; Bot Restrictions</span>
                    </h3>
                    <p className="text-xs text-slate-400">
                      Configure strict chatbot limits, monthly token quotas, and message allowances for Free and Pro tiers.
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  {/* Free Plan */}
                  <div className="p-4 sm:p-5 rounded-2xl bg-slate-950 border border-slate-800 space-y-4">
                    <div className="flex items-center justify-between">
                      <h4 className="text-sm font-bold text-white flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full bg-slate-400" />
                        <span>Free Tier Limits</span>
                      </h4>
                      <span className="text-xs font-bold text-slate-400">Free / $0</span>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-300 mb-1">
                        Chatbot Project Limit
                      </label>
                      <input
                        type="number"
                        min="1"
                        max="10"
                        value={settings.freePlan?.botLimit || 1}
                        onChange={(e) =>
                          setSettings({
                            ...settings,
                            freePlan: { ...settings.freePlan, botLimit: Number(e.target.value) || 1 },
                          })
                        }
                        className="w-full px-3 py-2 text-xs rounded-xl bg-slate-800 border border-slate-700 font-bold text-white"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-300 mb-1">
                        Monthly Token Quota
                      </label>
                      <input
                        type="number"
                        step="1000"
                        min="5000"
                        value={settings.freePlan?.tokenQuota || 25000}
                        onChange={(e) =>
                          setSettings({
                            ...settings,
                            freePlan: { ...settings.freePlan, tokenQuota: Number(e.target.value) || 25000 },
                          })
                        }
                        className="w-full px-3 py-2 text-xs rounded-xl bg-slate-800 border border-slate-700 font-mono font-bold text-white"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-300 mb-1">
                        Monthly Chat / Message Limit
                      </label>
                      <input
                        type="number"
                        step="10"
                        min="10"
                        value={settings.freePlan?.chatQuota || 50}
                        onChange={(e) =>
                          setSettings({
                            ...settings,
                            freePlan: { ...settings.freePlan, chatQuota: Number(e.target.value) || 50 },
                          })
                        }
                        className="w-full px-3 py-2 text-xs rounded-xl bg-slate-800 border border-slate-700 font-mono font-bold text-white"
                      />
                    </div>
                  </div>

                  {/* Pro Plan */}
                  <div className="p-4 sm:p-5 rounded-2xl bg-indigo-950/20 border border-indigo-900/60 space-y-4">
                    <div className="flex items-center justify-between">
                      <h4 className="text-sm font-bold text-indigo-300 flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full bg-indigo-500" />
                        <span>Pro Plan Limits</span>
                      </h4>
                      <span className="text-xs font-black text-indigo-400">
                        ${settings.proPlan?.monthlyPrice || 9}/mo
                      </span>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-300 mb-1">
                        Chatbot Project Limit
                      </label>
                      <input
                        type="number"
                        min="1"
                        max="100"
                        value={settings.proPlan?.botLimit || 10}
                        onChange={(e) =>
                          setSettings({
                            ...settings,
                            proPlan: { ...settings.proPlan, botLimit: Number(e.target.value) || 10 },
                          })
                        }
                        className="w-full px-3 py-2 text-xs rounded-xl bg-slate-800 border border-slate-700 font-bold text-white"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-300 mb-1">
                        Monthly Token Quota
                      </label>
                      <input
                        type="number"
                        step="100000"
                        min="50000"
                        value={settings.proPlan?.tokenQuota || 2500000}
                        onChange={(e) =>
                          setSettings({
                            ...settings,
                            proPlan: { ...settings.proPlan, tokenQuota: Number(e.target.value) || 2500000 },
                          })
                        }
                        className="w-full px-3 py-2 text-xs rounded-xl bg-slate-800 border border-slate-700 font-mono font-bold text-white"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-300 mb-1">
                        Monthly Chat / Message Limit
                      </label>
                      <input
                        type="number"
                        step="1000"
                        min="100"
                        value={settings.proPlan?.chatQuota || 50000}
                        onChange={(e) =>
                          setSettings({
                            ...settings,
                            proPlan: { ...settings.proPlan, chatQuota: Number(e.target.value) || 50000 },
                          })
                        }
                        className="w-full px-3 py-2 text-xs rounded-xl bg-slate-800 border border-slate-700 font-mono font-bold text-white"
                      />
                    </div>
                  </div>
                </div>

                {/* Section 3: BYOK Policy */}
                <div className="pt-4 border-t border-slate-800">
                  <label className="flex items-start gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={settings.byokBypassQuota !== false}
                      onChange={(e) => setSettings({ ...settings, byokBypassQuota: e.target.checked })}
                      className="w-4 h-4 rounded text-indigo-600 mt-0.5 shrink-0"
                    />
                    <div>
                      <p className="text-xs font-bold text-white">
                        Exempt Custom API Key (BYOK) Chatbots from Platform Quotas
                      </p>
                      <p className="text-[11px] text-slate-400 mt-0.5 leading-relaxed">
                        When enabled, free users who configure their own provider API keys will not be blocked by monthly chat or token limits.
                      </p>
                    </div>
                  </label>
                </div>
              </div>

              {/* Save Button */}
              <div className="flex justify-end pt-2">
                <button
                  type="submit"
                  disabled={savingSettings || loadingSettings}
                  className="w-full sm:w-auto justify-center px-6 py-3 rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white font-extrabold text-xs shadow-md shadow-indigo-600/25 transition-all flex items-center gap-2 disabled:opacity-50 cursor-pointer text-center"
                >
                  {savingSettings ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Saving System Settings...</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-4 h-4" />
                      <span>Save Platform Settings</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        )}
      </main>

      {/* ========================================================
          CONVERSATION INSPECTOR MODAL
          ======================================================== */}
      {selectedConversation && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-2xl bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            {/* Modal Header */}
            <div className="p-4 sm:p-5 border-b border-slate-800 flex items-center justify-between bg-slate-950/50">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-9 h-9 rounded-xl bg-indigo-500/10 text-indigo-400 flex items-center justify-center shrink-0">
                  <Bot className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    <span className="truncate">{selectedConversation.botName}</span>
                    <span className="text-[9px] uppercase px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 shrink-0">
                      {selectedConversation.status}
                    </span>
                  </h3>
                  <p className="text-[11px] text-slate-400 font-mono truncate">
                    Visitor: {selectedConversation.visitor?.name || 'Visitor'} {selectedConversation.visitor?.email ? `(${selectedConversation.visitor.email})` : ''}
                  </p>
                </div>
              </div>

              <button
                onClick={() => setSelectedConversation(null)}
                className="p-1.5 rounded-xl hover:bg-slate-800 text-slate-400 hover:text-white transition-colors shrink-0 ml-2"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Messages Scroll Area */}
            <div className="p-4 sm:p-5 overflow-y-auto space-y-3 flex-1">
              {(!selectedConversation.messages || selectedConversation.messages.length === 0) ? (
                <div className="text-center py-8 text-xs text-slate-500">
                  No message history recorded for this session.
                </div>
              ) : (
                selectedConversation.messages.map((m: any, idx: number) => {
                  const isUser = m.role === 'user';
                  return (
                    <div
                      key={m.id || idx}
                      className={`flex flex-col ${isUser ? 'items-end' : 'items-start'}`}
                    >
                      <div className="text-[10px] font-semibold text-slate-500 mb-1 px-1">
                        {isUser ? 'Visitor' : 'AI Assistant'} • {new Date(m.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </div>
                      <div
                        className={`p-3.5 rounded-2xl text-xs max-w-[90%] sm:max-w-[85%] leading-relaxed whitespace-pre-wrap break-words break-all ${
                          isUser
                            ? 'bg-indigo-600 text-white rounded-tr-none'
                            : 'bg-slate-800 text-slate-200 rounded-tl-none border border-slate-700/60'
                        }`}
                      >
                        {m.content}
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-3.5 sm:p-4 border-t border-slate-800 bg-slate-950 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <span className="text-[11px] text-slate-500 font-mono truncate max-w-xs">
                Session: {selectedConversation.sessionId}
              </span>
              <button
                onClick={() => setSelectedConversation(null)}
                className="w-full sm:w-auto px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs transition-colors text-center"
              >
                Close Inspector
              </button>
            </div>
          </div>
        </div>
      )}

      <Footer />
    </div>
  );
}
