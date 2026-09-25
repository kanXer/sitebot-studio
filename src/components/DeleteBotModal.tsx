'use client';

import React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Trash2, AlertCircle, Plus, LayoutDashboard, Home, CheckCircle2 } from 'lucide-react';

interface DeleteBotModalProps {
  isOpen: boolean;
  onClose: () => void;
  botName?: string;
  type?: 'deleted' | 'not_found';
  customMessage?: string;
}

export function DeleteBotModal({
  isOpen,
  onClose,
  botName = 'Chatbot',
  type = 'deleted',
  customMessage,
}: DeleteBotModalProps) {
  const router = useRouter();

  if (!isOpen) return null;

  const isDeleted = type === 'deleted';

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-md rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl p-6 sm:p-8 relative overflow-hidden text-slate-900 dark:text-slate-100 text-center">
        {/* Top Accent Strip */}
        <div
          className={`h-1.5 w-full absolute top-0 left-0 ${
            isDeleted
              ? 'bg-gradient-to-r from-red-500 via-rose-500 to-amber-500'
              : 'bg-gradient-to-r from-amber-500 via-orange-500 to-indigo-500'
          }`}
        />

        {/* Icon */}
        <div className="mx-auto mb-4 flex items-center justify-center">
          <div
            className={`w-14 h-14 rounded-2xl flex items-center justify-center shadow-lg ${
              isDeleted
                ? 'bg-rose-50 dark:bg-rose-950/50 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-800'
                : 'bg-amber-50 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-800'
            }`}
          >
            {isDeleted ? (
              <Trash2 className="w-7 h-7 stroke-[2.2]" />
            ) : (
              <AlertCircle className="w-7 h-7 stroke-[2.2]" />
            )}
          </div>
        </div>

        {/* Heading */}
        <h3 className="text-lg font-bold tracking-tight text-slate-900 dark:text-white font-heading">
          {isDeleted ? 'Chatbot Successfully Deleted' : 'Chatbot Not Found'}
        </h3>

        {/* Description */}
        <p className="mt-2 text-xs text-slate-500 dark:text-slate-400 leading-relaxed max-w-xs mx-auto">
          {customMessage ||
            (isDeleted
              ? `"${botName}" and its vector indices have been removed from your workspace.`
              : 'This chatbot ID or URL does not exist or may have already been deleted.')}
        </p>

        {/* Navigation Buttons */}
        <div className="mt-6 space-y-2.5">
          <button
            type="button"
            onClick={() => {
              onClose();
              router.push('/create');
            }}
            className="w-full py-3 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-extrabold text-xs shadow-md shadow-indigo-600/25 transition-all flex items-center justify-center gap-2 cursor-pointer hover:scale-[1.01] active:scale-[0.99]"
          >
            <Plus className="w-4 h-4 stroke-[2.5]" />
            <span>Create New Chatbot</span>
          </button>

          <button
            type="button"
            onClick={() => {
              onClose();
              router.push('/dashboard');
            }}
            className="w-full py-2.5 px-4 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold text-xs border border-slate-200/80 dark:border-slate-700 transition-all flex items-center justify-center gap-2 cursor-pointer"
          >
            <LayoutDashboard className="w-4 h-4 text-indigo-500" />
            <span>Go to Dashboard</span>
          </button>

          <button
            type="button"
            onClick={() => {
              onClose();
              router.push('/');
            }}
            className="w-full py-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 font-medium text-[11px] transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <Home className="w-3.5 h-3.5" />
            <span>Back to Home</span>
          </button>
        </div>
      </div>
    </div>
  );
}
