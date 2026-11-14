import jwt from 'jsonwebtoken';
import type { Request, Response, NextFunction } from 'express';
import { ENV } from '../config/env.ts';
import type { UserRole } from '../models/User.ts';

export interface AuthPayload {
  userId: string;
  role: UserRole;
  email: string;
}

export interface AuthenticatedRequest extends Request {
  user?: AuthPayload;
}

export function signAccessToken(payload: AuthPayload): string {
  return jwt.sign(payload, ENV.JWT_SECRET, { expiresIn: '7d' });
}

export function verifyAccessToken(token: string): AuthPayload {
  return jwt.verify(token, ENV.JWT_SECRET) as AuthPayload;
}

export function authenticateJWT(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  const bearerToken = authHeader?.startsWith('Bearer ') ? authHeader.slice(7).trim() : null;
  const cookieToken = (req.headers.cookie || '')
    .split(';')
    .map((c) => c.trim())
    .find((c) => c.startsWith('fixmate_token='))
    ?.split('=')[1];

  const token = bearerToken || (cookieToken ? decodeURIComponent(cookieToken) : null);
  if (!token) {
    res.status(401).json({ error: 'Authentication required. Please sign in.' });
    return;
  }

  try {
    req.user = verifyAccessToken(token);
    next();
  } catch {
    res.status(401).json({ error: 'Invalid or expired session token. Please sign in again.' });
  }
}

export function requireRole(...roles: UserRole[]) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      res.status(401).json({ error: 'Authentication required.' });
      return;
    }
    if (!roles.includes(req.user.role)) {
      res.status(403).json({ error: 'Access denied for your account role.' });
      return;
    }
    next();
  };
}

function sanitizeValue(val: unknown): unknown {
  if (typeof val === 'string') {
    return val.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '').trim();
  }
  if (Array.isArray(val)) {
    return val.map(sanitizeValue);
  }
  if (val && typeof val === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(val as Record<string, unknown>)) {
      if (k.startsWith('$') || k.includes('.')) continue; // Prevent NoSQL operator injection
      out[k] = sanitizeValue(v);
    }
    return out;
  }
  return val;
}

export function sanitizeBody(req: Request, _res: Response, next: NextFunction) {
  if (req.body && typeof req.body === 'object') {
    req.body = sanitizeValue(req.body);
  }
  next();
}
