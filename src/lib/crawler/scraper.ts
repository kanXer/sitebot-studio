import * as cheerio from 'cheerio';

export interface SiteIdentity {
  brandName: string;
  description: string;
  brandColor?: string;
  phone?: string;
  whatsapp?: string;
  email?: string;
  auditUrl?: string;
  pricingUrl?: string;
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
          rawHtml: results.length === 0 ? html : undefined,
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

  // 6. Email
  let email: string | undefined;
  $('a[href^="mailto:"]').each((_, el) => {
    if (email) return;
    const raw = $(el).attr('href')?.replace('mailto:', '').split('?')[0].trim();
    if (raw && raw.includes('@')) {
      email = raw;
    }
  });

  // 7. Audit & Pricing URLs
  let auditUrl: string | undefined;
  let pricingUrl: string | undefined;

  $('a[href]').each((_, el) => {
    const href = $(el).attr('href') || '';
    const text = $(el).text().toLowerCase();
    const hrefLower = href.toLowerCase();

    if (!auditUrl && (text.includes('audit') || hrefLower.includes('audit') || text.includes('free analysis') || hrefLower.includes('quote'))) {
      try {
        auditUrl = new URL(href, pageUrl).toString();
      } catch {
        auditUrl = href;
      }
    }

    if (!pricingUrl && (text.includes('pricing') || hrefLower.includes('pricing') || text.includes('plans') || hrefLower.includes('plans'))) {
      try {
        pricingUrl = new URL(href, pageUrl).toString();
      } catch {
        pricingUrl = href;
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
    auditUrl,
    pricingUrl,
    keyTopics: keyTopics.slice(0, 10),
    brandColor: (() => {
      const tc = $('meta[name="theme-color"], meta[name="msapplication-TileColor"]').attr('content')?.trim();
      if (tc && /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(tc)) return tc;
      return undefined;
    })(),
  };
}
