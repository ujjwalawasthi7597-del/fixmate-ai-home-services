import { Router } from 'express';
import { ProviderProfile } from '../models/ProviderProfile.ts';
import { Service } from '../models/Service.ts';
import { Availability } from '../models/Availability.ts';
import { Review } from '../models/Review.ts';
import { User } from '../models/User.ts';
import { requireDb } from '../config/db.ts';
import { authenticateJWT, requireRole } from '../middleware/auth.ts';
import type { AuthenticatedRequest } from '../middleware/auth.ts';

const router = Router();
router.use(requireDb);

const DEFAULT_TIME_SLOTS = [
  '09:00 AM',
  '10:30 AM',
  '12:00 PM',
  '02:00 PM',
  '03:30 PM',
  '05:00 PM',
  '06:30 PM',
];

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// Public marketplace search & discovery
router.get('/', async (req, res, next) => {
  try {
    const {
      q,
      category,
      city,
      locality,
      area,
      verifiedOnly,
      maxPrice,
      maxDistanceKm,
      sort = 'rating',
      lat,
      lng,
      page = '1',
      limit = '12',
    } = req.query as Record<string, string>;

    const filter: Record<string, unknown> = {};
    if (category) filter.categories = category;
    if (city && city.trim()) {
      filter['serviceLocation.city'] = new RegExp(escapeRegex(city.trim()), 'i');
    }
    const localityFilter = (locality || area || '').trim();
    if (localityFilter) {
      filter['serviceLocation.area'] = new RegExp(escapeRegex(localityFilter), 'i');
    }
    if (verifiedOnly === 'true') filter.verificationStatus = 'verified';
    if (maxPrice && !Number.isNaN(Number(maxPrice))) {
      filter.startingPrice = { $lte: Number(maxPrice) };
    }
    if (q && q.trim()) {
      const regex = new RegExp(escapeRegex(q.trim()), 'i');
      filter.$or = [
        { businessName: regex },
        { bio: regex },
        { skills: regex },
        { 'serviceLocation.city': regex },
        { 'serviceLocation.area': regex },
        { categories: regex },
      ];
    }

    let sortObj: Record<string, 1 | -1> = { ratingAverage: -1, completedJobsCount: -1 };
    if (sort === 'price_asc') sortObj = { startingPrice: 1 };
    if (sort === 'experience') sortObj = { experienceYears: -1 };
    if (sort === 'jobs') sortObj = { completedJobsCount: -1 };

    const pageNum = Math.max(1, Number(page) || 1);
    const limitNum = Math.min(50, Math.max(1, Number(limit) || 12));

    const parsedLat = lat !== undefined && lat !== '' ? Number(lat) : NaN;
    const parsedLng = lng !== undefined && lng !== '' ? Number(lng) : NaN;
    const hasCoords =
      Number.isFinite(parsedLat) &&
      Number.isFinite(parsedLng) &&
      parsedLat >= -90 &&
      parsedLat <= 90 &&
      parsedLng >= -180 &&
      parsedLng <= 180;
    const parsedMaxDist =
      maxDistanceKm !== undefined && maxDistanceKm !== '' ? Number(maxDistanceKm) : NaN;
    const hasMaxDist = hasCoords && Number.isFinite(parsedMaxDist) && parsedMaxDist > 0;

    // When sorting by distance or filtering by coordinate radius, compute Haversine distance across matching records first
    if ((sort === 'distance' && hasCoords) || hasMaxDist) {
      const allMatches = await ProviderProfile.find(filter)
        .populate('userId', 'name avatarUrl phone')
        .sort(sortObj)
        .lean();

      let withDistances = allMatches.map((p) => {
        const pLat = p.serviceLocation?.lat;
        const pLng = p.serviceLocation?.lng;
        const distanceKm =
          typeof pLat === 'number' && typeof pLng === 'number' && Number.isFinite(pLat) && Number.isFinite(pLng)
            ? Number(haversineKm(parsedLat, parsedLng, pLat, pLng).toFixed(1))
            : null;
        return { ...p, distanceKm };
      });

      if (hasMaxDist) {
        withDistances = withDistances.filter(
          (p) => p.distanceKm !== null && p.distanceKm <= parsedMaxDist
        );
      }

      if (sort === 'distance') {
        withDistances.sort((a, b) => (a.distanceKm ?? 99999) - (b.distanceKm ?? 99999));
      }

      const total = withDistances.length;
      const paged = withDistances.slice((pageNum - 1) * limitNum, pageNum * limitNum);

      res.json({
        providers: paged,
        pagination: {
          total,
          page: pageNum,
          pages: Math.ceil(total / limitNum),
        },
      });
      return;
    }

    const [providers, total] = await Promise.all([
      ProviderProfile.find(filter)
        .populate('userId', 'name avatarUrl phone')
        .sort(sortObj)
        .skip((pageNum - 1) * limitNum)
        .limit(limitNum)
        .lean(),
      ProviderProfile.countDocuments(filter),
    ]);

    const enriched = providers.map((p) => {
      const pLat = p.serviceLocation?.lat;
      const pLng = p.serviceLocation?.lng;
      const distanceKm =
        hasCoords &&
        typeof pLat === 'number' &&
        typeof pLng === 'number' &&
        Number.isFinite(pLat) &&
        Number.isFinite(pLng)
          ? Number(haversineKm(parsedLat, parsedLng, pLat, pLng).toFixed(1))
          : null;
      return { ...p, distanceKm };
    });

    res.json({
      providers: enriched,
      pagination: {
        total,
        page: pageNum,
        pages: Math.ceil(total / limitNum),
      },
    });
  } catch (err) {
    next(err);
  }
});

// Provider manages own profile
router.put('/profile', authenticateJWT, requireRole('provider'), async (req: AuthenticatedRequest, res, next) => {
  try {
    const {
      businessName,
      bio,
      avatarUrl,
      categories,
      skills,
      experienceYears,
      startingPrice,
      pricingMode,
      serviceLocation,
      workingHours,
    } = req.body;

    let sanitizedLocation: Record<string, unknown> | undefined;
    if (serviceLocation && typeof serviceLocation === 'object') {
      const nextLat = Number(serviceLocation.lat);
      const nextLng = Number(serviceLocation.lng);
      const nextRadius = Number(serviceLocation.radiusKm);

      if (
        !Number.isFinite(nextLat) ||
        nextLat < -90 ||
        nextLat > 90 ||
        !Number.isFinite(nextLng) ||
        nextLng < -180 ||
        nextLng > 180
      ) {
        res.status(400).json({ error: 'Valid latitude (-90 to 90) and longitude (-180 to 180) are required.' });
        return;
      }

      sanitizedLocation = {
        city: String(serviceLocation.city || '').trim() || 'Bengaluru',
        area: String(serviceLocation.area || '').trim(),
        address: String(serviceLocation.address || '').trim(),
        lat: Number(nextLat.toFixed(6)),
        lng: Number(nextLng.toFixed(6)),
        radiusKm: Number.isFinite(nextRadius) ? Math.min(100, Math.max(1, nextRadius)) : 15,
      };
    }

    const profile = await ProviderProfile.findOneAndUpdate(
      { userId: req.user!.userId },
      {
        ...(businessName && { businessName }),
        ...(bio !== undefined && { bio }),
        ...(avatarUrl !== undefined && { avatarUrl }),
        ...(Array.isArray(categories) && { categories }),
        ...(Array.isArray(skills) && { skills }),
        ...(experienceYears !== undefined && { experienceYears: Number(experienceYears) }),
        ...(startingPrice !== undefined && { startingPrice: Number(startingPrice) }),
        ...(pricingMode && { pricingMode }),
        ...(sanitizedLocation && { serviceLocation: sanitizedLocation }),
        ...(workingHours && { workingHours }),
      },
      { new: true, upsert: true }
    );

    res.json({ profile });
  } catch (err) {
    next(err);
  }
});

// Provider's own services list
router.get('/me/services', authenticateJWT, requireRole('provider'), async (req: AuthenticatedRequest, res, next) => {
  try {
    const services = await Service.find({ providerId: req.user!.userId }).sort({ createdAt: -1 });
    res.json({ services });
  } catch (err) {
    next(err);
  }
});

router.post('/me/services', authenticateJWT, requireRole('provider'), async (req: AuthenticatedRequest, res, next) => {
  try {
    const profile = await ProviderProfile.findOne({ userId: req.user!.userId });
    if (!profile) {
      res.status(404).json({ error: 'Provider profile not found.' });
      return;
    }

    const { categorySlug, title, description, basePrice, durationMinutes } = req.body;
    if (!categorySlug || !title || basePrice === undefined) {
      res.status(400).json({ error: 'Category, service title, and base price are required.' });
      return;
    }

    const service = await Service.create({
      providerId: req.user!.userId,
      providerProfileId: profile._id,
      categorySlug,
      title,
      description: description || '',
      basePrice: Number(basePrice),
      durationMinutes: Number(durationMinutes) || 60,
    });

    res.status(201).json({ service });
  } catch (err) {
    next(err);
  }
});

router.delete('/me/services/:serviceId', authenticateJWT, requireRole('provider'), async (req: AuthenticatedRequest, res, next) => {
  try {
    const deleted = await Service.findOneAndDelete({
      _id: req.params.serviceId,
      providerId: req.user!.userId,
    });
    if (!deleted) {
      res.status(404).json({ error: 'Service not found.' });
      return;
    }
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

// Provider updates availability for a specific date
router.put('/me/availability', authenticateJWT, requireRole('provider'), async (req: AuthenticatedRequest, res, next) => {
  try {
    const { date, slots, isBlockedDay } = req.body;
    if (!date) {
      res.status(400).json({ error: 'Date (YYYY-MM-DD) is required.' });
      return;
    }

    const existing = await Availability.findOne({ providerId: req.user!.userId, date });
    const bookedMap = new Map<string, { isBooked: boolean; bookingId?: unknown }>();
    if (existing) {
      for (const s of existing.slots) {
        if (s.isBooked) bookedMap.set(s.time, { isBooked: true, bookingId: s.bookingId });
      }
    }

    const normalizedSlots = (Array.isArray(slots) ? slots : DEFAULT_TIME_SLOTS).map((t: string | { time: string }) => {
      const timeStr = typeof t === 'string' ? t : t.time;
      const bookedInfo = bookedMap.get(timeStr);
      return {
        time: timeStr,
        isBooked: bookedInfo ? true : false,
        ...(bookedInfo?.bookingId ? { bookingId: bookedInfo.bookingId } : {}),
      };
    });

    const availability = await Availability.findOneAndUpdate(
      { providerId: req.user!.userId, date },
      { slots: normalizedSlots, isBlockedDay: Boolean(isBlockedDay) },
      { new: true, upsert: true }
    );

    res.json({ availability });
  } catch (err) {
    next(err);
  }
});

// Public provider detail + services + reviews
router.get('/:id', async (req, res, next) => {
  try {
    const profile = await ProviderProfile.findById(req.params.id).populate('userId', 'name avatarUrl phone');
    if (!profile) {
      res.status(404).json({ error: 'Service provider not found.' });
      return;
    }

    const [services, reviews] = await Promise.all([
      Service.find({ providerProfileId: profile._id, isActive: true }),
      Review.find({ providerProfileId: profile._id, isVisible: true })
        .populate('customerId', 'name')
        .sort({ createdAt: -1 })
        .limit(20),
    ]);

    res.json({ provider: profile, services, reviews });
  } catch (err) {
    next(err);
  }
});

// Public availability slots for a provider on a date
router.get('/:id/availability', async (req, res, next) => {
  try {
    const date = String(req.query.date || new Date().toISOString().slice(0, 10));
    const profile = await ProviderProfile.findById(req.params.id);
    if (!profile) {
      res.status(404).json({ error: 'Provider not found.' });
      return;
    }

    let availability = await Availability.findOne({ providerId: profile.userId, date });
    if (!availability) {
      availability = await Availability.create({
        providerId: profile.userId,
        date,
        slots: DEFAULT_TIME_SLOTS.map((time) => ({ time, isBooked: false })),
        isBlockedDay: false,
      });
    }

    res.json({ availability });
  } catch (err) {
    next(err);
  }
});

// Customer toggles saving a provider
router.post('/:id/save', authenticateJWT, requireRole('customer'), async (req: AuthenticatedRequest, res, next) => {
  try {
    const user = await User.findById(req.user!.userId);
    if (!user) {
      res.status(404).json({ error: 'User not found.' });
      return;
    }

    const targetId = req.params.id;
    const exists = user.savedProviders.some((p) => String(p) === targetId);
    if (exists) {
      user.savedProviders = user.savedProviders.filter((p) => String(p) !== targetId);
    } else {
      user.savedProviders.push(targetId as never);
    }
    await user.save();

    res.json({ saved: !exists, savedProviders: user.savedProviders });
  } catch (err) {
    next(err);
  }
});

export default router;
