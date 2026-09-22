'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Bot,
  FolderHeart,
  Plus,
  ExternalLink,
  X,
  Trash2,
  Menu,
  Sparkles,
  Loader2,
  Globe,
  ArrowRight,
  Sun,
  Moon,
} from 'lucide-react';

interface SavedBot {
  id: string;
  name: string;
  siteUrl: string;
  createdAt?: string;
}

export function Navbar() {
  const pathname = usePathname();
  const [savedBots, setSavedBots] = useState<SavedBot[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [theme, setTheme] = useState<'light' | 'dark'>('light');

  // Track & sync theme with DOM and localStorage
  useEffect(() => {
    const isDark = document.documentElement.classList.contains('dark');
    setTheme(isDark ? 'dark' : 'light');

    const observer = new MutationObserver(() => {
      const currentIsDark = document.documentElement.classList.contains('dark');
      setTheme(currentIsDark ? 'dark' : 'light');
    });

    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class', 'data-theme'],
    });

    return () => observer.disconnect();
  }, []);

  const toggleTheme = () => {
    const nextTheme = theme === 'dark' ? 'light' : 'dark';
    setTheme(nextTheme);
    if (nextTheme === 'dark') {
      document.documentElement.classList.add('dark');
      document.documentElement.setAttribute('data-theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      document.documentElement.setAttribute('data-theme', 'light');
    }
    try {
      localStorage.setItem('sitebot_theme', nextTheme);
    } catch {}
  };

  // Sync bots from database and localStorage
  const fetchBots = async () => {
    try {
      const res = await fetch('/api/bot');
      if (res.ok) {
        const data = await res.json();
        const bots = data.bots || [];
        setSavedBots(bots);
        try {
          localStorage.setItem('sitebot_saved_bots', JSON.stringify(bots.slice(0, 25)));
        } catch {}
        return;
      }
    } catch {}

    try {
      const stored = localStorage.getItem('sitebot_saved_bots');
      if (stored) {
        setSavedBots(JSON.parse(stored));
      }
    } catch {}
  };

  useEffect(() => {
    fetchBots();

    const handleDeleted = (e: any) => {
      const deletedId = e.detail?.id;
      if (deletedId) {
        setSavedBots((prev) => prev.filter((b) => b.id !== deletedId));
      }
    };

    const handleCreated = () => {
      fetchBots();
    };

    window.addEventListener('sitebot_deleted', handleDeleted);
    window.addEventListener('sitebot_created', handleCreated);

    return () => {
      window.removeEventListener('sitebot_deleted', handleDeleted);
      window.removeEventListener('sitebot_created', handleCreated);
    };
  }, []);

  // Permanent Delete: DB + localStorage + state
  const removeBot = async (bot: SavedBot, e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();

    if (
      !window.confirm(
        `Delete "${bot.name}"?\nThis permanently removes the chatbot, its vector index, and all crawled knowledge from the database.`
      )
    ) {
      return;
    }

    setDeletingId(bot.id);
    try {
      const res = await fetch(`/api/bot/${bot.id}`, { method: 'DELETE' });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to delete chatbot');
      }

      // Optimistic update
      const updated = savedBots.filter((b) => b.id !== bot.id);
      setSavedBots(updated);
      try {
        localStorage.setItem('sitebot_saved_bots', JSON.stringify(updated));
      } catch {}

      // Notify other components (e.g. Home page project list)
      window.dispatchEvent(new CustomEvent('sitebot_deleted', { detail: { id: bot.id } }));
    } catch (err: any) {
      alert(err.message || 'Error deleting chatbot. Please try again.');
    } finally {
      setDeletingId(null);
    }
  };

  const navLinks = [
    { label: 'Home', href: '/' },
    { label: 'About', href: '/about' },
    { label: 'Help & Docs', href: '/help' },
    { label: 'Contact', href: '/contact' },
  ];

  return (
    <>
      <header className="sticky top-0 z-50 w-full border-b border-slate-200/70 bg-white/80 backdrop-blur-xl transition-all shadow-[0_4px_25px_-5px_rgba(0,0,0,0.03)]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
          {/* Brand Logo */}
          <Link href="/" className="flex items-center gap-3 group shrink-0">
            <div className="w-10 h-10 rounded-2xl overflow-hidden shadow-md shadow-indigo-500/20 group-hover:scale-105 group-hover:shadow-indigo-500/35 transition-all duration-300 bg-slate-950 border border-slate-700/50 flex items-center justify-center shrink-0">
              <img
                src="/favicon.png"
                alt="SiteBot Studio Logo"
                className="w-full h-full object-cover"
              />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="font-extrabold text-xl text-slate-900 tracking-tight">SiteBot</span>
                <span className="font-extrabold text-xl text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 to-purple-600">
                  Studio
                </span>
              </div>
              <p className="text-[11px] text-slate-500 hidden sm:block leading-none font-medium mt-0.5">
                Multi-Tenant AI Chatbots for Any Website
              </p>
            </div>
          </Link>

          {/* Desktop Nav Links */}
          <nav className="hidden md:flex items-center gap-1.5 p-1 rounded-full bg-slate-100/70 border border-slate-200/60 text-xs font-semibold text-slate-600">
            {navLinks.map((item) => {
              const active = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`px-4 py-1.5 rounded-full transition-all ${
                    active
                      ? 'bg-white text-indigo-600 shadow-sm font-bold'
                      : 'hover:text-indigo-600 hover:bg-white/60'
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>

          {/* Right Action Buttons */}
          <div className="hidden sm:flex items-center gap-3 shrink-0">
            {/* Theme Toggle Button */}
            <button
              onClick={toggleTheme}
              aria-label={theme === 'dark' ? 'Switch to Light theme' : 'Switch to Dark theme'}
              title={theme === 'dark' ? 'Switch to Light theme' : 'Switch to Dark theme'}
              className="p-2 rounded-xl text-slate-600 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-indigo-400 bg-slate-100/80 dark:bg-slate-800 hover:bg-slate-200/80 dark:hover:bg-slate-700 border border-slate-200/80 dark:border-slate-700 transition-all hover:scale-105 active:scale-95 flex items-center justify-center cursor-pointer shadow-sm"
            >
              {theme === 'dark' ? (
                <Sun className="w-4 h-4 text-amber-400 transition-transform rotate-0 scale-100" />
              ) : (
                <Moon className="w-4 h-4 text-slate-700 dark:text-slate-300 transition-transform rotate-0 scale-100" />
              )}
            </button>

            {savedBots.length > 0 && (
              <button
                onClick={() => {
                  fetchBots();
                  setShowModal(true);
                }}
                className="flex items-center gap-2 px-3.5 py-2 text-xs font-semibold rounded-xl bg-slate-100/80 hover:bg-slate-200/80 text-slate-700 border border-slate-200/80 transition-all hover:scale-[1.01]"
              >
                <FolderHeart className="w-3.5 h-3.5 text-indigo-600" />
                <span>My Bots</span>
                <span className="px-1.5 py-0.2 rounded-full bg-indigo-100 text-indigo-700 text-[10px] font-extrabold">
                  {savedBots.length}
                </span>
              </button>
            )}

            <Link
              href="/create"
              className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white shadow-md shadow-indigo-600/25 transition-all hover:scale-[1.02] active:scale-[0.98]"
            >
              <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
              <span>Create Bot</span>
            </Link>
          </div>

          {/* Mobile Hamburger Button */}
          <div className="flex sm:hidden items-center gap-2">
            <button
              onClick={toggleTheme}
              aria-label={theme === 'dark' ? 'Switch to Light theme' : 'Switch to Dark theme'}
              title={theme === 'dark' ? 'Switch to Light theme' : 'Switch to Dark theme'}
              className="p-2 rounded-xl text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 transition-colors"
            >
              {theme === 'dark' ? (
                <Sun className="w-4 h-4 text-amber-400" />
              ) : (
                <Moon className="w-4 h-4 text-slate-700" />
              )}
            </button>
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-2 rounded-xl text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 transition-colors"
              aria-label="Toggle navigation menu"
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {/* Mobile Dropdown Drawer */}
        {mobileMenuOpen && (
          <div className="sm:hidden border-t border-slate-200/80 bg-white/95 backdrop-blur-xl px-4 py-4 space-y-3 shadow-lg animate-in slide-in-from-top-2 duration-200">
            <div className="flex flex-col space-y-1">
              {navLinks.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className={`px-3 py-2.5 rounded-xl text-xs font-bold transition-colors ${
                    pathname === item.href
                      ? 'bg-indigo-50 text-indigo-600'
                      : 'text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  {item.label}
                </Link>
              ))}
            </div>

            <div className="pt-2 border-t border-slate-100 flex flex-col gap-2">
              <button
                onClick={toggleTheme}
                className="w-full flex items-center justify-between px-3.5 py-2.5 text-xs font-semibold rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 border border-slate-200/60 dark:border-slate-700"
              >
                <span className="flex items-center gap-2">
                  {theme === 'dark' ? (
                    <Sun className="w-4 h-4 text-amber-400" />
                  ) : (
                    <Moon className="w-4 h-4 text-slate-700 dark:text-slate-300" />
                  )}
                  <span>Theme Mode</span>
                </span>
                <span className="text-[11px] font-bold text-slate-500 uppercase">
                  {theme}
                </span>
              </button>

              {savedBots.length > 0 && (
                <button
                  onClick={() => {
                    setMobileMenuOpen(false);
                    fetchBots();
                    setShowModal(true);
                  }}
                  className="w-full flex items-center justify-between px-3.5 py-2.5 text-xs font-semibold rounded-xl bg-slate-100 text-slate-800"
                >
                  <span className="flex items-center gap-2">
                    <FolderHeart className="w-4 h-4 text-indigo-600" />
                    <span>My Saved Bots</span>
                  </span>
                  <span className="px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700 font-bold text-[10px]">
                    {savedBots.length}
                  </span>
                </button>
              )}

              <Link
                href="/create"
                onClick={() => setMobileMenuOpen(false)}
                className="w-full py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 text-white text-xs font-bold text-center shadow-md shadow-indigo-600/20"
              >
                + Create New Bot
              </Link>
            </div>
          </div>
        )}
      </header>

      {/* Your Chatbots Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/50 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-md rounded-3xl bg-white border border-slate-200 shadow-2xl p-6 sm:p-7 relative overflow-hidden">
            <div className="h-1.5 w-full bg-gradient-to-r from-indigo-600 via-purple-600 to-rose-600 absolute top-0 left-0" />

            <button
              onClick={() => setShowModal(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-700 p-1.5 rounded-xl hover:bg-slate-100 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="flex items-center gap-2.5 mb-1.5">
              <div className="w-8 h-8 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600">
                <FolderHeart className="w-4 h-4" />
              </div>
              <h3 className="text-base font-bold text-slate-900">Your Chatbots</h3>
            </div>
            <p className="text-xs text-slate-500 mb-4">
              Permanent bots stored in your database. Click to open studio or live demo.
            </p>

            <div className="space-y-2.5 max-h-80 overflow-y-auto pr-1">
              {savedBots.length === 0 ? (
                <div className="text-center py-8 text-xs text-slate-400 space-y-2">
                  <Bot className="w-8 h-8 mx-auto text-slate-300" />
                  <p>No chatbots found. Create one to get started!</p>
                </div>
              ) : (
                savedBots.map((b) => (
                  <div
                    key={b.id}
                    className="flex items-center justify-between p-3.5 rounded-2xl bg-slate-50 border border-slate-200/80 hover:border-indigo-300 hover:bg-indigo-50/20 transition-all group"
                  >
                    <Link
                      href={`/bot/${b.id}`}
                      onClick={() => setShowModal(false)}
                      className="flex-1 min-w-0 pr-2"
                    >
                      <h4 className="text-xs font-bold text-slate-900 truncate group-hover:text-indigo-600 transition-colors">
                        {b.name}
                      </h4>
                      <p className="text-[11px] text-slate-500 truncate font-mono mt-0.5">{b.siteUrl}</p>
                    </Link>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <Link
                        href={`/demo/${b.id}`}
                        onClick={() => setShowModal(false)}
                        title="Open Live Sandbox Demo"
                        className="p-2 rounded-xl text-slate-500 hover:text-indigo-600 hover:bg-white transition-all shadow-none hover:shadow-sm"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                      </Link>

                      <button
                        onClick={(e) => removeBot(b, e)}
                        disabled={deletingId === b.id}
                        title="Permanently delete chatbot"
                        className="p-2 rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-all disabled:opacity-50"
                      >
                        {deletingId === b.id ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin text-rose-500" />
                        ) : (
                          <Trash2 className="w-3.5 h-3.5" />
                        )}
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="mt-5 pt-4 border-t border-slate-200/80 flex justify-between items-center">
              <span className="text-[11px] text-slate-400 font-medium">
                {savedBots.length} {savedBots.length === 1 ? 'bot' : 'bots'} configured
              </span>
              <button
                onClick={() => setShowModal(false)}
                className="px-4 py-2 text-xs font-bold rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
