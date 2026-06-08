const express = require('express');
const router = express.Router();
const axios = require('axios');
const User = require('../models/user.model');
const { signToken, authMiddleware } = require('../middleware/auth');

/**
 * POST /api/v1/auth/register
 * 用户注册
 */
router.post('/register', async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ code: 400, message: '用户名和密码不能为空' });
    }
    if (username.length < 3 || username.length > 20) {
      return res.status(400).json({ code: 400, message: '用户名长度 3-20 字符' });
    }
    if (password.length < 6) {
      return res.status(400).json({ code: 400, message: '密码至少 6 位' });
    }

    const exists = await User.findOne({ username });
    if (exists) {
      return res.status(409).json({ code: 409, message: '用户名已存在' });
    }

    // 第一个注册的用户自动成为超级管理员
    const totalUsers = await User.countDocuments();
    const role = totalUsers === 0 ? 'admin' : 'user';

    const user = await User.create({ username, password, role });
    const token = signToken(user);

    res.json({
      code: 0,
      message: '注册成功',
      data: {
        userId: user._id,
        username: user.username,
        role: user.role,
        token,
      },
    });
  } catch (e) {
    res.status(500).json({ code: 500, message: '注册失败，请重试' });
  }
});

/**
 * POST /api/v1/auth/login
 * 用户登录
 */
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ code: 400, message: '用户名和密码不能为空' });
    }

    const user = await User.findOne({ username });
    if (!user) {
      return res.status(401).json({ code: 401, message: '用户名或密码错误' });
    }

    const ok = await user.comparePassword(password);
    if (!ok) {
      return res.status(401).json({ code: 401, message: '用户名或密码错误' });
    }

    const token = signToken(user);

    res.json({
      code: 0,
      message: '登录成功',
      data: {
        userId: user._id,
        username: user.username,
        role: user.role,
        token,
      },
    });
  } catch (e) {
    res.status(500).json({ code: 500, message: '登录失败，请重试' });
  }
});

/**
 * GET /api/v1/auth/settings
 * 获取当前用户的 API Key 设置
 */
router.get('/settings', authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.user.userId, 'apiKey apiKeyFree').lean();
    if (!user) return res.status(404).json({ code: 404, message: '用户不存在' });
    res.json({
      code: 0,
      data: { uapisApiKey: user.apiKey || '', uapisApiKeyFree: user.apiKeyFree || '' },
    });
  } catch (e) {
    res.status(500).json({ code: 500, message: '查询失败' });
  }
});

/**
 * PUT /api/v1/auth/settings
 * 更新当前用户的 API Key 设置
 */
router.put('/settings', authMiddleware, async (req, res) => {
  try {
    const { uapisApiKey, uapisApiKeyFree } = req.body;
    const update = {};
    if (uapisApiKey !== undefined) update.apiKey = uapisApiKey.trim();
    if (uapisApiKeyFree !== undefined) update.apiKeyFree = uapisApiKeyFree.trim();
    await User.findByIdAndUpdate(req.user.userId, update);
    res.json({ code: 0, message: '保存成功' });
  } catch (e) {
    res.status(500).json({ code: 500, message: '保存失败' });
  }
});

/**
 * POST /api/v1/auth/test-api
 * 测试 uapis API 连通性
 */
router.post('/test-api', authMiddleware, async (req, res) => {
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

module.exports = router;
