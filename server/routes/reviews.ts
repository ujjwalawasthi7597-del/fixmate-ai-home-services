import { Router } from 'express';
import { Review } from '../models/Review.ts';
import { Booking } from '../models/Booking.ts';
import { ProviderProfile } from '../models/ProviderProfile.ts';
import { requireDb } from '../config/db.ts';
import { authenticateJWT, requireRole } from '../middleware/auth.ts';
import type { AuthenticatedRequest } from '../middleware/auth.ts';

const router = Router();
router.use(requireDb);

router.get('/', authenticateJWT, async (req: AuthenticatedRequest, res, next) => {
  try {
    const filter: Record<string, unknown> = {};
    if (req.user!.role === 'customer') filter.customerId = req.user!.userId;
    if (req.user!.role === 'provider') filter.providerId = req.user!.userId;

    const reviews = await Review.find(filter)
      .populate('customerId', 'name')
      .populate('providerProfileId', 'businessName')
      .populate('bookingId', 'bookingCode problemTitle')
      .sort({ createdAt: -1 })
      .limit(50);

    res.json({ reviews });
  } catch (err) {
    next(err);
  }
});

router.post('/', authenticateJWT, requireRole('customer'), async (req: AuthenticatedRequest, res, next) => {
  try {
    const { bookingId, rating, comment } = req.body;
    if (!bookingId || !rating || !comment) {
      res.status(400).json({ error: 'Booking ID, rating (1-5), and comment are required.' });
      return;
    }

    const booking = await Booking.findById(bookingId);
    if (!booking) {
      res.status(404).json({ error: 'Booking not found.' });
      return;
    }
    if (String(booking.customerId) !== req.user!.userId) {
      res.status(403).json({ error: 'You can only review your own completed bookings.' });
      return;
    }
    if (booking.status !== 'Completed') {
      res.status(400).json({ error: 'You can submit a review only after the job is Completed.' });
      return;
    }

    const numRating = Math.min(5, Math.max(1, Number(rating)));
    const review = await Review.create({
      bookingId: booking._id,
      customerId: booking.customerId,
      providerId: booking.providerId,
      providerProfileId: booking.providerProfileId,
      rating: numRating,
      comment: String(comment).trim(),
    });

    // Recompute provider rating aggregate
    const stats = await Review.aggregate([
      { $match: { providerProfileId: booking.providerProfileId, isVisible: true } },
      { $group: { _id: null, avg: { $avg: '$rating' }, count: { $sum: 1 } } },
    ]);

    if (stats[0]) {
      await ProviderProfile.updateOne(
        { _id: booking.providerProfileId },
        {
          ratingAverage: Number(stats[0].avg.toFixed(2)),
          ratingCount: stats[0].count,
        }
      );
    }

    res.status(201).json({ review });
  } catch (err) {
    next(err);
  }
});

router.patch('/:id/moderate', authenticateJWT, requireRole('admin'), async (req, res, next) => {
  try {
    const { isVisible } = req.body;
    const review = await Review.findByIdAndUpdate(
      req.params.id,
      { isVisible: Boolean(isVisible), isModerated: true },
      { new: true }
    );
    if (!review) {
      res.status(404).json({ error: 'Review not found.' });
      return;
    }
    res.json({ review });
  } catch (err) {
    next(err);
  }
});

export default router;
