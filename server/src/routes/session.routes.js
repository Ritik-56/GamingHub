import { Router } from 'express';
import { body, validationResult } from 'express-validator';
import Session from '../models/Session.js';
import Station from '../models/Station.js';
import Cafe from '../models/Cafe.js';
import CafeMembership from '../models/CafeMembership.js';
import Payment from '../models/Payment.js';
import { authenticate } from '../middleware/auth.js';
import { requireCafeRole } from '../middleware/cafeAuth.js';
import { AppError } from '../middleware/errorHandler.js';

const router = Router({ mergeParams: true });

const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const message = errors.array().map((e) => e.msg).join(', ');
    return next(new AppError(message, 400));
  }
  next();
};

// POST /api/cafes/:cafeId/sessions/request — customer requests a session
router.post(
  '/request',
  authenticate,
  async (req, res, next) => {
    try {
      const { cafeId } = req.params;
      const { stationId } = req.body;

      if (!stationId) {
        throw new AppError('Station ID is required', 400);
      }

      // Verify customer membership (auto-created on café entry)
      const membership = await CafeMembership.findOne({
        user: req.user._id,
        cafe: cafeId,
        isActive: true,
      });

      if (!membership) {
        throw new AppError('You are not a member of this café', 403);
      }

      // Check if customer already has a pending/active session in this café
      const existingSession = await Session.findOne({
        cafe: cafeId,
        customer: req.user._id,
        status: { $in: ['REQUESTED', 'ACTIVE'] },
      });

      if (existingSession) {
        throw new AppError('You already have an active or pending session', 400);
      }

      // Atomically claim the station — only if it's AVAILABLE
      const station = await Station.findOneAndUpdate(
        {
          _id: stationId,
          cafe: cafeId,
          status: 'AVAILABLE',
          isActive: true,
        },
        { status: 'REQUESTED' },
        { new: true }
      );

      if (!station) {
        throw new AppError('Station is not available', 409);
      }

      // Determine price: station override or café default
      const cafe = await Cafe.findById(cafeId).select('pricePerHour');
      const pricePerHour = station.pricePerHour ?? cafe.pricePerHour;

      const session = await Session.create({
        cafe: cafeId,
        station: stationId,
        customer: req.user._id,
        pricePerHour,
        requestedAt: new Date(),
      });

      res.status(201).json({
        status: 'success',
        data: { session },
      });
    } catch (err) {
      next(err);
    }
  }
);

// POST /api/cafes/:cafeId/sessions/:sessionId/approve — staff approves
router.post(
  '/:sessionId/approve',
  authenticate,
  requireCafeRole('OWNER', 'MANAGER', 'STAFF'),
  async (req, res, next) => {
    try {
      const session = await Session.findOneAndUpdate(
        {
          _id: req.params.sessionId,
          cafe: req.params.cafeId,
          status: 'REQUESTED',
        },
        {
          status: 'ACTIVE',
          startedAt: new Date(),
          approvedBy: req.user._id,
        },
        { new: true }
      );

      if (!session) {
        throw new AppError('Session not found or already processed', 404);
      }

      // Set station to OCCUPIED
      await Station.findByIdAndUpdate(session.station, { status: 'OCCUPIED' });

      res.json({
        status: 'success',
        data: { session },
      });
    } catch (err) {
      next(err);
    }
  }
);

// POST /api/cafes/:cafeId/sessions/:sessionId/reject — staff rejects
router.post(
  '/:sessionId/reject',
  authenticate,
  requireCafeRole('OWNER', 'MANAGER', 'STAFF'),
  async (req, res, next) => {
    try {
      const session = await Session.findOneAndUpdate(
        {
          _id: req.params.sessionId,
          cafe: req.params.cafeId,
          status: 'REQUESTED',
        },
        { status: 'REJECTED' },
        { new: true }
      );

      if (!session) {
        throw new AppError('Session not found or already processed', 404);
      }

      // Set station back to AVAILABLE
      await Station.findByIdAndUpdate(session.station, { status: 'AVAILABLE' });

      res.json({
        status: 'success',
        data: { session },
      });
    } catch (err) {
      next(err);
    }
  }
);

// POST /api/cafes/:cafeId/sessions/:sessionId/end — staff ends session
router.post(
  '/:sessionId/end',
  authenticate,
  requireCafeRole('OWNER', 'MANAGER', 'STAFF'),
  async (req, res, next) => {
    try {
      const session = await Session.findOne({
        _id: req.params.sessionId,
        cafe: req.params.cafeId,
        status: 'ACTIVE',
      });

      if (!session) {
        throw new AppError('Session not found or not active', 404);
      }

      const now = new Date();
      const elapsedMs = now - session.startedAt;
      const elapsedMinutes = elapsedMs / 60000;
      const finalAmount = Math.round((elapsedMinutes / 60) * session.pricePerHour);

      session.status = 'COMPLETED';
      session.endedAt = now;
      session.endedBy = req.user._id;
      session.finalAmount = finalAmount;
      await session.save();

      // Create payment record (PENDING)
      await Payment.create({
        session: session._id,
        cafe: req.params.cafeId,
        customer: session.customer,
        amount: finalAmount,
      });

      // Set station to PAYMENT_PENDING (not AVAILABLE — waits for payment confirmation)
      await Station.findByIdAndUpdate(session.station, { status: 'PAYMENT_PENDING' });

      res.json({
        status: 'success',
        data: { session },
      });
    } catch (err) {
      next(err);
    }
  }
);

// GET /api/cafes/:cafeId/sessions — staff sees pending/active sessions
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
        // Default: show actionable sessions
        filter.status = { $in: ['REQUESTED', 'ACTIVE'] };
      }

      const sessions = await Session.find(filter)
        .populate('station', 'name type')
        .populate('customer', 'name email phone')
        .sort({ requestedAt: -1 });

      // Add computed fields for active sessions
      const now = new Date();
      const enriched = sessions.map((s) => {
        const obj = s.toObject();
        if (s.status === 'ACTIVE' && s.startedAt) {
          const elapsedMs = now - s.startedAt;
          obj.elapsedMinutes = Math.floor(elapsedMs / 60000);
          obj.currentBill = Math.round((elapsedMs / 3600000) * s.pricePerHour);
        }
        return obj;
      });

      res.json({
        status: 'success',
        data: { sessions: enriched },
      });
    } catch (err) {
      next(err);
    }
  }
);

// GET /api/cafes/:cafeId/sessions/my — customer sees their own session
router.get(
  '/my',
  authenticate,
  async (req, res, next) => {
    try {
      const session = await Session.findOne({
        cafe: req.params.cafeId,
        customer: req.user._id,
        status: { $in: ['REQUESTED', 'ACTIVE'] },
      })
        .populate('station', 'name type')
        .sort({ requestedAt: -1 });

      if (!session) {
        return res.json({
          status: 'success',
          data: { session: null },
        });
      }

      const obj = session.toObject();
      if (session.status === 'ACTIVE' && session.startedAt) {
        const now = new Date();
        const elapsedMs = now - session.startedAt;
        obj.elapsedMinutes = Math.floor(elapsedMs / 60000);
        obj.currentBill = Math.round((elapsedMs / 3600000) * session.pricePerHour);
      }

      res.json({
        status: 'success',
        data: { session: obj },
      });
    } catch (err) {
      next(err);
    }
  }
);

// GET /api/cafes/:cafeId/sessions/my/history — customer's past sessions
router.get(
  '/my/history',
  authenticate,
  async (req, res, next) => {
    try {
      const sessions = await Session.find({
        cafe: req.params.cafeId,
        customer: req.user._id,
        status: { $in: ['COMPLETED', 'REJECTED', 'CANCELLED'] },
      })
        .populate('station', 'name type')
        .sort({ endedAt: -1 })
        .limit(50);

      res.json({
        status: 'success',
        data: { sessions },
      });
    } catch (err) {
      next(err);
    }
  }
);

export default router;
