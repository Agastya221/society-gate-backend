import { Router } from 'express';
import { authenticateStaffApp } from './staff-app.middleware';
import * as controller from './staff-app.controller';
import { clearCacheAfter } from '../../middlewares/cache.middleware';

const router = Router();
router.post('/auth/otp/verify', controller.verifyOtp);
router.post('/auth/refresh', controller.refresh);
router.use(authenticateStaffApp);
router.post('/auth/logout', controller.logout);
router.get('/dashboard', controller.dashboard);
router.get('/me', controller.profile);
router.get('/pass', controller.pass);
router.get('/assignments', controller.assignments);
router.get('/attendance', controller.attendance);
router.get('/bookings', controller.bookings);
// Resident-side booking lists are cached under the 'staff' prefix — refresh them on accept/decline
router.patch('/bookings/:id/accept', clearCacheAfter(['staff:*']), controller.acceptBooking);
router.patch('/bookings/:id/reject', clearCacheAfter(['staff:*']), controller.rejectBooking);
router.patch('/availability', controller.availability);
router.patch('/fcm-token', controller.fcmToken);
export default router;
