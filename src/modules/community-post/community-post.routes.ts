import { Router } from 'express';
import {
  createPost, getPosts, getPostById, deletePost,
  togglePin, likePost, addComment, getComments,
} from './community-post.controller';
import { authenticate, authorize, ensureSameSociety } from '../../middlewares/auth.middleware';
import { cache, clearCacheAfter } from '../../middlewares/cache.middleware';
import { validate } from '../../middlewares/validate.middleware';
import { createPostSchema, createCommentSchema } from './community-post.schemas';

const router = Router();

router.use(authenticate);
router.use(ensureSameSociety);

// Specific routes before /:id
router.get('/', cache({ ttl: 60, keyPrefix: 'posts', varyBy: ['societyId', 'userId'] }), getPosts);
router.post('/', authorize('RESIDENT', 'ADMIN', 'SUPER_ADMIN'), validate({ body: createPostSchema }), clearCacheAfter(['posts:*']), createPost);

// Post-level actions
router.get('/:id', cache({ ttl: 60, keyPrefix: 'posts', varyBy: ['societyId', 'userId'] }), getPostById);
router.delete('/:id', clearCacheAfter(['posts:*']), deletePost);
router.patch('/:id/pin', authorize('ADMIN', 'SUPER_ADMIN'), clearCacheAfter(['posts:*']), togglePin);
router.post('/:id/like', authorize('RESIDENT', 'ADMIN', 'SUPER_ADMIN'), clearCacheAfter(['posts:*']), likePost);

// Comments
router.get('/:id/comments', cache({ ttl: 60, keyPrefix: 'posts', varyBy: ['societyId', 'userId'] }), getComments);
router.post('/:id/comments', authorize('RESIDENT', 'ADMIN', 'SUPER_ADMIN'), validate({ body: createCommentSchema }), clearCacheAfter(['posts:*']), addComment);

export default router;
