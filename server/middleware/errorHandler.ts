import type { Request, Response, NextFunction } from 'express';

export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  console.error('[FixMate API Error]', err);

  if (err && typeof err === 'object' && 'code' in err && (err as { code?: number }).code === 11000) {
    res.status(409).json({
      error: 'A conflicting record already exists (duplicate email or booking slot).',
    });
    return;
  }

  const status =
    err && typeof err === 'object' && 'status' in err && typeof (err as { status?: number }).status === 'number'
      ? (err as { status: number }).status
      : 500;

  const message =
    err instanceof Error ? err.message : 'An unexpected server error occurred.';

  res.status(status).json({ error: message });
}
