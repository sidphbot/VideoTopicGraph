# API Documentation

The Video Topic Graph Platform API follows REST principles and is documented using OpenAPI 3.1.

## Base URL

```
http://localhost:3000/api/v1
```

## Authentication

All endpoints require Bearer token authentication via Keycloak.

```
Authorization: Bearer <jwt_token>
```

## Endpoints

### Videos

#### POST /videos/analyze
Submit a video for analysis.

**Request:**
```json
{
  "source_url": "https://youtube.com/watch?v=...",
  "source_type": "youtube",
  "config": {
    "asr_model": "faster-whisper",
    "topic_levels": 3,
    "embedding_model": "all-MiniLM-L6-v2"
  }
}
```

**Response:**
```json
{
  "id": "uuid",
  "source_url": "...",
  "source_type": "youtube",
  "status": "pending",
  "duration_s": null,
  "created_at": "2024-01-01T00:00:00Z",
  "job_id": "uuid"
}
```

#### GET /videos
List user's videos.

**Query Parameters:**
- `page` (integer, default: 1)
- `limit` (integer, default: 20, max: 100)
- `status` (string, optional)

#### GET /videos/{id}
Get video details.

#### GET /videos/{id}/graph
Get topic graph for a video.

**Query Parameters:**
- `version` (uuid, optional)
- `level` (integer, optional)

### Graphs

#### GET /graphs/{id}
Get graph by ID.

#### POST /graphs/{id}/fork
Fork a graph to create a new version.

**Request:**
```json
{
  "notes": "My edited version",
  "topic_modifications": [
    {
      "topic_id": "uuid",
      "action": "update",
      "updates": {
        "title": "New Title"
      }
    }
  ]
}
```

### Topics

#### GET /topics/{id}
Get topic details with snippets.

#### PATCH /topics/{id}
Update topic.

**Request:**
```json
{
  "title": "New Title",
  "summary": "New summary",
  "keywords": ["keyword1", "keyword2"],
  "importance_score": 0.8
}
```

#### POST /topics/merge
Merge multiple topics.

**Request:**
```json
{
  "topic_ids": ["uuid1", "uuid2"],
  "new_title": "Merged Topic"
}
```

#### POST /topics/{id}/split
Split a topic at a timestamp.

**Request:**
```json
{
  "split_at_ts": 120.5,
  "new_titles": ["Part 1", "Part 2"]
}
```

### Search

#### POST /search
Semantic search across topics.

**Request:**
```json
{
  "query": "machine learning applications",
  "video_ids": ["uuid"],
  "filters": {
    "level": 1,
    "min_importance": 0.5
  },
  "options": {
    "include_transcripts": true,
    "top_k": 10
  }
}
```

**Response:**
```json
{
  "query": "...",
  "results": [
    {
      "topic": { ... },
      "score": 0.95,
      "matched_transcript": "...",
      "highlight": "..."
    }
  ],
  "total": 10,
  "took_ms": 150
}
```

#### POST /search/deep
Deep search with LLM reasoning.

**Request:**
```json
{
  "query": "What are the main themes?",
  "context": {
    "include_synthesis": true,
    "include_cross_references": true,
    "max_topics_to_analyze": 20
  }
}
```

**Response:**
```json
{
  "query": "...",
  "answer": "The main themes are...",
  "sources": [ ... ],
  "synthesis": "...",
  "cross_references": [
    {
      "topic_a_id": "uuid",
      "topic_b_id": "uuid",
      "relationship": "Shared keywords: ..."
    }
  ],
  "took_ms": 2500
}
```

### Exports

#### POST /exports
Create an export.

**Request:**
```json
{
  "video_id": "uuid",
  "type": "pptx",
  "options": {
    "include_snippets": true,
    "snippet_embed_mode": "linked",
    "template": "default",
    "include_appendix": true
  }
}
```

#### GET /exports/{id}
Get export status.

#### GET /exports/{id}/download
Download export file.

### Quotas

#### GET /quota
Get user's quota usage.

**Response:**
```json
{
  "policy": {
    "max_videos_per_month": 10,
    "max_storage_gb": 5.0,
    "max_public_links": 20,
    "max_versions_per_video": 5
  },
  "usage": {
    "videos_this_month": 3,
    "storage_gb": 1.2,
    "public_links": 5,
    "versions_total": 8
  },
  "reset_date": "2024-02-01"
}
```

### Shares

#### POST /shares
Create a share link.

**Request:**
```json
{
  "resource_type": "video",
  "resource_id": "uuid",
  "scope": "view",
  "expires_at": "2024-12-31T23:59:59Z",
  "password": "optional-password"
}
```

#### GET /shares/{token}
Access shared resource (public endpoint).

### Jobs

#### GET /jobs/{id}
Get job status.

**Response:**
```json
{
  "id": "uuid",
  "type": "video_analysis",
  "status": "running",
  "progress": 45,
  "current_step": "asr",
  "steps": [
    {
      "name": "video",
      "status": "completed",
      "started_at": "...",
      "completed_at": "..."
    }
  ]
}
```

#### POST /jobs/{id}/cancel
Cancel a running job.

## Error Responses

All errors follow this format:

```json
{
  "code": "ERROR_CODE",
  "message": "Human-readable error message",
  "details": {},
  "request_id": "uuid"
}
```

### Common Error Codes

| Code | Status | Description |
|------|--------|-------------|
| `VALIDATION_ERROR` | 400 | Invalid request data |
| `UNAUTHORIZED` | 401 | Authentication required |
| `FORBIDDEN` | 403 | Insufficient permissions |
| `NOT_FOUND` | 404 | Resource not found |
| `RATE_LIMIT_EXCEEDED` | 429 | Too many requests |
| `QUOTA_EXCEEDED` | 429 | Quota limit reached |
| `INTERNAL_ERROR` | 500 | Server error |

## Rate Limiting

- 100 requests per minute per user
- Headers include rate limit info:
  - `X-RateLimit-Limit`
  - `X-RateLimit-Remaining`
  - `X-RateLimit-Reset`

## OpenAPI Specification

The full OpenAPI specification is available at:
- JSON: `/api/v1/docs/json`
- YAML: `/api/v1/docs/yaml`
- UI: `/docs`
