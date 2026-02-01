# Terminology Glossary

## A

### ASR (Automatic Speech Recognition)
Technology that converts spoken language into text. The platform supports multiple ASR providers including Whisper, Faster-Whisper, and whisper.cpp.

### Artifact Manifest
A data structure passed between pipeline steps containing paths to all generated files, metrics, and configuration snapshots.

### Artifact Paths
File system paths within the manifest pointing to generated artifacts like videos, transcripts, topics, embeddings, and exports.

## B

### Bearer Token
An authentication token included in API requests via the `Authorization: Bearer <token>` header.

### BullMQ
A Node.js library for job queues backed by Redis, used for orchestrating pipeline workers.

## C

### Clustering
The process of grouping similar topics together based on their embeddings. Used to identify thematic groups in content.

### Config Snapshot
A saved copy of the pipeline configuration used for a specific job, stored in the artifact manifest for reproducibility.

## D

### Deep Search
An advanced search feature that uses LLM reasoning to answer complex queries across multiple topics.

### Diarization
The process of identifying and separating different speakers in audio. Optional feature for multi-speaker videos.

## E

### Edge
A connection between two topics in the graph. Types include semantic, hierarchy, sequence, and reference edges.

### Edge Type
Classification of relationships between topics:
- **Semantic**: Topics with similar meaning
- **Hierarchy**: Parent-child relationships
- **Sequence**: Time-based adjacency
- **Reference**: Cross-references between topics

### Embedding
A numerical vector representation of text that captures semantic meaning. Used for similarity search and clustering.

### Export
A generated file (PPTX, HTML, or PDF) containing topic graphs and snippets for external use.

## F

### Feature Flag
A configuration toggle that enables or disables specific functionality. All major features are flag-controlled.

### Fork (Graph)
Creating a new graph version based on an existing one, allowing users to make modifications while preserving history.

## G

### Graph Metrics
Quantitative measures of graph structure including node count, edge count, density, and clustering coefficient.

### Graph Version
A specific iteration of a topic graph for a video. Multiple versions can exist with different modifications.

## H

### Hierarchy Level
The depth of a topic in the topic tree. Level 0 represents micro-segments, higher levels represent broader topics.

### HNSW (Hierarchical Navigable Small World)
An algorithm for efficient approximate nearest neighbor search used for vector similarity queries.

## I

### Importance Score
A numerical value (0-1) indicating the significance of a topic, calculated from centrality, duration, and novelty.

## J

### Job
A unit of work processed by the worker orchestrator. Types include video_analysis, export, and snippet_generation.

### Job Queue
A Redis-backed queue that manages pending jobs and distributes them to available workers.

## K

### Keycloak
An open-source identity and access management solution used for OIDC authentication.

### KNN (K-Nearest Neighbors)
An algorithm used to find the most similar topics based on embedding vectors.

## L

### LLM (Large Language Model)
AI models used for topic summarization, deep search, and cross-reference analysis.

## M

### Manifest
See [Artifact Manifest](#artifact-manifest)

### Micro-Segment
The smallest unit of topic segmentation, typically representing a single sentence or short phrase.

### MinIO
An open-source object storage server compatible with Amazon S3 API.

### Multi-Parent Topic
A topic that has multiple parent topics, allowing for non-hierarchical relationships.

## N

### Node
A topic represented as a vertex in the topic graph. Contains metadata like title, summary, and importance score.

## O

### OIDC (OpenID Connect)
An authentication layer on top of OAuth 2.0, used for user authentication.

### OpenAPI
A specification format for describing REST APIs. The platform uses OpenAPI 3.1.

### Overlapping Topics
Topics that share time boundaries, allowing content to belong to multiple topics simultaneously.

## P

### pgvector
A PostgreSQL extension for vector similarity search, used for topic embeddings.

### Pipeline
A sequence of processing steps (video → ASR → topics → graph → snippets) that transforms video into a topic graph.

### Pipeline SDK
A software development kit for creating and customizing pipeline steps.

### Pipeline Step
A single unit of processing in the pipeline, implementing the PipelineStep interface.

## Q

### Quota
A limit on resource usage (videos per month, storage, etc.) enforced per user.

### Quota Policy
A predefined set of quota limits assigned to users (default, premium, unlimited).

## R

### Redis
An in-memory data structure store used for job queues and caching.

### Reference Edge
An edge connecting topics that share keywords or are otherwise related across the graph.

## S

### Semantic Edge
An edge connecting topics with similar semantic meaning, discovered via embedding similarity.

### Semantic Search
Search based on meaning rather than exact keyword matching, using vector similarity.

### Sequence Edge
An edge connecting topics that appear consecutively in time.

### Share
A public access link to a video, graph, or topic with configurable permissions.

### Snippet
A short video clip corresponding to a specific topic, optionally with thumbnail and captions.

### Speaker Diarization
The process of identifying who spoke when in multi-speaker audio.

## T

### Topic
A subject or theme identified in video content, represented as a node in the graph.

### Topic Graph
A network visualization of topics and their relationships, with topics as nodes and relationships as edges.

### Transcript
The text output from ASR processing, including timestamps and optionally word-level alignment.

### Turbo Repo
A monorepo build system used for managing the platform's packages and services.

## U

### User Quota
The current usage and limits for a specific user.

## V

### Vector Search
Searching for similar items using vector embeddings and distance metrics (cosine similarity).

### Video Normalization
Converting video to a standard format (H.264/AAC) for consistent processing.

### VTT (WebVTT)
A format for displaying timed text tracks (captions) with video.

## W

### Word Alignment
Timestamp information for individual words in a transcript.

### Worker
A process that executes pipeline jobs from the queue.

### Worker Orchestrator
The service that manages job distribution and worker coordination.

## Z

### Zod
A TypeScript-first schema validation library used for runtime type checking.

---

## Abbreviations

| Abbreviation | Full Form |
|--------------|-----------|
| API | Application Programming Interface |
| ASR | Automatic Speech Recognition |
| ACL | Access Control List |
| CRUD | Create, Read, Update, Delete |
| CRF | Constant Rate Factor (video quality) |
| CORS | Cross-Origin Resource Sharing |
| CSS | Cascading Style Sheets |
| DB | Database |
| Dockerfile | Container build instructions |
| GPU | Graphics Processing Unit |
| HNSW | Hierarchical Navigable Small World |
| HTML | HyperText Markup Language |
| HTTP | HyperText Transfer Protocol |
| HTTPS | HTTP Secure |
| JWT | JSON Web Token |
| JSON | JavaScript Object Notation |
| KNN | K-Nearest Neighbors |
| LLM | Large Language Model |
| OIDC | OpenID Connect |
| PDF | Portable Document Format |
| PPTX | PowerPoint Open XML Presentation |
| REST | Representational State Transfer |
| S3 | Simple Storage Service |
| SDK | Software Development Kit |
| SQL | Structured Query Language |
| SSL | Secure Sockets Layer |
| SRT | SubRip Subtitle |
| TLS | Transport Layer Security |
| UI | User Interface |
| URL | Uniform Resource Locator |
| UUID | Universally Unique Identifier |
| VAD | Voice Activity Detection |
| VTT | Web Video Text Tracks |
| WAV | Waveform Audio File Format |
| XML | eXtensible Markup Language |
| YAML | YAML Ain't Markup Language |
