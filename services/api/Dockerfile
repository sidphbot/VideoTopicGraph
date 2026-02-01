# =============================================================================
# Video Graph API Service - Dockerfile
# Multi-stage build for production optimization
# =============================================================================

# -----------------------------------------------------------------------------
# Stage 1: Base Dependencies
# -----------------------------------------------------------------------------
FROM node:20-alpine AS base
RUN npm install -g pnpm@8

# -----------------------------------------------------------------------------
# Stage 2: Dependencies Installation
# -----------------------------------------------------------------------------
FROM base AS dependencies
WORKDIR /app

# Copy workspace configuration
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml* ./
COPY turbo.json ./

# Copy package manifests for all workspaces
COPY packages/shared-types/package.json ./packages/shared-types/
COPY packages/pipeline-sdk/package.json ./packages/pipeline-sdk/
COPY packages/openapi/package.json ./packages/openapi/
COPY services/api/package.json ./services/api/

# Install all dependencies
RUN pnpm install --frozen-lockfile

# -----------------------------------------------------------------------------
# Stage 3: Build
# -----------------------------------------------------------------------------
FROM dependencies AS build
WORKDIR /app

# Copy source code
COPY packages/shared-types ./packages/shared-types
COPY packages/pipeline-sdk ./packages/pipeline-sdk
COPY packages/openapi ./packages/openapi
COPY services/api ./services/api

# Build packages in dependency order
RUN pnpm --filter @video-graph/shared-types build
RUN pnpm --filter @video-graph/pipeline-sdk build

# Build API service
RUN pnpm --filter @video-graph/api build

# -----------------------------------------------------------------------------
# Stage 4: Production Dependencies
# -----------------------------------------------------------------------------
FROM base AS production-deps
WORKDIR /app

COPY package.json pnpm-workspace.yaml pnpm-lock.yaml* ./
COPY turbo.json ./

COPY packages/shared-types/package.json ./packages/shared-types/
COPY packages/pipeline-sdk/package.json ./packages/pipeline-sdk/
COPY packages/openapi/package.json ./packages/openapi/
COPY services/api/package.json ./services/api/

RUN pnpm install --frozen-lockfile --prod

# -----------------------------------------------------------------------------
# Stage 5: Production Runtime
# -----------------------------------------------------------------------------
FROM node:20-alpine AS production
WORKDIR /app

# Install runtime dependencies
RUN apk add --no-cache \
    postgresql-client \
    curl \
    ca-certificates

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

# Copy production dependencies
COPY --from=production-deps --chown=nodejs:nodejs /app/node_modules ./node_modules
COPY --from=production-deps --chown=nodejs:nodejs /app/packages/shared-types/node_modules ./packages/shared-types/node_modules
COPY --from=production-deps --chown=nodejs:nodejs /app/packages/pipeline-sdk/node_modules ./packages/pipeline-sdk/node_modules
COPY --from=production-deps --chown=nodejs:nodejs /app/services/api/node_modules ./services/api/node_modules

# Copy built artifacts
COPY --from=build --chown=nodejs:nodejs /app/packages/shared-types/dist ./packages/shared-types/dist
COPY --from=build --chown=nodejs:nodejs /app/packages/pipeline-sdk/dist ./packages/pipeline-sdk/dist
COPY --from=build --chown=nodejs:nodejs /app/services/api/dist ./services/api/dist
COPY --from=build --chown=nodejs:nodejs /app/services/api/package.json ./services/api/

# Copy drizzle configuration and migrations
COPY --from=build --chown=nodejs:nodejs /app/services/api/drizzle ./services/api/drizzle
COPY --from=build --chown=nodejs:nodejs /app/services/api/drizzle.config.ts ./services/api/

# Copy OpenAPI spec
COPY --from=build --chown=nodejs:nodejs /app/packages/openapi/openapi.yaml ./packages/openapi/

# Set environment
ENV NODE_ENV=production
ENV PORT=3000

# Switch to non-root user
USER nodejs

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD curl -f http://localhost:3000/health || exit 1

# Start the application
WORKDIR /app/services/api
CMD ["node", "dist/index.js"]
