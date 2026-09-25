import mongoose from 'mongoose';
import { BotForm, Chatbot, FormSubmission } from '@/lib/models';
import { MemoryDb } from '@/lib/memoryDb';
import { isUsingMemoryDb } from '@/lib/db';

export interface StoredForm {
  _id: string;
  botId: string;
  formType: string;
  title: string;
  targetUrl: string;
  fieldsSchema: Array<Record<string, unknown>>;
  submitEndpoint?: string;
  submitMethod?: string;
  isActive: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface StoredSubmission {
  _id: string;
  formId: string;
  sessionId: string;
  data: Record<string, unknown>;
  status: 'in_progress' | 'completed';
  createdAt?: Date;
  updatedAt?: Date;
}

function toObjectId(id: string): mongoose.Types.ObjectId | null {
  return mongoose.Types.ObjectId.isValid(id) ? new mongoose.Types.ObjectId(id) : null;
}

function normalizeStoredForm(f: any): StoredForm {
  return {
    _id: String(f._id),
    botId: String(f.botId) || '',
    formType: f.formType || 'OTHER',
    title: f.title || '',
    targetUrl: f.targetUrl || '',
    fieldsSchema: Array.isArray(f.fieldsSchema) ? f.fieldsSchema : [],
    submitEndpoint: f.submitEndpoint || '',
    submitMethod: f.submitMethod || 'POST',
    isActive: f.isActive !== false,
    createdAt: f.createdAt,
    updatedAt: f.updatedAt,
  };
}

function normalizeStoredSubmission(s: any): StoredSubmission {
  return {
    _id: String(s._id),
    formId: String(s.formId),
    sessionId: s.sessionId || '',
    data: s.data && typeof s.data === 'object' ? s.data : {},
    status: s.status === 'completed' ? 'completed' : 'in_progress',
    createdAt: s.createdAt,
    updatedAt: s.updatedAt,
  };
}

/**
 * Loads active bot_forms for a chatbot across both Mongo and memory modes.
 */
export async function loadActiveForms(botId: string): Promise<StoredForm[]> {
  if (isUsingMemoryDb()) {
    return MemoryDb.findBotForms(botId, true);
  }

  let objectId = mongoose.Types.ObjectId.isValid(botId) ? new mongoose.Types.ObjectId(botId) : null;
  if (!objectId) {
    const bySlug = await Chatbot.findOne({ slug: String(botId).toLowerCase() }).select('_id').lean();
    if (!bySlug) return [];
    objectId = bySlug._id as mongoose.Types.ObjectId;
  }

  const docs = await BotForm.find({ botId: objectId, isActive: true }).lean();
  return docs.map(normalizeStoredForm);
}

/**
 * Replaces all bot_forms for a chatbot with a fresh normalized set.
 */
export async function replaceBotForms(
  botId: string,
  forms: Array<{
    formType: string;
    title: string;
    targetUrl: string;
    fieldsSchema: unknown[];
    submitEndpoint?: string;
    submitMethod?: string;
  }>
): Promise<StoredForm[]> {
  if (isUsingMemoryDb()) {
    MemoryDb.deleteBotFormsForBot(botId);
    return forms.map((f) => MemoryDb.upsertBotForm(botId, { ...f, _id: 'replace_all' }));
  }

  const objectId = toObjectId(botId);
  if (!objectId) {
    throw new Error('A valid chatbot ObjectId is required to persist bot forms');
  }

  await BotForm.deleteMany({ botId: objectId });
  if (forms.length === 0) return [];

  const docs: any[] = forms.map((f) => ({
    botId: objectId,
    formType: f.formType,
    title: f.title,
    targetUrl: f.targetUrl,
    fieldsSchema: f.fieldsSchema,
    submitEndpoint: f.submitEndpoint || '',
    submitMethod: f.submitMethod || 'POST',
    isActive: true,
  }));
  const inserted = await BotForm.insertMany(docs);
  return inserted.map(normalizeStoredForm);
}

/**
 * Returns the in-progress submission for a session/form, or null when none exists.
 */
export async function findInProgressSubmission(
  formId: string,
  sessionId: string
): Promise<StoredSubmission | null> {
  if (isUsingMemoryDb()) {
    const sub = MemoryDb.findInProgressSubmission(sessionId, formId);
    return sub ? normalizeStoredSubmission(sub) : null;
  }
  const doc = await FormSubmission.findOne({ formId, sessionId, status: 'in_progress' })
    .sort({ createdAt: -1 })
    .lean();
  return doc ? normalizeStoredSubmission(doc) : null;
}

/**
 * Creates a new form submission (in_progress by default).
 */
export async function createSubmission(
  formId: string,
  sessionId: string,
  data: Record<string, unknown>,
  status: 'in_progress' | 'completed' = 'in_progress'
): Promise<StoredSubmission> {
  if (isUsingMemoryDb()) {
    return normalizeStoredSubmission(
      MemoryDb.createFormSubmission({ formId, sessionId, data, status })
    );
  }
  const doc = await FormSubmission.create({ formId, sessionId, data, status });
  return normalizeStoredSubmission(doc);
}

/**
 * Updates submission payload / status.
 */
export async function updateSubmission(
  submissionId: string,
  data: Record<string, unknown>,
  status: 'in_progress' | 'completed'
): Promise<StoredSubmission | null> {
  if (isUsingMemoryDb()) {
    const updated = MemoryDb.updateFormSubmission(submissionId, { data, status });
    return updated ? normalizeStoredSubmission(updated) : null;
  }
  const doc = await FormSubmission.findByIdAndUpdate(
    submissionId,
    { data, status },
    { new: true }
  ).lean();
  return doc ? normalizeStoredSubmission(doc) : null;
}