import mongoose from 'mongoose';

// Reward points transaction — one record per award event.
// Prevents duplicate awards via unique index on session.
const rewardSchema = new mongoose.Schema(
  {
    customer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    cafe: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Cafe',
      required: true,
    },
    // Nullable: manual rewards not tied to a session won't have this.
    // Unique+sparse prevents awarding points twice for the same session.
    session: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Session',
      default: null,
    },
    payment: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Payment',
      default: null,
    },
    points: {
      type: Number,
      required: true,
      min: 1,
    },
    awardedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    note: {
      type: String,
      trim: true,
      default: null,
    },
  },
  { timestamps: true }
);

// Prevent duplicate award for the same session
rewardSchema.index({ session: 1 }, { unique: true, sparse: true });
rewardSchema.index({ customer: 1, createdAt: -1 });
rewardSchema.index({ cafe: 1 });

const Reward = mongoose.model('Reward', rewardSchema);
export default Reward;

