import { Router } from 'express';
import {
  getPresignedUrl,
  confirmUpload,
  getViewUrl,
  deleteDocument,
  getEntryPhotoViewUrl,
} from './upload.controller';
import { authenticate } from '../../middlewares/auth.middleware';

const router = Router();

// All routes require authentication
router.use(authenticate);

// Get pre-signed upload URL
router.post('/presigned-url', getPresignedUrl);

// Confirm upload (save to DB)
router.post('/confirm', confirmUpload);

// Get pre-signed view URL for a document
router.get('/:id/view-url', getViewUrl);

// Delete a document
router.delete('/:id', deleteDocument);

// Get entry request photo view URL (separate endpoint)
router.get('/entry-photo/:id', getEntryPhotoViewUrl);

export default router;
