import mongoose from 'mongoose';
import { connectToDatabase, isUsingMemoryDb } from '@/lib/db';
import { ChatTicket } from '@/lib/models/ChatTicket';
import { Conversation } from '@/lib/models/Conversation';
import { appendConversationMessage } from '@/lib/ai/handoff';
import { handoffEventEmitter, extractTicketId } from '@/lib/whatsapp/baileysManager';

const META_GRAPH_VERSION = 'v21.0';

/**
 * Check if Meta WhatsApp Cloud API credentials are configured in environment
 */
export function isMetaCloudConfigured(): boolean {
  const token =
    process.env.META_WHATSAPP_TOKEN ||
    process.env.WHATSAPP_CLOUD_API_TOKEN ||
    process.env.WHATSAPP_TOKEN;
  const phoneNumberId =
    process.env.META_PHONE_NUMBER_ID ||
    process.env.WHATSAPP_PHONE_NUMBER_ID;

  return Boolean(token && phoneNumberId);
}

/**
 * Get the Meta Cloud API Token
 */
export function getMetaToken(): string {
  return (
    process.env.META_WHATSAPP_TOKEN ||
    process.env.WHATSAPP_CLOUD_API_TOKEN ||
    process.env.WHATSAPP_TOKEN ||
    ''
  );
}

/**
 * Get the Meta Cloud API Phone Number ID
 */
export function getMetaPhoneNumberId(): string {
  return (
    process.env.META_PHONE_NUMBER_ID ||
    process.env.WHATSAPP_PHONE_NUMBER_ID ||
    ''
  );
}

/**
 * Get the Webhook Verify Token configured for Meta
 */
export function getWebhookVerifyToken(): string {
  return (
    process.env.WHATSAPP_VERIFY_TOKEN ||
    process.env.META_VERIFY_TOKEN ||
    'sitebot_verify_token_2026'
  );
}

/**
 * Clean phone number into international digits without leading '+' or symbols
 * E.g. '+91 96962-62007' -> '919696262007'
 */
export function cleanPhoneNumber(rawPhone: string): string {
  if (!rawPhone) return '';
  // Remove any WhatsApp JID suffixes if passed
  const noJid = rawPhone.replace(/@.*$/, '');
  const digits = noJid.replace(/\D/g, '');
  return digits;
}

function toBotObjectId(botId: string): mongoose.Types.ObjectId | string {
  return mongoose.Types.ObjectId.isValid(botId) ? new mongoose.Types.ObjectId(botId) : botId;
}

/**
 * Send an outbound text message via Meta WhatsApp Cloud API
 */
export async function sendMetaTextMessage(
  toNumber: string,
  bodyText: string,
  contextMessageId?: string
): Promise<{ ok: boolean; messageId?: string; error?: string; raw?: any }> {
  const token = getMetaToken();
  const phoneNumberId = getMetaPhoneNumberId();

  if (!token || !phoneNumberId) {
    return {
      ok: false,
      error: 'Meta WhatsApp Cloud API credentials missing (META_WHATSAPP_TOKEN or META_PHONE_NUMBER_ID)',
    };
  }

  const cleanTo = cleanPhoneNumber(toNumber);
  if (!cleanTo || cleanTo.length < 8) {
    return { ok: false, error: `Invalid recipient phone number: "${toNumber}"` };
  }

  const url = `https://graph.facebook.com/${META_GRAPH_VERSION}/${phoneNumberId}/messages`;

  const payload: any = {
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to: cleanTo,
    type: 'text',
    text: {
      preview_url: false,
      body: bodyText,
    },
  };

  if (contextMessageId) {
    payload.context = {
      message_id: contextMessageId,
    };
  }

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      const errMsg =
        data?.error?.message ||
        data?.error?.error_data?.details ||
        `Meta API HTTP ${res.status}`;
      console.warn(`[Meta Cloud WhatsApp] Send error to ${cleanTo}:`, errMsg);
      return { ok: false, error: errMsg, raw: data };
    }

    const messageId = data?.messages?.[0]?.id || '';
    console.log(`[Meta Cloud WhatsApp] Message sent to ${cleanTo} (msgId: ${messageId})`);
    return { ok: true, messageId, raw: data };
  } catch (err: any) {
    console.error('[Meta Cloud WhatsApp] Network failure sending message:', err);
    return { ok: false, error: err?.message || 'Network error reaching Meta Cloud API' };
  }
}

/**
 * Send a Live Agent Support Alert to Website Owner via Meta WhatsApp Cloud API
 */
export async function sendMetaTicketAlert(params: {
  ticketId: string;
  botName: string;
  visitorName?: string;
  visitorEmail?: string;
  visitorPhone?: string;
  userMessage?: string;
  targetNumber: string;
}): Promise<{ ok: boolean; messageId?: string; error?: string }> {
  const {
    ticketId,
    botName,
    visitorName,
    visitorEmail,
    visitorPhone,
    userMessage,
    targetNumber,
  } = params;

  const formattedMessage =
    `🔴 *New Support Request* [Ticket: #${ticketId}]\n` +
    `━━━━━━━━━━━━━━━━━━━\n` +
    `*Bot:* ${botName || 'Rivafy Assistant'}\n` +
    `*Visitor:* ${visitorName || 'Website Visitor'}` +
    (visitorEmail ? ` (${visitorEmail})` : '') +
    (visitorPhone ? ` [${visitorPhone}]` : '') +
    `\n\n` +
    `💬 *Visitor message:*\n"${userMessage || 'Human assistance requested'}"\n\n` +
    `━━━━━━━━━━━━━━━━━━━\n` +
    `👉 *To Reply:* Quote-reply to this message, or type your reply directly!\n` +
    `👉 *To Close:* Reply /close`;

  const cleanTarget = cleanPhoneNumber(targetNumber);
  const result = await sendMetaTextMessage(cleanTarget, formattedMessage);

  if (result.ok) {
    try {
      await connectToDatabase();
      if (!isUsingMemoryDb()) {
        await ChatTicket.updateOne(
          { ticketId },
          {
            $set: {
              alertMessageId: result.messageId || '',
              assignedAdminJid: cleanTarget,
            },
          }
        );
      }
    } catch (dbErr) {
      console.warn('[Meta Cloud WhatsApp] Warning saving alertMessageId on ChatTicket:', dbErr);
    }
  }

  return result;
}

/**
 * Handle incoming Meta WhatsApp Cloud API Webhook Event (POST)
 */
export async function handleMetaIncomingWebhook(payload: any): Promise<{
  processed: number;
  results: Array<{ from: string; status: string; ticketId?: string }>;
}> {
  const results: Array<{ from: string; status: string; ticketId?: string }> = [];

  if (!payload || payload.object !== 'whatsapp_business_account') {
    return { processed: 0, results };
  }

  const entries = Array.isArray(payload.entry) ? payload.entry : [];
  for (const entry of entries) {
    const changes = Array.isArray(entry.changes) ? entry.changes : [];
    for (const change of changes) {
      const value = change?.value;
      if (!value) continue;

      const messages = Array.isArray(value.messages) ? value.messages : [];
      for (const msg of messages) {
        try {
          const from = cleanPhoneNumber(msg.from || '');
          const messageId = msg.id || '';

          // Extract message text content
          let rawText = '';
          if (msg.type === 'text' && msg.text?.body) {
            rawText = msg.text.body;
          } else if (msg.type === 'interactive') {
            rawText =
              msg.interactive?.button_reply?.title ||
              msg.interactive?.list_reply?.title ||
              '';
          } else if (msg.type === 'button' && msg.button?.text) {
            rawText = msg.button.text;
          }

          const cleanText = (rawText || '').trim();
          if (!cleanText || !from) continue;

          // Prevent echo loops: ignore automated system alerts
          if (
            cleanText.includes('🔴 *New Support Request*') ||
            cleanText.includes('New Support Request [Ticket:') ||
            cleanText.includes('✅ *Ticket #') ||
            cleanText.includes('✅ *Sent to Visitor Chat*') ||
            cleanText.includes('👉 _Reply to visitor:') ||
            cleanText.includes('👉 *Reply to visitor:*') ||
            cleanText.includes('👉 *To Reply:*') ||
            cleanText.includes('👉 *To Close:*') ||
            cleanText.includes('Visitor is seeing this live in the website chat') ||
            cleanText.includes('Visitor chat has been restored to AI auto-reply mode')
          ) {
            continue;
          }

          const contextMessageId = msg.context?.id || '';

          // Strategy 1: Explicit ticket ID in message text (#TICK-XXXX)
          let ticketId = extractTicketId(cleanText);

          await connectToDatabase();
          let ticket: any = null;

          if (ticketId && !isUsingMemoryDb()) {
            ticket = await ChatTicket.findOne({ ticketId });
          }

          // Strategy 2: Quoted WhatsApp message matches alertMessageId
          if (!ticket && contextMessageId && !isUsingMemoryDb()) {
            ticket = await ChatTicket.findOne({ alertMessageId: contextMessageId });
            if (ticket) {
              ticketId = ticket.ticketId;
            }
          }

          // Strategy 3: Match Website Owner's phone number!
          // When the Website Owner replies directly to the WhatsApp alert, their sender phone matches assignedAdminJid.
          if (!ticket && from.length >= 7 && !isUsingMemoryDb()) {
            const last10 = from.slice(-10);
            ticket = await ChatTicket.findOne({
              status: { $in: ['waiting_admin', 'open', 'admin_replied'] },
              $or: [
                { assignedAdminJid: from },
                { assignedAdminJid: `+${from}` },
                { assignedAdminJid: { $regex: last10 } },
              ],
            }).sort({ updatedAt: -1 });

            if (ticket) {
              ticketId = ticket.ticketId;
            }
          }

          if (!ticket) {
            console.log(
              `[Meta Cloud WhatsApp] Inbound message from ${from} did not match any active ticket: "${cleanText.slice(0, 50)}"`
            );
            results.push({ from, status: 'no_ticket_match' });
            continue;
          }

          // Check if Website Owner wants to close the ticket
          const isCloseCommand =
            cleanText.toLowerCase() === '/close' ||
            cleanText.toLowerCase() === 'close' ||
            cleanText.toLowerCase().includes('/close') ||
            cleanText.toLowerCase() === `#${ticket.ticketId.toLowerCase()} /close`;

          if (isCloseCommand) {
            ticket.status = 'closed';
            ticket.closedAt = new Date();
            ticket.messages.push({
              id: crypto.randomUUID(),
              role: 'system',
              senderName: 'System',
              content: 'Support agent closed this ticket from WhatsApp. AI assistant resumed.',
              timestamp: new Date(),
            });
            await ticket.save();

            if (!isUsingMemoryDb() && ticket.sessionId) {
              await Conversation.updateMany(
                {
                  $or: [
                    { sessionId: ticket.sessionId },
                    { botId: toBotObjectId(String(ticket.botId)), sessionId: ticket.sessionId },
                  ],
                },
                {
                  $set: {
                    status: 'resolved',
                    lastMessageAt: new Date(),
                  },
                  $push: {
                    messages: {
                      role: 'system',
                      content: 'Support agent closed this session via WhatsApp. AI assistant resumed.',
                      timestamp: new Date(),
                    },
                  },
                }
              );
            }

            await appendConversationMessage(String(ticket.botId), ticket.sessionId, {
              role: 'system',
              content: 'Support agent closed this session via WhatsApp. AI assistant resumed.',
            });

            // Emit close notice to visitor's active SSE stream
            handoffEventEmitter.emit(`message:${ticket.sessionId}`, {
              role: 'system',
              content: 'Support agent closed this session. AI assistant resumed.',
              senderName: 'System',
              timestamp: new Date(),
            });

            // Send confirmation back to Website Owner
            await sendMetaTextMessage(
              from,
              `✅ *Ticket #${ticket.ticketId} Closed*\nVisitor chat has been restored to AI auto-reply mode.`
            );

            results.push({ from, status: 'ticket_closed', ticketId: ticket.ticketId });
            continue;
          }

          // Normal reply from Website Owner to Visitor
          let replyContent = cleanText;
          const prefixRegex = new RegExp(`^#?${ticket.ticketId}\\s*[-:]*\\s*`, 'i');
          replyContent = replyContent.replace(prefixRegex, '').trim() || cleanText;

          const agentSenderName = ticket.botName || 'Support Agent';
          const now = new Date();
          const agentMsgId = crypto.randomUUID();

          ticket.status = 'admin_replied';
          ticket.lastAdminReply = replyContent;
          ticket.messages.push({
            id: agentMsgId,
            role: 'agent',
            senderName: agentSenderName,
            content: replyContent,
            timestamp: now,
          });

          // 1. Immediately emit live SSE event for instant widget display
          if (ticket.sessionId) {
            handoffEventEmitter.emit(`message:${ticket.sessionId}`, {
              role: 'agent',
              content: replyContent,
              senderName: agentSenderName,
              timestamp: now,
            });
          }

          // 2. Parallelize DB updates
          await Promise.all([
            ticket.save(),
            appendConversationMessage(String(ticket.botId), ticket.sessionId, {
              role: 'agent',
              senderName: agentSenderName,
              content: replyContent,
            }),
            !isUsingMemoryDb() && ticket.sessionId
              ? Conversation.updateMany(
                  {
                    $or: [
                      { sessionId: ticket.sessionId },
                      { botId: toBotObjectId(String(ticket.botId)), sessionId: ticket.sessionId },
                    ],
                  },
                  {
                    $set: {
                      status: 'agent_active',
                      lastMessageAt: now,
                    },
                  }
                )
              : Promise.resolve(),
          ]);

          console.log(
            `[Meta Cloud WhatsApp] Delivered reply to Visitor (ticket=${ticket.ticketId}, bot=${ticket.botId}, session=${ticket.sessionId})`
          );

          // 3. Send Delivery ACK back to Website Owner on WhatsApp
          await sendMetaTextMessage(
            from,
            `✅ *Sent to Visitor Chat*\n` +
            `"${replyContent.slice(0, 100)}${replyContent.length > 100 ? '...' : ''}"\n\n` +
            `👉 Reply again anytime to send more.\n` +
            `👉 Reply */close* when done.`
          );

          results.push({ from, status: 'reply_delivered', ticketId: ticket.ticketId });
        } catch (msgErr: any) {
          console.error('[Meta Cloud WhatsApp] Error processing webhook message:', msgErr);
        }
      }
    }
  }

  return { processed: results.length, results };
}
