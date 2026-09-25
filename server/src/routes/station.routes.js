import { Router } from 'express';
import { body, validationResult } from 'express-validator';
import Station from '../models/Station.js';
import Cafe from '../models/Cafe.js';
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

// GET /api/cafes/:cafeId/stations — list stations
router.get(
  '/',
  authenticate,
  requireCafeRole(),
  async (req, res, next) => {
    try {
      const filter = { cafe: req.params.cafeId };

      // Customers only see active stations
      if (req.membership.role === 'CUSTOMER') {
        filter.isActive = true;
      }

      const stations = await Station.find(filter).sort({ name: 1 });

      // Get café price as fallback
      const cafe = await Cafe.findById(req.params.cafeId).select('pricePerHour currency');

      const stationsWithPrice = stations.map((s) => {
        const obj = s.toObject();
        obj.effectivePrice = s.pricePerHour ?? cafe.pricePerHour;
        obj.currency = cafe.currency;
        return obj;
      });

      res.json({
        status: 'success',
        data: { stations: stationsWithPrice },
      });
    } catch (err) {
      next(err);
    }
  }
);

// POST /api/cafes/:cafeId/stations — create station (owner/manager)
router.post(
  '/',
  authenticate,
  requireCafeRole('OWNER', 'MANAGER'),
  [
    body('name').trim().notEmpty().withMessage('Station name is required'),
    body('type').trim().notEmpty().withMessage('Station type is required'),
    body('pricePerHour').optional({ nullable: true }).isFloat({ min: 0 }),
  ],
  validate,
  async (req, res, next) => {
    try {
      const { name, type, pricePerHour } = req.body;

      const existing = await Station.findOne({ cafe: req.params.cafeId, name });
      if (existing) {
        throw new AppError('A station with this name already exists', 409);
      }

      const station = await Station.create({
        cafe: req.params.cafeId,
        name,
        type,
        pricePerHour: pricePerHour ?? null,
      });

      res.status(201).json({
        status: 'success',
        data: { station },
      });
    } catch (err) {
      next(err);
    }
  }
);

// PUT /api/cafes/:cafeId/stations/:stationId — update station (owner/manager)
router.put(
  '/:stationId',
  authenticate,
  requireCafeRole('OWNER', 'MANAGER'),
  [
    body('name').optional().trim().notEmpty(),
    body('type').optional().trim().notEmpty(),
    body('pricePerHour').optional({ nullable: true }).isFloat({ min: 0 }),
    body('isActive').optional().isBoolean(),
  ],
  validate,
  async (req, res, next) => {
    try {
      const allowedFields = ['name', 'type', 'pricePerHour', 'isActive'];
      const updates = {};
      for (const field of allowedFields) {
        if (req.body[field] !== undefined) {
          updates[field] = req.body[field];
        }
      }

      const station = await Station.findOneAndUpdate(
        { _id: req.params.stationId, cafe: req.params.cafeId },
        updates,
        { new: true, runValidators: true }
      );

      if (!station) {
        throw new AppError('Station not found', 404);
      }

      res.json({
        status: 'success',
        data: { station },
      });
    } catch (err) {
      next(err);
    }
  }
);

// PATCH /api/cafes/:cafeId/stations/:stationId/status — change status (staff+)
router.patch(
  '/:stationId/status',
  authenticate,
  requireCafeRole('OWNER', 'MANAGER', 'STAFF'),
  [
    body('status').isIn(['AVAILABLE', 'MAINTENANCE']).withMessage('Can only set AVAILABLE or MAINTENANCE'),
  ],
  validate,
  async (req, res, next) => {
    try {
      const station = await Station.findOne({
        _id: req.params.stationId,
        cafe: req.params.cafeId,
      });

      if (!station) {
        throw new AppError('Station not found', 404);
      }

      // Only allow toggling to MAINTENANCE or back to AVAILABLE from MAINTENANCE
      if (req.body.status === 'AVAILABLE' && station.status !== 'MAINTENANCE') {
        throw new AppError('Can only set to AVAILABLE from MAINTENANCE status', 400);
      }

      if (req.body.status === 'MAINTENANCE' && !['AVAILABLE', 'MAINTENANCE'].includes(station.status)) {
        throw new AppError('Cannot set to MAINTENANCE while station is in use', 400);
      }

      station.status = req.body.status;
      await station.save();

      res.json({
        status: 'success',
        data: { station },
      });
    } catch (err) {
      next(err);
    }
  }
);

export default router;
