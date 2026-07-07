# ============================================================================
# STAGE 1: BUILD & DEPENDENCY INSTALLATION
# ============================================================================
FROM node:20-alpine AS builder

WORKDIR /usr/src/app

# Install build dependencies safely if any native modules need compilation
RUN apk add --no-cache python3 make g++

# Layer caching: Only reinstall modules if package.json definitions mutate
COPY package*.json ./
RUN npm ci --only=production

# ============================================================================
# STAGE 2: HIGH-PERFORMANCE PRODUCTION RUNTIME
# ============================================================================
FROM node:20-alpine AS runner

# Inject tini to handle kernel signals (SIGTERM/SIGINT) efficiently under PID 1
RUN apk add --no-cache tini

WORKDIR /usr/src/app

# Establish strict production variable landscapes
ENV NODE_ENV=production
# Render automatically handles port injection, but we match your baseline 10000 layout
ENV PORT=10000

# Copy production dependencies and application logic from the builder stage
COPY --from=builder /usr/src/app/node_modules ./node_modules
COPY --from=builder /usr/src/app/package*.json ./
COPY server.js ./
COPY index.html ./

# Grant ownership of the directory to the unprivileged built-in node user
RUN chown -R node:node /usr/src/app

# Bound runtime layer configuration execution to non-root privileges
USER node

# Expose production engine boundary target
EXPOSE 10000

# Execute engine via tini to ensure clean shutdowns and zero ghost processes
ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "server.js"]
