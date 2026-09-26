import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IWhatsAppAuth extends Document {
  sessionId: string;
  keyId: string;
  data: string;
  updatedAt: Date;
  createdAt: Date;
}

const WhatsAppAuthSchema: Schema = new Schema(
  {
    _id: {
      type: String,
      required: true,
    },
    sessionId: {
      type: String,
      required: true,
      index: true,
    },
    keyId: {
      type: String,
      required: true,
      index: true,
    },
    data: {
      type: String,
      required: true,
    },
  },
  {
    timestamps: true,
    collection: 'whatsapp_auth',
  }
);

// Compound index for fast retrieval of keys by session
WhatsAppAuthSchema.index({ sessionId: 1, keyId: 1 });

export const WhatsAppAuth: Model<IWhatsAppAuth> =
  mongoose.models.WhatsAppAuth ||
  mongoose.model<IWhatsAppAuth>('WhatsAppAuth', WhatsAppAuthSchema);
