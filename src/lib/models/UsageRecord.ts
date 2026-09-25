import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IUsageRecord extends Document {
  email: string;
  botId?: string;
  date: string;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  chats: number;
  leads: number;
  createdAt: Date;
  updatedAt: Date;
}

const UsageRecordSchema: Schema = new Schema(
  {
    email: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      index: true,
    },
    botId: {
      type: String,
      default: '',
    },
    date: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    inputTokens: {
      type: Number,
      default: 0,
    },
    outputTokens: {
      type: Number,
      default: 0,
    },
    totalTokens: {
      type: Number,
      default: 0,
    },
    chats: {
      type: Number,
      default: 0,
    },
    leads: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
    collection: 'usage_records',
  }
);

UsageRecordSchema.index({ email: 1, date: 1 }, { unique: true });

export const UsageRecord: Model<IUsageRecord> = (() => {
  if (mongoose.models.UsageRecord) {
    mongoose.deleteModel('UsageRecord');
  }
  return mongoose.model<IUsageRecord>('UsageRecord', UsageRecordSchema);
})();