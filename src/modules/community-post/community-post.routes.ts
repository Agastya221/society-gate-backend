import { Router } from 'express';
import {
  createPost, getPosts, getPostById, deletePost,
  togglePin, likePost, addComment, getComments,
} from './community-post.controller';
import { authenticate, authorize, ensureSameSociety } from '../../middlewares/auth.middleware';
import { cache, clearCacheAfter } from '../../middlewares/cache.middleware';

const router = Router();

router.use(authenticate);
router.use(ensureSameSociety);

// Specific routes before /:id
router.get('/', cache({ ttl: 60, keyPrefix: 'posts', varyBy: ['societyId', 'userId'] }), getPosts);
router.post('/', authorize('RESIDENT', 'ADMIN', 'SUPER_ADMIN'), clearCacheAfter(['posts:*']), createPost);

// Post-level actions
router.get('/:id', cache({ ttl: 60, keyPrefix: 'posts' }), getPostById);
router.delete('/:id', clearCacheAfter(['posts:*']), deletePost);
router.patch('/:id/pin', authorize('ADMIN', 'SUPER_ADMIN'), clearCacheAfter(['posts:*']), togglePin);
router.post('/:id/like', authorize('RESIDENT', 'ADMIN', 'SUPER_ADMIN'), clearCacheAfter(['posts:*']), likePost);

// Comments
router.get('/:id/comments', cache({ ttl: 60, keyPrefix: 'posts' }), getComments);
router.post('/:id/comments', authorize('RESIDENT', 'ADMIN', 'SUPER_ADMIN'), clearCacheAfter(['posts:*']), addComment);

export default router;
