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

const router = Router();

// Apply authentication and society isolation globally
router.use(authenticate);
router.use(ensureSameSociety);

// All reports require admin authorization
router.get('/dashboard', authorize('ADMIN', 'SUPER_ADMIN'), getDashboardStats);
router.get('/entries', authorize('ADMIN', 'SUPER_ADMIN'), getEntryStatistics);
router.get('/peak-hours', authorize('ADMIN', 'SUPER_ADMIN'), getPeakHoursAnalysis);
router.get('/delivery-patterns', authorize('ADMIN', 'SUPER_ADMIN'), getDeliveryPatterns);
router.get('/complaints', authorize('ADMIN', 'SUPER_ADMIN'), getComplaintStatistics);
router.get('/visitor-frequency', authorize('ADMIN', 'SUPER_ADMIN'), getVisitorFrequencyReport);
router.get('/health-score', authorize('ADMIN', 'SUPER_ADMIN'), getSocietyHealthScore);

export default router;
