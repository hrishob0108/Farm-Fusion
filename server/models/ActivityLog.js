import mongoose from 'mongoose';

const activityLogSchema = new mongoose.Schema({
  action: { type: String, required: true },
  details: { type: String, required: true },
  adminUsername: { type: String, default: 'admin' },
  timestamp: { type: Date, default: Date.now }
});

export const ActivityLog = mongoose.models.ActivityLog || mongoose.model('ActivityLog', activityLogSchema);
