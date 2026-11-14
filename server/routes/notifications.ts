import { Router } from 'express';
import { Notification } from '../models/Notification.ts';
import { requireDb } from '../config/db.ts';
import { authenticateJWT } from '../middleware/auth.ts';
import type { AuthenticatedRequest } from '../middleware/auth.ts';

const router = Router();
router.use(requireDb, authenticateJWT);

router.get('/', async (req: AuthenticatedRequest, res, next) => {
  try {
    const notifications = await Notification.find({ userId: req.user!.userId })
      .sort({ createdAt: -1 })
      .limit(40);
    const unreadCount = await Notification.countDocuments({
      userId: req.user!.userId,
      isRead: false,
    });
    res.json({ notifications, unreadCount });
  } catch (err) {
    next(err);
  }
});

router.patch('/read-all', async (req: AuthenticatedRequest, res, next) => {
  try {
    await Notification.updateMany({ userId: req.user!.userId, isRead: false }, { isRead: true });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

router.patch('/:id/read', async (req: AuthenticatedRequest, res, next) => {
  try {
    const notif = await Notification.findOneAndUpdate(
      { _id: req.params.id, userId: req.user!.userId },
      { isRead: true },
      { new: true }
    );
    if (!notif) {
      res.status(404).json({ error: 'Notification not found.' });
      return;
    }
    res.json({ notification: notif });
  } catch (err) {
    next(err);
  }
});

export default router;
