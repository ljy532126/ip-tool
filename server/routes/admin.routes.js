const express = require('express');
const router = express.Router();
const axios = require('axios');
const User = require('../models/user.model');
const Link = require('../models/link.model');
const VisitLog = require('../models/visit-log.model');
const Setting = require('../models/setting.model');
const { authMiddleware, adminMiddleware } = require('../middleware/auth');

router.use(authMiddleware, adminMiddleware);

/**
 * GET /api/v1/admin/settings
 * 获取系统设置
 */
router.get('/settings', async (req, res) => {
  try {
    const [apiKey, apiKeyFree] = await Promise.all([
      Setting.findOne({ key: 'uapis_api_key' }),
      Setting.findOne({ key: 'uapis_api_key_free' }),
    ]);
    res.json({
      code: 0,
      data: {
        uapisApiKey: apiKey?.value || '',
        uapisApiKeyFree: apiKeyFree?.value || '',
      },
    });
  } catch (e) {
    res.status(500).json({ code: 500, message: '查询失败' });
  }
});

/**
 * PUT /api/v1/admin/settings
 * 更新系统设置
 */
router.put('/settings', async (req, res) => {
  try {
    const { uapisApiKey, uapisApiKeyFree } = req.body;
    if (uapisApiKey !== undefined) {
      await Setting.findOneAndUpdate(
        { key: 'uapis_api_key' },
        { key: 'uapis_api_key', value: uapisApiKey?.trim() || '', updatedAt: new Date() },
        { upsert: true, new: true }
      );
    }
    if (uapisApiKeyFree !== undefined) {
      await Setting.findOneAndUpdate(
        { key: 'uapis_api_key_free' },
        { key: 'uapis_api_key_free', value: uapisApiKeyFree?.trim() || '', updatedAt: new Date() },
        { upsert: true, new: true }
      );
    }
    res.json({ code: 0, message: '保存成功' });
  } catch (e) {
    res.status(500).json({ code: 500, message: '保存失败' });
  }
});

/**
 * POST /api/v1/admin/test-api
 * 测试 uapis API 连通性
 */
router.post('/test-api', async (req, res) => {
  const { key } = req.body;
  if (!key) return res.status(400).json({ code: 400, message: '请输入 API Key' });

  try {
    const headers = { Authorization: `Bearer ${key}` };
    const start = Date.now();
    const resp = await axios.get('https://uapis.cn/api/v1/network/ipinfo', {
      params: { ip: 'cn.bing.com', source: 'commercial' },
      headers,
      timeout: 8000,
    });
    const elapsed = Date.now() - start;

    if (resp.data && resp.data.ip) {
      res.json({
        code: 0,
        message: '连接成功',
        data: {
          elapsed: elapsed + 'ms',
          sample: {
            ip: resp.data.ip,
            region: resp.data.region,
            city: resp.data.city,
            isp: resp.data.isp || resp.data.llc,
          },
        },
      });
    } else {
      res.json({ code: 0, message: '连接成功，但返回数据为空', data: { elapsed: elapsed + 'ms' } });
    }
  } catch (e) {
    if (e.response?.status === 401 || e.response?.status === 403) {
      res.json({ code: 401, message: 'API Key 无效或未授权' });
    } else {
      res.json({ code: 500, message: '连接失败: ' + (e.message || '网络错误') });
    }
  }
});

/**
 * GET /api/v1/admin/users
 * 用户列表（仅管理员）
 */
router.get('/users', async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const pageSize = Math.min(50, Math.max(1, parseInt(req.query.pageSize) || 20));
    const skip = (page - 1) * pageSize;

    const [users, total] = await Promise.all([
      User.find({}, 'username role createdAt')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(pageSize)
        .lean(),
      User.countDocuments(),
    ]);

    // 附加每个用户的链接数和访问数
    const enriched = await Promise.all(users.map(async u => {
      const [linkCount, visitCount] = await Promise.all([
        Link.countDocuments({ userId: u._id }),
        VisitLog.countDocuments({ userId: u._id }),
      ]);
      return { ...u, linkCount, visitCount };
    }));

    res.json({
      code: 0,
      data: {
        list: enriched,
        total,
        page,
        pageSize,
        totalPages: Math.ceil(total / pageSize),
      },
    });
  } catch (e) {
    res.status(500).json({ code: 500, message: '查询失败' });
  }
});

/**
 * DELETE /api/v1/admin/users/:id
 * 删除用户及其所有数据（仅管理员，不能删自己）
 */
router.delete('/users/:id', async (req, res) => {
  try {
    if (req.params.id === req.user.userId) {
      return res.status(400).json({ code: 400, message: '不能删除自己' });
    }

    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ code: 404, message: '用户不存在' });
    }
    if (user.role === 'admin') {
      return res.status(403).json({ code: 403, message: '不能删除其他管理员' });
    }

    const links = await Link.find({ userId: user._id }, '_id');
    const linkIds = links.map(l => l._id);

    await Promise.all([
      user.deleteOne(),
      Link.deleteMany({ userId: user._id }),
      VisitLog.deleteMany({ userId: user._id }),
    ]);

    res.json({ code: 0, message: '删除成功' });
  } catch (e) {
    res.status(500).json({ code: 500, message: '删除失败' });
  }
});

/**
 * GET /api/v1/admin/users/:id/stats
 * 查看指定用户的统计数据（仅管理员）
 */
router.get('/users/:id/stats', async (req, res) => {
  try {
    const user = await User.findById(req.params.id, 'username role createdAt').lean();
    if (!user) {
      return res.status(404).json({ code: 404, message: '用户不存在' });
    }

    const userId = user._id;
    const now = new Date();
    const thirtyDaysAgo = new Date(now - 30 * 86400000);
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    const [totalVisits, todayVisits, linkCount, totalIpsResult] = await Promise.all([
      VisitLog.countDocuments({ userId, createdAt: { $gte: thirtyDaysAgo } }),
      VisitLog.countDocuments({ userId, createdAt: { $gte: todayStart } }),
      Link.countDocuments({ userId }),
      VisitLog.distinct('ip', { userId, createdAt: { $gte: thirtyDaysAgo } }),
    ]);

    const cityResult = await VisitLog.distinct('geoInfo.city', {
      userId,
      createdAt: { $gte: thirtyDaysAgo },
      'geoInfo.city': { $ne: '' },
    });

    res.json({
      code: 0,
      data: {
        user: { _id: user._id, username: user.username, role: user.role, createdAt: user.createdAt },
        linkCount,
        totalVisits,
        todayVisits,
        totalIps: totalIpsResult.length,
        coveredCities: cityResult.length,
      },
    });
  } catch (e) {
    res.status(500).json({ code: 500, message: '查询失败' });
  }
});

module.exports = router;
