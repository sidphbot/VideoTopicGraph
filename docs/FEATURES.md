# Features Documentation

## Core Features

### 1. Video Ingestion

| Feature | Description | Status |
|---------|-------------|--------|
| YouTube Support | Process videos from YouTube URLs | ✅ |
| Vimeo Support | Process videos from Vimeo URLs | ✅ |
| Direct URL Support | Process videos from direct URLs | ✅ |
| File Upload | Upload video files directly | 🚧 |
| URL Validation | Validate video accessibility before processing | ✅ |
| Format Detection | Auto-detect video format and codec | ✅ |
| Duration Limits | Enforce maximum video duration per quota | ✅ |

### 2. Audio Processing

| Feature | Description | Status |
|---------|-------------|--------|
| Audio Extraction | Extract audio track from video | ✅ |
| Audio Normalization | Convert to 16kHz mono WAV | ✅ |
| Multiple ASR Providers | Support Whisper, Faster-Whisper, whisper.cpp | ✅ |
| Language Detection | Auto-detect spoken language | ✅ |
| Speaker Diarization | Identify different speakers (optional) | ✅ |
| Word Alignment | Timestamp individual words (optional) | ✅ |
| VAD Filtering | Filter non-speech segments | ✅ |

### 3. Topic Segmentation

| Feature | Description | Status |
|---------|-------------|--------|
| Hierarchical Topics | Generate multi-level topic structure | ✅ |
| Configurable Levels | Support 1-5 hierarchy levels | ✅ |
| Overlapping Topics | Allow topics to overlap in time | ✅ |
| Multi-Parent Topics | Support non-hierarchical relationships | ✅ |
| LLM Title Generation | Generate topic titles via LLM | ✅ |
| LLM Summary Generation | Generate topic summaries via LLM | ✅ |
| Keyword Extraction | Extract relevant keywords per topic | ✅ |
| Importance Scoring | Calculate topic importance (centrality, duration, novelty) | ✅ |
| Pause Detection | Detect boundaries using pauses | ✅ |
| Embedding Similarity | Detect boundaries using semantic similarity | ✅ |

### 4. Graph Construction

| Feature | Description | Status |
|---------|-------------|--------|
| Topic Embeddings | Generate vector embeddings for topics | ✅ |
| Semantic Edges | Connect similar topics via KNN | ✅ |
| Hierarchy Edges | Connect parent-child topics | ✅ |
| Sequence Edges | Connect consecutive topics | ✅ |
| Reference Edges | Connect cross-referenced topics | ✅ |
| Edge Pruning | Remove redundant edges | ✅ |
| Topic Clustering | Group similar topics | ✅ |
| Graph Metrics | Compute density, clustering, components | ✅ |
| HNSW Index | Fast approximate nearest neighbor search | ✅ |

### 5. Snippet Generation

| Feature | Description | Status |
|---------|-------------|--------|
| Video Clips | Generate MP4/WebM clips per topic | ✅ |
| Thumbnails | Generate JPG/PNG thumbnails | ✅ |
| Captions (VTT) | Generate WebVTT caption files | ✅ |
| Captions (SRT) | Generate SRT subtitle files | ✅ |
| Quality Levels | Low/Medium/High quality presets | ✅ |
| Configurable Padding | Add padding around topic boundaries | ✅ |
| Duration Limits | Enforce min/max snippet duration | ✅ |

### 6. Export Generation

| Feature | Description | Status |
|---------|-------------|--------|
| PowerPoint Export | Generate PPTX presentations | ✅ |
| HTML Export | Generate Reveal.js presentations | ✅ |
| PDF Export | Generate PDF summaries | ✅ |
| Embedded Snippets | Include video in exports | ✅ |
| Linked Snippets | Link to external video | ✅ |
| Export Templates | Default/Minimal/Detailed templates | ✅ |
| Topic Level Filter | Export specific hierarchy levels | ✅ |
| Appendix Generation | Include graph metrics appendix | ✅ |

### 7. Search

| Feature | Description | Status |
|---------|-------------|--------|
| Semantic Search | Search by meaning, not keywords | ✅ |
| Deep Search | LLM-powered reasoning search | ✅ |
| Level Filtering | Filter by topic hierarchy level | ✅ |
| Importance Filtering | Filter by importance score | ✅ |
| Date Filtering | Filter by creation date | ✅ |
| Highlighting | Show matched content | ✅ |
| Cross-References | Find related topics | ✅ |
| Synthesis | Generate synthesized answers | ✅ |

### 8. User Management

| Feature | Description | Status |
|---------|-------------|--------|
| OIDC Authentication | Login via Keycloak | ✅ |
| JWT Tokens | Stateless authentication | ✅ |
| Role-Based Access | Owner/Editor/Viewer roles | ✅ |
| Resource ACLs | Fine-grained access control | ✅ |
| Quota Enforcement | Enforce usage limits | ✅ |
| Usage Tracking | Track videos, storage, links | ✅ |
| Monthly Reset | Reset quotas monthly | ✅ |

### 9. Sharing

| Feature | Description | Status |
|---------|-------------|--------|
| Share Links | Generate unique share tokens | ✅ |
| View Access | Read-only access | ✅ |
| Comment Access | Comment on shared resources | 🚧 |
| Edit Access | Allow modifications | 🚧 |
| Expiration Dates | Set share expiration | ✅ |
| Password Protection | Protect with password | ✅ |
| Access Logging | Track share access | ✅ |

### 10. Graph Versioning

| Feature | Description | Status |
|---------|-------------|--------|
| Version History | Maintain all graph versions | ✅ |
| Graph Forking | Create new versions from existing | ✅ |
| Modification Tracking | Track what changed | ✅ |
| Version Comparison | Compare two versions | 🚧 |
| Rollback | Revert to previous version | 🚧 |

### 11. Web UI

| Feature | Description | Status |
|---------|-------------|--------|
| Video Upload | Submit videos via URL | ✅ |
| Video Gallery | Browse and manage videos | ✅ |
| Interactive Graph | Visualize topic graphs | ✅ |
| Graph Filtering | Filter by level | ✅ |
| Node Details | View topic summaries | ✅ |
| Search Interface | Semantic and deep search | ✅ |
| Export UI | Create and download exports | ✅ |
| Share UI | Create and manage shares | ✅ |
| Responsive Design | Mobile-friendly | ✅ |
| Dark Mode | Dark theme support | 🚧 |

### 12. API

| Feature | Description | Status |
|---------|-------------|--------|
| REST API | Full RESTful API | ✅ |
| OpenAPI Spec | Complete API documentation | ✅ |
| Swagger UI | Interactive API explorer | ✅ |
| Rate Limiting | Request throttling | ✅ |
| Request Validation | Input validation | ✅ |
| Error Handling | Structured error responses | ✅ |
| Pagination | Paginated list responses | ✅ |
| Filtering | Query parameter filters | ✅ |

## Feature Flags

All major features can be enabled/disabled via environment variables:

```bash
# Processing Features
FEATURE_SCENE_DETECTION=false
FEATURE_DIARIZATION=false
FEATURE_WORD_ALIGNMENT=false
FEATURE_VISUAL_TOPICS=false
FEATURE_OCR=false

# Advanced Features
FEATURE_MULTI_VIDEO_GRAPHS=false
FEATURE_EAGER_SNIPPET_GENERATION=true
FEATURE_DEEP_SEARCH=true
FEATURE_EXPORT_EMBEDDING=false

# UI Features
FEATURE_REALTIME_UPDATES=true
FEATURE_GRAPH_VERSIONING=true
FEATURE_SHARE_EXPIRATION=true
FEATURE_QUOTA_ENFORCEMENT=true
FEATURE_MULTI_PARENT_TOPICS=true
```

## Model Support Matrix

### ASR Models

| Model | Provider | Languages | Speed | Accuracy |
|-------|----------|-----------|-------|----------|
| Whisper | OpenAI | 99 | Slow | High |
| Faster-Whisper | SYSTRAN | 99 | Fast | High |
| whisper.cpp | ggerganov | 99 | Very Fast | Medium |

### Embedding Models

| Model | Dimension | Speed | Quality |
|-------|-----------|-------|---------|
| all-MiniLM-L6-v2 | 384 | Fast | Good |
| all-mpnet-base-v2 | 768 | Medium | Better |
| nomic-embed-text | 768 | Medium | Best |

### LLM Models

| Model | Provider | Context | Speed | Quality |
|-------|----------|---------|-------|---------|
| mistral | Ollama | 32K | Fast | Good |
| mixtral | Ollama | 32K | Medium | Better |
| llama2 | Ollama | 4K | Fast | Good |
| phi | Ollama | 2K | Very Fast | Medium |

## Quota Tiers

| Feature | Default | Premium | Unlimited |
|---------|---------|---------|-----------|
| Videos/Month | 10 | 100 | Unlimited |
| Storage | 5 GB | 50 GB | Unlimited |
| Public Links | 20 | 100 | Unlimited |
| Versions/Video | 5 | 20 | Unlimited |
| Max Duration | 2 hours | 5 hours | Unlimited |
| Models | Basic | All | All |

## Roadmap

### Q1 2024
- [x] Core pipeline implementation
- [x] Web UI with graph visualization
- [x] Semantic search
- [x] Export generation

### Q2 2024
- [ ] Android mobile app
- [ ] Real-time collaboration
- [ ] Advanced graph analytics
- [ ] Plugin system for custom steps

### Q3 2024
- [ ] Multi-video super graphs
- [ ] Visual topic analysis
- [ ] OCR for on-screen text
- [ ] Automated chapter generation

### Q4 2024
- [ ] AI-powered video recommendations
- [ ] Integration with learning management systems
- [ ] Enterprise SSO support
- [ ] Advanced security features
