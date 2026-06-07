const mongoose = require('mongoose');
const crypto = require('crypto');

const linkSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  },
  key: {
    type: String,
    required: true,
    unique: true,
  },
  targetUrl: {
    type: String,
    required: true,
  },
  visitCount: {
    type: Number,
    default: 0,
  },
}, { timestamps: true });

linkSchema.index({ userId: 1, createdAt: -1 });

// 生成 8 位随机 key
function genKey() {
  return crypto.randomBytes(4).toString('base64url').slice(0, 8);
}

linkSchema.statics.createWithKey = async function (userId, targetUrl) {
  let key;
  let attempts = 0;
  while (attempts < 5) {
    key = genKey();
    const exists = await this.findOne({ key });
    if (!exists) break;
    key = null;
    attempts++;
  }
  if (!key) throw new Error('生成链接 key 失败，请重试');
  return this.create({ userId, key, targetUrl });
};

module.exports = mongoose.model('Link', linkSchema);
