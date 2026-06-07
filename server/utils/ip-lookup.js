const axios = require('axios');
const Setting = require('../models/setting.model');

const IP_API = 'https://uapis.cn/api/v1/network/ipinfo';
const PRIVATE_IP_RE = /^(10\.|172\.(1[6-9]|2\d|3[01])\.|192\.168\.|127\.|0\.|::1|localhost)/i;

const ipGeoCache = new Map();

let cachedApiKey = null;
let cacheTime = 0;

// 从数据库读取 API Key（缓存 60 秒避免每次查询都读库）
async function getApiKey() {
  const now = Date.now();
  if (cachedApiKey !== null && now - cacheTime < 60000) return cachedApiKey;
  try {
    const key = await Setting.findOne({ key: 'uapis_api_key' });
    cachedApiKey = key?.value?.trim() || '';
    cacheTime = now;
    return cachedApiKey;
  } catch {
    return cachedApiKey || '';
  }
}

/**
 * 查询 IP 的地理位置信息，结果自动缓存
 * @param {string} ip - 客户端 IP
 * @returns {Promise<object|null>} geoInfo 对象，内网/失败返回 null
 */
async function lookupIP(ip) {
  if (!ip || PRIVATE_IP_RE.test(ip)) {
    ipGeoCache.set(ip, null);
    return null;
  }

  if (ipGeoCache.has(ip)) return ipGeoCache.get(ip);

  try {
    const apiKey = await getApiKey();
    const headers = {};
    if (apiKey) headers['Authorization'] = `Bearer ${apiKey}`;

    const res = await axios.get(IP_API, {
      params: { ip, source: 'commercial' },
      headers,
      timeout: 6000,
    });
    const d = res.data;
    if (d && d.ip) {
      const parts = (d.region || '').split(' ');
      const result = {
        country: parts[0] || '',
        province: parts[1] || '',
        city: parts[2] || '',
        district: d.district || parts[3] || '',  // API 的 district 字段 + region 兜底
        isp: d.isp || d.llc || '',
        asn: d.asn || '',
        latitude: d.latitude || 0,
        longitude: d.longitude || 0,
      };
      ipGeoCache.set(ip, result);
      return result;
    }
  } catch {
    // 查询失败不阻塞主流程
  }

  ipGeoCache.set(ip, null);
  return null;
}

function getClientIP(req) {
  return req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.ip || 'unknown';
}

module.exports = { lookupIP, getClientIP };
