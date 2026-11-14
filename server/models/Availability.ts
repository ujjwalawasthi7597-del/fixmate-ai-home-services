import mongoose, { Schema } from 'mongoose';
import type { Document, Types } from 'mongoose';

export interface IAvailabilitySlot {
  time: string;
  isBooked: boolean;
  bookingId?: Types.ObjectId;
}

export interface IAvailability extends Document {
  providerId: Types.ObjectId;
  date: string; // YYYY-MM-DD
  slots: IAvailabilitySlot[];
  isBlockedDay: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const availabilitySchema = new Schema<IAvailability>(
  {
    providerId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    date: { type: String, required: true },
    slots: [
      {
        time: { type: String, required: true },
        isBooked: { type: Boolean, default: false },
        bookingId: { type: Schema.Types.ObjectId, ref: 'Booking' },
      },
    ],
    isBlockedDay: { type: Boolean, default: false },
  },
  { timestamps: true }
);

availabilitySchema.index({ providerId: 1, date: 1 }, { unique: true });

export const Availability = mongoose.model<IAvailability>('Availability', availabilitySchema);
