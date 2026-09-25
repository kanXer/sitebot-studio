import { ChatMessage } from './chat';
import { StoredForm } from '@/lib/forms/formsStore';
import {
  findInProgressSubmission,
  createSubmission,
  updateSubmission,
} from '@/lib/forms/formsStore';

export interface ToolDefinition {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: {
      type: 'object';
      properties: Record<string, { type: string; description: string; enum?: string[] }>;
      required: string[];
    };
  };
}

export interface SlotFillingConfig {
  baseUrl: string;
  apiKey: string;
  model: string;
  maxTurns?: number;
  timeoutMs?: number;
}

export interface SlotFillingResult {
  content: string;
  historyUpdate: ChatMessage[];
  formSubmitted?: {
    formId: string;
    submissionId: string;
    title: string;
    formType: string;
  } | null;
  toolUsed: boolean;
}

/**
 * Converts a form_type enum into a safe tool name: submit_[form_type].
 */
export function toolNameForFormType(formType: string): string {
  return `submit_${String(formType).toLowerCase().replace(/[^a-z0-9_]/g, '_')}`;
}

/**
 * Maps the classifier's schema `type` onto a JSON Schema type with a human
 * description for the model.
 */
export function jsonSchemaTypeForField(field: any): string {
  const raw = String(field.type || 'string').toLowerCase();
  if (raw === 'integer' || raw === 'number') return raw;
  if (raw === 'boolean') return 'boolean';
  return 'string';
}

function fieldDescription(field: any): string {
  const label = field.label || field.key || '';
  const placeholder = field.placeholder ? ` (e.g. ${field.placeholder})` : '';
  const options = Array.isArray(field.options) && field.options.length > 0
    ? ` Choose one of: ${field.options.join(' | ')}`
    : '';
  return `${label}${placeholder}${options}`.slice(0, 200);
}

/**
 * Converts stored bot_forms into OpenAI/NVIDIA-compatible `tools` definitions.
 * Tool params are generated dynamically from fields_schema with required
 * properties marked from the `required` flags.
 */
export function buildFormTools(forms: StoredForm[]): ToolDefinition[] {
  const tools: ToolDefinition[] = [];

  for (const form of forms) {
    const fields = Array.isArray(form.fieldsSchema) ? form.fieldsSchema : [];
    if (fields.length === 0) continue;

    const properties: ToolDefinition['function']['parameters']['properties'] = {};
    const required: string[] = [];
    const fieldKeys = new Set<string>();

    for (const field of fields) {
      const key = String(field.key || '').trim();
      if (!key || fieldKeys.has(key)) continue;
      fieldKeys.add(key);

      const prop: { type: string; description: string; enum?: string[] } = {
        type: jsonSchemaTypeForField(field),
        description: `Field: ${fieldDescription(field)}. Selector: ${field.selector || 'N/A'}`,
      };
      if (Array.isArray(field.options) && field.options.length > 0) {
        prop.enum = field.options.slice(0, 30);
      }
      properties[key] = prop;
      if (field.required === true) required.push(key);
    }

    if (required.length === 0) {
      for (const key of Object.keys(properties)) {
        required.push(key);
      }
    }

    tools.push({
      type: 'function',
      function: {
        name: toolNameForFormType(form.formType),
        description: `Collect and submit a "${form.title || form.formType}" form on behalf of the user. `
          + `The user has expressed intent to ${humanizeFormIntent(form.formType)}. `
          + `Extract the data from the conversation; if you cannot determine a required field, fill only what you know and set nothing else. The assistant will ask the user for anything missing.`,
        parameters: {
          type: 'object',
          properties,
          required,
        },
      },
    });
  }

  return tools;
}

function humanizeFormIntent(formType: string): string {
  return String(formType || 'OTHER').toLowerCase().replace(/_/g, ' ');
}

/**
 * Injects current slot-filling state into the system prompt so the model stays
 * on track across turns without needing tool messages in client history.
 */
export function buildSlotFillingSystemPrompt(
  baseSystemPrompt: string,
  activeState?: {
    title: string;
    collected: Record<string, unknown>;
    requiredStillNeeded: string[];
  }
): string {
  const base = `${baseSystemPrompt}

FORM SUBMISSION MODE:
- You have access to "submit_*" tools, one for each real form this website exposes (bookings, leads, orders, registrations, support).
- Detect when the user's message expresses intent that maps to one of these tools (booking an appointment, requesting a quote, placing an order, contacting the team, creating an account, raising a support ticket, etc.).
- When intent matches a tool, call the tool with every field you can confidently extract from the conversation. Never invent values. Then, conversationally ask the user (in your natural reply) for any required fields the tool call was missing.
- If the user is asking a general knowledge question, answer from the knowledge base as normal and do NOT call any tool.
- Do not reveal raw JSON or internal tool mechanics to the user. Phrase all requests naturally and warmly.`;

  if (!activeState) return base;

  return `${base}

CURRENT IN-PROGRESS FORM SUBMISSION (continue collecting this form):
- Form: ${activeState.title}
- Fields already collected (formatted as key = value): ${Object.entries(activeState.collected)
      .filter(([, v]) => v !== undefined && v !== null && v !== '')
      .map(([k, v]) => `${k} = ${String(v)}`)
      .join(', ') || 'none yet'}
- Required fields the user still must provide: ${activeState.requiredStillNeeded.join(', ')}

INSTRUCTIONS FOR THIS TURN:
1. If the user just answered a previous question (e.g. providing their name, email, phone), call the corresponding submit_* tool again INCLUDING all previously collected values plus any newly provided ones, merged together.
2. Do not ask twice for values you already have.
3. If everything still cannot be completed, keep the tool call complete with the merged values and ask only for what remains.`;
}

/**
 * Resolves the assistant text for a tool outcome: asks for missing fields, or
 * confirms a completed submission.
 */
async function formulateAssistantFollowUp(params: {
  config: SlotFillingConfig;
  systemPrompt: string;
  messages: ChatMessage[];
  toolCallMessage: any;
  toolResult: any;
}): Promise<string> {
  const conversation: any[] = [
    { role: 'system', content: params.systemPrompt },
    ...params.messages.map((m) => ({ role: m.role, content: m.content })),
    { role: 'assistant', content: params.toolCallMessage.content || '', tool_calls: params.toolCallMessage.tool_calls },
    { role: 'tool', tool_call_id: params.toolCallMessage.tool_calls[0].id, content: JSON.stringify(params.toolResult) },
  ];

  const result = await callChatCompletions(params.config, conversation, false);
  const reply = result.choices?.[0]?.message;
  return reply?.content?.trim() || defaultFollowUpMessage(params.toolResult);
}

function defaultFollowUpMessage(toolResult: any): string {
  if (toolResult.status === 'completed') {
    const title = toolResult.title || 'form';
    return `Your ${title} has been submitted successfully. Thank you! A member of the team will get back to you shortly.`;
  }
  const labels = Array.isArray(toolResult.requiredMissing)
    ? toolResult.requiredMissing.map((f: any) => f.label || f.key).join(', ')
    : '';
  const missing = labels || toolResult.requiredMissing?.join(', ') || '';
  return missing
    ? `I'd love to finish this for you — I still need: ${missing}. Could you provide those details?`
    : `I still need a few more details from you to complete this. Could you share them with me?`;
}

/**
 * Validates which required fields are present / valid in the args map.
 */
function validateRequiredFields(
  form: StoredForm,
  args: Record<string, unknown>
): { missing: string[]; validArgs: Record<string, unknown> } {
  const fields = Array.isArray(form.fieldsSchema) ? form.fieldsSchema : [];
  const missing: string[] = [];
  const clean: Record<string, unknown> = {};

  for (const field of fields) {
    const key = String(field.key || '').trim();
    if (!key) continue;
    const value = args[key];
    const isEmpty = value === undefined || value === null || value === '';
    if (field.required === true && isEmpty) {
      missing.push(key);
    }
    if (!isEmpty) clean[key] = value;
  }
  return { missing, validArgs: clean };
}

function extractToolArguments(rawArgs: any): Record<string, unknown> {
  if (!rawArgs) return {};
  if (typeof rawArgs === 'object') return rawArgs;
  try {
    const parsed = JSON.parse(rawArgs);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

async function callChatCompletions(
  config: SlotFillingConfig,
  messages: any[],
  includeTools: boolean,
  tools?: ToolDefinition[]
) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), config.timeoutMs || 30000);

  try {
    const res = await fetch(config.baseUrl.replace(/\/$/, '') + '/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${config.apiKey}`,
        ...(config.baseUrl.includes('openrouter.ai')
          ? { 'HTTP-Referer': 'https://sitebotstudio.app', 'X-Title': 'SiteBot Studio' }
          : {}),
      },
      signal: controller.signal,
      body: JSON.stringify({
        model: config.model,
        messages,
        ...(includeTools ? { tools, tool_choice: 'auto' as const } : {}),
        temperature: 0.4,
        max_tokens: 1024,
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Tool-calling chat failed (${res.status}): ${errText.slice(0, 300)}`);
    }
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Conversational slot-filling entry point. Runs one user turn against
 * `meta/muse-glimmer-30b` (or any OpenAI-compatible model) with the dynamic
 * submit_* tools, persists in-progress / completed submissions to
 * form_submissions, and answers to stream back to the widget.
 */
export async function runConversationalSlotFilling(params: {
  config: SlotFillingConfig;
  systemPrompt: string;
  history: ChatMessage[];
  userMessage: string;
  sessionId: string;
  forms: StoredForm[];
}): Promise<SlotFillingResult> {
  const { config, systemPrompt, history, userMessage, sessionId, forms } = params;
  const tools = buildFormTools(forms);

  if (tools.length === 0) {
    throw new Error('No active forms are available for tool calling');
  }

  const toolByName = new Map(tools.map((t) => [t.function.name, t]));
  const formByToolName = new Map<string, StoredForm>();
  for (const form of forms) {
    formByToolName.set(toolNameForFormType(form.formType), form);
  }

  // 1. Recover any in-progress submission so slot state survives turns
  let activeSubmission: Awaited<ReturnType<typeof findInProgressSubmission>> | null = null;
  for (const form of forms) {
    const existing = await findInProgressSubmission(form._id, sessionId);
    if (existing) {
      activeSubmission = existing;
      break;
    }
  }

  const activeForm = activeSubmission
    ? forms.find((f) => f._id === activeSubmission!.formId) || null
    : null;
  const activeState = activeSubmission && activeForm
    ? (() => {
        const fields = Array.isArray(activeForm.fieldsSchema) ? activeForm.fieldsSchema : [];
        const collected = activeSubmission!.data;
        const requiredStillNeeded = fields
          .filter((f: any) => f.required === true)
          .map((f: any) => f.key)
          .filter((key: string) => {
            const v = (collected as any)[key];
            return v === undefined || v === null || v === '';
          });
        return {
          title: activeForm.title || activeForm.formType,
          collected,
          requiredStillNeeded,
        };
      })()
    : undefined;

  const augmentedSystem = buildSlotFillingSystemPrompt(systemPrompt, activeState);

  // 2. Primary turn with tools
  const conversation: any[] = [
    { role: 'system', content: augmentedSystem },
    ...history.map((m) => ({ role: m.role, content: m.content })),
    { role: 'user', content: userMessage },
  ];

  const firstResponse = await callChatCompletions(config, conversation, true, tools);
  const firstMessage = firstResponse.choices?.[0]?.message;

  if (!firstMessage || !Array.isArray(firstMessage.tool_calls) || firstMessage.tool_calls.length === 0) {
    const content = firstMessage?.content?.trim() || '';
    return {
      content,
      historyUpdate: [{ role: 'assistant', content }],
      formSubmitted: null,
      toolUsed: false,
    };
  }

  const toolCall = firstMessage.tool_calls[0];
  const toolDef = toolByName.get(toolCall.function?.name || '');
  const form = toolDef ? formByToolName.get(toolCall.function.name) || null : null;

  if (!toolDef || !form) {
    // Model called an unknown tool; degrade gracefully by rejecting that turn.
    const toolResult = {
      status: 'error' as const,
      error: `Tool "${toolCall.function?.name}" is not available. Reply to the user without using tools.`,
    };
    const content = await formulateAssistantFollowUp({
      config,
      systemPrompt: augmentedSystem,
      messages: history,
      toolCallMessage: firstMessage,
      toolResult,
    });
    return {
      content,
      historyUpdate: [{ role: 'assistant', content }],
      formSubmitted: null,
      toolUsed: true,
    };
  }

  // 3. Merge tool args with any previously collected partial data
  const newArgs = extractToolArguments(toolCall.function?.arguments);
  const previousData = activeSubmission?.data || {};
  const merged: Record<string, unknown> = { ...previousData, ...newArgs };
  const { missing, validArgs } = validateRequiredFields(form, merged);
  const completed = missing.length === 0;

  let submission = activeSubmission;

  if (completed) {
    if (submission) {
      submission = await updateSubmission(submission._id, validArgs, 'completed');
    } else {
      submission = await createSubmission(form._id, sessionId, validArgs, 'completed');
    }
  } else {
    if (submission) {
      submission = await updateSubmission(submission._id, validArgs, 'in_progress');
    } else {
      submission = await createSubmission(form._id, sessionId, validArgs, 'in_progress');
    }
  }

  // 4. Convert the outcome into a user-facing assistant reply
  const labels = new Map<string, string>();
  for (const f of Array.isArray(form.fieldsSchema) ? form.fieldsSchema : []) {
    labels.set(String((f as any).key), String((f as any).label || ''));
  }

  const toolResult = completed
    ? {
        status: 'completed' as const,
        submissionId: submission?._id,
        formId: form._id,
        title: form.title || form.formType,
        data: validArgs,
        feedback: 'The submission is complete. Confirm success to the user warmly and concisely.',
      }
    : {
        status: 'incomplete' as const,
        formId: form._id,
        title: form.title || form.formType,
        alreadyCollected: validArgs,
        requiredMissing: missing.map((key) => ({
          key,
          label: labels.get(key) || key,
        })),
        feedback: `Ask the user for ONLY these missing required fields: ${missing.join(', ')}. Do not ask about fields you already have.`,
      };

  const content = await formulateAssistantFollowUp({
    config,
    systemPrompt: augmentedSystem,
    messages: history,
    toolCallMessage: firstMessage,
    toolResult,
  });

  return {
    content,
    historyUpdate: [{ role: 'assistant', content }],
    formSubmitted:
      completed && submission
        ? {
            formId: form._id,
            submissionId: submission._id,
            title: form.title || form.formType,
            formType: form.formType,
          }
        : null,
    toolUsed: true,
  };
}