import { Router } from 'express';
import { ServiceCategory } from '../models/ServiceCategory.ts';
import { requireDb } from '../config/db.ts';
import { authenticateJWT, requireRole } from '../middleware/auth.ts';

const router = Router();
router.use(requireDb);

router.get('/', async (_req, res, next) => {
  try {
    const categories = await ServiceCategory.find({ isActive: true }).sort({ sortOrder: 1, name: 1 });
    res.json({ categories });
  } catch (err) {
    next(err);
  }
});

router.get('/all', authenticateJWT, requireRole('admin'), async (_req, res, next) => {
  try {
    const categories = await ServiceCategory.find().sort({ sortOrder: 1, name: 1 });
    res.json({ categories });
  } catch (err) {
    next(err);
  }
});

router.post('/', authenticateJWT, requireRole('admin'), async (req, res, next) => {
  try {
    const { name, slug, description, iconName, basePriceRange, sortOrder } = req.body;
    if (!name || !slug) {
      res.status(400).json({ error: 'Category name and slug are required.' });
      return;
    }
    const category = await ServiceCategory.create({
      name,
      slug: String(slug).toLowerCase().trim(),
      description: description || '',
      iconName: iconName || 'Wrench',
      basePriceRange: basePriceRange || '₹299 – ₹1,999',
      sortOrder: Number(sortOrder) || 0,
    });
    res.status(201).json({ category });
  } catch (err) {
    next(err);
  }
});

router.patch('/:id', authenticateJWT, requireRole('admin'), async (req, res, next) => {
  try {
    const category = await ServiceCategory.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!category) {
      res.status(404).json({ error: 'Service category not found.' });
      return;
    }
    res.json({ category });
  } catch (err) {
    next(err);
  }
});

export default router;
