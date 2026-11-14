import { Router } from 'express';
import { User } from '../models/User.ts';
import { ProviderProfile } from '../models/ProviderProfile.ts';
import { Booking } from '../models/Booking.ts';
import { Payment } from '../models/Payment.ts';
import { Review } from '../models/Review.ts';
import { Complaint } from '../models/Complaint.ts';
import { requireDb } from '../config/db.ts';
import { authenticateJWT, requireRole } from '../middleware/auth.ts';
import type { AuthenticatedRequest } from '../middleware/auth.ts';

const router = Router();
router.use(requireDb, authenticateJWT);

// Customer or provider files a complaint/dispute
router.post('/complaints', async (req: AuthenticatedRequest, res, next) => {
  try {
    const { bookingId, subject, description } = req.body;
    if (!subject || !description) {
      res.status(400).json({ error: 'Complaint subject and description are required.' });
      return;
    }
    const complaint = await Complaint.create({
      bookingId: bookingId || undefined,
      userId: req.user!.userId,
      subject,
      description,
    });
    res.status(201).json({ complaint });
  } catch (err) {
    next(err);
  }
});

router.get('/complaints/mine', async (req: AuthenticatedRequest, res, next) => {
  try {
    const complaints = await Complaint.find({ userId: req.user!.userId }).sort({ createdAt: -1 });
    res.json({ complaints });
  } catch (err) {
    next(err);
  }
});

// Admin-only analytics & management endpoints
router.get('/analytics', requireRole('admin'), async (_req, res, next) => {
  try {
    const [
      totalCustomers,
      totalProviders,
      pendingVerifications,
      totalBookings,
      activeJobs,
      completedJobs,
      paidPayments,
      openComplaints,
    ] = await Promise.all([
      User.countDocuments({ role: 'customer' }),
      User.countDocuments({ role: 'provider' }),
      ProviderProfile.countDocuments({ verificationStatus: 'pending' }),
      Booking.countDocuments(),
      Booking.countDocuments({ status: { $in: ['Confirmed', 'In Progress'] } }),
      Booking.countDocuments({ status: 'Completed' }),
      Payment.find({ status: 'Paid' }).select('amount createdAt').lean(),
      Complaint.countDocuments({ status: { $in: ['Open', 'Investigating'] } }),
    ]);

    const totalRevenue = paidPayments.reduce((sum, p) => sum + (p.amount || 0), 0);

    const bookingsByCategory = await Booking.aggregate([
      { $group: { _id: '$categorySlug', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]);

    const revenueByDay = await Payment.aggregate([
      { $match: { status: 'Paid' } },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
          revenue: { $sum: '$amount' },
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
      { $limit: 14 },
    ]);

    res.json({
      stats: {
        totalCustomers,
        totalProviders,
        pendingVerifications,
        totalBookings,
        activeJobs,
        completedJobs,
        totalTransactions: paidPayments.length,
        totalRevenue,
        openComplaints,
      },
      bookingsByCategory,
      revenueByDay,
    });
  } catch (err) {
    next(err);
  }
});

router.get('/users', requireRole('admin'), async (req, res, next) => {
  try {
    const role = req.query.role as string | undefined;
    const filter: Record<string, string> = {};
    if (role && ['customer', 'provider', 'admin'].includes(role)) {
      filter.role = role;
    }
    const users = await User.find(filter).sort({ createdAt: -1 }).limit(100).lean();
    const profiles = await ProviderProfile.find().lean();
    const profileMap = new Map(profiles.map((p) => [String(p.userId), p]));

    res.json({
      users: users.map((u) => ({
        ...u,
        providerProfile: profileMap.get(String(u._id)) || null,
      })),
    });
  } catch (err) {
    next(err);
  }
});

router.patch('/users/:id/status', requireRole('admin'), async (req, res, next) => {
  try {
    const user = await User.findByIdAndUpdate(
      req.params.id,
      { isActive: Boolean(req.body.isActive) },
      { new: true }
    );
    if (!user) {
      res.status(404).json({ error: 'User not found.' });
      return;
    }
    res.json({ user });
  } catch (err) {
    next(err);
  }
});

router.patch('/providers/:id/verify', requireRole('admin'), async (req, res, next) => {
  try {
    const { verificationStatus, verificationNotes } = req.body;
    if (!['verified', 'rejected', 'pending'].includes(verificationStatus)) {
      res.status(400).json({ error: 'Invalid verification status.' });
      return;
    }

    const profile = await ProviderProfile.findByIdAndUpdate(
      req.params.id,
      { verificationStatus, verificationNotes: verificationNotes || '' },
      { new: true }
    );
    if (!profile) {
      res.status(404).json({ error: 'Provider profile not found.' });
      return;
    }
    res.json({ providerProfile: profile });
  } catch (err) {
    next(err);
  }
});

router.get('/complaints', requireRole('admin'), async (_req, res, next) => {
  try {
    const complaints = await Complaint.find()
      .populate('userId', 'name email role')
      .populate('bookingId', 'bookingCode problemTitle')
      .sort({ createdAt: -1 });
    res.json({ complaints });
  } catch (err) {
    next(err);
  }
});

router.patch('/complaints/:id', requireRole('admin'), async (req, res, next) => {
  try {
    const { status, adminResolution } = req.body;
    const complaint = await Complaint.findByIdAndUpdate(
      req.params.id,
      { status, adminResolution: adminResolution || '' },
      { new: true }
    );
    if (!complaint) {
      res.status(404).json({ error: 'Complaint not found.' });
      return;
    }
    res.json({ complaint });
  } catch (err) {
    next(err);
  }
});

router.get('/reviews', requireRole('admin'), async (_req, res, next) => {
  try {
    const reviews = await Review.find()
      .populate('customerId', 'name email')
      .populate('providerProfileId', 'businessName')
      .sort({ createdAt: -1 })
      .limit(100);
    res.json({ reviews });
  } catch (err) {
    next(err);
  }
});

export default router;
