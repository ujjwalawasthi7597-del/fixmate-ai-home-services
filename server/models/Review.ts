import mongoose, { Schema } from 'mongoose';
import type { Document, Types } from 'mongoose';

export interface IReview extends Document {
  bookingId: Types.ObjectId;
  customerId: Types.ObjectId;
  providerId: Types.ObjectId;
  providerProfileId: Types.ObjectId;
  rating: number;
  comment: string;
  isModerated: boolean;
  isVisible: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const reviewSchema = new Schema<IReview>(
  {
    bookingId: { type: Schema.Types.ObjectId, ref: 'Booking', required: true, unique: true, index: true },
    customerId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    providerId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    providerProfileId: { type: Schema.Types.ObjectId, ref: 'ProviderProfile', required: true, index: true },
    rating: { type: Number, required: true, min: 1, max: 5 },
    comment: { type: String, required: true, trim: true, maxlength: 1000 },
    isModerated: { type: Boolean, default: false },
    isVisible: { type: Boolean, default: true },
  },
  { timestamps: true }
);

export const Review = mongoose.model<IReview>('Review', reviewSchema);
