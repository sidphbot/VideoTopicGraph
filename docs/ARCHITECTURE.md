# Video Topic Graph Platform - Architecture

## Overview

The Video Topic Graph Platform is a distributed system that processes videos to extract hierarchical, overlapping topic graphs. The architecture follows a modular design with clear separation of concerns.

## System Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              Client Layer                                    │
├─────────────────────────────────────────────────────────────────────────────┤
│  ┌──────────────┐  ┌──────────────┐                                          │
│  │   Web UI     │  │ Android UI   │                                          │
│  │   (React)    │  │  (Flutter)   │                                          │
│  └──────────────┘  └──────────────┘                                          │
└─────────────────────────────────────────────────────────────────────────────┘
                                       │
                                       ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                              API Gateway                                     │
│  ┌─────────────────────────────────────────────────────────────────────────┐│
│  │  Fastify Server - REST API with OpenAPI spec                           ││
│  │  - Authentication (OIDC/JWT)                                           ││
│  │  - Rate Limiting                                                       ││
│  │  - Request Validation                                                  ││
│  └─────────────────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────────────────┘
                                       │
                                       ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                           Service Layer                                      │
├─────────────────────────────────────────────────────────────────────────────┤
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────────────────┐  │
│  │  API Service    │  │ Worker          │  │ Pipeline Workers            │  │
│  │  - CRUD         │  │ Orchestrator    │  │ - Video Processing          │  │
│  │  - Search       │  │ - Job Queue     │  │ - ASR (Whisper)             │  │
│  │  - Auth         │  │ - Scheduling    │  │ - Topic Segmentation        │  │
│  │  - Quotas       │  │ - Retry Logic   │  │ - Embeddings & Graph        │  │
│  └─────────────────┘  └─────────────────┘  │ - Snippet Generation        │  │
│                                             │ - Export Generation         │  │
│                                             └─────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────────┘
                                       │
                                       ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                           Data Layer                                         │
├─────────────────────────────────────────────────────────────────────────────┤
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌─────────────────┐ │
│  │ PostgreSQL   │  │    Redis     │  │    MinIO     │  │   Keycloak      │ │
│  │ + pgvector   │  │   (Queue)    │  │   (Storage)  │  │    (Auth)       │ │
│  └──────────────┘  └──────────────┘  └──────────────┘  └─────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Module Structure

### Apps (`/apps`)

- **web-ui**: React-based web application with interactive graph visualization
- **android-ui**: Flutter mobile application (placeholder)

### Packages (`/packages`)

- **openapi**: OpenAPI 3.1 specification for all API endpoints
- **shared-types**: Zod schemas and TypeScript types shared across services
- **pipeline-sdk**: Swappable pipeline step interfaces and implementations

### Services (`/services`)

- **api**: Fastify REST API with authentication, CRUD, search
- **worker-orchestrator**: BullMQ-based job queue and orchestration

## Pipeline Architecture

The pipeline follows a manifest-based design where each step:

1. Consumes an `ArtifactManifest` with input paths and metrics
2. Performs its processing
3. Produces an updated `ArtifactManifest` with new outputs

```
┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐
│  Video   │───▶│   ASR    │───▶│  Topic   │───▶│  Graph   │───▶│ Snippet  │
│  Step    │    │   Step   │    │   Step   │    │   Step   │    │   Step   │
└──────────┘    └──────────┘    └──────────┘    └──────────┘    └──────────┘
     │               │               │               │               │
     ▼               ▼               ▼               ▼               ▼
┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐
│ video_   │    │transcript│    │  topics  │    │embeddings│    │ snippets │
│ original │    │          │    │          │    │  graph   │    │          │
│ video_   │    │          │    │          │    │          │    │          │
│normalized│    │          │    │          │    │          │    │          │
│ audio_   │    │          │    │          │    │          │    │          │
│   wav    │    │          │    │          │    │          │    │          │
└──────────┘    └──────────┘    └──────────┘    └──────────┘    └──────────┘
```

### Swappable Pipeline Steps

Every pipeline step implements the `PipelineStep` interface:

```typescript
interface PipelineStep {
  readonly name: string;
  readonly version: string;
  
  execute(manifest: ArtifactManifest, context: PipelineContext): Promise<ArtifactManifest>;
  validateInput(manifest: ArtifactManifest): ValidationResult;
  getRequiredInputs(): (keyof ArtifactPaths)[];
  getProducedOutputs(): (keyof ArtifactPaths)[];
}
```

Steps can be swapped via the `stepRegistry`:

```typescript
import { stepRegistry } from '@video-graph/pipeline-sdk';

// Register custom ASR implementation
stepRegistry.register('asr', () => new CustomAsrStep(), {
  description: 'Custom ASR implementation',
  version: '1.0.0',
  tags: ['asr', 'custom'],
  inputs: ['audio_wav'],
  outputs: ['transcript'],
});
```

## Data Model

### Core Entities

```
┌─────────────┐     ┌──────────────────┐     ┌─────────────┐
│   Video     │────▶│  GraphVersion    │────▶│  TopicNode  │
│             │     │                  │     │             │
│ - id        │     │ - id             │     │ - id        │
│ - source_url│     │ - video_id       │     │ - level     │
│ - status    │     │ - version        │     │ - start_ts  │
└─────────────┘     │ - status         │     │ - end_ts    │
                    │ - config_snapshot│     │ - title     │
                    └──────────────────┘     │ - summary   │
                              │              │ - keywords  │
                              ▼              │ - embedding │
                    ┌──────────────────┐     │ - parent_ids│
                    │   TopicEdge      │     │ - child_ids │
                    │                  │     └─────────────┘
                    │ - src_topic_id   │
                    │ - dst_topic_id   │
                    │ - edge_type      │
                    │ - weight         │
                    └──────────────────┘
```

### Vector Search

Topics are stored with embeddings using pgvector:

```sql
CREATE INDEX topic_embedding_idx 
ON topic_nodes 
USING hnsw (embedding vector_cosine_ops);
```

## Authentication & Authorization

- **Authentication**: OIDC via Keycloak
- **Token Format**: JWT with RS256 signing
- **Authorization**: ACL-based with roles (owner, editor, viewer)

## Configuration

All configuration is environment-driven:

| Variable | Description | Default |
|----------|-------------|---------|
| `ASR_MODEL` | ASR provider | `faster-whisper` |
| `EMBEDDING_MODEL` | Embedding model | `all-MiniLM-L6-v2` |
| `LLM_MODEL` | LLM for summarization | `mistral` |
| `FEATURE_DEEP_SEARCH` | Enable LLM search | `true` |
| `FEATURE_MULTI_PARENT_TOPICS` | Allow multi-parent | `true` |

## Deployment

### Docker Compose

```bash
cd infra
docker-compose up -d
```

Services:
- PostgreSQL with pgvector (port 5432)
- Redis (port 6379)
- MinIO (port 9000/9001)
- Keycloak (port 8080)

### Development

```bash
# Install dependencies
pnpm install

# Start infrastructure
cd infra && docker-compose up -d

# Run database migrations
cd services/api && pnpm db:migrate

# Start services
pnpm dev
```

## Scaling Considerations

### Horizontal Scaling

- **API Service**: Stateless, can be replicated behind load balancer
- **Worker Orchestrator**: Multiple instances with Redis for coordination
- **Pipeline Workers**: Scale based on queue depth

### Resource Requirements

| Service | CPU | Memory | GPU |
|---------|-----|--------|-----|
| API | 0.5 | 512MB | No |
| Worker Orchestrator | 0.5 | 512MB | No |
| Pipeline Worker | 2 | 4GB | Optional |
| Ollama | 2 | 8GB | Recommended |

## Monitoring

- Health check endpoints on all services
- Structured logging with Pino
- Job metrics via BullMQ
- Database metrics via PostgreSQL
