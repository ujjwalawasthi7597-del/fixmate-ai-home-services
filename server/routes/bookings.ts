import { Router } from 'express';
import crypto from 'node:crypto';
import { Booking } from '../models/Booking.ts';
import type { BookingStatus } from '../models/Booking.ts';
import { Availability } from '../models/Availability.ts';
import { ProviderProfile } from '../models/ProviderProfile.ts';
import { Quotation } from '../models/Quotation.ts';
import { requireDb } from '../config/db.ts';
import { authenticateJWT, requireRole } from '../middleware/auth.ts';
import type { AuthenticatedRequest } from '../middleware/auth.ts';
import { createAndEmitNotification, getIO } from '../services/socket.ts';

const router = Router();
router.use(requireDb, authenticateJWT);

const DEFAULT_TIME_SLOTS = [
  '09:00 AM',
  '10:30 AM',
  '12:00 PM',
  '02:00 PM',
  '03:30 PM',
  '05:00 PM',
  '06:30 PM',
];

// List bookings scoped by user role
router.get('/', async (req: AuthenticatedRequest, res, next) => {
  try {
    const { status, page = '1', limit = '20' } = req.query as Record<string, string>;
    const filter: Record<string, unknown> = {};

    if (req.user!.role === 'customer') {
      filter.customerId = req.user!.userId;
    } else if (req.user!.role === 'provider') {
      filter.providerId = req.user!.userId;
    }

    if (status && status !== 'All') {
      filter.status = status;
    }

    const pageNum = Math.max(1, Number(page) || 1);
    const limitNum = Math.min(50, Math.max(1, Number(limit) || 20));

    const [bookings, total] = await Promise.all([
      Booking.find(filter)
        .populate('customerId', 'name email phone')
        .populate('providerId', 'name email phone')
        .populate('providerProfileId', 'businessName verificationStatus ratingAverage serviceLocation')
        .populate('serviceId', 'title basePrice')
        .sort({ createdAt: -1 })
        .skip((pageNum - 1) * limitNum)
        .limit(limitNum)
        .lean(),
      Booking.countDocuments(filter),
    ]);

    const bookingIds = bookings.map((b) => b._id);
    const quotations = await Quotation.find({ bookingId: { $in: bookingIds } }).lean();
    const quotationMap = new Map(quotations.map((q) => [String(q.bookingId), q]));

    const enriched = bookings.map((b) => ({
      ...b,
      quotation: quotationMap.get(String(b._id)) || null,
    }));

    res.json({
      bookings: enriched,
      pagination: { total, page: pageNum, pages: Math.ceil(total / limitNum) },
    });
  } catch (err) {
    next(err);
  }
});

// Get single booking with ownership check
router.get('/:id', async (req: AuthenticatedRequest, res, next) => {
  try {
    const booking = await Booking.findById(req.params.id)
      .populate('customerId', 'name email phone')
      .populate('providerId', 'name email phone')
      .populate('providerProfileId', 'businessName verificationStatus ratingAverage serviceLocation')
      .populate('serviceId', 'title basePrice');

    if (!booking) {
      res.status(404).json({ error: 'Booking not found.' });
      return;
    }

    const isCustomer = String(booking.customerId._id) === req.user!.userId;
    const isProvider = String(booking.providerId._id) === req.user!.userId;
    const isAdmin = req.user!.role === 'admin';

    if (!isCustomer && !isProvider && !isAdmin) {
      res.status(403).json({ error: 'You do not have permission to view this booking.' });
      return;
    }

    const quotation = await Quotation.findOne({ bookingId: booking._id });
    res.json({ booking, quotation });
  } catch (err) {
    next(err);
  }
});

// Create booking with atomic slot locking & double-booking guard
router.post('/', requireRole('customer'), async (req: AuthenticatedRequest, res, next) => {
  try {
    const {
      providerProfileId,
      serviceId,
      categorySlug,
      problemTitle,
      problemDescription,
      symptoms,
      customerRequirements,
      technicianNotes,
      issueImages,
      scheduledDate,
      timeSlot,
      addressSnapshot,
    } = req.body;

    if (!providerProfileId || !categorySlug || !problemTitle || !problemDescription || !scheduledDate || !timeSlot || !addressSnapshot?.line1) {
      res.status(400).json({ error: 'Missing required booking details (provider, problem, date, slot, and address).' });
      return;
    }

    const profile = await ProviderProfile.findById(providerProfileId);
    if (!profile) {
      res.status(404).json({ error: 'Selected service provider not found.' });
      return;
    }

    // Ensure availability document exists for this provider & date
    let availability = await Availability.findOne({ providerId: profile.userId, date: scheduledDate });
    if (!availability) {
      availability = await Availability.create({
        providerId: profile.userId,
        date: scheduledDate,
        slots: DEFAULT_TIME_SLOTS.map((time) => ({ time, isBooked: false })),
        isBlockedDay: false,
      });
    }

    if (availability.isBlockedDay) {
      res.status(409).json({ error: 'The provider is unavailable on the selected date.' });
      return;
    }

    // Atomically claim the slot in Availability
    const claimedSlot = await Availability.findOneAndUpdate(
      {
        providerId: profile.userId,
        date: scheduledDate,
        isBlockedDay: false,
        slots: { $elemMatch: { time: timeSlot, isBooked: false } },
      },
      { $set: { 'slots.$.isBooked': true } },
      { new: true }
    );

    if (!claimedSlot) {
      res.status(409).json({ error: 'Selected time slot is already booked or unavailable. Please choose another slot.' });
      return;
    }

    const bookingCode = `FM-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;

    let booking;
    try {
      booking = await Booking.create({
        bookingCode,
        customerId: req.user!.userId,
        providerId: profile.userId,
        providerProfileId: profile._id,
        serviceId: serviceId || undefined,
        categorySlug,
        problemTitle,
        problemDescription,
        symptoms: Array.isArray(symptoms) ? symptoms : [],
        customerRequirements: customerRequirements || '',
        technicianNotes: technicianNotes || '',
        issueImages: Array.isArray(issueImages) ? issueImages : [],
        scheduledDate,
        timeSlot,
        addressSnapshot,
        status: 'Pending',
        statusHistory: [
          {
            status: 'Pending',
            changedBy: req.user!.userId as never,
            note: 'Booking request submitted by customer.',
            changedAt: new Date(),
          },
        ],
      });
    } catch (createErr) {
      // Rollback slot lock if Booking insert fails (e.g., partial unique index hit)
      await Availability.updateOne(
        { providerId: profile.userId, date: scheduledDate, 'slots.time': timeSlot },
        { $set: { 'slots.$.isBooked': false } }
      );
      throw createErr;
    }

    await Availability.updateOne(
      { providerId: profile.userId, date: scheduledDate, 'slots.time': timeSlot },
      { $set: { 'slots.$.bookingId': booking._id } }
    );

    await createAndEmitNotification({
      userId: String(profile.userId),
      title: 'New Booking Request',
      message: `New ${categorySlug} request (${bookingCode}) for ${scheduledDate} at ${timeSlot}.`,
      type: 'booking_request',
      relatedBookingId: String(booking._id),
    });

    getIO()?.to(`user:${profile.userId}`).emit('booking:updated', booking);

    res.status(201).json({ booking });
  } catch (err) {
    next(err);
  }
});

// Update booking status with role + transition rules
router.patch('/:id/status', async (req: AuthenticatedRequest, res, next) => {
  try {
    const { status, note, cancellationReason } = req.body as {
      status: BookingStatus;
      note?: string;
      cancellationReason?: string;
    };

    const booking = await Booking.findById(req.params.id);
    if (!booking) {
      res.status(404).json({ error: 'Booking not found.' });
      return;
    }

    const isCustomer = String(booking.customerId) === req.user!.userId;
    const isProvider = String(booking.providerId) === req.user!.userId;
    const isAdmin = req.user!.role === 'admin';

    if (!isCustomer && !isProvider && !isAdmin) {
      res.status(403).json({ error: 'Access denied.' });
      return;
    }

    if (status === 'Cancelled' && !isCustomer && !isAdmin) {
      res.status(403).json({ error: 'Only the customer or an admin can cancel this booking.' });
      return;
    }

    if (['Accepted', 'Rejected', 'In Progress', 'Completed'].includes(status) && !isProvider && !isAdmin) {
      res.status(403).json({ error: 'Only the assigned service provider can perform this status update.' });
      return;
    }

    // Prevent starting paid work without customer quotation approval
    if (status === 'In Progress') {
      const quotation = await Quotation.findOne({ bookingId: booking._id });
      if (quotation && quotation.status !== 'Approved') {
        res.status(400).json({ error: 'Cannot start work before the customer approves the quotation.' });
        return;
      }
      if (!quotation && booking.status !== 'Confirmed') {
        res.status(400).json({ error: 'Booking must be Confirmed with an approved quotation before starting work.' });
        return;
      }
    }

    booking.status = status;
    if (cancellationReason) booking.cancellationReason = cancellationReason;
    booking.statusHistory.push({
      status,
      changedBy: req.user!.userId as never,
      note: note || `Status changed to ${status}.`,
      changedAt: new Date(),
    });
    await booking.save();

    // Free the slot if booking is Cancelled or Rejected
    if (status === 'Cancelled' || status === 'Rejected') {
      await Availability.updateOne(
        { providerId: booking.providerId, date: booking.scheduledDate, 'slots.time': booking.timeSlot },
        { $set: { 'slots.$.isBooked': false }, $unset: { 'slots.$.bookingId': '' } }
      );
    }

    if (status === 'Completed') {
      await ProviderProfile.updateOne(
        { _id: booking.providerProfileId },
        { $inc: { completedJobsCount: 1 } }
      );
    }

    const notifyTarget = isProvider ? String(booking.customerId) : String(booking.providerId);
    const notifType =
      status === 'Accepted'
        ? 'booking_accepted'
        : status === 'Rejected'
        ? 'booking_rejected'
        : status === 'Completed'
        ? 'job_completed'
        : 'booking_confirmed';

    await createAndEmitNotification({
      userId: notifyTarget,
      title: `Booking ${status}`,
      message: `Booking ${booking.bookingCode} is now ${status}.`,
      type: notifType,
      relatedBookingId: String(booking._id),
    });

    getIO()?.to(`user:${booking.customerId}`).emit('booking:updated', booking);
    getIO()?.to(`user:${booking.providerId}`).emit('booking:updated', booking);

    res.json({ booking });
  } catch (err) {
    next(err);
  }
});

// Provider submits a quotation
router.post('/:id/quotation', requireRole('provider'), async (req: AuthenticatedRequest, res, next) => {
  try {
    const booking = await Booking.findById(req.params.id);
    if (!booking) {
      res.status(404).json({ error: 'Booking not found.' });
      return;
    }
    if (String(booking.providerId) !== req.user!.userId) {
      res.status(403).json({ error: 'Only the assigned provider can submit a quotation.' });
      return;
    }

    const {
      inspectionCharges = 0,
      labourCharges = 0,
      estimatedMaterialCosts = 0,
      additionalCharges = 0,
      expectedCompletionTime,
      workDescription,
    } = req.body;

    const totalEstimatedAmount =
      Number(inspectionCharges) +
      Number(labourCharges) +
      Number(estimatedMaterialCosts) +
      Number(additionalCharges);

    if (totalEstimatedAmount <= 0 || !expectedCompletionTime || !workDescription) {
      res.status(400).json({ error: 'Quotation must include a positive total, completion time, and description of work.' });
      return;
    }

    const quotation = await Quotation.findOneAndUpdate(
      { bookingId: booking._id },
      {
        bookingId: booking._id,
        providerId: booking.providerId,
        customerId: booking.customerId,
        inspectionCharges: Number(inspectionCharges),
        labourCharges: Number(labourCharges),
        estimatedMaterialCosts: Number(estimatedMaterialCosts),
        additionalCharges: Number(additionalCharges),
        totalEstimatedAmount,
        expectedCompletionTime,
        workDescription,
        status: 'Pending Approval',
      },
      { new: true, upsert: true }
    );

    booking.status = 'Awaiting Approval';
    booking.statusHistory.push({
      status: 'Awaiting Approval',
      changedBy: req.user!.userId as never,
      note: `Quotation of ₹${totalEstimatedAmount} sent for customer approval.`,
      changedAt: new Date(),
    });
    await booking.save();

    await createAndEmitNotification({
      userId: String(booking.customerId),
      title: 'Quotation Received',
      message: `Quotation of ₹${totalEstimatedAmount} received for ${booking.bookingCode}. Review & approve to confirm.`,
      type: 'quotation_sent',
      relatedBookingId: String(booking._id),
    });

    getIO()?.to(`user:${booking.customerId}`).emit('booking:updated', booking);

    res.status(201).json({ quotation, booking });
  } catch (err) {
    next(err);
  }
});

// Customer approves or rejects quotation
router.patch('/:id/quotation/decision', requireRole('customer'), async (req: AuthenticatedRequest, res, next) => {
  try {
    const { decision, rejectionReason } = req.body as { decision: 'Approved' | 'Rejected'; rejectionReason?: string };
    if (decision !== 'Approved' && decision !== 'Rejected') {
      res.status(400).json({ error: 'Decision must be Approved or Rejected.' });
      return;
    }

    const booking = await Booking.findById(req.params.id);
    if (!booking) {
      res.status(404).json({ error: 'Booking not found.' });
      return;
    }
    if (String(booking.customerId) !== req.user!.userId) {
      res.status(403).json({ error: 'Only the customer who created this booking can respond to the quotation.' });
      return;
    }

    const quotation = await Quotation.findOne({ bookingId: booking._id });
    if (!quotation) {
      res.status(404).json({ error: 'Quotation not found for this booking.' });
      return;
    }

    quotation.status = decision;
    quotation.customerDecisionAt = new Date();
    if (rejectionReason) quotation.rejectionReason = rejectionReason;
    await quotation.save();

    booking.status = decision === 'Approved' ? 'Confirmed' : 'Accepted';
    booking.statusHistory.push({
      status: booking.status,
      changedBy: req.user!.userId as never,
      note: decision === 'Approved' ? 'Customer approved quotation. Booking confirmed.' : `Customer rejected quotation: ${rejectionReason || 'No reason provided'}`,
      changedAt: new Date(),
    });
    await booking.save();

    await createAndEmitNotification({
      userId: String(booking.providerId),
      title: decision === 'Approved' ? 'Quotation Approved' : 'Quotation Rejected',
      message:
        decision === 'Approved'
          ? `Customer approved your ₹${quotation.totalEstimatedAmount} quotation for ${booking.bookingCode}. Booking is Confirmed.`
          : `Customer requested revisions on quotation for ${booking.bookingCode}.`,
      type: decision === 'Approved' ? 'quotation_approved' : 'quotation_rejected',
      relatedBookingId: String(booking._id),
    });

    getIO()?.to(`user:${booking.providerId}`).emit('booking:updated', booking);

    res.json({ quotation, booking });
  } catch (err) {
    next(err);
  }
});

export default router;
