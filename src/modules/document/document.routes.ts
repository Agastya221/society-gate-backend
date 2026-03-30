import { Router } from 'express';
import { getUploadUrl, confirmUpload, getDocuments, getViewUrl, deleteDocument } from './document.controller';
import { authenticate, authorize, ensureSameSociety } from '../../middlewares/auth.middleware';
import { cache, clearCacheAfter } from '../../middlewares/cache.middleware';

const router = Router();

router.use(authenticate);
router.use(ensureSameSociety);

// Specific routes before /:id
router.get('/', cache({ ttl: 120, keyPrefix: 'docs', varyBy: ['societyId', 'userId'] }), getDocuments);
router.post('/upload-url', clearCacheAfter(['docs:*']), getUploadUrl);
router.post('/confirm', clearCacheAfter(['docs:*']), confirmUpload);

// Document actions
router.get('/:id/view-url', getViewUrl);
router.delete('/:id', clearCacheAfter(['docs:*']), deleteDocument);

export default router;
