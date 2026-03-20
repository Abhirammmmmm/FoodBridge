const mongoose = require('mongoose');

const couponSchema = new mongoose.Schema({
  code: { type: String, required: true, unique: true },
  donor: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  restaurantId: String,
  restaurantName: String,
  issuedAt: { type: Date, default: Date.now },
  used: { type: Boolean, default: false }
});

module.exports = mongoose.model('Coupon', couponSchema);
