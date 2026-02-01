# Getting Started

This guide will help you set up and run the Video Topic Graph Platform locally.

## Prerequisites

- Docker and Docker Compose
- Node.js 20+ and pnpm
- Git

## Quick Start

### 1. Clone and Setup

```bash
git clone <repository>
cd video-topic-graph-platform

# Copy environment file
cp infra/.env.example infra/.env

# Edit .env with your settings
```

### 2. Start Infrastructure

```bash
cd infra
docker-compose up -d postgres redis minio keycloak
```

Wait for services to be healthy:

```bash
docker-compose ps
```

### 3. Configure Keycloak

The Keycloak realm is automatically imported from `infra/keycloak/realm-export.json`.

Access the admin console:
- URL: http://localhost:8080/admin
- Username: admin
- Password: admin

### 4. Install Dependencies

```bash
# From project root
pnpm install
```

### 5. Run Database Migrations

```bash
cd services/api
pnpm db:migrate
```

### 6. Start Services

```bash
# From project root - starts all services
pnpm dev
```

Or start individually:

```bash
# Terminal 1: API
cd services/api && pnpm dev

# Terminal 2: Worker Orchestrator
cd services/worker-orchestrator && pnpm dev

# Terminal 3: Web UI
cd apps/web-ui && pnpm dev
```

### 7. Access the Application

- Web UI: http://localhost:3001
- API Docs: http://localhost:3000/docs
- Keycloak: http://localhost:8080

## First Video Analysis

1. Open the Web UI at http://localhost:3001
2. Login with Keycloak (create a new user if needed)
3. Click "Add Video" and enter a YouTube URL
4. Wait for processing (check job status)
5. View the generated topic graph

## Configuration Options

### Model Selection

Edit `infra/.env` to change models:

```bash
# ASR Model: whisper, faster-whisper, whisper-cpp
ASR_MODEL=faster-whisper
ASR_MODEL_SIZE=base

# Embedding Model
EMBEDDING_MODEL=all-MiniLM-L6-v2

# LLM Model
LLM_MODEL=mistral
OLLAMA_HOST=http://localhost:11434
```

### Feature Flags

Enable/disable features:

```bash
# Enable speaker diarization
FEATURE_DIARIZATION=true

# Enable scene detection
FEATURE_SCENE_DETECTION=true

# Enable word-level alignment
FEATURE_WORD_ALIGNMENT=true
```

### Quota Policies

Default quotas are defined in `infra/init-scripts/01-init.sql`:

```sql
-- Default plan: 10 videos/month, 5GB storage
-- Premium plan: 100 videos/month, 50GB storage
-- Unlimited plan: No limits
```

## Development Workflow

### Adding a Pipeline Step

1. Create step class in `packages/pipeline-sdk/src/steps/`:

```typescript
// packages/pipeline-sdk/src/steps/my-step.ts
import { BasePipelineStep } from '../core';

export class MyStep extends BasePipelineStep {
  readonly name = 'my-step';
  readonly version = '1.0.0';
  
  // Implementation
}
```

2. Register in `packages/pipeline-sdk/src/steps/index.ts`
3. Use in worker orchestrator

### Adding API Endpoints

1. Add route handler in `services/api/src/routes/`
2. Register in `services/api/src/index.ts`
3. Update OpenAPI spec in `packages/openapi/openapi.yaml`

### Database Changes

1. Update schema in `services/api/src/db/schema.ts`
2. Generate migration:

```bash
cd services/api
pnpm db:generate
```

3. Apply migration:

```bash
pnpm db:migrate
```

## Troubleshooting

### Services Won't Start

Check logs:

```bash
cd infra
docker-compose logs -f
```

### Database Connection Issues

Verify PostgreSQL is running:

```bash
docker-compose ps postgres
docker-compose exec postgres pg_isready
```

### Keycloak Login Issues

Check Keycloak logs:

```bash
docker-compose logs keycloak
```

Verify realm import:
- Go to http://localhost:8080/admin
- Check if "videograph" realm exists

### Pipeline Jobs Failing

Check worker logs:

```bash
# If running with docker-compose
docker-compose logs pipeline-worker

# If running locally
cd services/worker-orchestrator
pnpm dev
```

## Production Deployment

### Docker Compose (Single Node)

```bash
cd infra
docker-compose --profile services up -d
```

### Kubernetes

Helm charts are available in `infra/helm/` (placeholder).

### Cloud Deployment

See `docs/DEPLOYMENT.md` for AWS, GCP, and Azure deployment guides.

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make changes
4. Run tests
5. Submit a pull request

## Resources

- [Architecture](ARCHITECTURE.md)
- [API Documentation](API.md)
- [Pipeline SDK](PIPELINE.md)
- [OpenAPI Spec](../packages/openapi/openapi.yaml)
