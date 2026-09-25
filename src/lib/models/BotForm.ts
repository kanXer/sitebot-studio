import mongoose, { Schema, Document, Model } from 'mongoose';
import crypto from 'crypto';

export const FORM_INTENTS = [
  'APPOINTMENT_BOOKING',
  'LEAD_GENERATION',
  'REGISTRATION',
  'ORDER_FOOD_OR_ITEM',
  'SUPPORT_TICKET',
  'OTHER',
] as const;

export type FormIntent = (typeof FORM_INTENTS)[number];

export interface BotFormField {
  key: string;
  label: string;
  type: string;
  required: boolean;
  selector: string;
  placeholder?: string;
  options?: string[];
  inputType?: string;
}

export interface IBotForm extends Document {
  uuid: string;
  botId: mongoose.Types.ObjectId | string;
  formType: FormIntent;
  title: string;
  targetUrl: string;
  fieldsSchema: BotFormField[];
  submitEndpoint?: string;
  submitMethod?: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const BotFormSchema: Schema = new Schema(
  {
    _id: {
      type: String,
      default: () => crypto.randomUUID(),
    },
    botId: {
      type: Schema.Types.ObjectId,
      ref: 'Chatbot',
      required: true,
      index: true,
    },
    formType: {
      type: String,
      enum: FORM_INTENTS,
      required: true,
      default: 'OTHER',
    },
    title: {
      type: String,
      default: '',
      trim: true,
    },
    targetUrl: {
      type: String,
      required: true,
      trim: true,
    },
    fieldsSchema: {
      type: Schema.Types.Mixed,
      default: [],
    },
    submitEndpoint: {
      type: String,
      default: '',
      trim: true,
    },
    submitMethod: {
      type: String,
      default: 'POST',
      trim: true,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
    collection: 'bot_forms',
  }
);

BotFormSchema.index({ botId: 1, formType: 1 });

export const BotForm: Model<IBotForm> = (() => {
  if (mongoose.models.BotForm) {
    mongoose.deleteModel('BotForm');
  }
  return mongoose.model<IBotForm>('BotForm', BotFormSchema);
})();