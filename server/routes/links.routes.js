const express = require('express');
const router = express.Router();
const Link = require('../models/link.model');
const VisitLog = require('../models/visit-log.model');
const { authMiddleware, ownerFilter } = require('../middleware/auth');

router.use(authMiddleware);

/**
 * GET /api/v1/links
 * 链接列表（admin 看全量，user 看自己）
 */
router.get('/', async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const pageSize = Math.min(50, Math.max(1, parseInt(req.query.pageSize) || 20));
    const skip = (page - 1) * pageSize;
    const filter = ownerFilter(req);

    const [links, total] = await Promise.all([
      Link.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(pageSize)
        .lean(),
      Link.countDocuments(filter),
    ]);

    res.json({
      code: 0,
      data: {
        list: links,
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
 * POST /api/v1/links
 * 创建新链接（始终归属当前用户）
 */
router.post('/', async (req, res) => {
  try {
    const { targetUrl } = req.body;

    if (!targetUrl) {
      return res.status(400).json({ code: 400, message: '请输入目标 URL' });
    }

    let url = targetUrl.trim();
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      url = 'http://' + url;
    }

    const link = await Link.createWithKey(req.user.userId, url);

    res.json({
      code: 0,
      message: '创建成功',
      data: {
        _id: link._id,
        key: link.key,
        targetUrl: link.targetUrl,
        redirectUrl: `${req.protocol}://${req.headers.host}/r/${link.key}`,
        createdAt: link.createdAt,
      },
    });
  } catch (e) {
    res.status(500).json({ code: 500, message: e.message || '创建失败' });
  }
});

/**
 * DELETE /api/v1/links/:id
 * 删除链接（admin 可删任意，user 仅删自己）
 */
router.delete('/:id', async (req, res) => {
  try {
    const filter = ownerFilter(req, { _id: req.params.id });
    const link = await Link.findOne(filter);
    if (!link) {
      return res.status(404).json({ code: 404, message: '链接不存在' });
    }

    await Promise.all([
      link.deleteOne(),
      VisitLog.deleteMany({ linkId: link._id }),
    ]);

    res.json({ code: 0, message: '删除成功' });
  } catch (e) {
    res.status(500).json({ code: 500, message: '删除失败' });
  }
});

/**
 * GET /api/v1/links/:id/visits
 * 访问明细（admin 可看任意，user 仅看自己）
 */
router.get('/:id/visits', async (req, res) => {
  try {
    const filter = ownerFilter(req, { _id: req.params.id });
    const link = await Link.findOne(filter);
    if (!link) {
      return res.status(404).json({ code: 404, message: '链接不存在' });
    }

    const page = Math.max(1, parseInt(req.query.page) || 1);
    const pageSize = Math.min(50, Math.max(1, parseInt(req.query.pageSize) || 20));
    const skip = (page - 1) * pageSize;

    const [visits, total] = await Promise.all([
      VisitLog.find({ linkId: link._id })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(pageSize)
        .select('ip userAgent geoInfo createdAt')
        .lean(),
      VisitLog.countDocuments({ linkId: link._id }),
    ]);

    res.json({
      code: 0,
      data: {
        link: { _id: link._id, key: link.key, targetUrl: link.targetUrl, visitCount: link.visitCount },
        list: visits,
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

module.exports = router;
