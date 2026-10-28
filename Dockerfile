# ==============================================================================
# SINGULARITY Mission Control - Production Multi-Stage Dockerfile
# Optimized for Render.com (HTTP API + WebSocket + React SPA)
# ==============================================================================

# ------------------------------------------------------------------------------
# Stage 1: Build React Frontend
# ------------------------------------------------------------------------------
FROM node:20-bookworm-slim AS frontend-builder
WORKDIR /app/Frontend

COPY Frontend/package*.json ./
RUN npm install

COPY Frontend/ ./
RUN npm run build

# ------------------------------------------------------------------------------
# Stage 2: Build Express + TypeScript Backend
# ------------------------------------------------------------------------------
FROM node:20-bookworm-slim AS backend-builder
WORKDIR /app/Backend

# Install build tools for better-sqlite3 native compilation
RUN apt-get update && apt-get install -y python3 make g++ && rm -rf /var/lib/apt/lists/*

COPY Backend/package*.json ./
RUN npm install

COPY Backend/ ./
RUN npm run build

# ------------------------------------------------------------------------------
# Stage 3: Production Runner
# ------------------------------------------------------------------------------
FROM node:20-bookworm-slim AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=10000
ENV FRONTEND_PATH=/app/Frontend/dist

# Install runtime tools for native sqlite bindings
RUN apt-get update && apt-get install -y python3 make g++ && rm -rf /var/lib/apt/lists/*

WORKDIR /app/Backend

# Install only production dependencies
COPY Backend/package*.json ./
RUN npm install --omit=dev

# Copy compiled backend output
COPY --from=backend-builder /app/Backend/dist ./dist

# Copy compiled frontend assets
COPY --from=frontend-builder /app/Frontend/dist /app/Frontend/dist

# Ensure SQLite storage directory exists
RUN mkdir -p /app/Backend/data

EXPOSE 10000

# Health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "require('http').get('http://localhost:' + (process.env.PORT || 10000) + '/health', (r) => { if (r.statusCode !== 200) process.exit(1); });"

CMD ["node", "dist/index.js"]
