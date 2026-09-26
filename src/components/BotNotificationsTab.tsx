'use client';

import React, { useState } from 'react';
import {
  Bell,
  Smartphone,
  Mail,
  Send,
  Check,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  Headphones,
  ExternalLink,
  Shield,
  Zap,
} from 'lucide-react';

interface BotNotificationsTabProps {
  botId: string;
  botName: string;
  formData: {
    notificationsEmailEnabled: boolean;
    notificationsEmailTo: string;
    notificationsWhatsappEnabled: boolean;
    notificationsWhatsappNumber: string;
    notificationsTelegramEnabled: boolean;
    notificationsTelegramChatId: string;
    notificationsTelegramBotToken: string;
    handoffWhatsappEnabled?: boolean;
    handoffWhatsappNumber?: string;
  };
  setFormData: React.Dispatch<React.SetStateAction<any>>;
  onSave: (e: React.FormEvent) => void;
  saveSuccess: boolean;
  onNavigateTab?: (tab: string) => void;
}

export function BotNotificationsTab({
  botId,
  botName,
  formData,
  setFormData,
  onSave,
  saveSuccess,
  onNavigateTab,
}: BotNotificationsTabProps) {
  const [testSending, setTestSending] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);

  const handleTestWhatsApp = async () => {
    const target = formData.handoffWhatsappNumber || formData.notificationsWhatsappNumber;
    if (!target) {
      setTestResult({
        success: false,
        message: 'Please enter a WhatsApp phone number first.',
      });
      return;
    }
    setTestSending(true);
    setTestResult(null);
    try {
      const res = await fetch(`/api/whatsapp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'send_test',
          phoneNumber: target,
          message: `👋 *Rivafy Studio Test Notification*\n\nYour WhatsApp notifications are correctly configured for *${botName || 'Chatbot'}*! When visitors submit leads or request live agent handoff, you will receive real-time alerts here.`,
        }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setTestResult({
          success: true,
          message: 'Test message sent successfully to your WhatsApp!',
        });
      } else {
        setTestResult({
          success: false,
          message: data.error || 'Failed to send test message. Check that WhatsApp is connected in Admin Panel.',
        });
      }
    } catch (err: any) {
      setTestResult({
        success: false,
        message: err.message || 'Network error sending WhatsApp test alert',
      });
    } finally {
      setTestSending(false);
    }
  };

  return (
    <div className="w-full min-w-0 max-w-full space-y-8">
      {/* Top Banner */}
      <div className="relative w-full min-w-0 max-w-full overflow-hidden bg-gradient-to-r from-indigo-950 via-slate-900 to-emerald-950 rounded-3xl p-4 sm:p-6 lg:p-8 text-white border border-indigo-500/20 shadow-xl">
        <div className="absolute top-0 right-0 w-80 h-80 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 min-w-0 max-w-2xl">
          <div className="mb-3 inline-flex max-w-full items-center gap-2 rounded-full bg-indigo-500/20 border border-indigo-400/30 px-3 py-1 text-indigo-300 text-xs font-bold uppercase tracking-wider">
            <Bell className="w-3.5 h-3.5 shrink-0" />
            <span className="min-w-0 break-words">Multi-Channel Alerts Engine</span>
          </div>
          <h2 className="mb-2 break-words text-xl sm:text-2xl font-black tracking-tight">
            Real-Time Notifications &amp; WhatsApp Relay
          </h2>
          <p className="break-words text-xs sm:text-sm text-slate-300 leading-relaxed">
            Get instant alerts delivered to your personal WhatsApp, Email, or Telegram whenever visitors submit contact forms, capture leads, or request live human support.
          </p>
        </div>
      </div>

      {/* Settings Form Card */}
      <div className="w-full min-w-0 max-w-full bg-white rounded-3xl p-4 sm:p-6 border border-slate-200 shadow-sm space-y-6">
        <div className="flex min-w-0 flex-col items-start justify-between gap-4 pb-4 border-b border-slate-100 sm:flex-row sm:items-center">
          <div className="min-w-0">
            <h3 className="flex min-w-0 items-start gap-2 text-sm font-bold text-slate-900">
              <Zap className="w-4 h-4 shrink-0 text-indigo-600" />
              <span className="break-words">Notification Channels &amp; Delivery</span>
            </h3>
            <p className="text-xs text-slate-500 mt-0.5 break-words">
              Configure target recipients for visitor leads and live handoff escalations.
            </p>
          </div>
          <button
            type="button"
            onClick={onSave}
            className="flex w-full min-w-0 max-w-full items-center justify-center gap-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 px-5 py-2.5 text-white text-xs font-bold shadow-sm transition-all sm:w-auto sm:shrink-0 cursor-pointer"
          >
            {saveSuccess ? (
              <Check className="w-3.5 h-3.5 shrink-0" />
            ) : (
              <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
            )}
            <span className="break-words">{saveSuccess ? 'Saved!' : 'Save Notification Settings'}</span>
          </button>
        </div>

        {/* CHANNEL 1: WhatsApp Notifications (Lead Alerts) */}
        <div className="rounded-2xl border border-emerald-500/30 bg-emerald-50/40 p-4 sm:p-5 shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-emerald-100">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-emerald-600 flex items-center justify-center text-white shadow-sm shrink-0">
                <Smartphone className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-xs font-bold text-slate-900 flex items-center gap-2">
                  WhatsApp Lead Notifications
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                    Baileys Engine
                  </span>
                </h4>
                <p className="text-[11px] text-slate-500">
                  Receive WhatsApp alert on your phone whenever a new lead or contact inquiry is captured.
                </p>
              </div>
            </div>
            <label className="relative inline-flex shrink-0 items-center cursor-pointer">
              <input
                type="checkbox"
                checked={Boolean(formData.notificationsWhatsappEnabled)}
                onChange={(e) =>
                  setFormData((prev: any) => ({
                    ...prev,
                    notificationsWhatsappEnabled: e.target.checked,
                  }))
                }
                className="sr-only peer"
              />
              <div className="w-10 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-600"></div>
            </label>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-slate-700">
                Target WhatsApp Phone Number
              </label>
              <input
                type="tel"
                value={formData.notificationsWhatsappNumber || ''}
                onChange={(e) =>
                  setFormData((prev: any) => ({
                    ...prev,
                    notificationsWhatsappNumber: e.target.value,
                  }))
                }
                placeholder="+919876543210 (with country code)"
                className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-slate-300 text-xs text-slate-900 focus:outline-none focus:border-emerald-600 shadow-sm"
              />
              <span className="block mt-1 text-[11px] text-slate-400">
                Include country code (e.g. +919876543210 for India, +1 for US/Canada).
              </span>
            </div>

            <div className="flex flex-col justify-end">
              <button
                type="button"
                onClick={handleTestWhatsApp}
                disabled={testSending || (!formData.notificationsWhatsappNumber && !formData.handoffWhatsappNumber)}
                className="flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-bold shadow-sm transition-all cursor-pointer"
              >
                {testSending ? (
                  <span className="animate-spin w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full" />
                ) : (
                  <Send className="w-3.5 h-3.5" />
                )}
                <span>Send Test WhatsApp Alert</span>
              </button>
              {testResult && (
                <div
                  className={`mt-2 p-2 rounded-lg text-[11px] font-medium flex items-center gap-1.5 ${
                    testResult.success
                      ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                      : 'bg-rose-100 text-rose-800 border border-rose-300'
                  }`}
                >
                  {testResult.success ? (
                    <CheckCircle2 className="w-3.5 h-3.5 shrink-0 text-emerald-600" />
                  ) : (
                    <AlertCircle className="w-3.5 h-3.5 shrink-0 text-rose-600" />
                  )}
                  <span>{testResult.message}</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* CHANNEL 2: Live Human Handoff WhatsApp Two-Way Relay */}
        <div className="rounded-2xl border border-indigo-500/30 bg-indigo-50/40 p-4 sm:p-5 shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-indigo-100">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-indigo-600 flex items-center justify-center text-white shadow-sm shrink-0">
                <Headphones className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-xs font-bold text-slate-900 flex items-center gap-2">
                  Live Handoff WhatsApp Relay
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-100 text-indigo-800">
                    Two-Way Chat Relay
                  </span>
                </h4>
                <p className="text-[11px] text-slate-500">
                  Instant WhatsApp notification when visitors ask to talk to human. Reply on WhatsApp to chat directly on visitor widget.
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
              <div className="w-10 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-indigo-600"></div>
            </label>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-slate-700">
                Support Agent WhatsApp Number
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
                className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-slate-300 text-xs text-slate-900 focus:outline-none focus:border-indigo-600 shadow-sm"
              />
              <span className="block mt-1 text-[11px] text-slate-400">
                Leave empty to fallback to the Lead Alert number or connected platform admin WhatsApp.
              </span>
            </div>

            <div className="rounded-xl bg-slate-900 text-slate-300 p-3 text-[11px] space-y-1.5 border border-slate-800">
              <span className="font-bold text-indigo-400 flex items-center gap-1.5 text-xs">
                <Bell className="w-3.5 h-3.5" /> How WhatsApp Live Relay Works:
              </span>
              <p>
                1. Visitor clicks &quot;Talk to Human&quot; → You get: <code className="text-white bg-slate-800 px-1 rounded font-mono">🔴 New Support Request [#TICK-XXXX]</code>
              </p>
              <p>
                2. Type reply on WhatsApp: <code className="text-indigo-300 bg-slate-800 px-1 rounded font-mono">#TICK-XXXX Your message</code> → Message renders directly in the visitor&apos;s website widget!
              </p>
              <p>
                3. End session: send <code className="text-amber-300 bg-slate-800 px-1 rounded font-mono">#TICK-XXXX /close</code> to restore AI auto-reply.
              </p>
            </div>
          </div>
        </div>

        {/* CHANNEL 3: Email Notifications (SMTP) */}
        <div className="rounded-2xl border border-slate-200 bg-slate-50/50 p-4 sm:p-5 shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-200">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-slate-800 flex items-center justify-center text-white shadow-sm shrink-0">
                <Mail className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-xs font-bold text-slate-900">
                  Email Lead Notifications
                </h4>
                <p className="text-[11px] text-slate-500">
                  Receive comprehensive lead transcripts and submission details in your inbox.
                </p>
              </div>
            </div>
            <label className="relative inline-flex shrink-0 items-center cursor-pointer">
              <input
                type="checkbox"
                checked={Boolean(formData.notificationsEmailEnabled)}
                onChange={(e) =>
                  setFormData((prev: any) => ({
                    ...prev,
                    notificationsEmailEnabled: e.target.checked,
                  }))
                }
                className="sr-only peer"
              />
              <div className="w-10 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-slate-900"></div>
            </label>
          </div>

          <div className="max-w-md">
            <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-slate-700">
              Notification Recipient Email
            </label>
            <input
              type="email"
              value={formData.notificationsEmailTo || ''}
              onChange={(e) =>
                setFormData((prev: any) => ({
                  ...prev,
                  notificationsEmailTo: e.target.value,
                }))
              }
              placeholder="alerts@yourbusiness.com"
              className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-slate-300 text-xs text-slate-900 focus:outline-none focus:border-slate-900 shadow-sm"
            />
          </div>
        </div>

        {/* CHANNEL 4: Telegram Notifications */}
        <div className="rounded-2xl border border-sky-500/20 bg-sky-50/30 p-4 sm:p-5 shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-sky-100">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-sky-600 flex items-center justify-center text-white shadow-sm shrink-0">
                <Send className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-xs font-bold text-slate-900">
                  Telegram Bot Alerts
                </h4>
                <p className="text-[11px] text-slate-500">
                  Deliver instant alerts to a Telegram Group or private channel via your Telegram Bot.
                </p>
              </div>
            </div>
            <label className="relative inline-flex shrink-0 items-center cursor-pointer">
              <input
                type="checkbox"
                checked={Boolean(formData.notificationsTelegramEnabled)}
                onChange={(e) =>
                  setFormData((prev: any) => ({
                    ...prev,
                    notificationsTelegramEnabled: e.target.checked,
                  }))
                }
                className="sr-only peer"
              />
              <div className="w-10 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-sky-600"></div>
            </label>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-slate-700">
                Telegram Chat ID
              </label>
              <input
                type="text"
                value={formData.notificationsTelegramChatId || ''}
                onChange={(e) =>
                  setFormData((prev: any) => ({
                    ...prev,
                    notificationsTelegramChatId: e.target.value,
                  }))
                }
                placeholder="e.g. -1001234567890 or 987654321"
                className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-slate-300 text-xs text-slate-900 focus:outline-none focus:border-sky-600 shadow-sm"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-slate-700">
                Telegram Bot Token
              </label>
              <input
                type="password"
                value={formData.notificationsTelegramBotToken || ''}
                onChange={(e) =>
                  setFormData((prev: any) => ({
                    ...prev,
                    notificationsTelegramBotToken: e.target.value,
                  }))
                }
                placeholder="123456789:ABCdefGHIjklMNOpqrsTUVwxyz"
                className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-slate-300 text-xs text-slate-900 focus:outline-none focus:border-sky-600 shadow-sm"
              />
            </div>
          </div>
        </div>

        {/* Save Bar */}
        <div className="pt-2 flex justify-end">
          <button
            type="button"
            onClick={onSave}
            className="flex items-center justify-center gap-1.5 px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-md transition-all cursor-pointer"
          >
            {saveSuccess ? (
              <Check className="w-3.5 h-3.5 shrink-0" />
            ) : (
              <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
            )}
            <span>{saveSuccess ? 'Saved Settings!' : 'Save All Notification Settings'}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
