/* eslint-disable react-hooks/set-state-in-effect, react-hooks/immutability */
"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Bot,
  Send,
  X,
  Calendar,
  MessageCircle,
  Mail,
  Phone,
  Maximize2,
  Minimize2,
  Trash2,
  ArrowDown,
  User,
  ChevronDown,
  ChevronUp,
  Link2,
  Headphones,
  Check,
  Loader2,
} from "lucide-react";
import { parseRuntimeTags } from "@/lib/runtime-tags";
import { deriveBusinessRoleSubtitle } from "@/lib/niche-detector";

export type ChatMsg = {
  role: "user" | "assistant" | "agent" | "system";
  content: string;
  senderName?: string;
  sources?: Array<{ url: string; title?: string }>;
};

export type EnquiryData = {
  active: boolean;
  step: number;
  data: Record<string, string>;
};

export interface ChatWidgetProps {
  botId?: string;
  apiHost?: string;
  botName?: string;
  roleTitle?: string;
  greeting?: string;
  suggestedQuestions?: string[];
  phone?: string;
  phoneRaw?: string;
  whatsapp?: string;
  email?: string;
  primaryColor?: string;
  brandGradient?: string;
  launcherStyle?: string;
  customLinks?: Array<{ label: string; url: string }>;
  user?: { photoURL?: string | null; displayName?: string | null } | null;
  userProfile?: { name?: string | null };
  initialOpen?: boolean;
}

// Extract email and best-effort name from casual messages to capture leads
function extractLead(messages: ChatMsg[]): { email: string; name: string } {
  const emailRe = /[^\s@]+@[^\s@]+\.[^\s@]+/;
  let email = "";
  for (const m of messages) {
    if (m.role === "user") {
      const match = m.content.match(emailRe);
      if (match) email = match[0];
    }
  }
  if (!email) return { email: "", name: "" };

  const nameRe =
    /(?:my name is|i am |i'm |this is|name[:\-]?\s*)([A-Za-z][A-Za-z'’.\-]{1,}(?:\s+[A-Za-z][A-Za-z'’.\-]{1,})?)/i;
  let name = "";
  for (let i = messages.length - 1; i >= 0; i--) {
    const nm = messages[i].content.match(nameRe);
    if (nm) {
      name = nm[1].trim();
      break;
    }
  }
  if (!name) name = email.split("@")[0].replace(/[._]/g, " ");
  return { email, name };
}

// Default constants
const SERVICE_CATEGORIES = [
  "Web Development",
  "Google & Meta Ads",
  "SEO & Ranking",
  "Social Media Marketing",
];

const DEFAULT_QUICK_REPLIES = [
  "What services do you offer?",
  "How can you help my business?",
  "Book a Demo",
];

const LOADING_MESSAGES = [
  { emoji: "🤔", text: "Noodling on that..." },
  { emoji: "🔍", text: "Searching knowledge base..." },
  { emoji: "⚡", text: "Turbo-charging your answer..." },
  { emoji: "🧠", text: "Generating a thoughtful response..." },
  { emoji: "✨", text: "Cooking up digital magic..." },
  { emoji: "🚀", text: "Working on it, hold tight!" },
  { emoji: "📚", text: "Flipping through our playbook..." },
  { emoji: "🎯", text: "Targeting the perfect answer..." },
  { emoji: "💡", text: "Connecting all the dots..." },
  { emoji: "🌐", text: "Scanning the digital universe..." },
];

const HINT_MESSAGES = [
  "Chat live with our AI assistant — Call, WhatsApp & AI Chat",
  "Direct Call & WhatsApp assistance inside",
  "See plans you can start paying for today",
  "Book a free consultation now",
  "Your growth plan is one tap away",
];

// Convert plain-text URLs in a message into clickable links
function linkify(text: string): ReactNode {
  const urlRe =
    /(https?:\/\/[^\s<]+)|(\/(?:pricing|contact|services|enquiry|about|case-studies|testimonials|faq)(?:[/#?][^\s<]*)?)/g;
  const out: ReactNode[] = [];
  let last = 0;
  let m: RegExpExecArray | null;
  let i = 0;
  while ((m = urlRe.exec(text)) !== null) {
    if (m.index > last) out.push(text.slice(last, m.index));
    const token = m[0];
    const cleanToken = token.replace(/[.,!?)]+$/, "");
    const trailingPunctuation = token.slice(cleanToken.length);
    const href = cleanToken;
    out.push(
      <a
        key={i++}
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="text-rose-400 font-bold underline underline-offset-2 hover:opacity-80 transition-opacity break-words"
      >
        {cleanToken}
      </a>
    );
    if (trailingPunctuation) {
      out.push(trailingPunctuation);
    }
    last = m.index + token.length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

type InlineToken =
  | { t: "text"; v: string }
  | { t: "bold"; v: string }
  | { t: "italic"; v: string }
  | { t: "code"; v: string }
  | { t: "link"; v: string; href: string };

function tokenizeInline(src: string): InlineToken[] {
  const re =
    /(\*\*[^*]+\*\*|__[^_]+__|\*[^*\n]+\*|_[^_\n]+_|`[^`]+`|\[[^\]]+\]\([^)\s]+\))/g;
  const tokens: InlineToken[] = [];
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(src)) !== null) {
    if (m.index > last) tokens.push({ t: "text", v: src.slice(last, m.index) });
    const tok = m[0];
    if (tok.startsWith("**") && tok.endsWith("**") && tok.length > 4) {
      tokens.push({ t: "bold", v: tok.slice(2, -2) });
    } else if (tok.startsWith("__") && tok.endsWith("__") && tok.length > 4) {
      tokens.push({ t: "bold", v: tok.slice(2, -2) });
    } else if (tok.startsWith("[") && tok.includes("](")) {
      const match = /^\s*\[([^\]]+)\]\(([^)\s]+)\)\s*$/.exec(tok.trim());
      if (match) {
        tokens.push({ t: "link", v: match[1], href: match[2] });
      } else {
        tokens.push({ t: "text", v: tok });
      }
    } else if (tok.startsWith("`") && tok.endsWith("`") && tok.length > 2) {
      tokens.push({ t: "code", v: tok.slice(1, -1) });
    } else if (tok.startsWith("*") && tok.endsWith("*") && tok.length > 2) {
      tokens.push({ t: "italic", v: tok.slice(1, -1) });
    } else if (tok.startsWith("_") && tok.endsWith("_") && tok.length > 2) {
      tokens.push({ t: "italic", v: tok.slice(1, -1) });
    } else {
      tokens.push({ t: "text", v: tok });
    }
    last = m.index + tok.length;
  }
  if (last < src.length) tokens.push({ t: "text", v: src.slice(last) });
  return tokens;
}

function renderInline(src: string): ReactNode {
  return (
    <>
      {tokenizeInline(src).map((tk, i) => {
        if (tk.t === "bold") {
          return (
            <strong key={i} className="font-bold">
              {renderInline(tk.v)}
            </strong>
          );
        }
        if (tk.t === "italic") {
          return <em key={i}>{renderInline(tk.v)}</em>;
        }
        if (tk.t === "code") {
          return (
            <code
              key={i}
              className="px-1.5 py-0.5 rounded bg-black/30 text-[12.5px] font-mono border border-white/10"
            >
              {tk.v}
            </code>
          );
        }
        if (tk.t === "link") {
          return (
            <a
              key={i}
              href={tk.href}
              target="_blank"
              rel="noopener noreferrer"
              className="text-rose-400 font-bold underline underline-offset-2 hover:opacity-80 transition-opacity break-words"
            >
              {tk.v}
            </a>
          );
        }
        return <span key={i}>{linkify(tk.v)}</span>;
      })}
    </>
  );
}

function renderMessageMarkdown(text: string): ReactNode {
  const lines = text.split(/\r?\n/);
  const blocks: ReactNode[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    if (/^\s*```/.test(line)) {
      const buf: string[] = [];
      i += 1;
      while (i < lines.length && !/^\s*```\s*$/.test(lines[i])) {
        buf.push(lines[i]);
        i += 1;
      }
      i += 1;
      blocks.push(
        <pre
          key={blocks.length}
          className="my-1.5 px-3 py-2 rounded-xl bg-black/40 text-[12.5px] font-mono leading-relaxed overflow-x-auto border border-white/10"
        >
          {buf.join("\n")}
        </pre>
      );
      continue;
    }

    const heading = /^(#{1,3})\s+(.*)$/.exec(line);
    if (heading) {
      const level = heading[1].length;
      const Tag: "h1" | "h2" | "h3" = level === 1 ? "h1" : level === 2 ? "h2" : "h3";
      const cls =
        level === 1
          ? "text-[17px] font-bold mt-2 mb-1"
          : level === 2
          ? "text-[15px] font-bold mt-2 mb-1"
          : "text-[14px] font-bold mt-1.5 mb-1";
      blocks.push(
        <Tag key={blocks.length} className={cls}>
          {renderInline(heading[2])}
        </Tag>
      );
      i += 1;
      continue;
    }

    const quote = /^>\s?(.*)$/.exec(line);
    if (quote) {
      const qbuf: string[] = [];
      while (i < lines.length && /^>\s?/.test(lines[i])) {
        qbuf.push(lines[i].replace(/^>\s?/, ""));
        i += 1;
      }
      blocks.push(
        <blockquote
          key={blocks.length}
          className="my-1.5 pl-2.5 border-l-2 border-rose-400/60 text-[13px] opacity-90"
        >
          {qbuf.map((ql, j) => (
            <div key={j}>{renderInline(ql)}</div>
          ))}
        </blockquote>
      );
      continue;
    }

    if (/^\s*\|.*\|/.test(line)) {
      const rawRows: string[][] = [];
      let isHeader = false;
      while (i < lines.length) {
        const l = lines[i].trim();
        if (!/^\|.*\|$/.test(l)) break;
        if (/^\|?\s*:?-+:?\s*(\|\s*:?-+:?\s*)*\|?\s*$/.test(l)) {
          isHeader = rawRows.length > 0;
          i += 1;
          break;
        }
        rawRows.push(l.replace(/^\||\|$/g, "").split("|").map((c) => c.trim()));
        i += 1;
      }
      if (rawRows.length) {
        const tableHead = isHeader ? rawRows.shift() : null;
        blocks.push(
          <div key={blocks.length} className="overflow-x-auto my-1.5">
            <table className="w-full text-[12.5px] border-collapse">
              {tableHead && (
                <thead>
                  <tr>
                    {tableHead.map((c, j) => (
                      <th
                        key={j}
                        className="px-2 py-1 text-left font-bold bg-white/10 border border-white/15"
                      >
                        {renderInline(c)}
                      </th>
                    ))}
                  </tr>
                </thead>
              )}
              <tbody>
                {rawRows.map((r, ri) => (
                  <tr key={ri}>
                    {r.map((c, j) => (
                      <td key={j} className="px-2 py-1 border border-white/10 align-top">
                        {renderInline(c)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
      }
      continue;
    }

    const isList = /^\s*[-*]\s+/.test(line) || /^\s*\d+[.)]\s+/.test(line);
    if (isList) {
      const ordered = /^\s*\d+[.)]\s+/.test(line);
      const items: ReactNode[] = [];
      while (i < lines.length) {
        const l = lines[i];
        const li = ordered
          ? /^\s*\d+[.)]\s+(.*)$/.exec(l)
          : /^\s*[-*]\s+(.*)$/.exec(l);
        if (!li) break;
        items.push(<li key={items.length}>{renderInline(li[1])}</li>);
        i += 1;
      }
      const ListTag: "ol" | "ul" = ordered ? "ol" : "ul";
      blocks.push(
        <ListTag
          key={blocks.length}
          className={ordered ? "list-decimal list-inside my-1.5 space-y-0.5" : "list-disc list-inside my-1.5 space-y-0.5"}
        >
          {items}
        </ListTag>
      );
      continue;
    }

    if (!line.trim()) {
      i += 1;
      continue;
    }

    const para: string[] = [];
    while (
      i < lines.length &&
      lines[i].trim() &&
      !/^\s*```/.test(lines[i]) &&
      !/^(#{1,3})\s+/.test(lines[i]) &&
      !/^>\s?/.test(lines[i]) &&
      !/^\s*\|.*\|/.test(lines[i]) &&
      !/^\s*[-*]\s+/.test(lines[i]) &&
      !/^\s*\d+[.)]\s+/.test(lines[i])
    ) {
      para.push(lines[i]);
      i += 1;
    }
    blocks.push(
      <p key={blocks.length} className="mb-1">
        {renderInline(para.join(" "))}
      </p>
    );
  }

  return <>{blocks}</>;
}

// Bot avatar component
function FridayAvatar({ botName = "Friday" }: { botName?: string }) {
  return (
    <div className="flex flex-col items-center gap-0.5 shrink-0 w-9">
      <div className="w-7 h-7 rounded-full bg-gradient-brand flex items-center justify-center shadow-glow-sm ring-1 ring-white/25">
        <Bot className="w-4 h-4 text-white" />
      </div>
      <span className="text-[8px] font-bold chat-avatar-label leading-none truncate max-w-[36px]">
        {botName}
      </span>
    </div>
  );
}

// User avatar component
function UserAvatar({
  photoURL,
  displayName,
}: {
  photoURL?: string | null;
  displayName?: string | null;
}) {
  const [imgFailed, setImgFailed] = useState(false);
  const initials = displayName
    ? displayName
        .trim()
        .split(/\s+/)
        .map((w) => w[0])
        .join("")
        .slice(0, 2)
        .toUpperCase()
    : "";

  return (
    <div className="flex flex-col items-center gap-0.5 shrink-0 w-9">
      {photoURL && !imgFailed ? (
        <img
          src={photoURL}
          alt={displayName || "You"}
          className="w-7 h-7 rounded-full object-cover border border-white/20 shadow-sm"
          referrerPolicy="no-referrer"
          onError={() => setImgFailed(true)}
        />
      ) : initials ? (
        <div className="w-7 h-7 rounded-full bg-gradient-brand flex items-center justify-center shadow-sm border border-white/15">
          <span className="text-[9px] font-bold text-white leading-none">{initials}</span>
        </div>
      ) : (
        <div className="w-7 h-7 rounded-full bg-slate-700/80 border border-white/20 flex items-center justify-center shadow-sm" title="You">
          <User className="w-3.5 h-3.5 text-white/90" />
        </div>
      )}
      <span className="text-[8px] font-bold chat-avatar-label leading-none truncate max-w-[36px]">
        You
      </span>
    </div>
  );
}

export function ChatWidget({
  botId,
  apiHost = "",
  botName = "Friday",
  roleTitle,
  greeting = "",
  suggestedQuestions,
  phone = "+91 96962 62007",
  phoneRaw = "+919696262007",
  whatsapp = "919696262007",
  email = "hello@nexusdigitalmarketing.shop",
  primaryColor = "#BE123C",
  launcherStyle = "standard",
  customLinks,
  user,
  userProfile,
  initialOpen = false,
}: ChatWidgetProps) {
  const [open, setOpen] = useState(initialOpen);
  const [messages, setMessages] = useState<ChatMsg[]>([{ role: "assistant", content: "" }]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadingMessageIndex, setLoadingMessageIndex] = useState(0);
  const [pulse, setPulse] = useState(0);
  const [hint, setHint] = useState(false);
  const [hintIndex, setHintIndex] = useState(0);
  const [enquiry, setEnquiry] = useState<EnquiryData>({ active: false, step: 0, data: {} });
  const [enquiryOptions, setEnquiryOptions] = useState<string[]>([]);
  const [followUp, setFollowUp] = useState(false);
  const [lastAction, setLastAction] = useState<"chat" | "enquiry" | "contact">("chat");
  const [fullscreen, setFullscreen] = useState(false);
  const [isNarrow, setIsNarrow] = useState(false);
  const [showGoDown, setShowGoDown] = useState(false);
  const [sugOpen, setSugOpen] = useState(true);
  const [, setIsTypingWelcome] = useState(false);
  const [welcomeTyped, setWelcomeTyped] = useState(false);

  const typingRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const followRef = useRef(true);
  const leadCapturedRef = useRef(false);

  // Stable conversation identity so backend conversational form slot-filling
  // can persist in-progress submissions across turns (and page reloads).
  const sessionIdRef = useRef<string | null>(null);
  const getSessionId = useCallback((): string => {
    let id = sessionIdRef.current;
    if (id) return id;
    const key = `sitebot_session_${botId || "default"}`;
    try {
      id = window.sessionStorage.getItem(key) || "";
      if (!id) {
        id = `sess-${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;
        window.sessionStorage.setItem(key, id);
      }
    } catch {
      id = `sess-${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;
    }
    sessionIdRef.current = id;
    return id;
  }, [botId]);

  // Quick links the visitor has hidden via the little "X" on each chip.
  // Persisted per bot so removals survive reloads. Adding/editing happens in
  // SiteBot Studio settings, not in the widget.
  const [hiddenQuickLinks, setHiddenQuickLinks] = useState<string[]>(() => {
    try {
      const stored = window.localStorage.getItem(`sitebot_hidden_links_${botId || "default"}`);
      return stored ? (JSON.parse(stored) as string[]) : [];
    } catch {
      return [];
    }
  });
  const hideQuickLink = useCallback(
    (url: string) => {
      setHiddenQuickLinks((prev) => {
        const next = prev.includes(url) ? prev : [...prev, url];
        try {
          window.localStorage.setItem(
            `sitebot_hidden_links_${botId || "default"}`,
            JSON.stringify(next)
          );
        } catch {}
        return next;
      });
    },
    [botId]
  );

  // Live human handoff state
  const [handoffState, setHandoffState] = useState<{
    active: boolean;
    status: 'bot' | 'waiting_agent' | 'agent_active' | 'resolved';
    agentName?: string;
  }>({ active: false, status: 'bot' });

  // Dynamic Lead Capture Card state
  const [showLeadForm, setShowLeadForm] = useState(false);
  const [leadForm, setLeadForm] = useState({ name: '', email: '', phone: '', message: '' });
  const [leadSubmitting, setLeadSubmitting] = useState(false);

  const requestLiveHandoff = useCallback(async () => {
    const sId = getSessionId();
    setHandoffState({ active: true, status: 'waiting_agent' });
    setMessages((prev) => [
      ...prev,
      {
        role: 'system',
        content: 'Transfer requested. Connecting you to a live human representative...',
      },
    ]);
    try {
      const res = await fetch(`${apiHost}/api/chat/${botId || 'default'}/handoff`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: sId,
          reason: 'visitor_request',
          visitorName: userProfile?.name || user?.displayName || 'Visitor',
          visitorEmail: (user as any)?.email || '',
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setHandoffState({
          active: true,
          status: data.status || 'waiting_agent',
        });
      }
    } catch (err) {
      console.error('Handoff error:', err);
    }
  }, [apiHost, botId, getSessionId, user, userProfile]);

  const handleLeadSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!leadForm.name || !leadForm.email || !leadForm.phone) return;
      setLeadSubmitting(true);
      try {
        const sId = getSessionId();
        const endpoint = botId ? `${apiHost}/api/chat/${botId}/lead` : `${apiHost}/api/chat/lead`;
        const res = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            botId,
            sessionId: sId,
            ...leadForm,
          }),
        });
        if (res.ok) {
          setShowLeadForm(false);
          setMessages((prev) => [
            ...prev,
            {
              role: 'assistant',
              content: `Thank you, ${leadForm.name || 'there'}! We have captured your contact info. A member of our team will get in touch with you shortly.`,
            },
          ]);
          setLeadForm({ name: '', email: '', phone: '', message: '' });
        }
      } catch (err) {
        console.error('Lead submit error:', err);
      } finally {
        setLeadSubmitting(false);
      }
    },
    [apiHost, botId, getSessionId, leadForm]
  );

  const [liveData, setLiveData] = useState<{
    botName?: string;
    roleTitle?: string;
    greeting?: string;
    suggestedQuestions?: string[];
    phone?: string;
    phoneRaw?: string;
    whatsapp?: string;
    email?: string;
    launcherStyle?: string;
    customLinks?: Array<{ label: string; url: string }>;
  }>({});

  useEffect(() => {
    if (!botId) return;
    let isMounted = true;
    fetch(`${apiHost}/api/chat/${botId}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (isMounted && data) {
          setLiveData({
            botName: data.name,
            roleTitle: data.roleTitle,
            greeting: data.greeting,
            suggestedQuestions: data.suggestedQuestions,
            phone: data.phone,
            phoneRaw: data.phoneRaw,
            whatsapp: data.whatsapp,
            email: data.email,
            launcherStyle: data.launcherStyle,
            customLinks: data.customLinks,
          });
        }
      })
      .catch(() => {});
    return () => {
      isMounted = false;
    };
  }, [botId, apiHost]);

  // Polling for live handoff state & agent messages when handoff is active
  useEffect(() => {
    if (!handoffState.active || !botId) return;
    const interval = setInterval(async () => {
      try {
        const sId = getSessionId();
        const res = await fetch(`${apiHost}/api/chat/${botId}/handoff?sessionId=${sId}`);
        if (res.ok) {
          const data = await res.json();
          if (data.status && data.status !== handoffState.status) {
            setHandoffState({
              active: data.status === 'waiting_agent' || data.status === 'agent_active',
              status: data.status,
              agentName: data.assignedAgent?.name,
            });
          }
          if (Array.isArray(data.messages)) {
            const agentOrSys = data.messages.filter(
              (m: any) => m.role === 'agent' || m.role === 'system'
            );
            setMessages((prev) => {
              const known = new Set(prev.map((p) => p.content));
              const fresh = agentOrSys
                .filter((m: any) => !known.has(m.content))
                .map((m: any) => ({
                  role: m.role as any,
                  content: m.content,
                  senderName: m.senderName,
                }));
              if (fresh.length > 0) return [...prev, ...fresh];
              return prev;
            });
          }
        }
      } catch (e) {
        // non-fatal
      }
    }, 3500);
    return () => clearInterval(interval);
  }, [handoffState.active, handoffState.status, botId, apiHost, getSessionId]);

  const activeBotName = liveData.botName || botName;
  const activeGreeting =
    liveData.greeting || greeting || `Hi there! 👋 I'm ${activeBotName}. How can I assist you with our services and solutions today?`;
  const activeRoleTitle = useMemo(() => {
    if (liveData.roleTitle && String(liveData.roleTitle).trim()) {
      return String(liveData.roleTitle).trim();
    }
    if (roleTitle && roleTitle.trim()) {
      return roleTitle.trim();
    }
    return deriveBusinessRoleSubtitle(activeBotName, (activeGreeting || '') + ' ' + (botName || ''));
  }, [liveData.roleTitle, roleTitle, activeBotName, activeGreeting, botName]);
  const activeQuestions = liveData.suggestedQuestions || suggestedQuestions;
  const activePhone = liveData.phone || phone;
  const activePhoneRaw = liveData.phoneRaw || phoneRaw;
  const activeWhatsapp = liveData.whatsapp || whatsapp;
  const activeEmail = liveData.email || email;
  const activeLauncherStyle = liveData.launcherStyle || launcherStyle;
  const activeCustomLinks = liveData.customLinks || customLinks || [];
  const launcherId = [
    "standard",
    "minimal",
    "pill",
    "chat",
    "chatbox",
    "heart",
    "gradient-ring",
    "neon-glow",
    "emoji",
    "square",
    "beacon",
    "text-button",
  ].includes(activeLauncherStyle)
    ? activeLauncherStyle
    : "standard";
  const launcherGradient = `linear-gradient(135deg, ${primaryColor} 0%, #E11D48 50%, #F59E0B 100%)`;

  const whatsappUrl = `https://wa.me/${activeWhatsapp.replace(/[^\d]/g, "")}?text=${encodeURIComponent(
    `Hi! I just chatted with ${activeBotName} and want to talk to your team.`
  )}`;

  const activeFastLinksCount =
    (activePhoneRaw ? 1 : 0) +
    (activeWhatsapp ? 1 : 0) +
    activeCustomLinks.filter(
      (l: { label?: string; url?: string }) =>
        l.label &&
        l.url &&
        !hiddenQuickLinks.includes(l.url)
    ).length;

  const isFastDense = activeFastLinksCount >= 3;

  const firstName =
    userProfile?.name?.trim().split(/\s+/)[0] ||
    user?.displayName?.trim().split(/\s+/)[0] ||
    "";

  const buildWelcome = useCallback((): ChatMsg => {
    if (!firstName) return { role: "assistant", content: activeGreeting };
    return {
      role: "assistant",
      content: `Namaste ${firstName}! 👋 I'm ${activeBotName}, your AI representative. How can I help you today?`,
    };
  }, [firstName, activeGreeting, activeBotName]);

  // Typing animation on first open
  useEffect(() => {
    if (!open || welcomeTyped) return;
    const fullMsg = buildWelcome();
    const text = fullMsg.content;
    const chars = Array.from(text);
    let idx = 0;
    setIsTypingWelcome(true);
    setMessages([{ role: "assistant", content: "" }]);

    const startDelay = setTimeout(() => {
      const typeStep = () => {
        idx += 1;
        setMessages([{ role: "assistant", content: chars.slice(0, idx).join("") }]);
        if (idx >= chars.length) {
          typingRef.current = null;
          setIsTypingWelcome(false);
          setWelcomeTyped(true);
          setMessages([{ role: "assistant", content: text }]);
          return;
        }
        const ch = chars[idx];
        const pause = ch === "\n" ? 240 : /[.?,!;:।]/.test(ch) ? 190 : /\s/.test(ch) ? 90 : 26;
        typingRef.current = setTimeout(typeStep, pause);
      };
      typingRef.current = setTimeout(typeStep, 26);
    }, 180);

    return () => {
      clearTimeout(startDelay);
      if (typingRef.current) clearTimeout(typingRef.current);
    };
  }, [open, welcomeTyped, buildWelcome]);

  // Soft attention pulse every 7s
  useEffect(() => {
    const pulseId = setInterval(() => setPulse((p) => p + 1), 7000);
    return () => clearInterval(pulseId);
  }, []);

  // Rotate funny loading messages
  useEffect(() => {
    if (!loading) return;
    const loadingId = setInterval(() => {
      setLoadingMessageIndex((i) => (i + 1) % LOADING_MESSAGES.length);
    }, 2000);
    return () => clearInterval(loadingId);
  }, [loading]);

  // Mobile viewport detection
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 639px)");
    const apply = () => setIsNarrow(mq.matches);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);

  // Visual viewport keyboard tracking (lift sheet on iOS/Android virtual keyboard)
  const [keyboardInset, setKeyboardInset] = useState(0);
  useEffect(() => {
    if (!open || !isNarrow) {
      setKeyboardInset(0);
      return;
    }
    const vv = window.visualViewport;
    if (!vv) return;
    const update = () => {
      const inset = Math.max(0, window.innerHeight - vv.height - vv.offsetTop);
      const next = inset > 100 ? Math.round(inset) : 0;
      setKeyboardInset(next);
      if (next > 0) {
        followRef.current = true;
        const pin = () => {
          const el = scrollRef.current;
          if (el) el.scrollTop = el.scrollHeight;
        };
        requestAnimationFrame(pin);
        setTimeout(pin, 280);
      }
    };
    update();
    vv.addEventListener("resize", update);
    vv.addEventListener("scroll", update);
    return () => {
      vv.removeEventListener("resize", update);
      vv.removeEventListener("scroll", update);
    };
  }, [open, isNarrow]);

  // Lock background scroll on mobile
  useEffect(() => {
    if (!open || !isNarrow) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open, isNarrow]);

  const immersive = fullscreen || isNarrow;

  // Hint bubble cycling
  useEffect(() => {
    if (open) return;
    const hintId = setInterval(() => {
      setHintIndex((i) => (i + 1) % HINT_MESSAGES.length);
      setHint(true);
      setTimeout(() => setHint(false), 8000);
    }, 12000);
    return () => clearInterval(hintId);
  }, [open]);

  const scrollToBottom = useCallback(() => {
    followRef.current = true;
    requestAnimationFrame(() => {
      scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
    });
  }, []);

  const handleScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const distFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    setShowGoDown(distFromBottom > 120);
    followRef.current = distFromBottom <= 80;
  }, []);

  const clearHistory = () => {
    followRef.current = true;
    setMessages([buildWelcome()]);
    setEnquiry({ active: false, step: 0, data: {} });
    setEnquiryOptions([]);
    setFollowUp(false);
    setLastAction("chat");
    setLoading(false);
    setInput("");
    requestAnimationFrame(() => {
      scrollRef.current?.scrollTo({ top: 0 });
    });
  };

  // Never auto-scroll when messages/loading change: keep the viewport stable
  // even while a reply is rendering. Only refresh the "go to latest" button.
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const distFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    setShowGoDown(distFromBottom > 120);
    followRef.current = distFromBottom <= 80;
  }, [messages, loading]);

  const toggle = () => {
    followRef.current = true;
    setOpen((o) => !o);
  };

  const send = async (preset?: string) => {
    const text = (preset ?? input).trim();
    if (!text || loading) return;
    followRef.current = true;

    // Contact shortcuts
    if (text === "📞 Call Specialist" || text === "Call Specialist" || text === "Call Now") {
      window.location.href = `tel:${phoneRaw}`;
      setMessages((m) => [
        ...m,
        { role: "user", content: "Calling your team directly..." },
        {
          role: "assistant",
          content: `Connecting you with our senior specialist at ${phone}! You can also tap Call Direct below:`,
        },
      ]);
      setLastAction("contact");
      return;
    }

    if (text === "💬 Send WhatsApp" || text === "Send WhatsApp" || text === "WhatsApp") {
      window.open(whatsappUrl, "_blank");
      setMessages((m) => [
        ...m,
        { role: "user", content: "Opening WhatsApp chat..." },
        {
          role: "assistant",
          content: `Opening direct WhatsApp chat with our team. You can also tap the button below to message us directly:`,
        },
      ]);
      setLastAction("contact");
      return;
    }

    if (text === "Book a Demo") {
      const demoLink =
        activeCustomLinks.find((l) => /demo|book|consult/i.test(l.label))?.url ||
        (activeCustomLinks[0] && activeCustomLinks[0].url);
      if (demoLink) {
        window.open(demoLink, "_blank");
        setMessages((m) => [
          ...m,
          { role: "user", content: text },
          {
            role: "assistant",
            content: `Great! Opening our booking/demo page for you — you can pick a slot that suits you best.`,
          },
        ]);
        return;
      }
    }

    const next: ChatMsg[] = [...messages, { role: "user", content: text }];
    setMessages(next);
    setInput("");
    setLoading(true);
    setLastAction("chat");

    // Casual lead extraction
    const lead = extractLead(next);
    if (lead.email && !leadCapturedRef.current && !enquiry.active) {
      leadCapturedRef.current = true;
      fetch(`${apiHost}/api/chat/lead`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: lead.name, email: lead.email, message: text }),
      }).catch(() => {
        leadCapturedRef.current = false;
      });
    }

    try {
      const endpoint = botId ? `${apiHost}/api/chat/${botId}` : `${apiHost}/api/chat`;
      const res = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-SiteBot-Preview": "true",
        },
        body: JSON.stringify({
          message: text,
          history: next.slice(-6).map((m) => ({ role: m.role, content: m.content })),
          sessionId: getSessionId(),
        }),
      });

      const contentType = res.headers.get("content-type") || "";

      // Streamed token response (SSE or plain text)
      if ((contentType.includes("text/event-stream") || contentType.includes("text/plain")) && res.body) {
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let fullText = "";
        let sourcesList: any[] = [];
        let buffer = "";

        setMessages((m) => [...m, { role: "assistant", content: "", sources: [] }]);
        let responseStarted = false;

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });

          if (contentType.includes("text/event-stream")) {
            const events = buffer.split("\n\n");
            buffer = events.pop() || "";
            for (const evt of events) {
              const lines = evt.split("\n");
              let eventType = "";
              let dataStr = "";
              for (const line of lines) {
                if (line.startsWith("event: ")) eventType = line.slice(7).trim();
                if (line.startsWith("data: ")) dataStr = line.slice(6).trim();
              }
              if (eventType === "sources") {
                try {
                  sourcesList = JSON.parse(dataStr);
                } catch {
                  /* noop */
                }
              } else if (eventType === "handoff") {
                try {
                  const hData = JSON.parse(dataStr);
                  setHandoffState({
                    active: hData.status === 'waiting_agent' || hData.status === 'agent_active',
                    status: hData.status,
                    agentName: hData.assignedAgent?.name,
                  });
                } catch {
                  /* noop */
                }
              } else if (eventType === "token") {
                try {
                  const { token } = JSON.parse(dataStr);
                  if (!responseStarted && token) {
                    responseStarted = true;
                    setLoading(false);
                  }
                  fullText += token;
                  setMessages((m) => {
                    const copy = [...m];
                    const last = copy[copy.length - 1];
                    if (last && last.role === "assistant") {
                      last.content = fullText;
                      last.sources = sourcesList;
                    }
                    return copy;
                  });
                } catch {
                  /* noop */
                }
              }
            }
          } else {
            if (!responseStarted && value.length > 0) {
              responseStarted = true;
              setLoading(false);
            }
            fullText += decoder.decode(value, { stream: true });
            setMessages((m) => {
              const copy = [...m];
              const last = copy[copy.length - 1];
              if (last && last.role === "assistant") {
                last.content = fullText;
              }
              return copy;
            });
          }
        }

        const parsed = parseRuntimeTags(fullText);
        if (parsed.handoffReason || parsed.handoffActive) {
          setHandoffState({
            active: true,
            status: (parsed.handoffActive as any) || 'waiting_agent',
          });
        }
        setMessages((m) => {
          const copy = [...m];
          const last = copy[copy.length - 1];
          if (last && last.role === "assistant") {
            last.content = parsed.cleanText;
            last.sources = sourcesList;
          }
          return copy;
        });
        setLoading(false);
        return;
      }

      // JSON response fallback
      const data = await res.json();
      setLoading(false);
      const rawContent = data.response || data.reply || data.content || "Thanks for your message!";
      const parsed = parseRuntimeTags(rawContent);
      if (parsed.handoffReason || parsed.handoffActive) {
        setHandoffState({
          active: true,
          status: (parsed.handoffActive as any) || 'waiting_agent',
        });
      }
      setMessages((m) => [
        ...m,
        { role: "assistant", content: parsed.cleanText, sources: data.sources || [] },
      ]);
    } catch {
      setLoading(false);
      setMessages((m) => [
        ...m,
        {
          role: "assistant",
          content: "Something went wrong. Please try again or reach out to our team directly.",
        },
      ]);
    }
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  };

  const suggestions = useMemo(() => {
    if (loading) return [];
    if (messages.length <= 1) {
      return activeQuestions && activeQuestions.length > 0
        ? activeQuestions
        : DEFAULT_QUICK_REPLIES;
    }
    const lastMsg = messages[messages.length - 1];
    if (lastMsg.role !== "assistant") return [];

    const lastUserMsg = [...messages].reverse().find((m) => m.role === "user");
    const userText = (lastUserMsg?.content || "").toLowerCase();

    if (/\b(services|what (services|do you offer|can you do)|offerings|capabilities)\b/i.test(userText)) {
      return SERVICE_CATEGORIES;
    }

    if (/\b(pricing|packages|charges|cost)\b/i.test(userText)) {
      return ["💬 Send WhatsApp", "📞 Call Specialist"];
    }

    return [];
  }, [messages, loading, activeQuestions]);

  const ContactButtons = (
    <div className="flex flex-col gap-2.5 mt-2 w-full">
      <div className="grid grid-cols-2 gap-2">
        <a
          href={`tel:${activePhoneRaw}`}
          className="flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl text-[13px] font-bold text-white bg-emerald-600 hover:bg-emerald-500 active:scale-95 shadow-[0_6px_20px_rgba(16,185,129,0.35)] transition-all"
        >
          <Phone className="w-4 h-4" />
          Call Direct
        </a>
        <a
          href={whatsappUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl text-[13px] font-bold text-white hover:brightness-110 active:scale-95 shadow-[0_6px_20px_rgba(37,211,102,0.35)] transition-all"
          style={{ background: "linear-gradient(135deg, #25D366 0%, #128C7E 100%)" }}
        >
          <MessageCircle className="w-4 h-4" fill="white" />
          WhatsApp Msg
        </a>
      </div>
      <div className="flex gap-2">
        <a
          href={`mailto:${activeEmail}`}
          className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl text-[12px] font-bold text-[var(--text-primary)] bg-[var(--bg-card)] hover:bg-[var(--bg-card-hover)] border border-[var(--border-default)] active:scale-95 transition-all shadow-sm"
        >
          <Mail className="w-3.5 h-3.5 text-rose-500" /> Email Us
        </a>
        <button
          type="button"
          onClick={() => send("Book a Demo")}
          className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl text-[12px] font-bold text-[var(--text-primary)] bg-[var(--bg-card)] hover:bg-[var(--bg-card-hover)] border border-[var(--border-default)] active:scale-95 transition-all shadow-sm"
        >
          <Calendar className="w-3.5 h-3.5 text-amber-500" /> Book a Demo
        </button>
      </div>
    </div>
  );

  return (
    <>
      {/* Floating Launcher with Halo & Hint Bubble */}
      <div
        className={`fixed right-5 sm:right-6 bottom-6 z-40 flex flex-col items-end gap-3 transition-all duration-300 ease-out will-change-transform ${
          open && isNarrow ? "opacity-0 pointer-events-none scale-75" : "opacity-100 pointer-events-auto"
        }`}
      >
        <AnimatePresence>
          {hint && !open && (
            <motion.div
              initial={{ opacity: 0, y: 12, scale: 0.85 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 12, scale: 0.85 }}
              transition={{ type: "spring", stiffness: 350, damping: 25 }}
              className="relative rounded-2xl rounded-br-sm px-4 py-2.5 text-[11px] sm:text-xs font-semibold shadow-xl cursor-pointer max-w-[calc(100vw-5rem)] sm:max-w-xs text-white border border-rose-500/20 bg-slate-900/90 backdrop-blur-xl hover:scale-105 transition-transform duration-200"
              style={{
                boxShadow: "0 10px 30px rgba(0,0,0,0.3), 0 0 20px rgba(225,29,72,0.2)",
              }}
              onClick={toggle}
            >
              <span className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping" />
                {HINT_MESSAGES[hintIndex]}
              </span>
              <span className="absolute -bottom-1.5 right-5 w-3 h-3 bg-slate-900 border-r border-b border-rose-500/20 rotate-45" />
            </motion.div>
          )}
        </AnimatePresence>

        <div className="relative group">
          {/* Rotating Conic Gradient Outer Halo */}
          {!open && ["standard", "gradient-ring", "neon-glow"].includes(launcherId) && (
            <div
              className={`absolute -inset-1 rounded-full opacity-75 group-hover:opacity-100 blur-[6px] transition-opacity duration-300 pointer-events-none ${
                launcherId === "neon-glow" ? "blur-[12px]" : ""
              }`}
              style={{
                background:
                  launcherId === "neon-glow"
                    ? `radial-gradient(circle, ${primaryColor}66, #0EA5E9 55%, transparent 75%)`
                    : `conic-gradient(from 0deg, ${primaryColor}, #F43F5E, #F59E0B, #0EA5E9, ${primaryColor})`,
                animation:
                  launcherId === "gradient-ring" ? "spin 6s linear infinite" : "spin 8s linear infinite",
              }}
            />
          )}

          <motion.button
            type="button"
            onClick={toggle}
            aria-label={`Chat with ${activeBotName} — ${activeRoleTitle}`}
            aria-expanded={open}
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.4, type: "spring", stiffness: 220, damping: 16 }}
            whileHover={{ scale: 1.08 }}
            whileTap={{ scale: 0.92 }}
            className={`relative flex items-center justify-center cursor-pointer overflow-hidden border transition-all duration-300 backdrop-blur-2xl ${
              launcherId === "pill"
                ? "h-12 rounded-full px-5 border-white/30"
                : launcherId === "text-button"
                ? "h-12 rounded-full px-5 border-white/40 bg-white shadow-[0_12px_35px_rgba(225,29,72,0.35)]"
                : launcherId === "square"
                ? "w-14 h-14 rounded-2xl border-white/30"
                : launcherId === "chatbox"
                ? "w-14 h-14 rounded-2xl border-white/30"
                : launcherId === "emoji" || launcherId === "chat"
                ? "w-14 h-14 rounded-full border-white/40 bg-white shadow-[0_12px_35px_rgba(225,29,72,0.35)]"
                : "w-14 h-14 rounded-full border-white/30"
            }`}
            style={{
              background:
                launcherId === "chat" || launcherId === "emoji" || launcherId === "text-button"
                  ? "rgba(255,255,255,0.96)"
                  : launcherGradient,
              boxShadow:
                launcherId === "neon-glow"
                  ? `0 0 18px ${primaryColor}, 0 0 45px ${primaryColor}99`
                  : undefined,
            }}
          >
            {/* Shimmer sweep */}
            {["standard", "gradient-ring", "neon-glow", "chatbox", "square"].includes(launcherId) && (
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/25 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000 pointer-events-none" />
            )}

            {/* Periodic glow pulse */}
            <AnimatePresence>
              {!open && ["standard", "heart", "neon-glow"].includes(launcherId) && (
                <motion.span
                  key={pulse}
                  initial={{ opacity: 0.7, scale: 1 }}
                  animate={{ opacity: 0, scale: 1.6 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 1.8, ease: "easeOut" }}
                  className="absolute inset-0 rounded-full bg-rose-500 pointer-events-none"
                />
              )}
            </AnimatePresence>

            {/* Breathing radar ring */}
            {!open && ["standard", "beacon"].includes(launcherId) && (
              <div
                className="absolute -inset-1.5 rounded-full border border-amber-400/40 animate-ping pointer-events-none opacity-40"
                style={{ animationDuration: "3.2s" }}
              />
            )}

            <AnimatePresence mode="wait" initial={false}>
              {open ? (
                <motion.span
                  key="x"
                  initial={{ rotate: -90, opacity: 0 }}
                  animate={{ rotate: 0, opacity: 1 }}
                  exit={{ rotate: 90, opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="relative z-10"
                >
                  <X
                    className="w-6 h-6"
                    style={{
                      color: ["chat", "emoji", "text-button"].includes(launcherId)
                        ? primaryColor
                        : "#ffffff",
                    }}
                  />
                </motion.span>
              ) : (
                <div className="relative z-10 flex items-center justify-center w-full h-full gap-1.5">
                  {launcherId === "emoji" ? (
                    <span className="text-3xl leading-none drop-shadow-[0_2px_8px_rgba(0,0,0,0.25)]">
                      👋
                    </span>
                  ) : launcherId === "heart" ? (
                    <div className="relative flex items-center justify-center">
                      <span className="text-3xl leading-none">💗</span>
                    </div>
                  ) : launcherId === "beacon" ? (
                    <span className="relative flex h-4 w-4">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                      <span className="relative inline-flex rounded-full h-4 w-4 bg-emerald-500 border-2 border-white" />
                    </span>
                  ) : launcherId === "text-button" ? (
                    <span className="text-sm font-extrabold px-1" style={{ color: primaryColor }}>
                      Chat
                    </span>
                  ) : launcherId === "pill" ? (
                    <>
                      <Bot className="w-5 h-5 text-white drop-shadow-[0_2px_8px_rgba(0,0,0,0.3)]" />
                      <span className="text-white text-[13px] font-extrabold whitespace-nowrap drop-shadow-[0_1px_4px_rgba(0,0,0,0.3)]">
                        Chat with us
                      </span>
                    </>
                  ) : (
                    <div className="relative flex items-center justify-center">
                      <Bot
                        className="w-7 h-7 sm:w-8 sm:h-8 z-10"
                        style={{
                          color: ["chat", "emoji", "text-button"].includes(launcherId)
                            ? primaryColor
                            : "#ffffff",
                        }}
                      />
                    </div>
                  )}

                  {/* Online live radar badge */}
                  {!["emoji", "heart", "beacon", "text-button"].includes(launcherId) && (
                    <span className="absolute top-1 right-1 sm:top-1.5 sm:right-1.5 flex h-3.5 w-3.5 z-20 pointer-events-none">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                      <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-emerald-500 border-2 border-white items-center justify-center shadow-sm">
                        <span className="w-1 h-1 rounded-full bg-white" />
                      </span>
                    </span>
                  )}
                </div>
              )}
            </AnimatePresence>
          </motion.button>

          {/* Hover Tooltip */}
          {!open && (
            <div className="absolute right-full mr-3 top-1/2 -translate-y-1/2 pointer-events-none opacity-0 group-hover:opacity-100 translate-x-2 group-hover:translate-x-0 transition-all duration-200 whitespace-nowrap z-50 hidden sm:block">
              <div className="bg-slate-900/95 text-white text-xs font-bold py-1.5 px-3 rounded-xl shadow-xl border border-white/10 flex items-center gap-2 backdrop-blur-xl">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <span>Chat with {botName} AI</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Chat Window */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 30, scale: 0.92 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 30, scale: 0.92 }}
            transition={{ type: "spring", stiffness: 300, damping: 26 }}
            className={`chat-window fixed z-[60] will-change-transform transition-[opacity,transform] duration-300 ${
              immersive
                ? isNarrow
                  ? "inset-0 h-[100dvh] p-0"
                  : "inset-0 p-4 sm:p-6 flex items-center justify-center"
                : "right-4 left-4 sm:left-auto sm:right-6 sm:w-[420px] bottom-24 top-20 max-h-[calc(100dvh-120px)]"
            }`}
            style={immersive ? { bottom: isNarrow ? keyboardInset : 0 } : {}}
          >
            {/* Ambient Backdrop */}
            {immersive && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.3 }}
                className="fixed inset-0 -z-10 bg-black/60 backdrop-blur-md"
              />
            )}

            <div
              className={`relative flex flex-col overflow-hidden backdrop-blur-2xl border border-white/10 shadow-card chat-window-bg ${
                isNarrow
                  ? "rounded-none h-full w-full"
                  : fullscreen
                  ? "rounded-3xl h-[calc(100vh-2rem)] sm:h-[calc(100vh-3rem)] md:max-h-[85vh] w-full md:w-auto md:min-w-[560px] lg:min-w-[680px]"
                  : "rounded-3xl h-full w-full"
              }`}
            >
              {/* Top gradient brand bar */}
              <div className="h-[3px] w-full bg-gradient-brand shrink-0" />

              {/* Ambient blur orbs */}
              <div className="pointer-events-none absolute -top-16 -right-16 w-44 h-44 bg-rose-500/20 rounded-full blur-3xl" />
              <div className="pointer-events-none absolute -bottom-20 -left-16 w-44 h-44 bg-blue-500/15 rounded-full blur-3xl" />

              <div className="relative flex flex-col flex-1 min-h-0 w-full mx-auto max-w-full md:max-w-3xl lg:max-w-4xl">
                {/* Header */}
                <div
                  className={`relative flex items-center gap-2 sm:gap-3 px-3 chat-header-bar shrink-0 min-w-0 transition-all ${
                    isFastDense || activeBotName.length >= 16 ? "py-2 sm:py-2.5" : "py-2.5 sm:py-3.5"
                  }`}
                >
                  <div className="relative shrink-0">
                    <div className="absolute inset-0 rounded-full bg-gradient-brand blur-md opacity-60" />
                    <div
                      className={`relative rounded-full bg-gradient-brand flex items-center justify-center shadow-glow ring-2 ring-white/20 transition-all ${
                        isFastDense || activeBotName.length >= 16 ? "w-8 h-8 sm:w-9 sm:h-9" : "w-9 h-9 sm:w-10 sm:h-10"
                      }`}
                    >
                      <Bot className={`${isFastDense || activeBotName.length >= 16 ? "w-4 h-4 sm:w-4.5 sm:h-4.5" : "w-5 h-5"} text-white`} />
                    </div>
                    <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-emerald-400 border-2 border-slate-900" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-bold text-xs sm:text-[13.5px] leading-tight flex items-center gap-1.5 chat-title min-w-0">
                      <span className="truncate max-w-[130px] sm:max-w-[190px]" title={activeBotName}>
                        {activeBotName}
                      </span>
                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-[8.5px] font-bold uppercase tracking-wider shrink-0 whitespace-nowrap">
                        <span className="w-1 h-1 rounded-full bg-emerald-400" />
                        Online
                      </span>
                    </div>
                    <p className="text-[10px] sm:text-[11px] chat-subtitle flex items-center gap-1 mt-0.5 truncate max-w-[210px]">
                      <span className="truncate">{firstName ? `Here to help you, ${firstName}` : activeRoleTitle}</span>
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={clearHistory}
                    aria-label="Clear chat history"
                    title="Clear history"
                    className="w-8 h-8 rounded-full chat-icon-btn flex items-center justify-center transition-all cursor-pointer shrink-0"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                  {!isNarrow && (
                    <button
                      type="button"
                      onClick={() => setFullscreen((f) => !f)}
                      aria-label={fullscreen ? "Exit fullscreen" : "Fullscreen"}
                      className="w-8 h-8 rounded-full chat-icon-btn flex items-center justify-center transition-all cursor-pointer shrink-0"
                    >
                      {fullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={toggle}
                    aria-label="Close chat"
                    className="w-8 h-8 rounded-full chat-icon-btn flex items-center justify-center transition-all cursor-pointer shrink-0"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                {/* Quick Connect Fast Bar */}
                <div
                  className={`chat-fast-bar flex items-center gap-1 sm:gap-1.5 shrink-0 overflow-x-auto no-scrollbar transition-all ${
                    isFastDense ? "px-2.5 py-1.5" : "px-3 py-2"
                  }`}
                >
                  {activePhoneRaw && (
                    <a
                      href={`tel:${activePhoneRaw}`}
                      title={`Direct Call (${activePhone})`}
                      className={`chat-fast-btn chat-fast-btn-call active:scale-95 shrink-0 whitespace-nowrap ${
                        isFastDense ? "gap-1 px-2 py-1 text-[10px] rounded-md" : "gap-1.5 px-2.5 py-1.5 text-[11px] rounded-lg"
                      }`}
                    >
                      <Phone className={`${isFastDense ? "w-3 h-3" : "w-3.5 h-3.5"} shrink-0`} />
                      <span>Call Now</span>
                    </a>
                  )}

                  {activeWhatsapp && (
                    <a
                      href={whatsappUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      title="Send WhatsApp Message"
                      className={`chat-fast-btn chat-fast-btn-wa active:scale-95 shrink-0 whitespace-nowrap ${
                        isFastDense ? "gap-1 px-2 py-1 text-[10px] rounded-md" : "gap-1.5 px-2.5 py-1.5 text-[11px] rounded-lg"
                      }`}
                    >
                      <MessageCircle className={`${isFastDense ? "w-3 h-3" : "w-3.5 h-3.5"} shrink-0`} fill="currentColor" />
                      <span>WhatsApp</span>
                    </a>
                  )}

                  {/* Talk to Human Agent Fast Action */}
                  <button
                    type="button"
                    onClick={requestLiveHandoff}
                    title="Speak with a live human representative"
                    className={`chat-fast-btn active:scale-95 shrink-0 whitespace-nowrap bg-emerald-600/90 hover:bg-emerald-500 text-white border border-emerald-400/30 ${
                      isFastDense ? "gap-1 px-2 py-1 text-[10px] rounded-md" : "gap-1.5 px-2.5 py-1.5 text-[11px] rounded-lg"
                    }`}
                  >
                    <Headphones className={`${isFastDense ? "w-3 h-3" : "w-3.5 h-3.5"} shrink-0`} />
                    <span>Talk to Human</span>
                  </button>

                  {/* Leave Message / Lead Capture Fast Action */}
                  <button
                    type="button"
                    onClick={() => setShowLeadForm((prev) => !prev)}
                    title="Leave your contact details / request a callback"
                    className={`chat-fast-btn active:scale-95 shrink-0 whitespace-nowrap bg-indigo-600/90 hover:bg-indigo-500 text-white border border-indigo-400/30 ${
                      isFastDense ? "gap-1 px-2 py-1 text-[10px] rounded-md" : "gap-1.5 px-2.5 py-1.5 text-[11px] rounded-lg"
                    }`}
                  >
                    <Mail className={`${isFastDense ? "w-3 h-3" : "w-3.5 h-3.5"} shrink-0`} />
                    <span>Contact Us</span>
                  </button>

                  {activeCustomLinks
                    .filter(
                      (l) =>
                        l.label &&
                        l.url &&
                        !hiddenQuickLinks.includes(l.url)
                    )
                    .map((link, linkIdx) => (
                      <div
                        key={linkIdx}
                        title={link.label}
                        className={`chat-fast-btn group/quick active:scale-95 shrink-0 whitespace-nowrap ${
                          isFastDense
                            ? "gap-1 px-1.5 py-1 text-[10px] rounded-md"
                            : "gap-1.5 px-2.5 py-1.5 text-[11px] rounded-lg"
                        }`}
                      >
                        <a
                          href={link.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1.5 min-w-0"
                        >
                          <Link2
                            className={`${isFastDense ? "w-3 h-3" : "w-3.5 h-3.5"} shrink-0`}
                          />
                          <span className="truncate max-w-[110px]">{link.label}</span>
                        </a>
                        <button
                          type="button"
                          aria-label={`Hide ${link.label} link`}
                          title="Hide this quick link"
                          onClick={() => hideQuickLink(link.url)}
                          className="opacity-40 group-hover/quick:opacity-90 hover:bg-black/10 rounded-full p-0.5 shrink-0 transition-opacity"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                </div>

                {/* Live Handoff Status Banner */}
                {handoffState.active && (
                  <div className="mx-3 my-1.5 px-3 py-2 rounded-xl bg-emerald-950/80 border border-emerald-500/40 text-emerald-200 text-xs flex items-center justify-between shadow-lg shrink-0">
                    <div className="flex items-center gap-2">
                      <span className="relative flex h-2 w-2">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                      </span>
                      <span>
                        {handoffState.status === 'agent_active'
                          ? `Connected with ${handoffState.agentName || 'Live Agent'}`
                          : 'Waiting for live agent to connect...'}
                      </span>
                    </div>
                    <button
                      onClick={() => setHandoffState({ active: false, status: 'bot' })}
                      className="text-[10px] font-semibold text-emerald-300 hover:text-white underline cursor-pointer"
                    >
                      Back to AI
                    </button>
                  </div>
                )}

                {/* Dynamic Lead Capture Card */}
                {showLeadForm && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="mx-3 my-1.5 p-3.5 rounded-2xl bg-slate-900/90 border border-indigo-500/30 text-white shadow-xl shrink-0"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-bold flex items-center gap-1.5 text-indigo-300">
                        Leave Contact Details
                      </span>
                      <button
                        onClick={() => setShowLeadForm(false)}
                        className="text-slate-400 hover:text-white text-xs p-1"
                      >
                        ✕
                      </button>
                    </div>
                    <form onSubmit={handleLeadSubmit} className="flex flex-col gap-2">
                      <input
                        type="text"
                        required
                        placeholder="Your Full Name *"
                        value={leadForm.name}
                        onChange={(e) => setLeadForm({ ...leadForm, name: e.target.value })}
                        className="w-full px-2.5 py-1.5 text-xs rounded-lg bg-black/40 border border-white/10 text-white placeholder-slate-400 focus:outline-none focus:border-indigo-500"
                      />
                      <input
                        type="email"
                        required
                        placeholder="Email Address *"
                        value={leadForm.email}
                        onChange={(e) => setLeadForm({ ...leadForm, email: e.target.value })}
                        className="w-full px-2.5 py-1.5 text-xs rounded-lg bg-black/40 border border-white/10 text-white placeholder-slate-400 focus:outline-none focus:border-indigo-500"
                      />
                      <input
                        type="tel"
                        required
                        placeholder="Phone Number *"
                        value={leadForm.phone}
                        onChange={(e) => setLeadForm({ ...leadForm, phone: e.target.value })}
                        className="w-full px-2.5 py-1.5 text-xs rounded-lg bg-black/40 border border-white/10 text-white placeholder-slate-400 focus:outline-none focus:border-indigo-500"
                      />
                      <textarea
                        rows={2}
                        placeholder="Requirement / Note (Optional)"
                        value={leadForm.message}
                        onChange={(e) => setLeadForm({ ...leadForm, message: e.target.value })}
                        className="w-full px-2.5 py-1.5 text-xs rounded-lg bg-black/40 border border-white/10 text-white placeholder-slate-400 focus:outline-none focus:border-indigo-500 resize-none"
                      />
                      <button
                        type="submit"
                        disabled={leadSubmitting || !leadForm.name || !leadForm.email || !leadForm.phone}
                        className="w-full py-1.5 text-xs font-bold rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white flex items-center justify-center gap-1.5 disabled:opacity-50 transition-colors"
                      >
                        {leadSubmitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                        <span>Submit Request</span>
                      </button>
                    </form>
                  </motion.div>
                )}

                {/* Messages Body */}
                <div className="relative flex-1 min-h-0 flex flex-col">
                  <div
                    ref={scrollRef}
                    onScroll={handleScroll}
                    className="flex-1 overflow-y-auto overflow-x-hidden chat-scrollbar p-4 flex flex-col gap-3.5"
                  >
                    {messages.map((m, i) => (
                      <motion.div
                        key={i}
                        initial={{ opacity: 0, y: 10, scale: 0.96 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        transition={{ type: "spring", stiffness: 350, damping: 26 }}
                        className={`flex items-end gap-2 max-w-full ${
                          m.role === "system"
                            ? "justify-center w-full my-1"
                            : m.role === "user"
                            ? "justify-end"
                            : "justify-start"
                        }`}
                      >
                        {m.role === "system" ? (
                          <span className="text-[10px] font-bold px-3 py-1 rounded-full bg-black/40 border border-white/10 text-slate-300">
                            {m.content}
                          </span>
                        ) : (
                          <>
                            {m.role === "assistant" && <FridayAvatar botName={activeBotName} />}
                            {m.role === "agent" && (
                              <div className="w-8 h-8 rounded-full bg-emerald-600 border border-emerald-300 flex items-center justify-center text-white shrink-0 shadow-md">
                                <Headphones className="w-4 h-4" />
                              </div>
                            )}
                            <div
                              className={`relative max-w-[calc(100%-3.25rem)] sm:max-w-[80%] min-w-0 px-4 py-2.5 text-[14px] leading-[1.5] break-words [overflow-wrap:anywhere] backdrop-blur-md ${
                                m.role === "user"
                                  ? "bg-gradient-brand chat-user-bubble rounded-2xl rounded-br-sm shadow-[0_8px_24px_rgba(220,38,38,0.35)] border border-white/15 whitespace-pre-wrap"
                                  : m.role === "agent"
                                  ? "bg-emerald-950/80 border border-emerald-500/40 text-emerald-100 rounded-2xl rounded-bl-sm shadow-card"
                                  : "chat-bot-bubble rounded-2xl rounded-bl-sm shadow-card"
                              }`}
                            >
                              {m.role === "agent" && (
                                <div className="text-[10px] font-bold text-emerald-400 mb-1 flex items-center gap-1">
                                  <span>{m.senderName || 'Live Agent'}</span>
                                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                                </div>
                              )}
                              {m.role === "user" && (
                                <span className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/40 to-transparent rounded-full" />
                              )}
                              {m.role === "user" ? linkify(m.content) : renderMessageMarkdown(m.content)}
                              {m.sources && m.sources.length > 0 && (
                                <div className="flex flex-wrap gap-1 mt-2 pt-2 border-t border-white/10">
                                  {m.sources.map((s, idx) => (
                                    <a
                                      key={idx}
                                      href={s.url}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="text-[10px] px-2 py-0.5 rounded bg-white/10 hover:bg-white/20 text-rose-300 underline"
                                    >
                                      {s.title || "Source"}
                                    </a>
                                  ))}
                                </div>
                              )}
                            </div>
                            {m.role === "user" && (
                              <UserAvatar
                                photoURL={user?.photoURL}
                                displayName={userProfile?.name || user?.displayName}
                              />
                            )}
                          </>
                        )}
                      </motion.div>
                    ))}

                    {lastAction === "contact" && !loading && (
                      <div className="flex items-end gap-2 justify-start">
                        <FridayAvatar botName={activeBotName} />
                        <div className="max-w-[85%] sm:max-w-[75%] md:max-w-[480px]">
                          {ContactButtons}
                        </div>
                      </div>
                    )}

                    {/* Animated Shimmer Loading Card */}
                    {loading && (
                      <motion.div
                        initial={{ opacity: 0, y: 12, scale: 0.96 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 8, scale: 0.96 }}
                        transition={{ type: "spring", stiffness: 340, damping: 26 }}
                        className="flex items-end gap-2"
                      >
                        <FridayAvatar botName={activeBotName} />
                        <div className="relative max-w-[calc(100%-3.25rem)] sm:max-w-[82%] overflow-hidden">
                          <div
                            className="absolute inset-0 rounded-2xl rounded-bl-sm"
                            style={{
                              background:
                                "linear-gradient(90deg, transparent 0%, rgba(96,165,250,0.35) 40%, rgba(167,139,250,0.35) 60%, transparent 100%)",
                              backgroundSize: "200% 100%",
                              animation: "chat-shimmer 1.8s linear infinite",
                              padding: "1px",
                            }}
                          />
                          <div className="relative px-4 py-3 rounded-2xl rounded-bl-sm chat-loading-card backdrop-blur-md">
                            <div className="flex items-center gap-3 mb-2.5">
                              <div className="flex items-center gap-1.5">
                                {[0, 1, 2].map((i) => (
                                  <motion.span
                                    key={i}
                                    className="block w-2 h-2 rounded-full"
                                    style={{
                                      background:
                                        i === 0 ? "#60a5fa" : i === 1 ? "#a78bfa" : "#f472b6",
                                      boxShadow:
                                        i === 0
                                          ? "0 0 6px rgba(96,165,250,0.7)"
                                          : i === 1
                                          ? "0 0 6px rgba(167,139,250,0.7)"
                                          : "0 0 6px rgba(244,114,182,0.7)",
                                    }}
                                    animate={{ y: [0, -6, 0], opacity: [0.6, 1, 0.6] }}
                                    transition={{
                                      duration: 0.9,
                                      delay: i * 0.18,
                                      repeat: Infinity,
                                      ease: "easeInOut",
                                    }}
                                  />
                                ))}
                              </div>
                              <span className="text-[10px] font-bold chat-loading-subtext uppercase tracking-widest">
                                {activeBotName} is thinking
                              </span>
                            </div>

                            <div className="relative" style={{ minHeight: "20px" }}>
                              <AnimatePresence mode="wait">
                                <motion.div
                                  key={loadingMessageIndex}
                                  initial={{ opacity: 0, y: 10 }}
                                  animate={{ opacity: 1, y: 0 }}
                                  exit={{ opacity: 0, y: -10 }}
                                  transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
                                  className="flex items-center gap-2"
                                >
                                  <span className="text-base leading-none">
                                    {LOADING_MESSAGES[loadingMessageIndex].emoji}
                                  </span>
                                  <span className="text-[13px] leading-none font-normal chat-loading-text">
                                    {LOADING_MESSAGES[loadingMessageIndex].text}
                                  </span>
                                </motion.div>
                              </AnimatePresence>
                            </div>
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </div>

                  {/* Scroll-To-Bottom Floating Button */}
                  <AnimatePresence>
                    {showGoDown && (
                      <motion.button
                        type="button"
                        onClick={scrollToBottom}
                        aria-label="Go to latest message"
                        title="Go to latest message"
                        initial={{ opacity: 0, y: 10, scale: 0.8 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 10, scale: 0.8 }}
                        transition={{ type: "spring", stiffness: 350, damping: 26 }}
                        className="self-center mt-[10px] shrink-0 w-9 h-9 rounded-full bg-gradient-brand text-white flex items-center justify-center shadow-glow-lg border border-white/20 hover:brightness-110 active:scale-90 transition-all cursor-pointer"
                      >
                        <ArrowDown className="w-5 h-5" />
                      </motion.button>
                    )}
                  </AnimatePresence>
                </div>

                {/* Suggestions / Quick Replies */}
                {!enquiry.active && !followUp && suggestions.length > 0 && !loading && (
                  <div className="shrink-0 px-4 pb-2 pt-1">
                    <div className="flex items-center justify-between gap-2 md:hidden">
                      <span className="text-[9px] font-bold uppercase tracking-wider chat-quick-label">
                        Quick replies
                      </span>
                      <button
                        type="button"
                        onClick={() => setSugOpen((o) => !o)}
                        className="flex items-center gap-1 text-[10px] font-semibold chat-quick-label hover:opacity-100 chat-chip rounded-full px-2.5 py-1 transition-all cursor-pointer"
                      >
                        {sugOpen ? <ChevronDown className="w-3 h-3" /> : <ChevronUp className="w-3 h-3" />}
                        {sugOpen ? "Hide" : "Show"}
                      </button>
                    </div>
                    <div
                      className={`gap-2 pb-0.5 overflow-x-auto no-scrollbar md:overflow-x-visible md:flex-wrap md:mt-0 ${
                        sugOpen ? "flex mt-1.5 md:mt-0" : "hidden md:flex"
                      }`}
                    >
                      {suggestions.map((q) => (
                        <button
                          key={q}
                          type="button"
                          onClick={() => send(q)}
                          className="group shrink-0 whitespace-nowrap md:whitespace-normal md:shrink text-[11px] px-3 py-1.5 rounded-full chat-chip border transition-all cursor-pointer hover:shadow-glow-sm"
                        >
                          {q}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Input Area */}
                <div className="p-3 sm:p-3.5 chat-surface-input shrink-0">
                  <div className="relative flex items-center gap-2 rounded-full chat-field p-1.5 pl-4 transition-all focus-within:border-rose-500 focus-within:shadow-[0_0_0_3px_rgba(225,29,72,0.15)]">
                    <input
                      type="text"
                      value={input}
                      onChange={(e) => setInput(e.target.value)}
                      onKeyDown={onKeyDown}
                      placeholder={
                        firstName ? `Hi ${firstName}, type your message...` : "Type your message..."
                      }
                      className="chat-input flex-1 bg-transparent text-[13.5px] focus:outline-none min-w-0"
                      maxLength={1500}
                    />
                    <button
                      type="button"
                      onClick={() => send()}
                      disabled={loading || !input.trim()}
                      aria-label="Send message"
                      className="w-9 h-9 rounded-full bg-gradient-brand flex items-center justify-center text-white disabled:opacity-40 disabled:cursor-not-allowed hover:brightness-110 active:scale-90 transition-all cursor-pointer shadow-glow-sm"
                    >
                      {loading ? (
                        <motion.span
                          animate={{ rotate: 360 }}
                          transition={{ duration: 0.8, repeat: Infinity, ease: "linear" }}
                          className="w-4.5 h-4.5 border-2 border-white/30 border-t-white rounded-full"
                        />
                      ) : (
                        <Send className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                  <p className="mt-2 text-center text-[10px] chat-footer-text">
                    Powered by{" "}
                    <a
                      href={typeof window !== "undefined" ? window.location.origin : "/"}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-rose-400 hover:text-rose-300 font-semibold transition-colors"
                    >
                      SiteBot Studio
                    </a>
                  </p>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

export default ChatWidget;
