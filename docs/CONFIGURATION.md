# Configuration Guide

## Environment Variables

### Application

| Variable | Description | Default | Required |
|----------|-------------|---------|----------|
| `NODE_ENV` | Environment mode | `development` | No |
| `APP_NAME` | Application name | `video-topic-graph-api` | No |
| `APP_VERSION` | Application version | `1.0.0` | No |

### Server

| Variable | Description | Default | Required |
|----------|-------------|---------|----------|
| `PORT` | API server port | `3000` | No |
| `HOST` | API server host | `0.0.0.0` | No |
| `LOG_LEVEL` | Logging level (debug/info/warn/error) | `info` | No |
| `REQUEST_TIMEOUT_MS` | Request timeout | `30000` | No |

### CORS

| Variable | Description | Default | Required |
|----------|-------------|---------|----------|
| `CORS_ORIGINS` | Comma-separated allowed origins | `http://localhost:3001,http://localhost:5173` | No |

### Rate Limiting

| Variable | Description | Default | Required |
|----------|-------------|---------|----------|
| `RATE_LIMIT_ENABLED` | Enable rate limiting | `true` | No |
| `RATE_LIMIT_WINDOW_MS` | Rate limit window | `60000` | No |
| `RATE_LIMIT_MAX_REQUESTS` | Max requests per window | `100` | No |

### Upload

| Variable | Description | Default | Required |
|----------|-------------|---------|----------|
| `UPLOAD_MAX_FILE_SIZE` | Maximum file upload size | `104857600` (100MB) | No |

### Database

| Variable | Description | Default | Required |
|----------|-------------|---------|----------|
| `DB_HOST` | PostgreSQL host | `localhost` | Yes |
| `DB_PORT` | PostgreSQL port | `5432` | No |
| `DB_NAME` | Database name | `videograph` | Yes |
| `DB_USER` | Database user | `postgres` | Yes |
| `DB_PASSWORD` | Database password | - | Yes |
| `DB_POOL_SIZE` | Connection pool size | `10` | No |
| `DB_VECTOR_DIMENSION` | Embedding dimension | `384` | No |

### Redis

| Variable | Description | Default | Required |
|----------|-------------|---------|----------|
| `REDIS_URL` | Redis connection URL | `redis://localhost:6379` | Yes |

### Storage (MinIO/S3)

| Variable | Description | Default | Required |
|----------|-------------|---------|----------|
| `STORAGE_PROVIDER` | Storage provider (minio/s3) | `minio` | No |
| `STORAGE_ENDPOINT` | Storage endpoint URL | `http://localhost:9000` | Yes |
| `STORAGE_REGION` | Storage region | `us-east-1` | No |
| `STORAGE_ACCESS_KEY` | Access key | `minioadmin` | Yes |
| `STORAGE_SECRET_KEY` | Secret key | `minioadmin` | Yes |
| `STORAGE_BUCKET` | Bucket name | `videograph` | No |
| `STORAGE_USE_SSL` | Use SSL | `false` | No |
| `STORAGE_PRESIGNED_URL_EXPIRY` | Presigned URL expiry (seconds) | `3600` | No |

### Authentication (Keycloak)

| Variable | Description | Default | Required |
|----------|-------------|---------|----------|
| `AUTH_PROVIDER` | Auth provider | `keycloak` | No |
| `AUTH_ISSUER_URL` | Keycloak issuer URL | `http://localhost:8080` | Yes |
| `AUTH_REALM` | Keycloak realm | `videograph` | Yes |
| `AUTH_CLIENT_ID` | Client ID | `videograph-api` | Yes |
| `AUTH_CLIENT_SECRET` | Client secret | - | No |
| `AUTH_ADMIN_USERNAME` | Admin username | `admin` | No |
| `AUTH_ADMIN_PASSWORD` | Admin password | `admin` | No |

### Worker

| Variable | Description | Default | Required |
|----------|-------------|---------|----------|
| `WORKER_QUEUE_PROVIDER` | Queue provider (redis/bull) | `redis` | No |
| `WORKER_REDIS_URL` | Worker Redis URL | `redis://localhost:6379` | Yes |
| `WORKER_CONCURRENCY` | Concurrent jobs per worker | `2` | No |
| `WORKER_JOB_TIMEOUT` | Job timeout (ms) | `3600000` | No |
| `WORKER_MAX_RETRIES` | Max retry attempts | `3` | No |

### Ollama (LLM)

| Variable | Description | Default | Required |
|----------|-------------|---------|----------|
| `OLLAMA_HOST` | Ollama server URL | `http://localhost:11434` | No |

## Model Configuration

### ASR Models

```bash
# Provider: whisper, faster-whisper, whisper-cpp
ASR_MODEL=faster-whisper

# Model size: tiny, base, small, medium, large-v1, large-v2, large-v3
ASR_MODEL_SIZE=base

# Device: cpu, cuda
ASR_DEVICE=cpu

# Compute type (faster-whisper): int8, int8_float16, int16, float16, float32
ASR_COMPUTE_TYPE=int8
```

### Diarization

```bash
# Enable speaker diarization
ENABLE_DIARIZATION=false

# Diarization model
DIARIZATION_MODEL=pyannote/speaker-diarization
```

### Embedding Models

```bash
# Model: all-MiniLM-L6-v2, all-mpnet-base-v2, ollama-nomic
EMBEDDING_MODEL=all-MiniLM-L6-v2

# Device: cpu, cuda
EMBEDDING_DEVICE=cpu
```

### LLM Models

```bash
# Provider: ollama, llama-cpp, vllm
LLM_PROVIDER=ollama

# Model: mistral, mixtral, llama2, ollama-phi
LLM_MODEL=mistral

# Device: cpu, cuda
LLM_DEVICE=cpu
```

## Default Pipeline Configuration

```bash
# Default ASR model
DEFAULT_ASR_MODEL=faster-whisper

# Default ASR language (auto-detect if empty)
DEFAULT_ASR_LANGUAGE=

# Enable diarization by default
DEFAULT_ENABLE_DIARIZATION=false

# Enable scene detection by default
DEFAULT_ENABLE_SCENE_DETECTION=false

# Number of topic hierarchy levels (1-5)
DEFAULT_TOPIC_LEVELS=3

# Default embedding model
DEFAULT_EMBEDDING_MODEL=all-MiniLM-L6-v2

# Default LLM model
DEFAULT_LLM_MODEL=mistral

# Snippet quality: low, medium, high
DEFAULT_SNIPPET_QUALITY=medium
```

## Feature Flags

```bash
# Processing Features
FEATURE_SCENE_DETECTION=false        # Scene change detection
FEATURE_DIARIZATION=false            # Speaker identification
FEATURE_WORD_ALIGNMENT=false         # Word-level timestamps
FEATURE_VISUAL_TOPICS=false          # Visual topic analysis
FEATURE_OCR=false                    # On-screen text recognition

# Advanced Features
FEATURE_MULTI_VIDEO_GRAPHS=false     # Cross-video graphs
FEATURE_EAGER_SNIPPET_GENERATION=true # Generate snippets during processing
FEATURE_DEEP_SEARCH=true             # LLM-powered search
FEATURE_EXPORT_EMBEDDING=false       # Include embeddings in exports

# UI Features
FEATURE_REALTIME_UPDATES=true        # Live progress updates
FEATURE_GRAPH_VERSIONING=true        # Graph version history
FEATURE_SHARE_EXPIRATION=true        # Share link expiration
FEATURE_QUOTA_ENFORCEMENT=true       # Enforce usage quotas
FEATURE_MULTI_PARENT_TOPICS=true     # Allow multiple parents
```

## Configuration Files

### Docker Compose

**File**: `infra/docker-compose.yml`

```yaml
services:
  postgres:
    environment:
      POSTGRES_USER: ${DB_USER:-postgres}
      POSTGRES_PASSWORD: ${DB_PASSWORD:-postgres}
      POSTGRES_DB: ${DB_NAME:-videograph}
    ports:
      - "${DB_PORT:-5432}:5432"

  redis:
    ports:
      - "${REDIS_PORT:-6379}:6379"

  minio:
    environment:
      MINIO_ROOT_USER: ${STORAGE_ACCESS_KEY:-minioadmin}
      MINIO_ROOT_USER: ${STORAGE_SECRET_KEY:-minioadmin}
    ports:
      - "${MINIO_API_PORT:-9000}:9000"
      - "${MINIO_CONSOLE_PORT:-9001}:9001"

  keycloak:
    environment:
      KEYCLOAK_ADMIN: ${KEYCLOAK_ADMIN:-admin}
      KEYCLOAK_ADMIN_PASSWORD: ${KEYCLOAK_ADMIN_PASSWORD:-admin}
    ports:
      - "${KEYCLOAK_PORT:-8080}:8080"
```

### Keycloak Realm

**File**: `infra/keycloak/realm-export.json`

Pre-configured realm with:
- `videograph` realm
- `videograph-api` client (backend)
- `videograph-web` client (frontend)
- Default roles: `user`, `admin`

### Database Initialization

**File**: `infra/init-scripts/01-init.sql`

Pre-configured quota policies:
- `default`: 10 videos/month, 5GB storage
- `premium`: 100 videos/month, 50GB storage
- `unlimited`: No limits

## Environment-Specific Configuration

### Development

```bash
# .env.development
NODE_ENV=development
LOG_LEVEL=debug
RATE_LIMIT_ENABLED=false
FEATURE_QUOTA_ENFORCEMENT=false
```

### Staging

```bash
# .env.staging
NODE_ENV=staging
LOG_LEVEL=info
RATE_LIMIT_ENABLED=true
FEATURE_QUOTA_ENFORCEMENT=true
```

### Production

```bash
# .env.production
NODE_ENV=production
LOG_LEVEL=warn
RATE_LIMIT_ENABLED=true
FEATURE_QUOTA_ENFORCEMENT=true
UPLOAD_MAX_FILE_SIZE=524288000  # 500MB
```

## Configuration Validation

The API validates configuration on startup:

```typescript
// Required variables
const required = ['DB_HOST', 'DB_NAME', 'DB_USER', 'DB_PASSWORD'];

// Validate
for (const name of required) {
  if (!process.env[name]) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
}
```

## Hot Reloading

Configuration changes require restart:

```bash
# Development - auto-reload
pnpm dev

# Production - manual restart
docker-compose restart api
docker-compose restart pipeline-worker
```

## Secrets Management

For production, use a secrets manager:

```bash
# Docker Swarm
docker secret create db_password -
docker secret create storage_secret_key -

# Kubernetes
kubectl create secret generic videograph-secrets \
  --from-literal=DB_PASSWORD=... \
  --from-literal=STORAGE_SECRET_KEY=...
```

## Configuration Debugging

```bash
# Print all config
cd services/api && node -e "console.log(require('./dist/config.js').config)"

# Check specific value
echo $DB_HOST

# Validate env file
cd infra && docker-compose config
```
