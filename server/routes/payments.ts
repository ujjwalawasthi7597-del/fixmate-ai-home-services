import { Router } from 'express';
import { Payment } from '../models/Payment.ts';
import { Booking } from '../models/Booking.ts';
import { Quotation } from '../models/Quotation.ts';
import { requireDb } from '../config/db.ts';
import { ENV } from '../config/env.ts';
import { authenticateJWT, requireRole } from '../middleware/auth.ts';
import type { AuthenticatedRequest } from '../middleware/auth.ts';
import { paymentLimiter } from '../middleware/rateLimit.ts';
import {
  getRazorpayClient,
  verifyRazorpayPaymentSignature,
  verifyRazorpayWebhookSignature,
} from '../services/razorpay.ts';
import { createAndEmitNotification } from '../services/socket.ts';

const router = Router();
router.use(requireDb);

// Payment history scoped by role
router.get('/', authenticateJWT, async (req: AuthenticatedRequest, res, next) => {
  try {
    const filter: Record<string, unknown> = {};
    if (req.user!.role === 'customer') filter.customerId = req.user!.userId;
    if (req.user!.role === 'provider') filter.providerId = req.user!.userId;

    const payments = await Payment.find(filter)
      .populate('bookingId', 'bookingCode problemTitle scheduledDate status')
      .populate('customerId', 'name email')
      .populate('providerId', 'name email')
      .sort({ createdAt: -1 })
      .limit(50);

    res.json({ payments });
  } catch (err) {
    next(err);
  }
});

// Create Razorpay order on backend
router.post('/create-order', authenticateJWT, requireRole('customer'), paymentLimiter, async (req: AuthenticatedRequest, res, next) => {
  try {
    const { bookingId } = req.body;
    const booking = await Booking.findById(bookingId);
    if (!booking) {
      res.status(404).json({ error: 'Booking not found.' });
      return;
    }
    if (String(booking.customerId) !== req.user!.userId) {
      res.status(403).json({ error: 'You can only pay for your own bookings.' });
      return;
    }
    if (booking.paymentStatus === 'Paid') {
      res.status(409).json({ error: 'This booking has already been paid.' });
      return;
    }

    const quotation = await Quotation.findOne({ bookingId: booking._id });
    if (!quotation || quotation.status !== 'Approved') {
      res.status(400).json({ error: 'Quotation must be approved before initiating payment.' });
      return;
    }

    const razorpay = getRazorpayClient();
    const amountInPaise = Math.round(quotation.totalEstimatedAmount * 100);
    const order = await razorpay.orders.create({
      amount: amountInPaise,
      currency: 'INR',
      receipt: booking.bookingCode,
      notes: {
        bookingId: String(booking._id),
        customerId: String(booking.customerId),
      },
    });

    const payment = await Payment.create({
      bookingId: booking._id,
      quotationId: quotation._id,
      customerId: booking.customerId,
      providerId: booking.providerId,
      amount: quotation.totalEstimatedAmount,
      currency: 'INR',
      razorpayOrderId: order.id,
      status: 'Created',
    });

    res.status(201).json({
      orderId: order.id,
      amount: amountInPaise,
      currency: 'INR',
      keyId: ENV.RAZORPAY_KEY_ID,
      paymentId: payment._id,
      bookingCode: booking.bookingCode,
    });
  } catch (err) {
    next(err);
  }
});

// Verify Razorpay payment signature strictly on backend
router.post('/verify', authenticateJWT, requireRole('customer'), paymentLimiter, async (req: AuthenticatedRequest, res, next) => {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;
    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      res.status(400).json({ error: 'Missing Razorpay verification fields.' });
      return;
    }

    const payment = await Payment.findOne({ razorpayOrderId: razorpay_order_id });
    if (!payment) {
      res.status(404).json({ error: 'Payment order not found.' });
      return;
    }
    if (String(payment.customerId) !== req.user!.userId) {
      res.status(403).json({ error: 'Unauthorized payment verification.' });
      return;
    }

    const valid = verifyRazorpayPaymentSignature({
      razorpayOrderId: razorpay_order_id,
      razorpayPaymentId: razorpay_payment_id,
      razorpaySignature: razorpay_signature,
    });

    if (!valid) {
      payment.status = 'Failed';
      await payment.save();
      res.status(400).json({ error: 'Invalid payment signature. Verification failed.' });
      return;
    }

    payment.razorpayPaymentId = razorpay_payment_id;
    payment.razorpaySignature = razorpay_signature;
    payment.status = 'Paid';
    payment.paidAt = new Date();
    await payment.save();

    const booking = await Booking.findByIdAndUpdate(
      payment.bookingId,
      { paymentStatus: 'Paid' },
      { new: true }
    );

    if (booking) {
      await createAndEmitNotification({
        userId: String(booking.providerId),
        title: 'Payment Verified',
        message: `Customer completed payment of ₹${payment.amount} for booking ${booking.bookingCode}.`,
        type: 'payment_update',
        relatedBookingId: String(booking._id),
      });
    }

    res.json({ verified: true, payment, booking });
  } catch (err) {
    next(err);
  }
});

// Razorpay server-to-server webhook verification
router.post('/webhook', async (req, res, next) => {
  try {
    const signature = String(req.headers['x-razorpay-signature'] || '');
    const rawBody = (req as unknown as { rawBody?: string }).rawBody || JSON.stringify(req.body);

    if (!verifyRazorpayWebhookSignature(rawBody, signature)) {
      res.status(400).json({ error: 'Invalid Razorpay webhook signature.' });
      return;
    }

    const event = req.body?.event as string;
    const entity = req.body?.payload?.payment?.entity;

    if (event === 'payment.captured' && entity?.order_id) {
      const payment = await Payment.findOneAndUpdate(
        { razorpayOrderId: entity.order_id },
        {
          status: 'Paid',
          razorpayPaymentId: entity.id,
          method: entity.method || '',
          paidAt: new Date(),
        },
        { new: true }
      );
      if (payment) {
        await Booking.updateOne({ _id: payment.bookingId }, { paymentStatus: 'Paid' });
      }
    } else if (event === 'payment.failed' && entity?.order_id) {
      await Payment.updateOne({ razorpayOrderId: entity.order_id }, { status: 'Failed' });
    }

    res.json({ received: true });
  } catch (err) {
    next(err);
  }
});

// Request / process refund
router.post('/:id/refund', authenticateJWT, async (req: AuthenticatedRequest, res, next) => {
  try {
    const { reason } = req.body;
    const payment = await Payment.findById(req.params.id);
    if (!payment) {
      res.status(404).json({ error: 'Payment record not found.' });
      return;
    }

    const isOwner = String(payment.customerId) === req.user!.userId;
    const isAdmin = req.user!.role === 'admin';
    if (!isOwner && !isAdmin) {
      res.status(403).json({ error: 'Access denied.' });
      return;
    }
    if (payment.status !== 'Paid' || !payment.razorpayPaymentId) {
      res.status(400).json({ error: 'Only completed online payments can be refunded.' });
      return;
    }

    if (isAdmin) {
      const razorpay = getRazorpayClient();
      const refund = await razorpay.payments.refund(payment.razorpayPaymentId, {
        amount: Math.round(payment.amount * 100),
        notes: { reason: reason || 'Admin approved refund' },
      });
      payment.status = 'Refunded';
      payment.refundStatus = 'Processed';
      payment.refundId = refund.id;
      payment.refundReason = reason || 'Admin approved refund';
      await payment.save();
      await Booking.updateOne({ _id: payment.bookingId }, { paymentStatus: 'Refunded' });
    } else {
      payment.status = 'Refund Requested';
      payment.refundStatus = 'Pending';
      payment.refundReason = reason || 'Customer requested refund';
      await payment.save();
    }

    res.json({ payment });
  } catch (err) {
    next(err);
  }
});

export default router;
