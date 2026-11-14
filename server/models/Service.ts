import mongoose, { Schema } from 'mongoose';
import type { Document, Types } from 'mongoose';

export interface IService extends Document {
  providerId: Types.ObjectId;
  providerProfileId: Types.ObjectId;
  categorySlug: string;
  title: string;
  description: string;
  basePrice: number;
  durationMinutes: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const serviceSchema = new Schema<IService>(
  {
    providerId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    providerProfileId: { type: Schema.Types.ObjectId, ref: 'ProviderProfile', required: true, index: true },
    categorySlug: { type: String, required: true, index: true },
    title: { type: String, required: true, trim: true, maxlength: 120 },
    description: { type: String, default: '', maxlength: 800 },
    basePrice: { type: Number, required: true, min: 0 },
    durationMinutes: { type: Number, default: 60, min: 15, max: 720 },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

export const Service = mongoose.model<IService>('Service', serviceSchema);
