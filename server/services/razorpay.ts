import crypto from 'node:crypto';
import Razorpay from 'razorpay';
import { ENV } from '../config/env.ts';

export function getRazorpayClient(): Razorpay {
  if (!ENV.RAZORPAY_KEY_ID || !ENV.RAZORPAY_KEY_SECRET) {
    throw Object.assign(
      new Error('Razorpay payment gateway is not configured. Add RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET in Settings > Secrets.'),
      { status: 503 }
    );
  }
  return new Razorpay({
    key_id: ENV.RAZORPAY_KEY_ID,
    key_secret: ENV.RAZORPAY_KEY_SECRET,
  });
}

export function verifyRazorpayPaymentSignature(params: {
  razorpayOrderId: string;
  razorpayPaymentId: string;
  razorpaySignature: string;
}): boolean {
  if (!ENV.RAZORPAY_KEY_SECRET) return false;
  const expected = crypto
    .createHmac('sha256', ENV.RAZORPAY_KEY_SECRET)
    .update(`${params.razorpayOrderId}|${params.razorpayPaymentId}`)
    .digest('hex');
  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(params.razorpaySignature));
}

export function verifyRazorpayWebhookSignature(rawBody: string, signatureHeader: string): boolean {
  if (!ENV.RAZORPAY_WEBHOOK_SECRET || !signatureHeader) return false;
  const expected = crypto
    .createHmac('sha256', ENV.RAZORPAY_WEBHOOK_SECRET)
    .update(rawBody)
    .digest('hex');
  try {
    return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signatureHeader));
  } catch {
    return false;
  }
}
