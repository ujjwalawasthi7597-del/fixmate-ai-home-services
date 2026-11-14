import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { User } from '../models/User.ts';
import { ProviderProfile } from '../models/ProviderProfile.ts';
import { requireDb } from '../config/db.ts';
import { authenticateJWT, signAccessToken } from '../middleware/auth.ts';
import type { AuthenticatedRequest } from '../middleware/auth.ts';
import { authLimiter } from '../middleware/rateLimit.ts';

const router = Router();
router.use(requireDb);

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

router.post('/register', authLimiter, async (req, res, next) => {
  try {
    const {
      name,
      email,
      password,
      phone = '',
      role = 'customer',
      businessName,
      categories,
      city,
      area,
      experienceYears,
      startingPrice,
      bio,
      lat,
      lng,
    } = req.body;

    if (!name || typeof name !== 'string' || name.trim().length < 2) {
      res.status(400).json({ error: 'Full name must be at least 2 characters.' });
      return;
    }
    if (!email || typeof email !== 'string' || !EMAIL_RE.test(email.trim())) {
      res.status(400).json({ error: 'Please provide a valid email address.' });
      return;
    }
    if (!password || typeof password !== 'string' || password.length < 8) {
      res.status(400).json({ error: 'Password must be at least 8 characters long.' });
      return;
    }

    const normalizedEmail = email.trim().toLowerCase();
    const existing = await User.findOne({ email: normalizedEmail });
    if (existing) {
      res.status(409).json({ error: 'An account with this email already exists.' });
      return;
    }

    let finalRole: 'customer' | 'provider' | 'admin' = 'customer';
    if (role === 'provider') {
      finalRole = 'provider';
    } else if (role === 'admin') {
      const adminCount = await User.countDocuments({ role: 'admin' });
      if (adminCount > 0) {
        res.status(403).json({ error: 'Admin account already exists. Please contact an existing administrator.' });
        return;
      }
      finalRole = 'admin';
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const user = await User.create({
      name: name.trim(),
      email: normalizedEmail,
      passwordHash,
      phone: String(phone || '').trim(),
      role: finalRole,
    });

    let providerProfile = null;
    if (finalRole === 'provider') {
      const parsedLat = lat !== undefined && lat !== '' ? Number(lat) : NaN;
      const parsedLng = lng !== undefined && lng !== '' ? Number(lng) : NaN;
      const validLat = Number.isFinite(parsedLat) && parsedLat >= -90 && parsedLat <= 90 ? parsedLat : 12.9716;
      const validLng = Number.isFinite(parsedLng) && parsedLng >= -180 && parsedLng <= 180 ? parsedLng : 77.5946;

      providerProfile = await ProviderProfile.create({
        userId: user._id,
        businessName: (businessName || `${user.name} Services`).trim(),
        bio: (bio || '').trim(),
        categories: Array.isArray(categories) && categories.length > 0 ? categories : ['electrician'],
        experienceYears: Number(experienceYears) || 1,
        startingPrice: Number(startingPrice) || 299,
        serviceLocation: {
          city: (city || 'Bengaluru').trim(),
          area: (area || '').trim(),
          address: '',
          lat: validLat,
          lng: validLng,
          radiusKm: 15,
        },
        verificationStatus: 'pending',
      });
    }

    const token = signAccessToken({
      userId: String(user._id),
      role: user.role,
      email: user.email,
    });

    res.cookie('fixmate_token', token, {
      httpOnly: true,
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    res.status(201).json({
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: user.role,
        avatarUrl: user.avatarUrl,
      },
      providerProfile,
    });
  } catch (err) {
    next(err);
  }
});

router.post('/login', authLimiter, async (req, res, next) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      res.status(400).json({ error: 'Email and password are required.' });
      return;
    }

    const user = await User.findOne({ email: String(email).trim().toLowerCase() }).select('+passwordHash');
    if (!user) {
      res.status(401).json({ error: 'Invalid email or password.' });
      return;
    }

    if (!user.isActive) {
      res.status(403).json({ error: 'This account has been deactivated. Contact support.' });
      return;
    }

    const valid = await bcrypt.compare(String(password), user.passwordHash);
    if (!valid) {
      res.status(401).json({ error: 'Invalid email or password.' });
      return;
    }

    const providerProfile =
      user.role === 'provider' ? await ProviderProfile.findOne({ userId: user._id }) : null;

    const token = signAccessToken({
      userId: String(user._id),
      role: user.role,
      email: user.email,
    });

    res.cookie('fixmate_token', token, {
      httpOnly: true,
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    res.json({
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: user.role,
        avatarUrl: user.avatarUrl,
        savedProviders: user.savedProviders,
      },
      providerProfile,
    });
  } catch (err) {
    next(err);
  }
});

router.post('/logout', (_req, res) => {
  res.clearCookie('fixmate_token');
  res.json({ ok: true });
});

router.get('/me', authenticateJWT, async (req: AuthenticatedRequest, res, next) => {
  try {
    const user = await User.findById(req.user!.userId).populate('savedProviders');
    if (!user) {
      res.status(404).json({ error: 'User not found.' });
      return;
    }
    const providerProfile =
      user.role === 'provider' ? await ProviderProfile.findOne({ userId: user._id }) : null;

    res.json({
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: user.role,
        avatarUrl: user.avatarUrl,
        savedProviders: user.savedProviders,
      },
      providerProfile,
    });
  } catch (err) {
    next(err);
  }
});

router.patch('/me', authenticateJWT, async (req: AuthenticatedRequest, res, next) => {
  try {
    const { name, phone, avatarUrl } = req.body;
    const updates: Record<string, unknown> = {};
    if (typeof name === 'string' && name.trim().length >= 2) updates.name = name.trim();
    if (typeof phone === 'string') updates.phone = phone.trim();
    if (typeof avatarUrl === 'string') updates.avatarUrl = avatarUrl.trim();

    const user = await User.findByIdAndUpdate(req.user!.userId, updates, { new: true });
    if (!user) {
      res.status(404).json({ error: 'User not found.' });
      return;
    }

    res.json({
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: user.role,
        avatarUrl: user.avatarUrl,
      },
    });
  } catch (err) {
    next(err);
  }
});

export default router;
