import mongoose, { Schema, Document, Model } from 'mongoose';

export type AdminRole = 'super_admin' | 'admin';

export interface IAdminUser extends Document {
  email: string;
  role: AdminRole;
  addedBy: string;
  name?: string;
  createdAt: Date;
  updatedAt: Date;
}

const AdminUserSchema: Schema = new Schema(
  {
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      trim: true,
      lowercase: true,
      index: true,
    },
    role: {
      type: String,
      enum: ['super_admin', 'admin'],
      default: 'admin',
      required: true,
    },
    addedBy: {
      type: String,
      default: 'system',
      trim: true,
      lowercase: true,
    },
    name: {
      type: String,
      default: '',
      trim: true,
    },
  },
  {
    timestamps: true,
    collection: 'admin_users',
  }
);

export const AdminUser: Model<IAdminUser> = (() => {
  if (mongoose.models.AdminUser) {
    mongoose.deleteModel('AdminUser');
  }
  return mongoose.model<IAdminUser>('AdminUser', AdminUserSchema);
})();
