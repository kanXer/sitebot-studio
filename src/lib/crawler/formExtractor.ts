import type { Browser, Page } from 'playwright';

export interface RawFormField {
  name?: string;
  id?: string;
  placeholder?: string;
  type: string;
  required: boolean;
  label?: string;
  options?: string[];
  selector?: string;
  visible: boolean;
  disabled: boolean;
}

export interface RawExtractedForm {
  url: string;
  pageTitle?: string;
  id?: string;
  name?: string;
  action?: string;
  method?: string;
  enctype?: string;
  submitButtonText?: string;
  fields: RawFormField[];
}

export interface FormExtractOptions {
  timeoutMs?: number;
  waitForFrameworksMs?: number;
  maxFieldsPerForm?: number;
  maxForms?: number;
}

export interface FormExtractResult {
  forms: RawExtractedForm[];
  browserErrors: string[];
}

const DEFAULT_OPTIONS: Required<FormExtractOptions> = {
  timeoutMs: 30000,
  waitForFrameworksMs: 2500,
  maxFieldsPerForm: 30,
  maxForms: 25,
};

/**
 * Escapes a string for safe inclusion inside an attribute selector like [name="x"].
 */
export function escapeAttributeSelector(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

/**
 * Self-contained browser-side form extraction routine written in plain JS.
 *
 * It is shipped to the page via `new Function`, so it MUST be pure ES that is
 * valid inside a Chromium page (no module imports, no compiled helpers). This
 * avoids dependency on transpiled-function .toString() output (esbuild/SWC
 * inject `__name` / helper wrappers that break serialization).
 */
export const PAGE_FORM_EXTRACTOR_JS = `
(function (maxFieldsPerForm, maxForms) {
  maxFieldsPerForm = maxFieldsPerForm || 30;
  maxForms = maxForms || 25;
  var out = [];
  var forms = Array.prototype.slice.call(document.querySelectorAll('form'));

  for (var fi = 0; fi < forms.length; fi++) {
    if (out.length >= maxForms) break;
    var form = forms[fi];

    function getLabel(el) {
      var aria = el.getAttribute('aria-label');
      if (aria && aria.trim()) return aria.trim();
      var labelledBy = el.getAttribute('aria-labelledby');
      if (labelledBy) {
        var src = document.getElementById(labelledBy);
        if (src && (src.textContent || '').trim()) return (src.textContent || '').trim();
      }
      var wrapping = el.closest('label');
      if (wrapping && (wrapping.textContent || '').trim()) return (wrapping.textContent || '').trim();
      var id = el.getAttribute('id');
      var name = el.getAttribute('name');
      var idAttrs = id ? [id] : [];
      if (name) idAttrs.push(name);
      for (var li = 0; li < idAttrs.length; li++) {
        if (!idAttrs[li]) continue;
        var linked = document.querySelector('label[for="' + window.CSS.escape(idAttrs[li]) + '"]');
        if (linked && (linked.textContent || '').trim()) return (linked.textContent || '').trim();
      }
      var prev = el.previousElementSibling;
      while (prev) {
        if (prev.tagName === 'LABEL') {
          var pt = (prev.textContent || '').trim();
          if (pt) return pt;
        }
        prev = prev.previousElementSibling;
      }
      var host = el.closest('div, fieldset, section, li');
      if (host) {
        var labels = Array.prototype.slice.call(host.querySelectorAll('label'));
        var best = null;
        for (var k = 0; k < labels.length; k++) {
          var forAttr = labels[k].getAttribute('for');
          if (forAttr && (forAttr === id || forAttr === name)) {
            best = labels[k];
            break;
          }
        }
        if (!best && labels.length) best = labels[labels.length - 1];
        if (best) {
          var bt = (best.textContent || '').trim();
          if (bt) return bt;
        }
      }
      return '';
    }

    var fields = [];
    var seenKeys = {};

    function traverse(root) {
      var candidates = Array.prototype.slice.call(root.querySelectorAll('input, textarea, select'));
      for (var ci = 0; ci < candidates.length; ci++) {
        if (fields.length >= maxFieldsPerForm) break;
        var el = candidates[ci];
        var type = ((el.type || 'text') + '').toLowerCase();
        if (type === 'submit' || type === 'button' || type === 'reset' || type === 'image') continue;
        if (type === 'hidden' && el.id) {
          var hiddenLinked = document.querySelector('label[for="' + window.CSS.escape(el.id) + '"]');
          if (!hiddenLinked) continue;
        }

        var elName = el.getAttribute('name') || '';
        var elId = el.getAttribute('id') || '';
        var key = elName || elId;
        if (!key || seenKeys[key]) continue;
        seenKeys[key] = true;

        var options = [];
        var isSelect = el.tagName === 'SELECT';
        if (isSelect) {
          var opts = Array.prototype.slice.call(el.options);
          for (var oi = 0; oi < opts.length && oi < 50; oi++) {
            var t = (opts[oi].text || '').trim();
            if (t) options.push(t);
          }
        } else if (type === 'radio' || type === 'checkbox') {
          if (elName) {
            var group = Array.prototype.slice.call(
              document.querySelectorAll('input[type="' + type + '"][name="' + window.CSS.escape(elName) + '"]')
            );
            for (var gi = 0; gi < group.length && gi < 50; gi++) {
              var rv = group[gi].value;
              if (!rv) {
                var rl = group[gi].closest('label');
                if (rl) rv = (rl.textContent || '').trim();
              }
              if (rv) options.push(rv);
            }
          }
        }

        var rects = el.getClientRects();
        fields.push({
          name: elName || undefined,
          id: elId || undefined,
          placeholder: el.getAttribute('placeholder') || undefined,
          type: isSelect ? 'select' : type,
          required: el.hasAttribute('required') || el.getAttribute('aria-required') === 'true',
          label: getLabel(el) || undefined,
          options: options.length > 0 ? options : undefined,
          visible: rects.length > 0 && rects[0].width > 0 && rects[0].height > 0,
          disabled: el.disabled === true
        });
      }
    }

    traverse(form);

    // Pierce light-shadow DOM roots
    var allEls = document.querySelectorAll('*');
    for (var si = 0; si < allEls.length; si++) {
      if (allEls[si].shadowRoot) traverse(allEls[si].shadowRoot);
    }

    if (fields.length === 0) continue;

    var buttons = Array.prototype.slice.call(
      form.querySelectorAll('button[type="submit"], button:not([type]), input[type="submit"]')
    );
    var submitBtn = null;
    for (var bi = 0; bi < buttons.length; bi++) {
      var br = buttons[bi].getClientRects();
      if (br.length > 0 && br[0].width > 0 && br[0].height > 0) {
        submitBtn = buttons[bi];
        break;
      }
    }

    out.push({
      id: form.id || undefined,
      name: form.getAttribute('name') || undefined,
      action: form.getAttribute('action') || undefined,
      method: (form.method || 'get').toUpperCase(),
      enctype: form.enctype || undefined,
      submitButtonText: submitBtn
        ? submitBtn.textContent ? submitBtn.textContent.trim() : submitBtn.value || 'Submit'
        : 'Submit',
      fields: fields
    });
  }

  return out;
})`;

async function waitForRenderedPage(page: Page, waitForFrameworksMs: number, timeoutMs: number): Promise<void> {
  await Promise.race([
    page.waitForLoadState('networkidle', { timeout: timeoutMs }).catch(() => undefined),
    page.waitForTimeout(waitForFrameworksMs),
  ]);
  await page.waitForTimeout(waitForFrameworksMs);
}

/**
 * Crawls a URL with headless Playwright, waits for client-side rendering, and
 * extracts raw structured forms with their input controls, labels, options and
 * submit destination.
 */
export async function extractFormsFromUrl(
  url: string,
  options: FormExtractOptions = {}
): Promise<FormExtractResult> {
  const opts: Required<FormExtractOptions> = { ...DEFAULT_OPTIONS, ...options };
  const browserErrors = new Set<string>();

  // Lazy import so the crawler module stays thin and the route does not break
  // if Playwright browsers are not installed on the host.
  let browser: Browser | null = null;
  try {
    const { chromium } = await import('playwright');
    browser = await chromium.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
    });

    const context = await browser.newContext({
      userAgent:
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36 SiteBotBot/1.0',
      viewport: { width: 1366, height: 768 },
      locale: 'en-US',
    });

    context.on('page', (pg) => {
      pg.on('console', (msg) => {
        if (msg.type() === 'error') {
          browserErrors.add(messageTruncate(msg.text()));
        }
      });
    });

    const page = await context.newPage();
    page.setDefaultTimeout(opts.timeoutMs);

    const response = await page.goto(url, {
      waitUntil: 'domcontentloaded',
      timeout: opts.timeoutMs,
    });

    if (!response || !response.ok()) {
      throw new Error(`Page returned HTTP ${response?.status() ?? 'unknown'} for ${url}`);
    }

    await waitForRenderedPage(page, opts.waitForFrameworksMs, opts.timeoutMs);

    const pageTitle = (await page.title()) || '';
    const extracted = (await page.evaluate(
      (payload: { script: string; maxFields: number; maxForms: number }) => {
        const fn = new Function(`return(${payload.script})`)() as (a: number, b: number) => PageRawForm[];
        return fn(payload.maxFields, payload.maxForms);
      },
      {
        script: PAGE_FORM_EXTRACTOR_JS,
        maxFields: opts.maxFieldsPerForm,
        maxForms: opts.maxForms,
      }
    )) as PageRawForm[] | undefined;

    const forms: RawExtractedForm[] = Array.isArray(extracted)
      ? extracted.map((f) => ({
          url,
          pageTitle,
          id: f.id,
          name: f.name,
          action: f.action,
          method: f.method,
          enctype: f.enctype,
          submitButtonText: f.submitButtonText,
          fields: (f.fields || []).map((fd) => buildFieldSelector(fd)),
        }))
      : [];

    return { forms, browserErrors: Array.from(browserErrors).slice(0, 20) };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    if (/executable doesn't exist|Executable doesn't exist|browser is not installed|install chromium/i.test(message)) {
      throw new Error(
        'Playwright Chromium is not installed on this host. Run `npx playwright install chromium` before crawling forms.'
      );
    }
    throw err;
  } finally {
    if (browser) {
      await browser.close().catch(() => undefined);
    }
  }
}

type PageRawField = {
  name?: string;
  id?: string;
  placeholder?: string;
  type: string;
  required: boolean;
  label?: string;
  options?: string[];
  visible: boolean;
  disabled: boolean;
};

type PageRawForm = {
  id?: string;
  name?: string;
  action?: string;
  method?: string;
  enctype?: string;
  submitButtonText?: string;
  fields: PageRawField[];
};

function buildFieldSelector(field: PageRawField): RawFormField {
  let selector = '';
  if (field.id) {
    selector = `#${escapeAttributeSelector(field.id)}`;
  } else if (field.name) {
    selector = `[name="${escapeAttributeSelector(field.name)}"]`;
  }
  return { ...field, selector: selector || undefined };
}

function messageTruncate(text: string): string {
  const clean = text.replace(/\s+/g, ' ').trim();
  return clean.length > 300 ? clean.slice(0, 300) + '…' : clean;
}

/**
 * Picks the most promising pages to scan for forms given a crawl result.
 * Prefers contact / booking / order / enquiry pages, falls back to the homepage.
 */
export function pickFormCandidateUrls(
  crawlResults: Array<{ url: string; title: string }>,
  homepageUrl: string
): string[] {
  const score = (url: string, title: string): number => {
    const hay = `${url} ${title}`.toLowerCase();
    let s = 0;
    if (hay.includes('/contact') || hay.includes(' contact')) s += 50;
    if (hay.includes('book') || hay.includes('appointment') || hay.includes('reserve')) s += 40;
    if (hay.includes('order') || hay.includes('cart') || hay.includes('checkout')) s += 30;
    if (hay.includes('quote') || hay.includes('enquiry') || hay.includes('schedul')) s += 30;
    if (hay.includes('register') || hay.includes('signup') || hay.includes('sign-up') || hay.includes('join')) s += 20;
    if (hay.includes('apply') || hay.includes('ticket') || hay.includes('support')) s += 15;
    return s;
  };

  const ranked = [...crawlResults]
    .map((r) => ({ url: r.url, title: r.title, score: score(r.url, r.title) }))
    .sort((a, b) => b.score - a.score);

  const candidates: string[] = [];
  const seen = new Set<string>();
  const push = (url: string) => {
    const key = url.replace(/\/$/, '');
    if (!seen.has(key)) {
      seen.add(key);
      candidates.push(url);
    }
  };

  for (const r of ranked) {
    if (r.score > 10) push(r.url);
  }
  if (candidates.length === 0 && homepageUrl) push(homepageUrl);
  for (const r of ranked.slice(0, 3)) {
    push(r.url);
  }

  return candidates.slice(0, 4);
}