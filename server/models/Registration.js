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

const registrationSchema = new mongoose.Schema({
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
    required: true,
    trim: true
  },
  paymentScreenshot: {
    type: String,
    required: true
  },
  paymentStatus: {
    type: String,
    enum: ['Pending', 'Verified', 'Rejected', 'Resubmit Requested'],
    default: 'Pending',
    index: true
  },
  rejectionReason: {
    type: String,
    default: ''
  }
}, {
  timestamps: true
});

registrationSchema.index({ createdAt: -1 });
registrationSchema.index({ 'leader.regNo': 1 });
registrationSchema.index({ 'members.regNo': 1 });
registrationSchema.index({ transactionId: 1 });

export const Registration = mongoose.model('Registration', registrationSchema);
