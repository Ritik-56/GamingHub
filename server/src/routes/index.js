import { Router } from 'express';
import healthRoutes from './health.routes.js';
import authRoutes from './auth.routes.js';
import cafeRoutes from './cafe.routes.js';
import stationRoutes from './station.routes.js';
import sessionRoutes from './session.routes.js';
import paymentRoutes from './payment.routes.js';
import rewardRoutes from './reward.routes.js';

const router = Router();

router.use('/health', healthRoutes);
router.use('/auth', authRoutes);
router.use('/cafes', cafeRoutes);
router.use('/cafes/:cafeId/stations', stationRoutes);
router.use('/cafes/:cafeId/sessions', sessionRoutes);
router.use('/cafes/:cafeId/payments', paymentRoutes);
router.use('/cafes/:cafeId/rewards', rewardRoutes);
// Customer-scoped reward routes (no cafeId in path)
router.use('/rewards', rewardRoutes);

export default router;
