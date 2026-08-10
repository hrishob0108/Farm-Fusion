import mongoose from 'mongoose';

const memberSchema = new mongoose.Schema({
  name: { type: String, required: true },
  regNo: { type: String, required: true },
  email: { type: String },
  phone: { type: String, required: true },
  section: { type: String, required: true },
  branch: { type: String, required: true },
  residenceType: { type: String, enum: ['Hosteller', 'Day Scholar'], required: true },
  hostelName: { type: String, default: '' },
  roomNumber: { type: String, default: '' }
}, { _id: false });

const reservationSchema = new mongoose.Schema({
  reservationId: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  teamName: {
    type: String,
    required: true,
    trim: true,
    index: true
  },
  leader: {
    type: memberSchema,
    required: true
  },
  members: [memberSchema],
  transactionId: {
    type: String,
    default: '',
    trim: true,
    index: true
  },
  status: {
    type: String,
    enum: ['reserved', 'confirmed', 'expired', 'cancelled'],
    default: 'reserved',
    index: true
  },
  reservedAt: {
    type: Date,
    default: Date.now
  },
  expiresAt: {
    type: Date,
    required: true,
    index: true
  }
}, {
  timestamps: true
});

// Compound indexes for fast active reservation query & cleanup
reservationSchema.index({ status: 1, expiresAt: 1 });
reservationSchema.index({ 'leader.regNo': 1 });

export const Reservation = mongoose.models.Reservation || mongoose.model('Reservation', reservationSchema);
