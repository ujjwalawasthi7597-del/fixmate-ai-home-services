import mongoose, { Schema } from 'mongoose';
import type { Document, Types } from 'mongoose';

export interface IProviderProfile extends Document {
  userId: Types.ObjectId;
  businessName: string;
  bio: string;
  avatarUrl?: string;
  categories: string[];
  skills: string[];
  experienceYears: number;
  verificationStatus: 'pending' | 'verified' | 'rejected';
  verificationNotes?: string;
  ratingAverage: number;
  ratingCount: number;
  startingPrice: number;
  pricingMode: 'starting' | 'quotation';
  serviceLocation: {
    city: string;
    area: string;
    address: string;
    lat: number;
    lng: number;
    radiusKm: number;
  };
  workingHours: {
    start: string;
    end: string;
    days: string[];
  };
  completedJobsCount: number;
  createdAt: Date;
  updatedAt: Date;
}

const providerProfileSchema = new Schema<IProviderProfile>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, unique: true, index: true },
    businessName: { type: String, required: true, trim: true, maxlength: 120 },
    bio: { type: String, default: '', maxlength: 1000 },
    avatarUrl: { type: String, default: '' },
    categories: [{ type: String, required: true, index: true }],
    skills: [{ type: String, trim: true }],
    experienceYears: { type: Number, default: 1, min: 0, max: 60 },
    verificationStatus: {
      type: String,
      enum: ['pending', 'verified', 'rejected'],
      default: 'pending',
      index: true,
    },
    verificationNotes: { type: String, default: '' },
    ratingAverage: { type: Number, default: 0, min: 0, max: 5 },
    ratingCount: { type: Number, default: 0, min: 0 },
    startingPrice: { type: Number, default: 299, min: 0 },
    pricingMode: { type: String, enum: ['starting', 'quotation'], default: 'starting' },
    serviceLocation: {
      city: { type: String, required: true, trim: true, index: true },
      area: { type: String, default: '', trim: true, index: true },
      address: { type: String, default: '', trim: true },
      lat: { type: Number, default: 12.9716, min: -90, max: 90 },
      lng: { type: Number, default: 77.5946, min: -180, max: 180 },
      radiusKm: { type: Number, default: 15, min: 1, max: 100 },
    },
    workingHours: {
      start: { type: String, default: '09:00' },
      end: { type: String, default: '19:00' },
      days: {
        type: [String],
        default: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
      },
    },
    completedJobsCount: { type: Number, default: 0, min: 0 },
  },
  { timestamps: true }
);

providerProfileSchema.index({ 'serviceLocation.lat': 1, 'serviceLocation.lng': 1 });
providerProfileSchema.index({ businessName: 'text', bio: 'text', skills: 'text', 'serviceLocation.city': 'text', 'serviceLocation.area': 'text' });

export const ProviderProfile = mongoose.model<IProviderProfile>('ProviderProfile', providerProfileSchema);
