import mongoose from 'mongoose';

const SESSION_STATUSES = ['REQUESTED', 'ACTIVE', 'PAYMENT_PENDING', 'COMPLETED', 'REJECTED', 'CANCELLED'];

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
      required: false,
      default: null,
    },
    customerName: {
      type: String,
      trim: true,
      default: null,
    },
    customerPhone: {
      type: String,
      trim: true,
      default: null,
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
    controllersRequested: {
      type: Number,
      default: 1,
      min: 1,
    },
    controllerCharge: {
      type: Number,
      default: 0,
      min: 0,
    },
    sessionCharge: {
      type: Number,
      default: null,
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
sessionSchema.index({ cafe: 1, customerPhone: 1, status: 1 });

const CONTROLLER_HOURLY_RATE = 100;
const CONTROLLER_PRICE = CONTROLLER_HOURLY_RATE;

/**
 * Authoritative billing calculation for a session.
 * Reused across session end, active session calculation, and exports.
 * Business Rule:
 * 1 controller costs ₹100 per HOUR (CONTROLLER_HOURLY_RATE).
 * Formula:
 * sessionCharge = (CONTROLLER_HOURLY_RATE * controllerCount * durationMinutes) / 60
 * Full precision is maintained, and final monetary amount is rounded to 2 decimal places.
 */
function calculateSessionBill(session, endTime = new Date()) {
  const startedAt = session.startedAt ? new Date(session.startedAt) : new Date(session.requestedAt || endTime);
  const endedAt = new Date(endTime);
  const elapsedMs = Math.max(0, endedAt.getTime() - startedAt.getTime());
  const elapsedMinutes = Math.floor(elapsedMs / 60000);
  const durationMinutes = elapsedMs / 60000;

  const controllerCount = session.controllersRequested || session.controllerCount || 1;
  const calculatedAmount = (CONTROLLER_HOURLY_RATE * controllerCount * durationMinutes) / 60;
  const totalAmount = Math.round(calculatedAmount * 100) / 100;

  const sessionCharge = totalAmount;
  const controllerCharge = totalAmount;

  return {
    elapsedMs,
    elapsedMinutes,
    durationMinutes,
    sessionCharge,
    controllerCharge,
    totalAmount,
  };
}

export { SESSION_STATUSES, CONTROLLER_HOURLY_RATE, CONTROLLER_PRICE, calculateSessionBill };
const Session = mongoose.model('Session', sessionSchema);

export default Session;

