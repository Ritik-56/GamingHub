import { Router } from 'express';
import { body, validationResult } from 'express-validator';
import mongoose from 'mongoose';
import Reward from '../models/Reward.js';
import Payment from '../models/Payment.js';
import Session from '../models/Session.js';
import { authenticate } from '../middleware/auth.js';
import { requireCafeRole } from '../middleware/cafeAuth.js';
import { AppError } from '../middleware/errorHandler.js';

const router = Router({ mergeParams: true });

const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const messages = errors.array().map((e) => e.msg).join(', ');
    return next(new AppError(messages, 400));
  }
  next();
};

// ---------------------------------------------------------------------------
// POST /api/cafes/:cafeId/rewards/award
// Staff/owner awards points to a customer for a completed, paid session.
// ---------------------------------------------------------------------------
router.post(
  '/award',
  authenticate,
  requireCafeRole('OWNER', 'MANAGER', 'STAFF'),
  [
    body('paymentId').isMongoId().withMessage('Valid payment ID is required'),
    body('points').isInt({ min: 1 }).withMessage('Points must be a positive integer'),
  ],
  validate,
  async (req, res, next) => {
    try {
      const { cafeId } = req.params;
      const { paymentId, points, note } = req.body;

      // Verify payment exists, is PAID, belongs to this café, and has a registered customer
      const payment = await Payment.findOne({
        _id: paymentId,
        cafe: cafeId,
        status: 'PAID',
      });

      if (!payment) {
        throw new AppError('Payment not found, not yet paid, or not in this café', 404);
      }

      if (!payment.customer) {
        throw new AppError(
          'No registered customer linked to this payment. Points can only be awarded to registered customers.',
          400
        );
      }

      if (!payment.session) {
        throw new AppError('Points can only be awarded for session-based payments', 400);
      }

      // Check session is COMPLETED
      const session = await Session.findById(payment.session);
      if (!session || session.status !== 'COMPLETED') {
        throw new AppError('Session must be completed before awarding points', 400);
      }

      // Check duplicate — unique index on session prevents double-award at DB level,
      // but give a friendly error message
      const existing = await Reward.findOne({ session: payment.session });
      if (existing) {
        throw new AppError(
          `Points already awarded for this session (${existing.points} pts on ${new Date(existing.createdAt).toLocaleDateString('en-IN')})`,
          409
        );
      }

      const reward = await Reward.create({
        customer: payment.customer,
        cafe: cafeId,
        session: payment.session,
        payment: payment._id,
        points: parseInt(points, 10),
        awardedBy: req.user._id,
        note: note?.trim() || null,
      });

      res.status(201).json({
        status: 'success',
        data: { reward },
      });
    } catch (err) {
      // Mongo duplicate key error from unique index
      if (err.code === 11000) {
        return next(new AppError('Points have already been awarded for this session', 409));
      }
      next(err);
    }
  }
);

// ---------------------------------------------------------------------------
// GET /api/cafes/:cafeId/rewards — list rewards for a café (staff+)
// ---------------------------------------------------------------------------
router.get(
  '/',
  authenticate,
  requireCafeRole('OWNER', 'MANAGER', 'STAFF'),
  async (req, res, next) => {
    try {
      const rewards = await Reward.find({ cafe: req.params.cafeId })
        .populate('customer', 'name email phone')
        .populate('session', 'startedAt endedAt')
        .populate('awardedBy', 'name')
        .sort({ createdAt: -1 })
        .limit(200);

      res.json({ status: 'success', data: { rewards } });
    } catch (err) {
      next(err);
    }
  }
);

// ---------------------------------------------------------------------------
// GET /api/rewards/my — customer's own reward history + totals
// Requires customer-scoped token (scope = 'customer').
// ---------------------------------------------------------------------------
router.get(
  '/my',
  authenticate,
  async (req, res, next) => {
    try {
      // Only customer-scoped tokens allowed here
      if (req.tokenScope !== 'customer') {
        throw new AppError('Customer authentication required', 403);
      }

      const customerId = req.user._id;

      const rewards = await Reward.find({ customer: customerId })
        .populate('cafe', 'name slug')
        .populate('session', 'startedAt endedAt controllersRequested finalAmount')
        .sort({ createdAt: -1 });

      const totalPoints = rewards.reduce((sum, r) => sum + r.points, 0);

      res.json({
        status: 'success',
        data: { rewards, totalPoints },
      });
    } catch (err) {
      next(err);
    }
  }
);

// ---------------------------------------------------------------------------
// GET /api/rewards/dashboard — customer's full dashboard stats + history
// Requires customer-scoped token.
// ---------------------------------------------------------------------------
router.get(
  '/dashboard',
  authenticate,
  async (req, res, next) => {
    try {
      if (req.tokenScope !== 'customer') {
        throw new AppError('Customer authentication required', 403);
      }

      const customerId = req.user._id;

      // All completed sessions for this customer
      const sessions = await Session.find({
        customer: customerId,
        status: 'COMPLETED',
      })
        .populate('cafe', 'name slug')
        .populate('station', 'name type')
        .sort({ endedAt: -1 });

      // All paid payments for this customer
      const payments = await Payment.find({
        customer: customerId,
        status: 'PAID',
      })
        .populate('cafe', 'name slug')
        .populate('session', 'startedAt endedAt controllersRequested')
        .sort({ paidAt: -1 });

      // All reward points for this customer
      const rewards = await Reward.find({ customer: customerId })
        .populate('cafe', 'name slug')
        .sort({ createdAt: -1 });

      const totalPoints = rewards.reduce((sum, r) => sum + r.points, 0);

      // Calculate total gaming hours from sessions
      let totalMinutes = 0;
      sessions.forEach((s) => {
        if (s.startedAt && s.endedAt) {
          totalMinutes += Math.floor((new Date(s.endedAt) - new Date(s.startedAt)) / 60000);
        }
      });

      // Build history: merge session + payment + reward data
      const rewardBySession = {};
      rewards.forEach((r) => {
        if (r.session) rewardBySession[r.session.toString()] = r.points;
      });

      const rewardByPayment = {};
      rewards.forEach((r) => {
        if (r.payment) rewardByPayment[r.payment.toString()] = r.points;
      });

      const history = payments.map((p) => {
        const sess = p.session;
        const pointsEarned =
          (sess && rewardBySession[sess._id?.toString()]) ||
          rewardByPayment[p._id.toString()] ||
          0;

        const durationMinutes =
          sess?.startedAt && sess?.endedAt
            ? Math.floor((new Date(sess.endedAt) - new Date(sess.startedAt)) / 60000)
            : null;

        return {
          paymentId: p._id,
          cafe: p.cafe,
          date: p.paidAt || p.createdAt,
          durationMinutes,
          controllers: sess?.controllersRequested || null,
          amountPaid: p.amount,
          pointsEarned,
          sessionId: sess?._id || null,
        };
      });

      res.json({
        status: 'success',
        data: {
          stats: {
            totalSessions: sessions.length,
            totalMinutes,
            totalPoints,
            totalSpent: payments.reduce((s, p) => s + p.amount, 0),
          },
          history,
          rewards,
        },
      });
    } catch (err) {
      next(err);
    }
  }
);

export default router;

