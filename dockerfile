FROM node:20-alpine

WORKDIR /usr/src/app

ENV NODE_ENV=production
# Render automatically injects its own PORT variable, but we keep 3000 as a fallback
ENV PORT=3000

COPY package*.json ./
RUN npm ci --only=production

COPY server.js ./
COPY index.html ./

EXPOSE 3000

# Direct node execution allows Render's health checks to link up instantly
CMD ["node", "server.js"]
