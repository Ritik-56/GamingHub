import { Router } from 'express';
import mongoose from 'mongoose';
import Payment from '../models/Payment.js';
import Session from '../models/Session.js';
import Station from '../models/Station.js';
import { authenticate } from '../middleware/auth.js';
import { requireCafeRole } from '../middleware/cafeAuth.js';
import { AppError } from '../middleware/errorHandler.js';

const router = Router({ mergeParams: true });

// GET /api/cafes/:cafeId/payments — list payments (staff+)
router.get(
  '/',
  authenticate,
  requireCafeRole('OWNER', 'MANAGER', 'STAFF'),
  async (req, res, next) => {
    try {
      const { status } = req.query;
      const filter = { cafe: req.params.cafeId };

      if (status) {
        filter.status = status;
      } else {
        // Default: show pending payments
        filter.status = 'PENDING';
      }

      const payments = await Payment.find(filter)
        .populate('session', 'station startedAt endedAt pricePerHour')
        .populate('customer', 'name email phone')
        .populate({
          path: 'session',
          populate: { path: 'station', select: 'name type' },
        })
        .sort({ createdAt: -1 });

      res.json({
        status: 'success',
        data: { payments },
      });
    } catch (err) {
      next(err);
    }
  }
);

// POST /api/cafes/:cafeId/payments/:paymentId/markPaid — mark payment as paid (staff+)
router.post(
  '/:paymentId/markPaid',
  authenticate,
  requireCafeRole('OWNER', 'MANAGER', 'STAFF'),
  async (req, res, next) => {
    try {
      // Atomically update payment status to PAID — only if currently PENDING
      const payment = await Payment.findOneAndUpdate(
        {
          _id: req.params.paymentId,
          cafe: req.params.cafeId,
          status: 'PENDING',
        },
        {
          status: 'PAID',
          paidAt: new Date(),
          markedBy: req.user._id,
        },
        { new: true }
      );

      if (!payment) {
        throw new AppError('Payment not found or already processed', 404);
      }

      // Update session status to COMPLETED
      await Session.findByIdAndUpdate(payment.session, {
        status: 'COMPLETED',
      });

      // Set station back to AVAILABLE
      const session = await Session.findById(payment.session);
      if (session) {
        await Station.findByIdAndUpdate(session.station, {
          status: 'AVAILABLE',
        });
      }

      res.json({
        status: 'success',
        data: { payment },
      });
    } catch (err) {
      next(err);
    }
  }
);

// GET /api/cafes/:cafeId/payments/stats — payment stats for dashboard (staff+)
router.get(
  '/stats',
  authenticate,
  requireCafeRole('OWNER', 'MANAGER', 'STAFF'),
  async (req, res, next) => {
    try {
      const cafeId = req.params.cafeId;

      const pendingCount = await Payment.countDocuments({
        cafe: cafeId,
        status: 'PENDING',
      });

      const pendingTotal = await Payment.aggregate([
        { $match: { cafe: new mongoose.Types.ObjectId(cafeId), status: 'PENDING' } },
        { $group: { _id: null, total: { $sum: '$amount' } } },
      ]);

      // Today's revenue (paid today)
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);

      const todayRevenue = await Payment.aggregate([
        {
          $match: {
            cafe: new mongoose.Types.ObjectId(cafeId),
            status: 'PAID',
            paidAt: { $gte: todayStart },
          },
        },
        { $group: { _id: null, total: { $sum: '$amount' } } },
      ]);

      const todayPaidCount = await Payment.countDocuments({
        cafe: cafeId,
        status: 'PAID',
        paidAt: { $gte: todayStart },
      });

      res.json({
        status: 'success',
        data: {
          pendingCount,
          pendingTotal: pendingTotal[0]?.total || 0,
          todayRevenue: todayRevenue[0]?.total || 0,
          todayPaidCount,
        },
      });
    } catch (err) {
      next(err);
    }
  }
);

export default router;
