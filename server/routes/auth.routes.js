const express = require('express');
const router = express.Router();
const User = require('../models/user.model');
const { signToken } = require('../middleware/auth');

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

module.exports = router;
