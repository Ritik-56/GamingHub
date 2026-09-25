import { Router } from 'express';
import { body, param, validationResult } from 'express-validator';
import Cafe from '../models/Cafe.js';
import CafeMembership from '../models/CafeMembership.js';
import { authenticate } from '../middleware/auth.js';
import { requireCafeRole } from '../middleware/cafeAuth.js';
import { AppError } from '../middleware/errorHandler.js';

const router = Router();

const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const message = errors.array().map((e) => e.msg).join(', ');
    return next(new AppError(message, 400));
  }
  next();
};

function generateSlug(name) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .trim();
}

// POST /api/cafes — create a new café (authenticated user becomes owner)
router.post(
  '/',
  authenticate,
  [
    body('name').trim().notEmpty().withMessage('Café name is required'),
    body('address').optional().trim(),
    body('phone').optional().trim(),
    body('email').optional().isEmail().withMessage('Valid email required'),
    body('pricePerHour').optional().isFloat({ min: 0 }).withMessage('Price must be a positive number'),
  ],
  validate,
  async (req, res, next) => {
    try {
      const { name, address, phone, email, pricePerHour } = req.body;

      let slug = generateSlug(name);

      // Ensure slug uniqueness
      const existingSlug = await Cafe.findOne({ slug });
      if (existingSlug) {
        slug = `${slug}-${Date.now().toString(36)}`;
      }

      const cafe = await Cafe.create({
        name,
        slug,
        address,
        phone,
        email,
        pricePerHour: pricePerHour || 100,
        owner: req.user._id,
      });

      // Create OWNER membership
      await CafeMembership.create({
        user: req.user._id,
        cafe: cafe._id,
        role: 'OWNER',
      });

      res.status(201).json({
        status: 'success',
        data: { cafe },
      });
    } catch (err) {
      next(err);
    }
  }
);

// GET /api/cafes/my — get cafés the current user is a member of
router.get('/my', authenticate, async (req, res, next) => {
  try {
    const memberships = await CafeMembership.find({
      user: req.user._id,
      isActive: true,
    }).populate('cafe');

    const cafes = memberships.map((m) => ({
      cafe: m.cafe,
      role: m.role,
      membershipId: m._id,
    }));

    res.json({
      status: 'success',
      data: { cafes },
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/cafes/slug/:slug — public route for QR entry
router.get('/slug/:slug', async (req, res, next) => {
  try {
    const cafe = await Cafe.findOne({ slug: req.params.slug, isActive: true })
      .select('name slug address phone email pricePerHour currency stationTypes');

    if (!cafe) {
      throw new AppError('Café not found', 404);
    }

    // Include active stations for the customer view
    const Station = (await import('../models/Station.js')).default;
    const stations = await Station.find({ cafe: cafe._id, isActive: true })
      .select('name type pricePerHour status')
      .sort({ name: 1 });

    const stationsWithPrice = stations.map((s) => {
      const obj = s.toObject();
      obj.effectivePrice = s.pricePerHour ?? cafe.pricePerHour;
      obj.currency = cafe.currency;
      return obj;
    });

    res.json({
      status: 'success',
      data: { cafe, stations: stationsWithPrice },
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/cafes/:cafeId — get café details (members only)
router.get(
  '/:cafeId',
  authenticate,
  requireCafeRole(),
  async (req, res, next) => {
    try {
      const cafe = await Cafe.findById(req.params.cafeId);
      if (!cafe) {
        throw new AppError('Café not found', 404);
      }

      res.json({
        status: 'success',
        data: { cafe, role: req.membership.role },
      });
    } catch (err) {
      next(err);
    }
  }
);

// PUT /api/cafes/:cafeId — update café settings (owner/manager)
router.put(
  '/:cafeId',
  authenticate,
  requireCafeRole('OWNER', 'MANAGER'),
  [
    body('name').optional().trim().notEmpty(),
    body('address').optional().trim(),
    body('phone').optional().trim(),
    body('email').optional().isEmail(),
    body('pricePerHour').optional().isFloat({ min: 0 }),
  ],
  validate,
  async (req, res, next) => {
    try {
      const allowedFields = ['name', 'address', 'phone', 'email', 'pricePerHour'];
      const updates = {};
      for (const field of allowedFields) {
        if (req.body[field] !== undefined) {
          updates[field] = req.body[field];
        }
      }

      const cafe = await Cafe.findByIdAndUpdate(
        req.params.cafeId,
        updates,
        { new: true, runValidators: true }
      );

      if (!cafe) {
        throw new AppError('Café not found', 404);
      }

      res.json({
        status: 'success',
        data: { cafe },
      });
    } catch (err) {
      next(err);
    }
  }
);

// POST /api/cafes/slug/:slug/join — customer joins a café (creates CUSTOMER membership if not exists)
router.post('/slug/:slug/join', authenticate, async (req, res, next) => {
  try {
    const cafe = await Cafe.findOne({ slug: req.params.slug, isActive: true });
    if (!cafe) {
      throw new AppError('Café not found', 404);
    }

    // Check if already a member
    let membership = await CafeMembership.findOne({
      user: req.user._id,
      cafe: cafe._id,
    });

    if (membership) {
      return res.json({
        status: 'success',
        data: { cafe, membership },
      });
    }

    // Create CUSTOMER membership
    membership = await CafeMembership.create({
      user: req.user._id,
      cafe: cafe._id,
      role: 'CUSTOMER',
    });

    res.status(201).json({
      status: 'success',
      data: { cafe, membership },
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/cafes/:cafeId/staff — list all staff members (owner/manager)
router.get(
  '/:cafeId/staff',
  authenticate,
  requireCafeRole('OWNER', 'MANAGER'),
  async (req, res, next) => {
    try {
      const memberships = await CafeMembership.find({
        cafe: req.params.cafeId,
        role: { $in: ['OWNER', 'MANAGER', 'STAFF'] },
        isActive: true,
      }).populate('user', 'name email phone');

      const staff = memberships.map((m) => ({
        membershipId: m._id,
        userId: m.user._id,
        name: m.user.name,
        email: m.user.email,
        phone: m.user.phone,
        role: m.role,
        joinedAt: m.createdAt,
      }));

      res.json({
        status: 'success',
        data: { staff },
      });
    } catch (err) {
      next(err);
    }
  }
);

// POST /api/cafes/:cafeId/staff — add a staff member (owner/manager)
// Creates user account if not exists, creates membership with specified role
router.post(
  '/:cafeId/staff',
  authenticate,
  requireCafeRole('OWNER', 'MANAGER'),
  [
    body('name').trim().notEmpty().withMessage('Name is required'),
    body('email').isEmail().withMessage('Valid email is required'),
    body('phone').optional().trim(),
    body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
    body('role').isIn(['MANAGER', 'STAFF']).withMessage('Role must be MANAGER or STAFF'),
  ],
  validate,
  async (req, res, next) => {
    try {
      const { name, email, phone, password, role } = req.body;
      const User = (await import('../models/User.js')).default;

      // Check if caller is trying to assign a role above their own
      if (role === 'MANAGER' && req.membership.role !== 'OWNER') {
        throw new AppError('Only owners can add managers', 403);
      }

      // Find or create user
      let user = await User.findOne({ email });
      if (!user) {
        user = await User.create({ name, email, phone, password });
      }

      // Check if already a member of this café
      const existingMembership = await CafeMembership.findOne({
        user: user._id,
        cafe: req.params.cafeId,
      });

      if (existingMembership) {
        if (['OWNER', 'MANAGER', 'STAFF'].includes(existingMembership.role)) {
          throw new AppError('This user is already a staff member', 409);
        }
        // Upgrade from CUSTOMER to staff role
        existingMembership.role = role;
        existingMembership.isActive = true;
        await existingMembership.save();

        return res.json({
          status: 'success',
          data: {
            staff: {
              membershipId: existingMembership._id,
              userId: user._id,
              name: user.name,
              email: user.email,
              phone: user.phone,
              role: existingMembership.role,
            },
          },
        });
      }

      // Create new membership
      const membership = await CafeMembership.create({
        user: user._id,
        cafe: req.params.cafeId,
        role,
      });

      res.status(201).json({
        status: 'success',
        data: {
          staff: {
            membershipId: membership._id,
            userId: user._id,
            name: user.name,
            email: user.email,
            phone: user.phone,
            role: membership.role,
          },
        },
      });
    } catch (err) {
      next(err);
    }
  }
);

// DELETE /api/cafes/:cafeId/staff/:membershipId — remove staff (owner/manager)
router.delete(
  '/:cafeId/staff/:membershipId',
  authenticate,
  requireCafeRole('OWNER', 'MANAGER'),
  async (req, res, next) => {
    try {
      const membership = await CafeMembership.findOne({
        _id: req.params.membershipId,
        cafe: req.params.cafeId,
      });

      if (!membership) {
        throw new AppError('Staff member not found', 404);
      }

      if (membership.role === 'OWNER') {
        throw new AppError('Cannot remove the café owner', 400);
      }

      // Managers can only remove STAFF
      if (req.membership.role === 'MANAGER' && membership.role === 'MANAGER') {
        throw new AppError('Only owners can remove managers', 403);
      }

      membership.isActive = false;
      await membership.save();

      res.json({
        status: 'success',
        data: { message: 'Staff member removed' },
      });
    } catch (err) {
      next(err);
    }
  }
);

export default router;

