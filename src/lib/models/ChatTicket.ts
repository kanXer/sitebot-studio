import mongoose, { Schema, Document, Model } from 'mongoose';
import crypto from 'crypto';

export interface ITicketMessage {
  id: string;
  role: 'user' | 'agent' | 'system';
  senderName?: string;
  content: string;
  timestamp: Date;
}

export interface IChatTicket extends Document {
  ticketId: string;
  botId: mongoose.Types.ObjectId | string;
  botName: string;
  sessionId: string;
  visitor: {
    name?: string;
    email?: string;
    phone?: string;
    ip?: string;
  };
  status: 'open' | 'waiting_admin' | 'admin_replied' | 'closed';
  lastUserMessage?: string;
  lastAdminReply?: string;
  assignedAdminJid?: string;
  alertMessageId?: string;
  messages: ITicketMessage[];
  closedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const TicketMessageSchema = new Schema(
  {
    id: { type: String, default: () => crypto.randomUUID() },
    role: {
      type: String,
      enum: ['user', 'agent', 'system'],
      required: true,
    },
    senderName: { type: String, default: '' },
    content: { type: String, required: true },
    timestamp: { type: Date, default: () => new Date() },
  },
  { _id: false }
);

const ChatTicketSchema: Schema = new Schema(
  {
    ticketId: {
      type: String,
      required: true,
      unique: true,
      index: true,
      trim: true,
    },
    botId: {
      type: Schema.Types.Mixed,
      required: true,
      index: true,
    },
    botName: {
      type: String,
      default: 'Rivafy Assistant',
    },
    sessionId: {
      type: String,
      required: true,
      index: true,
      trim: true,
    },
    visitor: {
      name: { type: String, default: 'Visitor' },
      email: { type: String, default: '' },
      phone: { type: String, default: '' },
      ip: { type: String, default: '' },
    },
    status: {
      type: String,
      enum: ['open', 'waiting_admin', 'admin_replied', 'closed'],
      default: 'open',
      index: true,
    },
    lastUserMessage: {
      type: String,
      default: '',
    },
    lastAdminReply: {
      type: String,
      default: '',
    },
    assignedAdminJid: {
      type: String,
      default: '',
    },
    alertMessageId: {
      type: String,
      default: '',
      index: true,
    },
    messages: {
      type: [TicketMessageSchema],
      default: [],
    },
    closedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
    collection: 'chat_tickets',
  }
);

// Helpful compound indexes
ChatTicketSchema.index({ botId: 1, status: 1 });
ChatTicketSchema.index({ sessionId: 1, status: 1 });

export const ChatTicket: Model<IChatTicket> =
  mongoose.models.ChatTicket ||
  mongoose.model<IChatTicket>('ChatTicket', ChatTicketSchema);
