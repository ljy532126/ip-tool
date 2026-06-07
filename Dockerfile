FROM node:20-alpine
WORKDIR /app
ENV TZ=Asia/Shanghai
COPY package.json .
RUN npm install --only=production
COPY . .
EXPOSE 6262
CMD ["node", "app.js"]
