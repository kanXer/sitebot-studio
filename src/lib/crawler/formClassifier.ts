import { FORM_INTENTS, FormIntent } from '@/lib/models/BotForm';
import { RawExtractedForm, RawFormField } from './formExtractor';
import { replaceBotForms, StoredForm } from '@/lib/forms/formsStore';

export interface LLMProviderConfig {
  baseUrl: string;
  apiKey: string;
  model: string;
}

export interface ClassifiedField {
  key: string;
  label: string;
  type: string;
  required: boolean;
  selector: string;
  placeholder?: string;
  options?: string[];
  inputType?: string;
}

export interface ClassifiedForm {
  title: string;
  formType: FormIntent;
  targetUrl: string;
  fieldsSchema: ClassifiedField[];
  submitEndpoint?: string;
  submitMethod?: string;
}

const DEFAULT_MODEL = 'meta/llama-3.3-70b-instruct';

function toSnakeCase(value: string): string {
  const withCamel = String(value || '')
    .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1_$2');
  const cleaned = withCamel
    .replace(/[^\w\s-]/g, ' ')
    .replace(/[\s-]+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '')
    .toLowerCase();
  return cleaned || '';
}

function inferKeyFromField(field: RawFormField): string {
  const fromName = toSnakeCase(field.name || '');
  if (fromName) return fromName;
  const fromId = toSnakeCase(field.id || '').replace(/^id_|^field_/, '');
  if (fromId) return fromId;
  const fromLabel = toSnakeCase(field.label || '');
  if (fromLabel) return fromLabel;
  return toSnakeCase(field.placeholder || 'field') || 'field';
}

const TEXT_INPUT_TYPES = new Set([
  'text', 'email', 'tel', 'url', 'password', 'search', 'date', 'time',
  'datetime-local', 'month', 'week', 'color', 'file', 'hidden', 'textarea',
]);

function mapHtmlTypeToSchemaType(field: RawFormField): string {
  const t = (field.type || 'text').toLowerCase();
  if (t === 'checkbox' && (!field.options || field.options.length === 0)) return 'boolean';
  if (t === 'number' || t === 'range') return 'number';
  if (field.type === 'select') return 'string';
  if (TEXT_INPUT_TYPES.has(t)) return 'string';
  return 'string';
}

/**
 * Heuristic form-intent inference used when the LLM is unavailable or fails.
 */
export function heuristicFormIntent(form: RawExtractedForm): FormIntent {
  const hay = [
    form.id || '',
    (form.name || ''),
    (form.submitButtonText || ''),
    (form.action || ''),
    ...(form.fields.map((f) => `${f.label || ''} ${f.name || ''} ${f.id || ''} ${f.placeholder || ''}`)),
  ]
    .join(' ')
    .toLowerCase();

  const types = form.fields.map((f) => (f.type || '').toLowerCase());
  const hasDate = types.includes('date') || types.includes('datetime-local') || types.includes('time');
  const hasEmail = types.includes('email');
  const hasPhone = types.includes('tel');
  const hasMessage = types.includes('textarea');
  const hasPayment = hay.includes('card') || hay.includes('payment') || hay.includes('price') || hay.includes('amount');

  if (hay.includes('appointment') || hay.includes('book') || hay.includes('schedule') || hay.includes('reserve') || (hasDate && hasEmail)) {
    return 'APPOINTMENT_BOOKING';
  }
  if (hay.includes('order') || hay.includes('cart') || hay.includes('checkout') || hay.includes('food') || hasPayment) {
    return 'ORDER_FOOD_OR_ITEM';
  }
  if (hay.includes('support') || hay.includes('ticket') || hay.includes('issue') || hay.includes('complaint')) {
    return 'SUPPORT_TICKET';
  }
  if (hay.includes('register') || hay.includes('sign up') || hay.includes('signup') || hay.includes('create account') || hay.includes('join')) {
    return 'REGISTRATION';
  }
  if (hasEmail || hasPhone || hasMessage || (hay.includes('contact') && form.fields.length >= 2)) {
    return 'LEAD_GENERATION';
  }
  return 'OTHER';
}

/**
 * Builds a strict normalized field from a raw field, using the LLM mapping when present.
 */
function normalizeField(
  field: RawFormField,
  llmField?: Partial<ClassifiedField>
): ClassifiedField {
  const inferredKey = inferKeyFromField(field);
  const key = llmField?.key ? toSnakeCase(llmField.key) || inferredKey : inferredKey;
  const label =
    llmField?.label?.trim() || field.label?.trim() || field.placeholder?.trim() || field.name || key;
  const type = llmField?.type || mapHtmlTypeToSchemaType(field);

  let selector = llmField?.selector?.trim() || field.selector || '';
  if (!selector && field.id) selector = `#${field.id}`;
  if (!selector && field.name) selector = `[name="${field.name}"]`;

  const normalized: ClassifiedField = {
    key,
    label: label.slice(0, 120),
    type,
    required: llmField ? Boolean(llmField.required) : Boolean(field.required),
    selector,
    inputType: field.type,
  };
  if (field.placeholder) normalized.placeholder = field.placeholder.slice(0, 120);
  if (field.options && field.options.length > 0) normalized.options = field.options.slice(0, 50);
  return normalized;
}

function dedupeFields(fields: ClassifiedField[]): ClassifiedField[] {
  const seen = new Set<string>();
  return fields.filter((f) => {
    if (!f.key || seen.has(f.key)) return false;
    seen.add(f.key);
    return true;
  });
}

/**
 * Normalizes a raw extracted form into the strict bot_forms schema.
 */
export function normalizeForm(raw: RawExtractedForm, llmResult?: any): ClassifiedForm {
  const llmFields = Array.isArray(llmResult?.fields) ? llmResult.fields : [];
  const fieldsSchema = dedupeFields(
    raw.fields.map((f, i) => normalizeField(f, llmFields[i] || undefined))
  );

  let formType: FormIntent = 'OTHER';
  if (llmResult?.formType) {
    const candidate = String(llmResult.formType).toUpperCase().replace(/[^A-Z_]/g, '');
    if ((FORM_INTENTS as readonly string[]).includes(candidate)) {
      formType = candidate as FormIntent;
    }
  }
  if (formType === 'OTHER') {
    const heuristic = heuristicFormIntent(raw);
    if (heuristic !== 'OTHER') formType = heuristic;
  }

  let title = String(llmResult?.title || '').trim();
  if (!title) {
    const submitText = raw.submitButtonText?.trim();
    const candidate =
      submitText &&
      submitText.toLowerCase() !== 'submit' &&
      submitText.toLowerCase() !== (raw.pageTitle || '').toLowerCase()
        ? submitText
        : raw.pageTitle;
    title = candidate?.trim() || 'Web Form';
  }

  return {
    title: title.slice(0, 200),
    formType,
    targetUrl: raw.url,
    fieldsSchema,
    submitEndpoint: raw.action ? new URL(raw.action, raw.url).toString() : undefined,
    submitMethod: raw.method || 'POST',
  };
}

function cleanJsonResponse(content: string): string {
  let cleaned = content.trim();
  cleaned = cleaned.replace(/^```(?:json)?/i, '').replace(/```$/, '');
  const start = cleaned.indexOf('[');
  const startObj = cleaned.indexOf('{');
  if (start === -1 && startObj === -1) return cleaned;
  const arrStart = start !== -1 ? start : Infinity;
  const objStart = startObj !== -1 ? startObj : Infinity;
  const cutAt = arrStart <= objStart ? start : startObj;
  const endMarker = arrStart <= objStart ? ']' : '}';
  const firstEnd = cleaned.lastIndexOf(endMarker);
  if (firstEnd === -1) return cleaned;
  return cleaned.slice(cutAt, firstEnd + 1);
}

/**
 * Calls the OpenAI-compatible chat completions endpoint with the raw forms and
 * requests a normalized JSON structure for each one.
 */
export async function classifyFormsWithLLM(
  rawForms: RawExtractedForm[],
  config: LLMProviderConfig,
  signal?: AbortSignal
): Promise<ClassifiedForm[]> {
  const payload = rawForms.slice(0, 6).map((f) => ({
    url: f.url,
    title: f.pageTitle,
    method: f.method,
    action: f.action,
    submitButtonText: f.submitButtonText,
    fields: f.fields.map((x) => ({
      name: x.name,
      id: x.id,
      label: x.label,
      placeholder: x.placeholder,
      type: x.type,
      required: x.required,
      options: (x.options || []).slice(0, 20),
      selector: x.selector,
    })),
  }));

  const systemPrompt = `You are an expert web-form analyzer. You convert raw HTML form data into a strict machine-readable schema used by a conversational booking assistant.

For EVERY form in the input array, output ONE object. Return a JSON ARRAY of objects with this exact shape:
{
  "title": "short human-friendly form title (max 12 words)",
  "formType": "APPOINTMENT_BOOKING" | "LEAD_GENERATION" | "REGISTRATION" | "ORDER_FOOD_OR_ITEM" | "SUPPORT_TICKET" | "OTHER",
  "fields": [
    {
      "key": "snake_case_field_name",
      "label": "human readable label",
      "type": "string" | "number" | "integer" | "boolean",
      "required": true,
      "selector": "exact CSS selector for the input (use name attribute when possible, e.g. [name=\\"full_name\\"])",
      "placeholder": "optional"
    }
  ]
}

Rules:
- Infer formType from the form's purpose (fields, submit button text, action URL).
- key MUST be snake_case (e.g. full_name, email_address, appointment_date).
- email/tel/date/text select fields are type "string". Age/quantity fields are "integer".
- selector MUST point to the exact DOM node (prefer [name="..."] or #id).`;

  const userPrompt = JSON.stringify(payload, null, 0);

  const res = await fetch(config.baseUrl.replace(/\/$/, '') + '/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${config.apiKey}`,
      ...(config.baseUrl.includes('openrouter.ai')
        ? { 'HTTP-Referer': 'https://sitebotstudio.app', 'X-Title': 'SiteBot Studio' }
        : {}),
    },
    signal,
    body: JSON.stringify({
      model: config.model || DEFAULT_MODEL,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0,
      max_tokens: config.model?.includes('nemotron') || config.model?.includes('glimmer') ? 4096 : 2048,
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Form classification LLM failed (${res.status}): ${errText.slice(0, 300)}`);
  }

  const data = await res.json();
  const content = data.choices?.[0]?.message?.content || '';
  let parsed: any;
  try {
    parsed = JSON.parse(cleanJsonResponse(content));
  } catch {
    throw new Error('Form classification returned non-JSON output');
  }

  const list = Array.isArray(parsed) ? parsed : [parsed];
  return rawForms.slice(0, list.length).map((raw, i) => normalizeForm(raw, list[i]));
}

/**
 * End-to-end: extracts forms are normalized (LLM-first, heuristic fallback) and
 * persisted into bot_forms for a chatbot. Returns the saved forms.
 */
export async function classifyAndPersistForms(
  botId: string,
  rawForms: RawExtractedForm[],
  llmConfig?: LLMProviderConfig
): Promise<StoredForm[]> {
  let classified: ClassifiedForm[] = [];

  if (rawForms.length > 0) {
    if (llmConfig?.apiKey) {
      try {
        classified = await classifyFormsWithLLM(rawForms, llmConfig);
      } catch (err: unknown) {
        console.warn(
          '[FormClassifier] LLM classification failed, using heuristics:',
          err instanceof Error ? err.message : err
        );
      }
    }
    if (classified.length === 0) {
      classified = rawForms.map((raw) => normalizeForm(raw));
    }
  }

  const stored = await replaceBotForms(
    botId,
    classified.map((f) => ({
      formType: f.formType,
      title: f.title,
      targetUrl: f.targetUrl,
      fieldsSchema: f.fieldsSchema,
      submitEndpoint: f.submitEndpoint,
      submitMethod: f.submitMethod,
    }))
  );

  return stored;
}