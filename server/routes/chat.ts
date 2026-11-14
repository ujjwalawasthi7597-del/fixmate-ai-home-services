import { Router } from 'express';
import { Conversation } from '../models/Conversation.ts';
import { Message } from '../models/Message.ts';
import { requireDb } from '../config/db.ts';
import { authenticateJWT } from '../middleware/auth.ts';
import type { AuthenticatedRequest } from '../middleware/auth.ts';
import { createAndEmitNotification, getIO } from '../services/socket.ts';

const router = Router();
router.use(requireDb, authenticateJWT);

router.get('/', async (req: AuthenticatedRequest, res, next) => {
  try {
    const conversations = await Conversation.find({ participants: req.user!.userId })
      .populate('participants', 'name email role avatarUrl')
      .populate('bookingId', 'bookingCode problemTitle status')
      .sort({ lastMessageAt: -1 });
    res.json({ conversations });
  } catch (err) {
    next(err);
  }
});

router.post('/', async (req: AuthenticatedRequest, res, next) => {
  try {
    const { recipientId, bookingId } = req.body;
    if (!recipientId) {
      res.status(400).json({ error: 'Recipient user ID is required.' });
      return;
    }

    const participants = [req.user!.userId, recipientId].sort();
    let conversation = await Conversation.findOne({
      participants: { $all: participants, $size: 2 },
      ...(bookingId ? { bookingId } : {}),
    });

    if (!conversation) {
      conversation = await Conversation.create({
        participants,
        ...(bookingId ? { bookingId } : {}),
      });
    }

    const populated = await Conversation.findById(conversation._id)
      .populate('participants', 'name email role avatarUrl')
      .populate('bookingId', 'bookingCode problemTitle status');

    res.status(201).json({ conversation: populated });
  } catch (err) {
    next(err);
  }
});

router.get('/:id/messages', async (req: AuthenticatedRequest, res, next) => {
  try {
    const conversation = await Conversation.findById(req.params.id);
    if (!conversation) {
      res.status(404).json({ error: 'Conversation not found.' });
      return;
    }
    const isParticipant = conversation.participants.some(
      (p) => String(p) === req.user!.userId
    );
    if (!isParticipant && req.user!.role !== 'admin') {
      res.status(403).json({ error: 'Access denied.' });
      return;
    }

    const messages = await Message.find({ conversationId: conversation._id })
      .populate('senderId', 'name role')
      .sort({ createdAt: 1 })
      .limit(200);

    res.json({ messages });
  } catch (err) {
    next(err);
  }
});

router.post('/:id/messages', async (req: AuthenticatedRequest, res, next) => {
  try {
    const { text, attachments } = req.body;
    if (!text || !String(text).trim()) {
      res.status(400).json({ error: 'Message text cannot be empty.' });
      return;
    }

    const conversation = await Conversation.findById(req.params.id);
    if (!conversation) {
      res.status(404).json({ error: 'Conversation not found.' });
      return;
    }

    const isParticipant = conversation.participants.some(
      (p) => String(p) === req.user!.userId
    );
    if (!isParticipant) {
      res.status(403).json({ error: 'Access denied.' });
      return;
    }

    const message = await Message.create({
      conversationId: conversation._id,
      senderId: req.user!.userId,
      text: String(text).trim(),
      attachments: Array.isArray(attachments) ? attachments : [],
      readBy: [req.user!.userId as never],
    });

    conversation.lastMessage = String(text).trim().slice(0, 140);
    conversation.lastMessageAt = new Date();
    await conversation.save();

    const populated = await Message.findById(message._id).populate('senderId', 'name role');
    getIO()?.to(`conversation:${conversation._id}`).emit('message:new', populated);

    for (const p of conversation.participants) {
      if (String(p) !== req.user!.userId) {
        await createAndEmitNotification({
          userId: String(p),
          title: 'New Message',
          message: String(text).trim().slice(0, 100),
          type: 'message',
          relatedBookingId: conversation.bookingId ? String(conversation.bookingId) : undefined,
        });
      }
    }

    res.status(201).json({ message: populated });
  } catch (err) {
    next(err);
  }
});

export default router;
