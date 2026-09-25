import mongoose from 'mongoose';

const STATION_STATUSES = ['AVAILABLE', 'REQUESTED', 'OCCUPIED', 'PAYMENT_PENDING', 'MAINTENANCE'];
const DEFAULT_STATION_TYPES = ['PS5', 'Xbox', 'PC'];

const stationSchema = new mongoose.Schema(
  {
    cafe: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Cafe',
      required: true,
    },
    name: {
      type: String,
      required: [true, 'Station name is required'],
      trim: true,
      maxlength: 50,
    },
    type: {
      type: String,
      required: [true, 'Station type is required'],
      trim: true,
      maxlength: 30,
    },
    pricePerHour: {
      type: Number,
      default: null,
      min: 0,
    },
    status: {
      type: String,
      enum: STATION_STATUSES,
      default: 'AVAILABLE',
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

stationSchema.index({ cafe: 1, name: 1 }, { unique: true });
stationSchema.index({ cafe: 1, status: 1 });

export { STATION_STATUSES, DEFAULT_STATION_TYPES };
const Station = mongoose.model('Station', stationSchema);

export default Station;
