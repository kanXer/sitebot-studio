/**
 * CORS / origin allow-listing helpers for the public widget APIs.
 * Requests are only accepted from non-browser clients (no Origin header),
 * the Studio preview, the chatbot's saved website domain, or explicitly
 * configured allowed origins.
 */

export function normalizeHost(input: string): string {
  let host = (input || '').trim().toLowerCase();
  if (!host) return '';
  host = host.replace(/^https?:\/\//, '');
  host = host.replace(/^www\./, '');
  host = host.split('/')[0];
  host = host.split('?')[0];
  host = host.replace(/:\d+$/, '');
  return host.trim();
}

export function parseAllowedOrigins(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map((v) => String(v).trim()).filter(Boolean);
  }
  if (typeof value === 'string') {
    return value
      .split(/[,\n]/)
      .map((v) => v.trim())
      .filter(Boolean);
  }
  return [];
}

/**
 * Decides whether an incoming request from `origin` is permitted for the bot.
 * - No Origin header (curl, server-to-server) -> allowed.
 * - Studio preview (same-origin demo/embedded dashboard) -> allowed.
 * - Origin hostname matches the bot's saved website -> allowed.
 * - Origin hostname appears in bot.allowedOrigins -> allowed.
 * - bot.allowedOrigins contains "*" -> all allowed.
 */
export function isOriginAllowed(
  bot: { siteUrl?: string; allowedOrigins?: unknown },
  origin: string | null,
  options: { isStudioPreview?: boolean } = {}
): boolean {
  if (!origin) return true;
  if (options.isStudioPreview) return true;

  const originHost = normalizeHost(origin);
  if (!originHost) return false;

  if (bot.siteUrl && normalizeHost(bot.siteUrl) === originHost) {
    return true;
  }

  const allowed = parseAllowedOrigins(bot.allowedOrigins);
  if (allowed.includes('*')) return true;

  for (const entry of allowed) {
    if (normalizeHost(entry) === originHost) {
      return true;
    }
  }

  return false;
}