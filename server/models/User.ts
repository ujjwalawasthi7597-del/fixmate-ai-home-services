import mongoose, { Schema } from 'mongoose';
import type { Document, Types } from 'mongoose';

export type UserRole = 'customer' | 'provider' | 'admin';

export interface IUser extends Document {
  name: string;
  email: string;
  passwordHash: string;
  phone: string;
  role: UserRole;
  avatarUrl?: string;
  isActive: boolean;
  savedProviders: Types.ObjectId[];
  createdAt: Date;
  updatedAt: Date;
}

const userSchema = new Schema<IUser>(
  {
    name: { type: String, required: true, trim: true, minlength: 2, maxlength: 80 },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true, index: true },
    passwordHash: { type: String, required: true, select: false },
    phone: { type: String, trim: true, default: '' },
    role: { type: String, enum: ['customer', 'provider', 'admin'], default: 'customer', index: true },
    avatarUrl: { type: String, default: '' },
    isActive: { type: Boolean, default: true },
    savedProviders: [{ type: Schema.Types.ObjectId, ref: 'ProviderProfile' }],
  },
  { timestamps: true }
);

export const User = mongoose.model<IUser>('User', userSchema);
