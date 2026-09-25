import mongoose from 'mongoose';
import { BotForm, FormSubmission } from '@/lib/models';
import { MemoryDb } from '@/lib/memoryDb';
import { getOrCreateConversation, appendConversationMessage } from '@/lib/ai/handoff';
import { sendLeadNotifications } from '@/lib/notifications';
import { isUsingMemoryDb } from '@/lib/db';
import { trackChatTurn } from '@/lib/usage';
import { normalizeEmail } from '@/lib/crawler/scraper';

/**
 * Robust extraction of visitor emails from conversational chat messages.
 * Handles messy text, Hinglish, punctuation (trailing period/commas), brackets,
 * URI encoding, and common obfuscations like user [at] gmail [dot] com.
 */
export function extractEmailFromMessage(message: string): string | null {
  if (!message || typeof message !== 'string') return null;

  // 1. Direct standard email extraction with boundary checking
  const standardMatches = message.match(/\b[a-zA-Z0-9._%+-]+@(?:[a-zA-Z0-9-]+\.)+[a-zA-Z]{2,24}\b/g);
  if (standardMatches) {
    for (const raw of standardMatches) {
      const norm = normalizeEmail(raw);
      if (norm) return norm;
    }
  }

  // 2. Bracketed obfuscated emails: name [at] domain [dot] com, name(at)domain.com
  const bracketRegex = /\b([a-zA-Z0-9._%+-]+)\s*(?:\[at\]|\(at\)|\{at\})\s*([a-zA-Z0-9-]+(?:\.[a-zA-Z0-9-]+)*)\s*(?:\[dot\]|\(dot\)|\{dot\}|\.)\s*([a-zA-Z]{2,24})\b/i;
  const bracketMatch = message.match(bracketRegex);
  if (bracketMatch) {
    const constructed = `${bracketMatch[1]}@${bracketMatch[2]}.${bracketMatch[3]}`;
    const norm = normalizeEmail(constructed);
    if (norm) return norm;
  }

  // 3. Spelled out obfuscated emails: name at domain dot com
  const spelledRegex = /\b([a-zA-Z0-9._%+-]+)\s+at\s+([a-zA-Z0-9-]+(?:\.[a-zA-Z0-9-]+)*)\s+dot\s+([a-zA-Z]{2,24})\b/i;
  const spelledMatch = message.match(spelledRegex);
  if (spelledMatch) {
    const constructed = `${spelledMatch[1]}@${spelledMatch[2]}.${spelledMatch[3]}`;
    const norm = normalizeEmail(constructed);
    if (norm) return norm;
  }

  return null;
}

/**
 * Extracts phone numbers from conversational chat messages.
 */
export function extractPhoneFromMessage(message: string): string | null {
  if (!message || typeof message !== 'string') return null;
  // Match standard phone numbers (international or domestic)
  const phoneMatch = message.match(/(?:\+?\d{1,4}[-.\s]?)?\(?\d{2,5}\)?[-.\s]?\d{3,5}[-.\s]?\d{3,5}/);
  if (phoneMatch) {
    const raw = phoneMatch[0].trim();
    const digitsOnly = raw.replace(/\D/g, '');
    // Must have between 7 and 15 digits to avoid matching 4-digit years or zip codes
    if (digitsOnly.length >= 7 && digitsOnly.length <= 15) {
      return raw;
    }
  }
  return null;
}

/**
 * Extracts visitor name from conversational chat messages.
 */
export function extractNameFromMessage(message: string): string | null {
  if (!message || typeof message !== 'string') return null;
  const namePatterns = [
    /(?:my name is|i am|i'm|this is|mera naam|naam hai|name[:=])\s+([A-Za-z]{2,20}(?:\s+[A-Za-z]{2,20})?)/i,
    /(?:call me)\s+([A-Za-z]{2,20})/i,
  ];
  for (const pat of namePatterns) {
    const m = message.match(pat);
    if (m && m[1]) {
      const candidate = m[1].trim();
      if (!/^(here|interested|looking|asking|wondering|email|phone|gmail|yahoo|user)$/i.test(candidate)) {
        return candidate;
      }
    }
  }
  return null;
}

export interface AutoCaptureLeadResult {
  captured: boolean;
  type: 'email' | 'phone' | null;
  email?: string;
  phone?: string;
  name?: string;
}

/**
 * Automatically captures casual leads when a user mentions contact info in chat.
 * Safely resolves bot IDs (handling custom slugs without ObjectId casting errors),
 * merges multiple message submissions from the same session into a single unified record,
 * updates Conversation visitor data for live agent views, and fires owner notifications.
 */
export async function autoCaptureLead(params: {
  bot?: any;
  botId: string;
  sessionId: string;
  message: string;
}): Promise<AutoCaptureLeadResult> {
  const { bot, botId, sessionId, message } = params;

  const email = extractEmailFromMessage(message);
  const phone = extractPhoneFromMessage(message);
  const name = extractNameFromMessage(message);

  if (!email && !phone) {
    return { captured: false, type: null };
  }

  const leadType = email ? 'email' : 'phone';

  try {
    let formId = '';
    let createdNewSubmission = false;

    if (isUsingMemoryDb()) {
      const forms = MemoryDb.findBotForms(botId);
      let targetForm = forms.find((f) => f.formType === 'LEAD_GENERATION');
      if (!targetForm) {
        targetForm = MemoryDb.createBotForm({
          botId,
          formType: 'LEAD_GENERATION',
          title: 'Automated Lead Capture',
          targetUrl: bot?.siteUrl || 'https://sitebotstudio.app',
          fieldsSchema: [],
          isActive: true,
        });
      }
      formId = targetForm ? targetForm._id : '';

      // Check if session already has a submission to merge contact data
      const existingSubs = MemoryDb.findFormSubmissions(formId, sessionId);
      const existingSub = existingSubs.length > 0 ? existingSubs[existingSubs.length - 1] : null;

      if (existingSub) {
        const existingData = (existingSub.data as Record<string, any>) || {};
        MemoryDb.updateFormSubmission(existingSub._id, {
          data: {
            ...existingData,
            email: email || existingData.email || '',
            phone: phone || existingData.phone || '',
            name: name || existingData.name || '',
            message: existingData.message && existingData.message !== message
              ? `${existingData.message} | ${message}`
              : message,
            lastCapturedAt: new Date().toISOString(),
          },
          status: 'completed',
        });
      } else {
        MemoryDb.createFormSubmission({
          formId,
          sessionId,
          data: {
            email: email || '',
            phone: phone || '',
            name: name || '',
            message,
            source: 'chat_casual_extraction',
            capturedAt: new Date().toISOString(),
          },
          status: 'completed',
        });
        createdNewSubmission = true;
      }
    } else {
      // Safely resolve bot ObjectId
      const botObjId = mongoose.Types.ObjectId.isValid(botId)
        ? new mongoose.Types.ObjectId(botId)
        : bot?._id
          ? (mongoose.Types.ObjectId.isValid(bot._id) ? new mongoose.Types.ObjectId(bot._id) : bot._id)
          : botId;

      let targetForm = await BotForm.findOne({ botId: botObjId as any, formType: 'LEAD_GENERATION' });
      if (!targetForm) {
        targetForm = await BotForm.create({
          botId: botObjId,
          formType: 'LEAD_GENERATION',
          title: 'Automated Lead Capture',
          targetUrl: bot?.siteUrl || 'https://sitebotstudio.app',
          fieldsSchema: [],
          isActive: true,
        });
      }
      formId = targetForm._id.toString();

      // Check if session already has a submission to merge contact data
      const existingSub = await FormSubmission.findOne({ formId, sessionId });
      if (existingSub) {
        const existingData = (existingSub.data as Record<string, any>) || {};
        existingSub.data = {
          ...existingData,
          email: email || existingData.email || '',
          phone: phone || existingData.phone || '',
          name: name || existingData.name || '',
          message: existingData.message && existingData.message !== message
            ? `${existingData.message} | ${message}`
            : message,
          lastCapturedAt: new Date().toISOString(),
        };
        existingSub.status = 'completed';
        await existingSub.save();
      } else {
        await FormSubmission.create({
          formId,
          sessionId,
          data: {
            email: email || '',
            phone: phone || '',
            name: name || '',
            message,
            source: 'chat_casual_extraction',
            capturedAt: new Date().toISOString(),
          },
          status: 'completed',
        });
        createdNewSubmission = true;
      }
    }

    // Count new lead on the chatbot + owner profile (dashboard "Leads captured")
    if (createdNewSubmission && bot?.ownerEmail) {
      trackChatTurn(bot, { leads: true }).catch((err) =>
        console.warn('[AutoLead] Could not record lead usage:', err)
      );
    }

    // Update conversation visitor profile for real-time live-agent visibility
    const visitorInfo: { email?: string; phone?: string; name?: string } = {};
    if (email) visitorInfo.email = email;
    if (phone) visitorInfo.phone = phone;
    if (name) visitorInfo.name = name;

    await getOrCreateConversation(botId, sessionId, visitorInfo);

    // Append system note to conversation transcript
    await appendConversationMessage(botId, sessionId, {
      role: 'system',
      content: `Lead captured: ${name || 'Visitor'} (${email || phone})`,
    });

    // Fire owner notification if bot owner email is configured
    if (bot?.ownerEmail) {
      sendLeadNotifications({
        bot,
        lead: {
          name: name || '',
          email: email || '',
          phone: phone || '',
          message,
          campaign: 'Chat Visitor Lead',
          page: bot.siteUrl || '',
          botId,
          ownerId: bot.ownerId || '',
          ownerEmail: bot.ownerEmail,
          source: 'chat_casual_extraction',
        },
        ownerEmail: bot.ownerEmail,
      }).catch((err) => console.warn('[AutoLead] Notification warning:', err));
    }

    return {
      captured: true,
      type: leadType,
      email: email || undefined,
      phone: phone || undefined,
      name: name || undefined,
    };
  } catch (err) {
    console.warn('[AutoLead] Could not persist auto lead:', err);
    return { captured: false, type: null };
  }
}
