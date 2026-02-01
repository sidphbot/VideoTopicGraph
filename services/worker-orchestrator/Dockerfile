# =============================================================================
# Video Graph Worker Orchestrator - Dockerfile
# Multi-stage build with ML dependencies
# =============================================================================

# -----------------------------------------------------------------------------
# Stage 1: Base with Python & Node.js
# -----------------------------------------------------------------------------
FROM node:20-bookworm-slim AS base

# Install Python and system dependencies for ML libraries
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 \
    python3-pip \
    python3-venv \
    ffmpeg \
    curl \
    ca-certificates \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

# Install pnpm
RUN npm install -g pnpm@8

# Create Python virtual environment
RUN python3 -m venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH"

# -----------------------------------------------------------------------------
# Stage 2: Python ML Dependencies
# -----------------------------------------------------------------------------
FROM base AS python-deps

# Install Python ML packages
RUN pip install --no-cache-dir \
    faster-whisper==0.10.0 \
    sentence-transformers==2.2.2 \
    transformers==4.36.0 \
    torch==2.1.0 --index-url https://download.pytorch.org/whl/cpu \
    numpy==1.24.3 \
    scipy==1.11.0

# -----------------------------------------------------------------------------
# Stage 3: Node Dependencies
# -----------------------------------------------------------------------------
FROM base AS node-deps
WORKDIR /app

COPY package.json pnpm-workspace.yaml pnpm-lock.yaml* ./
COPY turbo.json ./

COPY packages/shared-types/package.json ./packages/shared-types/
COPY packages/pipeline-sdk/package.json ./packages/pipeline-sdk/
COPY packages/openapi/package.json ./packages/openapi/
COPY services/worker-orchestrator/package.json ./services/worker-orchestrator/

RUN pnpm install --frozen-lockfile

# -----------------------------------------------------------------------------
# Stage 4: Build
# -----------------------------------------------------------------------------
FROM node-deps AS build
WORKDIR /app

COPY packages/shared-types ./packages/shared-types
COPY packages/pipeline-sdk ./packages/pipeline-sdk
COPY packages/openapi ./packages/openapi
COPY services/worker-orchestrator ./services/worker-orchestrator

RUN pnpm --filter @video-graph/shared-types build
RUN pnpm --filter @video-graph/pipeline-sdk build
RUN pnpm --filter @video-graph/worker-orchestrator build

# -----------------------------------------------------------------------------
# Stage 5: Production
# -----------------------------------------------------------------------------
FROM base AS production
WORKDIR /app

# Install runtime dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    postgresql-client \
    redis-tools \
    && rm -rf /var/lib/apt/lists/*

# Create non-root user
RUN groupadd -r worker && useradd -r -g worker worker

# Copy Python environment
COPY --from=python-deps /opt/venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH"

# Copy Node.js dependencies
COPY --from=node-deps /app/node_modules ./node_modules
COPY --from=node-deps /app/packages/shared-types/node_modules ./packages/shared-types/node_modules
COPY --from=node-deps /app/packages/pipeline-sdk/node_modules ./packages/pipeline-sdk/node_modules
COPY --from=node-deps /app/services/worker-orchestrator/node_modules ./services/worker-orchestrator/node_modules

# Copy built artifacts
COPY --from=build /app/packages/shared-types/dist ./packages/shared-types/dist
COPY --from=build /app/packages/pipeline-sdk/dist ./packages/pipeline-sdk/dist
COPY --from=build /app/services/worker-orchestrator/dist ./services/worker-orchestrator/dist
COPY --from=build /app/services/worker-orchestrator/package.json ./services/worker-orchestrator/

# Copy Python scripts
COPY --from=build /app/services/worker-orchestrator/src/python ./services/worker-orchestrator/dist/python

# Create directories for models and temp files
RUN mkdir -p /tmp/video-graph && \
    chown -R worker:worker /tmp/video-graph /app

# Environment variables
ENV NODE_ENV=production
ENV PYTHON_PATH=/opt/venv/bin/python3
ENV WHISPER_MODEL=base
ENV EMBEDDING_MODEL=sentence-transformers/all-MiniLM-L6-v2

# Switch to non-root user
USER worker

# Health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
    CMD node -e "require('bullmq').QueueScheduler && console.log('OK')" || exit 1

# Start worker
WORKDIR /app/services/worker-orchestrator
CMD ["node", "dist/index.js"]
