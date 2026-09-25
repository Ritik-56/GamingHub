import mongoose from 'mongoose';

const cafeSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Café name is required'],
      trim: true,
      maxlength: 100,
    },
    slug: {
      type: String,
      required: [true, 'Slug is required'],
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^[a-z0-9-]+$/, 'Slug must be lowercase alphanumeric with hyphens only'],
    },
    address: {
      type: String,
      trim: true,
      maxlength: 300,
    },
    phone: {
      type: String,
      trim: true,
      maxlength: 20,
    },
    email: {
      type: String,
      trim: true,
      lowercase: true,
    },
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    pricePerHour: {
      type: Number,
      default: 100,
      min: 0,
    },
    currency: {
      type: String,
      default: '₹',
      maxlength: 5,
    },
    stationTypes: {
      type: [String],
      default: ['PS5', 'Xbox', 'PC'],
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

cafeSchema.index({ owner: 1 });

const Cafe = mongoose.model('Cafe', cafeSchema);

export default Cafe;
