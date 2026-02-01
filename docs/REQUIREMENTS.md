# Requirements Specification

## Video Topic Graph Platform

## 1. Functional Requirements

### 1.1 Video Ingestion

| ID | Requirement | Priority | Status |
|----|-------------|----------|--------|
| F1.1 | System shall accept video URLs from YouTube | High | Implemented |
| F1.2 | System shall accept video URLs from Vimeo | High | Implemented |
| F1.3 | System shall accept direct video URLs | High | Implemented |
| F1.4 | System shall accept uploaded video files | Medium | Planned |
| F1.5 | System shall validate video format and accessibility | High | Implemented |
| F1.6 | System shall reject videos exceeding quota limits | High | Implemented |

### 1.2 Audio Processing

| ID | Requirement | Priority | Status |
|----|-------------|----------|--------|
| F2.1 | System shall extract audio from video | High | Implemented |
| F2.2 | System shall normalize audio to 16kHz mono WAV | High | Implemented |
| F2.3 | System shall support multiple ASR providers | High | Implemented |
| F2.4 | System shall auto-detect spoken language | High | Implemented |
| F2.5 | System shall optionally perform speaker diarization | Medium | Implemented |
| F2.6 | System shall optionally provide word-level alignment | Medium | Implemented |

### 1.3 Topic Segmentation

| ID | Requirement | Priority | Status |
|----|-------------|----------|--------|
| F3.1 | System shall generate hierarchical topic structure | High | Implemented |
| F3.2 | System shall support configurable hierarchy levels (1-5) | High | Implemented |
| F3.3 | System shall allow overlapping topic boundaries | High | Implemented |
| F3.4 | System shall support multi-parent topics | High | Implemented |
| F3.5 | System shall generate topic titles via LLM | High | Implemented |
| F3.6 | System shall generate topic summaries via LLM | High | Implemented |
| F3.7 | System shall extract keywords per topic | High | Implemented |
| F3.8 | System shall compute topic importance scores | High | Implemented |

### 1.4 Graph Construction

| ID | Requirement | Priority | Status |
|----|-------------|----------|--------|
| F4.1 | System shall generate topic embeddings | High | Implemented |
| F4.2 | System shall create semantic edges via KNN | High | Implemented |
| F4.3 | System shall create hierarchy edges | High | Implemented |
| F4.4 | System shall create sequence edges | High | Implemented |
| F4.5 | System shall create reference edges | Medium | Implemented |
| F4.6 | System shall prune edges based on thresholds | High | Implemented |
| F4.7 | System shall cluster topics | Medium | Implemented |
| F4.8 | System shall compute graph metrics | Medium | Implemented |

### 1.5 Snippet Generation

| ID | Requirement | Priority | Status |
|----|-------------|----------|--------|
| F5.1 | System shall generate video clips per topic | High | Implemented |
| F5.2 | System shall generate thumbnails per snippet | High | Implemented |
| F5.3 | System shall generate caption files (VTT/SRT) | Medium | Implemented |
| F5.4 | System shall support configurable quality levels | High | Implemented |
| F5.5 | System shall add configurable padding around topics | Medium | Implemented |

### 1.6 Export Generation

| ID | Requirement | Priority | Status |
|----|-------------|----------|--------|
| F6.1 | System shall export to PowerPoint (PPTX) | High | Implemented |
| F6.2 | System shall export to HTML (Reveal.js) | High | Implemented |
| F6.3 | System shall export to PDF | High | Implemented |
| F6.4 | System shall support embedded or linked snippets | Medium | Implemented |
| F6.5 | System shall support multiple export templates | Medium | Implemented |

### 1.7 Search

| ID | Requirement | Priority | Status |
|----|-------------|----------|--------|
| F7.1 | System shall support semantic search | High | Implemented |
| F7.2 | System shall support deep search with LLM | High | Implemented |
| F7.3 | System shall filter by topic level | Medium | Implemented |
| F7.4 | System shall filter by importance score | Medium | Implemented |
| F7.5 | System shall return highlighted matches | Medium | Implemented |
| F7.6 | System shall support cross-reference analysis | Low | Implemented |

### 1.8 User Management

| ID | Requirement | Priority | Status |
|----|-------------|----------|--------|
| F8.1 | System shall authenticate via OIDC | High | Implemented |
| F8.2 | System shall enforce quota policies | High | Implemented |
| F8.3 | System shall track usage metrics | High | Implemented |
| F8.4 | System shall support role-based access | High | Implemented |
| F8.5 | System shall allow resource sharing | High | Implemented |
| F8.6 | System shall support share expiration | Medium | Implemented |
| F8.7 | System shall support password-protected shares | Medium | Implemented |

### 1.9 Graph Versioning

| ID | Requirement | Priority | Status |
|----|-------------|----------|--------|
| F9.1 | System shall maintain graph version history | High | Implemented |
| F9.2 | System shall support graph forking | High | Implemented |
| F9.3 | System shall track modifications per version | Medium | Implemented |
| F9.4 | System shall allow version comparison | Low | Planned |

## 2. Non-Functional Requirements

### 2.1 Performance

| ID | Requirement | Target |
|----|-------------|--------|
| NF1.1 | Video processing shall complete within 2x video duration | < 2x |
| NF1.2 | API response time shall be under 500ms (p95) | < 500ms |
| NF1.3 | Search results shall return within 2 seconds | < 2s |
| NF1.4 | Graph visualization shall support 1000+ nodes | > 1000 |
| NF1.5 | System shall handle 100 concurrent users | > 100 |

### 2.2 Scalability

| ID | Requirement | Target |
|----|-------------|--------|
| NF2.1 | API layer shall be horizontally scalable | Yes |
| NF2.2 | Worker layer shall auto-scale based on queue depth | Yes |
| NF2.3 | Database shall support partitioning | Yes |
| NF2.4 | Storage shall support 100TB+ | > 100TB |

### 2.3 Reliability

| ID | Requirement | Target |
|----|-------------|--------|
| NF3.1 | System uptime shall be 99.9% | 99.9% |
| NF3.2 | Failed jobs shall retry 3 times | 3 retries |
| NF3.3 | Data shall be backed up daily | Daily |
| NF3.4 | System shall handle graceful degradation | Yes |

### 2.4 Security

| ID | Requirement | Status |
|----|-------------|--------|
| NF4.1 | All API endpoints shall require authentication | Yes |
| NF4.2 | Tokens shall expire after 1 hour | Yes |
| NF4.3 | Passwords shall be hashed with bcrypt | Yes |
| NF4.4 | Data in transit shall use TLS 1.3 | Yes |
| NF4.5 | Storage URLs shall be time-limited presigned | Yes |

### 2.5 Maintainability

| ID | Requirement | Status |
|----|-------------|--------|
| NF5.1 | Pipeline steps shall be swappable | Yes |
| NF5.2 | Configuration shall be environment-driven | Yes |
| NF5.3 | Code coverage shall be > 80% | Target |
| NF5.4 | Documentation shall be complete | Yes |

## 3. System Constraints

### 3.1 Technical Constraints

- Node.js 20+ runtime
- PostgreSQL 15+ with pgvector extension
- Redis 7+ for job queue
- Docker and Docker Compose for deployment

### 3.2 Business Constraints

- All models must be open-source
- No proprietary API dependencies
- Self-hostable infrastructure

## 4. Use Cases

### UC1: Analyze Video

**Actor**: Authenticated User
**Precondition**: User has quota available

1. User submits video URL
2. System validates URL and quota
3. System creates video record and job
4. Worker processes video through pipeline
5. System notifies user of completion
6. User views generated topic graph

### UC2: Search Topics

**Actor**: Authenticated User
**Precondition**: User has analyzed videos

1. User enters search query
2. System generates query embedding
3. System performs vector similarity search
4. System returns ranked topic results
5. User clicks topic to view details

### UC3: Export Presentation

**Actor**: Authenticated User
**Precondition**: Video analysis complete

1. User selects video and export format
2. System creates export job
3. Worker generates export file
4. System provides download link
5. User downloads export file

### UC4: Share Graph

**Actor**: Authenticated User
**Precondition**: Video analysis complete

1. User creates share link for graph
2. System generates unique token
3. User shares link with others
4. Recipients access graph without login
5. Access is logged and tracked
