import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IPlanSettings {
  botLimit: number;
  tokenQuota: number;
  chatQuota: number;
  monthlyPrice?: number;
}

export interface ISystemSettings extends Document {
  defaultChatProvider: 'openai' | 'gemini' | 'nvidia' | 'openrouter';
  defaultChatModel: string;
  defaultEmbedProvider: 'openai' | 'gemini' | 'nvidia';
  defaultEmbedModel: string;
  freePlan: IPlanSettings;
  proPlan: IPlanSettings;
  byokBypassQuota: boolean;
  updatedAt: Date;
}

const PlanSettingsSchema = new Schema(
  {
    botLimit: { type: Number, required: true },
    tokenQuota: { type: Number, required: true },
    chatQuota: { type: Number, required: true },
    monthlyPrice: { type: Number, default: 0 },
  },
  { _id: false }
);

const SystemSettingsSchema = new Schema(
  {
    key: { type: String, default: 'global_settings', unique: true, index: true },
    defaultChatProvider: {
      type: String,
      enum: ['openai', 'gemini', 'nvidia', 'openrouter'],
      default: 'nvidia',
    },
    defaultChatModel: {
      type: String,
      default: 'meta/muse-glimmer-30b',
      trim: true,
    },
    defaultEmbedProvider: {
      type: String,
      enum: ['openai', 'gemini', 'nvidia'],
      default: 'nvidia',
    },
    defaultEmbedModel: {
      type: String,
      default: 'nvidia/llama-nemotron-embed-vl-1b-v2',
      trim: true,
    },
    freePlan: {
      type: PlanSettingsSchema,
      default: () => ({
        botLimit: 1,
        tokenQuota: 25000,
        chatQuota: 50,
        monthlyPrice: 0,
      }),
    },
    proPlan: {
      type: PlanSettingsSchema,
      default: () => ({
        botLimit: 10,
        tokenQuota: 2500000,
        chatQuota: 50000,
        monthlyPrice: 9,
      }),
    },
    byokBypassQuota: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

export const SystemSettings: Model<ISystemSettings> =
  mongoose.models.SystemSettings ||
  mongoose.model<ISystemSettings>('SystemSettings', SystemSettingsSchema);
