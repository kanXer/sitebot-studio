'use client';

import React, { useState, useEffect } from 'react';
import {
  Inbox,
  Search,
  Download,
  Trash2,
  Mail,
  Phone,
  Calendar,
  User,
  MessageSquare,
  Loader2,
  RefreshCw,
  CheckCircle2,
} from 'lucide-react';
import { useAuth } from '@/lib/firebase/AuthContext';

interface BotLeadsTabProps {
  botId: string;
  botName: string;
}

export function BotLeadsTab({ botId, botName }: BotLeadsTabProps) {
  const { user } = useAuth();
  const [submissions, setSubmissions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const fetchLeads = async () => {
    setLoading(true);
    try {
      const headers: Record<string, string> = {};
      if (user?.email) headers['x-user-email'] = user.email;
      if (user?.uid) headers['x-user-id'] = user.uid;

      const res = await fetch(`/api/bot/${botId}/leads`, { headers });
      if (res.ok) {
        const data = await res.json();
        setSubmissions(data.submissions || []);
      }
    } catch (err) {
      console.error('Failed to fetch bot leads:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLeads();
  }, [botId, user?.email, user?.uid]);

  const handleDelete = async (submissionId: string) => {
    if (!confirm('Are you sure you want to delete this captured lead?')) return;
    setDeletingId(submissionId);
    try {
      const headers: Record<string, string> = {};
      if (user?.email) headers['x-user-email'] = user.email;
      if (user?.uid) headers['x-user-id'] = user.uid;

      const res = await fetch(`/api/bot/${botId}/leads?submissionId=${submissionId}`, {
        method: 'DELETE',
        headers,
      });
      if (res.ok) {
        setSubmissions((prev) => prev.filter((s) => s.id !== submissionId));
      }
    } catch (err) {
      console.error('Delete lead error:', err);
    } finally {
      setDeletingId(null);
    }
  };

  const filtered = submissions.filter((s) => {
    const d = s.data || {};
    const text = `${d.name || ''} ${d.email || ''} ${d.phone || ''} ${d.message || ''}`.toLowerCase();
    return text.includes(searchQuery.toLowerCase());
  });

  return (
    <div className="w-full min-w-0 max-w-full space-y-6">
      {/* Top Header Card */}
      <div className="w-full min-w-0 max-w-full bg-white rounded-3xl p-4 sm:p-6 border border-slate-200 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="min-w-0">
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <Inbox className="w-5 h-5 shrink-0 text-indigo-600" />
            <h3 className="min-w-0 break-words text-base font-bold text-slate-900">
              Captured Leads &amp; Form Inquiries
            </h3>
            <span className="shrink-0 px-2.5 py-0.5 rounded-full text-xs font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
              {submissions.length} Leads
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1 break-words">
            Customer inquiries, dynamic form submissions, and contact details gathered by {botName}.
          </p>
        </div>

        <div className="flex w-full min-w-0 flex-wrap items-center gap-2.5 sm:w-auto sm:flex-nowrap sm:justify-end">
          <button
            onClick={fetchLeads}
            disabled={loading}
            className="max-w-full shrink-0 p-2.5 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-600 transition-colors"
            title="Refresh Leads"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>

          <a
            href={`/api/bot/${botId}/leads?format=csv`}
            download
            className="inline-flex min-w-0 max-w-full items-center justify-center gap-2 whitespace-nowrap px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-md transition-all"
          >
            <Download className="w-4 h-4 shrink-0" />
            <span>Export to CSV</span>
          </a>
        </div>
      </div>

      {/* Search Input */}
      <div className="relative w-full min-w-0 max-w-full">
        <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Filter leads by contact name, email, phone, or requirements..."
          className="w-full min-w-0 max-w-full pl-10 pr-4 py-2.5 rounded-2xl bg-white border border-slate-200 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-indigo-600 shadow-sm"
        />
      </div>

      {/* Leads Table / Cards */}
      {loading ? (
        <div className="flex w-full min-w-0 max-w-full flex-col items-center justify-center gap-3 rounded-3xl bg-white p-6 border border-slate-200 text-slate-400 sm:p-12">
          <Loader2 className="w-6 h-6 animate-spin text-indigo-600" />
          <span className="text-xs">Loading captured leads...</span>
        </div>
      ) : filtered.length === 0 ? (
        <div className="w-full min-w-0 max-w-full space-y-3 rounded-3xl bg-white p-6 text-center border border-slate-200 sm:p-12">
          <div className="flex w-12 h-12 mx-auto items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600">
            <Inbox className="w-6 h-6" />
          </div>
          <h4 className="break-words text-sm font-bold text-slate-900">No leads captured yet</h4>
          <p className="mx-auto max-w-sm break-words text-xs text-slate-500">
            When visitors share contact information or submit quote requests in the chat widget,
            they will automatically be cataloged here.
          </p>
        </div>
      ) : (
        <div className="w-full min-w-0 max-w-full overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
          <div className="max-w-full overflow-x-auto overscroll-x-contain">
            <table className="w-full min-w-[760px] text-left text-xs text-slate-600">
              <thead className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                <tr>
                  <th className="px-5 py-3.5">Contact Details</th>
                  <th className="px-5 py-3.5">Requirements / Message</th>
                  <th className="px-5 py-3.5">Form / Channel</th>
                  <th className="px-5 py-3.5">Captured Date</th>
                  <th className="px-5 py-3.5 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium">
                {filtered.map((item) => {
                  const d = item.data || {};
                  return (
                    <tr key={item.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="min-w-[190px] px-5 py-4 align-top">
                        <div className="min-w-0 space-y-1">
                          <div className="flex min-w-0 items-center gap-1.5 font-bold text-slate-900">
                            <User className="w-3.5 h-3.5 shrink-0 text-indigo-600" />
                            <span className="min-w-0 break-words">
                              {d.name || 'Anonymous Visitor'}
                            </span>
                          </div>
                          {d.email && (
                            <div className="flex min-w-0 items-center gap-1.5 text-slate-600 font-mono text-[11px]">
                              <Mail className="w-3 h-3 shrink-0 text-slate-400" />
                              <a
                                href={`mailto:${d.email}`}
                                className="min-w-0 break-all hover:underline"
                              >
                                {d.email}
                              </a>
                            </div>
                          )}
                          {d.phone && (
                            <div className="flex min-w-0 items-center gap-1.5 text-slate-600 font-mono text-[11px]">
                              <Phone className="w-3 h-3 shrink-0 text-slate-400" />
                              <a href={`tel:${d.phone}`} className="min-w-0 break-all hover:underline">
                                {d.phone}
                              </a>
                            </div>
                          )}
                        </div>
                      </td>

                      <td className="min-w-[240px] max-w-xs px-5 py-4 align-top sm:max-w-md">
                        <p className="whitespace-pre-wrap break-words text-xs text-slate-800 line-clamp-3 leading-relaxed">
                          {d.message || 'No additional note provided.'}
                        </p>
                      </td>

                      <td className="min-w-[160px] px-5 py-4 align-top">
                        <span className="inline-block max-w-[180px] break-words rounded-full border border-slate-200 bg-slate-100 px-2.5 py-1 text-[10px] font-bold text-slate-700">
                          {item.formTitle || d.source || 'Lead Capture'}
                        </span>
                      </td>

                      <td className="whitespace-nowrap px-5 py-4 align-top font-mono text-[11px] text-slate-500">
                        <div className="flex items-center gap-1">
                          <Calendar className="w-3 h-3 shrink-0 text-slate-400" />
                          <span>
                            {item.createdAt
                              ? new Date(item.createdAt).toLocaleDateString(undefined, {
                                  month: 'short',
                                  day: 'numeric',
                                  hour: '2-digit',
                                  minute: '2-digit',
                                })
                              : 'Recently'}
                          </span>
                        </div>
                      </td>

                      <td className="px-5 py-4 text-right align-top">
                        <button
                          onClick={() => handleDelete(item.id)}
                          disabled={deletingId === item.id}
                          className="shrink-0 p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                          title="Delete Lead"
                        >
                          {deletingId === item.id ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <Trash2 className="w-4 h-4" />
                          )}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
