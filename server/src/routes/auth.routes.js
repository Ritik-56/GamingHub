import { Router } from 'express';
import { body, validationResult } from 'express-validator';
import User from '../models/User.js';
import CafeMembership from '../models/CafeMembership.js';
import { authenticate, signToken } from '../middleware/auth.js';
import { AppError } from '../middleware/errorHandler.js';

const router = Router();

// Roles that are considered "staff / admin"
const STAFF_ROLES = ['OWNER', 'MANAGER', 'STAFF'];

const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const message = errors.array().map((e) => e.msg).join(', ');
    return next(new AppError(message, 400));
  }
  next();
};

// ---------------------------------------------------------------------------
// POST /api/auth/register
//
// scope (body, optional): 'customer' | 'admin'  — defaults to 'customer'
//   • 'customer'  → creates a plain user account; the caller expects to use it
//                   only as a customer (no café membership).
//   • 'admin'     → same DB operation, but signals owner intent.
//
// Note: registration just creates a User document. The "owner" role is
// assigned only when the user creates a café (CafeMembership with role=OWNER).
// We do NOT store a global role on the User model — roles live in memberships.
// ---------------------------------------------------------------------------
router.post(
  '/register',
  [
    body('name').trim().notEmpty().withMessage('Name is required'),
    body('email').isEmail().withMessage('Valid email is required'),
    body('phone').optional().trim(),
    body('password')
      .isLength({ min: 6 })
      .withMessage('Password must be at least 6 characters'),
    body('scope')
      .optional()
      .isIn(['customer', 'admin'])
      .withMessage('scope must be customer or admin'),
  ],
  validate,
  async (req, res, next) => {
    try {
      const { name, email, phone, password, scope = 'customer' } = req.body;

      const existingUser = await User.findOne({ email });
      if (existingUser) {
        // If registering as admin but user already has a staff membership,
        // tell them to use the login form instead.
        if (scope === 'admin') {
          throw new AppError(
            'An account with this email already exists. Please sign in instead.',
            409
          );
        }
        // For customer scope: same message (no role leak).
        throw new AppError('Email already registered', 409);
      }

      const user = await User.create({ name, email, phone, password });
      const token = signToken(user._id);

      res.status(201).json({
        status: 'success',
        data: {
          token,
          user: user.toSafeObject(),
          scope,
        },
      });
    } catch (err) {
      next(err);
    }
  }
);

// ---------------------------------------------------------------------------
// POST /api/auth/login
//
// scope (body, required): 'customer' | 'admin'
//   • 'customer'  → login succeeds ONLY if the user has NO active staff/owner
//                   membership (OWNER, MANAGER, STAFF) in any café.
//                   A pure customer — or a brand-new user with no memberships —
//                   is allowed through.
//   • 'admin'     → login succeeds ONLY if the user has at least one active
//                   staff/owner membership (OWNER, MANAGER, STAFF) in a café.
//
// The role is resolved entirely from the DB (CafeMembership). The frontend
// never supplies a role that is trusted for authorization.
// ---------------------------------------------------------------------------
router.post(
  '/login',
  [
    body('email').isEmail().withMessage('Valid email is required'),
    body('password').notEmpty().withMessage('Password is required'),
    body('scope')
      .notEmpty().withMessage('scope is required')
      .isIn(['customer', 'admin'])
      .withMessage('scope must be customer or admin'),
  ],
  validate,
  async (req, res, next) => {
    try {
      const { email, password, scope } = req.body;

      const user = await User.findOne({ email }).select('+password');
      if (!user || !(await user.comparePassword(password))) {
        throw new AppError('Invalid email or password', 401);
      }

      // ------------------------------------------------------------------
      // Role check — query CafeMembership to determine this user's highest
      // privilege across all cafés.
      // ------------------------------------------------------------------
      const staffMembership = await CafeMembership.findOne({
        user: user._id,
        role: { $in: STAFF_ROLES },
        isActive: true,
      });

      const isStaff = !!staffMembership;

      if (scope === 'customer' && isStaff) {
        // Owner/manager/staff trying to use the customer login form.
        throw new AppError(
          'This account belongs to a café owner or staff member. ' +
            'Please use the Owner / Staff login instead.',
          403
        );
      }

      if (scope === 'admin' && !isStaff) {
        // Pure customer (or new user with no café) trying to use owner login.
        throw new AppError(
          'This account does not have owner or staff access. ' +
            'Please register or use the Customer login.',
          403
        );
      }

      const token = signToken(user._id);

      res.json({
        status: 'success',
        data: {
          token,
          user: user.toSafeObject(),
          scope,
        },
      });
    } catch (err) {
      next(err);
    }
  }
);

// GET /api/auth/me
router.get('/me', authenticate, (req, res) => {
  res.json({
    status: 'success',
    data: { user: req.user.toSafeObject() },
  });
});

export default router;
