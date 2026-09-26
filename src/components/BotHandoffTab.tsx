'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  Headphones,
  UserCheck,
  Send,
  Loader2,
  RefreshCw,
  CheckCircle2,
  Clock,
  Check,
  User,
  Bot,
  AlertCircle,
  MessageSquare,
  Shield,
  Smartphone,
  Bell,
} from 'lucide-react';
import { useAuth } from '@/lib/firebase/AuthContext';

interface BotHandoffTabProps {
  botId: string;
  botName: string;
  formData: {
    handoffEnabled: boolean;
    handoffAutoDetect: boolean;
    handoffAgentName: string;
    handoffNotifyEmail: string;
    handoffOfflineMessage: string;
    handoffWhatsappEnabled?: boolean;
    handoffWhatsappNumber?: string;
  };
  setFormData: React.Dispatch<React.SetStateAction<any>>;
  onSave: (e: React.FormEvent) => void;
  saveSuccess: boolean;
}

export function BotHandoffTab({
  botId,
  botName,
  formData,
  setFormData,
  onSave,
  saveSuccess,
}: BotHandoffTabProps) {
  const { user } = useAuth();
  const [conversations, setConversations] = useState<any[]>([]);
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<'all' | 'waiting_agent' | 'agent_active' | 'resolved'>('all');
  const [loading, setLoading] = useState(true);
  const [agentReply, setAgentReply] = useState('');
  const [sendingReply, setSendingReply] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  const fetchConversations = async () => {
    try {
      const headers: Record<string, string> = {};
      if (user?.email) headers['x-user-email'] = user.email;
      if (user?.uid) headers['x-user-id'] = user.uid;

      const res = await fetch(`/api/bot/${botId}/handoff?status=${statusFilter}`, { headers });
      if (res.ok) {
        const data = await res.json();
        setConversations(data.conversations || []);
        if (!selectedSessionId && data.conversations?.length > 0) {
          setSelectedSessionId(data.conversations[0].sessionId);
        }
      }
    } catch (err) {
      console.error('Fetch conversations error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchConversations();
    const interval = setInterval(fetchConversations, 3500);
    return () => clearInterval(interval);
  }, [botId, statusFilter, user?.email, user?.uid]);

  const activeConversation = conversations.find((c) => c.sessionId === selectedSessionId) || null;
  const transcriptScrollRef = useRef<HTMLDivElement>(null);
  const transcriptFollowRef = useRef(true);

  // Scroll the transcript INSIDE its own card only when already at the bottom,
  // so the outer page never jumps to the footer while fresh messages arrive.
  useEffect(() => {
    const el = transcriptScrollRef.current;
    if (!el || !transcriptFollowRef.current) return;
    el.scrollTop = el.scrollHeight;
  }, [activeConversation?.messages]);

  const handleAgentAction = async (action: 'accept' | 'reply' | 'resolve') => {
    if (!selectedSessionId) return;
    if (action === 'reply' && !agentReply.trim()) return;

    if (action === 'reply') setSendingReply(true);
    else setActionLoading(true);

    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (user?.email) headers['x-user-email'] = user.email;
      if (user?.uid) headers['x-user-id'] = user.uid;

      const res = await fetch(`/api/bot/${botId}/handoff`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          action,
          sessionId: selectedSessionId,
          agentName: formData.handoffAgentName || 'Support Agent',
          message: agentReply.trim(),
        }),
      });

      if (res.ok) {
        if (action === 'reply') setAgentReply('');
        await fetchConversations();
      }
    } catch (err) {
      console.error('Agent action error:', err);
    } finally {
      setSendingReply(false);
      setActionLoading(false);
    }
  };

  return (
    <div className="w-full min-w-0 max-w-full space-y-8">
      {/* Top Banner */}
      <div className="relative w-full min-w-0 max-w-full overflow-hidden bg-gradient-to-r from-emerald-950 via-slate-900 to-indigo-950 rounded-3xl p-4 sm:p-6 lg:p-8 text-white border border-emerald-500/20 shadow-xl">
        <div className="absolute top-0 right-0 w-80 h-80 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 min-w-0 max-w-2xl">
          <div className="mb-3 inline-flex max-w-full items-center gap-2 rounded-full bg-emerald-500/20 border border-emerald-400/30 px-3 py-1 text-emerald-300 text-xs font-bold uppercase tracking-wider">
            <Headphones className="w-3.5 h-3.5 shrink-0" />
            <span className="min-w-0 break-words">Live Human Handoff Engine</span>
          </div>
          <h2 className="mb-2 break-words text-xl sm:text-2xl font-black tracking-tight">
            Seamless Live Escalation &amp; Agent Console
          </h2>
          <p className="break-words text-xs sm:text-sm text-slate-300 leading-relaxed">
            When a visitor asks to talk to a person, encounters complex requirements, or expresses
            frustration, the AI transfers the conversation to your live agent queue in real time.
          </p>
        </div>
      </div>

      {/* Configuration Form Card */}
      <div className="w-full min-w-0 max-w-full bg-white rounded-3xl p-4 sm:p-6 border border-slate-200 shadow-sm space-y-6">
        <div className="flex min-w-0 flex-col items-start justify-between gap-4 pb-4 border-b border-slate-100 sm:flex-row sm:items-center">
          <div className="min-w-0">
            <h3 className="flex min-w-0 items-start gap-2 text-sm font-bold text-slate-900">
              <Headphones className="w-4 h-4 shrink-0 text-emerald-600" />
              <span className="break-words">Live Escalation Rules &amp; Profile</span>
            </h3>
            <p className="text-xs text-slate-500 mt-0.5 break-words">
              Control when visitors are offered live transfer and set agent credentials.
            </p>
          </div>
          <button
            type="button"
            onClick={onSave}
            className="flex w-full min-w-0 max-w-full items-center justify-center gap-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 px-4 py-2 text-white text-xs font-bold shadow-sm transition-all sm:w-auto sm:shrink-0"
          >
            {saveSuccess ? (
              <Check className="w-3.5 h-3.5 shrink-0" />
            ) : (
              <UserCheck className="w-3.5 h-3.5 shrink-0" />
            )}
            <span className="break-words">{saveSuccess ? 'Saved!' : 'Save Handoff Settings'}</span>
          </button>
        </div>

        <div className="grid min-w-0 grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {/* Master Switch */}
          <div className="flex min-w-0 items-center justify-between gap-3 rounded-2xl bg-slate-50 border border-slate-200 p-4">
            <div className="min-w-0">
              <span className="block break-words text-xs font-bold text-slate-800">
                Enable Live Handoff
              </span>
              <span className="block break-words text-[11px] text-slate-500">Allow human takeover</span>
            </div>
            <label className="relative inline-flex shrink-0 items-center cursor-pointer">
              <input
                type="checkbox"
                checked={formData.handoffEnabled}
                onChange={(e) =>
                  setFormData((prev: any) => ({ ...prev, handoffEnabled: e.target.checked }))
                }
                className="sr-only peer"
              />
              <div className="w-10 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-600"></div>
            </label>
          </div>

          {/* Auto Intent Detection */}
          <div className="flex min-w-0 items-center justify-between gap-3 rounded-2xl bg-slate-50 border border-slate-200 p-4">
            <div className="min-w-0">
              <span className="block break-words text-xs font-bold text-slate-800">
                Auto-Detect Intent
              </span>
              <span className="block break-words text-[11px] text-slate-500">
                Trigger on frustration / request
              </span>
            </div>
            <label className="relative inline-flex shrink-0 items-center cursor-pointer">
              <input
                type="checkbox"
                checked={formData.handoffAutoDetect}
                onChange={(e) =>
                  setFormData((prev: any) => ({ ...prev, handoffAutoDetect: e.target.checked }))
                }
                className="sr-only peer"
              />
              <div className="w-10 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-600"></div>
            </label>
          </div>

          {/* Support Agent Name */}
          <div className="min-w-0">
            <label className="mb-1 block break-words text-xs font-bold uppercase tracking-wider text-slate-700">
              Support Agent Display Name
            </label>
            <input
              type="text"
              value={formData.handoffAgentName}
              onChange={(e) =>
                setFormData((prev: any) => ({ ...prev, handoffAgentName: e.target.value }))
              }
              placeholder="e.g. Sarah from Support"
              className="w-full min-w-0 max-w-full px-3.5 py-2 rounded-xl bg-slate-50 border border-slate-300 text-xs text-slate-900 focus:bg-white focus:outline-none focus:border-emerald-600 shadow-sm"
            />
          </div>
        </div>

        {/* Offline Message */}
        <div className="min-w-0">
          <label className="mb-1 block break-words text-xs font-bold uppercase tracking-wider text-slate-700">
            Offline / Unavailable Notice
          </label>
          <input
            type="text"
            value={formData.handoffOfflineMessage}
            onChange={(e) =>
              setFormData((prev: any) => ({ ...prev, handoffOfflineMessage: e.target.value }))
            }
            placeholder="Our human support agents are currently offline..."
            className="w-full min-w-0 max-w-full px-3.5 py-2 rounded-xl bg-slate-50 border border-slate-300 text-xs text-slate-900 focus:bg-white focus:outline-none focus:border-emerald-600 shadow-sm"
          />
        </div>

        {/* WhatsApp Real-Time Notification & Live Two-Way Relay */}
        <div className="rounded-2xl border border-emerald-500/30 bg-gradient-to-br from-emerald-50/70 via-white to-slate-50 p-4 sm:p-5 shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-emerald-100">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-emerald-600 flex items-center justify-center text-white shadow-sm shrink-0">
                <Smartphone className="w-4 h-4" />
              </div>
              <div>
                <h4 className="text-xs font-bold text-slate-900 flex items-center gap-2">
                  WhatsApp Instant Escalation Alerts
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                    Two-Way Relay
                  </span>
                </h4>
                <p className="text-[11px] text-slate-500">
                  Receive WhatsApp alerts on your phone whenever a visitor requests human support, and reply directly from WhatsApp.
                </p>
              </div>
            </div>
            <label className="relative inline-flex shrink-0 items-center cursor-pointer">
              <input
                type="checkbox"
                checked={Boolean(formData.handoffWhatsappEnabled)}
                onChange={(e) =>
                  setFormData((prev: any) => ({
                    ...prev,
                    handoffWhatsappEnabled: e.target.checked,
                  }))
                }
                className="sr-only peer"
              />
              <div className="w-10 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-600"></div>
            </label>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
            <div>
              <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-slate-700">
                Agent WhatsApp Phone Number
              </label>
              <input
                type="tel"
                value={formData.handoffWhatsappNumber || ''}
                onChange={(e) =>
                  setFormData((prev: any) => ({
                    ...prev,
                    handoffWhatsappNumber: e.target.value,
                  }))
                }
                placeholder="+919876543210 (with country code)"
                className="w-full px-3.5 py-2 rounded-xl bg-white border border-slate-300 text-xs text-slate-900 focus:outline-none focus:border-emerald-600 shadow-sm"
              />
              <span className="block mt-1 text-[11px] text-slate-400">
                Include country code (e.g. +91 for India, +1 for US). Leave empty to use admin WhatsApp account.
              </span>
            </div>

            <div className="rounded-xl bg-slate-900 text-slate-300 p-3 text-[11px] space-y-1.5 border border-slate-800">
              <span className="font-bold text-emerald-400 flex items-center gap-1.5 text-xs">
                <Bell className="w-3.5 h-3.5" /> Two-Way WhatsApp Instructions:
              </span>
              <p>
                1. When a visitor triggers handoff, you receive: <code className="text-white bg-slate-800 px-1 rounded font-mono">🔴 New Support Request [#TICK-XXXX]</code>
              </p>
              <p>
                2. Reply directly on WhatsApp: <code className="text-emerald-300 bg-slate-800 px-1 rounded font-mono">#TICK-XXXX your message</code>. Your message will instantly appear in the visitor&apos;s live chat!
              </p>
              <p>
                3. End session: send <code className="text-amber-300 bg-slate-800 px-1 rounded font-mono">#TICK-XXXX /close</code> to restore AI assistant.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Live Handoff Inbox & Chat Console */}
      <div className="flex h-[680px] w-full min-w-0 max-w-full flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm lg:flex-row">
        {/* Left Column: Conversations Queue */}
        <div className="flex h-[300px] w-full min-w-0 shrink-0 flex-col border-b border-slate-200 bg-slate-50/50 lg:h-full lg:w-80 lg:border-b-0 lg:border-r">
          <div className="flex min-w-0 items-center justify-between gap-3 p-4 border-b border-slate-200">
            <div className="flex min-w-0 items-center gap-2">
              <Headphones className="w-4 h-4 shrink-0 text-emerald-600" />
              <span className="min-w-0 break-words text-xs font-bold text-slate-900">Live Queue</span>
              <span className="shrink-0 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                {conversations.length}
              </span>
            </div>
            <button
              onClick={fetchConversations}
              className="shrink-0 p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200 transition-colors"
              title="Refresh Queue"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>

          {/* Filter Pills */}
          <div className="flex max-w-full gap-1 overflow-x-auto overscroll-x-contain bg-white p-2 text-[10px] font-bold border-b border-slate-200">
            {(['all', 'waiting_agent', 'agent_active', 'resolved'] as const).map((st) => (
              <button
                key={st}
                onClick={() => setStatusFilter(st)}
                className={`shrink-0 whitespace-nowrap rounded-lg px-2.5 py-1 capitalize transition-colors ${
                  statusFilter === st
                    ? 'bg-emerald-600 text-white shadow-sm'
                    : 'text-slate-500 hover:bg-slate-100'
                }`}
              >
                {st.replace('_', ' ')}
              </button>
            ))}
          </div>

          {/* Conversations List */}
          <div className="min-h-0 min-w-0 flex-1 divide-y divide-slate-100 overflow-y-auto">
            {conversations.length === 0 ? (
              <div className="space-y-2 p-8 text-center text-xs text-slate-400">
                <Clock className="w-6 h-6 mx-auto text-slate-300" />
                <p>No conversations in queue.</p>
              </div>
            ) : (
              conversations.map((c) => {
                const isSelected = c.sessionId === selectedSessionId;
                const isWaiting = c.status === 'waiting_agent';
                const isActive = c.status === 'agent_active';
                const lastMsg = c.messages?.[c.messages.length - 1];

                return (
                  <button
                    key={c.id}
                    onClick={() => setSelectedSessionId(c.sessionId)}
                    className={`flex w-full min-w-0 max-w-full flex-col gap-1.5 p-3.5 text-left transition-all ${
                      isSelected
                        ? 'bg-white shadow-sm border-l-4 border-emerald-600'
                        : 'hover:bg-slate-100/80 border-l-4 border-transparent'
                    }`}
                  >
                    <div className="flex w-full min-w-0 items-center justify-between gap-2">
                      <span className="min-w-0 flex-1 truncate text-xs font-bold text-slate-900">
                        {c.visitor?.name || 'Visitor'}
                      </span>
                      <span
                        className={`shrink-0 whitespace-nowrap rounded-full px-2 py-0.5 text-[9px] font-extrabold uppercase ${
                          isWaiting
                            ? 'bg-amber-100 text-amber-800 animate-pulse'
                            : isActive
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-slate-200 text-slate-700'
                        }`}
                      >
                        {c.status.replace('_', ' ')}
                      </span>
                    </div>

                    {lastMsg && (
                      <p className="min-w-0 break-words text-[11px] text-slate-500 line-clamp-1">
                        {lastMsg.content}
                      </p>
                    )}

                    <div className="flex min-w-0 items-center justify-between gap-2 text-[10px] text-slate-400 font-mono">
                      <span className="min-w-0 truncate">{c.messages?.length || 0} messages</span>
                      <span className="shrink-0">
                        {c.lastMessageAt
                          ? new Date(c.lastMessageAt).toLocaleTimeString([], {
                              hour: '2-digit',
                              minute: '2-digit',
                            })
                          : ''}
                      </span>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* Right Column: Live Conversation Room */}
        <div className="flex min-h-0 min-w-0 max-w-full flex-1 flex-col bg-white">
          {activeConversation ? (
            <>
              {/* Active Conversation Top Bar */}
              <div className="flex w-full min-w-0 max-w-full flex-wrap items-center justify-between gap-3 bg-slate-50/50 p-3 border-b border-slate-200 sm:p-4">
                <div className="flex min-w-0 max-w-full flex-1 items-start gap-3">
                  <div className="flex w-9 h-9 shrink-0 items-center justify-center rounded-full bg-emerald-100 font-bold text-xs text-emerald-700">
                    <User className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <h4 className="flex min-w-0 flex-wrap items-baseline gap-x-1.5 text-xs font-bold text-slate-900">
                      <span className="min-w-0 break-words">
                        {activeConversation.visitor?.name || 'Visitor'}
                      </span>
                      {activeConversation.visitor?.email && (
                        <span className="min-w-0 break-all font-normal text-slate-400">
                          ({activeConversation.visitor.email})
                        </span>
                      )}
                    </h4>
                    <div className="flex min-w-0 flex-wrap items-center gap-2 text-[10px] text-slate-500 font-mono">
                      <span className="min-w-0 break-all">
                        Session: {activeConversation.sessionId.slice(0, 16)}
                      </span>
                      {activeConversation.handoffReason && (
                        <span className="min-w-0 max-w-full break-words rounded bg-amber-50 px-1.5 py-0.5 font-bold text-amber-700">
                          Trigger: {activeConversation.handoffReason}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex w-full min-w-0 flex-wrap items-center gap-2 sm:w-auto sm:flex-nowrap sm:justify-end">
                  {activeConversation.status === 'waiting_agent' && (
                    <button
                      onClick={() => handleAgentAction('accept')}
                      disabled={actionLoading}
                      className="flex min-w-0 max-w-full items-center justify-center gap-1 rounded-xl bg-emerald-600 px-3.5 py-1.5 text-xs font-bold text-white shadow-sm transition-all hover:bg-emerald-700"
                    >
                      <UserCheck className="w-3.5 h-3.5 shrink-0" />
                      <span>Accept Chat</span>
                    </button>
                  )}

                  {activeConversation.status !== 'resolved' && (
                    <button
                      onClick={() => handleAgentAction('resolve')}
                      disabled={actionLoading}
                      className="flex min-w-0 max-w-full items-center justify-center rounded-xl border border-slate-300 px-3 py-1.5 text-left text-xs font-semibold text-slate-700 transition-all hover:bg-slate-100 sm:text-center"
                    >
                      Resolve &amp; Return to AI
                    </button>
                  )}
                </div>
              </div>

              {/* Chat Transcript Area */}
              <div
                ref={transcriptScrollRef}
                onScroll={(e) => {
                  const el = e.currentTarget;
                  const dist = el.scrollHeight - el.scrollTop - el.clientHeight;
                  transcriptFollowRef.current = dist <= 80;
                }}
                className="min-h-0 min-w-0 flex-1 space-y-3 overflow-x-hidden overflow-y-auto overscroll-contain bg-slate-50/20 p-3 sm:p-4"
              >
                {activeConversation.messages.map((m: any, idx: number) => {
                  const isUser = m.role === 'user';
                  const isAgent = m.role === 'agent';
                  const isBot = m.role === 'assistant';
                  const isSystem = m.role === 'system';

                  if (isSystem) {
                    return (
                      <div key={idx} className="my-2 flex min-w-0 justify-center">
                        <span className="inline-block max-w-full whitespace-pre-wrap break-words rounded-full border border-slate-200 bg-slate-100 px-3 py-1 text-[10px] font-bold text-slate-600">
                          {m.content}
                        </span>
                      </div>
                    );
                  }

                  return (
                    <div
                      key={idx}
                      className={`flex w-full min-w-0 max-w-[92%] gap-2 sm:max-w-xl ${
                        isUser ? 'justify-end ml-auto' : 'justify-start'
                      }`}
                    >
                      {!isUser && (
                        <div
                          className={`w-7 h-7 rounded-full flex items-center justify-center text-white shrink-0 text-[10px] font-bold ${
                            isAgent ? 'bg-emerald-600' : 'bg-indigo-600'
                          }`}
                        >
                          {isAgent ? <Headphones className="w-3.5 h-3.5" /> : <Bot className="w-3.5 h-3.5" />}
                        </div>
                      )}

                      <div className="min-w-0">
                        <div className="mb-1 flex min-w-0 flex-wrap items-center gap-1.5 text-[10px] text-slate-400">
                          <span className="min-w-0 break-words font-bold text-slate-700">
                            {isUser
                              ? activeConversation.visitor?.name || 'Visitor'
                              : isAgent
                              ? m.senderName || 'Live Agent'
                              : botName}
                          </span>
                          <span className="shrink-0">
                            {m.timestamp
                              ? new Date(m.timestamp).toLocaleTimeString([], {
                                  hour: '2-digit',
                                  minute: '2-digit',
                                })
                              : ''}
                          </span>
                        </div>

                        <div
                          className={`min-w-0 whitespace-pre-wrap break-words rounded-2xl p-3 text-xs leading-relaxed ${
                            isUser
                              ? 'bg-indigo-600 text-white rounded-br-none shadow-sm'
                              : isAgent
                              ? 'bg-emerald-50 text-emerald-950 border border-emerald-200 rounded-bl-none'
                              : 'bg-white text-slate-800 border border-slate-200 rounded-bl-none shadow-sm'
                          }`}
                        >
                          {m.content}
                        </div>
                      </div>
                    </div>
                  );
                })}
                <div />
              </div>

              {/* Agent Reply Box */}
              <div className="w-full min-w-0 max-w-full bg-white p-3 border-t border-slate-200">
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    handleAgentAction('reply');
                  }}
                  className="flex min-w-0 flex-col items-stretch gap-2 sm:flex-row sm:items-center"
                >
                  <input
                    type="text"
                    value={agentReply}
                    onChange={(e) => setAgentReply(e.target.value)}
                    placeholder="Type your live response to the visitor..."
                    className="w-full min-w-0 max-w-full flex-1 rounded-2xl bg-slate-50 px-4 py-2.5 text-xs text-slate-900 shadow-inner focus:border-emerald-600 focus:bg-white focus:outline-none"
                  />
                  <button
                    type="submit"
                    disabled={sendingReply || !agentReply.trim()}
                    className="flex w-full min-w-0 max-w-full items-center justify-center gap-1.5 rounded-2xl bg-emerald-600 px-5 py-2.5 text-xs font-bold text-white shadow-md transition-all hover:bg-emerald-700 disabled:opacity-40 sm:w-auto sm:shrink-0"
                  >
                    {sendingReply ? (
                      <Loader2 className="w-3.5 h-3.5 shrink-0 animate-spin" />
                    ) : (
                      <Send className="w-3.5 h-3.5 shrink-0" />
                    )}
                    <span>Reply</span>
                  </button>
                </form>
              </div>
            </>
          ) : (
            <div className="flex min-h-0 min-w-0 flex-1 flex-col items-center justify-center gap-3 p-6 text-center text-slate-400 sm:p-8">
              <Headphones className="w-10 h-10 shrink-0 text-slate-300" />
              <h4 className="break-words text-sm font-bold text-slate-700">No conversation selected</h4>
              <p className="max-w-xs break-words text-xs text-slate-500">
                Select an active or waiting conversation from the live queue on the left to monitor
                the transcript and reply as a human agent.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
