'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import {
  MessageSquare,
  QrCode,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  LogOut,
  Send,
  Shield,
  Smartphone,
  PhoneCall,
  User,
  Clock,
  ArrowLeft,
  Headphones,
  Check,
  ChevronRight,
  ExternalLink,
  Zap,
  Radio,
} from 'lucide-react';
import { Navbar } from '@/components/Navbar';
import { Footer } from '@/components/Footer';
import { useAuth } from '@/lib/firebase/AuthContext';
import { AuthModal } from '@/components/AuthModal';

interface WhatsAppStatus {
  status: 'disconnected' | 'connecting' | 'connected';
  qrCode?: string;
  phoneNumber?: string;
  pushName?: string;
  jid?: string;
  lastConnectedAt?: string;
  openTickets?: number;
}

interface TicketMessage {
  id: string;
  role: 'user' | 'agent' | 'system';
  senderName?: string;
  content: string;
  timestamp: string;
}

interface Ticket {
  id: string;
  ticketId: string;
  botName: string;
  sessionId: string;
  visitor: {
    name?: string;
    email?: string;
    phone?: string;
  };
  status: 'open' | 'waiting_admin' | 'admin_replied' | 'closed';
  lastUserMessage?: string;
  lastAdminReply?: string;
  messages: TicketMessage[];
  createdAt: string;
  updatedAt: string;
}

export default function WhatsAppAdminPage() {
  const { user, isAdmin, loading: authLoading } = useAuth();
  const [authModalOpen, setAuthModalOpen] = useState(false);

  // Connection State
  const [statusData, setStatusData] = useState<WhatsAppStatus>({
    status: 'disconnected',
  });
  const [loadingStatus, setLoadingStatus] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  // Test Notification State
  const [testPhone, setTestPhone] = useState('');
  const [testMessage, setTestMessage] = useState('Hello from Rivafy Studio! Your WhatsApp notification pipeline is active and verified.');
  const [sendingTest, setSendingTest] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; msg: string } | null>(null);

  // Tickets State
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loadingTickets, setLoadingTickets] = useState(false);
  const [activeTicket, setActiveTicket] = useState<Ticket | null>(null);
  const [replyText, setReplyText] = useState('');
  const [submittingReply, setSubmittingReply] = useState(false);

  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Fetch status
  const fetchStatus = useCallback(async () => {
    if (!user?.email) return;
    try {
      const res = await fetch('/api/admin/whatsapp/status', {
        headers: { 'x-user-email': user.email },
      });
      if (res.ok) {
        const data = await res.json();
        setStatusData(data);
      }
    } catch {
      // non-fatal
    } finally {
      setLoadingStatus(false);
    }
  }, [user]);

  // Fetch tickets
  const fetchTickets = useCallback(async () => {
    if (!user?.email) return;
    setLoadingTickets(true);
    try {
      const res = await fetch('/api/admin/whatsapp/tickets', {
        headers: { 'x-user-email': user.email },
      });
      if (res.ok) {
        const data = await res.json();
        setTickets(data.tickets || []);
        if (activeTicket) {
          const fresh = (data.tickets || []).find((t: Ticket) => t.ticketId === activeTicket.ticketId);
          if (fresh) setActiveTicket(fresh);
        }
      }
    } catch {
      // non-fatal
    } finally {
      setLoadingTickets(false);
    }
  }, [user, activeTicket]);

  // Connect WhatsApp / Request QR
  const handleConnect = async (forceNew = false) => {
    if (!user?.email) return;
    setConnecting(true);
    setErrorMsg(null);
    setActionSuccess(null);
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
      if (!res.ok) throw new Error(data.error || 'Failed to start WhatsApp connection');
      setStatusData((prev) => ({
        ...prev,
        status: data.status,
        qrCode: data.qrCode || prev.qrCode,
        phoneNumber: data.phoneNumber || prev.phoneNumber,
      }));
      setActionSuccess('Connecting to WhatsApp Web... Scan the QR code below.');
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to connect');
    } finally {
      setConnecting(false);
    }
  };

  // Logout WhatsApp
  const handleLogout = async () => {
    if (!user?.email) return;
    if (!window.confirm('Are you sure you want to disconnect WhatsApp and remove persistent MongoDB auth?')) {
      return;
    }
    setLoggingOut(true);
    setErrorMsg(null);
    setActionSuccess(null);
    try {
      const res = await fetch('/api/admin/whatsapp/logout', {
        method: 'POST',
        headers: { 'x-user-email': user.email },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to logout');
      setStatusData({ status: 'disconnected', qrCode: '', phoneNumber: '' });
      setActionSuccess('WhatsApp session terminated successfully.');
    } catch (err: any) {
      setErrorMsg(err.message || 'Logout failed');
    } finally {
      setLoggingOut(false);
    }
  };

  // Send Test Notification
  const handleSendTest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.email || !testPhone.trim() || !testMessage.trim()) return;
    setSendingTest(true);
    setTestResult(null);
    try {
      const res = await fetch('/api/admin/whatsapp/test-send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-email': user.email,
        },
        body: JSON.stringify({ phone: testPhone.trim(), message: testMessage.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to send message');
      setTestResult({ ok: true, msg: `Message dispatched successfully to ${testPhone}` });
    } catch (err: any) {
      setTestResult({ ok: false, msg: err.message || 'Dispatch failed' });
    } finally {
      setSendingTest(false);
    }
  };

  // Reply to Ticket from UI
  const handleReplyTicket = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.email || !activeTicket || !replyText.trim()) return;
    setSubmittingReply(true);
    try {
      const res = await fetch('/api/admin/whatsapp/tickets', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-email': user.email,
        },
        body: JSON.stringify({
          ticketId: activeTicket.ticketId,
          action: 'reply',
          message: replyText.trim(),
          adminName: user.displayName || 'Support Admin',
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to send reply');
      setReplyText('');
      fetchTickets();
    } catch (err: any) {
      alert(err.message || 'Reply failed');
    } finally {
      setSubmittingReply(false);
    }
  };

  // Close Ticket
  const handleCloseTicket = async (ticketId: string) => {
    if (!user?.email) return;
    if (!window.confirm(`Close support ticket #${ticketId} and resume AI bot?`)) return;
    try {
      const res = await fetch('/api/admin/whatsapp/tickets', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-email': user.email,
        },
        body: JSON.stringify({
          ticketId,
          action: 'close',
          adminName: user.displayName || 'Support Admin',
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to close ticket');
      fetchTickets();
    } catch (err: any) {
      alert(err.message || 'Failed to close ticket');
    }
  };

  // Polling loop when connecting or viewing tickets
  useEffect(() => {
    if (!user?.email) return;
    fetchStatus();
    fetchTickets();

    // Poll status frequently if connecting (to show QR and connection transition)
    const intervalTime = statusData.status === 'connecting' ? 3000 : 8000;
    pollIntervalRef.current = setInterval(() => {
      fetchStatus();
      fetchTickets();
    }, intervalTime);

    return () => {
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    };
  }, [user, statusData.status, fetchStatus, fetchTickets]);

  // Loading state
  if (authLoading) {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex flex-col">
        <Navbar />
        <div className="flex-1 flex items-center justify-center">
          <div className="animate-spin w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full" />
        </div>
      </div>
    );
  }

  // Not logged in or not admin
  if (!user || !isAdmin) {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex flex-col">
        <Navbar />
        <div className="flex-1 flex items-center justify-center p-6">
          <div className="max-w-md w-full bg-slate-900 border border-slate-800 p-8 rounded-3xl text-center space-y-4">
            <Shield className="w-12 h-12 text-rose-500 mx-auto" />
            <h2 className="text-xl font-bold">Privileged Access Only</h2>
            <p className="text-xs text-slate-400">
              Only authorized Rivafy Studio administrators can manage the WhatsApp live gateway.
            </p>
            <button
              onClick={() => setAuthModalOpen(true)}
              className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 rounded-xl font-bold text-xs"
            >
              Sign In as Administrator
            </button>
          </div>
        </div>
        <AuthModal
          isOpen={authModalOpen}
          onClose={() => setAuthModalOpen(false)}
          title="Admin Verification"
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-emerald-500 selection:text-white overflow-x-hidden w-full max-w-full">
      <Navbar />

      {/* Top Banner */}
      <div className="border-b border-slate-800/80 bg-slate-900/40 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-3.5 sm:py-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4">
          <div className="flex items-start sm:items-center gap-3 min-w-0 w-full sm:w-auto">
            <Link
              href="/admin"
              className="p-2 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white transition-all shrink-0 mt-0.5 sm:mt-0"
              title="Return to Command Center"
            >
              <ArrowLeft className="w-4 h-4" />
            </Link>
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-2xl bg-gradient-to-tr from-emerald-500 to-teal-500 p-[1px] shadow-lg shadow-emerald-500/20 shrink-0">
              <div className="w-full h-full bg-slate-950 rounded-[15px] flex items-center justify-center">
                <MessageSquare className="w-4 h-4 sm:w-5 sm:h-5 text-emerald-400" />
              </div>
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-sm sm:text-lg font-black tracking-tight text-white font-heading truncate">
                  WhatsApp Hub & Two-Way Live Relay
                </h1>
                <span className="text-[9px] sm:text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 whitespace-nowrap">
                  Baileys + MongoDB Auth
                </span>
              </div>
              <p className="text-[11px] sm:text-xs text-slate-400 line-clamp-1 sm:line-clamp-none">
                Instant user notifications & real-time human handoff directly through WhatsApp.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto justify-end border-t sm:border-t-0 pt-2 sm:pt-0 border-slate-800/80">
            <button
              onClick={() => {
                fetchStatus();
                fetchTickets();
              }}
              className="flex-1 sm:flex-initial justify-center p-2 sm:p-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-all text-xs font-bold flex items-center gap-1.5"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loadingStatus ? 'animate-spin' : ''}`} />
              <span>Refresh</span>
            </button>
            <Link
              href="/admin"
              className="flex-1 sm:flex-initial text-center px-3.5 sm:px-4 py-2 sm:py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold transition-all"
            >
              Admin Dashboard
            </Link>
          </div>
        </div>
      </div>

      <main className="flex-1 max-w-7xl w-full mx-auto px-3 sm:px-6 lg:px-8 py-5 sm:py-8 space-y-6 sm:space-y-7 overflow-x-hidden">
        {/* Alerts */}
        {errorMsg && (
          <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-3">
            <AlertCircle className="w-5 h-5 shrink-0 text-rose-400" />
            <div className="flex-1 font-semibold">{errorMsg}</div>
          </div>
        )}
        {actionSuccess && (
          <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs flex items-center gap-3">
            <CheckCircle2 className="w-5 h-5 shrink-0 text-emerald-400" />
            <div className="flex-1 font-semibold">{actionSuccess}</div>
          </div>
        )}

        {/* Top 3 Metric Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Card 1: Connection Status */}
          <div className="p-5 rounded-3xl bg-slate-900/60 border border-slate-800/80 shadow-lg relative overflow-hidden flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-black uppercase text-slate-400 tracking-wider">
                Connection State
              </span>
              <span
                className={`flex items-center gap-1.5 text-xs font-bold px-2.5 py-1 rounded-full ${
                  statusData.status === 'connected'
                    ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                    : statusData.status === 'connecting'
                    ? 'bg-amber-500/10 text-amber-400 border border-amber-500/30'
                    : 'bg-rose-500/10 text-rose-400 border border-rose-500/30'
                }`}
              >
                <span
                  className={`w-2 h-2 rounded-full ${
                    statusData.status === 'connected'
                      ? 'bg-emerald-500 animate-pulse'
                      : statusData.status === 'connecting'
                      ? 'bg-amber-400 animate-ping'
                      : 'bg-rose-500'
                  }`}
                />
                {statusData.status === 'connected'
                  ? 'Connected'
                  : statusData.status === 'connecting'
                  ? 'Connecting / Scan QR'
                  : 'Disconnected'}
              </span>
            </div>

            <div className="mt-4">
              <div className="text-xl font-black text-white font-heading">
                {statusData.status === 'connected'
                  ? `+${statusData.phoneNumber || 'Admin WhatsApp'}`
                  : 'Offline'}
              </div>
              <div className="text-xs text-slate-400 mt-1">
                {statusData.status === 'connected'
                  ? `Active session: ${statusData.pushName || 'Rivafy Admin'}`
                  : 'No active WhatsApp session linked'}
              </div>
            </div>

            <div className="mt-5 pt-4 border-t border-slate-800 flex items-center justify-between text-[11px] text-slate-400">
              <span>Session Storage:</span>
              <span className="font-mono text-emerald-400 font-semibold">MongoDB Persistent</span>
            </div>
          </div>

          {/* Card 2: Two-Way Live Handoff */}
          <div className="p-5 rounded-3xl bg-slate-900/60 border border-slate-800/80 shadow-lg relative overflow-hidden flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-black uppercase text-slate-400 tracking-wider">
                Human Handoff Relay
              </span>
              <Headphones className="w-4 h-4 text-indigo-400" />
            </div>

            <div className="mt-4">
              <div className="text-xl font-black text-white font-heading">
                {tickets.filter((t) => t.status !== 'closed').length} Active Tickets
              </div>
              <div className="text-xs text-slate-400 mt-1">
                Visitors awaiting or conversing with live agent
              </div>
            </div>

            <div className="mt-5 pt-4 border-t border-slate-800 flex items-center justify-between text-[11px] text-slate-400">
              <span>Relay Format:</span>
              <span className="font-mono text-indigo-400 font-semibold">#TICKET_ID reply</span>
            </div>
          </div>

          {/* Card 3: Outbound Notification Pipeline */}
          <div className="p-5 rounded-3xl bg-slate-900/60 border border-slate-800/80 shadow-lg relative overflow-hidden flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-black uppercase text-slate-400 tracking-wider">
                User Alerts Engine
              </span>
              <Zap className="w-4 h-4 text-amber-400" />
            </div>

            <div className="mt-4">
              <div className="text-xl font-black text-white font-heading">
                Instant Outbound
              </div>
              <div className="text-xs text-slate-400 mt-1">
                Sends leads & CTA notices to users with WhatsApp ON
              </div>
            </div>

            <div className="mt-5 pt-4 border-t border-slate-800 flex items-center justify-between text-[11px] text-slate-400">
              <span>Gateway:</span>
              <span className="font-mono text-emerald-400 font-semibold">Baileys Native Socket</span>
            </div>
          </div>
        </div>

        {/* Main Section: QR Scanner / Controls + Two-Way Relay Guide */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-7">
          {/* Left Column: QR Code & Auth Controls (7 cols) */}
          <div className="lg:col-span-7 bg-slate-900/70 border border-slate-800/80 rounded-3xl p-6 sm:p-8 space-y-6">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 shrink-0">
                  <QrCode className="w-4 h-4" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-white">WhatsApp Web Authentication</h2>
                  <p className="text-xs text-slate-400">
                    Pair your device to route live chat handoffs and user notification alerts.
                  </p>
                </div>
              </div>

              {statusData.status === 'connected' ? (
                <button
                  onClick={handleLogout}
                  disabled={loggingOut}
                  className="w-full sm:w-auto justify-center px-3.5 py-2 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border border-rose-500/30 text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>{loggingOut ? 'Disconnecting...' : 'Logout'}</span>
                </button>
              ) : (
                <button
                  onClick={() => handleConnect(true)}
                  disabled={connecting}
                  className="w-full sm:w-auto justify-center px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition-all flex items-center gap-1.5 shadow-lg shadow-emerald-600/20 cursor-pointer disabled:opacity-50"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${connecting ? 'animate-spin' : ''}`} />
                  <span>{connecting ? 'Generating...' : 'Generate New QR'}</span>
                </button>
              )}
            </div>

            {/* QR Code Presentation Box */}
            <div className="flex flex-col items-center justify-center py-6 px-4 bg-slate-950/70 rounded-2xl border border-slate-800 text-center min-h-[300px]">
              {statusData.status === 'connected' ? (
                <div className="space-y-4 max-w-sm">
                  <div className="w-16 h-16 rounded-full bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center mx-auto text-emerald-400">
                    <CheckCircle2 className="w-8 h-8" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-white">WhatsApp Linked & Online</h3>
                    <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                      Session linked to <span className="font-mono text-emerald-400 font-bold">+{statusData.phoneNumber}</span>. Auth credentials are securely cached in MongoDB, so restarts or Vercel redeploys will remain connected automatically.
                    </p>
                  </div>
                  <div className="pt-2">
                    <button
                      onClick={handleLogout}
                      disabled={loggingOut}
                      className="w-full sm:w-auto px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold transition-all"
                    >
                      Disconnect WhatsApp
                    </button>
                  </div>
                </div>
              ) : statusData.qrCode ? (
                <div className="space-y-4 max-w-full">
                  <div className="p-3 bg-white rounded-2xl shadow-2xl inline-block border-4 border-slate-800 max-w-full">
                    <Image
                      src={statusData.qrCode}
                      alt="WhatsApp QR Code"
                      width={220}
                      height={220}
                      unoptimized
                      className="rounded-lg max-w-full h-auto mx-auto"
                    />
                  </div>
                  <div>
                    <div className="inline-flex items-center gap-2 text-xs font-bold text-emerald-400 bg-emerald-500/10 px-3 py-1 rounded-full border border-emerald-500/20 max-w-full">
                      <Radio className="w-3.5 h-3.5 animate-pulse shrink-0" />
                      <span className="truncate">Live QR Code — Scan with WhatsApp</span>
                    </div>
                    <p className="text-[11px] text-slate-400 mt-2 max-w-xs mx-auto">
                      Open WhatsApp on your phone &gt; Settings &gt; Linked Devices &gt; Link a Device.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="space-y-4 max-w-sm">
                  <div className="w-14 h-14 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-center mx-auto text-slate-500">
                    <Smartphone className="w-7 h-7" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-white">No Active QR Generated</h3>
                    <p className="text-xs text-slate-400 mt-1">
                      Click the button below to initialize the Baileys socket and generate a live pairing QR code.
                    </p>
                  </div>
                  <button
                    onClick={() => handleConnect(false)}
                    disabled={connecting}
                    className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:scale-105 text-white font-extrabold text-xs shadow-lg shadow-emerald-600/30 transition-all cursor-pointer"
                  >
                    {connecting ? 'Initializing Baileys...' : 'Initialize WhatsApp & Show QR'}
                  </button>
                </div>
              )}
            </div>

            {/* Test Notification Sender Card */}
            <div className="p-5 rounded-2xl bg-slate-950/50 border border-slate-800/80 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-1.5">
                <span className="text-xs font-bold text-white flex items-center gap-1.5">
                  <Send className="w-3.5 h-3.5 text-emerald-400" />
                  Test Outbound WhatsApp Notification
                </span>
                <span className="text-[10px] text-slate-400">Verifies live message delivery</span>
              </div>

              <form onSubmit={handleSendTest} className="space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                      Recipient Phone (with country code)
                    </label>
                    <input
                      type="text"
                      placeholder="+919876543210"
                      value={testPhone}
                      onChange={(e) => setTestPhone(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-xs text-white focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                      Test Message
                    </label>
                    <input
                      type="text"
                      value={testMessage}
                      onChange={(e) => setTestMessage(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-xs text-white focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <button
                    type="submit"
                    disabled={sendingTest || !testPhone.trim()}
                    className="w-full sm:w-auto px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white text-xs font-bold transition-all disabled:opacity-50 cursor-pointer flex items-center justify-center gap-1.5"
                  >
                    <Send className={`w-3.5 h-3.5 ${sendingTest ? 'animate-spin' : ''}`} />
                    <span>{sendingTest ? 'Sending...' : 'Send Test Notification'}</span>
                  </button>

                  {testResult && (
                    <span
                      className={`text-xs font-semibold break-words ${
                        testResult.ok ? 'text-emerald-400' : 'text-rose-400'
                      }`}
                    >
                      {testResult.msg}
                    </span>
                  )}
                </div>
              </form>
            </div>
          </div>

          {/* Right Column: Two-Way Relay Architecture & Command Guide (5 cols) */}
          <div className="lg:col-span-5 space-y-6">
            <div className="bg-slate-900/70 border border-slate-800/80 rounded-3xl p-4 sm:p-6 space-y-5">
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <Headphones className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>Two-Way Live Relay Guide</span>
              </h2>
              <p className="text-xs text-slate-400 leading-relaxed">
                When a visitor on your website requests a human agent via the chatbot widget, an instant alert is sent to your connected WhatsApp. You can reply directly from your phone!
              </p>

              {/* Step 1: Alert Format */}
              <div className="space-y-2">
                <span className="text-[11px] font-black uppercase text-slate-300">
                  1. Incoming Alert Format
                </span>
                <div className="p-3 sm:p-3.5 rounded-2xl bg-slate-950 font-mono text-[10px] sm:text-[11px] text-slate-300 border border-slate-800 whitespace-pre-wrap break-words break-all leading-relaxed">
{`🔴 *New Support Request* [#TICK-8392]
*Bot:* SaaS Sales Assistant
*Visitor:* John Doe (john@example.com)

💬 *Visitor message:*
"Can you customize enterprise pricing?"
───────────────────
👉 _Reply: #TICK-8392 your reply_
👉 _To close: #TICK-8392 /close_`}
                </div>
              </div>

              {/* Step 2: Reply Commands */}
              <div className="space-y-2">
                <span className="text-[11px] font-black uppercase text-slate-300">
                  2. Admin WhatsApp Commands
                </span>
                <div className="space-y-2 text-xs">
                  <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800 flex flex-col sm:flex-row items-start sm:items-center gap-1.5 sm:gap-2.5">
                    <span className="font-mono text-emerald-400 font-bold shrink-0 text-xs">
                      #TICKET_ID [msg]
                    </span>
                    <span className="text-slate-400 text-[11px]">
                      Relays message to the visitor&apos;s website chat widget in real-time.
                    </span>
                  </div>
                  <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800 flex flex-col sm:flex-row items-start sm:items-center gap-1.5 sm:gap-2.5">
                    <span className="font-mono text-rose-400 font-bold shrink-0 text-xs">
                      #TICKET_ID /close
                    </span>
                    <span className="text-slate-400 text-[11px]">
                      Closes the human ticket and switches widget back to AI auto-pilot.
                    </span>
                  </div>
                </div>
              </div>

              {/* Step 3: MongoDB Persistence Note */}
              <div className="p-3.5 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 text-xs text-indigo-300 space-y-1">
                <div className="font-bold flex items-center gap-1.5">
                  <Shield className="w-3.5 h-3.5 shrink-0" />
                  <span>Vercel & Cloud Persistent</span>
                </div>
                <p className="text-[11px] text-indigo-200/80 leading-relaxed">
                  Baileys keys and Signal cryptographic credentials are serialized via <code className="font-mono text-indigo-300">BufferJSON</code> into MongoDB. Serverless invocations and container restarts keep you signed in.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Live Support Tickets Section */}
        <div className="bg-slate-900/70 border border-slate-800/80 rounded-3xl p-6 sm:p-8 space-y-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
            <div>
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <Headphones className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>Live Support Tickets ({tickets.length})</span>
              </h2>
              <p className="text-xs text-slate-400">
                Track all visitor escalated sessions, transcripts, and WhatsApp replies.
              </p>
            </div>

            <button
              onClick={fetchTickets}
              disabled={loadingTickets}
              className="w-full sm:w-auto justify-center px-3.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-bold transition-all flex items-center gap-1.5"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loadingTickets ? 'animate-spin' : ''}`} />
              <span>Refresh Tickets</span>
            </button>
          </div>

          {tickets.length === 0 ? (
            <div className="text-center py-12 text-slate-500 text-xs">
              <Headphones className="w-10 h-10 mx-auto text-slate-600 mb-3" />
              No support tickets requested yet. Escalations from chatbot widgets will appear here.
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* Ticket List (5 cols) */}
              <div className="lg:col-span-5 space-y-2.5 max-h-[500px] overflow-y-auto pr-1">
                {tickets.map((t) => {
                  const isSelected = activeTicket?.ticketId === t.ticketId;
                  return (
                    <div
                      key={t.ticketId}
                      onClick={() => setActiveTicket(t)}
                      className={`p-4 rounded-2xl border transition-all cursor-pointer ${
                        isSelected
                          ? 'bg-emerald-950/30 border-emerald-500/50 shadow-md'
                          : 'bg-slate-950/60 border-slate-800 hover:border-slate-700'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-mono text-xs font-bold text-emerald-400">
                          #{t.ticketId}
                        </span>
                        <span
                          className={`text-[9px] font-extrabold uppercase px-2 py-0.5 rounded-full ${
                            t.status === 'open' || t.status === 'waiting_admin'
                              ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                              : t.status === 'admin_replied'
                              ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                              : 'bg-slate-800 text-slate-400 border border-slate-700'
                          }`}
                        >
                          {t.status}
                        </span>
                      </div>

                      <div className="mt-2 text-xs font-semibold text-white truncate">
                        {t.visitor?.name || 'Visitor'} • {t.botName}
                      </div>

                      <p className="text-[11px] text-slate-400 truncate mt-1">
                        {t.lastUserMessage || 'No preview available'}
                      </p>

                      <div className="mt-2 text-[10px] text-slate-500 flex items-center justify-between">
                        <span>{new Date(t.createdAt).toLocaleTimeString()}</span>
                        <span>{t.messages.length} messages</span>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Active Ticket Details & Reply Box (7 cols) */}
              <div className="lg:col-span-7 bg-slate-950/70 border border-slate-800 rounded-2xl p-4 sm:p-5 flex flex-col justify-between min-h-[400px]">
                {activeTicket ? (
                  <div className="space-y-4 flex-1 flex flex-col justify-between">
                    <div>
                      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-slate-800 pb-3">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-mono text-sm font-black text-emerald-400">
                              #{activeTicket.ticketId}
                            </span>
                            <span className="text-xs text-slate-300 font-semibold truncate">
                              {activeTicket.visitor?.name || 'Visitor'}
                            </span>
                          </div>
                          <div className="text-[11px] text-slate-400 mt-0.5 truncate">
                            {activeTicket.visitor?.email || 'No email'} • {activeTicket.botName}
                          </div>
                        </div>

                        {activeTicket.status !== 'closed' && (
                          <button
                            onClick={() => handleCloseTicket(activeTicket.ticketId)}
                            className="w-full sm:w-auto px-3 py-1.5 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border border-rose-500/30 text-xs font-bold transition-all text-center"
                          >
                            Close Ticket
                          </button>
                        )}
                      </div>

                      {/* Messages Thread */}
                      <div className="mt-4 space-y-2.5 max-h-[300px] overflow-y-auto pr-1">
                        {activeTicket.messages.map((m) => (
                          <div
                            key={m.id}
                            className={`p-3 rounded-xl text-xs max-w-[90%] sm:max-w-[85%] ${
                              m.role === 'agent'
                                ? 'ml-auto bg-emerald-600/20 border border-emerald-500/30 text-emerald-100'
                                : m.role === 'user'
                                ? 'mr-auto bg-slate-800/90 text-slate-200 border border-slate-700'
                                : 'mx-auto bg-slate-900 text-slate-400 text-[11px] text-center'
                            }`}
                          >
                            <div className="text-[9px] font-bold opacity-75 mb-1">
                              {m.senderName || m.role} • {new Date(m.timestamp).toLocaleTimeString()}
                            </div>
                            <div className="whitespace-pre-wrap break-words break-all">{m.content}</div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Reply Input */}
                    {activeTicket.status !== 'closed' ? (
                      <form onSubmit={handleReplyTicket} className="pt-4 border-t border-slate-800 flex flex-col sm:flex-row gap-2">
                        <input
                          type="text"
                          placeholder="Type reply to send back to website visitor widget..."
                          value={replyText}
                          onChange={(e) => setReplyText(e.target.value)}
                          className="flex-1 px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-xs text-white focus:outline-none focus:border-emerald-500"
                        />
                        <button
                          type="submit"
                          disabled={submittingReply || !replyText.trim()}
                          className="w-full sm:w-auto px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition-all disabled:opacity-50 cursor-pointer text-center"
                        >
                          {submittingReply ? 'Relaying...' : 'Send'}
                        </button>
                      </form>
                    ) : (
                      <div className="p-3 rounded-xl bg-slate-900/80 text-center text-xs text-slate-500 font-semibold">
                        This support ticket is closed.
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="flex-1 flex items-center justify-center text-slate-500 text-xs text-center p-4">
                    Select a ticket on the left to inspect conversation transcript and relay replies.
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </main>

      <Footer />
    </div>
  );
}
