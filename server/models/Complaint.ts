import mongoose, { Schema } from 'mongoose';
import type { Document, Types } from 'mongoose';

export interface IComplaint extends Document {
  bookingId?: Types.ObjectId;
  userId: Types.ObjectId;
  subject: string;
  description: string;
  status: 'Open' | 'Investigating' | 'Resolved';
  adminResolution?: string;
  createdAt: Date;
  updatedAt: Date;
}

const complaintSchema = new Schema<IComplaint>(
  {
    bookingId: { type: Schema.Types.ObjectId, ref: 'Booking' },
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    subject: { type: String, required: true, trim: true, maxlength: 160 },
    description: { type: String, required: true, trim: true, maxlength: 2000 },
    status: { type: String, enum: ['Open', 'Investigating', 'Resolved'], default: 'Open', index: true },
    adminResolution: { type: String, default: '' },
  },
  { timestamps: true }
);

export const Complaint = mongoose.model<IComplaint>('Complaint', complaintSchema);
