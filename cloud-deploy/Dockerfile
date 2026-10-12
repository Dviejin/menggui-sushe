# 猛鬼宿舍联机版 · 容器镜像
# 零依赖 Node 服务，构建产物约 80MB，运行时内存占用 ~40MB
FROM node:22-alpine

LABEL maintainer="menggui-sushe" \
      description="猛鬼宿舍联机对战服务器（房间状态在单实例内存中）"

WORKDIR /app

# 只拷运行必需文件，保持镜像最小
COPY server.js ./
COPY index.html ./
COPY package.json ./

ENV NODE_ENV=production
ENV PORT=8080

EXPOSE 8080

# 重要：房间存在进程内存中，务必 replicas=1，绝不横向扩容
CMD ["node", "server.js"]
