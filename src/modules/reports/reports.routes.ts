import { Router } from 'express';
import {
  getDashboardStats,
  getEntryStatistics,
  getPeakHoursAnalysis,
  getDeliveryPatterns,
  getComplaintStatistics,
  getVisitorFrequencyReport,
  getSocietyHealthScore,
} from './reports.controller';
import { authenticate, authorize, ensureSameSociety } from '../../middlewares/auth.middleware';
import { cache } from '../../middlewares/cache.middleware';

const router = Router();

// Apply authentication and society isolation globally
router.use(authenticate);
router.use(ensureSameSociety);

// All reports require admin authorization (cached for 3 minutes)
router.get('/dashboard', authorize('ADMIN', 'SUPER_ADMIN'), cache({ ttl: 180, keyPrefix: 'reports', varyBy: ['societyId'] }), getDashboardStats);
router.get('/entries', authorize('ADMIN', 'SUPER_ADMIN'), cache({ ttl: 180, keyPrefix: 'reports', varyBy: ['societyId'] }), getEntryStatistics);
router.get('/peak-hours', authorize('ADMIN', 'SUPER_ADMIN'), cache({ ttl: 180, keyPrefix: 'reports', varyBy: ['societyId'] }), getPeakHoursAnalysis);
router.get('/delivery-patterns', authorize('ADMIN', 'SUPER_ADMIN'), cache({ ttl: 180, keyPrefix: 'reports', varyBy: ['societyId'] }), getDeliveryPatterns);
router.get('/complaints', authorize('ADMIN', 'SUPER_ADMIN'), cache({ ttl: 180, keyPrefix: 'reports', varyBy: ['societyId'] }), getComplaintStatistics);
router.get('/visitor-frequency', authorize('ADMIN', 'SUPER_ADMIN'), cache({ ttl: 180, keyPrefix: 'reports', varyBy: ['societyId'] }), getVisitorFrequencyReport);
router.get('/health-score', authorize('ADMIN', 'SUPER_ADMIN'), cache({ ttl: 180, keyPrefix: 'reports', varyBy: ['societyId'] }), getSocietyHealthScore);

export default router;
