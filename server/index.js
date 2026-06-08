const express = require('express');
const path = require('path');
const mongoose = require('mongoose');
const app = express();

app.use(express.json());

// 生产环境：托管前端构建产物（Docker 构建时放在 client/dist/）
const clientDist = path.join(__dirname, 'client', 'dist');
if (require('fs').existsSync(clientDist)) {
  app.use(express.static(clientDist));
}

// ===== Mongoose 连接 =====
const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/ip-tool';
mongoose.connect(MONGO_URI).then(() => {
  console.log('MongoDB 连接成功');
}).catch(err => {
  console.error('MongoDB 连接失败:', err.message);
});

// ===== 挂载 API 路由 =====
app.use('/api/v1/auth', require('./routes/auth.routes'));
app.use('/api/v1/links', require('./routes/links.routes'));
app.use('/api/v1/statistics', require('./routes/statistics.routes'));
app.use('/api/v1/admin', require('./routes/admin.routes'));

// ===== GeoJSON 代理（DataV 被墙/403 时走后端中转）=====
const axios = require('axios');
app.get('/api/geojson', async (req, res) => {
  const code = req.query.code;
  if (!code) return res.status(400).json({ error: '缺少 code 参数' });
  try {
    const url = `https://geo.datav.aliyun.com/areas_v3/bound/${code}_full.json`;
    const resp = await axios.get(url, { timeout: 10000, headers: { 'User-Agent': 'Mozilla/5.0' } });
    res.json(resp.data);
  } catch (e) {
    res.status(502).json({ error: '获取地图数据失败' });
  }
});

// ===== 公开跳转入口 =====
const http = require('http');
const Link = require('./models/link.model');
const VisitLog = require('./models/visit-log.model');
const { lookupIP } = require('./utils/ip-lookup');

function getRealIP(req) {
  let ip = req.headers['x-forwarded-for'] || req.connection.remoteAddress || req.ip;
  if (typeof ip === 'string' && ip.startsWith('::ffff:')) ip = ip.split('::ffff:')[1];
  if (ip === '::1') ip = '127.0.0.1';
  return ip.split(',')[0].trim();
}

function parseDevice(ua) {
  if (!ua) return '未知设备';
  if (ua.includes('iPhone')) return 'iPhone / iOS';
  if (ua.includes('Android')) return 'Android 手机';
  if (ua.includes('Macintosh')) return 'Mac电脑';
  if (ua.includes('Windows')) return 'Windows电脑';
  if (ua.includes('MicroMessenger')) return '微信浏览器';
  return '其他设备';
}

app.get('/r/:key', async (req, res) => {
  try {
    const link = await Link.findOne({ key: req.params.key });
    if (!link) {
      return res.status(404).send('链接不存在或已失效');
    }

    const ip = getRealIP(req);
    const ua = req.headers['user-agent'] || '';
    const geoInfo = await lookupIP(ip, link.userId);

    // 记录访问
    await VisitLog.create({
      linkId: link._id,
      userId: link.userId,
      ip,
      userAgent: ua,
      geoInfo: geoInfo || {},
    });

    // 更新访问计数
    await Link.updateOne({ _id: link._id }, { $inc: { visitCount: 1 } });

    res.redirect(link.targetUrl);
  } catch {
    res.status(500).send('跳转失败');
  }
});

// ===== 首页 =====
app.get('/', (req, res) => {
  res.json({
    name: 'ip-tool',
    version: '2.0.0',
    description: '多用户加密跳转链接 SaaS 平台',
    endpoints: {
      auth: {
        register: 'POST /api/v1/auth/register',
        login: 'POST /api/v1/auth/login',
      },
      links: {
        list: 'GET /api/v1/links',
        create: 'POST /api/v1/links',
        delete: 'DELETE /api/v1/links/:id',
        visits: 'GET /api/v1/links/:id/visits',
      },
      statistics: {
        overview: 'GET /api/v1/statistics/overview',
        userRegions: 'GET /api/v1/statistics/user-regions',
        userDistribution: 'GET /api/v1/statistics/user-distribution',
      },
      admin: {
        users: 'GET /api/v1/admin/users',
        deleteUser: 'DELETE /api/v1/admin/users/:id',
        userStats: 'GET /api/v1/admin/users/:id/stats',
      },
      redirect: 'GET /r/:key',
    },
  });
});

// ===== 错误处理 =====
app.use((err, req, res, next) => {
  if (req.path.startsWith('/api/')) {
    return res.status(500).json({ code: 500, message: '服务器内部异常' });
  }
  res.status(500).send('服务异常');
});

// ===== 启动 =====
const PORT = process.env.PORT || 6262;
app.listen(PORT, '0.0.0.0', () => {
  console.log('服务启动成功 端口：' + PORT);
});
