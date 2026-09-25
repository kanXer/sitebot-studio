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
    <div className="space-y-8">
      {/* Top Banner */}
      <div className="bg-gradient-to-r from-emerald-950 via-slate-900 to-indigo-950 rounded-3xl p-6 sm:p-8 text-white border border-emerald-500/20 shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-80 h-80 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 max-w-2xl">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/20 border border-emerald-400/30 text-emerald-300 text-xs font-bold uppercase tracking-wider mb-3">
            <Headphones className="w-3.5 h-3.5" />
            <span>Live Human Handoff Engine</span>
          </div>
          <h2 className="text-xl sm:text-2xl font-black tracking-tight mb-2">
            Seamless Live Escalation &amp; Agent Console
          </h2>
          <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
            When a visitor asks to talk to a person, encounters complex requirements, or expresses
            frustration, the AI transfers the conversation to your live agent queue in real time.
          </p>
        </div>
      </div>

      {/* Configuration Form Card */}
      <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm space-y-6">
        <div className="flex items-center justify-between pb-4 border-b border-slate-100">
          <div>
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <Headphones className="w-4 h-4 text-emerald-600" />
              Live Escalation Rules &amp; Profile
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Control when visitors are offered live transfer and set agent credentials.
            </p>
          </div>
          <button
            type="button"
            onClick={onSave}
            className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-sm transition-all flex items-center gap-1.5"
          >
            {saveSuccess ? <Check className="w-3.5 h-3.5" /> : <UserCheck className="w-3.5 h-3.5" />}
            <span>{saveSuccess ? 'Saved!' : 'Save Handoff Settings'}</span>
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {/* Master Switch */}
          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 flex items-center justify-between">
            <div>
              <span className="text-xs font-bold text-slate-800 block">Enable Live Handoff</span>
              <span className="text-[11px] text-slate-500">Allow human takeover</span>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
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
          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 flex items-center justify-between">
            <div>
              <span className="text-xs font-bold text-slate-800 block">Auto-Detect Intent</span>
              <span className="text-[11px] text-slate-500">Trigger on frustration / request</span>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
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
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
              Support Agent Display Name
            </label>
            <input
              type="text"
              value={formData.handoffAgentName}
              onChange={(e) =>
                setFormData((prev: any) => ({ ...prev, handoffAgentName: e.target.value }))
              }
              placeholder="e.g. Sarah from Support"
              className="w-full px-3.5 py-2 rounded-xl bg-slate-50 border border-slate-300 text-xs text-slate-900 focus:bg-white focus:outline-none focus:border-emerald-600 shadow-sm"
            />
          </div>
        </div>

        {/* Offline Message */}
        <div>
          <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
            Offline / Unavailable Notice
          </label>
          <input
            type="text"
            value={formData.handoffOfflineMessage}
            onChange={(e) =>
              setFormData((prev: any) => ({ ...prev, handoffOfflineMessage: e.target.value }))
            }
            placeholder="Our human support agents are currently offline..."
            className="w-full px-3.5 py-2 rounded-xl bg-slate-50 border border-slate-300 text-xs text-slate-900 focus:bg-white focus:outline-none focus:border-emerald-600 shadow-sm"
          />
        </div>
      </div>

      {/* Live Handoff Inbox & Chat Console */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden flex flex-col lg:flex-row h-[680px]">
        {/* Left Column: Conversations Queue */}
        <div className="w-full lg:w-80 border-r border-slate-200 flex flex-col bg-slate-50/50 shrink-0">
          <div className="p-4 border-b border-slate-200 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Headphones className="w-4 h-4 text-emerald-600" />
              <span className="text-xs font-bold text-slate-900">Live Queue</span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                {conversations.length}
              </span>
            </div>
            <button
              onClick={fetchConversations}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200 transition-colors"
              title="Refresh Queue"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>

          {/* Filter Pills */}
          <div className="p-2 border-b border-slate-200 flex gap-1 bg-white overflow-x-auto text-[10px] font-bold">
            {(['all', 'waiting_agent', 'agent_active', 'resolved'] as const).map((st) => (
              <button
                key={st}
                onClick={() => setStatusFilter(st)}
                className={`px-2.5 py-1 rounded-lg capitalize whitespace-nowrap transition-colors ${
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
          <div className="flex-1 overflow-y-auto divide-y divide-slate-100">
            {conversations.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-400 space-y-2">
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
                    className={`w-full text-left p-3.5 transition-all flex flex-col gap-1.5 ${
                      isSelected
                        ? 'bg-white shadow-sm border-l-4 border-emerald-600'
                        : 'hover:bg-slate-100/80 border-l-4 border-transparent'
                    }`}
                  >
                    <div className="flex items-center justify-between w-full">
                      <span className="font-bold text-xs text-slate-900 truncate">
                        {c.visitor?.name || 'Visitor'}
                      </span>
                      <span
                        className={`text-[9px] font-extrabold uppercase px-2 py-0.5 rounded-full ${
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
                      <p className="text-[11px] text-slate-500 line-clamp-1">
                        {lastMsg.content}
                      </p>
                    )}

                    <div className="flex items-center justify-between text-[10px] text-slate-400 font-mono">
                      <span>{c.messages?.length || 0} messages</span>
                      <span>
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
        <div className="flex-1 flex flex-col min-w-0 bg-white">
          {activeConversation ? (
            <>
              {/* Active Conversation Top Bar */}
              <div className="p-4 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 bg-slate-50/50">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold text-xs">
                    <User className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                      <span>{activeConversation.visitor?.name || 'Visitor'}</span>
                      {activeConversation.visitor?.email && (
                        <span className="text-slate-400 font-normal">
                          ({activeConversation.visitor.email})
                        </span>
                      )}
                    </h4>
                    <div className="flex items-center gap-2 text-[10px] text-slate-500 font-mono">
                      <span>Session: {activeConversation.sessionId.slice(0, 16)}</span>
                      {activeConversation.handoffReason && (
                        <span className="text-amber-700 font-bold bg-amber-50 px-1.5 py-0.5 rounded">
                          Trigger: {activeConversation.handoffReason}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {activeConversation.status === 'waiting_agent' && (
                    <button
                      onClick={() => handleAgentAction('accept')}
                      disabled={actionLoading}
                      className="px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center gap-1 shadow-sm transition-all"
                    >
                      <UserCheck className="w-3.5 h-3.5" />
                      <span>Accept Chat</span>
                    </button>
                  )}

                  {activeConversation.status !== 'resolved' && (
                    <button
                      onClick={() => handleAgentAction('resolve')}
                      disabled={actionLoading}
                      className="px-3 py-1.5 rounded-xl border border-slate-300 hover:bg-slate-100 text-slate-700 text-xs font-semibold transition-all"
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
                className="flex-1 p-4 overflow-y-auto space-y-3 bg-slate-50/20"
              >
                {activeConversation.messages.map((m: any, idx: number) => {
                  const isUser = m.role === 'user';
                  const isAgent = m.role === 'agent';
                  const isBot = m.role === 'assistant';
                  const isSystem = m.role === 'system';

                  if (isSystem) {
                    return (
                      <div key={idx} className="flex justify-center my-2">
                        <span className="text-[10px] font-bold px-3 py-1 rounded-full bg-slate-100 text-slate-600 border border-slate-200">
                          {m.content}
                        </span>
                      </div>
                    );
                  }

                  return (
                    <div
                      key={idx}
                      className={`flex gap-2 max-w-xl ${isUser ? 'justify-end ml-auto' : 'justify-start'}`}
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

                      <div>
                        <div className="flex items-center gap-1.5 mb-1 text-[10px] text-slate-400">
                          <span className="font-bold text-slate-700">
                            {isUser
                              ? activeConversation.visitor?.name || 'Visitor'
                              : isAgent
                              ? m.senderName || 'Live Agent'
                              : botName}
                          </span>
                          <span>
                            {m.timestamp
                              ? new Date(m.timestamp).toLocaleTimeString([], {
                                  hour: '2-digit',
                                  minute: '2-digit',
                                })
                              : ''}
                          </span>
                        </div>

                        <div
                          className={`p-3 rounded-2xl text-xs leading-relaxed ${
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
              <div className="p-3 border-t border-slate-200 bg-white">
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    handleAgentAction('reply');
                  }}
                  className="flex items-center gap-2"
                >
                  <input
                    type="text"
                    value={agentReply}
                    onChange={(e) => setAgentReply(e.target.value)}
                    placeholder="Type your live response to the visitor..."
                    className="flex-1 px-4 py-2.5 rounded-2xl bg-slate-50 border border-slate-300 text-xs text-slate-900 focus:bg-white focus:outline-none focus:border-emerald-600 shadow-inner"
                  />
                  <button
                    type="submit"
                    disabled={sendingReply || !agentReply.trim()}
                    className="px-5 py-2.5 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-md transition-all flex items-center gap-1.5 disabled:opacity-40"
                  >
                    {sendingReply ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                    <span>Reply</span>
                  </button>
                </form>
              </div>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-slate-400 gap-3">
              <Headphones className="w-10 h-10 text-slate-300" />
              <h4 className="text-sm font-bold text-slate-700">No conversation selected</h4>
              <p className="text-xs max-w-xs text-slate-500">
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
