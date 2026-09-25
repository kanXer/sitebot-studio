/**
 * Client-safe runtime chat tag parser.
 *
 * Kept separate from bot-builder.ts (which imports Mongo at module top) so
 * client components like ChatWidget can import it without dragging the whole
 * server/DB pipeline into the browser bundle.
 */

export interface ParsedChatTags {
  cleanText: string;
  handoffReason?: string;
  handoffActive?: string;
  leadCaptured?: string;
  guardrailBlocked?: string;
  isUngroundedFallback?: boolean;
  tags: string[];
}

/**
 * Parses and extracts runtime chat control tags from an assistant response
 * while returning clean, human-readable text for display.
 */
export function parseRuntimeTags(text: string): ParsedChatTags {
  if (!text) {
    return { cleanText: '', tags: [] };
  }

  const tags: string[] = [];
  let handoffReason: string | undefined;
  let handoffActive: string | undefined;
  let leadCaptured: string | undefined;
  let guardrailBlocked: string | undefined;
  let isUngroundedFallback = false;

  const handoffMatch = text.match(/\[\[HANDOFF:\s*([^\]]+)\]\]/i);
  if (handoffMatch) {
    handoffReason = handoffMatch[1].trim();
    tags.push(`HANDOFF: ${handoffReason}`);
  }

  const activeMatch = text.match(/\[\[HANDOFF_ACTIVE:\s*([^\]]+)\]\]/i);
  if (activeMatch) {
    handoffActive = activeMatch[1].trim();
    tags.push(`HANDOFF_ACTIVE: ${handoffActive}`);
  }

  const leadMatch = text.match(/\[\[LEAD_CAPTURED:\s*([^\]]+)\]\]/i);
  if (leadMatch) {
    leadCaptured = leadMatch[1].trim();
    tags.push(`LEAD_CAPTURED: ${leadCaptured}`);
  }

  const guardrailMatch = text.match(/\[\[GUARDRAIL_BLOCKED:\s*([^\]]+)\]\]/i);
  if (guardrailMatch) {
    guardrailBlocked = guardrailMatch[1].trim();
    tags.push(`GUARDRAIL_BLOCKED: ${guardrailBlocked}`);
  }

  if (/\[\[UNGROUNDED_FALLBACK\]\]/i.test(text)) {
    isUngroundedFallback = true;
    tags.push('UNGROUNDED_FALLBACK');
  }

  const cleanText = text
    .replace(/\[\[(HANDOFF|HANDOFF_ACTIVE|LEAD_CAPTURED|GUARDRAIL_BLOCKED)[^\]]*\]\]/gi, '')
    .replace(/\[\[UNGROUNDED_FALLBACK\]\]/gi, '')
    .trim();

  return {
    cleanText,
    handoffReason,
    handoffActive,
    leadCaptured,
    guardrailBlocked,
    isUngroundedFallback,
    tags,
  };
}
