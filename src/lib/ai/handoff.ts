/**
 * Live Handoff System
 * Manages human agent escalation, live chat routing, intent detection,
 * and conversation session states.
 */

import mongoose from 'mongoose';
import { Conversation, IConversation, IConversationMessage } from '@/lib/models/Conversation';
import { isUsingMemoryDb } from '@/lib/db';
import { MemoryDb, MemoryConversation } from '@/lib/memoryDb';

export interface HandoffDetectionResult {
  shouldHandoff: boolean;
  reason?: 'visitor_request' | 'frustration_detected' | 'low_confidence' | 'manual';
  confidence: number;
}

// Phrases indicating visitor specifically wants human interaction
const EXPLICIT_HUMAN_TRIGGERS: RegExp[] = [
  /\b(talk|speak)\s+to\s+(a\s+)?(live\s+|real\s+)?(human|person|agent|representative|operator|someone\s+else)\b/i,
  /\b(transfer|connect)\s+(me\s+)?to\s+(a\s+)?(live\s+|real\s+)?(human|agent|person|representative|support)\b/i,
  /\b(i\s+want|need|get\s+me)\s+(to\s+talk\s+to\s+)?(a\s+)?(live\s+|real\s+)?(human|real\s+person|live\s+agent|support\s+person|representative)\b/i,
  /\b(live\s+agent|human\s+support|human\s+help|real\s+human|live\s+human)\b/i,
  /\b(call\s+an\s+agent|operator\s+please)\b/i,
];

// Phrases indicating user frustration or dissatisfaction with AI
const FRUSTRATION_TRIGGERS: RegExp[] = [
  /\b(you('re|\s+are)\s+(useless|stupid|terrible|bad|wrong|unhelpful|broken|horrible))\b/i,
  /\b(this\s+(bot|ai|chat|system)?\s+is\s+(useless|stupid|terrible|bad|wrong|unhelpful|broken|ridiculous|annoying|frustrating|not\s+helping|garbage|awful))\b/i,
  /\b(stop\s+repeating(\s+yourself)?)\b/i,
  /\b(you\s+(don't|do\s+not)\s+understand)\b/i,
  /\b(let\s+me\s+speak\s+with\s+(a\s+)?(manager|supervisor))\b/i,
  /\b(useless|terrible|horrible|broken)\s+(bot|ai|chat)\b/i,
];

/**
 * Detects if a message or conversational tone triggers human handoff
 */
export function detectHandoffIntent(userMessage: string): HandoffDetectionResult {
  const clean = (userMessage || '').trim();
  if (!clean) return { shouldHandoff: false, confidence: 0 };

  for (const trigger of EXPLICIT_HUMAN_TRIGGERS) {
    if (trigger.test(clean)) {
      return {
        shouldHandoff: true,
        reason: 'visitor_request',
        confidence: 0.95,
      };
    }
  }

  for (const trigger of FRUSTRATION_TRIGGERS) {
    if (trigger.test(clean)) {
      return {
        shouldHandoff: true,
        reason: 'frustration_detected',
        confidence: 0.85,
      };
    }
  }

  return { shouldHandoff: false, confidence: 0 };
}

/**
 * Ensures or retrieves the conversation record for a session
 */
function toBotObjectId(botId: string): any {
  return mongoose.Types.ObjectId.isValid(botId) ? new mongoose.Types.ObjectId(botId) : botId;
}

export async function getOrCreateConversation(
  botId: string,
  sessionId: string,
  visitorInfo?: { name?: string; email?: string; phone?: string; ip?: string }
): Promise<any> {
  if (isUsingMemoryDb()) {
    let conv = MemoryDb.findConversation(botId, sessionId);
    if (!conv) {
      conv = MemoryDb.createConversation({
        botId,
        sessionId,
        visitor: visitorInfo || {},
      });
    } else if (visitorInfo) {
      conv.visitor = { ...conv.visitor, ...visitorInfo };
    }
    return conv;
  }

  const botObjectId = toBotObjectId(botId);
  let conv = await Conversation.findOne({ botId: botObjectId, sessionId });

  if (!conv) {
    conv = await Conversation.create({
      botId: botObjectId,
      sessionId,
      visitor: visitorInfo || {},
      status: 'bot',
      messages: [],
    });
  } else if (visitorInfo) {
    if (visitorInfo.name) conv.visitor.name = visitorInfo.name;
    if (visitorInfo.email) conv.visitor.email = visitorInfo.email;
    if (visitorInfo.phone) conv.visitor.phone = visitorInfo.phone;
    await conv.save();
  }

  return conv;
}

/**
 * Records a message to the conversation transcript
 */
export async function appendConversationMessage(
  botId: string,
  sessionId: string,
  message: {
    role: 'user' | 'assistant' | 'agent' | 'system';
    content: string;
    senderName?: string;
  }
) {
  const msgObj: IConversationMessage = {
    id: crypto.randomUUID(),
    role: message.role,
    content: message.content,
    senderName: message.senderName || '',
    timestamp: new Date(),
  };

  if (isUsingMemoryDb()) {
    MemoryDb.addConversationMessage(botId, sessionId, msgObj);
    return;
  }

  const botObjectId = toBotObjectId(botId);
  await Conversation.findOneAndUpdate(
    { botId: botObjectId, sessionId },
    {
      $push: { messages: msgObj },
      $set: { lastMessageAt: new Date() },
    },
    { upsert: true }
  );
}

/**
 * Triggers live human handoff for a session
 */
export async function escalateToLiveAgent(
  botId: string,
  sessionId: string,
  reason: string,
  visitorInfo?: { name?: string; email?: string; phone?: string }
): Promise<any> {
  const conv = await getOrCreateConversation(botId, sessionId, visitorInfo);

  if (isUsingMemoryDb()) {
    return MemoryDb.updateConversationStatus(
      botId,
      sessionId,
      'waiting_agent',
      reason
    );
  }

  const botObjectId = toBotObjectId(botId);
  const updated = await Conversation.findOneAndUpdate(
    { botId: botObjectId, sessionId },
    {
      $set: {
        status: 'waiting_agent',
        handoffReason: reason,
        lastMessageAt: new Date(),
        ...(visitorInfo?.name ? { 'visitor.name': visitorInfo.name } : {}),
        ...(visitorInfo?.email ? { 'visitor.email': visitorInfo.email } : {}),
        ...(visitorInfo?.phone ? { 'visitor.phone': visitorInfo.phone } : {}),
      },
    },
    { new: true }
  );

  return updated;
}

/**
 * Resolves a live conversation, closing handoff and handing back to bot
 */
export async function resolveLiveConversation(botId: string, sessionId: string): Promise<any> {
  if (isUsingMemoryDb()) {
    return MemoryDb.updateConversationStatus(botId, sessionId, 'resolved');
  }

  const botObjectId = toBotObjectId(botId);
  return await Conversation.findOneAndUpdate(
    { botId: botObjectId, sessionId },
    {
      $set: {
        status: 'resolved',
        lastMessageAt: new Date(),
      },
    },
    { new: true }
  );
}

/**
 * Assigns a live agent to the active conversation
 */
export async function assignLiveAgent(
  botId: string,
  sessionId: string,
  agent: { id: string; name: string; email: string }
): Promise<any> {
  if (isUsingMemoryDb()) {
    return MemoryDb.assignConversationAgent(botId, sessionId, agent);
  }

  const botObjectId = toBotObjectId(botId);
  return await Conversation.findOneAndUpdate(
    { botId: botObjectId, sessionId },
    {
      $set: {
        status: 'agent_active',
        assignedAgent: agent,
        lastMessageAt: new Date(),
      },
    },
    { new: true }
  );
}
