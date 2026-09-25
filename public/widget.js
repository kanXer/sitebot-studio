/**
 * SiteBot Studio - Universal Embeddable AI Chatbot Widget
 * Default Theme: Friday / Nexus High-Performance Glassmorphic Aesthetic
 * Zero-dependency, Shadow DOM isolated, full SSE streaming support.
 * Designed to fit EVERY web application (HTML, WordPress, Shopify, Webflow, React, Vue, etc.)
 */
(function () {
  'use strict';

  // 1. Locate current script element and read bot ID
  const currentScript =
    document.currentScript ||
    document.querySelector('script[data-bot-id]') ||
    document.querySelector('script[src*="widget.js"]');

  if (!currentScript) {
    console.error('[SiteBot] Widget script tag could not be found.');
    return;
  }

  const botId = currentScript.getAttribute('data-bot-id');
  if (!botId) {
    console.error('[SiteBot] data-bot-id attribute is missing on script tag.');
    return;
  }

  // Derive API host from script source or current origin
  let apiHost = '';
  try {
    const scriptUrl = new URL(currentScript.src, window.location.href);
    apiHost = scriptUrl.origin;
  } catch {
    apiHost = window.location.origin;
  }

  // Prevent multiple injections on the same page
  if (document.getElementById('sitebot-studio-root-' + botId)) {
    return;
  }

  // 2. Create Host Element and Open Shadow DOM
  const host = document.createElement('div');
  host.id = 'sitebot-studio-root-' + botId;
  document.body.appendChild(host);

  const shadow = host.attachShadow({ mode: 'open' });

  // Widget State
  let isOpen = false;
  let isFullscreen = false;
  let isStreaming = false;
  let hasTypedWelcome = false;
  let typewriterTimer = null;
  let loadingInterval = null;
  let loadingIndex = 0;
  let hintInterval = null;
  let hintTimeout = null;
  let hintIndex = 0;

  let botData = {
    id: botId,
    name: 'Assistant',
    roleTitle: '',
    primaryColor: '#4f46e5',
    position: 'bottom-right',
    launcherStyle: 'standard', // 'standard' | 'minimal' | 'pill' | 'chat'
    greeting: "Hi there! 👋 How can I assist you with our services and solutions today?",
    suggestedQuestions: [
      'What services do you offer?',
      'How can you help my business?',
      'How can I contact your team?',
    ],
    phone: '',
    phoneRaw: '',
    whatsapp: '',
    email: '',
    pricingUrl: '',
    auditUrl: '',
    customLinks: [],
  };

  let widgetSessionId = '';
  try {
    widgetSessionId = sessionStorage.getItem('sitebot_session_' + botId) || '';
    if (!widgetSessionId) {
      widgetSessionId = 'sess-' + Math.random().toString(36).slice(2) + Date.now().toString(36);
      sessionStorage.setItem('sitebot_session_' + botId, widgetSessionId);
    }
  } catch (e) {
    widgetSessionId = 'sess-' + Math.random().toString(36).slice(2) + Date.now().toString(36);
  }

  let handoffState = {
    active: false,
    status: 'bot',
    agentName: '',
  };
  let handoffPollInterval = null;

  const messageHistory = [];

  const LOADING_MESSAGES = [
    { emoji: '🤔', text: 'Noodling on that...' },
    { emoji: '🔍', text: 'Searching knowledge base...' },
    { emoji: '⚡', text: 'Turbo-charging your answer...' },
    { emoji: '🧠', text: 'Generating a thoughtful response...' },
    { emoji: '✨', text: 'Cooking up digital magic...' },
    { emoji: '🚀', text: 'Working on it, hold tight!' },
    { emoji: '📚', text: 'Flipping through playbook...' },
    { emoji: '🎯', text: 'Targeting the perfect answer...' },
    { emoji: '💡', text: 'Connecting all the dots...' },
    { emoji: '🌐', text: 'Scanning the digital universe...' },
  ];

  const HINT_MESSAGES = [
    "Hi! I'm Friday — Call, WhatsApp & AI Chat",
    'Direct Call & WhatsApp assistance inside',
    'See plans you can start paying for today',
    'Book a free consultation now',
    'Your growth plan is one tap away',
  ];

  // Web Audio Tone
  function playBeep(type) {
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);

      if (type === 'send') {
        osc.frequency.setValueAtTime(440, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.08);
      } else {
        osc.frequency.setValueAtTime(600, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(900, ctx.currentTime + 0.12);
      }

      gain.gain.setValueAtTime(0.03, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.12);

      osc.start();
      osc.stop(ctx.currentTime + 0.12);
    } catch {
      /* noop */
    }
  }

  // Safe Markdown & URL parser
  function renderMarkdown(str) {
    if (!str) return '';
    let escaped = str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');

    escaped = escaped.replace(/```([\s\S]*?)```/g, '<pre><code>$1</code></pre>');
    escaped = escaped.replace(/`([^`]+)`/g, '<code>$1</code>');
    escaped = escaped.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    escaped = escaped.replace(/\*([^*]+)\*/g, '<em>$1</em>');
    escaped = escaped.replace(
      /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g,
      '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>'
    );
    escaped = escaped.replace(
      /(^|[^\w"'])(https?:\/\/[^\s<]+)/g,
      '$1<a href="$2" target="_blank" rel="noopener noreferrer">$2</a>'
    );

    const lines = escaped.split('\n');
    let inList = false;
    let out = '';

    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
        if (!inList) {
          out += '<ul>';
          inList = true;
        }
        out += `<li>${trimmed.slice(2)}</li>`;
      } else {
        if (inList) {
          out += '</ul>';
          inList = false;
        }
        if (trimmed) {
          out += `<p>${line}</p>`;
        }
      }
    }
    if (inList) out += '</ul>';

    return out;
  }

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  // Build Theme Stylesheet
  const styleEl = document.createElement('style');
  function updateStyles() {
    const isLeft = botData.position === 'bottom-left';
    const brandColor = botData.primaryColor || '#BE123C';

    styleEl.textContent = `
      @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');

      * {
        box-sizing: border-box;
        margin: 0;
        padding: 0;
        font-family: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      }

      /* Rotating Conic Halo */
      .sitebot-launcher-wrap {
        position: fixed;
        bottom: 24px;
        ${isLeft ? 'left: 24px;' : 'right: 24px;'}
        z-index: 2147483647;
        display: flex;
        flex-direction: column;
        align-items: ${isLeft ? 'flex-start' : 'flex-end'};
        gap: 12px;
      }

      .sitebot-halo {
        position: absolute;
        inset: -4px;
        border-radius: 50%;
        opacity: 0.75;
        filter: blur(6px);
        background: conic-gradient(from 0deg, #BE123C, #F43F5E, #F59E0B, #0EA5E9, #BE123C);
        animation: sitebotSpin 8s linear infinite;
        pointer-events: none;
        transition: opacity 0.3s;
      }

      .sitebot-launcher-wrap:hover .sitebot-halo {
        opacity: 1;
      }

      .sitebot-radar-ring {
        position: absolute;
        inset: -6px;
        border-radius: 50%;
        border: 1.5px solid rgba(245, 158, 11, 0.4);
        animation: sitebotRadarPing 3.2s cubic-bezier(0, 0, 0.2, 1) infinite;
        pointer-events: none;
      }

      @keyframes sitebotRadarPing {
        0% { transform: scale(0.9); opacity: 0.7; }
        70%, 100% { transform: scale(1.4); opacity: 0; }
      }

      @keyframes sitebotSpin {
        from { transform: rotate(0deg); }
        to { transform: rotate(360deg); }
      }

      /* Floating Launcher Button */
      .sitebot-launcher {
        position: relative;
        width: 60px;
        height: 60px;
        border-radius: 50%;
        background: linear-gradient(135deg, ${brandColor} 0%, #E11D48 50%, #F59E0B 100%);
        color: #ffffff;
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        box-shadow: 0 12px 35px rgba(225, 29, 72, 0.45), 0 0 25px rgba(245, 158, 11, 0.3);
        border: 1px solid rgba(255, 255, 255, 0.35);
        outline: none;
        overflow: hidden;
        transition: transform 0.25s cubic-bezier(0.34, 1.56, 0.64, 1), box-shadow 0.25s ease;
      }

      .sitebot-launcher:hover {
        transform: scale(1.08);
      }

      .sitebot-launcher:active {
        transform: scale(0.94);
      }

      /* Shimmer sweep */
      .sitebot-launcher::after {
        content: '';
        position: absolute;
        inset: 0;
        background: linear-gradient(to right, transparent 0%, rgba(255, 255, 255, 0.3) 50%, transparent 100%);
        transform: translateX(-100%);
        transition: transform 0.8s ease;
      }

      .sitebot-launcher:hover::after {
        transform: translateX(100%);
      }

      .sitebot-bot-icon {
        width: 28px;
        height: 28px;
        fill: none;
        stroke: #ffffff;
        stroke-width: 2;
        stroke-linecap: round;
        stroke-linejoin: round;
        filter: drop-shadow(0 2px 6px rgba(0,0,0,0.35));
        animation: sitebotSoftPulse 2.5s ease-in-out infinite;
      }

      @keyframes sitebotSoftPulse {
        0%, 100% { transform: scale(1); }
        50% { transform: scale(1.06); }
      }

      .sitebot-online-badge {
        position: absolute;
        top: 6px;
        right: 6px;
        width: 12px;
        height: 12px;
        display: flex;
        align-items: center;
        justify-content: center;
      }

      .sitebot-online-ping {
        position: absolute;
        width: 100%;
        height: 100%;
        border-radius: 50%;
        background-color: #34d399;
        opacity: 0.75;
        animation: sitebotRadarPing 1.8s cubic-bezier(0, 0, 0.2, 1) infinite;
      }

      .sitebot-online-core {
        position: relative;
        width: 10px;
        height: 10px;
        border-radius: 50%;
        background-color: #10b981;
        border: 2px solid #ffffff;
      }

      /* Periodic Hint Bubble */
      .sitebot-hint-bubble {
        position: relative;
        background: rgba(15, 23, 42, 0.94);
        color: #f8fafc;
        border: 1px solid rgba(225, 29, 72, 0.3);
        border-radius: 16px;
        padding: 9px 14px;
        font-size: 11.5px;
        font-weight: 600;
        box-shadow: 0 10px 30px rgba(0, 0, 0, 0.35), 0 0 20px rgba(225, 29, 72, 0.2);
        cursor: pointer;
        backdrop-filter: blur(16px);
        -webkit-backdrop-filter: blur(16px);
        max-width: 290px;
        display: none;
        align-items: center;
        gap: 8px;
        animation: sitebotPopIn 0.35s cubic-bezier(0.34, 1.56, 0.64, 1);
        transition: transform 0.2s ease;
      }

      .sitebot-hint-bubble.visible {
        display: flex;
      }

      .sitebot-hint-bubble:hover {
        transform: scale(1.04);
      }

      .sitebot-hint-bubble::after {
        content: '';
        position: absolute;
        bottom: -6px;
        ${isLeft ? 'left: 20px;' : 'right: 20px;'}
        width: 12px;
        height: 12px;
        background: rgba(15, 23, 42, 0.94);
        border-right: 1px solid rgba(225, 29, 72, 0.3);
        border-bottom: 1px solid rgba(225, 29, 72, 0.3);
        transform: rotate(45deg);
      }

      .sitebot-hint-dot {
        width: 7px;
        height: 7px;
        border-radius: 50%;
        background: #F43F5E;
        box-shadow: 0 0 8px #F43F5E;
        flex-shrink: 0;
      }

      @keyframes sitebotPopIn {
        from { opacity: 0; transform: translateY(10px) scale(0.85); }
        to { opacity: 1; transform: translateY(0) scale(1); }
      }

      /* Hover Tooltip */
      .sitebot-tooltip {
        position: absolute;
        ${isLeft ? 'left: calc(100% + 14px);' : 'right: calc(100% + 14px);'}
        top: 50%;
        transform: translateY(-50%) translateX(6px);
        background: rgba(15, 23, 42, 0.95);
        color: #ffffff;
        font-size: 11.5px;
        font-weight: 700;
        padding: 7px 12px;
        border-radius: 12px;
        border: 1px solid rgba(255, 255, 255, 0.12);
        box-shadow: 0 10px 25px rgba(0, 0, 0, 0.3);
        white-space: nowrap;
        pointer-events: none;
        opacity: 0;
        transition: opacity 0.2s, transform 0.2s;
        display: flex;
        align-items: center;
        gap: 8px;
        backdrop-filter: blur(12px);
      }

      .sitebot-launcher-wrap:hover .sitebot-tooltip {
        opacity: 1;
        transform: translateY(-50%) translateX(0);
      }

      /* Main Chat Window */
      .sitebot-window {
        position: fixed;
        bottom: 96px;
        ${isLeft ? 'left: 24px;' : 'right: 24px;'}
        z-index: 2147483646;
        width: 400px;
        max-width: calc(100vw - 32px);
        height: 630px;
        max-height: calc(100vh - 120px);
        background: #ffffff;
        color: #0f172a;
        border-radius: 24px;
        box-shadow: 0 20px 50px -12px rgba(15, 23, 42, 0.18), 0 0 0 1px rgba(15, 23, 42, 0.08);
        display: flex;
        flex-direction: column;
        overflow: hidden;
        opacity: 0;
        pointer-events: none;
        transform: translateY(18px) scale(0.96);
        transition: opacity 0.28s cubic-bezier(0.16, 1, 0.3, 1), transform 0.28s cubic-bezier(0.16, 1, 0.3, 1);
      }

      .sitebot-window.open {
        opacity: 1;
        pointer-events: auto;
        transform: translateY(0) scale(1);
      }

      .sitebot-window.fullscreen {
        width: calc(100vw - 48px) !important;
        height: calc(100vh - 48px) !important;
        max-width: 900px !important;
        max-height: 850px !important;
        top: 50% !important;
        left: 50% !important;
        right: auto !important;
        bottom: auto !important;
        transform: translate(-50%, -50%) scale(1) !important;
      }

      /* Top Brand Bar */
      .sitebot-top-bar {
        height: 3px;
        width: 100%;
        background: linear-gradient(90deg, ${brandColor} 0%, #E11D48 50%, #F59E0B 100%);
        flex-shrink: 0;
      }

      /* Header */
      .sitebot-header {
        padding: 13px 18px;
        background: #ffffff;
        border-bottom: 1px solid rgba(226, 232, 240, 0.8);
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 10px;
        flex-shrink: 0;
        min-width: 0;
        transition: padding 0.2s ease;
      }

      .sitebot-header.sitebot-header-compact {
        padding: 10px 14px;
      }

      .sitebot-header-left {
        display: flex;
        align-items: center;
        gap: 11px;
        min-width: 0;
        flex: 1;
        overflow: hidden;
      }

      .sitebot-avatar-ring {
        position: relative;
        width: 38px;
        height: 38px;
        border-radius: 50%;
        background: linear-gradient(135deg, ${brandColor} 0%, #E11D48 50%, #F59E0B 100%);
        display: flex;
        align-items: center;
        justify-content: center;
        box-shadow: 0 4px 12px rgba(225, 29, 72, 0.25);
        border: 2px solid #ffffff;
        flex-shrink: 0;
        transition: width 0.2s ease, height 0.2s ease;
      }

      .sitebot-header.sitebot-header-compact .sitebot-avatar-ring {
        width: 32px;
        height: 32px;
      }

      .sitebot-avatar-ring svg {
        width: 19px;
        height: 19px;
        color: #ffffff;
      }

      .sitebot-header.sitebot-header-compact .sitebot-avatar-ring svg {
        width: 16px;
        height: 16px;
      }

      .sitebot-header-status-dot {
        position: absolute;
        bottom: 0;
        right: 0;
        width: 9.5px;
        height: 9.5px;
        background: #10b981;
        border-radius: 50%;
        border: 2px solid #ffffff;
        box-shadow: 0 0 6px rgba(16, 185, 129, 0.6);
      }

      .sitebot-header-info {
        display: flex;
        flex-direction: column;
        min-width: 0;
        flex: 1;
        overflow: hidden;
      }

      .sitebot-header-title {
        font-size: 14px;
        font-weight: 700;
        color: #0f172a;
        display: flex;
        align-items: center;
        gap: 6px;
        line-height: 1.25;
        min-width: 0;
        letter-spacing: -0.015em;
      }

      .sitebot-header.sitebot-header-compact .sitebot-header-title {
        font-size: 12.5px;
        gap: 5px;
      }

      .sitebot-header-name {
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        max-width: 165px;
        flex-shrink: 1;
      }

      .sitebot-header.sitebot-header-compact .sitebot-header-name {
        max-width: 140px;
      }

      .sitebot-verified-pill {
        display: inline-flex;
        align-items: center;
        gap: 4px;
        padding: 2px 7.5px;
        border-radius: 9999px;
        background: #ecfdf5;
        border: 1px solid #a7f3d0;
        color: #059669;
        font-size: 9px;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.04em;
        flex-shrink: 0;
        white-space: nowrap;
      }

      .sitebot-verified-pill span {
        width: 5px;
        height: 5px;
        border-radius: 50%;
        background: #10b981;
        box-shadow: 0 0 5px rgba(16, 185, 129, 0.7);
      }

      .sitebot-header-subtitle {
        font-size: 11px;
        color: #64748b;
        display: flex;
        align-items: center;
        gap: 4px;
        margin-top: 2px;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        font-weight: 500;
      }

      .sitebot-header.sitebot-header-compact .sitebot-header-subtitle {
        font-size: 10px;
        margin-top: 1px;
      }

      .sitebot-header-actions {
        display: flex;
        align-items: center;
        gap: 6px;
      }

      .sitebot-icon-btn {
        background: #f1f5f9;
        border: 1px solid #e2e8f0;
        color: #64748b;
        cursor: pointer;
        width: 30px;
        height: 30px;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: all 0.18s ease;
      }

      .sitebot-icon-btn:hover {
        background: #e2e8f0;
        color: #0f172a;
        transform: translateY(-1px);
        box-shadow: 0 2px 6px rgba(0, 0, 0, 0.06);
      }

      .sitebot-icon-btn:active {
        transform: scale(0.92);
      }

      .sitebot-icon-btn svg {
        width: 14.5px;
        height: 14.5px;
        stroke: currentColor;
        stroke-width: 2;
        fill: none;
      }

      /* Quick Action Fast Bar */
      .sitebot-fast-bar {
        padding: 8px 16px;
        background: #f8fafc;
        border-bottom: 1px solid #e2e8f0;
        display: flex;
        align-items: center;
        gap: 7px;
        overflow-x: auto;
        flex-shrink: 0;
        transition: padding 0.15s ease, gap 0.15s ease;
      }

      .sitebot-fast-bar.sitebot-fast-bar-dense {
        padding: 6px 12px;
        gap: 5px;
      }

      .sitebot-fast-bar::-webkit-scrollbar {
        display: none;
      }

      .sitebot-fast-btn {
        display: inline-flex;
        align-items: center;
        gap: 5px;
        font-size: 11px;
        font-weight: 600;
        padding: 5.5px 12px;
        border-radius: 9999px;
        text-decoration: none;
        cursor: pointer;
        border: 1px solid transparent;
        transition: transform 0.15s, box-shadow 0.15s, filter 0.15s;
        flex-shrink: 0;
        white-space: nowrap;
        letter-spacing: 0.01em;
      }

      .sitebot-fast-bar.sitebot-fast-bar-dense .sitebot-fast-btn {
        padding: 4px 8.5px;
        font-size: 9.5px;
        gap: 3.5px;
      }

      .sitebot-fast-btn:hover {
        transform: translateY(-1px);
        filter: brightness(1.06);
      }

      .sitebot-fast-btn:active {
        transform: scale(0.96);
      }

      .sitebot-fast-btn svg {
        width: 12.5px;
        height: 12.5px;
        flex-shrink: 0;
      }

      .sitebot-fast-bar.sitebot-fast-bar-dense .sitebot-fast-btn svg {
        width: 10.5px;
        height: 10.5px;
      }

      .sitebot-fast-btn-call {
        background: linear-gradient(135deg, #059669 0%, #047857 100%) !important;
        color: #ffffff !important;
        box-shadow: 0 2px 8px rgba(5, 150, 105, 0.28) !important;
        border: 1px solid rgba(255, 255, 255, 0.2) !important;
      }
      .sitebot-fast-btn-call:hover {
        box-shadow: 0 4px 14px rgba(5, 150, 105, 0.45) !important;
      }
      .sitebot-fast-btn-call svg { stroke: #ffffff !important; }

      .sitebot-fast-btn-wa {
        background: linear-gradient(135deg, #25D366 0%, #128C7E 100%) !important;
        color: #ffffff !important;
        box-shadow: 0 2px 8px rgba(37, 211, 102, 0.28) !important;
        border: 1px solid rgba(255, 255, 255, 0.2) !important;
      }
      .sitebot-fast-btn-wa:hover {
        box-shadow: 0 4px 14px rgba(37, 211, 102, 0.45) !important;
      }
      .sitebot-fast-btn-wa svg { fill: #ffffff !important; }

      .sitebot-fast-btn-audit {
        background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%) !important;
        color: #ffffff !important;
        box-shadow: 0 2px 8px rgba(245, 158, 11, 0.28) !important;
        border: 1px solid rgba(255, 255, 255, 0.2) !important;
      }
      .sitebot-fast-btn-audit:hover {
        box-shadow: 0 4px 14px rgba(245, 158, 11, 0.45) !important;
      }
      .sitebot-fast-btn-audit svg { stroke: #ffffff !important; }

      .sitebot-fast-btn-plans {
        background: linear-gradient(135deg, #f43f5e 0%, #e11d48 100%) !important;
        color: #ffffff !important;
        box-shadow: 0 2px 8px rgba(244, 63, 94, 0.28) !important;
        border: 1px solid rgba(255, 255, 255, 0.2) !important;
      }
      .sitebot-fast-btn-plans:hover {
        box-shadow: 0 4px 14px rgba(244, 63, 94, 0.45) !important;
      }
      .sitebot-fast-btn-plans svg { stroke: #ffffff !important; }

      .sitebot-fast-btn-email {
        background: linear-gradient(135deg, #0284c7 0%, #0369a1 100%) !important;
        color: #ffffff !important;
        box-shadow: 0 2px 8px rgba(2, 132, 199, 0.28) !important;
        border: 1px solid rgba(255, 255, 255, 0.2) !important;
      }
      .sitebot-fast-btn-email:hover {
        box-shadow: 0 4px 14px rgba(2, 132, 199, 0.45) !important;
      }
      .sitebot-fast-btn-email svg { stroke: #ffffff !important; }

      .sitebot-fast-btn-custom {
        background: linear-gradient(135deg, #6366f1 0%, #4f46e5 100%) !important;
        color: #ffffff !important;
        box-shadow: 0 2px 8px rgba(99, 102, 241, 0.28) !important;
        border: 1px solid rgba(255, 255, 255, 0.2) !important;
      }
      .sitebot-fast-btn-custom:hover {
        box-shadow: 0 4px 14px rgba(99, 102, 241, 0.45) !important;
      }
      .sitebot-fast-btn-custom svg { stroke: #ffffff !important; }
      .sitebot-fast-btn-custom svg { stroke: #ffffff !important; }

      /* Messages Container */
      .sitebot-messages {
        flex: 1;
        min-height: 0;
        position: relative;
        display: flex;
        flex-direction: column;
        overflow: hidden;
      }

      .sitebot-messages-scroll {
        flex: 1;
        min-height: 0;
        padding: 16px;
        overflow-y: auto;
        display: flex;
        flex-direction: column;
        gap: 14px;
        position: relative;
        scroll-behavior: smooth;
      }

      .sitebot-messages-scroll::-webkit-scrollbar {
        width: 5px;
      }
      .sitebot-messages-scroll::-webkit-scrollbar-thumb {
        background: rgba(255, 255, 255, 0.15);
        border-radius: 3px;
      }

      .sitebot-msg-row {
        display: flex;
        align-items: flex-end;
        gap: 8px;
        max-width: 100%;
        animation: sitebotFadeIn 0.25s ease-out;
      }

      @keyframes sitebotFadeIn {
        from { opacity: 0; transform: translateY(8px) scale(0.97); }
        to { opacity: 1; transform: translateY(0) scale(1); }
      }

      .sitebot-msg-row.user {
        justify-content: flex-end;
      }

      .sitebot-msg-row.bot {
        justify-content: flex-start;
      }

      /* Avatars with labels */
      .sitebot-msg-avatar-col {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 2px;
        width: 34px;
        flex-shrink: 0;
      }

      .sitebot-msg-avatar-circle {
        width: 28px;
        height: 28px;
        border-radius: 50%;
        background: linear-gradient(135deg, ${brandColor} 0%, #E11D48 50%, #F59E0B 100%);
        display: flex;
        align-items: center;
        justify-content: center;
        box-shadow: 0 0 10px rgba(225, 29, 72, 0.35);
        border: 1px solid rgba(255, 255, 255, 0.2);
        color: #fff;
        font-size: 11px;
        font-weight: 700;
      }

      .sitebot-msg-avatar-circle svg {
        width: 15px;
        height: 15px;
      }

      .sitebot-msg-avatar-circle.sitebot-user-avatar {
        width: 28px !important;
        height: 28px !important;
        border-radius: 50% !important;
        background: linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%) !important;
        border: 1.5px solid rgba(255, 255, 255, 0.4) !important;
        box-shadow: 0 2px 8px rgba(79, 70, 229, 0.35) !important;
        color: #ffffff !important;
        display: flex !important;
        align-items: center !important;
        justify-content: center !important;
      }

      .sitebot-msg-avatar-circle.sitebot-user-avatar svg {
        width: 14px !important;
        height: 14px !important;
        stroke: #ffffff !important;
        fill: none !important;
        display: block !important;
      }

      .sitebot-msg-avatar-label {
        display: none !important;
      }

      .sitebot-bubble {
        position: relative;
        max-width: calc(100% - 46px);
        padding: 12px 16px;
        font-size: 13.5px;
        line-height: 1.55;
        word-break: break-word;
      }

      .sitebot-msg-row.bot .sitebot-bubble {
        background: #f8fafc;
        color: #1e293b;
        border-radius: 18px 18px 18px 4px;
        border: 1px solid #e2e8f0;
        box-shadow: 0 1px 4px rgba(0, 0, 0, 0.04);
      }

      .sitebot-msg-row.user .sitebot-bubble {
        background: linear-gradient(135deg, ${brandColor} 0%, #E11D48 70%, #F59E0B 100%);
        color: #ffffff;
        border-radius: 18px 18px 4px 18px;
        box-shadow: 0 4px 14px rgba(220, 38, 38, 0.25);
        border: none;
      }

      /* Glossy shine line on user bubble */
      .sitebot-msg-row.user .sitebot-bubble::before {
        content: '';
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        height: 1px;
        background: linear-gradient(to right, transparent, rgba(255, 255, 255, 0.4), transparent);
        border-radius: 9999px;
      }

      .sitebot-bubble p {
        margin-bottom: 7px;
      }
      .sitebot-bubble p:last-child {
        margin-bottom: 0;
      }
      .sitebot-bubble ul {
        margin-left: 16px;
        margin-bottom: 7px;
      }
      .sitebot-bubble li {
        margin-bottom: 3px;
      }
      .sitebot-bubble strong {
        font-weight: 700;
        color: #ffffff;
      }
      .sitebot-bubble a {
        color: #fb7185;
        font-weight: 700;
        text-decoration: underline;
        text-underline-offset: 2px;
      }
      .sitebot-bubble code {
        background: rgba(255, 255, 255, 0.1);
        padding: 2px 5px;
        border-radius: 4px;
        font-family: monospace;
        font-size: 12px;
      }
      .sitebot-bubble pre {
        background: #0f172a;
        color: #f8fafc;
        padding: 8px 10px;
        border-radius: 8px;
        overflow-x: auto;
        margin: 6px 0;
      }

      @keyframes sitebotBlink {
        0%, 100% { opacity: 1; }
        50% { opacity: 0; }
      }

      /* Source link chips */
      .sitebot-sources {
        margin-top: 8px;
        padding-top: 8px;
        border-top: 1px solid rgba(255, 255, 255, 0.1);
        display: flex;
        flex-wrap: wrap;
        gap: 5px;
      }

      .sitebot-source-chip {
        display: inline-flex;
        align-items: center;
        gap: 4px;
        font-size: 10px;
        padding: 3px 8px;
        border-radius: 6px;
        background: rgba(255, 255, 255, 0.1);
        color: #fda4af;
        text-decoration: none;
        transition: background 0.15s;
      }

      .sitebot-source-chip:hover {
        background: rgba(255, 255, 255, 0.2);
      }

      /* Animated Shimmer Loading Card */
      .sitebot-loading-card-wrap {
        position: relative;
        max-width: calc(100% - 50px);
        border-radius: 18px;
        border-bottom-left-radius: 3px;
        overflow: hidden;
      }

      .sitebot-loading-shimmer-border {
        position: absolute;
        inset: 0;
        border-radius: 18px;
        border-bottom-left-radius: 3px;
        background: linear-gradient(90deg, transparent 0%, rgba(96,165,250,0.35) 40%, rgba(167,139,250,0.35) 60%, transparent 100%);
        background-size: 200% 100%;
        animation: sitebotShimmer 1.8s linear infinite;
        pointer-events: none;
      }

      @keyframes sitebotShimmer {
        0% { background-position: 200% 0; }
        100% { background-position: -200% 0; }
      }

      .sitebot-loading-card {
        padding: 12px 16px;
        background: rgba(30, 41, 59, 0.75);
        backdrop-filter: blur(12px);
        border: 1px solid rgba(255, 255, 255, 0.08);
      }

      .sitebot-loading-dots-row {
        display: flex;
        align-items: center;
        gap: 10px;
        margin-bottom: 8px;
      }

      .sitebot-loading-dots {
        display: flex;
        align-items: center;
        gap: 5px;
      }

      .sitebot-dot {
        width: 7px;
        height: 7px;
        border-radius: 50%;
        animation: sitebotBounce 1.2s ease-in-out infinite both;
      }
      .sitebot-dot:nth-child(1) { background: #60a5fa; box-shadow: 0 0 6px rgba(96,165,250,0.7); animation-delay: 0s; }
      .sitebot-dot:nth-child(2) { background: #a78bfa; box-shadow: 0 0 6px rgba(167,139,250,0.7); animation-delay: 0.18s; }
      .sitebot-dot:nth-child(3) { background: #f472b6; box-shadow: 0 0 6px rgba(244,114,182,0.7); animation-delay: 0.36s; }

      @keyframes sitebotBounce {
        0%, 100% { transform: translateY(0); opacity: 0.6; }
        50% { transform: translateY(-5px); opacity: 1; }
      }

      .sitebot-loading-subtext {
        font-size: 10px;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.1em;
        color: #94a3b8;
      }

      .sitebot-loading-message {
        display: flex;
        align-items: center;
        gap: 6px;
        font-size: 12.5px;
        color: #f1f5f9;
        min-height: 18px;
      }

      /* Floating Scroll-to-Bottom Button */
      .sitebot-scroll-down-btn {
        position: absolute;
        bottom: 12px;
        left: 50%;
        transform: translateX(-50%);
        width: 36px;
        height: 36px;
        border-radius: 50%;
        background: linear-gradient(135deg, ${brandColor} 0%, #E11D48 50%, #F59E0B 100%);
        color: #ffffff;
        display: none;
        align-items: center;
        justify-content: center;
        border: 1px solid rgba(255, 255, 255, 0.25);
        box-shadow: 0 6px 20px rgba(225, 29, 72, 0.5);
        cursor: pointer;
        z-index: 20;
        transition: transform 0.15s, filter 0.15s;
      }

      .sitebot-scroll-down-btn.visible {
        display: flex;
      }

      .sitebot-scroll-down-btn:hover {
        filter: brightness(1.15);
        transform: translateX(-50%) scale(1.06);
      }

      .sitebot-scroll-down-btn svg {
        width: 18px;
        height: 18px;
      }

      /* Suggestion Chips */
      .sitebot-chips-wrap {
        padding: 4px 16px 10px;
        display: flex;
        flex-wrap: wrap;
        gap: 6px;
        flex-shrink: 0;
      }

      .sitebot-chip {
        background: rgba(30, 41, 59, 0.85);
        color: #f1f5f9 !important;
        border: 1px solid rgba(255, 255, 255, 0.16);
        padding: 6px 13px;
        border-radius: 9999px;
        font-size: 11.5px;
        font-weight: 600;
        cursor: pointer;
        transition: all 0.18s ease;
      }

      .sitebot-chip:hover {
        background: #4f46e5 !important;
        border-color: #6366f1 !important;
        color: #ffffff !important;
        box-shadow: 0 4px 14px rgba(79, 70, 229, 0.45) !important;
        transform: translateY(-1px);
      }

      /* Input Area */
      .sitebot-input-area {
        padding: 12px 16px 14px;
        background: #ffffff;
        border-top: 1px solid #f1f5f9;
        flex-shrink: 0;
      }

      .sitebot-input-field-wrap {
        position: relative;
        display: flex;
        align-items: center;
        background: #f8fafc;
        border: 1px solid #e2e8f0;
        border-radius: 9999px;
        padding: 4px 5px 4px 16px;
        transition: all 0.2s ease;
        box-shadow: 0 1px 3px rgba(0, 0, 0, 0.02);
      }

      .sitebot-input-field-wrap:focus-within {
        border-color: #6366f1;
        background: #ffffff;
        box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.12), 0 2px 8px rgba(0, 0, 0, 0.04);
      }

      .sitebot-input-field {
        flex: 1;
        background: transparent;
        border: none;
        outline: none;
        color: #0f172a;
        font-size: 13.5px;
        min-width: 0;
        font-family: inherit;
      }

      .sitebot-input-field::placeholder {
        color: #94a3b8;
      }

      .sitebot-send-btn {
        width: 34px;
        height: 34px;
        border-radius: 50%;
        background: linear-gradient(135deg, ${brandColor} 0%, #E11D48 100%);
        color: #ffffff;
        border: none;
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        box-shadow: 0 2px 8px rgba(225, 29, 72, 0.3);
        transition: transform 0.15s, opacity 0.15s, filter 0.15s;
        flex-shrink: 0;
      }

      .sitebot-send-btn:hover:not(:disabled) {
        filter: brightness(1.08);
        transform: scale(1.05);
      }

      .sitebot-send-btn:disabled {
        opacity: 0.35;
        cursor: not-allowed;
      }

      .sitebot-send-btn svg {
        width: 15px;
        height: 15px;
        fill: none;
        stroke: currentColor;
        stroke-width: 2;
      }

      .sitebot-footer-brand {
        margin-top: 8px;
        text-align: center;
        font-size: 10px;
        color: #94a3b8;
        font-weight: 500;
      }

      .sitebot-footer-brand a {
        color: ${brandColor};
        text-decoration: none;
        font-weight: 600;
        transition: opacity 0.15s;
      }

      .sitebot-footer-brand a:hover {
        opacity: 0.8;
        text-decoration: underline;
      }

      /* Mobile Full-Screen Sheet */
      @media (max-width: 639px) {
        .sitebot-window {
          position: fixed !important;
          inset: 0 !important;
          width: 100vw !important;
          height: 100dvh !important;
          max-width: 100vw !important;
          max-height: 100dvh !important;
          border-radius: 0 !important;
          bottom: 0 !important;
          left: 0 !important;
          right: 0 !important;
          top: 0 !important;
        }

        .sitebot-launcher-wrap {
          bottom: 16px;
          ${isLeft ? 'left: 16px;' : 'right: 16px;'}
        }
      }

      /* ===== LAUNCHER STYLE VARIANTS ===== */

      /* Pill text label (hidden by default, shown in pill style) */
      .sitebot-launcher-text {
        font-size: 12.5px;
        font-weight: 700;
        color: #ffffff;
        white-space: nowrap;
        letter-spacing: 0.01em;
        display: none;
        margin-left: 2px;
      }

      /* --- MINIMAL: no halo, clean solid gradient button --- */
      .sitebot-style-minimal .sitebot-halo,
      .sitebot-style-minimal .sitebot-radar-ring {
        display: none !important;
      }
      .sitebot-style-minimal .sitebot-launcher {
        box-shadow: 0 6px 20px ${brandColor}55;
      }
      .sitebot-style-minimal .sitebot-bot-icon {
        animation: none;
      }
      .sitebot-style-minimal .sitebot-online-badge {
        top: 4px;
        right: 4px;
      }

      /* --- PILL: elongated pill with icon + text label --- */
      .sitebot-style-pill .sitebot-halo,
      .sitebot-style-pill .sitebot-radar-ring {
        display: none !important;
      }
      .sitebot-style-pill .sitebot-launcher {
        width: auto !important;
        min-width: 136px;
        border-radius: 30px !important;
        padding: 0 18px;
        gap: 8px;
        overflow: visible;
      }
      .sitebot-style-pill .sitebot-launcher-text {
        display: block;
      }
      .sitebot-style-pill .sitebot-online-badge {
        display: none;
      }
      .sitebot-style-pill #launcherIconOpen {
        width: auto !important;
        gap: 8px;
      }
      .sitebot-style-pill .sitebot-hint-bubble::after {
        ${isLeft ? 'left: 24px;' : 'right: 50px;'}
      }

      /* --- CHAT: white button with brand color border --- */
      .sitebot-style-chat .sitebot-halo {
        opacity: 0.3;
        filter: blur(8px);
      }
      .sitebot-style-chat .sitebot-launcher {
        background: #ffffff !important;
        border: 2.5px solid ${brandColor} !important;
        box-shadow: 0 8px 28px ${brandColor}44, 0 0 0 8px ${brandColor}11 !important;
      }
      .sitebot-style-chat .sitebot-bot-icon {
        stroke: ${brandColor};
        filter: none;
      }
      .sitebot-style-chat .sitebot-online-core {
        background-color: ${brandColor};
        border-color: #fff;
      }
      .sitebot-style-chat .sitebot-launcher:hover {
        background: ${brandColor}11 !important;
      }

      /* ===================== LIGHT THEME (default) ===================== */
      /* ===================== LIGHT THEME (default) ===================== */
      .sitebot-container[data-theme="light"] {
        color: #0f172a;
      }
      .sitebot-container[data-theme="light"] .sitebot-window {
        background: #ffffff;
        color: #0f172a;
        box-shadow: 0 20px 50px -10px rgba(15, 23, 42, 0.16), 0 0 0 1px rgba(15, 23, 42, 0.08);
      }
      .sitebot-container[data-theme="light"] .sitebot-header {
        background: #ffffff;
        border-bottom: 1px solid #f1f5f9;
      }
      .sitebot-container[data-theme="light"] .sitebot-header-title {
        color: #0f172a;
      }
      .sitebot-container[data-theme="light"] .sitebot-header-subtitle {
        color: #64748b;
      }
      .sitebot-container[data-theme="light"] .sitebot-header-status-dot {
        border-color: #ffffff;
      }
      .sitebot-container[data-theme="light"] .sitebot-verified-pill {
        background: #ecfdf5;
        border: 1px solid #a7f3d0;
        color: #059669;
      }
      .sitebot-container[data-theme="light"] .sitebot-icon-btn {
        background: #f8fafc;
        border: 1px solid #e2e8f0;
        color: #64748b;
      }
      .sitebot-container[data-theme="light"] .sitebot-icon-btn:hover {
        background: #f1f5f9;
        color: #0f172a;
        transform: translateY(-1px);
        box-shadow: 0 2px 5px rgba(0, 0, 0, 0.05);
      }
      .sitebot-container[data-theme="light"] .sitebot-fast-bar {
        background: #f8fafc;
        border-bottom: 1px solid #e2e8f0;
      }
      .sitebot-container[data-theme="light"] .sitebot-messages-scroll {
        background: #ffffff;
      }
      .sitebot-container[data-theme="light"] .sitebot-messages-scroll::-webkit-scrollbar-thumb {
        background: rgba(15, 23, 42, 0.15);
      }
      .sitebot-container[data-theme="light"] .sitebot-msg-row.bot .sitebot-bubble {
        background: #f8fafc;
        color: #1e293b;
        border: 1px solid #e2e8f0;
        box-shadow: 0 1px 3px rgba(0, 0, 0, 0.03);
      }
      .sitebot-container[data-theme="light"] .sitebot-bubble strong {
        color: #0f172a;
      }
      .sitebot-container[data-theme="light"] .sitebot-bubble code {
        background: #e2e8f0;
        color: #0f172a;
      }
      .sitebot-container[data-theme="light"] .sitebot-msg-avatar-circle.sitebot-user-avatar {
        background: linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%);
        border: 1px solid #cbd5e1;
        box-shadow: 0 2px 6px rgba(15, 23, 42, 0.06);
        color: #334155;
      }
      .sitebot-container[data-theme="light"] .sitebot-msg-avatar-circle.sitebot-user-avatar svg {
        stroke: #334155;
      }
      .sitebot-container[data-theme="light"] .sitebot-msg-avatar-label {
        display: none !important;
      }
      .sitebot-container[data-theme="light"] .sitebot-loading-card {
        background: #f8fafc;
        border: 1px solid #e2e8f0;
      }
      .sitebot-container[data-theme="light"] .sitebot-loading-subtext {
        color: #64748b;
      }
      .sitebot-container[data-theme="light"] .sitebot-loading-message {
        color: #1e293b;
      }
      .sitebot-container[data-theme="light"] .sitebot-chips-wrap {
        background: #ffffff;
      }
      .sitebot-container[data-theme="light"] .sitebot-chip {
        background: #ffffff;
        color: #334155 !important;
        border: 1px solid #e2e8f0;
        box-shadow: 0 1px 3px rgba(0, 0, 0, 0.03);
      }
      .sitebot-container[data-theme="light"] .sitebot-chip:hover {
        background: #f8fafc !important;
        border-color: #6366f1 !important;
        color: #4f46e5 !important;
        box-shadow: 0 3px 10px rgba(99, 102, 241, 0.15) !important;
        transform: translateY(-1px);
      }
      .sitebot-container[data-theme="light"] .sitebot-input-area {
        background: #ffffff;
        border-top: 1px solid #f1f5f9;
      }
      .sitebot-container[data-theme="light"] .sitebot-input-field-wrap {
        background: #f8fafc;
        border: 1px solid #e2e8f0;
        box-shadow: 0 1px 3px rgba(0, 0, 0, 0.02);
      }
      .sitebot-container[data-theme="light"] .sitebot-input-field-wrap:focus-within {
        border-color: #6366f1;
        background: #ffffff;
        box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.12), 0 2px 8px rgba(0, 0, 0, 0.04);
      }
      .sitebot-container[data-theme="light"] .sitebot-input-field {
        color: #0f172a;
      }
      .sitebot-container[data-theme="light"] .sitebot-input-field::placeholder {
        color: #94a3b8;
      }
      .sitebot-container[data-theme="light"] .sitebot-footer-brand {
        color: #94a3b8;
      }
      .sitebot-container[data-theme="light"] .sitebot-footer-brand a {
        color: ${brandColor};
      }
      .sitebot-container[data-theme="light"] .sitebot-sources {
        border-top: 1px solid #e2e8f0;
      }
      .sitebot-container[data-theme="light"] .sitebot-source-chip {
        background: rgba(225, 29, 72, 0.08);
        color: #be123c;
      }
      .sitebot-container[data-theme="light"] .sitebot-source-chip:hover {
        background: rgba(225, 29, 72, 0.16);
      }
      .sitebot-container[data-theme="light"] .sitebot-hint-bubble {
        background: #ffffff;
        color: #0f172a;
        border: 1px solid rgba(225, 29, 72, 0.25);
        box-shadow: 0 10px 30px rgba(15, 23, 42, 0.12), 0 0 15px rgba(225, 29, 72, 0.08);
      }
      .sitebot-container[data-theme="light"] .sitebot-hint-bubble::after {
        background: #ffffff;
      }
      .sitebot-container[data-theme="light"] .sitebot-tooltip {
        background: #ffffff;
        color: #0f172a;
        border: 1px solid rgba(15, 23, 42, 0.08);
        box-shadow: 0 8px 24px rgba(15, 23, 42, 0.12);
      }

      /* ===================== DARK THEME ===================== */
      .sitebot-container[data-theme="dark"] {
        color: #f8fafc;
      }
      .sitebot-container[data-theme="dark"] .sitebot-window {
        background: #0f172a;
        color: #f8fafc;
        box-shadow: 0 25px 65px -12px rgba(0, 0, 0, 0.85), 0 0 0 1px rgba(255, 255, 255, 0.08);
      }
      .sitebot-container[data-theme="dark"] .sitebot-header {
        background: #1e293b;
        border-bottom: 1px solid rgba(255, 255, 255, 0.08);
      }
      .sitebot-container[data-theme="dark"] .sitebot-header-title {
        color: #ffffff;
      }
      .sitebot-container[data-theme="dark"] .sitebot-header-subtitle {
        color: #94a3b8;
      }
      .sitebot-container[data-theme="dark"] .sitebot-header-status-dot {
        border-color: #1e293b;
      }
      .sitebot-container[data-theme="dark"] .sitebot-verified-pill {
        background: rgba(16, 185, 129, 0.15);
        border: 1px solid rgba(16, 185, 129, 0.35);
        color: #34d399;
      }
      .sitebot-container[data-theme="dark"] .sitebot-icon-btn {
        background: rgba(255, 255, 255, 0.06);
        border: 1px solid rgba(255, 255, 255, 0.08);
        color: rgba(255, 255, 255, 0.75);
      }
      .sitebot-container[data-theme="dark"] .sitebot-icon-btn:hover {
        background: rgba(255, 255, 255, 0.14);
        color: #ffffff;
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
      }
      .sitebot-container[data-theme="dark"] .sitebot-fast-bar {
        background: #090d16;
        border-bottom: 1px solid rgba(255, 255, 255, 0.07);
      }
      .sitebot-container[data-theme="dark"] .sitebot-messages-scroll {
        background: #0b1120;
      }
      .sitebot-container[data-theme="dark"] .sitebot-messages-scroll::-webkit-scrollbar-thumb {
        background: rgba(255, 255, 255, 0.15);
      }
      .sitebot-container[data-theme="dark"] .sitebot-msg-row.bot .sitebot-bubble {
        background: #1e293b;
        color: #f1f5f9;
        border: 1px solid rgba(255, 255, 255, 0.08);
        box-shadow: 0 4px 18px rgba(0, 0, 0, 0.35);
      }
      .sitebot-container[data-theme="dark"] .sitebot-bubble strong {
        color: #ffffff;
      }
      .sitebot-container[data-theme="dark"] .sitebot-bubble code {
        background: rgba(255, 255, 255, 0.1);
        color: #fb7185;
      }
      .sitebot-container[data-theme="dark"] .sitebot-bubble a {
        color: #fb7185;
      }
      .sitebot-container[data-theme="dark"] .sitebot-msg-avatar-circle.sitebot-user-avatar {
        background: linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%);
        border: 1px solid rgba(255, 255, 255, 0.3);
        box-shadow: 0 2px 8px rgba(79, 70, 229, 0.35);
        color: #ffffff;
      }
      .sitebot-container[data-theme="dark"] .sitebot-msg-avatar-circle.sitebot-user-avatar svg {
        stroke: #ffffff;
      }
      .sitebot-container[data-theme="dark"] .sitebot-msg-avatar-label {
        display: none !important;
      }
      .sitebot-container[data-theme="dark"] .sitebot-loading-card {
        background: #1e293b;
        border: 1px solid rgba(255, 255, 255, 0.08);
      }
      .sitebot-container[data-theme="dark"] .sitebot-loading-subtext {
        color: #94a3b8;
      }
      .sitebot-container[data-theme="dark"] .sitebot-loading-message {
        color: #f1f5f9;
      }
      .sitebot-container[data-theme="dark"] .sitebot-chips-wrap {
        background: #0b1120;
      }
      .sitebot-container[data-theme="dark"] .sitebot-chip {
        background: #1e293b;
        color: #f1f5f9 !important;
        border: 1px solid rgba(255, 255, 255, 0.12);
        box-shadow: 0 2px 6px rgba(0, 0, 0, 0.25);
      }
      .sitebot-container[data-theme="dark"] .sitebot-chip:hover {
        background: #4f46e5 !important;
        border-color: #6366f1 !important;
        color: #ffffff !important;
        box-shadow: 0 4px 14px rgba(79, 70, 229, 0.45) !important;
      }
      .sitebot-container[data-theme="dark"] .sitebot-input-area {
        background: #0f172a;
        border-top: 1px solid rgba(255, 255, 255, 0.08);
      }
      .sitebot-container[data-theme="dark"] .sitebot-input-field-wrap {
        background: #1e293b;
        border: 1px solid rgba(255, 255, 255, 0.12);
        box-shadow: inset 0 1px 3px rgba(0, 0, 0, 0.25);
      }
      .sitebot-container[data-theme="dark"] .sitebot-input-field-wrap:focus-within {
        border-color: ${brandColor};
        background: #1e293b;
        box-shadow: 0 0 0 3px ${brandColor}33, 0 4px 16px rgba(0, 0, 0, 0.35);
      }
      .sitebot-container[data-theme="dark"] .sitebot-input-field {
        color: #ffffff;
      }
      .sitebot-container[data-theme="dark"] .sitebot-input-field::placeholder {
        color: #64748b;
      }
      .sitebot-container[data-theme="dark"] .sitebot-footer-brand {
        color: #64748b;
      }
      .sitebot-container[data-theme="dark"] .sitebot-footer-brand a {
        color: #fb7185;
      }
      .sitebot-container[data-theme="dark"] .sitebot-sources {
        border-top: 1px solid rgba(255, 255, 255, 0.08);
      }
      .sitebot-container[data-theme="dark"] .sitebot-source-chip {
        background: rgba(225, 29, 72, 0.15);
        color: #fb7185;
      }
      .sitebot-container[data-theme="dark"] .sitebot-source-chip:hover {
        background: rgba(225, 29, 72, 0.25);
      }
      .sitebot-container[data-theme="dark"] .sitebot-hint-bubble {
        background: #1e293b;
        color: #ffffff;
        border: 1px solid rgba(255, 255, 255, 0.12);
        box-shadow: 0 10px 30px rgba(0, 0, 0, 0.5);
      }
      .sitebot-container[data-theme="dark"] .sitebot-hint-bubble::after {
        background: #1e293b;
      }
      .sitebot-container[data-theme="dark"] .sitebot-tooltip {
        background: #1e293b;
        color: #ffffff;
        border: 1px solid rgba(255, 255, 255, 0.12);
        box-shadow: 0 8px 24px rgba(0, 0, 0, 0.5);
      }
    `;
  }

  shadow.appendChild(styleEl);
  updateStyles(); // Inject default CSS immediately so widget looks correct before API loads

  function getDynamicRoleSubtitle(data) {
    if (data && data.roleTitle && typeof data.roleTitle === 'string' && data.roleTitle.trim()) {
      return data.roleTitle.trim();
    }
    const combined = [
      (data && data.name) || '',
      (data && data.greeting) || '',
      (typeof window !== 'undefined' ? window.location.hostname : ''),
      (typeof window !== 'undefined' ? window.location.pathname : ''),
    ].join(' ').toLowerCase();

    if (/\b(dental|dentist|teeth|clinic|patient|doctor|medical|hospital|therapy|healthcare|wellness|physician|dermatolog|pharmacy)\b/i.test(combined)) {
      return 'Patient Care Assistant • Inquiries & Appointments';
    }
    if (/\b(shop|store|cart|checkout|ecommerce|e-commerce|clothing|apparel|fashion|shoes|jewelry|perfume|delivery|shipping|products)\b/i.test(combined)) {
      return 'Store Concierge • Orders & Instant Support';
    }
    if (/\b(real estate|realtor|realty|property|properties|apartments|condo|housing|rentals|mortgage|listings|broker)\b/i.test(combined)) {
      return 'Real Estate Specialist • Property Guide';
    }
    if (/\b(attorney|lawyer|law firm|legal|litigation|counsel|personal injury|notary|justice)\b/i.test(combined)) {
      return 'Legal Inquiries Assistant • Consultation Guide';
    }
    if (/\b(insurance|wealth|accounting|tax|cpa|audit|investment|banking|financial|loans)\b/i.test(combined)) {
      return 'Financial & Advisory Specialist • Client Solutions';
    }
    if (/\b(restaurant|menu|food|cafe|dining|bakery|dishes|cuisine|order food|reservations|table booking|catering)\b/i.test(combined)) {
      return 'Dining & Reservations Host • Menu Guide';
    }
    if (/\b(academy|school|university|college|course|curriculum|training|learning|student|admissions|campus)\b/i.test(combined)) {
      return 'Admissions & Course Advisor • Student Support';
    }
    if (/\b(hotel|resort|travel|vacation|booking|stay|tour|tourism|flight|trip|adventure|destination)\b/i.test(combined)) {
      return 'Travel & Guest Concierge • Booking Support';
    }
    if (/\b(saas|software|api|cloud|devops|database|platform|automation|cybersecurity|developer|analytics)\b/i.test(combined)) {
      return 'Technical Product Specialist • Solutions Assistant';
    }
    if (/\b(agency|marketing|seo|branding|social media|advertising|web design|growth|copywriting)\b/i.test(combined)) {
      return 'Digital Strategy Consultant • Client Growth';
    }
    if (/\b(construction|architect|interior design|renovation|plumbing|roofing|electrician|contractor|builder)\b/i.test(combined)) {
      return 'Project & Estimation Guide • Services Assistant';
    }
    if (/\b(automotive|cars|vehicles|dealership|auto repair|mechanic|test drive)\b/i.test(combined)) {
      return 'Automotive Specialist • Vehicle & Service Guide';
    }
    if (/\b(fitness|gym|workout|trainer|crossfit|yoga|pilates|personal training)\b/i.test(combined)) {
      return 'Fitness & Wellness Advisor • Member Support';
    }
    if (/\b(salon|spa|haircut|massage|skincare|facials|makeup|cosmetics|barbershop)\b/i.test(combined)) {
      return 'Beauty & Wellness Concierge • Appointments';
    }

    const cleanName = ((data && data.name) || '').replace(/Assistant|Bot|AI|Website/gi, '').trim();
    if (cleanName && cleanName.length > 2) {
      return `${cleanName} Specialist • Verified Assistant`;
    }
    return 'Official AI Assistant • Verified Support';
  }

  // Build Container HTML
  const container = document.createElement('div');
  container.className = 'sitebot-container';
  container.innerHTML = `
    <!-- Launcher Wrap -->
    <div class="sitebot-launcher-wrap" id="launcherWrap">
      <!-- Periodic Hint Bubble -->
      <div class="sitebot-hint-bubble" id="hintBubble">
        <span class="sitebot-hint-dot"></span>
        <span id="hintText">Hi! I'm ${botData.name || 'Assistant'} — Call, WhatsApp &amp; AI Chat</span>
      </div>

      <div style="position: relative;">
        <!-- Rotating Conic Halo -->
        <div class="sitebot-halo" id="haloRing"></div>
        <div class="sitebot-radar-ring" id="radarRing"></div>

        <!-- Launcher Button -->
        <button class="sitebot-launcher" id="launcherBtn" aria-label="Open AI chat">
          <div id="launcherIconOpen" style="position: relative; display: flex; align-items: center; justify-content: center; width: 100%; height: 100%;">
            <svg class="sitebot-bot-icon" viewBox="0 0 24 24">
              <path d="M12 8V4m0 0H8m4 0h4m-7 4h6a4 4 0 0 1 4 4v5a4 4 0 0 1-4 4H9a4 4 0 0 1-4-4v-5a4 4 0 0 1 4-4Z"></path>
              <circle cx="9" cy="13" r="1.2" fill="currentColor"></circle>
              <circle cx="15" cy="13" r="1.2" fill="currentColor"></circle>
              <path d="M10 16h4"></path>
            </svg>
            <span class="sitebot-launcher-text" id="launcherText">Chat with us</span>
            <span class="sitebot-online-badge">
              <span class="sitebot-online-ping"></span>
              <span class="sitebot-online-core"></span>
            </span>
          </div>

          <div id="launcherIconClose" style="display: none; align-items: center; justify-content: center;">
            <svg style="width: 24px; height: 24px;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </div>
        </button>

        <!-- Hover Tooltip -->
        <div class="sitebot-tooltip" id="hoverTooltip">
          <span style="width: 7px; height: 7px; border-radius: 50%; background: #10b981;"></span>
          <span id="tooltipText">Chat with ${botData.name || 'Assistant'}</span>
        </div>
      </div>
    </div>

    <!-- Chat Window -->
    <div class="sitebot-window" id="chatWindow">
      <!-- 3px Brand Bar -->
      <div class="sitebot-top-bar"></div>

      <!-- Header -->
      <div class="sitebot-header" id="chatHeader">
        <div class="sitebot-header-left">
          <div class="sitebot-avatar-ring">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M12 8V4m0 0H8m4 0h4m-7 4h6a4 4 0 0 1 4 4v5a4 4 0 0 1-4 4H9a4 4 0 0 1-4-4v-5a4 4 0 0 1 4-4Z"></path>
              <circle cx="9" cy="13" r="1.2" fill="currentColor"></circle>
              <circle cx="15" cy="13" r="1.2" fill="currentColor"></circle>
            </svg>
            <span class="sitebot-header-status-dot"></span>
          </div>
          <div class="sitebot-header-info">
            <div class="sitebot-header-title">
              <span id="botHeaderName" class="sitebot-header-name" title="${botData.name}">${botData.name}</span>
              <span class="sitebot-verified-pill">
                <span></span>
                Online
              </span>
            </div>
            <div class="sitebot-header-subtitle">
              <svg style="width: 12px; height: 12px; color: #fb7185; flex-shrink: 0;" viewBox="0 0 24 24" fill="currentColor">
                <path d="m12 3-1.9 5.8a2 2 0 0 1-1.3 1.3L3 12l5.8 1.9a2 2 0 0 1 1.3 1.3L12 21l1.9-5.8a2 2 0 0 1 1.3-1.3L12 3z"></path>
              </svg>
              <span id="botHeaderSubtitle">${escapeHtml(getDynamicRoleSubtitle(botData))}</span>
            </div>
          </div>
        </div>

        <div class="sitebot-header-actions">
          <button class="sitebot-icon-btn" id="themeBtn" title="Toggle light / dark mode">
            <svg id="themeIconSun" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="5"></circle><line x1="12" y1="1" x2="12" y2="3"></line><line x1="12" y1="21" x2="12" y2="23"></line><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line><line x1="1" y1="12" x2="3" y2="12"></line><line x1="21" y1="12" x2="23" y2="12"></line><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line></svg>
            <svg id="themeIconMoon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="display: none;"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path></svg>
          </button>
          <button class="sitebot-icon-btn" id="clearBtn" title="Clear conversation history">
            <svg viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
          </button>
          <button class="sitebot-icon-btn" id="fullscreenBtn" title="Toggle Fullscreen" style="display: none;">
            <svg id="fullscreenIconExpand" viewBox="0 0 24 24"><polyline points="15 3 21 3 21 9"></polyline><polyline points="9 21 3 21 3 15"></polyline><line x1="21" y1="3" x2="14" y2="10"></line><line x1="3" y1="21" x2="10" y2="14"></line></svg>
            <svg id="fullscreenIconCollapse" viewBox="0 0 24 24" style="display: none;"><polyline points="4 14 10 14 10 20"></polyline><polyline points="20 10 14 10 14 4"></polyline><line x1="14" y1="10" x2="21" y2="3"></line><line x1="3" y1="21" x2="10" y2="14"></line></svg>
          </button>
          <button class="sitebot-icon-btn" id="closeBtn" title="Close chat">
            <svg viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
          </button>
        </div>
      </div>

      <!-- Quick Action Fast Bar -->
      <div class="sitebot-fast-bar" id="fastBar">
        <a class="sitebot-fast-btn sitebot-fast-btn-call" id="fastCallBtn" href="tel:${botData.phoneRaw}">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path></svg>
          <span>Call Now</span>
        </a>

        <a class="sitebot-fast-btn sitebot-fast-btn-wa" id="fastWaBtn" target="_blank" rel="noopener noreferrer">
          <svg viewBox="0 0 24 24" fill="currentColor"><path d="M20.5 3.5A11.8 11.8 0 0 0 12.1 0C5.5 0 .1 5.4.1 12c0 2.1.5 4.1 1.6 5.9L0 24l6.3-1.6c1.7 1 3.7 1.6 5.8 1.6 6.6 0 12-5.4 12-12 0-3.2-1.3-6.2-3.6-8.5zm-8.4 18.5c-1.8 0-3.5-.5-5-1.4l-.4-.2-3.7 1 1-3.6-.2-.4a9.9 9.9 0 0 1-1.5-5.4c0-5.5 4.5-10 10-10 2.7 0 5.2 1 7.1 2.9a9.9 9.9 0 0 1 2.9 7.1c-.1 5.5-4.6 10-10.2 10zm5.5-7.5c-.3-.2-1.8-.9-2.1-1-.3-.1-.5-.2-.7.2-.2.3-.8 1-.9 1.2-.2.2-.4.2-.7.1-.3-.2-1.3-.5-2.5-1.5-.9-.8-1.5-1.8-1.7-2.1-.2-.3 0-.5.1-.6.1-.1.3-.3.4-.5.1-.2.2-.3.3-.5.1-.2 0-.4 0-.5-.1-.2-.7-1.7-1-2.3-.3-.6-.5-.5-.7-.5h-.6c-.2 0-.6.1-.9.4-.3.4-1.2 1.2-1.2 2.9s1.2 3.4 1.4 3.6c.2.3 2.4 3.7 5.9 5.2.8.4 1.5.6 2 .8.8.3 1.6.2 2.2.1.7-.1 2.1-.9 2.4-1.7.3-.8.3-1.6.2-1.7-.1-.2-.3-.3-.6-.5z"/></svg>
          <span>WhatsApp</span>
        </a>

        <a class="sitebot-fast-btn sitebot-fast-btn-email" id="fastEmailBtn">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path><polyline points="22,6 12,13 2,6"></polyline></svg>
          <span>Email</span>
        </a>

        <button class="sitebot-fast-btn sitebot-fast-btn-audit" id="fastAuditBtn" type="button">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon></svg>
          <span>Free Audit</span>
        </button>

        <a class="sitebot-fast-btn sitebot-fast-btn-plans" id="fastPlansBtn" href="/pricing" target="_blank" rel="noopener">
          <span>Plans</span>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="5" y1="12" x2="19" y2="12"></line><polyline points="12 5 19 12 12 19"></polyline></svg>
        </a>

        <!-- Live Agent Handoff Button -->
        <button class="sitebot-fast-btn" id="fastHandoffBtn" type="button" style="background: linear-gradient(135deg, #059669 0%, #047857 100%) !important; color: #ffffff !important; box-shadow: 0 2px 8px rgba(5, 150, 105, 0.28) !important;">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width: 12px; height: 12px;"><path d="M3 18v-6a9 9 0 0 1 18 0v6"></path><path d="M21 19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3zM3 19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H3z"></path></svg>
          <span>Live Agent</span>
        </button>

        <!-- Contact Us / Lead Capture Button -->
        <button class="sitebot-fast-btn" id="fastLeadBtn" type="button" style="background: linear-gradient(135deg, #4f46e5 0%, #4338ca 100%) !important; color: #ffffff !important; box-shadow: 0 2px 8px rgba(79, 70, 229, 0.28) !important;">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width: 12px; height: 12px;"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path><polyline points="22,6 12,13 2,6"></polyline></svg>
          <span>Contact Us</span>
        </button>

        <!-- Custom Links (rendered dynamically) -->
        <div id="customLinksBar" style="display: contents;"></div>
      </div>

      <!-- Live Handoff Status Banner -->
      <div id="handoffBanner" style="display: none; padding: 7px 14px; background: #ecfdf5; border-bottom: 1px solid #a7f3d0; font-size: 11px; font-weight: 600; color: #065f46; align-items: center; justify-content: space-between; flex-shrink: 0;">
        <div style="display: flex; align-items: center; gap: 7px;">
          <span style="width: 7px; height: 7px; border-radius: 50%; background: #10b981; box-shadow: 0 0 6px #10b981;"></span>
          <span id="handoffBannerText">Connected with Live Agent</span>
        </div>
        <button id="returnToBotBtn" type="button" style="background: none; border: none; font-size: 10px; font-weight: 700; color: #059669; text-decoration: underline; cursor: pointer;">Back to AI</button>
      </div>

      <!-- Quick Lead Form Drawer -->
      <div id="leadDrawer" style="display: none; padding: 12px 14px; background: #0f172a; border-bottom: 1px solid rgba(255,255,255,0.1); color: #fff; font-size: 12px; flex-shrink: 0;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
          <span style="font-weight: 700; color: #a5b4fc; font-size: 11.5px;">Leave Contact Details</span>
          <button id="closeLeadDrawer" type="button" style="background: none; border: none; color: #94a3b8; font-size: 13px; cursor: pointer;">✕</button>
        </div>
        <div style="display: flex; flex-direction: column; gap: 6px;">
          <input type="text" id="leadNameInput" placeholder="Your Name" style="width: 100%; padding: 6px 10px; border-radius: 8px; border: 1px solid rgba(255,255,255,0.2); background: rgba(0,0,0,0.4); color: #fff; font-size: 11.5px;" />
          <input type="email" id="leadEmailInput" placeholder="Email Address *" style="width: 100%; padding: 6px 10px; border-radius: 8px; border: 1px solid rgba(255,255,255,0.2); background: rgba(0,0,0,0.4); color: #fff; font-size: 11.5px;" />
          <input type="tel" id="leadPhoneInput" placeholder="Phone Number" style="width: 100%; padding: 6px 10px; border-radius: 8px; border: 1px solid rgba(255,255,255,0.2); background: rgba(0,0,0,0.4); color: #fff; font-size: 11.5px;" />
          <button id="submitLeadBtn" type="button" style="padding: 6px 12px; border-radius: 8px; border: none; background: #4f46e5; color: #fff; font-size: 11px; font-weight: 700; cursor: pointer;">Submit Request</button>
        </div>
      </div>

      <!-- Messages Body -->
      <div class="sitebot-messages" id="messagesOuter">
        <div class="sitebot-messages-scroll" id="messagesContainer"></div>
        <!-- Floating scroll to bottom button (anchored to visible area, not message content) -->
        <button class="sitebot-scroll-down-btn" id="scrollDownBtn" aria-label="Scroll to latest message">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"></line><polyline points="19 12 12 19 5 12"></polyline></svg>
        </button>
      </div>

      <!-- Suggestion Chips Container -->
      <div class="sitebot-chips-wrap" id="chipsWrap"></div>

      <!-- Input Area -->
      <div class="sitebot-input-area">
        <div class="sitebot-input-field-wrap">
          <input
            type="text"
            class="sitebot-input-field"
            id="messageInput"
            placeholder="Type your message..."
            maxlength="1500"
          />
          <button class="sitebot-send-btn" id="sendBtn" disabled aria-label="Send message">
            <svg id="sendIconPlane" viewBox="0 0 24 24"><line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></svg>
            <div id="sendIconSpinner" style="display: none; width: 16px; height: 16px; border: 2px solid rgba(255,255,255,0.3); border-top-color: #fff; border-radius: 50%; animation: sitebotSpin 0.8s linear infinite;"></div>
          </button>
        </div>
        <div class="sitebot-footer-brand">
          Powered by <a id="brandFooterLink" href="${apiHost}" target="_blank" rel="noopener" style="color: #fc0b0bff;">SiteBot Studio</a>
        </div>
      </div>
    </div>
  `;

  shadow.appendChild(container);

  // Element References
  const launcherWrap = shadow.getElementById('launcherWrap');
  const launcherBtn = shadow.getElementById('launcherBtn');
  const launcherIconOpen = shadow.getElementById('launcherIconOpen');
  const launcherIconClose = shadow.getElementById('launcherIconClose');
  const haloRing = shadow.getElementById('haloRing');
  const radarRing = shadow.getElementById('radarRing');
  const hoverTooltip = shadow.getElementById('hoverTooltip');
  const tooltipText = shadow.getElementById('tooltipText');
  const hintBubble = shadow.getElementById('hintBubble');
  const hintText = shadow.getElementById('hintText');
  const chatWindow = shadow.getElementById('chatWindow');
  const botHeaderName = shadow.getElementById('botHeaderName');
  const themeBtn = shadow.getElementById('themeBtn');
  const themeIconSun = shadow.getElementById('themeIconSun');
  const themeIconMoon = shadow.getElementById('themeIconMoon');
  const clearBtn = shadow.getElementById('clearBtn');
  const fullscreenBtn = shadow.getElementById('fullscreenBtn');
  const fullscreenIconExpand = shadow.getElementById('fullscreenIconExpand');
  const fullscreenIconCollapse = shadow.getElementById('fullscreenIconCollapse');
  const closeBtn = shadow.getElementById('closeBtn');
  const chatHeader = shadow.getElementById('chatHeader');
  const fastBar = shadow.getElementById('fastBar');
  const fastCallBtn = shadow.getElementById('fastCallBtn');
  const fastWaBtn = shadow.getElementById('fastWaBtn');
  const fastEmailBtn = shadow.getElementById('fastEmailBtn');
  const fastAuditBtn = shadow.getElementById('fastAuditBtn');
  const fastPlansBtn = shadow.getElementById('fastPlansBtn');
  const customLinksBar = shadow.getElementById('customLinksBar');
  const fastHandoffBtn = shadow.getElementById('fastHandoffBtn');
  const fastLeadBtn = shadow.getElementById('fastLeadBtn');
  const handoffBanner = shadow.getElementById('handoffBanner');
  const handoffBannerText = shadow.getElementById('handoffBannerText');
  const returnToBotBtn = shadow.getElementById('returnToBotBtn');
  const leadDrawer = shadow.getElementById('leadDrawer');
  const closeLeadDrawer = shadow.getElementById('closeLeadDrawer');
  const leadNameInput = shadow.getElementById('leadNameInput');
  const leadEmailInput = shadow.getElementById('leadEmailInput');
  const leadPhoneInput = shadow.getElementById('leadPhoneInput');
  const submitLeadBtn = shadow.getElementById('submitLeadBtn');
  const messagesContainer = shadow.getElementById('messagesContainer');
  const scrollDownBtn = shadow.getElementById('scrollDownBtn');
  const chipsWrap = shadow.getElementById('chipsWrap');
  const messageInput = shadow.getElementById('messageInput');
  const sendBtn = shadow.getElementById('sendBtn');
  const sendIconPlane = shadow.getElementById('sendIconPlane');
  const sendIconSpinner = shadow.getElementById('sendIconSpinner');
  const brandFooterLink = shadow.getElementById('brandFooterLink');

  // Unique session identifier for live agent handoff & lead persistence
  function getSessionId() {
    const key = 'sitebot_session_' + botId;
    try {
      let id = window.sessionStorage.getItem(key);
      if (!id) {
        id = 'sess-' + Math.random().toString(36).slice(2) + Date.now().toString(36);
        window.sessionStorage.setItem(key, id);
      }
      return id;
    } catch (e) {
      return 'sess-' + Math.random().toString(36).slice(2) + Date.now().toString(36);
    }
  }

  // Live Agent & Handoff State
  let handoffPollingInterval = null;
  let currentHandoffStatus = 'bot';

  function showHandoffBanner(status, assignedAgent) {
    if (!handoffBanner || !handoffBannerText) return;
    if (status === 'waiting_agent') {
      handoffBanner.style.display = 'flex';
      handoffBannerText.textContent = 'Waiting for available live agent...';
    } else if (status === 'agent_active') {
      handoffBanner.style.display = 'flex';
      handoffBannerText.textContent = `Connected with ${assignedAgent?.name || 'Live Agent'}`;
    } else if (status === 'resolved') {
      handoffBanner.style.display = 'flex';
      handoffBannerText.textContent = 'Session resolved. Handed back to AI.';
      setTimeout(() => {
        if (handoffBanner) handoffBanner.style.display = 'none';
      }, 3500);
      stopHandoffPolling();
    } else {
      handoffBanner.style.display = 'none';
    }
  }

  function appendLiveMessage(role, content, senderName) {
    if (role === 'system') {
      const sysRow = document.createElement('div');
      sysRow.style.cssText = 'width: 100%; text-align: center; margin: 8px 0; font-size: 11px; color: #64748b; font-style: italic;';
      sysRow.textContent = content;
      messagesContainer.appendChild(sysRow);
      updateScrollDownBtn();
      return;
    }

    const msgRow = document.createElement('div');
    msgRow.className = `sitebot-msg-row ${role === 'user' ? 'user' : 'bot'}`;

    const avatarCol = document.createElement('div');
    avatarCol.className = 'sitebot-msg-avatar-col';

    if (role === 'agent') {
      avatarCol.innerHTML = `
        <div class="sitebot-msg-avatar-circle" style="background: linear-gradient(135deg, #059669 0%, #047857 100%) !important; color: #fff;">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>
        </div>
        <span class="sitebot-msg-avatar-label" style="color: #059669; font-weight: 700;">${escapeHtml(senderName || 'Agent')}</span>
      `;
    } else {
      avatarCol.innerHTML = `
        <div class="sitebot-msg-avatar-circle">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 8V4m0 0H8m4 0h4m-7 4h6a4 4 0 0 1 4 4v5a4 4 0 0 1-4 4H9a4 4 0 0 1-4-4v-5a4 4 0 0 1 4-4Z"></path><circle cx="9" cy="13" r="1.2" fill="currentColor"></circle><circle cx="15" cy="13" r="1.2" fill="currentColor"></circle></svg>
        </div>
        <span class="sitebot-msg-avatar-label">${escapeHtml(botData.name || 'Assistant')}</span>
      `;
    }

    const bubble = document.createElement('div');
    bubble.className = 'sitebot-bubble';
    bubble.innerHTML = renderMarkdown(content);

    msgRow.appendChild(avatarCol);
    msgRow.appendChild(bubble);
    messagesContainer.appendChild(msgRow);
    updateScrollDownBtn();
    playBeep('receive');
  }

  function startHandoffPolling() {
    if (handoffPollingInterval) return;
    handoffPollingInterval = setInterval(async () => {
      try {
        const sId = getSessionId();
        const res = await fetch(`${apiHost}/api/chat/${botId}/handoff?sessionId=${encodeURIComponent(sId)}`);
        if (!res.ok) return;
        const data = await res.json();
        if (data.status && data.status !== currentHandoffStatus) {
          currentHandoffStatus = data.status;
          showHandoffBanner(data.status, data.assignedAgent);
        }
        if (Array.isArray(data.messages)) {
          const incoming = data.messages.filter((m) => m.role === 'agent' || m.role === 'system');
          const knownContents = new Set(messageHistory.map((m) => m.content));
          for (const m of incoming) {
            if (!knownContents.has(m.content)) {
              appendLiveMessage(m.role, m.content, m.senderName);
              messageHistory.push({ role: m.role, content: m.content });
            }
          }
        }
      } catch (err) {
        // non-fatal
      }
    }, 3500);
  }

  function stopHandoffPolling() {
    if (handoffPollingInterval) {
      clearInterval(handoffPollingInterval);
      handoffPollingInterval = null;
    }
  }

  // Show fullscreen button only on non-mobile screens
  if (window.innerWidth >= 640) {
    fullscreenBtn.style.display = 'flex';
  }

  // Theme toggle (light by default, persisted per bot)
  let widgetTheme = 'light';
  try {
    const savedTheme = localStorage.getItem('sitebot-theme-' + botId);
    if (savedTheme === 'light' || savedTheme === 'dark') {
      widgetTheme = savedTheme;
    }
  } catch (e) { }

  container.dataset.theme = widgetTheme;

  function updateThemeIcons() {
    const isDark = widgetTheme === 'dark';
    if (themeIconSun) themeIconSun.style.display = isDark ? 'block' : 'none';
    if (themeIconMoon) themeIconMoon.style.display = isDark ? 'none' : 'block';
  }

  updateThemeIcons();

  if (themeBtn) {
    themeBtn.addEventListener('click', () => {
      widgetTheme = widgetTheme === 'dark' ? 'light' : 'dark';
      container.dataset.theme = widgetTheme;
      updateThemeIcons();
      try {
        localStorage.setItem('sitebot-theme-' + botId, widgetTheme);
      } catch (e) { }
    });
  }


  function updateContactLinks() {
    const name = botData.name || 'Assistant';
    if (botHeaderName) {
      botHeaderName.textContent = name;
      botHeaderName.title = name;
    }
    if (tooltipText) tooltipText.textContent = `Chat with ${name}`;
    if (brandFooterLink) {
      brandFooterLink.textContent = 'SiteBot Studio';
    }

    HINT_MESSAGES.length = 0;
    HINT_MESSAGES.push(
      `Hi! I'm ${name} — AI Chat & Support`,
      'Direct Call & WhatsApp assistance inside',
      'Ask any question about our services',
      'See plans and get a quote today',
      'Your growth plan is one tap away'
    );
    if (hintText && !isOpen) {
      hintText.textContent = HINT_MESSAGES[0];
    }

    let visibleFastCount = 0;

    if (botData.phoneRaw || botData.phone) {
      fastCallBtn.href = `tel:${botData.phoneRaw || botData.phone}`;
      fastCallBtn.style.display = 'inline-flex';
      visibleFastCount++;
    } else {
      fastCallBtn.style.display = 'none';
    }

    const cleanWa = (botData.whatsapp || '').replace(/[^\d]/g, '');
    if (cleanWa) {
      fastWaBtn.href = `https://wa.me/${cleanWa}?text=${encodeURIComponent(
        `Hi! I'm contacting you via ${name}.`
      )}`;
      fastWaBtn.style.display = 'inline-flex';
      visibleFastCount++;
    } else {
      fastWaBtn.style.display = 'none';
    }

    if (botData.email) {
      fastEmailBtn.href = `mailto:${botData.email}`;
      fastEmailBtn.style.display = 'inline-flex';
      visibleFastCount++;
    } else {
      fastEmailBtn.style.display = 'none';
    }

    if (botData.auditUrl) {
      fastAuditBtn.style.display = 'inline-flex';
      visibleFastCount++;
    } else {
      fastAuditBtn.style.display = 'none';
    }

    if (botData.pricingUrl) {
      fastPlansBtn.href = botData.pricingUrl;
      fastPlansBtn.style.display = 'inline-flex';
      visibleFastCount++;
    } else {
      fastPlansBtn.style.display = 'none';
    }

    // Render custom link buttons (clear and rebuild each time)
    if (customLinksBar) {
      customLinksBar.innerHTML = '';
      const links = Array.isArray(botData.customLinks) ? botData.customLinks : [];
      links.forEach(function (link) {
        if (!link.label || !link.url) return;
        const a = document.createElement('a');
        a.className = 'sitebot-fast-btn sitebot-fast-btn-custom';
        a.href = link.url;
        a.target = '_blank';
        a.rel = 'noopener noreferrer';
        a.innerHTML = `<span>${link.label}</span><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:12px;height:12px;flex-shrink:0"><line x1="5" y1="12" x2="19" y2="12"></line><polyline points="12 5 19 12 12 19"></polyline></svg>`;
        customLinksBar.appendChild(a);
        visibleFastCount++;
      });
    }

    // Auto-scale dense fast bar if 3 or more action buttons exist
    if (fastBar) {
      if (visibleFastCount >= 3) {
        fastBar.classList.add('sitebot-fast-bar-dense');
      } else {
        fastBar.classList.remove('sitebot-fast-bar-dense');
      }
    }

    // Dynamic header compact mode if name is long or action buttons are dense
    if (chatHeader) {
      if (name.length >= 16 || visibleFastCount >= 3) {
        chatHeader.classList.add('sitebot-header-compact');
      } else {
        chatHeader.classList.remove('sitebot-header-compact');
      }
    }

    // Apply launcher button style variant class
    launcherWrap.classList.remove('sitebot-style-standard', 'sitebot-style-minimal', 'sitebot-style-pill', 'sitebot-style-chat');
    const style = botData.launcherStyle || 'standard';
    if (style !== 'standard') {
      launcherWrap.classList.add('sitebot-style-' + style);
    }

    // Update pill text label with bot name
    const launcherTextEl = shadow.getElementById('launcherText');
    if (launcherTextEl) {
      launcherTextEl.textContent = `Chat with ${name}`;
    }

    // Refresh chips if greeting is shown and user hasn't chatted yet
    if (messageHistory.length <= 1 && botData.suggestedQuestions && botData.suggestedQuestions.length > 0) {
      renderSuggestionChips(botData.suggestedQuestions);
    }
  }

  updateStyles();
  updateContactLinks();

  // Periodic Hint Bubble Animation
  function startHintLoop() {
    if (hintInterval) clearInterval(hintInterval);
    hintInterval = setInterval(() => {
      if (isOpen) return;
      hintIndex = (hintIndex + 1) % HINT_MESSAGES.length;
      hintText.textContent = HINT_MESSAGES[hintIndex];
      hintBubble.classList.add('visible');

      if (hintTimeout) clearTimeout(hintTimeout);
      hintTimeout = setTimeout(() => {
        hintBubble.classList.remove('visible');
      }, 7500);
    }, 12000);
  }

  startHintLoop();

  hintBubble.addEventListener('click', () => toggleChat(true));

  // Toggle Chat Window
  function toggleChat(forceState) {
    isOpen = typeof forceState === 'boolean' ? forceState : !isOpen;

    if (isOpen) {
      chatWindow.classList.add('open');
      launcherIconOpen.style.display = 'none';
      launcherIconClose.style.display = 'flex';
      haloRing.style.display = 'none';
      radarRing.style.display = 'none';
      hintBubble.classList.remove('visible');

      // Hide floating launcher on mobile when chat is open
      if (window.innerWidth < 640) {
        launcherWrap.style.opacity = '0';
        launcherWrap.style.pointerEvents = 'none';
      }

      // Lock mobile body scroll
      if (window.innerWidth < 640) {
        document.body.style.overflow = 'hidden';
      }

      if (!hasTypedWelcome) {
        typewriteWelcome();
      }

      setTimeout(() => messageInput.focus(), 160);
    } else {
      chatWindow.classList.remove('open');
      launcherIconOpen.style.display = 'flex';
      launcherIconClose.style.display = 'none';
      haloRing.style.display = 'block';
      radarRing.style.display = 'block';
      launcherWrap.style.opacity = '';
      launcherWrap.style.pointerEvents = '';
      hintBubble.style.display = '';

      document.body.style.overflow = '';
    }
  }

  launcherBtn.addEventListener('click', () => toggleChat());
  closeBtn.addEventListener('click', () => toggleChat(false));

  window.addEventListener('resize', () => {
    if (isOpen && window.innerWidth >= 640) {
      launcherWrap.style.opacity = '';
      launcherWrap.style.pointerEvents = '';
    } else if (isOpen && window.innerWidth < 640) {
      launcherWrap.style.opacity = '0';
      launcherWrap.style.pointerEvents = 'none';
    }
  });

  // Fullscreen toggle on desktop
  fullscreenBtn.addEventListener('click', () => {
    isFullscreen = !isFullscreen;
    if (isFullscreen) {
      chatWindow.classList.add('fullscreen');
      fullscreenIconExpand.style.display = 'none';
      fullscreenIconCollapse.style.display = 'block';
    } else {
      chatWindow.classList.remove('fullscreen');
      fullscreenIconExpand.style.display = 'block';
      fullscreenIconCollapse.style.display = 'none';
    }
  });

  // Fast action buttons
  fastAuditBtn.addEventListener('click', () => {
    if (botData.auditUrl) {
      window.open(botData.auditUrl, '_blank');
    } else {
      messageInput.value = 'Audit my website';
      handleSendMessage();
    }
  });

  if (fastHandoffBtn) {
    fastHandoffBtn.addEventListener('click', async () => {
      currentHandoffStatus = 'waiting_agent';
      showHandoffBanner('waiting_agent');
      appendLiveMessage('system', 'Transfer requested. Connecting you to a live human representative...', '');
      messageHistory.push({ role: 'system', content: 'Transfer requested. Connecting you to a live human representative...' });
      startHandoffPolling();
      try {
        await fetch(`${apiHost}/api/chat/${botId}/handoff`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sessionId: getSessionId(),
            reason: 'visitor_request',
            visitorName: 'Visitor',
          }),
        });
      } catch (e) {
        console.warn('[SiteBot] Failed to initiate handoff:', e);
      }
    });
  }

  if (returnToBotBtn) {
    returnToBotBtn.addEventListener('click', async () => {
      try {
        await fetch(`${apiHost}/api/chat/${botId}/handoff`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sessionId: getSessionId(),
            action: 'resolve',
          }),
        });
      } catch (e) {}
      currentHandoffStatus = 'resolved';
      showHandoffBanner('resolved');
      appendLiveMessage('system', 'Switched back to AI Assistant.', '');
      messageHistory.push({ role: 'system', content: 'Switched back to AI Assistant.' });
    });
  }

  if (fastLeadBtn && leadDrawer) {
    fastLeadBtn.addEventListener('click', () => {
      const isVisible = leadDrawer.style.display !== 'none';
      leadDrawer.style.display = isVisible ? 'none' : 'block';
      if (!isVisible && leadNameInput) leadNameInput.focus();
    });
  }

  if (closeLeadDrawer && leadDrawer) {
    closeLeadDrawer.addEventListener('click', () => {
      leadDrawer.style.display = 'none';
    });
  }

  if (submitLeadBtn && leadDrawer) {
    submitLeadBtn.addEventListener('click', async () => {
      const name = (leadNameInput?.value || '').trim();
      const email = (leadEmailInput?.value || '').trim();
      const phone = (leadPhoneInput?.value || '').trim();

      if (!email && !phone) {
        alert('Please enter at least an email address or phone number.');
        return;
      }

      submitLeadBtn.disabled = true;
      const originalText = submitLeadBtn.textContent;
      submitLeadBtn.textContent = 'Submitting...';

      try {
        const res = await fetch(`${apiHost}/api/chat/${botId}/lead`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            botId,
            sessionId: getSessionId(),
            name,
            email,
            phone,
          }),
        });

        if (res.ok) {
          leadDrawer.style.display = 'none';
          if (leadNameInput) leadNameInput.value = '';
          if (leadEmailInput) leadEmailInput.value = '';
          if (leadPhoneInput) leadPhoneInput.value = '';

          const confText = `Thank you${name ? ', ' + name : ''}! We have captured your contact info. A member of our team will get in touch with you shortly.`;
          appendLiveMessage('assistant', confText, botData.name);
          messageHistory.push({ role: 'assistant', content: confText });
        } else {
          alert('Could not submit contact details. Please try again.');
        }
      } catch (err) {
        alert('Network error while submitting details.');
      } finally {
        submitLeadBtn.disabled = false;
        submitLeadBtn.textContent = originalText;
      }
    });
  }

  // Scroll to bottom button
  messagesContainer.addEventListener('scroll', () => {
    const distFromBottom =
      messagesContainer.scrollHeight -
      messagesContainer.scrollTop -
      messagesContainer.clientHeight;
    if (distFromBottom > 40) {
      scrollDownBtn.classList.add('visible');
    } else {
      scrollDownBtn.classList.remove('visible');
    }
  });

  scrollDownBtn.addEventListener('click', () => {
    messagesContainer.scrollTo({ top: messagesContainer.scrollHeight, behavior: 'smooth' });
  });

  // Refresh the "go to latest" button state when content changes.
  // Never auto-scrolls: the viewport stays exactly where the visitor has it.
  function updateScrollDownBtn() {
    const distFromBottom =
      messagesContainer.scrollHeight -
      messagesContainer.scrollTop -
      messagesContainer.clientHeight;
    if (distFromBottom > 40) {
      scrollDownBtn.classList.add('visible');
    } else {
      scrollDownBtn.classList.remove('visible');
    }
  }

  // Input & Send button state
  messageInput.addEventListener('input', () => {
    sendBtn.disabled = !messageInput.value.trim() || isStreaming;
  });

  messageInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (!sendBtn.disabled) {
        handleSendMessage();
      }
    }
  });

  sendBtn.addEventListener('click', () => {
    if (!sendBtn.disabled) {
      handleSendMessage();
    }
  });

  // Welcome typing typewriter animation
  function typewriteWelcome() {
    hasTypedWelcome = true;
    if (typewriterTimer) clearTimeout(typewriterTimer);
    messagesContainer.innerHTML = '';
    scrollDownBtn.classList.remove('visible');

    const botRow = document.createElement('div');
    botRow.className = 'sitebot-msg-row bot';

    const avatarCol = document.createElement('div');
    avatarCol.className = 'sitebot-msg-avatar-col';
    avatarCol.innerHTML = `
      <div class="sitebot-msg-avatar-circle">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 8V4m0 0H8m4 0h4m-7 4h6a4 4 0 0 1 4 4v5a4 4 0 0 1-4 4H9a4 4 0 0 1-4-4v-5a4 4 0 0 1 4-4Z"></path><circle cx="9" cy="13" r="1.2" fill="currentColor"></circle><circle cx="15" cy="13" r="1.2" fill="currentColor"></circle></svg>
      </div>
      <span class="sitebot-msg-avatar-label">${botData.name || ''}</span>
    `;

    const bubble = document.createElement('div');
    bubble.className = 'sitebot-bubble';

    botRow.appendChild(avatarCol);
    botRow.appendChild(bubble);
    messagesContainer.appendChild(botRow);

    const fullText = (botData.greeting || 'Hi there! How can I help you today?').trim();
    const chars = Array.from(fullText);
    let idx = 0;

    const typeStep = () => {
      idx++;
      const typed = chars.slice(0, idx).join('');
      // Render plain text while typing (avoid broken markdown/emoji glitches),
      // then apply full markdown once complete.
      bubble.innerHTML = escapeHtml(typed);
      updateScrollDownBtn();

      if (idx >= chars.length) {
        bubble.innerHTML = renderMarkdown(fullText);
        renderSuggestionChips(botData.suggestedQuestions);
        typewriterTimer = null;
        return;
      }

      const ch = chars[idx];
      const pause = ch === '\n' ? 240 : /[.?,!;:।]/.test(ch) ? 190 : /\s/.test(ch) ? 90 : 26;
      typewriterTimer = setTimeout(typeStep, pause);
    };

    typewriterTimer = setTimeout(typeStep, 250);

    messageHistory.push({ role: 'assistant', content: fullText });
  }

  function renderSuggestionChips(chips) {
    chipsWrap.innerHTML = '';
    if (!chips || chips.length === 0) return;

    const filtered = chips.filter((q) => {
      const text = String(q || '').toLowerCase();
      if (/plans?|pricing|quote|package/.test(text) && !botData.pricingUrl) return false;
      if (/audit|free analysis/.test(text) && !botData.auditUrl) return false;
      return true;
    });

    filtered.forEach((q) => {
      const btn = document.createElement('button');
      btn.className = 'sitebot-chip';
      btn.textContent = q;
      btn.type = 'button';
      btn.addEventListener('click', () => {
        if (isStreaming) return;
        messageInput.value = q;
        handleSendMessage();
      });
      chipsWrap.appendChild(btn);
    });
  }

  // Clear conversation history
  clearBtn.addEventListener('click', () => {
    messageHistory.length = 0;
    hasTypedWelcome = false;
    typewriteWelcome();
  });

  // Sending messages & handling SSE responses
  async function handleSendMessage() {
    const text = messageInput.value.trim();
    if (!text || isStreaming) return;

    playBeep('send');

    // Append User Message
    const userRow = document.createElement('div');
    userRow.className = 'sitebot-msg-row user';

    const userBubble = document.createElement('div');
    userBubble.className = 'sitebot-bubble';
    userBubble.innerHTML = `<p>${text.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</p>`;

    const userAvatarCol = document.createElement('div');
    userAvatarCol.className = 'sitebot-msg-avatar-col';
    userAvatarCol.innerHTML = `
      <div class="sitebot-msg-avatar-circle sitebot-user-avatar" title="You" style="width:28px;height:28px;border-radius:50%;background:linear-gradient(135deg,#4f46e5 0%,#7c3aed 100%);border:1.5px solid rgba(255,255,255,0.4);box-shadow:0 2px 8px rgba(79,70,229,0.35);display:flex;align-items:center;justify-content:center;color:#ffffff;">
        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="#ffffff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:14px;height:14px;display:block;"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>
      </div>
      <span class="sitebot-msg-avatar-label" style="font-size:8.5px;font-weight:700;color:#64748b;line-height:1;margin-top:2px;">You</span>
    `;

    userRow.appendChild(userBubble);
    userRow.appendChild(userAvatarCol);
    messagesContainer.appendChild(userRow);

    messageHistory.push({ role: 'user', content: text });
    messageInput.value = '';
    sendBtn.disabled = true;
    sendIconPlane.style.display = 'none';
    sendIconSpinner.style.display = 'block';
    isStreaming = true;
    chipsWrap.innerHTML = '';
    updateScrollDownBtn();

    // Append Animated Loading Shimmer Card
    const loadingRow = document.createElement('div');
    loadingRow.className = 'sitebot-msg-row bot';

    const botAvatarCol = document.createElement('div');
    botAvatarCol.className = 'sitebot-msg-avatar-col';
    botAvatarCol.innerHTML = `
      <div class="sitebot-msg-avatar-circle">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 8V4m0 0H8m4 0h4m-7 4h6a4 4 0 0 1 4 4v5a4 4 0 0 1-4 4H9a4 4 0 0 1-4-4v-5a4 4 0 0 1 4-4Z"></path><circle cx="9" cy="13" r="1.2" fill="currentColor"></circle><circle cx="15" cy="13" r="1.2" fill="currentColor"></circle></svg>
      </div>
      <span class="sitebot-msg-avatar-label">${botData.name || 'Friday'}</span>
    `;

    const loadingCardWrap = document.createElement('div');
    loadingCardWrap.className = 'sitebot-loading-card-wrap';
    loadingCardWrap.innerHTML = `
      <div class="sitebot-loading-shimmer-border"></div>
      <div class="sitebot-loading-card">
        <div class="sitebot-loading-dots-row">
          <div class="sitebot-loading-dots">
            <span class="sitebot-dot"></span>
            <span class="sitebot-dot"></span>
            <span class="sitebot-dot"></span>
          </div>
          <span class="sitebot-loading-subtext">${botData.name || 'Friday'} is thinking</span>
        </div>
        <div class="sitebot-loading-message" id="loadingMessageEl">
          <span>${LOADING_MESSAGES[0].emoji}</span>
          <span>${LOADING_MESSAGES[0].text}</span>
        </div>
      </div>
    `;

    loadingRow.appendChild(botAvatarCol);
    loadingRow.appendChild(loadingCardWrap);
    messagesContainer.appendChild(loadingRow);
    updateScrollDownBtn();

    loadingIndex = 0;
    const loadingMessageEl = loadingCardWrap.querySelector('#loadingMessageEl');
    loadingInterval = setInterval(() => {
      loadingIndex = (loadingIndex + 1) % LOADING_MESSAGES.length;
      if (loadingMessageEl) {
        loadingMessageEl.innerHTML = `
          <span>${LOADING_MESSAGES[loadingIndex].emoji}</span>
          <span>${LOADING_MESSAGES[loadingIndex].text}</span>
        `;
      }
    }, 2000);

    let accumulatedText = '';
    let sourcesList = [];
    let typeQueue = '';
    let typeDisplay = '';
    let streamDone = false;
    let typeTimer = null;

    try {
      const isStudioPreview =
        currentScript.getAttribute('data-preview') === 'true' ||
        window.location.origin === apiHost ||
        window.location.pathname.startsWith('/demo');

      const reqHeaders = { 'Content-Type': 'application/json' };
      if (isStudioPreview) {
        reqHeaders['X-SiteBot-Preview'] = 'true';
      }

      const response = await fetch(`${apiHost}/api/chat/${botId}`, {
        method: 'POST',
        headers: reqHeaders,
        body: JSON.stringify({
          message: text,
          history: messageHistory.slice(-6),
          sessionId: getSessionId(),
        }),
      });

      if (!response.ok) {
        const errJson = await response.json().catch(() => ({}));
        throw new Error(errJson.error || `Error ${response.status}: Failed to get answer`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let isFirstChunk = true;

      // Prepare assistant bubble
      clearInterval(loadingInterval);
      loadingCardWrap.remove();

      const assistantBubble = document.createElement('div');
      assistantBubble.className = 'sitebot-bubble';
      loadingRow.appendChild(assistantBubble);

      function startTypeWriter() {
        if (typeTimer) return;
        typeTimer = setInterval(() => {
          if (typeQueue.length > 0) {
            const n = Math.min(2 + Math.floor(Math.random() * 4), typeQueue.length);
            typeDisplay += typeQueue.slice(0, n);
            typeQueue = typeQueue.slice(n);
            assistantBubble.innerHTML = escapeHtml(typeDisplay);
            updateScrollDownBtn();
          } else if (streamDone) {
            clearInterval(typeTimer);
            typeTimer = null;
            finishStream();
          }
        }, 18);
      }

      function finishStream() {
        const handoffMatch = accumulatedText.match(/\[\[HANDOFF:\s*([^\]]+)\]\]/i);
        const activeMatch = accumulatedText.match(/\[\[HANDOFF_ACTIVE:\s*([^\]]+)\]\]/i);
        const leadMatch = accumulatedText.match(/\[\[LEAD_CAPTURED:\s*([^\]]+)\]\]/i);

        if (handoffMatch) {
          currentHandoffStatus = 'waiting_agent';
          showHandoffBanner('waiting_agent');
          startHandoffPolling();
        } else if (activeMatch) {
          currentHandoffStatus = activeMatch[1].trim();
          showHandoffBanner(currentHandoffStatus);
          startHandoffPolling();
        }

        const cleanText = accumulatedText
          .replace(/\[\[(HANDOFF|HANDOFF_ACTIVE|LEAD_CAPTURED|GUARDRAIL_BLOCKED)[^\]]*\]\]/gi, '')
          .replace(/\[\[UNGROUNDED_FALLBACK\]\]/gi, '')
          .trim();

        assistantBubble.innerHTML = renderMarkdown(cleanText);
        playBeep('receive');

        if (leadMatch) {
          const leadBadge = document.createElement('div');
          leadBadge.className = 'sitebot-source-chip';
          leadBadge.style.color = '#10b981';
          leadBadge.style.borderColor = 'rgba(16, 185, 129, 0.3)';
          leadBadge.textContent = '✓ Contact details registered';
          assistantBubble.appendChild(leadBadge);
        }

        if (sourcesList && sourcesList.length > 0) {
          const sourcesContainer = document.createElement('div');
          sourcesContainer.className = 'sitebot-sources';
          sourcesContainer.innerHTML = sourcesList
            .map(
              (s) => `
            <a class="sitebot-source-chip" href="${s.url}" target="_blank" rel="noopener noreferrer">
              <span>🔗 ${s.title ? s.title.slice(0, 24) : 'Source'}</span>
            </a>
          `
            )
            .join('');
          assistantBubble.appendChild(sourcesContainer);
        }

        messageHistory.push({ role: 'assistant', content: cleanText });
      }

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const events = buffer.split('\n\n');
        buffer = events.pop() || '';

        for (const evt of events) {
          const lines = evt.split('\n');
          let eventType = '';
          let dataStr = '';

          for (const line of lines) {
            if (line.startsWith('event: ')) {
              eventType = line.slice(7).trim();
            } else if (line.startsWith('data: ')) {
              dataStr = line.slice(6).trim();
            }
          }

          if (eventType === 'sources') {
            try {
              sourcesList = JSON.parse(dataStr);
            } catch {
              /* noop */
            }
          } else if (eventType === 'token') {
            try {
              const { token } = JSON.parse(dataStr);
              accumulatedText += token;
              typeQueue += token;
              startTypeWriter();
            } catch {
              /* noop */
            }
          } else if (eventType === 'handoff') {
            try {
              const hData = JSON.parse(dataStr);
              currentHandoffStatus = hData.status;
              showHandoffBanner(hData.status, hData.assignedAgent);
              startHandoffPolling();
            } catch (e) {
              /* noop */
            }
          } else if (eventType === 'error') {
            try {
              const { error } = JSON.parse(dataStr);
              throw new Error(error);
            } catch (e) {
              throw e;
            }
          }
        }
      }

      streamDone = true;
      if (!typeTimer) finishStream();
    } catch (err) {
      if (typeTimer) clearInterval(typeTimer);
      typeTimer = null;
      streamDone = true;
      clearInterval(loadingInterval);
      if (loadingCardWrap.parentNode) loadingCardWrap.remove();

      const errorBubble = document.createElement('div');
      errorBubble.className = 'sitebot-bubble';
      errorBubble.innerHTML = `<p style="color: #f87171;">⚠️ ${err instanceof Error ? err.message : 'Something went wrong. Please try again.'
        }</p>`;
      loadingRow.appendChild(errorBubble);
    } finally {
      isStreaming = false;
      sendBtn.disabled = !messageInput.value.trim();
      sendIconPlane.style.display = 'block';
      sendIconSpinner.style.display = 'none';
      updateScrollDownBtn();
    }
  }

  // Load bot metadata from API
  async function loadBotMetadata() {
    try {
      const res = await fetch(`${apiHost}/api/chat/${botId}?_cb=${Date.now()}`, { method: 'GET' });
      if (res.ok) {
        const data = await res.json();
        botData = { ...botData, ...data };
        updateStyles();
        updateContactLinks();

        const nameEl = shadow.getElementById('botHeaderName');
        if (nameEl && botData.name) {
          nameEl.textContent = botData.name;
          nameEl.title = botData.name;
        }
        const subtitleEl = shadow.getElementById('botHeaderSubtitle');
        if (subtitleEl) {
          subtitleEl.textContent = getDynamicRoleSubtitle(botData);
        }

        // If welcome message was already rendered with default values before metadata arrived, update it
        if (messageHistory.length <= 1) {
          const firstBotBubble = messagesContainer.querySelector('.sitebot-msg-row.bot .sitebot-bubble');
          const firstBotLabel = messagesContainer.querySelector('.sitebot-msg-row.bot .sitebot-msg-avatar-label');
          if (firstBotLabel && botData.name) {
            firstBotLabel.textContent = botData.name;
          }
          if (firstBotBubble && botData.greeting && messageHistory.length === 1) {
            firstBotBubble.innerHTML = renderMarkdown(botData.greeting);
            messageHistory[0] = { role: 'assistant', content: botData.greeting };
          }
        }
      }
    } catch (err) {
      console.warn('[SiteBot] Could not fetch bot metadata, using defaults:', err);
    }
  }

  loadBotMetadata();
})();
