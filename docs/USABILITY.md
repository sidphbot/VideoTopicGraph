# Usability Guide

## For Technical Users

### Quick Setup

```bash
# 1. Clone repository
git clone <repo-url>
cd video-topic-graph-platform

# 2. Start infrastructure
cd infra && docker-compose up -d

# 3. Install dependencies
pnpm install

# 4. Run migrations
cd services/api && pnpm db:migrate

# 5. Start development
pnpm dev
```

### API Integration

```bash
# Get access token
curl -X POST http://localhost:8080/realms/videograph/protocol/openid-connect/token \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "grant_type=password" \
  -d "client_id=videograph-api" \
  -d "username=user@example.com" \
  -d "password=password"

# Submit video for analysis
curl -X POST http://localhost:3000/api/v1/videos/analyze \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"source_url": "https://youtube.com/watch?v=...", "source_type": "youtube"}'

# Check job status
curl http://localhost:3000/api/v1/jobs/$JOB_ID \
  -H "Authorization: Bearer $TOKEN"

# Get topic graph
curl http://localhost:3000/api/v1/videos/$VIDEO_ID/graph \
  -H "Authorization: Bearer $TOKEN"
```

### Custom Pipeline Step

```typescript
// packages/pipeline-sdk/src/steps/custom-step.ts
import { BasePipelineStep } from '../core';

export class CustomStep extends BasePipelineStep {
  readonly name = 'custom';
  readonly version = '1.0.0';

  getRequiredInputs() {
    return ['transcript'];
  }

  getProducedOutputs() {
    return ['custom_output'];
  }

  async execute(manifest, context) {
    // Your custom logic
    return this.markStepCompleted(updatedManifest, this.name);
  }
}
```

### Model Configuration

Edit `infra/.env`:

```bash
# ASR Model
ASR_MODEL=faster-whisper        # Options: whisper, faster-whisper, whisper-cpp
ASR_MODEL_SIZE=large-v3         # Options: tiny, base, small, medium, large-v1/2/3
ASR_DEVICE=cuda                 # Options: cpu, cuda

# Embedding Model
EMBEDDING_MODEL=all-mpnet-base-v2  # Options: all-MiniLM-L6-v2, all-mpnet-base-v2

# LLM Model
LLM_PROVIDER=ollama             # Options: ollama, llama-cpp, vllm
LLM_MODEL=mixtral               # Options: mistral, mixtral, llama2
```

### Monitoring

```bash
# View API logs
docker-compose logs -f api

# View worker logs
docker-compose logs -f pipeline-worker

# Check queue status
redis-cli LLEN bull:video-analysis:wait

# Database queries
psql -h localhost -U postgres -d videograph
```

## For Non-Technical Users

### Getting Started

1. **Access the Web Application**
   - Open your browser to `http://localhost:3001`
   - Click "Login" and create an account

2. **Add Your First Video**
   - Click the "+ Add Video" button
   - Paste a YouTube URL or direct video link
   - Click "Analyze" and wait for processing

3. **Explore Your Topic Graph**
   - Click on your video to see details
   - Click "View Graph" to see the interactive topic graph
   - Click on topics to see summaries and video clips

4. **Search Your Content**
   - Go to the Search page
   - Type what you're looking for (e.g., "machine learning applications")
   - View matching topics with relevance scores

5. **Create Exports**
   - Go to the Exports page
   - Select your video and preferred format (PowerPoint, HTML, PDF)
   - Download the generated file

6. **Share Your Graph**
   - From your video details, click "Share"
   - Choose access level (view, comment, edit)
   - Copy the share link to send to others

### Understanding Your Topic Graph

**What is a Topic Graph?**

A topic graph is a visual representation of the main subjects discussed in your video. Each circle (node) represents a topic, and lines (edges) show how topics relate to each other.

**Reading the Graph:**

- **Colors**: Different colors represent different hierarchy levels
- **Size**: Larger circles indicate more important topics
- **Lines**: Show relationships between topics
  - Blue = Parent-child relationship
  - Green = Sequential (time-based)
  - Purple = Semantic similarity
  - Orange = Cross-reference

**Interacting with the Graph:**

- **Click a topic** to see its summary and video clip
- **Drag** to pan around
- **Scroll** to zoom in/out
- **Filter by level** to see more or less detail

### Common Tasks

**Finding a Specific Moment**

1. Use the Search page
2. Type keywords from what you remember
3. Click on a matching topic
4. The video clip will show the exact moment

**Creating a Presentation**

1. Go to Exports page
2. Click "Create Export"
3. Select your video
4. Choose PowerPoint format
5. Wait for processing
6. Download and present!

**Sharing with Your Team**

1. Open your video's graph
2. Click the "Share" button
3. Choose "View" access for read-only
4. Set an expiration date if needed
5. Copy and send the link

### Troubleshooting

**Video Won't Process**

- Check that the URL is accessible
- Verify you're under your monthly video quota
- Try a shorter video (under 2 hours)

**Search Returns No Results**

- Try different keywords
- Check that your video has finished processing
- Use broader search terms

**Graph Looks Empty**

- Wait for processing to complete (check status)
- Try a video with more speech content
- Check that audio is clear

**Can't Download Export**

- Wait for export status to show "Complete"
- Try refreshing the page
- Check your internet connection

### Tips for Best Results

**For Video Analysis:**
- Use videos with clear audio
- Avoid heavily edited videos with many cuts
- Educational and presentation videos work best

**For Search:**
- Use natural language questions
- Include context in your search
- Try both specific and broad terms

**For Graphs:**
- Start with Level 0 to see the big picture
- Drill down to higher levels for detail
- Look for connected topics to find related content

### Glossary

| Term | Definition |
|------|------------|
| **Topic** | A subject discussed in the video |
| **Topic Graph** | Visual network showing topics and their relationships |
| **Hierarchy Level** | How detailed a topic is (0 = broad, 4 = specific) |
| **Snippet** | Short video clip for a specific topic |
| **Semantic Search** | Finding content by meaning, not just keywords |
| **Embedding** | Mathematical representation of content meaning |
| **ASR** | Automatic Speech Recognition (transcription) |
| **Diarization** | Identifying different speakers |

### Getting Help

- **Documentation**: Check the docs folder
- **API Reference**: Visit `/docs` when running locally
- **Issues**: Report on GitHub Issues
- **Community**: Join our Discord/Slack
