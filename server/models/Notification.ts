import mongoose, { Schema } from 'mongoose';
import type { Document, Types } from 'mongoose';

export interface INotification extends Document {
  userId: Types.ObjectId;
  title: string;
  message: string;
  type:
    | 'booking_request'
    | 'booking_accepted'
    | 'booking_rejected'
    | 'quotation_sent'
    | 'quotation_approved'
    | 'quotation_rejected'
    | 'booking_confirmed'
    | 'job_completed'
    | 'payment_update'
    | 'message';
  relatedBookingId?: Types.ObjectId;
  isRead: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const notificationSchema = new Schema<INotification>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    title: { type: String, required: true, trim: true },
    message: { type: String, required: true, trim: true },
    type: {
      type: String,
      enum: [
        'booking_request',
        'booking_accepted',
        'booking_rejected',
        'quotation_sent',
        'quotation_approved',
        'quotation_rejected',
        'booking_confirmed',
        'job_completed',
        'payment_update',
        'message',
      ],
      required: true,
    },
    relatedBookingId: { type: Schema.Types.ObjectId, ref: 'Booking' },
    isRead: { type: Boolean, default: false, index: true },
  },
  { timestamps: true }
);

export const Notification = mongoose.model<INotification>('Notification', notificationSchema);
