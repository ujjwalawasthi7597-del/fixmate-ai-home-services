import { Router } from 'express';
import multer from 'multer';
import { uploadImageBuffer } from '../services/cloudinary.ts';
import { authenticateJWT } from '../middleware/auth.ts';

const router = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'image/webp'];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only JPEG, PNG, and WebP images up to 5MB are allowed.'));
    }
  },
});

router.post('/', authenticateJWT, upload.single('image'), async (req, res, next) => {
  try {
    if (!req.file) {
      res.status(400).json({ error: 'No image file provided.' });
      return;
    }
    const result = await uploadImageBuffer(req.file.buffer, 'fixmate/issues');
    res.status(201).json(result);
  } catch (err) {
    next(err);
  }
});

export default router;
