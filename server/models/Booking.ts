import mongoose, { Schema } from 'mongoose';
import type { Document, Types } from 'mongoose';

export type BookingStatus =
  | 'Pending'
  | 'Accepted'
  | 'Quotation Sent'
  | 'Awaiting Approval'
  | 'Confirmed'
  | 'In Progress'
  | 'Completed'
  | 'Cancelled'
  | 'Rejected';

export interface IBooking extends Document {
  bookingCode: string;
  customerId: Types.ObjectId;
  providerId: Types.ObjectId;
  providerProfileId: Types.ObjectId;
  serviceId?: Types.ObjectId;
  categorySlug: string;
  problemTitle: string;
  problemDescription: string;
  symptoms: string[];
  customerRequirements: string;
  technicianNotes: string;
  issueImages: string[];
  scheduledDate: string; // YYYY-MM-DD
  timeSlot: string; // e.g., "10:00 AM"
  addressSnapshot: {
    label: string;
    line1: string;
    line2?: string;
    city: string;
    state: string;
    postalCode: string;
    lat?: number;
    lng?: number;
  };
  status: BookingStatus;
  statusHistory: Array<{
    status: BookingStatus;
    changedBy: Types.ObjectId;
    note?: string;
    changedAt: Date;
  }>;
  cancellationReason?: string;
  paymentStatus: 'Unpaid' | 'Paid' | 'Refunded';
  createdAt: Date;
  updatedAt: Date;
}

const bookingSchema = new Schema<IBooking>(
  {
    bookingCode: { type: String, required: true, unique: true, index: true },
    customerId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    providerId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    providerProfileId: { type: Schema.Types.ObjectId, ref: 'ProviderProfile', required: true },
    serviceId: { type: Schema.Types.ObjectId, ref: 'Service' },
    categorySlug: { type: String, required: true, index: true },
    problemTitle: { type: String, required: true, trim: true, maxlength: 160 },
    problemDescription: { type: String, required: true, trim: true, maxlength: 3000 },
    symptoms: [{ type: String, trim: true }],
    customerRequirements: { type: String, default: '', maxlength: 1000 },
    technicianNotes: { type: String, default: '', maxlength: 1000 },
    issueImages: [{ type: String }],
    scheduledDate: { type: String, required: true, index: true },
    timeSlot: { type: String, required: true },
    addressSnapshot: {
      label: { type: String, default: 'Home' },
      line1: { type: String, required: true },
      line2: { type: String, default: '' },
      city: { type: String, required: true },
      state: { type: String, required: true },
      postalCode: { type: String, required: true },
      lat: { type: Number },
      lng: { type: Number },
    },
    status: {
      type: String,
      enum: [
        'Pending',
        'Accepted',
        'Quotation Sent',
        'Awaiting Approval',
        'Confirmed',
        'In Progress',
        'Completed',
        'Cancelled',
        'Rejected',
      ],
      default: 'Pending',
      index: true,
    },
    statusHistory: [
      {
        status: { type: String, required: true },
        changedBy: { type: Schema.Types.ObjectId, ref: 'User' },
        note: { type: String, default: '' },
        changedAt: { type: Date, default: Date.now },
      },
    ],
    cancellationReason: { type: String, default: '' },
    paymentStatus: { type: String, enum: ['Unpaid', 'Paid', 'Refunded'], default: 'Unpaid' },
  },
  { timestamps: true }
);

// Atomic double-booking prevention: only one active booking per provider, date, and slot
bookingSchema.index(
  { providerId: 1, scheduledDate: 1, timeSlot: 1 },
  {
    unique: true,
    partialFilterExpression: {
      status: {
        $in: ['Pending', 'Accepted', 'Quotation Sent', 'Awaiting Approval', 'Confirmed', 'In Progress', 'Completed'],
      },
    },
  }
);

export const Booking = mongoose.model<IBooking>('Booking', bookingSchema);
