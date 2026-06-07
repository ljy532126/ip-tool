const mongoose = require('mongoose');

const visitLogSchema = new mongoose.Schema({
  linkId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Link',
    required: true,
    index: true,
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  },
  ip: { type: String, default: '' },
  userAgent: { type: String, default: '' },
  geoInfo: {
    country: { type: String, default: '' },
    province: { type: String, default: '' },
    city: { type: String, default: '' },
    district: { type: String, default: '' },
    isp: { type: String, default: '' },
    asn: { type: String, default: '' },
    latitude: { type: Number, default: 0 },
    longitude: { type: Number, default: 0 },
  },
}, { timestamps: true });

visitLogSchema.index({ userId: 1, createdAt: -1 });
visitLogSchema.index({ linkId: 1, createdAt: -1 });
visitLogSchema.index({ ip: 1 });

module.exports = mongoose.model('VisitLog', visitLogSchema);
