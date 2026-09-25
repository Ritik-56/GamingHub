import mongoose from 'mongoose';

const PAYMENT_STATUSES = ['PENDING', 'PAID'];

const paymentSchema = new mongoose.Schema(
  {
    session: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Session',
      required: true,
    },
    cafe: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Cafe',
      required: true,
    },
    customer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    amount: {
      type: Number,
      required: true,
      min: 0,
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
paymentSchema.index({ session: 1 }, { unique: true });
paymentSchema.index({ customer: 1, cafe: 1 });

export { PAYMENT_STATUSES };
const Payment = mongoose.model('Payment', paymentSchema);

export default Payment;
