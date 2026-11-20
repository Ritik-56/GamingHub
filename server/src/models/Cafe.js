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
    // GeoJSON Point — coordinates: [longitude, latitude]
    // NOTE: No defaults here — if coordinates are not provided, the entire
    // location field must be omitted so the sparse 2dsphere index stays valid.
    location: {
      type: {
        type: String,
        enum: ['Point'],
      },
      coordinates: {
        type: [Number], // [lng, lat]
      },
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
// Sparse so cafés without coordinates don't cause index errors
cafeSchema.index({ location: '2dsphere' }, { sparse: true });

const Cafe = mongoose.model('Cafe', cafeSchema);
export default Cafe;
