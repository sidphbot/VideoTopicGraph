import { Link } from 'react-router-dom';
import './HomePage.css';

export default function HomePage() {
  return (
    <div className="home-page">
      <section className="hero">
        <h1>Video Topic Graph Platform</h1>
        <p>
          Transform your videos into interactive topic graphs. Automatically extract topics,
          generate summaries, and explore content with semantic search.
        </p>
        <div className="hero-actions">
          <Link to="/videos" className="btn btn-primary">
            Browse Videos
          </Link>
          <Link to="/search" className="btn btn-secondary">
            Search Topics
          </Link>
        </div>
      </section>

      <section className="features">
        <h2>Features</h2>
        <div className="grid grid-3">
          <div className="card feature-card">
            <div className="feature-icon">📹</div>
            <h3>Video Analysis</h3>
            <p>
              Upload videos from YouTube, Vimeo, or direct URLs. Our pipeline automatically
              processes audio, transcribes speech, and extracts topics.
            </p>
          </div>
          <div className="card feature-card">
            <div className="feature-icon">🕸️</div>
            <h3>Topic Graphs</h3>
            <p>
              Visualize content as interactive graphs with hierarchical, overlapping topics.
              Navigate through different levels of detail.
            </p>
          </div>
          <div className="card feature-card">
            <div className="feature-icon">🔍</div>
            <h3>Semantic Search</h3>
            <p>
              Search topics by meaning, not just keywords. Use deep search with LLM reasoning
              for complex queries.
            </p>
          </div>
          <div className="card feature-card">
            <div className="feature-icon">✂️</div>
            <h3>Video Snippets</h3>
            <p>
              Automatically generate video clips for each topic. Export snippets with
              thumbnails and captions.
            </p>
          </div>
          <div className="card feature-card">
            <div className="feature-icon">📊</div>
            <h3>Export & Share</h3>
            <p>
              Export topic graphs as PPTX, HTML (Reveal.js), or PDF. Share interactive
              graphs with customizable access controls.
            </p>
          </div>
          <div className="card feature-card">
            <div className="feature-icon">🤖</div>
            <h3>Open Source Models</h3>
            <p>
              All processing uses open-source models: Whisper for ASR, sentence-transformers
              for embeddings, and local LLMs for summarization.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
