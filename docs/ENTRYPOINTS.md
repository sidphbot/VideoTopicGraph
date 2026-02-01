# Entry Points Documentation

## Application Entry Points

### 1. Web UI

**URL**: `http://localhost:3001`

**Routes**:

| Route | Component | Description |
|-------|-----------|-------------|
| `/` | HomePage | Landing page with feature overview |
| `/login` | LoginPage | Keycloak authentication redirect |
| `/videos` | VideosPage | Video gallery and upload |
| `/videos/:id` | VideoDetailPage | Video details and actions |
| `/videos/:id/graph` | GraphViewerPage | Interactive topic graph |
| `/search` | SearchPage | Semantic and deep search |
| `/exports` | ExportsPage | Export management |

**Entry File**: `apps/web-ui/src/main.tsx`

```typescript
// Main entry point
ReactDOM.createRoot(document.getElementById('root')!).render(
  <ReactKeycloakProvider authClient={keycloak}>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </QueryClientProvider>
  </ReactKeycloakProvider>
);
```

### 2. API Service

**URL**: `http://localhost:3000`

**Entry File**: `services/api/src/index.ts`

```typescript
// Server initialization
async function main() {
  const app = await buildServer();
  
  await app.listen({
    port: config.port,
    host: config.host,
  });
  
  app.log.info(`API server running on http://${config.host}:${config.port}`);
}

main();
```

**Routes**:

| Route | Handler | Auth Required |
|-------|---------|---------------|
| `GET /health` | Health check | No |
| `POST /api/v1/videos/analyze` | Submit video | Yes |
| `GET /api/v1/videos` | List videos | Yes |
| `GET /api/v1/videos/:id` | Get video | Yes |
| `GET /api/v1/videos/:id/graph` | Get graph | Yes |
| `GET /api/v1/graphs/:id` | Get graph by ID | Yes |
| `POST /api/v1/graphs/:id/fork` | Fork graph | Yes |
| `GET /api/v1/topics/:id` | Get topic | Yes |
| `PATCH /api/v1/topics/:id` | Update topic | Yes |
| `POST /api/v1/topics/merge` | Merge topics | Yes |
| `POST /api/v1/search` | Semantic search | Yes |
| `POST /api/v1/search/deep` | Deep search | Yes |
| `POST /api/v1/exports` | Create export | Yes |
| `GET /api/v1/quota` | Get quota | Yes |
| `POST /api/v1/shares` | Create share | Yes |
| `GET /api/v1/shares/:token` | Access share | No |
| `GET /api/v1/jobs/:id` | Job status | Yes |

### 3. Worker Orchestrator

**Entry File**: `services/worker-orchestrator/src/index.ts`

```typescript
// Worker initialization
const videoAnalysisWorker = new Worker(
  'video-analysis',
  async (job) => processor.processVideoAnalysis(job.data),
  { connection: redis, concurrency: config.concurrency }
);

const exportWorker = new Worker(
  'export',
  async (job) => processor.processExport(job.data),
  { connection: redis, concurrency: 2 }
);
```

**Queues**:

| Queue | Processor | Concurrency |
|-------|-----------|-------------|
| `video-analysis` | processVideoAnalysis | 2 |
| `export` | processExport | 2 |
| `snippet-generation` | processSnippetGeneration | 2 |

## Docker Compose Entry Points

### Infrastructure Services

```yaml
# Start all infrastructure
docker-compose up -d postgres redis minio keycloak

# Start with application services
docker-compose --profile services up -d

# Start with GPU support
docker-compose --profile services --profile gpu up -d
```

### Service Ports

| Service | Port | Description |
|---------|------|-------------|
| PostgreSQL | 5432 | Database |
| Redis | 6379 | Cache & Queue |
| MinIO API | 9000 | Object Storage |
| MinIO Console | 9001 | Storage UI |
| Keycloak | 8080 | Authentication |
| API | 3000 | REST API |
| Web UI | 3001 | Web Application |
| Ollama | 11434 | LLM Inference |

## Database Entry Points

### Connection

```bash
# Connect to PostgreSQL
psql -h localhost -p 5432 -U postgres -d videograph

# Connect to Redis
redis-cli -h localhost -p 6379
```

### Key Tables

| Table | Purpose |
|-------|---------|
| `videos` | Video metadata |
| `transcript_segments` | ASR output |
| `graph_versions` | Graph version history |
| `topic_nodes` | Topic data with embeddings |
| `topic_edges` | Graph edges |
| `snippets` | Generated video clips |
| `exports` | Export jobs |
| `shares` | Share links |
| `jobs` | Background jobs |
| `quota_policies` | Quota definitions |
| `user_quotas` | User usage tracking |

## Keycloak Entry Points

### Admin Console

**URL**: `http://localhost:8080/admin`

**Default Credentials**:
- Username: `admin`
- Password: `admin`

### Realm Configuration

**Realm**: `videograph`

**Clients**:
- `videograph-api` - Backend API client
- `videograph-web` - Web UI client

### Authentication Endpoints

| Endpoint | URL |
|----------|-----|
| Authorization | `http://localhost:8080/realms/videograph/protocol/openid-connect/auth` |
| Token | `http://localhost:8080/realms/videograph/protocol/openid-connect/token` |
| UserInfo | `http://localhost:8080/realms/videograph/protocol/openid-connect/userinfo` |
| Logout | `http://localhost:8080/realms/videograph/protocol/openid-connect/logout` |
| JWKS | `http://localhost:8080/realms/videograph/protocol/openid-connect/certs` |

## API Client Entry Points

### JavaScript/TypeScript

```typescript
import axios from 'axios';

const api = axios.create({
  baseURL: 'http://localhost:3000/api/v1',
  headers: {
    'Authorization': `Bearer ${token}`
  }
});

// Submit video
const response = await api.post('/videos/analyze', {
  source_url: 'https://youtube.com/watch?v=...',
  source_type: 'youtube'
});
```

### cURL

```bash
# Get videos
curl -H "Authorization: Bearer $TOKEN" \
  http://localhost:3000/api/v1/videos

# Submit video
curl -X POST \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"source_url": "...", "source_type": "youtube"}' \
  http://localhost:3000/api/v1/videos/analyze
```

### Python

```python
import requests

headers = {'Authorization': f'Bearer {token}'}

# Get videos
response = requests.get(
    'http://localhost:3000/api/v1/videos',
    headers=headers
)

# Submit video
response = requests.post(
    'http://localhost:3000/api/v1/videos/analyze',
    headers=headers,
    json={
        'source_url': 'https://youtube.com/watch?v=...',
        'source_type': 'youtube'
    }
)
```

## Package Entry Points

### Pipeline SDK

```typescript
import {
  PipelineOrchestrator,
  createPipelineContext,
  createEmptyManifest,
  stepRegistry,
  BasePipelineStep
} from '@video-graph/pipeline-sdk';
```

### Shared Types

```typescript
import {
  VideoSchema,
  PipelineConfigSchema,
  type Video,
  type PipelineConfig
} from '@video-graph/shared-types';
```

### OpenAPI Types

```typescript
import {
  type VideoResponse,
  type GraphResponse,
  type SearchRequest
} from '@video-graph/openapi';
```

## CLI Entry Points

### pnpm Scripts

```bash
# Root
pnpm dev          # Start all services
pnpm build        # Build all packages
pnpm test         # Run all tests
pnpm typecheck    # Type check all packages
pnpm clean        # Clean build artifacts

# API Service
cd services/api
pnpm dev          # Start API server
pnpm db:migrate   # Run database migrations
pnpm db:generate  # Generate migration files
pnpm db:studio    # Open Drizzle Studio

# Worker Orchestrator
cd services/worker-orchestrator
pnpm dev          # Start worker

# Web UI
cd apps/web-ui
pnpm dev          # Start dev server
pnpm build        # Build for production
pnpm preview      # Preview production build
```

## Testing Entry Points

### Unit Tests

```bash
# Run all tests
pnpm test

# Run with coverage
pnpm test --coverage

# Run specific package
cd packages/pipeline-sdk && pnpm test
```

### Integration Tests

```bash
# Start test environment
docker-compose -f docker-compose.test.yml up -d

# Run integration tests
pnpm test:integration
```

### E2E Tests

```bash
# Start application
pnpm dev

# Run E2E tests
pnpm test:e2e
```

## Monitoring Entry Points

### Health Checks

| Service | Endpoint |
|---------|----------|
| API | `GET /health` |
| PostgreSQL | `pg_isready` |
| Redis | `redis-cli ping` |
| MinIO | `GET /minio/health/live` |
| Keycloak | `GET /health/ready` |

### Logs

```bash
# All services
docker-compose logs -f

# Specific service
docker-compose logs -f api
docker-compose logs -f pipeline-worker
```

### Metrics

| Metric | Source |
|--------|--------|
| Queue Depth | Redis `LLEN bull:video-analysis:wait` |
| Job Duration | BullMQ events |
| API Latency | Fastify logs |
| DB Queries | PostgreSQL logs |
