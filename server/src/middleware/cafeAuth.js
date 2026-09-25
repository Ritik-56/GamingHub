import CafeMembership from '../models/CafeMembership.js';
import { AppError } from './errorHandler.js';

export function requireCafeRole(...allowedRoles) {
  return async (req, res, next) => {
    try {
      const cafeId = req.params.cafeId;
      if (!cafeId) {
        throw new AppError('Café ID is required', 400);
      }

      const membership = await CafeMembership.findOne({
        user: req.user._id,
        cafe: cafeId,
        isActive: true,
      });

      if (!membership) {
        throw new AppError('You are not a member of this café', 403);
      }

      if (allowedRoles.length > 0 && !allowedRoles.includes(membership.role)) {
        throw new AppError('You do not have permission for this action', 403);
      }

      req.membership = membership;
      next();
    } catch (err) {
      next(err);
    }
  };
}
