import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IChatbot extends Document {
  name: string;
  siteUrl: string;
  systemPrompt: string;
  primaryColor: string;
  position: 'bottom-right' | 'bottom-left';
  chatProvider: 'gemini' | 'openrouter' | 'openai' | 'nvidia';
  chatModel: string;
  embedProvider: 'gemini' | 'openrouter' | 'openai' | 'nvidia' | string;
  embedModel: string;
  apiKeys: {
    gemini?: string;
    openrouter?: string;
    openai?: string;
    nvidia?: string;
  };
  greeting: string;
  suggestedQuestions: string[];
  phone?: string;
  whatsapp?: string;
  email?: string;
  auditUrl?: string;
  pricingUrl?: string;
  launcherStyle?: 'standard' | 'minimal' | 'pill' | 'chat';
  customLinks?: Array<{ label: string; url: string }>;
  slug?: string;
  allowedOrigins?: string[];
  rateLimit?: {
    enabled: boolean;
    maxRequests: number;
    windowMs: number;
  };
  customVectorDb?: {
    enabled: boolean;
    provider: 'qdrant' | string;
    url: string;
    apiKey: string;
    collectionName?: string;
  };
  createdAt: Date;
  updatedAt: Date;
}

const ChatbotSchema: Schema = new Schema(
  {
    name: {
      type: String,
      required: [true, 'Chatbot name is required'],
      trim: true,
      maxlength: [100, 'Name cannot exceed 100 characters'],
    },
    siteUrl: {
      type: String,
      required: [true, 'Site URL is required'],
      trim: true,
    },
    systemPrompt: {
      type: String,
      default:
        'You are an intelligent, helpful, and friendly AI assistant for this website. Answer questions accurately and concisely based strictly on the provided context. If the context does not contain enough information to answer, politely state that you do not have that specific information rather than guessing. Maintain a warm, professional tone.',
      maxlength: [4000, 'System prompt cannot exceed 4000 characters'],
    },
    primaryColor: {
      type: String,
      default: '#6366f1',
      trim: true,
    },
    position: {
      type: String,
      enum: ['bottom-right', 'bottom-left'],
      default: 'bottom-right',
    },
    chatProvider: {
      type: String,
      default: 'nvidia',
    },
    chatModel: {
      type: String,
      default: 'meta/muse-glimmer-30b',
    },
    embedProvider: {
      type: String,
      default: 'nvidia',
    },
    embedModel: {
      type: String,
      default: 'text-embedding-004',
    },
    apiKeys: {
      gemini: { type: String, default: '' },
      openrouter: { type: String, default: '' },
      openai: { type: String, default: '' },
      nvidia: { type: String, default: '' },
    },
    greeting: {
      type: String,
      default: 'Hi there! 👋 How can I help you today?',
      maxlength: [300, 'Greeting cannot exceed 300 characters'],
    },
    suggestedQuestions: {
      type: [String],
      default: [
        'What services or products do you offer?',
        'How do I get started?',
        'What are your key features and pricing?',
      ],
    },
    phone: { type: String, default: '' },
    whatsapp: { type: String, default: '' },
    email: { type: String, default: '' },
    auditUrl: { type: String, default: '' },
    pricingUrl: { type: String, default: '' },
    launcherStyle: {
      type: String,
      enum: ['standard', 'minimal', 'pill', 'chat'],
      default: 'standard',
    },
    customLinks: {
      type: [{ label: String, url: String }],
      default: [],
    },
    slug: {
      type: String,
      trim: true,
      lowercase: true,
      unique: true,
      sparse: true,
      maxlength: [40, 'Custom bot ID cannot exceed 40 characters'],
      match: [/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/, 'Custom bot ID can only contain lowercase letters, numbers and dashes'],
    },
    allowedOrigins: {
      type: [String],
      default: [],
    },
    rateLimit: {
      enabled: { type: Boolean, default: false },
      maxRequests: { type: Number, default: 20 },
      windowMs: { type: Number, default: 60000 },
    },
    customVectorDb: {
      enabled: { type: Boolean, default: false },
      provider: { type: String, default: 'qdrant' },
      url: { type: String, default: '' },
      apiKey: { type: String, default: '' },
      collectionName: { type: String, default: '' },
    },
  },
  {
    timestamps: true,
  }
);

export const Chatbot: Model<IChatbot> = (() => {
  if (mongoose.models.Chatbot) {
    mongoose.deleteModel('Chatbot');
  }
  return mongoose.model<IChatbot>('Chatbot', ChatbotSchema);
})();
