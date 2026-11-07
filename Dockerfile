# The Ashgrave game process: the eight Switch agents plus the game window.
FROM node:22-slim
RUN apt-get update && apt-get install -y --no-install-recommends postgresql-client && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run ui:build
ENV STATE_DIR=/data NODE_ENV=production
CMD ["sh", "deploy/start.sh"]
