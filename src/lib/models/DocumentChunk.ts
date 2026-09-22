import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IDocumentChunk extends Document {
  chatbotId: mongoose.Types.ObjectId;
  pageUrl: string;
  content: string;
  embedding: number[];
  metadata: {
    title?: string;
    chunkIndex?: number;
    totalChunks?: number;
    charCount?: number;
    [key: string]: unknown;
  };
  createdAt: Date;
  updatedAt: Date;
}

const DocumentChunkSchema: Schema = new Schema(
  {
    chatbotId: {
      type: Schema.Types.ObjectId,
      ref: 'Chatbot',
      required: true,
      index: true,
    },
    pageUrl: {
      type: String,
      required: true,
      trim: true,
    },
    content: {
      type: String,
      required: true,
    },
    embedding: {
      type: [Number],
      required: true,
    },
    metadata: {
      type: Schema.Types.Mixed,
      default: {},
    },
  },
  {
    timestamps: true,
  }
);

// Helpful compound index for queries
DocumentChunkSchema.index({ chatbotId: 1, pageUrl: 1 });

export const DocumentChunk: Model<IDocumentChunk> = (() => {
  if (mongoose.models.DocumentChunk) {
    mongoose.deleteModel('DocumentChunk');
  }
  return mongoose.model<IDocumentChunk>('DocumentChunk', DocumentChunkSchema);
})();
