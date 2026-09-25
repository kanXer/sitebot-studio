import mongoose, { Schema, Document, Model } from 'mongoose';
import crypto from 'crypto';

export interface IFormSubmission extends Document {
  uuid: string;
  formId: string;
  sessionId: string;
  data: Record<string, unknown>;
  status: 'in_progress' | 'completed';
  createdAt: Date;
  updatedAt: Date;
}

const FormSubmissionSchema: Schema = new Schema(
  {
    _id: {
      type: String,
      default: () => crypto.randomUUID(),
    },
    formId: {
      type: String,
      ref: 'BotForm',
      required: true,
      index: true,
    },
    sessionId: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    data: {
      type: Schema.Types.Mixed,
      default: {},
    },
    status: {
      type: String,
      enum: ['in_progress', 'completed'],
      default: 'in_progress',
    },
  },
  {
    timestamps: true,
    collection: 'form_submissions',
  }
);

FormSubmissionSchema.index({ formId: 1, sessionId: 1, status: 1 });

export const FormSubmission: Model<IFormSubmission> = (() => {
  if (mongoose.models.FormSubmission) {
    mongoose.deleteModel('FormSubmission');
  }
  return mongoose.model<IFormSubmission>('FormSubmission', FormSubmissionSchema);
})();