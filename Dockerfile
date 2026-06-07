# 第一阶段：构建前端
FROM node:20-alpine AS client-builder
WORKDIR /build
COPY client/package.json client/package-lock.json* ./
RUN npm config set registry https://registry.npmmirror.com && npm install
COPY client/ .
RUN npx vite build

# 第二阶段：运行时
FROM node:20-alpine
WORKDIR /app
ENV TZ=Asia/Shanghai
COPY server/package.json .
RUN npm config set registry https://registry.npmmirror.com && npm install --only=production
COPY server/ .
COPY --from=client-builder /build/dist ./client/dist
EXPOSE 6262
CMD ["node", "index.js"]
