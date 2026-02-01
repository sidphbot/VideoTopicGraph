# Video Topic Graph Platform

An open-source platform that ingests video URLs and produces interactive topic graphs describing what happened in the video.

## Features

- **Video Ingestion**: Download and normalize videos from various sources
- **ASR & Diarization**: Speech recognition with optional speaker identification
- **Topic Segmentation**: Hierarchical, overlapping topic detection
- **Semantic Graph**: Topic relationships with multiple edge types
- **Interactive UI**: Web and Android graph explorers
- **Export**: PPTX, HTML (Reveal.js), and PDF story exports
- **Search**: Semantic and deep search capabilities
- **Auth & Sharing**: OIDC-based authentication with sharing and quotas

## Architecture

```
repo/
├── apps/
│   ├── web-ui/          # React-based web interface
│   └── android-ui/      # Flutter Android app
├── packages/
│   ├── shared-types/    # Shared TypeScript schemas
│   ├── pipeline-sdk/    # Pipeline SDK interfaces
│   └── openapi/         # OpenAPI specifications
├── services/
│   ├── api/             # Main API service
│   ├── worker-orchestrator/  # Job queue orchestrator
│   ├── pipeline-video/  # Video processing
│   ├── pipeline-asr/    # Speech recognition
│   ├── pipeline-topics/ # Topic segmentation
│   ├── pipeline-embeddings-graph/  # Embeddings & graph
│   ├── pipeline-snippets/  # Video snippet generation
│   └── pipeline-export/ # Export generation
└── infra/               # Docker compose, configs
```

## Quick Start

```bash
# Start infrastructure services
cd infra && docker-compose up -d

# Install dependencies
pnpm install

# Run database migrations
pnpm db:migrate

# Start services
pnpm dev
```

## Configuration

All services are configured via environment variables. See `infra/.env.example` for all options.

### Model Configuration

The platform supports multiple open-source models:

- **ASR**: Whisper, Faster-Whisper, whisper.cpp
- **Diarization**: pyannote.audio
- **Embeddings**: sentence-transformers, Ollama
- **LLM**: llama.cpp, vLLM, Ollama

Configure via environment variables in `infra/.env`.

## License

MIT License - See LICENSE file for details.
