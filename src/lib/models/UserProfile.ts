import mongoose, { Schema, Document, Model } from 'mongoose';

export type PlanType = 'free' | 'pro';

export interface INotificationConfig {
  email: {
    enabled: boolean;
    to: string;
  };
  whatsapp: {
    enabled: boolean;
    number: string;
  };
  telegram: {
    enabled: boolean;
    chatId: string;
    botToken: string;
  };
}

export interface IUsageMetrics {
  inputTokens: number;
  outputTokens: number;
  chats: number;
  leads: number;
}

export interface IUserProfile extends Document {
  userId: string;
  email: string;
  name: string;
  avatar: string;
  companyName: string;
  phone: string;
  address: {
    street: string;
    city: string;
    state: string;
    country: string;
    zip: string;
  };
  payment: {
    paypalEmail: string;
    payerId: string;
  };
  plan: PlanType;
  planExpiresAt?: Date;
  botLimit: number;
  tokenQuota: number;
  chatQuota: number;
  usage: IUsageMetrics;
  notifications: INotificationConfig;
  createdAt: Date;
  updatedAt: Date;
}

export const DEFAULT_BOT_LIMIT = 1;
export const DEFAULT_TOKEN_QUOTA = 250000;
export const DEFAULT_CHAT_QUOTA = 5000;

const UserProfileSchema: Schema = new Schema(
  {
    userId: {
      type: String,
      default: '',
      trim: true,
      index: true,
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      trim: true,
      lowercase: true,
      index: true,
    },
    name: {
      type: String,
      default: '',
      trim: true,
    },
    avatar: {
      type: String,
      default: '',
    },
    companyName: {
      type: String,
      default: '',
      trim: true,
    },
    phone: {
      type: String,
      default: '',
      trim: true,
    },
    address: {
      street: { type: String, default: '' },
      city: { type: String, default: '' },
      state: { type: String, default: '' },
      country: { type: String, default: '' },
      zip: { type: String, default: '' },
    },
    payment: {
      paypalEmail: { type: String, default: '' },
      payerId: { type: String, default: '' },
    },
    plan: {
      type: String,
      enum: ['free', 'pro'],
      default: 'free',
    },
    planExpiresAt: {
      type: Date,
      default: null,
    },
    botLimit: {
      type: Number,
      default: DEFAULT_BOT_LIMIT,
    },
    tokenQuota: {
      type: Number,
      default: DEFAULT_TOKEN_QUOTA,
    },
    chatQuota: {
      type: Number,
      default: DEFAULT_CHAT_QUOTA,
    },
    usage: {
      inputTokens: { type: Number, default: 0 },
      outputTokens: { type: Number, default: 0 },
      chats: { type: Number, default: 0 },
      leads: { type: Number, default: 0 },
    },
    notifications: {
      email: {
        enabled: { type: Boolean, default: false },
        to: { type: String, default: '' },
      },
      whatsapp: {
        enabled: { type: Boolean, default: false },
        number: { type: String, default: '' },
      },
      telegram: {
        enabled: { type: Boolean, default: false },
        chatId: { type: String, default: '' },
        botToken: { type: String, default: '' },
      },
    },
  },
  {
    timestamps: true,
    collection: 'user_profiles',
  }
);

export const UserProfile: Model<IUserProfile> = (() => {
  if (mongoose.models.UserProfile) {
    mongoose.deleteModel('UserProfile');
  }
  return mongoose.model<IUserProfile>('UserProfile', UserProfileSchema);
})();