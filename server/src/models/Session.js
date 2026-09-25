import mongoose from 'mongoose';

const SESSION_STATUSES = ['REQUESTED', 'ACTIVE', 'COMPLETED', 'REJECTED', 'CANCELLED'];

const sessionSchema = new mongoose.Schema(
  {
    cafe: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Cafe',
      required: true,
    },
    station: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Station',
      required: true,
    },
    customer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    status: {
      type: String,
      enum: SESSION_STATUSES,
      default: 'REQUESTED',
    },
    requestedAt: {
      type: Date,
      default: Date.now,
    },
    startedAt: Date,
    endedAt: Date,
    pricePerHour: {
      type: Number,
      required: true,
      min: 0,
    },
    finalAmount: {
      type: Number,
      default: null,
    },
    approvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    endedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
  },
  {
    timestamps: true,
  }
);

sessionSchema.index({ cafe: 1, station: 1, status: 1 });
sessionSchema.index({ cafe: 1, customer: 1, status: 1 });

export { SESSION_STATUSES };
const Session = mongoose.model('Session', sessionSchema);

export default Session;
