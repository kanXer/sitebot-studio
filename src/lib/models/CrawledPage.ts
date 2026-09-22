import mongoose, { Schema, Document, Model } from 'mongoose';

export interface ICrawledPage extends Document {
  chatbotId: mongoose.Types.ObjectId;
  url: string;
  title: string;
  status: 'queued' | 'indexing' | 'indexed' | 'failed';
  chunkCount: number;
  error?: string;
  createdAt: Date;
  updatedAt: Date;
}

const CrawledPageSchema: Schema = new Schema(
  {
    chatbotId: {
      type: Schema.Types.ObjectId,
      ref: 'Chatbot',
      required: true,
      index: true,
    },
    url: {
      type: String,
      required: true,
      trim: true,
    },
    title: {
      type: String,
      default: '',
      trim: true,
    },
    status: {
      type: String,
      enum: ['queued', 'indexing', 'indexed', 'failed'],
      default: 'queued',
    },
    chunkCount: {
      type: Number,
      default: 0,
    },
    error: {
      type: String,
      default: '',
    },
  },
  {
    timestamps: true,
  }
);

CrawledPageSchema.index({ chatbotId: 1, url: 1 }, { unique: true });

export const CrawledPage: Model<ICrawledPage> = (() => {
  if (mongoose.models.CrawledPage) {
    mongoose.deleteModel('CrawledPage');
  }
  return mongoose.model<ICrawledPage>('CrawledPage', CrawledPageSchema);
})();
