'use client';

import React, { useState, useEffect, useRef } from 'react';
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
  Loader2,
  Globe,
  ArrowRight,
  Sun,
  Moon,
  Shield,
  User,
  LogOut,
  ChevronDown,
  ChevronRight,
  LayoutDashboard,
  CreditCard,
  Home,
  BookOpen,
  HelpCircle,
  MessageCircle,
  Mail,
  Zap,
  FileText,
  ShieldCheck,
} from 'lucide-react';
import { useAuth } from '@/lib/firebase/AuthContext';
import { AuthModal } from '@/components/AuthModal';

interface SavedBot {
  id: string;
  name: string;
  siteUrl: string;
  primaryColor?: string;
  planTier?: 'free' | 'individual' | 'enterprise';
  createdAt?: string;
  status?: string;
}

export function Navbar() {
  const pathname = usePathname();
  const { user, role, isAdmin, isSuperAdmin, signOut } = useAuth();
  const [savedBots, setSavedBots] = useState<SavedBot[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [userDropdownOpen, setUserDropdownOpen] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setUserDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Lock body scroll when mobile drawer is open
  useEffect(() => {
    if (mobileMenuOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [mobileMenuOpen]);

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

  // Sync bots from database filtered by logged in user or admin
  const fetchBots = async () => {
    try {
      const url = user?.email
        ? `/api/bot?email=${encodeURIComponent(user.email)}`
        : '/api/bot';
      const headers: Record<string, string> = {};
      if (user?.email) headers['x-user-email'] = user.email;
      if (user?.uid) headers['x-user-id'] = user.uid;

      const res = await fetch(url, { headers, cache: 'no-store' });
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
  }, [user?.email]);

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
      const headers: Record<string, string> = {};
      if (user?.email) headers['x-user-email'] = user.email;

      const res = await fetch(`/api/bot/${bot.id}`, { method: 'DELETE', headers });
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

      window.dispatchEvent(new CustomEvent('sitebot_deleted', { detail: { id: bot.id } }));
    } catch (err: any) {
      alert(err.message || 'Error deleting chatbot. Please try again.');
    } finally {
      setDeletingId(null);
    }
  };

  const navLinks: { label: string; href: string; requiresAuth?: boolean }[] = [
    { label: 'Home', href: '/' },
    { label: 'Pricing', href: '/pricing' },
    { label: 'About', href: '/about' },
    { label: 'Help & Docs', href: '/help' },
    { label: 'Contact', href: '/contact' },
    { label: 'Dashboard', href: '/dashboard', requiresAuth: true },
  ];

  const visibleNavLinks = navLinks.filter((l) => !l.requiresAuth || user);

  return (
    <>
      {/* ========================================================
          TOP HEADER BAR
          ======================================================== */}
      <header className="sticky top-0 z-50 w-full backdrop-blur-2xl bg-white/80 dark:bg-slate-950/80 border-b border-slate-200/70 dark:border-slate-800/80 transition-all shadow-[0_4px_25px_-5px_rgba(0,0,0,0.03)]">
        <div className="max-w-7xl mx-auto px-3.5 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-3">
          {/* Brand Logo & Live Status */}
          <Link href="/" className="flex min-w-0 items-center gap-2.5 sm:gap-3 group">
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-2xl overflow-hidden shadow-md shadow-indigo-500/20 group-hover:scale-105 group-hover:shadow-indigo-500/35 transition-all duration-300 bg-slate-950 border border-slate-700/50 flex items-center justify-center shrink-0">
              <img
                src="/favicon.png"
                alt="SiteBot Studio Logo"
                className="w-full h-full object-cover"
                onError={(e) => {
                  (e.target as HTMLElement).style.display = 'none';
                }}
              />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 whitespace-nowrap">
                <span className="font-black text-lg sm:text-xl text-slate-900 dark:text-white tracking-tight font-heading">
                  SiteBot
                </span>
                <span className="font-black text-lg sm:text-xl text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 via-purple-600 to-indigo-500 font-heading">
                  Studio
                </span>
                <span className="hidden sm:inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-emerald-50 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/80 ml-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  <span>AI v2.5</span>
                </span>
              </div>
              <p className="text-[10px] text-slate-400 dark:text-slate-500 hidden xl:block leading-none font-medium mt-0.5">
                Multi-Tenant AI Chatbot Platform
              </p>
            </div>
          </Link>

          {/* Desktop Capsule Navigation */}
          <nav className="hidden xl:flex min-w-0 items-center gap-1 p-1 rounded-full bg-slate-100/80 dark:bg-slate-900/90 border border-slate-200/80 dark:border-slate-800 shadow-inner text-xs font-semibold text-slate-600 dark:text-slate-300">
            {visibleNavLinks.map((item) => {
              const active = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`px-3.5 py-1.5 rounded-full transition-all flex items-center gap-1.5 ${
                    active
                      ? 'bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 shadow-sm font-bold'
                      : 'hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-white/60 dark:hover:bg-slate-800/60'
                  }`}
                >
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </nav>

          {/* Right Action Buttons */}
          <div className="flex items-center gap-2 sm:gap-2.5 shrink-0">
            {/* Theme Toggle Button */}
            <button
              onClick={toggleTheme}
              aria-label={theme === 'dark' ? 'Switch to Light theme' : 'Switch to Dark theme'}
              title={theme === 'dark' ? 'Switch to Light theme' : 'Switch to Dark theme'}
              className="p-2 rounded-xl text-slate-600 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-indigo-400 bg-slate-100/80 dark:bg-slate-800/90 hover:bg-slate-200/80 dark:hover:bg-slate-700 border border-slate-200/80 dark:border-slate-700/80 transition-all hover:scale-105 active:scale-95 flex items-center justify-center cursor-pointer shadow-sm"
            >
              {theme === 'dark' ? (
                <Sun className="w-4 h-4 text-amber-400 transition-transform rotate-0 scale-100" />
              ) : (
                <Moon className="w-4 h-4 text-slate-700 dark:text-slate-300 transition-transform rotate-0 scale-100" />
              )}
            </button>

            {/* Admin Panel Link (Desktop - Visible to Admins) */}
            {isAdmin && (
              <Link
                href="/admin"
                className={`hidden 2xl:flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-xl transition-all ${
                  pathname === '/admin'
                    ? 'bg-rose-600 text-white shadow-md shadow-rose-600/25'
                    : 'bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border border-rose-200/80 dark:border-rose-900 hover:bg-rose-100 dark:hover:bg-rose-900/60'
                }`}
                title="Admin Control Center"
              >
                <Shield className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400" />
                <span>Admin</span>
                {isSuperAdmin && (
                  <span className="text-[9px] px-1 py-0.2 bg-rose-200 dark:bg-rose-800 text-rose-900 dark:text-rose-200 rounded font-extrabold">
                    Super
                  </span>
                )}
              </Link>
            )}

            {/* My Bots Modal Button (Desktop) */}
            {savedBots.length > 0 && (
              <button
                onClick={() => {
                  fetchBots();
                  setShowModal(true);
                }}
                className="hidden xl:flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-xl bg-slate-100/80 dark:bg-slate-800/90 hover:bg-slate-200/80 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200/80 dark:border-slate-700/80 transition-all hover:scale-[1.01] cursor-pointer"
              >
                <FolderHeart className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                <span>My Bots</span>
                <span className="px-1.5 py-0.2 rounded-full bg-indigo-100 dark:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300 text-[10px] font-extrabold">
                  {savedBots.length}
                </span>
              </button>
            )}

            {/* Create Bot Button (Desktop) */}
            <Link
              href="/create"
              className="hidden xl:flex items-center gap-1.5 px-3.5 py-2 text-xs font-extrabold rounded-xl bg-gradient-to-r from-indigo-600 via-purple-600 to-indigo-600 hover:from-indigo-500 hover:to-purple-500 text-white shadow-md shadow-indigo-600/25 transition-all hover:scale-105 active:scale-95"
            >
              <Plus className="w-3.5 h-3.5 stroke-[3]" />
              <span>Create Bot</span>
            </Link>

            {/* User Profile / Login (Desktop Dropdown) */}
            {user ? (
              <div className="relative hidden xl:block" ref={dropdownRef}>
                <button
                  onClick={() => setUserDropdownOpen(!userDropdownOpen)}
                  className="flex items-center gap-2 p-1.5 pr-2.5 rounded-xl bg-slate-100/80 dark:bg-slate-800/90 hover:bg-slate-200/80 dark:hover:bg-slate-700 border border-slate-200/80 dark:border-slate-700/80 transition-all cursor-pointer shadow-sm"
                >
                  {user.photoURL ? (
                    <img
                      src={user.photoURL}
                      alt={user.displayName || 'User'}
                      className="w-6 h-6 rounded-lg object-cover ring-1 ring-indigo-500/30"
                    />
                  ) : (
                    <div className="w-6 h-6 rounded-lg bg-indigo-600 text-white text-xs font-bold flex items-center justify-center">
                      {(user.displayName || user.email || 'U')[0].toUpperCase()}
                    </div>
                  )}
                  <span className="text-xs font-bold text-slate-700 dark:text-slate-200 max-w-[90px] truncate">
                    {user.displayName?.split(' ')[0] || user.email?.split('@')[0]}
                  </span>
                  <ChevronDown className="w-3 h-3 text-slate-400" />
                </button>

                {userDropdownOpen && (
                  <div className="absolute right-0 mt-2 w-56 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl py-2 z-50 text-xs animate-in fade-in slide-in-from-top-2 duration-150">
                    <div className="px-4 py-2.5 border-b border-slate-100 dark:border-slate-800">
                      <p className="font-extrabold text-slate-900 dark:text-white truncate">
                        {user.displayName || 'User'}
                      </p>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate mt-0.5">
                        {user.email}
                      </p>
                      <div className="mt-1.5 flex items-center gap-1.5">
                        <span
                          className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full ${
                            isSuperAdmin
                              ? 'bg-rose-100 dark:bg-rose-900/60 text-rose-700 dark:text-rose-300'
                              : isAdmin
                              ? 'bg-purple-100 dark:bg-purple-900/60 text-purple-700 dark:text-purple-300'
                              : 'bg-indigo-50 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300'
                          }`}
                        >
                          {role === 'super_admin'
                            ? 'Super Admin'
                            : role === 'admin'
                            ? 'Admin'
                            : 'Creator'}
                        </span>
                      </div>
                    </div>

                    {isAdmin && (
                      <Link
                        href="/admin"
                        onClick={() => setUserDropdownOpen(false)}
                        className="flex items-center gap-2 px-4 py-2 hover:bg-slate-50 dark:hover:bg-slate-800 text-rose-600 dark:text-rose-400 font-semibold"
                      >
                        <Shield className="w-3.5 h-3.5" />
                        <span>Admin Panel</span>
                      </Link>
                    )}

                    <Link
                      href="/dashboard"
                      onClick={() => setUserDropdownOpen(false)}
                      className="flex items-center gap-2 px-4 py-2 hover:bg-slate-50 dark:hover:bg-slate-800 text-indigo-600 dark:text-indigo-400 font-semibold"
                    >
                      <LayoutDashboard className="w-3.5 h-3.5" />
                      <span>User Dashboard</span>
                    </Link>

                    <button
                      onClick={() => {
                        setUserDropdownOpen(false);
                        setShowModal(true);
                      }}
                      className="w-full flex items-center gap-2 px-4 py-2 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 text-left font-medium cursor-pointer"
                    >
                      <FolderHeart className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                      <span>My Chatbots ({savedBots.length})</span>
                    </button>

                    <Link
                      href="/create"
                      onClick={() => setUserDropdownOpen(false)}
                      className="flex items-center gap-2 px-4 py-2 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 font-medium"
                    >
                      <Plus className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                      <span>Create New Bot</span>
                    </Link>

                    <div className="my-1 border-t border-slate-100 dark:border-slate-800" />

                    <button
                      onClick={() => {
                        setUserDropdownOpen(false);
                        signOut();
                      }}
                      className="w-full flex items-center gap-2 px-4 py-2 hover:bg-rose-50 dark:hover:bg-rose-950/40 text-rose-600 dark:text-rose-400 text-left font-semibold cursor-pointer"
                    >
                      <LogOut className="w-3.5 h-3.5" />
                      <span>Sign Out</span>
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <button
                onClick={() => setAuthModalOpen(true)}
                className="hidden xl:flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-xl bg-slate-100/90 dark:bg-slate-800 hover:bg-slate-200/80 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200/80 dark:border-slate-700 transition-all cursor-pointer shadow-sm"
              >
                <User className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                <span>Sign In</span>
              </button>
            )}

            {/* Mobile Header User Thumbnail (Tapping opens mobile drawer) */}
            {user && (
              <button
                onClick={() => setMobileMenuOpen(true)}
                className="xl:hidden p-1 rounded-xl ring-2 ring-indigo-500/30"
                aria-label="Open User Menu"
              >
                {user.photoURL ? (
                  <img
                    src={user.photoURL}
                    alt={user.displayName || 'User'}
                    className="w-7 h-7 rounded-lg object-cover"
                  />
                ) : (
                  <div className="w-7 h-7 rounded-lg bg-indigo-600 text-white text-xs font-bold flex items-center justify-center">
                    {(user.displayName || user.email || 'U')[0].toUpperCase()}
                  </div>
                )}
              </button>
            )}

            {/* Mobile Hamburger Button with Animated Morphing Icon */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="xl:hidden p-2 rounded-xl text-slate-700 dark:text-slate-200 bg-slate-100/90 dark:bg-slate-800/90 hover:bg-slate-200/80 dark:hover:bg-slate-700 border border-slate-200/80 dark:border-slate-700/80 transition-all cursor-pointer relative"
              aria-label="Toggle navigation menu"
            >
              {mobileMenuOpen ? (
                <X className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
              ) : (
                <Menu className="w-5 h-5" />
              )}
              {savedBots.length > 0 && !mobileMenuOpen && (
                <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-indigo-600 ring-2 ring-white dark:ring-slate-900" />
              )}
            </button>
          </div>
        </div>
      </header>

      {/* ========================================================
          MOBILE SLIDE-OVER CANVAS (DRAWER)
          ======================================================== */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 xl:hidden flex justify-end animate-in fade-in duration-200">
          {/* Backdrop Blur Overlay */}
          <div
            onClick={() => setMobileMenuOpen(false)}
            className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm transition-opacity cursor-pointer"
          />

          {/* Drawer Content */}
          <div className="relative w-full max-w-xs sm:max-w-sm bg-white dark:bg-slate-900 border-l border-slate-200/80 dark:border-slate-800 shadow-2xl h-full flex flex-col justify-between p-5 overflow-y-auto z-10 animate-in slide-in-from-right duration-300">
            <div className="space-y-5">
              {/* Drawer Top Header */}
              <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-slate-950 border border-slate-700/50 flex items-center justify-center">
                    <img src="/favicon.png" alt="SiteBot" className="w-5 h-5 object-cover" />
                  </div>
                  <span className="font-black text-sm text-slate-900 dark:text-white font-heading">
                    SiteBot Navigation
                  </span>
                </div>
                <button
                  onClick={() => setMobileMenuOpen(false)}
                  className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* User Account Section inside Mobile Drawer */}
              {user ? (
                <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700 flex items-center justify-between gap-3 shadow-sm">
                  <div className="flex items-center gap-2.5 min-w-0">
                    {user.photoURL ? (
                      <img
                        src={user.photoURL}
                        alt={user.displayName || 'User'}
                        className="w-10 h-10 rounded-xl object-cover ring-2 ring-indigo-500/30 shrink-0"
                      />
                    ) : (
                      <div className="w-10 h-10 rounded-xl bg-indigo-600 text-white font-bold flex items-center justify-center shrink-0">
                        {(user.displayName || user.email || 'U')[0].toUpperCase()}
                      </div>
                    )}
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-slate-900 dark:text-white truncate">
                        {user.displayName || 'User'}
                      </p>
                      <p className="text-[10px] text-slate-500 dark:text-slate-400 truncate">
                        {user.email}
                      </p>
                      <span
                        className={`inline-block text-[8px] font-black uppercase px-1.5 py-0.2 rounded-full mt-1 ${
                          isSuperAdmin
                            ? 'bg-rose-100 dark:bg-rose-900/60 text-rose-700 dark:text-rose-300'
                            : isAdmin
                            ? 'bg-purple-100 dark:bg-purple-900/60 text-purple-700 dark:text-purple-300'
                            : 'bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300'
                        }`}
                      >
                        {role === 'super_admin'
                          ? 'Super Admin'
                          : role === 'admin'
                          ? 'Admin'
                          : 'Creator'}
                      </span>
                    </div>
                  </div>

                  <button
                    onClick={() => {
                      setMobileMenuOpen(false);
                      signOut();
                    }}
                    className="p-2 text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-xl transition-colors cursor-pointer"
                    title="Sign Out"
                  >
                    <LogOut className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => {
                    setMobileMenuOpen(false);
                    setAuthModalOpen(true);
                  }}
                  className="w-full py-3 rounded-2xl bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-extrabold text-xs shadow-md shadow-indigo-600/25 flex items-center justify-center gap-2 cursor-pointer"
                >
                  <User className="w-4 h-4" />
                  <span>Sign In with Google</span>
                </button>
              )}

              {/* Quick Action: Create Bot */}
              <Link
                href="/create"
                onClick={() => setMobileMenuOpen(false)}
                className="w-full py-3 px-4 rounded-2xl bg-gradient-to-r from-indigo-600 via-purple-600 to-indigo-600 text-white font-extrabold text-xs shadow-lg shadow-indigo-600/20 flex items-center justify-between"
              >
                <span className="flex items-center gap-2">
                  <Plus className="w-4 h-4 stroke-[3]" />
                  <span>Create New AI Chatbot</span>
                </span>
                <span className="text-[9px] bg-white/20 uppercase font-black px-1.5 py-0.5 rounded-full">
                  60s Setup
                </span>
              </Link>

              {/* Categorized Mobile Navigation Links */}
              <div className="space-y-1">
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 px-3 py-1">
                  Main Navigation
                </p>

                <Link
                  href="/"
                  onClick={() => setMobileMenuOpen(false)}
                  className={`flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-bold transition-all ${
                    pathname === '/'
                      ? 'bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400'
                      : 'text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800'
                  }`}
                >
                  <span className="flex items-center gap-2.5">
                    <Home className="w-4 h-4 text-indigo-500" />
                    <span>Home</span>
                  </span>
                  <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
                </Link>

                <Link
                  href="/dashboard"
                  onClick={() => setMobileMenuOpen(false)}
                  className={`flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-bold transition-all ${
                    pathname === '/dashboard'
                      ? 'bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400'
                      : 'text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800'
                  }`}
                >
                  <span className="flex items-center gap-2.5">
                    <LayoutDashboard className="w-4 h-4 text-purple-500" />
                    <span>User Dashboard</span>
                  </span>
                  <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
                </Link>

                <Link
                  href="/pricing"
                  onClick={() => setMobileMenuOpen(false)}
                  className={`flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-bold transition-all ${
                    pathname === '/pricing'
                      ? 'bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400'
                      : 'text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800'
                  }`}
                >
                  <span className="flex items-center gap-2.5">
                    <CreditCard className="w-4 h-4 text-emerald-500" />
                    <span>Plans &amp; Pricing</span>
                  </span>
                  <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
                </Link>

                <Link
                  href="/help"
                  onClick={() => setMobileMenuOpen(false)}
                  className={`flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-bold transition-all ${
                    pathname === '/help'
                      ? 'bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400'
                      : 'text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800'
                  }`}
                >
                  <span className="flex items-center gap-2.5">
                    <HelpCircle className="w-4 h-4 text-cyan-500" />
                    <span>Help &amp; Integration Guide</span>
                  </span>
                  <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
                </Link>

                <Link
                  href="/about"
                  onClick={() => setMobileMenuOpen(false)}
                  className={`flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-bold transition-all ${
                    pathname === '/about'
                      ? 'bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400'
                      : 'text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800'
                  }`}
                >
                  <span className="flex items-center gap-2.5">
                    <Bot className="w-4 h-4 text-amber-500" />
                    <span>About SiteBot</span>
                  </span>
                  <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
                </Link>

                <Link
                  href="/contact"
                  onClick={() => setMobileMenuOpen(false)}
                  className={`flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-bold transition-all ${
                    pathname === '/contact'
                      ? 'bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400'
                      : 'text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800'
                  }`}
                >
                  <span className="flex items-center gap-2.5">
                    <Mail className="w-4 h-4 text-rose-500" />
                    <span>Contact Support</span>
                  </span>
                  <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
                </Link>

                <Link
                  href="/terms"
                  onClick={() => setMobileMenuOpen(false)}
                  className={`flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-bold transition-all ${
                    pathname === '/terms'
                      ? 'bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400'
                      : 'text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800'
                  }`}
                >
                  <span className="flex items-center gap-2.5">
                    <FileText className="w-4 h-4 text-slate-500" />
                    <span>Terms of Service</span>
                  </span>
                  <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
                </Link>

                <Link
                  href="/privacy"
                  onClick={() => setMobileMenuOpen(false)}
                  className={`flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-bold transition-all ${
                    pathname === '/privacy'
                      ? 'bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400'
                      : 'text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800'
                  }`}
                >
                  <span className="flex items-center gap-2.5">
                    <ShieldCheck className="w-4 h-4 text-emerald-500" />
                    <span>Privacy Policy</span>
                  </span>
                  <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
                </Link>

                {isAdmin && (
                  <Link
                    href="/admin"
                    onClick={() => setMobileMenuOpen(false)}
                    className="flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-extrabold bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-900 mt-2"
                  >
                    <span className="flex items-center gap-2.5">
                      <Shield className="w-4 h-4 text-rose-600" />
                      <span>Admin Control Center</span>
                    </span>
                    <span className="text-[9px] uppercase px-1.5 py-0.2 bg-rose-200 dark:bg-rose-900 text-rose-900 dark:text-rose-200 rounded font-black">
                      {isSuperAdmin ? 'Super' : 'Admin'}
                    </span>
                  </Link>
                )}
              </div>

              {/* My Bots Quick Launcher in Mobile Drawer */}
              {savedBots.length > 0 && (
                <div className="pt-2 border-t border-slate-100 dark:border-slate-800 space-y-2">
                  <div className="flex items-center justify-between px-2">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                      My Chatbots ({savedBots.length})
                    </span>
                    <button
                      onClick={() => {
                        setMobileMenuOpen(false);
                        setShowModal(true);
                      }}
                      className="text-[11px] font-bold text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer"
                    >
                      Manage All
                    </button>
                  </div>
                  <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
                    {savedBots.slice(0, 3).map((b) => (
                      <Link
                        key={b.id}
                        href={`/bot/${b.id}`}
                        onClick={() => setMobileMenuOpen(false)}
                        className="flex items-center justify-between p-2 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/60 dark:border-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:border-indigo-300"
                      >
                        <div className="flex items-center gap-2 truncate">
                          <Bot className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                          <span className="truncate">{b.name}</span>
                        </div>
                        <ChevronRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      </Link>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Mobile Drawer Bottom Footer */}
            <div className="pt-4 border-t border-slate-100 dark:border-slate-800 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                  Theme Appearance
                </span>
                <button
                  onClick={toggleTheme}
                  className="px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-700 dark:text-slate-200 flex items-center gap-1.5 cursor-pointer"
                >
                  {theme === 'dark' ? (
                    <>
                      <Sun className="w-3.5 h-3.5 text-amber-400" />
                      <span>Dark Mode</span>
                    </>
                  ) : (
                    <>
                      <Moon className="w-3.5 h-3.5 text-indigo-600" />
                      <span>Light Mode</span>
                    </>
                  )}
                </button>
              </div>

              <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1">
                <div className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  <span>All Systems Operational</span>
                </div>
                <span>v2.5.0</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================
          UNIQUE MOBILE BOTTOM NAVIGATION DOCK (App-Like Bar)
          Only displayed when user is logged in
          ======================================================== */}
      {user && (
        <div className="xl:hidden fixed bottom-4 inset-x-3 z-40 mx-auto max-w-sm">
          <div className="rounded-full bg-white/90 dark:bg-slate-900/90 backdrop-blur-2xl border border-slate-200/80 dark:border-slate-800 shadow-[0_10px_35px_-5px_rgba(0,0,0,0.25)] px-3 py-2 flex items-center justify-around text-slate-500 dark:text-slate-400">
            {/* 1. Home */}
            <Link
              href="/"
              className={`flex flex-col items-center gap-0.5 p-1 transition-colors ${
                pathname === '/'
                  ? 'text-indigo-600 dark:text-indigo-400 font-bold'
                  : 'hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <Home className="w-5 h-5" />
              <span className="text-[10px] leading-none">Home</span>
            </Link>

            {/* 2. Dashboard */}
            <Link
              href="/dashboard"
              className={`flex flex-col items-center gap-0.5 p-1 transition-colors ${
                pathname === '/dashboard'
                  ? 'text-indigo-600 dark:text-indigo-400 font-bold'
                  : 'hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <LayoutDashboard className="w-5 h-5" />
              <span className="text-[10px] leading-none">Dashboard</span>
            </Link>

            {/* 3. Center Elevated Action: Create Bot */}
            <Link
              href="/create"
              className="-mt-6 w-12 h-12 rounded-full bg-gradient-to-tr from-indigo-600 via-purple-600 to-rose-500 text-white flex items-center justify-center shadow-lg shadow-indigo-600/40 ring-4 ring-white dark:ring-slate-950 active:scale-95 transition-all hover:scale-105"
              aria-label="Create Bot"
              title="Create New Chatbot"
            >
              <Plus className="w-6 h-6 stroke-[3]" />
            </Link>

            {/* 4. My Bots */}
            <button
              type="button"
              onClick={() => {
                fetchBots();
                setShowModal(true);
              }}
              className="flex flex-col items-center gap-0.5 p-1 hover:text-slate-900 dark:hover:text-white transition-colors relative cursor-pointer"
            >
              <FolderHeart className="w-5 h-5" />
              <span className="text-[10px] leading-none">Bots</span>
              {savedBots.length > 0 && (
                <span className="absolute -top-1 right-1 px-1 rounded-full bg-indigo-600 text-white text-[8px] font-black leading-tight">
                  {savedBots.length}
                </span>
              )}
            </button>

            {/* 5. Menu Trigger */}
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              className="flex flex-col items-center gap-0.5 p-1 hover:text-slate-900 dark:hover:text-white transition-colors cursor-pointer"
            >
              <Menu className="w-5 h-5" />
              <span className="text-[10px] leading-none">Menu</span>
            </button>
          </div>
        </div>
      )}

      {/* ========================================================
          AUTH MODAL
          ======================================================== */}
      <AuthModal
        isOpen={authModalOpen}
        onClose={() => setAuthModalOpen(false)}
        title="Sign In with Google"
        subtitle="Sign in to create, save, and manage your website AI chatbots."
      />

      {/* ========================================================
          YOUR CHATBOTS MODAL
          ======================================================== */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-md rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl p-6 sm:p-7 relative overflow-hidden text-slate-900 dark:text-slate-100">
            <div className="h-1.5 w-full bg-gradient-to-r from-indigo-600 via-purple-600 to-rose-600 absolute top-0 left-0" />

            <button
              onClick={() => setShowModal(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 p-1.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="flex items-center gap-2.5 mb-1.5">
              <div className="w-8 h-8 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-100 dark:border-indigo-800 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
                <FolderHeart className="w-4 h-4" />
              </div>
              <h3 className="text-base font-extrabold text-slate-900 dark:text-white font-heading">
                Your Chatbots
              </h3>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
              Permanent bots stored in your database. Tap to open studio or test live demo.
            </p>

            <div className="space-y-2.5 max-h-80 overflow-y-auto pr-1">
              {savedBots.length === 0 ? (
                <div className="text-center py-8 text-xs text-slate-400 space-y-2">
                  <Bot className="w-8 h-8 mx-auto text-slate-300 dark:text-slate-600" />
                  <p>No chatbots found. Create one to get started!</p>
                </div>
              ) : (
                savedBots.map((b) => (
                  <div
                    key={b.id}
                    className="flex items-center justify-between p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-800 hover:border-indigo-300 dark:hover:border-indigo-700 hover:bg-indigo-50/20 transition-all group"
                  >
                    <Link
                      href={`/bot/${b.id}`}
                      onClick={() => setShowModal(false)}
                      className="flex-1 min-w-0 pr-2"
                    >
                      <div className="flex items-center gap-1.5">
                        <h4 className="text-xs font-bold text-slate-900 dark:text-white truncate group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                          {b.name}
                        </h4>
                        {b.status === 'disabled' && (
                          <span className="text-[9px] px-1.5 py-0.2 rounded-full bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-400 font-extrabold">
                            Paused
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate font-mono mt-0.5">
                        {b.siteUrl}
                      </p>
                    </Link>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <Link
                        href={`/demo/${b.id}`}
                        onClick={() => setShowModal(false)}
                        title="Open Live Sandbox Demo"
                        className="p-2 rounded-xl text-slate-500 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-white dark:hover:bg-slate-700 transition-all shadow-none hover:shadow-sm"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                      </Link>

                      <button
                        onClick={(e) => removeBot(b, e)}
                        disabled={deletingId === b.id}
                        title="Permanently delete chatbot"
                        className="p-2 rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-all disabled:opacity-50 cursor-pointer"
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

            <div className="mt-5 pt-4 border-t border-slate-200/80 dark:border-slate-800 flex justify-between items-center">
              <span className="text-[11px] text-slate-400 font-medium">
                {savedBots.length} {savedBots.length === 1 ? 'bot' : 'bots'} configured
              </span>
              <button
                onClick={() => setShowModal(false)}
                className="px-4 py-2 text-xs font-bold rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 transition-colors cursor-pointer"
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
