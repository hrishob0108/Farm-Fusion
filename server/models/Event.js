import mongoose from 'mongoose';

const eventSchema = new mongoose.Schema({
  eventName: {
    type: String,
    required: true,
    default: 'FarmFusion'
  },
  tagline: {
    type: String,
    default: 'Where AI Meets Agriculture'
  },
  eventDate: {
    type: Date,
    required: true,
    default: () => new Date(Date.now() + 15 * 24 * 60 * 60 * 1000)
  },
  registrationOpen: {
    type: Boolean,
    default: true
  },
  registrationProgress: {
    type: Number,
    default: 0,
    min: 0,
    max: 100
  },
  minMembers: {
    type: Number,
    default: 2,
    min: 1,
    max: 10
  },
  maxMembers: {
    type: Number,
    default: 4,
    min: 1,
    max: 10
  },
  maxTeams: {
    type: Number,
    default: 50,
    min: 1
  },
  payment: {
    upiId: { type: String, default: 'farmfusionai@okaxis' },
    amount: { type: Number, default: 499 },
    accountHolder: { type: String, default: 'FarmFusion Org' },
    qrImage: { type: String, default: 'https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=farmfusionai@okaxis' }
  },
  whatsapp: {
    group: { type: String, default: 'https://chat.whatsapp.com/sample-official-group' },
    discussion: { type: String, default: 'https://chat.whatsapp.com/sample-discussion-group' },
    channel: { type: String, default: 'https://whatsapp.com/channel/sample-channel' }
  }
}, { timestamps: true });

export const Event = mongoose.models.Event || mongoose.model('Event', eventSchema);
