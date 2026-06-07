# 加密跳转 & IP 记录工具

基于 Node.js Express 的加密跳转链接生成器，支持访问者 IP、归属地、设备信息记录。

## 快速开始

```bash
# 本地运行
npm install
npm start

# Docker 部署
docker-compose up -d --build
# 或使用一键脚本
bash install.sh
```

启动后访问 `http://localhost:6262`。

## 功能

- **加密跳转链接生成**：输入目标 URL，生成 base64url 编码的跳转链接
- **访问日志记录**：自动记录访问者 IP、归属地、设备/系统、目标地址
- **日志查看**：`/log` 路径查看访问日志（需密码）
- **CSV 导出**：日志页面支持导出 CSV
- **二维码**：生成跳转链接的二维码供移动端扫码

## API

| 路由 | 方法 | 说明 |
|------|------|------|
| `/?k=<encoded>` | GET | 跳转入口，记录访问后 302 重定向 |
| `/make?url=` | GET | 生成加密跳转链接 |
| `/log` | GET | 访问日志页面 |

## 密码

日志查看和清空密码硬编码在 `app.js` 的 `LOG_PASSWORD` 变量中，默认为 `admin123`。

## 环境变量

| 变量 | 说明 | 默认值 |
|------|------|--------|
| `TZ` | 时区 | `Asia/Shanghai` |

## 数据存储

访问日志以 JSON 数组形式存储在 `visits.json`。Docker 部署时通过 volume 挂载持久化。
