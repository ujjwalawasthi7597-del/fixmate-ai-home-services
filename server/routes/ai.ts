import { Router } from 'express';
import multer from 'multer';
import {
  diagnoseRepairIssue,
  generateJobDescription,
  generateTechnicianTroubleshooting,
} from '../services/gemini.ts';
import { authenticateJWT, requireRole } from '../middleware/auth.ts';
import { aiLimiter } from '../middleware/rateLimit.ts';

const router = Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'image/webp'];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only JPEG, PNG, and WebP images are supported for AI analysis.'));
    }
  },
});

router.post('/diagnose', aiLimiter, upload.single('image'), async (req, res, next) => {
  try {
    const description = String(req.body?.description || '').trim();
    const imageFile = req.file;
    const inlineBase64 = req.body?.imageBase64 as string | undefined;
    const inlineMime = req.body?.mimeType as string | undefined;

    if (!description && !imageFile && !inlineBase64) {
      res.status(400).json({ error: 'Please describe your issue or upload an image for analysis.' });
      return;
    }

    const result = await diagnoseRepairIssue({
      description,
      imageBase64: imageFile ? imageFile.buffer.toString('base64') : inlineBase64,
      mimeType: imageFile ? imageFile.mimetype : inlineMime,
    });

    res.json({ diagnosis: result });
  } catch (err) {
    next(err);
  }
});

router.post('/job-description', aiLimiter, async (req, res, next) => {
  try {
    const { rawProblem, category, propertyType } = req.body;
    if (!rawProblem || String(rawProblem).trim().length < 5) {
      res.status(400).json({ error: 'Please provide at least a short description of the repair problem.' });
      return;
    }

    const jobDescription = await generateJobDescription({
      rawProblem: String(rawProblem),
      category,
      propertyType,
    });

    res.json({ jobDescription });
  } catch (err) {
    next(err);
  }
});

router.post('/troubleshoot', authenticateJWT, requireRole('provider', 'admin'), aiLimiter, async (req, res, next) => {
  try {
    const { problemTitle, problemDescription, category, symptoms } = req.body;
    if (!problemTitle && !problemDescription) {
      res.status(400).json({ error: 'Booking problem details are required.' });
      return;
    }

    const guide = await generateTechnicianTroubleshooting({
      problemTitle: String(problemTitle || ''),
      problemDescription: String(problemDescription || ''),
      category: String(category || 'General Repair'),
      symptoms: Array.isArray(symptoms) ? symptoms : [],
    });

    res.json({ troubleshooting: guide });
  } catch (err) {
    next(err);
  }
});

export default router;
