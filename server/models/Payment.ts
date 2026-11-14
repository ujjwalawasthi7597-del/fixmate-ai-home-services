import mongoose, { Schema } from 'mongoose';
import type { Document, Types } from 'mongoose';

export interface IPayment extends Document {
  bookingId: Types.ObjectId;
  quotationId?: Types.ObjectId;
  customerId: Types.ObjectId;
  providerId: Types.ObjectId;
  amount: number;
  currency: string;
  razorpayOrderId: string;
  razorpayPaymentId?: string;
  razorpaySignature?: string;
  status: 'Created' | 'Paid' | 'Failed' | 'Refund Requested' | 'Refunded';
  refundId?: string;
  refundStatus?: 'None' | 'Pending' | 'Processed' | 'Failed';
  refundReason?: string;
  method?: string;
  paidAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const paymentSchema = new Schema<IPayment>(
  {
    bookingId: { type: Schema.Types.ObjectId, ref: 'Booking', required: true, index: true },
    quotationId: { type: Schema.Types.ObjectId, ref: 'Quotation' },
    customerId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    providerId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    amount: { type: Number, required: true, min: 1 },
    currency: { type: String, default: 'INR' },
    razorpayOrderId: { type: String, required: true, unique: true, index: true },
    razorpayPaymentId: { type: String, default: '' },
    razorpaySignature: { type: String, default: '' },
    status: {
      type: String,
      enum: ['Created', 'Paid', 'Failed', 'Refund Requested', 'Refunded'],
      default: 'Created',
      index: true,
    },
    refundId: { type: String, default: '' },
    refundStatus: { type: String, enum: ['None', 'Pending', 'Processed', 'Failed'], default: 'None' },
    refundReason: { type: String, default: '' },
    method: { type: String, default: '' },
    paidAt: { type: Date },
  },
  { timestamps: true }
);

export const Payment = mongoose.model<IPayment>('Payment', paymentSchema);
