import mongoose from 'mongoose';

const ROLES = ['OWNER', 'MANAGER', 'STAFF', 'CUSTOMER'];

const cafeMembershipSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    cafe: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Cafe',
      required: true,
    },
    role: {
      type: String,
      enum: ROLES,
      required: true,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

cafeMembershipSchema.index({ user: 1, cafe: 1 }, { unique: true });
cafeMembershipSchema.index({ cafe: 1, role: 1 });

export { ROLES };
const CafeMembership = mongoose.model('CafeMembership', cafeMembershipSchema);

export default CafeMembership;
