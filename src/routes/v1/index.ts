import { Router } from 'express';
import authRoutes from '../../modules/user/user.routes';
import gateRoutes from './gate.routes';
import staffRoutes from './staff.routes';
import communityRoutes from './community.routes';
import residentRoutes from './resident.routes';
import adminRoutes from './admin.routes';
import uploadRoutes from '../../modules/upload/upload.routes';
import deliveryRoutes from '../../modules/delivery/delivery.routes';

const router = Router();

// API v1 Route Groups
router.use('/auth', authRoutes);              // /api/v1/auth
router.use('/gate', gateRoutes);              // /api/v1/gate/*
router.use('/staff', staffRoutes);            // /api/v1/staff/*
router.use('/community', communityRoutes);    // /api/v1/community/*
router.use('/resident', residentRoutes);      // /api/v1/resident/*
router.use('/admin', adminRoutes);            // /api/v1/admin/*
router.use('/upload', uploadRoutes);          // /api/v1/upload
router.use('/deliveries', deliveryRoutes);    // /api/v1/deliveries (Guard-specific)

export default router;
