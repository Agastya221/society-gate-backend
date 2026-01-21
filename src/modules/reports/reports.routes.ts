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
import { authenticate, authorize } from '../../middlewares/auth.middleware';

const router = Router();

// All reports require admin authorization
router.get('/dashboard', authenticate, authorize('ADMIN'), getDashboardStats);
router.get('/entries', authenticate, authorize('ADMIN'), getEntryStatistics);
router.get('/peak-hours', authenticate, authorize('ADMIN'), getPeakHoursAnalysis);
router.get('/delivery-patterns', authenticate, authorize('ADMIN'), getDeliveryPatterns);
router.get('/complaints', authenticate, authorize('ADMIN'), getComplaintStatistics);
router.get('/visitor-frequency', authenticate, authorize('ADMIN'), getVisitorFrequencyReport);
router.get('/health-score', authenticate, authorize('ADMIN'), getSocietyHealthScore);

export default router;
