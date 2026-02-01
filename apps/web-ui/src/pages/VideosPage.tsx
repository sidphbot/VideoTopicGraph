import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { useKeycloak } from '@react-keycloak/web';
import { api } from '../utils/api';
import './VideosPage.css';

interface Video {
  id: string;
  source_url: string;
  source_type: string;
  status: string;
  duration_s: number | null;
  created_at: string;
}

export default function VideosPage() {
  const { keycloak } = useKeycloak();
  const queryClient = useQueryClient();
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [videoUrl, setVideoUrl] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['videos'],
    queryFn: async () => {
      const response = await api.get('/videos', {
        headers: {
          Authorization: `Bearer ${keycloak.token}`,
        },
      });
      return response.data;
    },
  });

  const analyzeMutation = useMutation({
    mutationFn: async (url: string) => {
      const response = await api.post(
        '/videos/analyze',
        { source_url: url, source_type: 'direct' },
        {
          headers: {
            Authorization: `Bearer ${keycloak.token}`,
          },
        }
      );
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['videos'] });
      setShowUploadModal(false);
      setVideoUrl('');
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (videoUrl.trim()) {
      analyzeMutation.mutate(videoUrl);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'status-success';
      case 'failed':
        return 'status-error';
      case 'processing':
      case 'analyzing':
        return 'status-warning';
      default:
        return 'status-pending';
    }
  };

  return (
    <div className="videos-page">
      <div className="page-header">
        <h1>Videos</h1>
        <button
          className="btn btn-primary"
          onClick={() => setShowUploadModal(true)}
        >
          + Add Video
        </button>
      </div>

      {showUploadModal && (
        <div className="modal-overlay" onClick={() => setShowUploadModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2>Add Video</h2>
            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label htmlFor="videoUrl">Video URL</label>
                <input
                  id="videoUrl"
                  type="url"
                  className="input"
                  placeholder="https://example.com/video.mp4"
                  value={videoUrl}
                  onChange={(e) => setVideoUrl(e.target.value)}
                  required
                />
                <p className="form-hint">
                  Supports YouTube, Vimeo, and direct video URLs
                </p>
              </div>
              <div className="modal-actions">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setShowUploadModal(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={analyzeMutation.isPending}
                >
                  {analyzeMutation.isPending ? 'Processing...' : 'Analyze'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="loading">
          <div className="spinner" />
        </div>
      ) : (
        <div className="videos-grid">
          {data?.items?.length === 0 ? (
            <div className="empty-state">
              <p>No videos yet. Add your first video to get started!</p>
            </div>
          ) : (
            data?.items?.map((video: Video) => (
              <Link
                key={video.id}
                to={`/videos/${video.id}`}
                className="video-card"
              >
                <div className="video-thumbnail">
                  <div className="video-placeholder">📹</div>
                </div>
                <div className="video-info">
                  <h3>{video.source_url}</h3>
                  <div className="video-meta">
                    <span className={`status-badge ${getStatusColor(video.status)}`}>
                      {video.status}
                    </span>
                    {video.duration_s && (
                      <span className="duration">
                        {formatDuration(video.duration_s)}
                      </span>
                    )}
                  </div>
                  <p className="video-date">
                    {new Date(video.created_at).toLocaleDateString()}
                  </p>
                </div>
              </Link>
            ))
          )}
        </div>
      )}
    </div>
  );
}

function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}
