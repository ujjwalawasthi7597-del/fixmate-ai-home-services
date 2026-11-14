import { Server as SocketIOServer } from 'socket.io';
import type { Server as HttpServer } from 'node:http';
import { verifyAccessToken } from '../middleware/auth.ts';
import { Notification } from '../models/Notification.ts';
import { ENV } from '../config/env.ts';

let io: SocketIOServer | null = null;

export function initSocketServer(httpServer: HttpServer): SocketIOServer {
  io = new SocketIOServer(httpServer, {
    cors: {
      origin: ENV.FRONTEND_URL ? [ENV.FRONTEND_URL, 'http://localhost:3000'] : '*',
      credentials: true,
    },
  });

  io.use((socket, next) => {
    const token = socket.handshake.auth?.token as string | undefined;
    if (!token) {
      next(new Error('Authentication required for real-time connection.'));
      return;
    }
    try {
      const payload = verifyAccessToken(token);
      socket.data.user = payload;
      next();
    } catch {
      next(new Error('Invalid session token.'));
    }
  });

  io.on('connection', (socket) => {
    const userId = socket.data.user?.userId;
    if (userId) {
      socket.join(`user:${userId}`);
    }

    socket.on('conversation:join', (conversationId: string) => {
      if (conversationId) {
        socket.join(`conversation:${conversationId}`);
      }
    });

    socket.on('conversation:leave', (conversationId: string) => {
      if (conversationId) {
        socket.leave(`conversation:${conversationId}`);
      }
    });
  });

  return io;
}

export function getIO(): SocketIOServer | null {
  return io;
}

export async function createAndEmitNotification(params: {
  userId: string;
  title: string;
  message: string;
  type:
    | 'booking_request'
    | 'booking_accepted'
    | 'booking_rejected'
    | 'quotation_sent'
    | 'quotation_approved'
    | 'quotation_rejected'
    | 'booking_confirmed'
    | 'job_completed'
    | 'payment_update'
    | 'message';
  relatedBookingId?: string;
}) {
  const notif = await Notification.create({
    userId: params.userId,
    title: params.title,
    message: params.message,
    type: params.type,
    relatedBookingId: params.relatedBookingId,
  });

  io?.to(`user:${params.userId}`).emit('notification:new', notif);
  return notif;
}
