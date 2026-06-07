const express = require('express');
const router = express.Router();
const VisitLog = require('../models/visit-log.model');
const User = require('../models/user.model');
const { authMiddleware, ownerFilter } = require('../middleware/auth');

router.use(authMiddleware);

/**
 * GET /api/v1/statistics/overview
 * 概览统计（admin 看全局，user 看自己）
 */
router.get('/overview', async (req, res) => {
  try {
    const now = new Date();
    const thirtyDaysAgo = new Date(now - 30 * 86400000);
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekAgo = new Date(now - 7 * 86400000);

    const filter = ownerFilter(req);
    const baseFilter = { ...filter, createdAt: { $gte: thirtyDaysAgo } };

    const [totalVisits, todayVisits, weekVisits, totalIpsResult] = await Promise.all([
      VisitLog.countDocuments(baseFilter),
      VisitLog.countDocuments({ ...filter, createdAt: { $gte: todayStart } }),
      VisitLog.countDocuments({ ...filter, createdAt: { $gte: weekAgo } }),
      VisitLog.distinct('ip', baseFilter),
    ]);

    const cityResult = await VisitLog.distinct('geoInfo.city', {
      ...baseFilter,
      'geoInfo.city': { $ne: '' },
    });

    const overseasCount = await VisitLog.countDocuments({
      ...baseFilter,
      'geoInfo.country': { $ne: '中国', $exists: true, $ne: '' },
    });

    res.json({
      code: 0,
      data: {
        totalVisits,
        todayVisits,
        weekVisits,
        totalIps: totalIpsResult.length,
        coveredCities: cityResult.length,
        overseasCount,
      },
    });
  } catch (e) {
    res.status(500).json({ code: 500, message: '查询失败' });
  }
});

/**
 * GET /api/v1/statistics/user-regions
 * 城市分布统计（admin 看全局，user 看自己）
 */
router.get('/user-regions', async (req, res) => {
  try {
    const now = new Date();
    const thirtyDaysAgo = new Date(now - 30 * 86400000);
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekAgo = new Date(now - 7 * 86400000);

    const filter = ownerFilter(req);
    const baseFilter = { ...filter, createdAt: { $gte: thirtyDaysAgo } };

    const [totalIps, todayIps, weekIps, recentRecords] = await Promise.all([
      VisitLog.distinct('ip', baseFilter),
      VisitLog.distinct('ip', { ...filter, createdAt: { $gte: todayStart } }),
      VisitLog.distinct('ip', { ...filter, createdAt: { $gte: weekAgo } }),
      VisitLog.find(baseFilter)
        .sort({ createdAt: -1 })
        .limit(20)
        .select('ip createdAt geoInfo userId')
        .lean(),
    ]);

    // 关联查询 username
    const userIds = [...new Set(recentRecords.map(r => String(r.userId)).filter(Boolean))];
    const userMap = {};
    if (userIds.length) {
      const users = await User.find({ _id: { $in: userIds } }, 'username').lean();
      users.forEach(u => { userMap[String(u._id)] = u.username; });
    }

    // 按 区县/城市 聚合（优先区县级）
    const cityCount = {};
    const cityLogs = await VisitLog.find(
      { ...baseFilter, $or: [{ 'geoInfo.city': { $ne: '' } }, { 'geoInfo.district': { $ne: '' } }] },
      'geoInfo'
    ).lean();

    cityLogs.forEach(l => {
      const g = l.geoInfo || {};
      const key = (g.district && g.district.trim()) || (g.city && g.city.trim());
      if (key) cityCount[key] = (cityCount[key] || 0) + 1;
    });

    const cities = Object.entries(cityCount)
      .filter(([name]) => name && name.trim())
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);

    const totalVal = cities.reduce((s, p) => s + p.value, 0) || 1;
    cities.forEach(p => {
      p.pct = Number((p.value / totalVal * 100).toFixed(1));
    });

    // 境外 IP 计数：geoInfo.country 不为"中国"且不为空
    const overseasCount = await VisitLog.countDocuments({
      ...baseFilter,
      'geoInfo.country': { $ne: '中国', $exists: true, $ne: '' },
    });

    const enriched = recentRecords.map(r => ({
      ip: r.ip,
      username: userMap[String(r.userId)] || '',
      createdAt: r.createdAt,
      country: r.geoInfo?.country || '',
      province: r.geoInfo?.province || '',
      city: r.geoInfo?.city || '',
      district: r.geoInfo?.district || '',
      isp: r.geoInfo?.isp || '',
    }));

    res.json({
      code: 0,
      data: {
        totalIps: totalIps.length,
        todayIps: todayIps.length,
        weekIps: weekIps.length,
        coveredProvinces: cities.length,
        provinces: cities,
        topProvince: cities[0] || null,
        overseasCount,
        recentRecords: enriched,
      },
    });
  } catch (e) {
    res.status(500).json({ code: 500, message: '查询失败' });
  }
});

/**
 * GET /api/v1/statistics/user-distribution
 * 平台/浏览器/地区分布（admin 看全局，user 看自己）
 */
router.get('/user-distribution', async (req, res) => {
  try {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000);
    const filter = { ...ownerFilter(req), createdAt: { $gte: thirtyDaysAgo }, 'geoInfo.province': { $ne: '' } };

    const logs = await VisitLog.find(filter, 'userAgent geoInfo').lean();

    function parsePlatform(ua) {
      if (!ua) return '未知';
      if (ua.includes('iPhone') || ua.includes('iPad')) return 'iOS';
      if (ua.includes('Android')) return 'Android';
      if (ua.includes('Windows')) return 'Windows';
      if (ua.includes('Macintosh') || ua.includes('Mac OS')) return 'macOS';
      if (ua.includes('Linux')) return 'Linux';
      return '其他';
    }

    function parseBrowser(ua) {
      if (!ua) return '未知';
      if (ua.includes('MicroMessenger')) return '微信';
      if (ua.includes('Edg/')) return 'Edge';
      if (ua.includes('Chrome/') && !ua.includes('Edg/')) return 'Chrome';
      if (ua.includes('Safari/') && !ua.includes('Chrome/')) return 'Safari';
      if (ua.includes('Firefox/')) return 'Firefox';
      return '其他';
    }

    function aggregate(items, getField) {
      const map = {};
      items.forEach(item => {
        const val = getField(item) || '未知';
        map[val] = (map[val] || 0) + 1;
      });
      const total = Object.values(map).reduce((s, v) => s + v, 0) || 1;
      return Object.entries(map)
        .map(([name, count]) => ({ name, pct: Math.round(count / total * 100) }))
        .sort((a, b) => b.pct - a.pct);
    }

    const colors = ['#C9A84C', '#1A1A2E', '#8B7355', '#D4C5C0', '#E8D5C4', '#8B6914', '#A89070'];

    const regions = aggregate(logs, r => r.geoInfo?.province).slice(0, 7).map((r, i) => ({ ...r, color: colors[i] || '#A89070' }));
    const platforms = aggregate(logs, r => parsePlatform(r.userAgent)).map((p, i) => ({ ...p, color: colors[i] || '#A89070' }));
    const browsers = aggregate(logs, r => parseBrowser(r.userAgent)).map((b, i) => ({ ...b, color: colors[i] || '#A89070' }));

    res.json({
      code: 0,
      data: { regions, platforms, browsers },
    });
  } catch (e) {
    res.status(500).json({ code: 500, message: '查询失败' });
  }
});

module.exports = router;
