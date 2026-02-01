import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useKeycloak } from '@react-keycloak/web';
import { api } from '../utils/api';
import './VideoDetailPage.css';

export default function VideoDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { keycloak } = useKeycloak();

  const { data: video, isLoading } = useQuery({
    queryKey: ['video', id],
    queryFn: async () => {
      const response = await api.get(`/videos/${id}`, {
        headers: {
          Authorization: `Bearer ${keycloak.token}`,
        },
      });
      return response.data;
    },
  });

  if (isLoading) {
    return (
      <div className="loading">
        <div className="spinner" />
      </div>
    );
  }

  if (!video) {
    return <div>Video not found</div>;
  }

  return (
    <div className="video-detail-page">
      <div className="page-header">
        <div>
          <h1>Video Details</h1>
          <p className="video-url">{video.source_url}</p>
        </div>
        <div className="header-actions">
          <Link to={`/videos/${id}/graph`} className="btn btn-primary">
            View Graph
          </Link>
        </div>
      </div>

      <div className="video-stats">
        <div className="stat-card">
          <span className="stat-value">{video.topics_count || 0}</span>
          <span className="stat-label">Topics</span>
        </div>
        <div className="stat-card">
          <span className="stat-value">{video.versions_count || 0}</span>
          <span className="stat-label">Versions</span>
        </div>
        <div className="stat-card">
          <span className="stat-value">{video.transcript_segments_count || 0}</span>
          <span className="stat-label">Transcript Segments</span>
        </div>
        <div className="stat-card">
          <span className="stat-value capitalize">{video.status}</span>
          <span className="stat-label">Status</span>
        </div>
      </div>

      <div className="video-info-grid">
        <div className="card">
          <h3>Information</h3>
          <dl className="info-list">
            <dt>Source Type</dt>
            <dd>{video.source_type}</dd>
            <dt>Duration</dt>
            <dd>{video.duration_s ? formatDuration(video.duration_s) : 'N/A'}</dd>
            <dt>Created</dt>
            <dd>{new Date(video.created_at).toLocaleString()}</dd>
            <dt>Graph Version</dt>
            <dd>{video.graph?.version || 'N/A'}</dd>
          </dl>
        </div>

        <div className="card">
          <h3>Actions</h3>
          <div className="action-list">
            <Link to={`/videos/${id}/graph`} className="action-item">
              <span className="action-icon">🕸️</span>
              <span className="action-text">View Topic Graph</span>
            </Link>
            <Link to={`/search?video_id=${id}`} className="action-item">
              <span className="action-icon">🔍</span>
              <span className="action-text">Search Topics</span>
            </Link>
            <button className="action-item">
              <span className="action-icon">📊</span>
              <span className="action-text">Create Export</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function formatDuration(seconds: number): string {
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  if (hrs > 0) {
    return `${hrs}h ${mins}m ${secs}s`;
  }
  return `${mins}m ${secs}s`;
}
