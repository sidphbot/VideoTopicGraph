# =============================================================================
# Video Graph Web UI - Dockerfile
# Multi-stage build with nginx production server
# =============================================================================

# -----------------------------------------------------------------------------
# Stage 1: Base Dependencies
# -----------------------------------------------------------------------------
FROM node:20-alpine AS base
RUN npm install -g pnpm@8

# -----------------------------------------------------------------------------
# Stage 2: Dependencies
# -----------------------------------------------------------------------------
FROM base AS dependencies
WORKDIR /app

COPY package.json pnpm-workspace.yaml pnpm-lock.yaml* ./
COPY turbo.json ./

COPY packages/shared-types/package.json ./packages/shared-types/
COPY packages/pipeline-sdk/package.json ./packages/pipeline-sdk/
COPY packages/openapi/package.json ./packages/openapi/
COPY apps/web-ui/package.json ./apps/web-ui/

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
COPY apps/web-ui ./apps/web-ui

# Build packages
RUN pnpm --filter @video-graph/shared-types build
RUN pnpm --filter @video-graph/pipeline-sdk build

# Build web UI
ARG VITE_API_URL=/api
ARG VITE_KEYCLOAK_URL
ARG VITE_KEYCLOAK_REALM=video-graph
ARG VITE_KEYCLOAK_CLIENT_ID=web-ui

ENV VITE_API_URL=${VITE_API_URL}
ENV VITE_KEYCLOAK_URL=${VITE_KEYCLOAK_URL}
ENV VITE_KEYCLOAK_REALM=${VITE_KEYCLOAK_REALM}
ENV VITE_KEYCLOAK_CLIENT_ID=${VITE_KEYCLOAK_CLIENT_ID}

RUN pnpm --filter @video-graph/web-ui build

# -----------------------------------------------------------------------------
# Stage 4: Production with Nginx
# -----------------------------------------------------------------------------
FROM nginx:alpine AS production

# Install envsubst for environment variable substitution
RUN apk add --no-cache gettext

# Copy built application
COPY --from=build /app/apps/web-ui/dist /usr/share/nginx/html

# Copy nginx configuration
COPY apps/web-ui/nginx.conf /etc/nginx/templates/default.conf.template

# Create startup script for env substitution
RUN echo '#!/bin/sh\n\
envsubst < /etc/nginx/templates/default.conf.template > /etc/nginx/conf.d/default.conf\n\
nginx -g "daemon off;"' > /docker-entrypoint.sh && \
    chmod +x /docker-entrypoint.sh

# Expose port
EXPOSE 80

# Health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
    CMD wget --quiet --tries=1 --spider http://localhost/ || exit 1

# Start nginx with env substitution
CMD ["/docker-entrypoint.sh"]
