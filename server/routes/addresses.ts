import { Router } from 'express';
import { Address } from '../models/Address.ts';
import { requireDb } from '../config/db.ts';
import { authenticateJWT } from '../middleware/auth.ts';
import type { AuthenticatedRequest } from '../middleware/auth.ts';

const router = Router();
router.use(requireDb, authenticateJWT);

router.get('/', async (req: AuthenticatedRequest, res, next) => {
  try {
    const addresses = await Address.find({ userId: req.user!.userId }).sort({ isDefault: -1, createdAt: -1 });
    res.json({ addresses });
  } catch (err) {
    next(err);
  }
});

router.post('/', async (req: AuthenticatedRequest, res, next) => {
  try {
    const { label, line1, line2, city, state, postalCode, lat, lng, isDefault } = req.body;
    if (!label || !line1 || !city || !state || !postalCode) {
      res.status(400).json({ error: 'Label, street address, city, state, and postal code are required.' });
      return;
    }

    if (isDefault) {
      await Address.updateMany({ userId: req.user!.userId }, { isDefault: false });
    }

    const address = await Address.create({
      userId: req.user!.userId,
      label,
      line1,
      line2: line2 || '',
      city,
      state,
      postalCode,
      lat: lat !== undefined ? Number(lat) : undefined,
      lng: lng !== undefined ? Number(lng) : undefined,
      isDefault: Boolean(isDefault),
    });

    res.status(201).json({ address });
  } catch (err) {
    next(err);
  }
});

router.delete('/:id', async (req: AuthenticatedRequest, res, next) => {
  try {
    const deleted = await Address.findOneAndDelete({ _id: req.params.id, userId: req.user!.userId });
    if (!deleted) {
      res.status(404).json({ error: 'Address not found.' });
      return;
    }
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

export default router;
