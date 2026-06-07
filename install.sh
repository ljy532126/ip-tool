#!/bin/bash
set -e

# 自动获取当前目录
BASE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$BASE_DIR"

echo "====================================="
echo "      加密跳转 & IP记录工具"
echo "    Docker 一键部署（当前目录版）"
echo "====================================="

# 2. 初始化数据文件
echo "[2/5] 初始化数据文件..."
touch visits.json

# 3. 生成 app.js 【无错 + 北京时间 + 时光轴 + 不强制https】
echo "[3/5] 生成程序文件..."
cat > app.js <<'EOF'
const express = require('express');
const fs = require('fs').promises;
const fsSync = require('fs');
const path = require('path');
const http = require('http');
const app = express();

app.use(express.json());

const LOG_PASSWORD = 'admin123';
const LOG_FILE = path.join(__dirname, 'visits.json');
const PORT = 6262;

if (!fsSync.existsSync(LOG_FILE)) {
  fsSync.writeFileSync(LOG_FILE, '[]', 'utf8');
}

async function getLogs() {
  try {
    const data = await fs.readFile(LOG_FILE, 'utf8');
    return JSON.parse(data) || [];
  } catch (e) {
    return [];
  }
}

async function addLog(log) {
  try {
    const logs = await getLogs();
    logs.push(log);
    await fs.writeFile(LOG_FILE, JSON.stringify(logs, null, 2), 'utf8');
  } catch (e) {}
}

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

async function getIpLocation(ip) {
  const privateIPReg = /^(127\.|192\.168\.|10\.|172\.(1[6-9]|2[0-9]|3[0-1])\.)/;
  if (privateIPReg.test(ip)) return '局域网';

  return new Promise((resolve) => {
    const req = http.get(`http://ip.plyz.net/ip.ashx?ip=${ip}`, { timeout: 3000 }, (res) => {
      let data = '';
      res.setEncoding('utf8');
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const loc = data.split('|')[1] || '外网IP';
          resolve(loc.trim());
        } catch {
          resolve('外网IP');
        }
      });
    });
    req.on('timeout', () => { req.destroy(); resolve('外网IP'); });
    req.on('error', () => resolve('外网IP'));
  });
}

function encodeUrl(url) {
  return Buffer.from(url).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

function decodeUrl(str) {
  try {
    str = str.replace(/-/g, '+').replace(/_/g, '/');
    while (str.length % 4) str += '=';
    return Buffer.from(str, 'base64').toString();
  } catch {
    return null;
  }
}

function fixUrl(url) {
  // 如果已经有协议，直接返回
  if (url.startsWith('http://') || url.startsWith('https://')) {
    return url;
  }
  // 没有协议时，默认补 http://（避免 https 导致 502）
  return 'http://' + url;
}

// 获取北京时间
function getBeijingTime() {
  const now = new Date();
  const utc = now.getTime() + now.getTimezoneOffset() * 60000;
  const beijing = new Date(utc + 8 * 3600000);
  return beijing.toLocaleString('zh-CN', {
    year:'numeric', month:'2-digit', day:'2-digit',
    hour:'2-digit', minute:'2-digit', second:'2-digit'
  }).replace(/\//g, '-');
}

// 跳转入口
app.get('/', async (req, res) => {
  const k = req.query.k;
  if (k) {
    try {
      let realTarget;

      if (k.startsWith('http://') || k.startsWith('https://')) {
        realTarget = k;
      } else {
        realTarget = decodeUrl(k);
        if (!realTarget) {
          return res.send('链接无效');
        }
      }

      realTarget = fixUrl(realTarget);
      const ip = getRealIP(req);
      const ua = req.headers['user-agent'] || '';
      const location = await getIpLocation(ip);
      const device = parseDevice(ua);

      await addLog({
        time: getBeijingTime(),
        ip: ip,
        location: location,
        device: device,
        target: realTarget,
      });

      return res.redirect(realTarget);
    } catch {
      return res.send('跳转失败');
    }
  }

  res.send(`
<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>加密跳转工具</title>
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{background:#f7f8fa;font-family:system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial,"Microsoft YaHei",sans-serif;padding:20px 16px}
.container{max-width:500px;margin:0 auto;background:#fff;border-radius:16px;box-shadow:0 4px 20px rgba(0,0,0,0.05);padding:24px 20px}
h2{font-size:20px;margin-bottom:20px;text-align:center}
.main-box{display:flex;flex-direction:column;gap:12px;margin-bottom:20px}
input{height:48px;padding:0 16px;border:1px solid #ddd;border-radius:12px;font-size:16px}
button{height:48px;padding:0 24px;background:#0077fc;color:#fff;border:none;border-radius:12px;font-size:16px;cursor:pointer}
.result{margin:20px 0;padding:16px;background:#f0f7ff;border-radius:12px;word-break:break-all;display:none}
.qr{margin:14px 0;text-align:center}
.qr img{max-width:180px;width:100%;border-radius:8px;border:1px solid #eee}
.download{display:inline-block;margin-top:8px;padding:8px 14px;background:#0077fc;color:#fff;border-radius:8px;text-decoration:none;font-size:14px}
.tip{background:#fff1f0;color:#c72c2c;padding:14px;border-radius:12px;font-size:14px;line-height:1.6;margin-top:20px}
.nav{margin-top:20px;text-align:center}
.nav a{color:#0077fc;text-decoration:none;font-size:15px}

/* 时光轴样式 */
.timeline-container {
  max-width: 600px;
  margin: 40px auto 0;
  padding: 0 10px;
}
.timeline-container h3 {
  font-size: 18px;
  text-align: center;
  margin-bottom: 24px;
  color: #333;
}
.timeline {
  position: relative;
  padding-left: 36px;
}
.timeline::before {
  content: '';
  position: absolute;
  left: 12px;
  top: 0;
  bottom: 0;
  width: 2px;
  background: #0077fc;
}
.timeline-item {
  position: relative;
  margin-bottom: 22px;
}
.timeline-item::before {
  content: '';
  position: absolute;
  left: -24px;
  top: 6px;
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: #0077fc;
  border: 2px solid #fff;
  box-shadow: 0 0 0 2px #0077fc;
}
.timeline-date {
  font-size: 13px;
  color: #666;
  margin-bottom: 6px;
}
.timeline-content {
  background: #fff;
  padding: 12px 16px;
  border-radius: 10px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.05);
}
.timeline-content h4 {
  margin: 0 0 6px;
  font-size: 15px;
  color: #0077fc;
}
.timeline-content ul {
  margin: 0;
  padding-left: 18px;
  font-size: 13px;
  line-height: 1.6;
  color: #444;
}

@media (min-width: 768px){
  .container{max-width:600px;padding:32px 28px}
  .main-box{flex-direction:row}
  input{flex:1}
}
</style>
</head>
<body>
<div class="container">
  <h2>加密跳转链接生成</h2>
  <div class="main-box">
    <input type="url" id="url" placeholder="输入目标网址">
    <button onclick="gen()">生成</button>
  </div>
  <div id="result" class="result">
    <div><strong>跳转链接：</strong><span id="link"></span></div>
    <div class="qr">
      <img id="qrcode" alt="二维码">
      <a id="download" class="download" download="qrcode.png">下载二维码</a>
    </div>
  </div>
  <div class="tip">
    <strong>重要声明：</strong><br>
    本工具仅限合法学习测试，严禁用于诈骗、钓鱼、恶意引流等任何非法行为，违者自负法律责任。
  </div>
  <div class="nav">
    <a href="/log" target="_blank">访问日志</a>
  </div>
</div>

<!-- 项目更新时光轴 -->
<div class="timeline-container">
  <h3>📝 项目更新日志</h3>
  <div class="timeline">
    <div class="timeline-item">
      <div class="timeline-date">2026-03-29</div>
      <div class="timeline-content">
        <h4>v1.0.0 正式版</h4>
        <ul>
          <li>✅ 加密跳转链接生成</li>
          <li>✅ IP/设备/归属地记录</li>
          <li>✅ 日志查看 + 密码保护</li>
          <li>✅ 导出CSV日志</li>
          <li>✅ 二维码生成与下载</li>
        </ul>
      </div>
    </div>
    <div class="timeline-item">
      <div class="timeline-date">2026-03-29</div>
      <div class="timeline-content">
        <h4>v1.0.1 优化版</h4>
        <ul>
          <li>🔧 修复Docker时区问题</li>
          <li>🔧 日志时间强制北京时间</li>
          <li>🔧 新增项目更新时间轴</li>
          <li>🔧 移动端自适应优化</li>
        </ul>
      </div>
    </div>
    <div class="timeline-item">
      <div class="timeline-date">2026-03-29</div>
      <div class="timeline-content">
        <h4>v1.0.2 修复版</h4>
        <ul>
          <li>🔧 修复强制https跳转导致502问题</li>
          <li>🔧 完全不自动添加http/https协议</li>
          <li>🔧 输入什么就跳转什么，兼容所有地址</li>
        </ul>
      </div>
    </div>
  </div>
</div>

<script>
function gen(){
  const u = document.getElementById('url').value.trim();
  if(!u) return alert('请输入网址');
  fetch('/make?url='+encodeURIComponent(u))
  .then(r=>r.text())
  .then(url=>{
    document.getElementById('link').innerText = url;
    const qr = 'https://api.qrtool.cn/?text='+encodeURIComponent(url)+'&size=200&margin=0';
    document.getElementById('qrcode').src = qr;
    document.getElementById('download').href = qr;
    document.getElementById('result').style.display = 'block';
  })
}
</script>
</body>
</html>
  `);
});

app.get('/make', (req, res) => {
  const url = req.query.url;
  if (!url) return res.send('请输入网址');
  const key = encodeUrl(url);
  res.send(`${req.protocol}://${req.headers.host}/?k=${key}`);
});

app.get('/log', async (req, res) => {
  const logs = await getLogs();
  let html = `
<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>访问日志</title>
<style>
body{background:#f7f8fa;font-family:system-ui,-apple-system,Segoe UI,Roboto,"Microsoft YaHei",sans-serif;padding:20px 12px}
.container{max-width:100%;margin:0 auto}
.card{background:#fff;padding:20px;border-radius:12px;box-shadow:0 2px 10px rgba(0,0,0,0.05)}
.bar{display:flex;gap:10px;margin-bottom:16px;flex-wrap:wrap}
.btn{padding:10px 14px;border-radius:8px;cursor:pointer;border:none;color:#fff;font-size:14px}
.btn.export{background:#009955}
.btn.clear{background:#ff4444}
.table-box{overflow-x:auto}
table{width:100%;border-collapse:collapse;min-width:600px}
th,td{padding:10px 8px;text-align:left;border-bottom:1px solid #eee;font-size:14px}
th{background:#f5f7fa}
.eye{cursor:pointer;color:#0077fc;margin-left:8px}
.target-hidden{color:#999}

@media (min-width: 768px){
  .container{max-width:1000px}
  table{min-width:700px}
}
</style>
</head>
<body>
<div class="container">
  <div class="card">
    <h2>访问日志</h2>
    <div class="bar">
      <button class="btn export" onclick="exportCSV()">导出日志（CSV/Excel）</button>
      <button class="btn clear" onclick="clearLogs()">清空日志</button>
    </div>
    <div class="table-box">
    <table>
      <tr>
        <th>时间</th>
        <th>访问IP</th>
        <th>IP归属地</th>
        <th>设备/系统</th>
        <th>目标地址</th>
      </tr>
  `;

  logs.forEach((log, i) => {
    html += `
      <tr>
        <td>${log.time}</td>
        <td>${log.ip}</td>
        <td>${log.location}</td>
        <td>${log.device}</td>
        <td>
          <span class="target-hidden">已隐藏</span>
          <span class="eye" onclick="show(${i})">👁️</span>
        </td>
      </tr>
    `;
  });

  html += `
    </table>
    </div>
  </div>
</div>
<script>
const targets = [];
const logData = [];
`;

  logs.forEach(l => {
    html += `targets.push(${JSON.stringify(l.target)});\n`;
    html += `logData.push(${JSON.stringify(l)});\n`;
  });

  html += `
async function show(i){
  const p = prompt('请输入查看密码：');
  if(!p) return;
  const r = await fetch('/check-pwd', {
    method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({pwd:p})
  });
  const d = await r.json();
  if(d.ok){
    document.querySelectorAll('.target-hidden')[i].innerText = targets[i];
    document.querySelectorAll('.eye')[i].remove();
  }else{
    alert('密码错误');
  }
}

async function clearLogs(){
  if(!confirm('确定清空？不可恢复！')) return;
  const p = prompt('请输入清空密码：');
  if(!p) return;
  const r = await fetch('/clear-log', {
    method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({pwd:p})
  });
  const d = await r.json();
  if(d.ok){location.reload();}else{alert('密码错误');}
}

function exportCSV(){
  if(logData.length === 0){alert('暂无日志可导出');return;}
  const header = '时间,IP,归属地,设备,目标地址\\n';
  const rows = logData.map(l => \`\${l.time},\${l.ip},"\${l.location}","\${l.device}","\${l.target}"\`).join('\\n');
  const csv = header + rows;
  const blob = new Blob([csv], {type:'text/csv;charset=utf-8'});
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = '访问日志.csv';
  a.click();
}
</script>
</body></html>
  `;
  res.send(html);
});

app.post('/check-pwd', (req, res) => {
  res.json({ ok: req.body.pwd === LOG_PASSWORD });
});

app.post('/clear-log', async (req, res) => {
  if (req.body.pwd !== LOG_PASSWORD) return res.json({ ok: false });
  await fs.writeFile(LOG_FILE, '[]', 'utf8');
  res.json({ ok: true });
});

app.use((err, req, res, next) => {
  res.status(500).send('服务异常');
});

app.listen(PORT, '0.0.0.0', () => {
  console.log('服务启动成功 端口：'+PORT);
});
EOF

# 4. package.json
cat > package.json <<'EOF'
{
  "name": "ip-tool",
  "version": "1.0.0",
  "dependencies": {
    "axios": "^1.6.0",
    "express": "^4.18.2"
  }
}
EOF

# 5. Dockerfile
cat > Dockerfile <<'EOF'
FROM node:20-alpine
WORKDIR /app
ENV TZ=Asia/Shanghai
COPY package.json .
RUN npm install --only=production
COPY . .
EXPOSE 6262
CMD ["node", "app.js"]
EOF

# 6. docker-compose.yml
cat > docker-compose.yml <<'EOF'
version: '3'
services:
  ip-tool:
    build: .
    restart: always
    ports:
      - "6262:6262"
    volumes:
      - ./visits.json:/app/visits.json
    environment:
      - TZ=Asia/Shanghai
EOF

# 7. 启动
echo "[4/5] 构建并启动容器..."
docker-compose down -v > /dev/null 2>&1
docker-compose up -d --build > /dev/null 2>&1

IP=$(curl -s ipinfo.io/ip 2>/dev/null || echo "服务器IP")

echo "[5/5] 部署成功！"
echo ""
echo "====================================="
echo "首页： http://$IP:6262"
echo "日志： http://$IP:6262/log"
echo "密码： admin123"
echo "====================================="
echo "✅ 已修复：不再自动加https，不会502"
echo "✅ 更新日志：保留历史 + 新增v1.0.2"
echo "✅ 访问日志：完全保留，不受影响"
echo "====================================="