/**
 * Notification & Messaging Engine
 * Sends lead / CTA alerts over Email (SMTP), WhatsApp, and Telegram.
 * All credentials are read from environment variables; a project/bot name is
 * always embedded in the subject and body so recipients know the source.
 */

import net from 'net';
import tls from 'tls';
import { getOrCreateProfile } from '@/lib/usage';

export interface NotificationTarget {
  emailTo?: string;
  whatsappNumber?: string;
  telegramChatId?: string;
  telegramBotToken?: string;
}

export interface LeadPayload {
  name?: string;
  email?: string;
  phone?: string;
  message?: string;
  campaign?: string;
  page?: string;
  botId?: string;
  ownerId?: string;
  ownerEmail?: string;
  source: string;
}

// ============================================================
// Minimal dependency-free SMTP client (STARTTLS / implicit TLS)
// ============================================================

interface SmtpConnection {
  socket: net.Socket | tls.TLSSocket;
  buffer: string;
  resolver: ((value: string) => void) | null;
  queue: Array<{ cmd: string; expect: number[] }>;
  flush: (line: string) => void;
}

function connectToServer(host: string, port: number, secure: boolean): Promise<any> {
  return new Promise((resolve, reject) => {
    const raw: net.Socket = net.connect({ host, port }, () => {});
    raw.setTimeout(20000);
    raw.on('error', reject);
    raw.on('timeout', () => {
      raw.destroy(new Error('SMTP connection timed out'));
    });

    const onSocket = (socket: net.Socket | tls.TLSSocket) => {
      const conn: SmtpConnection = {
        socket,
        buffer: '',
        resolver: null,
        queue: [],
        flush(line: string) {
          const match = line.match(/^(\d{3})(?:[- ])(.*)$/);
          if (!match) return;
          const code = parseInt(match[1], 10);
          if (conn.resolver && (code === 220 || code === 250 || code === 235 || code === 334 || code === 354)) {
            const r = conn.resolver;
            conn.resolver = null;
            r(line);
          }
        },
      };

      conn.socket.setEncoding('utf8');
      conn.socket.on('data', (chunk) => {
        conn.buffer += chunk;
        const lines = conn.buffer.split('\n');
        conn.buffer = lines.pop() || '';
        for (const l of lines) conn.flush(l.trim());
      });

      const send = (cmd: string): Promise<string> => {
        return new Promise((res, rej) => {
          conn.resolver = res;
          conn.socket.write(cmd + '\r\n', (err: any) => err && rej(err));
        });
      };

      resolve({ ...conn, send });
    };

    if (secure) {
      const tlsSocket = tls.connect({ socket: raw, servername: host }, () => onSocket(tlsSocket));
      tlsSocket.on('error', reject);
    } else {
      onSocket(raw);
    }
  });
}

export function isSmtpConfigured(): boolean {
  return Boolean(
    process.env.SMTP_HOST &&
      process.env.SMTP_USER &&
      process.env.SMTP_PASS &&
      process.env.SMTP_HOST !== 'smtp.example.com'
  );
}

/**
 * Sends an email over SMTP using credentials from the environment.
 * Includes the project name in the subject line.
 */
export async function sendEmail(options: {
  to: string;
  subject: string;
  html: string;
  text?: string;
}): Promise<{ ok: boolean; error?: string }> {
  const host = process.env.SMTP_HOST;
  const port = parseInt(process.env.SMTP_PORT || '587', 10);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const from = process.env.SMTP_FROM || user;
  const fromName = process.env.SMTP_FROM_NAME || 'Rivafy Studio';

  if (!host || !user || !pass) {
    return { ok: false, error: 'SMTP is not configured. Add SMTP_HOST/SMTP_USER/SMTP_PASS to .env' };
  }

  const secure = port === 465;

  try {
    const conn: any = await connectToServer(host, port, secure);
    await conn.send(`EHLO ${host}`);
    if (!secure && port !== 25) {
      await conn.send('STARTTLS');
      await new Promise<void>((resolve, reject) => {
        const upgraded = tls.connect({ socket: conn.socket, servername: host }, () => {
          conn.socket = upgraded;
          conn.socket.setEncoding('utf8');
          conn.socket.on('data', (chunk: string) => {
            conn.buffer += chunk;
            const lines = conn.buffer.split('\n');
            conn.buffer = lines.pop() || '';
            for (const l of lines) {
              if (conn.resolver && /^(250|220)\b/.test(l.trim())) {
                const r = conn.resolver;
                conn.resolver = null;
                r(l.trim());
              }
            }
          });
          resolve();
        });
        upgraded.on('error', reject);
      });
      await conn.send(`EHLO ${host}`);
    }

    await conn.send(`AUTH LOGIN`);
    await conn.send(Buffer.from(user).toString('base64'));
    await conn.send(Buffer.from(pass).toString('base64'));
    await conn.send(`MAIL FROM:<${from}>`);

    const rcpt = options.to.split(',').map((r) => r.trim()).filter(Boolean);
    for (const r of rcpt) {
      await conn.send(`RCPT TO:<${r}>`);
    }

    await conn.send('DATA');
    const headers = [
      `From: ${fromName} <${from}>`,
      `To: ${options.to}`,
      `Subject: ${options.subject.replace(/[\r\n]/g, ' ')}`,
      'MIME-Version: 1.0',
      'Content-Type: text/html; charset=UTF-8',
    ].join('\r\n');
    const body = (options.html || options.text || '').replace(/^\./gm, '..');
    await conn.send(`${headers}\r\n\r\n${body}\r\n.`);
    await conn.send('QUIT');
    return { ok: true };
  } catch (err: any) {
    return { ok: false, error: err?.message || 'SMTP error' };
  }
}

// ============================================================
// Telegram
// ============================================================

export function isTelegramConfigured(botToken?: string): boolean {
  const token = botToken || process.env.TELEGRAM_BOT_TOKEN;
  const chat = process.env.TELEGRAM_CHAT_ID;
  return Boolean(token && chat);
}

export async function sendTelegram(
  message: string,
  botToken?: string,
  chatId?: string
): Promise<{ ok: boolean; error?: string }> {
  const token = botToken || process.env.TELEGRAM_BOT_TOKEN || '';
  const chat = chatId || process.env.TELEGRAM_CHAT_ID || '';
  if (!token || !chat) {
    return { ok: false, error: 'Telegram not configured' };
  }
  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chat,
        text: message,
        parse_mode: 'HTML',
        disable_web_page_preview: true,
      }),
    });
    const data: any = await res.json().catch(() => ({}));
    if (!res.ok || data.ok === false) {
      return { ok: false, error: data?.description || `Telegram error (${res.status})` };
    }
    return { ok: true };
  } catch (err: any) {
    return { ok: false, error: err?.message || 'Telegram network error' };
  }
}

// ============================================================
// WhatsApp
// Supports Baileys Web Client + generic HTTP gateway (WHATSAPP_API_URL)
// ============================================================

export function isWhatsAppConfigured(): boolean {
  return Boolean(process.env.WHATSAPP_API_URL || process.env.NOTIFY_WHATSAPP);
}

export async function sendWhatsApp(
  message: string,
  toNumber?: string
): Promise<{ ok: boolean; error?: string }> {
  // 1. Try Baileys connected client first
  if (toNumber) {
    try {
      const { sendWhatsAppMessage } = await import('@/lib/whatsapp/baileysManager');
      const baileysResult = await sendWhatsAppMessage(toNumber, message);
      if (baileysResult.ok) {
        return { ok: true };
      }
    } catch {
      // Fall through to HTTP gateway
    }
  }

  // 2. Fall back to WHATSAPP_API_URL gateway if configured
  const gateway = process.env.WHATSAPP_API_URL;
  if (!gateway) {
    return { ok: false, error: 'No active WhatsApp connection or WHATSAPP_API_URL configured' };
  }
  const token = process.env.WHATSAPP_TOKEN || '';
  const from = process.env.WHATSAPP_FROM || toNumber || '';
  try {
    const res = await fetch(gateway, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ to: toNumber || '', from, message }),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      return { ok: false, error: `WhatsApp gateway error (${res.status}): ${text.slice(0, 200)}` };
    }
    return { ok: true };
  } catch (err: any) {
    return { ok: false, error: err?.message || 'WhatsApp gateway network error' };
  }
}

// ============================================================
// Combined lead notification pipeline
// ============================================================

function escapeHtml(str: string): string {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Sends lead notifications to the configured channels for the bot's owner.
 * Resolved config order: bot.notifications -> owner profile notifications -> env fallbacks.
 */
export async function sendLeadNotifications(config: {
  bot: any;
  lead: LeadPayload;
  ownerEmail?: string;
  ownerId?: string;
}): Promise<{ email: boolean; whatsapp: boolean; telegram: boolean }> {
  const { bot, lead, ownerEmail } = config;
  const projectName = escapeHtml(bot?.name || projectNameOf(bot?.siteUrl));
  const results = { email: false, whatsapp: false, telegram: false };

  // Resolve targets
  let profile: any = null;
  if (ownerEmail) profile = await getOrCreateProfile({ email: ownerEmail, userId: config.ownerId });

  const emailTo =
    bot?.notifications?.email?.enabled
      ? bot.notifications.email.to
      : profile?.notifications?.email?.enabled
      ? profile.notifications.email.to
      : process.env.NOTIFY_EMAIL || '';

  const waNumber =
    bot?.notifications?.whatsapp?.enabled
      ? bot.notifications.whatsapp.number
      : profile?.notifications?.whatsapp?.enabled
      ? profile.notifications.whatsapp.number
      : process.env.NOTIFY_WHATSAPP || '';

  const telegramChatId =
    bot?.notifications?.telegram?.enabled
      ? bot.notifications.telegram.chatId
      : profile?.notifications?.telegram?.enabled
      ? profile.notifications.telegram.chatId
      : process.env.TELEGRAM_CHAT_ID || '';

  const telegramBotToken =
    bot?.notifications?.telegram?.enabled
      ? bot.notifications.telegram.botToken
      : profile?.notifications?.telegram?.enabled
      ? profile.notifications.telegram.botToken
      : process.env.TELEGRAM_BOT_TOKEN || '';

  const leadName = lead.name || 'A visitor';
  const contactInfo = [
    lead.name ? `Name: ${lead.name}` : '',
    lead.email ? `Email: ${lead.email}` : '',
    lead.phone ? `Phone: ${lead.phone}` : '',
  ]
    .filter(Boolean)
    .join(', ') || 'No contact details provided';

  const summary = lead.message?.slice(0, 400) || 'No message';

  // 1. Email
  if (emailTo && isSmtpConfigured()) {
    const subject = `[${projectName}] New Lead ${lead.campaign ? `– ${lead.campaign}` : ''}`;
    const html = `
      <div style="font-family:Arial,Helvetica,sans-serif;max-width:600px;margin:auto;border:1px solid #e2e8f0;border-radius:14px;overflow:hidden">
        <div style="background:linear-gradient(90deg,#4f46e5,#7c3aed);padding:18px 24px">
          <h2 style="margin:0;color:#fff;font-size:18px">New Lead — ${projectName}</h2>
          <div style="color:#c7d2fe;font-size:12px;margin-top:4px">via ${lead.source || 'website'}</div>
        </div>
        <div style="padding:24px">
          <table width="100%" cellpadding="6" style="font-size:14px;color:#0f172a">
            <tr><td style="color:#64748b;width:110px">Name</td><td><strong>${escapeHtml(leadName)}</strong></td></tr>
            ${lead.email ? `<tr><td style="color:#64748b">Email</td><td><strong>${escapeHtml(lead.email)}</strong></td></tr>` : ''}
            ${lead.phone ? `<tr><td style="color:#64748b">Phone</td><td><strong>${escapeHtml(lead.phone)}</strong></td></tr>` : ''}
            ${lead.campaign ? `<tr><td style="color:#64748b">Campaign</td><td>${escapeHtml(lead.campaign)}</td></tr>` : ''}
            ${lead.page ? `<tr><td style="color:#64748b">Page</td><td>${escapeHtml(lead.page)}</td></tr>` : ''}
          </table>
          ${lead.message ? `<div style="margin-top:12px;padding:12px 14px;background:#f8fafc;border-left:3px solid #4f46e5;border-radius:8px;font-size:13px;color:#334155">${escapeHtml(lead.message)}</div>` : ''}
        </div>
      </div>
    `;
    const mailResult = await sendEmail({
      to: emailTo,
      subject,
      html,
      text: `New lead from ${projectName}: ${contactInfo}. ${summary}`,
    });
    if (mailResult.ok) results.email = true;
  }

  // 2. WhatsApp
  if (waNumber) {
    const waMessage = `*[${projectName}]* New lead\n📌 ${lead.campaign || 'Inquiry'}\n\n${lead.name ? `👤 ${lead.name}\n` : ''}${lead.email ? `✉️ ${lead.email}\n` : ''}${lead.phone ? `📞 ${lead.phone}\n` : ''}\n💬 ${summary}`;
    const waResult = await sendWhatsApp(waMessage, waNumber);
    if (waResult.ok) results.whatsapp = true;
  }

  // 3. Telegram
  if (telegramChatId && telegramBotToken) {
    const tgMessage = `<b>[${projectName}] New Lead ${lead.campaign ? `– ${lead.campaign}` : ''}</b>\n\n${lead.name ? `👤 ${lead.name}\n` : ''}${lead.email ? `✉️ ${lead.email}\n` : ''}${lead.phone ? `📞 ${lead.phone}\n` : ''}\n💬 ${summary}`;
    const tgResult = await sendTelegram(tgMessage, telegramBotToken, telegramChatId);
    if (tgResult.ok) results.telegram = true;
  }

  return results;
}

function projectNameOf(url?: string): string {
  if (!url) return 'Rivafy';
  try {
    const host = new URL(url.startsWith('http') ? url : `https://${url}`).hostname;
    return host.replace(/^www\./, '');
  } catch {
    return url;
  }
}