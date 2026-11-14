import 'dotenv/config';
import crypto from 'node:crypto';

const ephemeralJwtSecret = crypto.randomBytes(32).toString('hex');

export const ENV = {
  PORT: Number(process.env.PORT) || 3000,
  NODE_ENV: process.env.NODE_ENV || 'development',
  MONGODB_URI: process.env.MONGODB_URI || '',
  JWT_SECRET: process.env.JWT_SECRET || ephemeralJwtSecret,
  JWT_SECRET_CONFIGURED: Boolean(process.env.JWT_SECRET),
  GEMINI_API_KEY: process.env.GEMINI_API_KEY || '',
  CLOUDINARY_CLOUD_NAME: process.env.CLOUDINARY_CLOUD_NAME || '',
  CLOUDINARY_API_KEY: process.env.CLOUDINARY_API_KEY || '',
  CLOUDINARY_API_SECRET: process.env.CLOUDINARY_API_SECRET || '',
  RAZORPAY_KEY_ID: process.env.RAZORPAY_KEY_ID || '',
  RAZORPAY_KEY_SECRET: process.env.RAZORPAY_KEY_SECRET || '',
  RAZORPAY_WEBHOOK_SECRET: process.env.RAZORPAY_WEBHOOK_SECRET || '',
  FRONTEND_URL: process.env.FRONTEND_URL || process.env.APP_URL || 'http://localhost:3000',
};

export function getIntegrationStatus() {
  return {
    mongodbConfigured: Boolean(ENV.MONGODB_URI),
    jwtSecretConfigured: ENV.JWT_SECRET_CONFIGURED,
    geminiConfigured: Boolean(ENV.GEMINI_API_KEY),
    cloudinaryConfigured: Boolean(
      ENV.CLOUDINARY_CLOUD_NAME && ENV.CLOUDINARY_API_KEY && ENV.CLOUDINARY_API_SECRET
    ),
    razorpayConfigured: Boolean(ENV.RAZORPAY_KEY_ID && ENV.RAZORPAY_KEY_SECRET),
    razorpayWebhookConfigured: Boolean(ENV.RAZORPAY_WEBHOOK_SECRET),
  };
}
