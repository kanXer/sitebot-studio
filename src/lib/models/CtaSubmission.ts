import mongoose, { Schema, Document, Model } from 'mongoose';
import crypto from 'crypto';

export interface ICtaSubmission extends Document {
  uuid: string;
  botId?: string;
  campaign: string;
  page: string;
  name: string;
  email?: string;
  phone?: string;
  message?: string;
  ownerId?: string;
  ownerEmail?: string;
  source: string;
  forwarded: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const CtaSubmissionSchema: Schema = new Schema(
  {
    _id: {
      type: String,
      default: () => crypto.randomUUID(),
    },
    botId: {
      type: String,
      default: '',
      index: true,
    },
    campaign: {
      type: String,
      default: 'default',
      trim: true,
    },
    page: {
      type: String,
      default: '',
      trim: true,
    },
    name: {
      type: String,
      default: '',
      trim: true,
    },
    email: {
      type: String,
      default: '',
      trim: true,
      lowercase: true,
    },
    phone: {
      type: String,
      default: '',
      trim: true,
    },
    message: {
      type: String,
      default: '',
      trim: true,
    },
    ownerId: {
      type: String,
      default: '',
    },
    ownerEmail: {
      type: String,
      default: '',
      index: true,
    },
    source: {
      type: String,
      default: 'website_cta',
    },
    forwarded: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
    collection: 'cta_submissions',
  }
);

CtaSubmissionSchema.index({ ownerEmail: 1, createdAt: -1 });
CtaSubmissionSchema.index({ campaign: 1, createdAt: -1 });

export const CtaSubmission: Model<ICtaSubmission> = (() => {
  if (mongoose.models.CtaSubmission) {
    mongoose.deleteModel('CtaSubmission');
  }
  return mongoose.model<ICtaSubmission>('CtaSubmission', CtaSubmissionSchema);
})();