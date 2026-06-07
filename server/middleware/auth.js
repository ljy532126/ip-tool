const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || require('crypto').randomBytes(32).toString('hex');
const JWT_EXPIRES = '7d';

function signToken(user) {
  return jwt.sign({ userId: user._id, username: user.username, role: user.role }, JWT_SECRET, { expiresIn: JWT_EXPIRES });
}

function authMiddleware(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ code: 401, message: '未登录，请先登录' });
  }

  const token = header.split(' ')[1];
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    req.user = { userId: payload.userId, username: payload.username, role: payload.role };
    next();
  } catch {
    return res.status(401).json({ code: 401, message: 'Token 已过期或无效，请重新登录' });
  }
}

function adminMiddleware(req, res, next) {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ code: 403, message: '权限不足，仅管理员可操作' });
  }
  next();
}

/**
 * 根据角色返回数据过滤条件
 * admin 返回 {} 可看全量，user 返回 { userId } 只看自己
 */
function ownerFilter(req, extra = {}) {
  if (req.user.role === 'admin') return { ...extra };
  return { userId: req.user.userId, ...extra };
}

module.exports = { signToken, authMiddleware, adminMiddleware, ownerFilter };
