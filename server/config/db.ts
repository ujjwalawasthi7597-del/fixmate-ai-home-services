import mongoose from 'mongoose';
import type { Request, Response, NextFunction } from 'express';
import { ENV } from './env.ts';
import { ServiceCategory } from '../models/ServiceCategory.ts';

let dbError: string | null = null;

const DEFAULT_CATEGORIES = [
  { name: 'Electrician', slug: 'electrician', description: 'Wiring, MCB panels, smart switches, inverter setup, and fault diagnostics.', iconName: 'Zap', basePriceRange: '₹299 – ₹1,499', sortOrder: 1 },
  { name: 'Plumbing', slug: 'plumbing', description: 'Leak repairs, concealed piping, bathroom fittings, motor pumps, and drainage.', iconName: 'Droplets', basePriceRange: '₹249 – ₹1,299', sortOrder: 2 },
  { name: 'AC Repair & Maintenance', slug: 'ac-repair', description: 'Split/window AC servicing, gas pressure check, PCB repair, and uninstallation.', iconName: 'Wind', basePriceRange: '₹499 – ₹2,499', sortOrder: 3 },
  { name: 'Refrigerator Repair', slug: 'refrigerator-repair', description: 'Compressor diagnostics, thermostat replacement, defrost coils, and cooling issues.', iconName: 'ThermometerSnowflake', basePriceRange: '₹399 – ₹1,999', sortOrder: 4 },
  { name: 'Washing Machine Repair', slug: 'washing-machine-repair', description: 'Front & top-load drum repairs, drain pump service, and control board fixes.', iconName: 'RefreshCw', basePriceRange: '₹399 – ₹1,899', sortOrder: 5 },
  { name: 'Carpenter', slug: 'carpenter', description: 'Custom cabinetry, door locks, hinge alignment, modular furniture assembly.', iconName: 'Hammer', basePriceRange: '₹349 – ₹1,999', sortOrder: 6 },
  { name: 'Painting', slug: 'painting', description: 'Interior/exterior texture painting, waterproofing coats, and wood polishing.', iconName: 'Paintbrush', basePriceRange: '₹1,499 – ₹8,999', sortOrder: 7 },
  { name: 'Cleaning', slug: 'cleaning', description: 'Deep home sanitization, kitchen degreasing, bathroom descaling, and sofa care.', iconName: 'Sparkles', basePriceRange: '₹599 – ₹3,499', sortOrder: 8 },
  { name: 'Appliance Repair', slug: 'appliance-repair', description: 'Microwave, RO water purifier, chimney, geyser, and dishwasher repairs.', iconName: 'Wrench', basePriceRange: '₹349 – ₹1,799', sortOrder: 9 },
  { name: 'Pest Control', slug: 'pest-control', description: 'Gel treatment, termite barrier, rodent control, and herbal sanitization.', iconName: 'ShieldCheck', basePriceRange: '₹799 – ₹2,999', sortOrder: 10 },
];

export async function seedDefaultCategories() {
  const count = await ServiceCategory.countDocuments();
  if (count === 0) {
    await ServiceCategory.insertMany(DEFAULT_CATEGORIES);
  }
}

export async function connectDB(): Promise<boolean> {
  if (!ENV.MONGODB_URI) {
    dbError = 'MONGODB_URI is not configured in environment variables.';
    console.warn('[FixMate DB] MONGODB_URI missing — database-backed endpoints will report setup required.');
    return false;
  }

  try {
    await mongoose.connect(ENV.MONGODB_URI, {
      serverSelectionTimeoutMS: 5000,
    });
    dbError = null;
    console.log('[FixMate DB] Connected to MongoDB Atlas.');
    await seedDefaultCategories();
    return true;
  } catch (err) {
    dbError = err instanceof Error ? err.message : 'Failed to connect to MongoDB.';
    console.error('[FixMate DB] Connection error:', dbError);
    setTimeout(() => {
      if (!isDbConnected()) void connectDB();
    }, 20000);
    return false;
  }
}

export function isDbConnected(): boolean {
  return mongoose.connection.readyState === 1;
}

export function getDbError(): string | null {
  return dbError;
}

export function requireDb(_req: Request, res: Response, next: NextFunction) {
  if (!isDbConnected()) {
    res.status(503).json({
      error: ENV.MONGODB_URI
        ? `Database connection unavailable: ${dbError || 'Reconnecting...'}`
        : 'MongoDB database is not configured. Please add MONGODB_URI in Settings > Secrets.',
      code: 'DB_NOT_CONFIGURED',
    });
    return;
  }
  next();
}
