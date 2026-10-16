import { Router } from 'express';
import { body, validationResult } from 'express-validator';
import Session, { calculateSessionBill, CONTROLLER_HOURLY_RATE, CONTROLLER_PRICE } from '../models/Session.js';
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

// POST /api/cafes/:cafeId/sessions/manual — staff manually creates an active session
router.post(
  '/manual',
  authenticate,
  requireCafeRole('OWNER', 'MANAGER', 'STAFF'),
  [
    body('stationId').trim().notEmpty().withMessage('Station ID is required'),
    body('customerName').trim().notEmpty().withMessage('Customer name is required'),
    body('customerPhone')
      .trim()
      .notEmpty()
      .withMessage('Customer phone is required')
      .matches(/^[0-9+\s-]{7,15}$/)
      .withMessage('Please enter a valid phone number'),
    body('controllersRequested')
      .optional()
      .isInt({ min: 1, max: 8 })
      .withMessage('Controllers must be between 1 and 8'),
  ],
  validate,
  async (req, res, next) => {
    let stationClaimed = false;
    const { cafeId } = req.params;
    const { stationId, customerName, customerPhone, customerId } = req.body;
    const controllersRequested = req.body.controllersRequested
      ? parseInt(req.body.controllersRequested, 10)
      : 1;

    try {
      // 1. Resolve registered customer if exists (optional link)
      let matchedUserId = customerId || null;
      if (!matchedUserId && customerPhone) {
        const User = (await import('../models/User.js')).default;
        const existingUser = await User.findOne({ phone: customerPhone.trim() });
        if (existingUser) {
          const membership = await CafeMembership.findOne({
            user: existingUser._id,
            cafe: cafeId,
            isActive: true,
          });
          if (membership) {
            matchedUserId = existingUser._id;
          }
        }
      }

      // 2. Check if customer already has a pending or active session in this café
      const orConditions = [{ customerPhone: customerPhone.trim() }];
      if (matchedUserId) {
        orConditions.push({ customer: matchedUserId });
      }

      const existingSession = await Session.findOne({
        cafe: cafeId,
        status: { $in: ['REQUESTED', 'ACTIVE', 'PAYMENT_PENDING'] },
        $or: orConditions,
      });

      if (existingSession) {
        throw new AppError('Customer already has an active or pending session in this café', 400);
      }

      // 3. Atomically claim the station — must belong to this café and be AVAILABLE
      const station = await Station.findOneAndUpdate(
        {
          _id: stationId,
          cafe: cafeId,
          status: 'AVAILABLE',
          isActive: true,
        },
        { status: 'OCCUPIED' },
        { new: true }
      );

      if (!station) {
        throw new AppError('Station is not available or does not belong to this café', 409);
      }
      stationClaimed = true;

      // 4. Determine price: station override or café default
      const cafe = await Cafe.findById(cafeId).select('pricePerHour');
      const pricePerHour = station.pricePerHour ?? cafe.pricePerHour;
      const controllerCharge = 0;

      // 5. Create active session immediately
      const now = new Date();
      const session = await Session.create({
        cafe: cafeId,
        station: station._id,
        customer: matchedUserId || null,
        customerName: customerName.trim(),
        customerPhone: customerPhone.trim(),
        status: 'ACTIVE',
        pricePerHour,
        controllersRequested,
        controllerCharge,
        requestedAt: now,
        startedAt: now,
        approvedBy: req.user._id,
      });

      // Populate station and customer for immediate UI usage
      const populatedSession = await Session.findById(session._id)
        .populate('station', 'name type')
        .populate('customer', 'name email phone');

      res.status(201).json({
        status: 'success',
        data: { session: populatedSession },
      });
    } catch (err) {
      // Rollback station if it was claimed before an error occurred
      if (stationClaimed) {
        await Station.findByIdAndUpdate(stationId, { status: 'AVAILABLE' }).catch(() => {});
      }
      next(err);
    }
  }
);

// POST /api/cafes/:cafeId/sessions/request — customer requests a session
router.post(
  '/request',
  authenticate,
  [
    body('stationId').trim().notEmpty().withMessage('Station ID is required'),
    body('controllerCount')
      .optional()
      .isInt({ min: 1, max: 4 })
      .withMessage('Controller count must be between 1 and 4'),
    body('controllersRequested')
      .optional()
      .isInt({ min: 1, max: 4 })
      .withMessage('Controllers requested must be between 1 and 4'),
  ],
  validate,
  async (req, res, next) => {
    try {
      const { cafeId } = req.params;
      const { stationId } = req.body;

      // Extract controller count, authoritative default is 1
      const rawCount = req.body.controllerCount ?? req.body.controllersRequested;
      const controllersRequested = rawCount != null ? parseInt(rawCount, 10) : 1;
      if (controllersRequested < 1 || controllersRequested > 4) {
        throw new AppError('Number of controllers must be between 1 and 4', 400);
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
        status: { $in: ['REQUESTED', 'ACTIVE', 'PAYMENT_PENDING'] },
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
      const controllerCharge = 0;

      const session = await Session.create({
        cafe: cafeId,
        station: stationId,
        customer: req.user._id,
        customerName: req.user.name,
        customerPhone: req.user.phone || null,
        pricePerHour,
        controllersRequested,
        controllerCharge,
        requestedAt: new Date(),
      });

      const populatedSession = await Session.findById(session._id)
        .populate('station', 'name type')
        .populate('customer', 'name email phone');

      res.status(201).json({
        status: 'success',
        data: { session: populatedSession },
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
  [
    body('controllerCount')
      .optional()
      .isInt({ min: 1, max: 4 })
      .withMessage('Controller count must be between 1 and 4'),
    body('controllersRequested')
      .optional()
      .isInt({ min: 1, max: 4 })
      .withMessage('Controllers requested must be between 1 and 4'),
  ],
  validate,
  async (req, res, next) => {
    try {
      const existingSession = await Session.findOne({
        _id: req.params.sessionId,
        cafe: req.params.cafeId,
        status: 'REQUESTED',
      });

      if (!existingSession) {
        throw new AppError('Session not found or already processed', 404);
      }

      const updateData = {
        status: 'ACTIVE',
        startedAt: new Date(),
        approvedBy: req.user._id,
      };

      const rawCount = req.body.controllerCount ?? req.body.controllersRequested;
      if (rawCount != null) {
        const count = parseInt(rawCount, 10);
        updateData.controllersRequested = count;
      }
      updateData.controllerCharge = 0;

      const session = await Session.findByIdAndUpdate(
        existingSession._id,
        updateData,
        { new: true }
      )
        .populate('station', 'name type')
        .populate('customer', 'name email phone');

      // Set station to OCCUPIED
      const stationId = session.station?._id || session.station;
      await Station.findByIdAndUpdate(stationId, { status: 'OCCUPIED' });

      res.json({
        status: 'success',
        data: { session },
      });
    } catch (err) {
      next(err);
    }
  }
);

// PATCH /api/cafes/:cafeId/sessions/:sessionId/controllers — staff updates controller count
router.patch(
  '/:sessionId/controllers',
  authenticate,
  requireCafeRole('OWNER', 'MANAGER', 'STAFF'),
  [
    body('controllerCount')
      .optional()
      .isInt({ min: 1, max: 4 })
      .withMessage('Controller count must be between 1 and 4'),
    body('controllersRequested')
      .optional()
      .isInt({ min: 1, max: 4 })
      .withMessage('Controllers must be between 1 and 4'),
  ],
  validate,
  async (req, res, next) => {
    try {
      const rawCount = req.body.controllerCount ?? req.body.controllersRequested;
      if (rawCount == null) {
        throw new AppError('Controller count is required', 400);
      }
      const count = parseInt(rawCount, 10);

      const session = await Session.findOne({
        _id: req.params.sessionId,
        cafe: req.params.cafeId,
      });

      if (!session) {
        throw new AppError('Session not found', 404);
      }

      if (session.status !== 'REQUESTED') {
        throw new AppError(
          `Controller count is locked and cannot be modified once session is ${session.status}. Only REQUESTED sessions can be edited.`,
          400
        );
      }

      session.controllersRequested = count;
      session.controllerCharge = 0;
      await session.save();

      const populatedSession = await Session.findById(session._id)
        .populate('station', 'name type')
        .populate('customer', 'name email phone');

      res.json({
        status: 'success',
        data: { session: populatedSession },
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
      const bill = calculateSessionBill(session, now);

      session.status = 'PAYMENT_PENDING';
      session.endedAt = now;
      session.endedBy = req.user._id;
      session.sessionCharge = bill.sessionCharge;
      session.controllerCharge = bill.controllerCharge;
      session.finalAmount = bill.totalAmount;
      await session.save();

      // Create payment record (PENDING)
      await Payment.create({
        session: session._id,
        cafe: req.params.cafeId,
        customer: session.customer || null,
        customerName: session.customerName || (session.customer?.name) || null,
        customerPhone: session.customerPhone || (session.customer?.phone || session.customer?.email) || null,
        amount: bill.totalAmount,
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
        filter.status = { $in: ['REQUESTED', 'ACTIVE', 'PAYMENT_PENDING'] };
      }

      const sessions = await Session.find(filter)
        .populate('station', 'name type')
        .populate('customer', 'name email phone')
        .sort({ requestedAt: -1 });

      // Add computed fields for active sessions using shared billing utility
      const now = new Date();
      const enriched = sessions.map((s) => {
        const obj = s.toObject();
        if (s.status === 'ACTIVE' && s.startedAt) {
          const bill = calculateSessionBill(s, now);
          obj.elapsedMinutes = bill.elapsedMinutes;
          obj.sessionCharge = bill.sessionCharge;
          obj.controllerCharge = bill.controllerCharge;
          obj.currentBill = bill.totalAmount;
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
        status: { $in: ['REQUESTED', 'ACTIVE', 'PAYMENT_PENDING'] },
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
        const bill = calculateSessionBill(session, now);
        obj.elapsedMinutes = bill.elapsedMinutes;
        obj.sessionCharge = bill.sessionCharge;
        obj.controllerCharge = bill.controllerCharge;
        obj.currentBill = bill.totalAmount;
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
