import { Router } from 'express';
import noticeRoutes from '../../modules/notice/notice.routes';
import amenityRoutes from '../../modules/amenity/amenity.routes';
import complaintRoutes from '../../modules/complaint/complaint.routes';
import emergencyRoutes from '../../modules/emergency/emergency.routes';

const router = Router();

// All community-related endpoints grouped together
router.use('/notices', noticeRoutes);         // /api/v1/community/notices
router.use('/amenities', amenityRoutes);      // /api/v1/community/amenities
router.use('/complaints', complaintRoutes);   // /api/v1/community/complaints
router.use('/emergencies', emergencyRoutes);  // /api/v1/community/emergencies

export default router;
