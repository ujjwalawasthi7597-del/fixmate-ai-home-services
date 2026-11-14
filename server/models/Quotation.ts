import mongoose, { Schema } from 'mongoose';
import type { Document, Types } from 'mongoose';

export interface IQuotation extends Document {
  bookingId: Types.ObjectId;
  providerId: Types.ObjectId;
  customerId: Types.ObjectId;
  inspectionCharges: number;
  labourCharges: number;
  estimatedMaterialCosts: number;
  additionalCharges: number;
  totalEstimatedAmount: number;
  expectedCompletionTime: string;
  workDescription: string;
  status: 'Pending Approval' | 'Approved' | 'Rejected';
  customerDecisionAt?: Date;
  rejectionReason?: string;
  createdAt: Date;
  updatedAt: Date;
}

const quotationSchema = new Schema<IQuotation>(
  {
    bookingId: { type: Schema.Types.ObjectId, ref: 'Booking', required: true, unique: true, index: true },
    providerId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    customerId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    inspectionCharges: { type: Number, required: true, min: 0 },
    labourCharges: { type: Number, required: true, min: 0 },
    estimatedMaterialCosts: { type: Number, required: true, min: 0 },
    additionalCharges: { type: Number, default: 0, min: 0 },
    totalEstimatedAmount: { type: Number, required: true, min: 1 },
    expectedCompletionTime: { type: String, required: true, trim: true },
    workDescription: { type: String, required: true, trim: true, maxlength: 2000 },
    status: {
      type: String,
      enum: ['Pending Approval', 'Approved', 'Rejected'],
      default: 'Pending Approval',
      index: true,
    },
    customerDecisionAt: { type: Date },
    rejectionReason: { type: String, default: '' },
  },
  { timestamps: true }
);

export const Quotation = mongoose.model<IQuotation>('Quotation', quotationSchema);
