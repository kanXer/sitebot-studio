import * as cheerio from 'cheerio';

export interface QuickLink {
  label: string;
  url: string;
}

export interface SiteIdentity {
  brandName: string;
  description: string;
  brandColor?: string;
  phone?: string;
  whatsapp?: string;
  email?: string;
  quickLinks?: QuickLink[];
  keyTopics: string[];
}

export interface ScrapedPage {
  url: string;
  title: string;
  text: string;
  rawHtml?: string;
}

const IGNORED_EXTENSIONS = new Set([
  '.png', '.jpg', '.jpeg', '.gif', '.svg', '.webp', '.ico', '.bmp', '.tiff',
  '.pdf', '.doc', '.docx', '.ppt', '.pptx', '.xls', '.xlsx',
  '.zip', '.tar', '.gz', '.rar', '.7z',
  '.mp3', '.mp4', '.wav', '.avi', '.mov', '.webm',
  '.css', '.js', '.json', '.xml', '.rss', '.atom',
]);

export function normalizeUrl(rawUrl: string, baseUrl: string): string | null {
  try {
    let cleanRaw = rawUrl.trim();
    if (!cleanRaw || cleanRaw.startsWith('javascript:') || cleanRaw.startsWith('mailto:') || cleanRaw.startsWith('tel:')) {
      return null;
    }

    const parsed = new URL(cleanRaw, baseUrl);
    const base = new URL(baseUrl);

    // Allow same domain (handling www. and non-www interchangeably)
    const parsedHost = parsed.hostname.toLowerCase().replace(/^www\./, '');
    const baseHost = base.hostname.toLowerCase().replace(/^www\./, '');
    if (parsedHost !== baseHost) {
      return null;
    }

    // Filter non-http/https
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      return null;
    }

    // Filter file extensions
    const pathname = parsed.pathname.toLowerCase();
    for (const ext of IGNORED_EXTENSIONS) {
      if (pathname.endsWith(ext)) {
        return null;
      }
    }

    // Strip hash and common marketing query parameters
    parsed.hash = '';
    const searchParams = new URLSearchParams(parsed.search);
    const trackingParams = [
      'utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content',
      'ref', 'source', 'fbclid', 'gclid', 'msclkid', 'mc_cid', 'mc_eid',
    ];
    for (const param of trackingParams) {
      searchParams.delete(param);
    }
    parsed.search = searchParams.toString();

    // Remove trailing slash for consistency (unless it's just root path '/')
    let finalUrl = parsed.toString();
    if (finalUrl.endsWith('/') && parsed.pathname !== '/') {
      finalUrl = finalUrl.slice(0, -1);
    }

    return finalUrl;
  } catch {
    return null;
  }
}

export function cleanHtmlToText(html: string): { title: string; text: string } {
  const $ = cheerio.load(html);

  // Extract page title
  let title = $('title').text().trim();
  if (!title) {
    title = $('meta[property="og:title"]').attr('content')?.trim() || '';
  }
  if (!title) {
    title = $('h1').first().text().trim() || 'Untitled Page';
  }

  // Extract structured JSON-LD data (crucial for modern SSR, Next.js, and schema FAQs)
  const structuredSnippets: string[] = [];
  $('script[type="application/ld+json"]').each((_, el) => {
    try {
      const parsed = JSON.parse($(el).text());
      const items = Array.isArray(parsed) ? parsed : [parsed];
      for (const item of items) {
        if (!item) continue;
        // FAQ Page schemas
        if (item['@type'] === 'FAQPage' && Array.isArray(item.mainEntity)) {
          for (const q of item.mainEntity) {
            if (q?.name && q?.acceptedAnswer?.text) {
              structuredSnippets.push(`Q: ${q.name}\nA: ${q.acceptedAnswer.text}`);
            }
          }
        }
        // Organization / LocalBusiness / Service description
        if (item.description && typeof item.description === 'string' && item.description.length > 30) {
          structuredSnippets.push(item.description);
        }
      }
    } catch {
      // Ignore malformed JSON-LD
    }
  });

  // Remove noisy and non-content elements
  $(
    'script, style, noscript, svg, iframe, form, button, ' +
    'input, textarea, select, .cookie-banner, .popup, .modal, [role="dialog"], ' +
    '[aria-hidden="true"], link, meta'
  ).remove();

  // Target main content container if rich, else fallback to full body for streaming SSR / React 18+
  let contentEl = $('main');
  if (contentEl.length === 0 || contentEl.text().replace(/\s+/g, ' ').trim().length < 150) {
    contentEl = $('article');
  }
  if (contentEl.length === 0 || contentEl.text().replace(/\s+/g, ' ').trim().length < 150) {
    contentEl = $('#content, .content, #main, .main');
  }
  if (contentEl.length === 0 || contentEl.text().replace(/\s+/g, ' ').trim().length < 150) {
    contentEl = $('body');
  }

  // Replace block elements with newline to preserve sentence boundaries
  contentEl.find('p, h1, h2, h3, h4, h5, h6, li, tr, div, section, article').each((_, el) => {
    $(el).append('\n');
  });

  let rawText = contentEl.text();

  // Append structured data if available
  if (structuredSnippets.length > 0) {
    rawText += '\n\n' + structuredSnippets.join('\n\n');
  }

  // Normalize whitespace: collapse multiple spaces and newlines
  let text = rawText
    .replace(/[ \t]+/g, ' ')
    .replace(/(\n\s*){2,}/g, '\n\n')
    .trim();

  // Clean common SSR suspense loading fallbacks
  text = text.replace(/^(\s*Loading…?\s*)+/i, '').trim();

  return { title, text };
}

export async function crawlWebsite(
  startUrl: string,
  maxPages = 15,
  maxDepth = 2
): Promise<ScrapedPage[]> {
  let cleanStart = startUrl.trim();
  if (!cleanStart.startsWith('http://') && !cleanStart.startsWith('https://')) {
    cleanStart = 'https://' + cleanStart;
  }

  const normalizedStart = normalizeUrl(cleanStart, cleanStart);
  if (!normalizedStart) {
    throw new Error('Invalid start URL provided for crawler');
  }

  const visited = new Set<string>();
  const queue: Array<{ url: string; depth: number }> = [{ url: normalizedStart, depth: 0 }];
  const results: ScrapedPage[] = [];

  while (queue.length > 0 && results.length < maxPages) {
    const item = queue.shift();
    if (!item) break;

    const { url, depth } = item;
    if (visited.has(url)) continue;
    visited.add(url);

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 12000);

      const response = await fetch(url, {
        signal: controller.signal,
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
          Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.9',
        },
      });
      clearTimeout(timeoutId);

      if (!response.ok) {
        continue;
      }

      const contentType = response.headers.get('content-type') || '';
      if (!contentType.includes('text/html')) {
        continue;
      }

      const html = await response.text();
      const { title, text } = cleanHtmlToText(html);

      if (text.length > 50) {
        results.push({
          url,
          title,
          text,
          rawHtml: html,
        });
      }

      // Discover internal links if depth < maxDepth
      if (depth < maxDepth && results.length < maxPages) {
        const $ = cheerio.load(html);
        const links: string[] = [];

        $('a[href]').each((_, el) => {
          const href = $(el).attr('href');
          if (href) {
            const nextUrl = normalizeUrl(href, url);
            if (nextUrl && !visited.has(nextUrl) && !links.includes(nextUrl)) {
              links.push(nextUrl);
            }
          }
        });

        for (const link of links) {
          if (!visited.has(link) && queue.length + results.length < maxPages * 2) {
            queue.push({ url: link, depth: depth + 1 });
          }
        }
      }
    } catch {
      // Gracefully continue crawling other pages if one page times out or fails
      continue;
    }
  }

  return results;
}

/**
 * Decodes Cloudflare email obfuscation (data-cfemail / __cf_email__)
 */
export function decodeCloudflareEmail(encoded: string): string {
  try {
    let email = '';
    const r = parseInt(encoded.substr(0, 2), 16);
    for (let n = 2; n < encoded.length; n += 2) {
      const c = parseInt(encoded.substr(n, 2), 16) ^ r;
      email += String.fromCharCode(c);
    }
    return email.trim();
  } catch {
    return '';
  }
}

/**
 * Normalizes, decodes, and validates candidate email strings
 */
export function normalizeEmail(raw: string): string | null {
  if (!raw || typeof raw !== 'string') return null;
  let cleaned = raw
    .trim()
    .replace(/^mailto:/i, '')
    .split('?')[0]
    .replace(/^[<(\["'\s]+|[>)"'\s\].,;:]+$/g, '')
    .trim();

  try {
    cleaned = decodeURIComponent(cleaned);
  } catch {}

  // If email was concatenated with sentence continuation e.g. domain.com.random or site.org.please
  const trailingContinuationMatch = cleaned.match(/^([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.(?:com|org|net|edu|gov|io|ai|app|dev|tech|info|biz|me))\.[a-zA-Z]{2,24}$/i);
  if (trailingContinuationMatch) {
    cleaned = trailingContinuationMatch[1];
  }

  const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,24}$/;
  if (!emailRegex.test(cleaned)) return null;

  // Filter static assets, fonts, placeholders
  if (/\.(png|jpe?g|gif|webp|svg|ico|css|js|json|woff2?|ttf)$/i.test(cleaned)) return null;
  if (/(example\.com|domain\.com|yourdomain\.com|test\.com|email\.com)$/i.test(cleaned)) return null;
  if (/@2x$/i.test(cleaned)) return null;
  if (/^(sentry|wixpress|gravatar|git@|npm@)/i.test(cleaned)) return null;

  return cleaned.toLowerCase();
}

/**
 * Robust multi-strategy email extractor from raw HTML.
 * Handles Cloudflare data-cfemail, mailto links, JSON-LD schema, meta tags,
 * microdata, obfuscations (e.g. user [at] site [dot] com), and ranked scoring.
 */
export function extractEmailsFromHtml(html: string, siteUrl?: string): string[] {
  if (!html) return [];
  const $ = cheerio.load(html);
  // Ensure block tags have spaces so cheerio text extraction doesn't glue words across tags
  $('p, div, br, li, h1, h2, h3, h4, h5, h6, tr, td, th, section, article, header, footer').after(' ');
  const candidates = new Set<string>();

  // 1. Cloudflare protected email decoding
  $('[data-cfemail], .__cf_email__').each((_, el) => {
    const cfData = $(el).attr('data-cfemail') || $(el).attr('href')?.split('#')[1];
    if (cfData) {
      const decoded = decodeCloudflareEmail(cfData);
      const norm = normalizeEmail(decoded);
      if (norm) candidates.add(norm);
    }
  });

  // 2. Mailto links (case-insensitive, handles whitespace and nested text)
  $('a[href]').each((_, el) => {
    const href = $(el).attr('href')?.trim() || '';
    if (/^mailto:/i.test(href)) {
      const norm = normalizeEmail(href);
      if (norm) candidates.add(norm);
    }
    const text = $(el).text().trim();
    if (text.includes('@')) {
      const norm = normalizeEmail(text);
      if (norm) candidates.add(norm);
    }
  });

  // 3. Structured Data: JSON-LD schemas (<script type="application/ld+json">)
  $('script[type="application/ld+json"]').each((_, el) => {
    try {
      const text = $(el).html() || '';
      const data = JSON.parse(text);
      const scanObj = (obj: any) => {
        if (!obj || typeof obj !== 'object') return;
        if (typeof obj.email === 'string') {
          const norm = normalizeEmail(obj.email);
          if (norm) candidates.add(norm);
        }
        for (const val of Object.values(obj)) {
          if (typeof val === 'object') scanObj(val);
        }
      };
      if (Array.isArray(data)) data.forEach(scanObj);
      else scanObj(data);
    } catch {}
  });

  // 4. Meta tags (og:email, email, business:contact_data:email)
  $('meta[property*="email"], meta[name*="email"], meta[property*="contact"], meta[name*="contact"]').each((_, el) => {
    const content = $(el).attr('content');
    if (content && content.includes('@')) {
      const norm = normalizeEmail(content);
      if (norm) candidates.add(norm);
    }
  });

  // 5. Microdata: [itemprop="email"]
  $('[itemprop="email"]').each((_, el) => {
    const content = $(el).attr('content') || $(el).text() || $(el).attr('href');
    if (content) {
      const norm = normalizeEmail(content);
      if (norm) candidates.add(norm);
    }
  });

  // 6. Common contact containers (header, footer, .contact, #contact, .about)
  const contactSections = $('footer, header, .footer, .header, #footer, #header, [class*="contact"], [id*="contact"], [class*="about"], [id*="about"]').text();
  const contactMatches = contactSections.match(/\b[a-zA-Z0-9._%+-]+@(?:[a-zA-Z0-9-]+\.)+[a-zA-Z]{2,24}\b/g) || [];
  for (const m of contactMatches) {
    const norm = normalizeEmail(m);
    if (norm) candidates.add(norm);
  }

  // 7. Obfuscated patterns in full text (e.g. info [at] domain.com or info(at)domain.com or user at domain dot com)
  const fullText = $('body').text().replace(/\u00a0/g, ' ');
  const bracketPattern = /\b([a-zA-Z0-9._%+-]+)\s*(?:\[at\]|\(at\)|\{at\})\s*([a-zA-Z0-9-]+(?:\.[a-zA-Z0-9-]+)*)\s*(?:\[dot\]|\(dot\)|\{dot\}|\.)\s*([a-zA-Z]{2,24})\b/gi;
  let obMatch: RegExpExecArray | null;
  while ((obMatch = bracketPattern.exec(fullText)) !== null) {
    const reconstructed = `${obMatch[1]}@${obMatch[2]}.${obMatch[3]}`;
    const norm = normalizeEmail(reconstructed);
    if (norm) candidates.add(norm);
  }

  const spelledPattern = /\b([a-zA-Z0-9._%+-]+)\s+at\s+([a-zA-Z0-9-]+(?:\.[a-zA-Z0-9-]+)*)\s+dot\s+([a-zA-Z]{2,24})\b/gi;
  while ((obMatch = spelledPattern.exec(fullText)) !== null) {
    const reconstructed = `${obMatch[1]}@${obMatch[2]}.${obMatch[3]}`;
    const norm = normalizeEmail(reconstructed);
    if (norm) candidates.add(norm);
  }

  // 8. General body text regex
  const allMatches = fullText.match(/\b[a-zA-Z0-9._%+-]+@(?:[a-zA-Z0-9-]+\.)+[a-zA-Z]{2,24}\b/g) || [];
  for (const m of allMatches) {
    const norm = normalizeEmail(m);
    if (norm) candidates.add(norm);
  }

  // 9. Score & Rank candidates
  let siteHostname = '';
  try {
    if (siteUrl) siteHostname = new URL(siteUrl).hostname.replace(/^www\./i, '').toLowerCase();
  } catch {}

  const scored = Array.from(candidates).map((email) => {
    let score = 0;
    const [local, domain] = email.split('@');

    // Matching domain gets major boost
    if (siteHostname && domain && (domain.includes(siteHostname) || siteHostname.includes(domain))) {
      score += 30;
    }

    // High value business prefixes
    const preferredPrefixes = ['contact', 'info', 'support', 'hello', 'help', 'sales', 'team', 'office', 'inquiries', 'admin', 'service', 'booking'];
    if (preferredPrefixes.some((p) => local.toLowerCase().startsWith(p))) {
      score += 20;
    }

    // Deprioritize generic / no-reply prefixes
    const badPrefixes = ['noreply', 'no-reply', 'donotreply', 'privacy', 'abuse', 'webmaster', 'security', 'postmaster'];
    if (badPrefixes.some((p) => local.toLowerCase().startsWith(p))) {
      score -= 30;
    }

    // Deprioritize common free email providers if domain-specific emails exist
    if (['gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com'].includes(domain)) {
      score -= 2;
    }

    return { email, score };
  });

  scored.sort((a, b) => b.score - a.score);
  return scored.map((s) => s.email);
}

/**
 * Extracts comprehensive brand identity, contact links, and topic structure from HTML.
 */
export function extractSiteIdentity(html: string, pageUrl: string): SiteIdentity {
  const $ = cheerio.load(html);

  // 1. Identify domain name as baseline fallback
  let domainBase = 'Company';
  try {
    const parsed = new URL(pageUrl);
    const host = parsed.hostname.replace(/^www\./, '');
    const parts = host.split('.');
    if (parts.length > 0) {
      domainBase = parts[0]
        .replace(/[-_]/g, ' ')
        .replace(/\b\w/g, (c) => c.toUpperCase());
    }
  } catch {}

  // 2. OpenGraph site_name and title
  const ogSiteName = $('meta[property="og:site_name"]').attr('content')?.trim() || '';
  const appName = $('meta[name="application-name"]').attr('content')?.trim() || '';
  const ogTitle = $('meta[property="og:title"]').attr('content')?.trim() || '';
  const titleTag = $('title').text().trim();

  let brandName = ogSiteName || appName;

  if (!brandName && (titleTag || ogTitle)) {
    const candidate = titleTag || ogTitle;
    const delimiters = ['|', '—', '–', '-', '•', ':'];
    for (const delim of delimiters) {
      if (candidate.includes(delim)) {
        const segments = candidate.split(delim).map((s) => s.trim()).filter(Boolean);
        if (segments.length >= 2) {
          if (segments[0].length >= 2 && segments[0].length <= 32 && !/^(home|welcome|index)\b/i.test(segments[0])) {
            brandName = segments[0];
            break;
          }
          const last = segments[segments.length - 1];
          if (last.length >= 2 && last.length <= 32 && !/^(home|welcome|index)\b/i.test(last)) {
            brandName = last;
            break;
          }
        }
      }
    }
  }

  if (!brandName) {
    brandName = domainBase;
  }

  brandName = brandName.replace(/\s+/g, ' ').trim();
  if (brandName.length > 35) {
    brandName = brandName.slice(0, 35).trim();
  }

  // 3. Description
  let description =
    $('meta[name="description"]').attr('content')?.trim() ||
    $('meta[property="og:description"]').attr('content')?.trim() ||
    $('meta[name="twitter:description"]').attr('content')?.trim() ||
    '';

  if (!description) {
    const firstP = $('main p, article p, #content p, body p')
      .first()
      .text()
      .replace(/\s+/g, ' ')
      .trim();
    if (firstP.length > 40) {
      description = firstP.slice(0, 300);
    }
  }

  // 4. Contact Numbers (tel: links)
  let phone: string | undefined;
  $('a[href^="tel:"]').each((_, el) => {
    if (phone) return;
    const raw = $(el).attr('href')?.replace('tel:', '').trim();
    if (raw && raw.length >= 7) {
      phone = raw;
    }
  });

  // 5. WhatsApp
  let whatsapp: string | undefined;
  $('a[href*="wa.me"], a[href*="whatsapp.com"]').each((_, el) => {
    if (whatsapp) return;
    const raw = $(el).attr('href');
    if (raw) {
      const match = raw.match(/wa\.me\/(\+?\d+)/i) || raw.match(/phone=(\+?\d+)/i);
      if (match && match[1]) {
        whatsapp = match[1];
      } else {
        whatsapp = raw;
      }
    }
  });
  if (!whatsapp && phone) {
    whatsapp = phone;
  }

  // 6. Email (Multi-strategy extraction: Cloudflare, mailto, JSON-LD, meta, obfuscated, and body text)
  const extractedEmails = extractEmailsFromHtml(html, pageUrl);
  const email: string | undefined = extractedEmails.length > 0 ? extractedEmails[0] : undefined;

  // 7. Quick Links — discover important navigation endpoints (contact, about,
  // services, demo/booking, support, careers, etc.) as named quick links so the
  // user can keep or remove them in settings. Pricing & Audit are intentionally
  // excluded since they are no longer surfaced as fixed buttons.
  const quickLinks: QuickLink[] = [];
  const seenQuickLinks = new Set<string>();
  const QUICK_LINK_PATTERNS: Array<{ re: RegExp; label: string }> = [
    { re: /contact/i, label: 'Contact Us' },
    { re: /about/i, label: 'About Us' },
    { re: /service/i, label: 'Our Services' },
    { re: /product/i, label: 'Our Products' },
    { re: /book|demo|appointment|reserve|schedule|consult/i, label: 'Book a Demo' },
    { re: /faq|help|support/i, label: 'FAQ / Help' },
    { re: /career|job|hiring|join/i, label: 'Careers' },
    { re: /track.*(order|ship|package)|(order|ship|package).*track/i, label: 'Track Order' },
    { re: /review|testimonial/i, label: 'Reviews' },
    { re: /location|store|visit|directions/i, label: 'Our Locations' },
    { re: /gallery|portfolio|case-?stud|our-?work/i, label: 'Our Work' },
    { re: /blog|news|article|resource/i, label: 'Blog & Updates' },
    { re: /membership|login|sign( ?-| ?in|\s*up)|register/i, label: 'Member Login' },
    { re: /terms|privacy|cookie|refund|shipping/i, label: 'Policies' },
  ];

  $('nav a[href], header a[href], footer a[href], a[href]').each((_, el) => {
    const rawHref = $(el).attr('href') || '';
    if (!rawHref || rawHref.startsWith('#') || rawHref.startsWith('mailto:') || rawHref.startsWith('tel:')) return;
    const text = $(el).text().replace(/\s+/g, ' ').trim();
    const combined = `${text} ${rawHref}`.toLowerCase();
    if (quickLinks.length >= 8) return false;

    for (const { re, label } of QUICK_LINK_PATTERNS) {
      if (
        re.test(combined) &&
        !/^(home|index|welcome)\b/i.test(text) &&
        !/privacy|terms|cookie|login|sign-?in/i.test(text) &&
        !seenQuickLinks.has(label)
      ) {
        let url: string;
        try {
          url = new URL(rawHref, pageUrl).toString();
        } catch {
          url = rawHref;
        }
        quickLinks.push({ label, url });
        seenQuickLinks.add(label);
        break;
      }
    }
  });

  // 8. Key Topics / Service Headings
  const keyTopics: string[] = [];
  const seenTopics = new Set<string>();

  $('h1, h2, h3, nav a, .service, .service-title').each((_, el) => {
    const text = $(el).text().replace(/\s+/g, ' ').trim();
    const lower = text.toLowerCase();
    if (
      text.length >= 4 &&
      text.length <= 60 &&
      !seenTopics.has(lower) &&
      !/^(menu|navigation|footer|header|home|contact|about|privacy|terms|cookie|sign in|login|get started)$/i.test(lower)
    ) {
      seenTopics.add(lower);
      keyTopics.push(text);
    }
  });

  return {
    brandName,
    description,
    phone,
    whatsapp,
    email,
    quickLinks: quickLinks,
    keyTopics: keyTopics.slice(0, 10),
    brandColor: (() => {
      const tc = $('meta[name="theme-color"], meta[name="msapplication-TileColor"]').attr('content')?.trim();
      if (tc && /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(tc)) return tc;
      return undefined;
    })(),
  };
}
