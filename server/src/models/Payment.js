import mongoose from 'mongoose';

const PAYMENT_STATUSES = ['PENDING', 'PAID'];

const paymentSchema = new mongoose.Schema(
  {
    session: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Session',
      required: false,
      default: null,
    },
    cafe: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Cafe',
      required: true,
    },
    station: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Station',
      required: false,
      default: null,
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
    amount: {
      type: Number,
      required: true,
      min: 0,
    },
    paymentMethod: {
      type: String,
      enum: ['CASH', 'UPI', 'CARD', 'OTHER'],
      default: 'CASH',
    },
    notes: {
      type: String,
      trim: true,
      default: null,
    },
    status: {
      type: String,
      enum: PAYMENT_STATUSES,
      default: 'PENDING',
    },
    paidAt: Date,
    markedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
  },
  {
    timestamps: true,
  }
);

paymentSchema.index({ cafe: 1, status: 1 });
paymentSchema.index({ session: 1 }, { unique: true, sparse: true });
paymentSchema.index({ customer: 1, cafe: 1 });
paymentSchema.index({ cafe: 1, customerPhone: 1 });

export { PAYMENT_STATUSES };
const Payment = mongoose.model('Payment', paymentSchema);

export default Payment;
