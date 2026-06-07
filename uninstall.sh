#!/bin/bash
set -e

# 自动获取脚本所在目录
BASE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "====================================="
echo "      IP工具 一键彻底卸载"
echo "====================================="

echo ""
echo "[1/4] 停止并删除容器..."
cd "$BASE_DIR"
docker-compose down -v 2>/dev/null || true

echo "[2/4] 删除镜像..."
docker rmi ip-tool_ip-tool 2>/dev/null || true

echo "[3/4] 删除项目文件..."
rm -rf "$BASE_DIR/app.js" \
       "$BASE_DIR/package.json" \
       "$BASE_DIR/Dockerfile" \
       "$BASE_DIR/docker-compose.yml" \
       "$BASE_DIR/visits.json" \
       "$BASE_DIR/node_modules" 2>/dev/null || true

echo "[4/4] 清理完成！"
echo ""
echo "====================================="
echo "已完全卸载，当前目录已恢复干净"
echo "====================================="