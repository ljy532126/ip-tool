<template>
  <div class="docs">
    <div class="docs-sidebar">
      <div class="sidebar-title">API 接口</div>
      <a v-for="g in groups" :key="g.id" :href="'#'+g.id" :class="{active: activeGroup===g.id}" @click.prevent="activeGroup=g.id">
        <span class="s-icon">{{ g.icon }}</span>{{ g.name }}
      </a>
    </div>

    <div class="docs-main">
      <template v-for="g in groups" :key="g.id">
        <section :id="g.id" v-show="activeGroup===g.id">
          <h2 class="section-title">{{ g.icon }} {{ g.name }}</h2>
          <p class="section-desc">{{ g.desc }}</p>

          <div class="endpoint" v-for="ep in g.endpoints" :key="ep.method+ep.path">
            <div class="ep-bar">
              <span class="ep-method" :class="ep.method">{{ ep.method }}</span>
              <span class="ep-path">{{ ep.path }}</span>
              <span v-if="ep.auth" class="ep-auth" :class="ep.auth">
                {{ ep.auth === 'Bearer' ? '需登录' : ep.auth === 'Admin' ? '管理员' : ep.auth }}
              </span>
            </div>
            <p class="ep-summary">{{ ep.summary }}</p>

            <!-- Params -->
            <div v-if="ep.params?.length" class="ep-block">
              <div class="ep-block-title">请求参数</div>
              <table class="param-table">
                <thead><tr><th>参数</th><th>类型</th><th>必填</th><th>说明</th></tr></thead>
                <tbody><tr v-for="p in ep.params" :key="p.name">
                  <td><code>{{ p.name }}</code></td>
                  <td>{{ p.type }}</td>
                  <td>{{ p.required ? '是' : '否' }}</td>
                  <td>{{ p.desc }}</td>
                </tr></tbody>
              </table>
            </div>

            <!-- Request Headers -->
            <div v-if="ep.auth" class="ep-block">
              <div class="ep-block-title">请求头</div>
              <div class="code-box"><code>{{ ep.headers }}</code></div>
            </div>

            <!-- Request Body -->
            <div v-if="ep.body" class="ep-block">
              <div class="ep-block-title">请求体示例</div>
              <div class="code-box"><pre><code>{{ ep.body }}</code></pre></div>
            </div>

            <!-- Response -->
            <div class="ep-block">
              <div class="ep-block-title">响应示例 (200)</div>
              <div class="code-box"><pre><code>{{ ep.response }}</code></pre></div>
            </div>

            <!-- curl -->
            <div class="ep-block">
              <div class="ep-block-title">测试命令</div>
              <div class="code-box curl-box">
                <code>{{ ep.curl }}</code>
                <button class="copy-btn" @click="cp(ep.curl)">复制</button>
              </div>
            </div>
          </div>
        </section>
      </template>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue';
import { useToast } from '../stores/toast.js';

const { add: toast } = useToast();
const activeGroup = ref('auth');
const host = location.host;

function cp(t) { navigator.clipboard.writeText(t).then(()=>toast('已复制')).catch(()=>toast('复制失败','error')); }

const token = 'eyJ...你的JWT';

const groups = [
  {
    id: 'auth', icon: '', name: '鉴权', desc: '用户注册和登录，获取 JWT Token',
    endpoints: [
      {
        method: 'POST', path: '/api/v1/auth/register', auth: '-', summary: '注册新账户。第一个注册的用户自动成为管理员。',
        params: [
          { name: 'username', type: 'string', required: true, desc: '用户名，3～20 个字符，全局唯一' },
          { name: 'password', type: 'string', required: true, desc: '密码，至少 6 位' },
        ],
        body: '{\n  "username": "demo",\n  "password": "123456"\n}',
        response: '{\n  "code": 0,\n  "message": "注册成功",\n  "data": {\n    "userId": "6a258...",\n    "username": "demo",\n    "role": "user",\n    "token": "eyJhbGci..."\n  }\n}',
        curl: `curl -X POST http://${host}/api/v1/auth/register \\\n  -H "Content-Type: application/json" \\\n  -d '{"username":"demo","password":"123456"}'`,
        headers: 'Content-Type: application/json',
      },
      {
        method: 'POST', path: '/api/v1/auth/login', auth: '-', summary: '登录已有账户，获取 Token。Token 有效期 7 天。',
        params: [
          { name: 'username', type: 'string', required: true, desc: '用户名' },
          { name: 'password', type: 'string', required: true, desc: '密码' },
        ],
        body: '{\n  "username": "demo",\n  "password": "123456"\n}',
        response: '{\n  "code": 0,\n  "message": "登录成功",\n  "data": {\n    "userId": "6a258...",\n    "username": "demo",\n    "role": "user",\n    "token": "eyJhbGci..."\n  }\n}',
        curl: `curl -X POST http://${host}/api/v1/auth/login \\\n  -H "Content-Type: application/json" \\\n  -d '{"username":"demo","password":"123456"}'`,
        headers: 'Content-Type: application/json',
      },
    ],
  },
  {
    id: 'links', icon: '', name: '链接管理', desc: '创建短链、查看/删除链接、查看访问明细。所有接口需带 Token。',
    endpoints: [
      {
        method: 'GET', path: '/api/v1/links?page=1&pageSize=20', auth: 'Bearer', summary: '获取链接列表（分页）。admin 能看到全站所有链接，普通用户只看自己。',
        params: [
          { name: 'page', type: 'number', required: false, desc: '页码，默认 1' },
          { name: 'pageSize', type: 'number', required: false, desc: '每页条数，默认 20，最大 50' },
        ],
        response: '{\n  "code": 0,\n  "data": {\n    "list": [{\n      "_id": "...",\n      "key": "aB3xK9mQ",\n      "targetUrl": "https://example.com",\n      "visitCount": 42,\n      "createdAt": "2026-06-08T12:00:00.000Z"\n    }],\n    "total": 15,\n    "page": 1,\n    "totalPages": 1\n  }\n}',
        curl: `curl http://${host}/api/v1/links?page=1&pageSize=20 \\\n  -H "Authorization: Bearer ${token}"`,
        headers: 'Authorization: Bearer <token>',
      },
      {
        method: 'POST', path: '/api/v1/links', auth: 'Bearer', summary: '创建一条新的跳转链接。返回可分享的短链地址。访问短链时自动记录 IP 归属地到创建者名下。',
        params: [
          { name: 'targetUrl', type: 'string', required: true, desc: '跳转目标网址。可省略 http://' },
        ],
        body: '{\n  "targetUrl": "https://example.com/promo"\n}',
        response: '{\n  "code": 0,\n  "message": "创建成功",\n  "data": {\n    "_id": "...",\n    "key": "aB3xK9mQ",\n    "targetUrl": "https://example.com/promo",\n    "redirectUrl": "http://你的域名/r/aB3xK9mQ",\n    "createdAt": "2026-06-08T12:00:00.000Z"\n  }\n}',
        curl: `curl -X POST http://${host}/api/v1/links \\\n  -H "Content-Type: application/json" \\\n  -H "Authorization: Bearer ${token}" \\\n  -d '{"targetUrl":"https://example.com"}'`,
        headers: 'Content-Type: application/json\nAuthorization: Bearer <token>',
      },
      {
        method: 'DELETE', path: '/api/v1/links/:id', auth: 'Bearer', summary: '删除一条链接及所有关联的访问日志。admin 可删任意链接。',
        params: [
          { name: ':id', type: 'string', required: true, desc: '链接 ID（从列表接口获取 _id）' },
        ],
        response: '{\n  "code": 0,\n  "message": "删除成功"\n}',
        curl: `curl -X DELETE http://${host}/api/v1/links/链接ID \\\n  -H "Authorization: Bearer ${token}"`,
        headers: 'Authorization: Bearer <token>',
      },
      {
        method: 'GET', path: '/api/v1/links/:id/visits?page=1&pageSize=20', auth: 'Bearer', summary: '查看某条链接的访问明细（分页）。包含访问者 IP、地理位置、UA 信息。',
        params: [
          { name: ':id', type: 'string', required: true, desc: '链接 ID' },
          { name: 'page', type: 'number', required: false, desc: '页码' },
          { name: 'pageSize', type: 'number', required: false, desc: '每页条数' },
        ],
        response: '{\n  "code": 0,\n  "data": {\n    "link": { "_id": "...", "key": "abc123", "targetUrl": "...", "visitCount": 42 },\n    "list": [{\n      "_id": "...",\n      "ip": "113.12.34.56",\n      "geoInfo": { "country": "中国", "province": "浙江", "city": "金华", "district": "义乌", "isp": "电信" },\n      "createdAt": "2026-06-08T14:00:00.000Z"\n    }],\n    "total": 42, "page": 1, "totalPages": 3\n  }\n}',
        curl: `curl http://${host}/api/v1/links/链接ID/visits?page=1&pageSize=20 \\\n  -H "Authorization: Bearer ${token}"`,
        headers: 'Authorization: Bearer <token>',
      },
    ],
  },
  {
    id: 'stats', icon: '', name: '统计分析', desc: '用户自己的访问数据统计。admin 看全站、普通用户看自己。',
    endpoints: [
      {
        method: 'GET', path: '/api/v1/statistics/overview', auth: 'Bearer', summary: '概览数据：总访问、今日、近7天、覆盖城市、境外访问。',
        response: '{\n  "code": 0,\n  "data": {\n    "totalVisits": 245,\n    "todayVisits": 32,\n    "weekVisits": 89,\n    "totalIps": 156,\n    "coveredCities": 14,\n    "overseasCount": 5\n  }\n}',
        curl: `curl http://${host}/api/v1/statistics/overview \\\n  -H "Authorization: Bearer ${token}"`,
        headers: 'Authorization: Bearer <token>',
      },
      {
        method: 'GET', path: '/api/v1/statistics/user-regions', auth: 'Bearer', summary: '城市分布统计。provinces 字段：按城市聚合的访问量（全国和省视图用）。districts 字段：按区县聚合（下钻到市用）。recentRecords：最近 20 条访问记录。',
        response: '{\n  "code": 0,\n  "data": {\n    "totalIps": 156,\n    "provinces": [\n      { "name": "金华", "value": 28, "pct": 20.4 },\n      { "name": "杭州", "value": 15, "pct": 10.9 }\n    ],\n    "districts": [\n      { "name": "义乌", "value": 12, "pct": 42.9 },\n      { "name": "婺城", "value": 8, "pct": 28.6 }\n    ],\n    "recentRecords": [{\n      "ip": "113.x.x.x",\n      "province": "浙江", "city": "金华", "district": "义乌",\n      "isp": "电信",\n      "latitude": 29.3056, "longitude": 120.0744,\n      "createdAt": "2026-06-08T12:00:00.000Z"\n    }]\n  }\n}',
        curl: `curl http://${host}/api/v1/statistics/user-regions \\\n  -H "Authorization: Bearer ${token}"`,
        headers: 'Authorization: Bearer <token>',
      },
      {
        method: 'GET', path: '/api/v1/statistics/user-distribution', auth: 'Bearer', summary: '分布分析：省份占比、操作系统占比、浏览器占比（百分比）。用于饼图渲染。',
        response: '{\n  "code": 0,\n  "data": {\n    "regions": [{ "name": "广东", "pct": 31, "color": "#C9A84C" }],\n    "platforms": [{ "name": "Windows", "pct": 39, "color": "#C9A84C" }],\n    "browsers": [{ "name": "Chrome", "pct": 29, "color": "#C9A84C" }]\n  }\n}',
        curl: `curl http://${host}/api/v1/statistics/user-distribution \\\n  -H "Authorization: Bearer ${token}"`,
        headers: 'Authorization: Bearer <token>',
      },
    ],
  },
  {
    id: 'admin', icon: '', name: '管理员', desc: '管理员专属接口，普通用户返回 403。',
    endpoints: [
      {
        method: 'GET', path: '/api/v1/admin/users?page=1&pageSize=15', auth: 'Admin', summary: '查看全站用户列表，含每人链接数和访问量。',
        response: '{\n  "code": 0,\n  "data": {\n    "list": [{\n      "_id": "...",\n      "username": "demo",\n      "role": "user",\n      "linkCount": 5,\n      "visitCount": 245,\n      "createdAt": "2026-06-01T08:00:00.000Z"\n    }],\n    "total": 15, "page": 1, "totalPages": 1\n  }\n}',
        curl: `curl http://${host}/api/v1/admin/users?page=1&pageSize=15 \\\n  -H "Authorization: Bearer ${token}"`,
        headers: 'Authorization: Bearer <token>（admin）',
      },
      {
        method: 'DELETE', path: '/api/v1/admin/users/:id', auth: 'Admin', summary: '删除用户及其所有数据。不能删除自己和其它管理员。',
        params: [{ name: ':id', type: 'string', required: true, desc: '用户 ID' }],
        response: '{\n  "code": 0,\n  "message": "删除成功"\n}',
        curl: `curl -X DELETE http://${host}/api/v1/admin/users/用户ID \\\n  -H "Authorization: Bearer ${token}"`,
        headers: 'Authorization: Bearer <token>（admin）',
      },
      {
        method: 'GET', path: '/api/v1/admin/users/:id/stats', auth: 'Admin', summary: '查看任意用户的统计概览。',
        params: [{ name: ':id', type: 'string', required: true, desc: '用户 ID' }],
        response: '{\n  "code": 0,\n  "data": {\n    "user": { "_id": "...", "username": "demo", "role": "user" },\n    "linkCount": 3, "totalVisits": 42,\n    "todayVisits": 5, "totalIps": 30, "coveredCities": 12\n  }\n}',
        curl: `curl http://${host}/api/v1/admin/users/用户ID/stats \\\n  -H "Authorization: Bearer ${token}"`,
        headers: 'Authorization: Bearer <token>（admin）',
      },
      {
        method: 'PUT', path: '/api/v1/admin/settings', auth: 'Admin', summary: '保存系统设置。当前支持配 uapis.cn API Key。',
        body: '{\n  "uapisApiKey": "sk-xxxxxxxx",\n  "uapisApiKeyFree": ""\n}',
        response: '{\n  "code": 0,\n  "message": "保存成功"\n}',
        curl: `curl -X PUT http://${host}/api/v1/admin/settings \\\n  -H "Content-Type: application/json" \\\n  -H "Authorization: Bearer ${token}" \\\n  -d '{"uapisApiKey":"sk-xxx"}'`,
        headers: 'Content-Type: application/json\nAuthorization: Bearer <token>（admin）',
      },
    ],
  },
  {
    id: 'redirect', icon: '', name: '公开短链', desc: '无需登录的公开接口。',
    endpoints: [
      {
        method: 'GET', path: '/r/:key', auth: '-', summary: '访问短链跳转。自动记录访问者 IP、UA、地理位置，然后 302 重定向。完全无感，访问者不会看到中间页。',
        params: [
          { name: ':key', type: 'string', required: true, desc: '短链 Key。由创建链接接口返回' },
        ],
        response: 'HTTP/1.1 302 Found\nLocation: https://example.com/promo',
        curl: `curl -v http://${host}/r/aB3xK9mQ`,
        headers: '无需认证',
      },
    ],
  },
  {
    id: 'errors', icon: '', name: '错误码', desc: '所有接口的统一错误码说明。',
    endpoints: [
      {
        method: '-', path: '错误码一览', auth: '-', summary: '',
        response: '| code | HTTP | 说明 |\n|------|------|------|\n| 0 | 200 | 成功 |\n| 400 | 400 | 参数有误 |\n| 401 | 401 | 未登录或 Token 过期 |\n| 403 | 403 | 权限不足 |\n| 404 | 404 | 资源不存在 |\n| 409 | 409 | 冲突（用户名已存在）|\n| 500 | 500 | 服务器内部异常 |',
        curl: '# 所有接口统一响应格式：\n{ "code": 0, "message": "操作描述", "data": { } }',
      },
    ],
  },
];
</script>

<style scoped>
.docs { display: flex; gap: 0; min-height: calc(100vh - 120px); }
.docs-sidebar {
  width: 200px; flex-shrink: 0; position: sticky; top: 64px; align-self: flex-start;
  background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius-lg);
  padding: 16px 0; margin-right: 18px;
}
.sidebar-title { font-size: 13px; color: var(--muted); text-transform: uppercase; letter-spacing: 0.5px; padding: 0 16px 12px; }
.docs-sidebar a {
  display: flex; align-items: center; gap: 8px; padding: 8px 16px; font-size: 14px; color: var(--text);
  text-decoration: none; transition: .15s; border-left: 2px solid transparent;
}
.docs-sidebar a:hover { color: var(--heading); background: var(--surface2); }
.docs-sidebar a.active { color: var(--accent); border-left-color: var(--accent); background: var(--accent-dim); }
.s-icon { font-size: 16px; width: 20px; text-align: center; }
.docs-main { flex: 1; min-width: 0; }

.section-title { font-size: 22px; color: var(--heading); font-weight: 700; margin-bottom: 4px; }
.section-desc { color: var(--muted); font-size: 14px; margin-bottom: 24px; }

.endpoint {
  background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius-lg);
  padding: 20px 22px; margin-bottom: 18px;
}
.ep-bar { display: flex; align-items: center; gap: 10px; margin-bottom: 8px; flex-wrap: wrap; }
.ep-method {
  padding: 3px 10px; border-radius: 4px; font-size: 12px; font-weight: 700; font-family: var(--font-data);
  text-transform: uppercase; letter-spacing: 0.5px;
}
.ep-method.GET { background: rgba(88,166,255,0.15); color: var(--blue); }
.ep-method.POST { background: rgba(63,185,80,0.15); color: var(--green); }
.ep-method.PUT { background: rgba(230,162,60,0.15); color: #e6a23c; }
.ep-method.DELETE { background: rgba(248,81,73,0.15); color: var(--red); }
.ep-method.- { background: var(--surface2); color: var(--muted); }
.ep-path { font-family: var(--font-data); font-size: 14px; color: var(--heading); word-break: break-all; }
.ep-auth {
  padding: 2px 8px; border-radius: 3px; font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.3px;
}
.ep-auth.Bearer { background: var(--accent-dim); color: var(--accent); }
.ep-auth.Admin { background: var(--red-dim); color: var(--red); }
.ep-summary { color: var(--text); font-size: 13px; line-height: 1.6; margin-bottom: 12px; }

.ep-block { margin-top: 14px; }
.ep-block-title { font-size: 11px; color: var(--muted); text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 6px; font-weight: 700; }

.param-table { width: 100%; border-collapse: collapse; font-size: 13px; }
.param-table th { padding: 8px 12px; text-align: left; font-size: 11px; font-weight: 700; color: var(--muted); text-transform: uppercase; letter-spacing: 0.3px; border-bottom: 1px solid var(--border); }
.param-table td { padding: 8px 12px; border-bottom: 1px solid var(--border); color: var(--text); }
.param-table code { background: var(--accent-dim); color: var(--accent); padding: 1px 6px; border-radius: 3px; font-family: var(--font-data); font-size: 12px; }

.code-box {
  background: #080c12; border: 1px solid var(--border); border-radius: var(--radius);
  padding: 14px 16px; position: relative;
}
.code-box code, .code-box pre {
  font-family: var(--font-data); font-size: 12px; color: #a8c0d0; line-height: 1.7;
  white-space: pre-wrap; word-break: break-all; margin: 0;
}
.curl-box { display: flex; align-items: flex-start; gap: 12px; }
.curl-box code { flex: 1; }
.copy-btn {
  flex-shrink: 0; background: var(--surface2); border: 1px solid var(--border); color: var(--text);
  cursor: pointer; padding: 4px 12px; border-radius: 4px; font-size: 11px; font-family: var(--font-ui);
  transition: .15s;
}
.copy-btn:hover { color: var(--accent); border-color: var(--accent); }

@media(max-width:768px) {
  .docs { flex-direction: column; }
  .docs-sidebar { width: 100%; position: static; display: flex; flex-wrap: wrap; gap: 2px; padding: 10px; margin-right: 0; margin-bottom: 14px; }
  .docs-sidebar a { border-left: none; border-bottom: 2px solid transparent; font-size: 12px; padding: 6px 10px; }
  .docs-sidebar a.active { border-bottom-color: var(--accent); }
  .sidebar-title { display: none; }
}
</style>
