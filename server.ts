import http from 'node:http';
import path from 'node:path';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { ENV } from './server/config/env.ts';
import { connectDB } from './server/config/db.ts';
import { sanitizeBody } from './server/middleware/auth.ts';
import { errorHandler } from './server/middleware/errorHandler.ts';
import { initSocketServer } from './server/services/socket.ts';

import healthRouter from './server/routes/health.ts';
import authRouter from './server/routes/auth.ts';
import categoriesRouter from './server/routes/categories.ts';
import providersRouter from './server/routes/providers.ts';
import addressesRouter from './server/routes/addresses.ts';
import bookingsRouter from './server/routes/bookings.ts';
import paymentsRouter from './server/routes/payments.ts';
import reviewsRouter from './server/routes/reviews.ts';
import notificationsRouter from './server/routes/notifications.ts';
import chatRouter from './server/routes/chat.ts';
import aiRouter from './server/routes/ai.ts';
import uploadRouter from './server/routes/upload.ts';
import adminRouter from './server/routes/admin.ts';

async function bootstrap() {
  const app = express();
  const httpServer = http.createServer(app);

  // Initialize Socket.IO for real-time notifications and messaging
  initSocketServer(httpServer);

  // Security headers compatible with AI Studio iframe preview and Razorpay popup
  app.use(
    helmet({
      contentSecurityPolicy: false,
      crossOriginEmbedderPolicy: false,
      crossOriginOpenerPolicy: false,
      crossOriginResourcePolicy: false,
      xFrameOptions: false,
    })
  );

  app.use(
    cors({
      origin: ENV.FRONTEND_URL ? [ENV.FRONTEND_URL, 'http://localhost:3000'] : true,
      credentials: true,
    })
  );

  // Capture raw body for Razorpay webhook signature verification
  app.use(
    express.json({
      limit: '10mb',
      verify: (req, _res, buf) => {
        (req as unknown as { rawBody?: string }).rawBody = buf.toString('utf8');
      },
    })
  );
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));
  app.use(sanitizeBody);

  // API Routes
  app.use('/api/health', healthRouter);
  app.use('/api/auth', authRouter);
  app.use('/api/categories', categoriesRouter);
  app.use('/api/providers', providersRouter);
  app.use('/api/addresses', addressesRouter);
  app.use('/api/bookings', bookingsRouter);
  app.use('/api/payments', paymentsRouter);
  app.use('/api/reviews', reviewsRouter);
  app.use('/api/notifications', notificationsRouter);
  app.use('/api/conversations', chatRouter);
  app.use('/api/ai', aiRouter);
  app.use('/api/upload', uploadRouter);
  app.use('/api/admin', adminRouter);

  // Connect MongoDB Atlas in background so port 3000 binds immediately without blocking startup
  void connectDB();

  // Mount Vite middleware in development (initialized asynchronously) or serve built dist/ in production
  if (ENV.NODE_ENV !== 'production') {
    const vitePromise = import('vite').then(({ createServer: createViteServer }) =>
      createViteServer({
        server: {
          middlewareMode: true,
          hmr: process.env.DISABLE_HMR === 'true' ? false : { server: httpServer },
        },
        appType: 'spa',
      })
    );

    app.use(async (req, res, next) => {
      try {
        const vite = await vitePromise;
        vite.middlewares(req, res, next);
      } catch (err) {
        next(err);
      }
    });
  } else {
    const distDir = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  app.use(errorHandler);

  const port = Number(process.env.PORT) || 3000;
  httpServer.listen(port, '0.0.0.0', () => {
    console.log(`[FixMate Server] Running on http://0.0.0.0:${port} (${ENV.NODE_ENV})`);
  });
}

bootstrap().catch((err) => {
  console.error('[FixMate Fatal]', err);
  process.exit(1);
});
