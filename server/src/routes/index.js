import { Router } from 'express';
import healthRoutes from './health.routes.js';
import authRoutes from './auth.routes.js';
import cafeRoutes from './cafe.routes.js';
import stationRoutes from './station.routes.js';
import sessionRoutes from './session.routes.js';
import paymentRoutes from './payment.routes.js';

const router = Router();

router.use('/health', healthRoutes);
router.use('/auth', authRoutes);
router.use('/cafes', cafeRoutes);
router.use('/cafes/:cafeId/stations', stationRoutes);
router.use('/cafes/:cafeId/sessions', sessionRoutes);
router.use('/cafes/:cafeId/payments', paymentRoutes);

export default router;
