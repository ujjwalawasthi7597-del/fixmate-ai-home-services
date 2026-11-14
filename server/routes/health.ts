import { Router } from 'express';
import { getIntegrationStatus } from '../config/env.ts';
import { isDbConnected, getDbError } from '../config/db.ts';

const router = Router();

router.get('/', (_req, res) => {
  res.json({
    ok: true,
    service: 'FixMate API',
    dbConnected: isDbConnected(),
    dbError: getDbError(),
    integrations: getIntegrationStatus(),
  });
});

export default router;
