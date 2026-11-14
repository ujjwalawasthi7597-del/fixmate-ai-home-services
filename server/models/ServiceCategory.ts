import mongoose, { Schema } from 'mongoose';
import type { Document } from 'mongoose';

export interface IServiceCategory extends Document {
  name: string;
  slug: string;
  description: string;
  iconName: string;
  basePriceRange: string;
  isActive: boolean;
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
}

const serviceCategorySchema = new Schema<IServiceCategory>(
  {
    name: { type: String, required: true, trim: true },
    slug: { type: String, required: true, unique: true, lowercase: true, trim: true, index: true },
    description: { type: String, default: '' },
    iconName: { type: String, default: 'Wrench' },
    basePriceRange: { type: String, default: '₹299 – ₹1,999' },
    isActive: { type: Boolean, default: true, index: true },
    sortOrder: { type: Number, default: 0 },
  },
  { timestamps: true }
);

export const ServiceCategory = mongoose.model<IServiceCategory>('ServiceCategory', serviceCategorySchema);
