import mongoose, { Schema, Document, Model } from 'mongoose';
import crypto from 'crypto';

export interface IConversationMessage {
  id: string;
  role: 'user' | 'assistant' | 'agent' | 'system';
  senderName?: string;
  content: string;
  timestamp: Date;
}

export interface IConversation extends Document {
  botId: mongoose.Types.ObjectId | string;
  sessionId: string;
  visitor: {
    name?: string;
    email?: string;
    phone?: string;
    ip?: string;
  };
  status: 'bot' | 'waiting_agent' | 'agent_active' | 'resolved';
  handoffReason?: string;
  assignedAgent?: {
    id?: string;
    name?: string;
    email?: string;
  };
  messages: IConversationMessage[];
  lastMessageAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const ConversationMessageSchema = new Schema(
  {
    id: { type: String, default: () => crypto.randomUUID() },
    role: {
      type: String,
      enum: ['user', 'assistant', 'agent', 'system'],
      required: true,
    },
    senderName: { type: String, default: '' },
    content: { type: String, required: true },
    timestamp: { type: Date, default: () => new Date() },
  },
  { _id: false }
);

const ConversationSchema: Schema = new Schema(
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
    sessionId: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    visitor: {
      name: { type: String, default: 'Visitor' },
      email: { type: String, default: '' },
      phone: { type: String, default: '' },
      ip: { type: String, default: '' },
    },
    status: {
      type: String,
      enum: ['bot', 'waiting_agent', 'agent_active', 'resolved'],
      default: 'bot',
      index: true,
    },
    handoffReason: {
      type: String,
      default: '',
    },
    assignedAgent: {
      id: { type: String, default: '' },
      name: { type: String, default: '' },
      email: { type: String, default: '' },
    },
    messages: {
      type: [ConversationMessageSchema],
      default: [],
    },
    lastMessageAt: {
      type: Date,
      default: () => new Date(),
    },
  },
  {
    timestamps: true,
    collection: 'conversations',
  }
);

ConversationSchema.index({ botId: 1, sessionId: 1 }, { unique: true });
ConversationSchema.index({ botId: 1, status: 1, lastMessageAt: -1 });

export const Conversation: Model<IConversation> = (() => {
  if (mongoose.models.Conversation) {
    mongoose.deleteModel('Conversation');
  }
  return mongoose.model<IConversation>('Conversation', ConversationSchema);
})();
