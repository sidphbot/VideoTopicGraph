import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useKeycloak } from '@react-keycloak/web';
import { api } from '../utils/api';
import './ExportsPage.css';

interface Export {
  id: string;
  video_id: string;
  type: 'pptx' | 'html' | 'pdf';
  status: 'pending' | 'processing' | 'complete' | 'error';
  download_url: string | null;
  created_at: string;
  completed_at: string | null;
}

export default function ExportsPage() {
  const { keycloak } = useKeycloak();
  const queryClient = useQueryClient();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedVideo, setSelectedVideo] = useState('');
  const [exportType, setExportType] = useState<'pptx' | 'html' | 'pdf'>('pptx');

  const { data: exports, isLoading } = useQuery({
    queryKey: ['exports'],
    queryFn: async () => {
      // This would be a real endpoint in production
      return [] as Export[];
    },
  });

  const { data: videos } = useQuery({
    queryKey: ['videos'],
    queryFn: async () => {
      const response = await api.get('/videos', {
        headers: {
          Authorization: `Bearer ${keycloak.token}`,
        },
      });
      return response.data.items;
    },
  });

  const createExportMutation = useMutation({
    mutationFn: async (data: { video_id: string; type: string }) => {
      const response = await api.post('/exports', data, {
        headers: {
          Authorization: `Bearer ${keycloak.token}`,
        },
      });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['exports'] });
      setShowCreateModal(false);
      setSelectedVideo('');
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedVideo) {
      createExportMutation.mutate({
        video_id: selectedVideo,
        type: exportType,
      });
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'complete':
        return '✅';
      case 'error':
        return '❌';
      case 'processing':
        return '⏳';
      default:
        return '⏸️';
    }
  };

  return (
    <div className="exports-page">
      <div className="page-header">
        <h1>Exports</h1>
        <button
          className="btn btn-primary"
          onClick={() => setShowCreateModal(true)}
        >
          + Create Export
        </button>
      </div>

      {showCreateModal && (
        <div className="modal-overlay" onClick={() => setShowCreateModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2>Create Export</h2>
            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label htmlFor="video">Video</label>
                <select
                  id="video"
                  className="input"
                  value={selectedVideo}
                  onChange={(e) => setSelectedVideo(e.target.value)}
                  required
                >
                  <option value="">Select a video</option>
                  {videos?.map((video: { id: string; source_url: string }) => (
                    <option key={video.id} value={video.id}>
                      {video.source_url}
                    </option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label htmlFor="type">Export Type</label>
                <select
                  id="type"
                  className="input"
                  value={exportType}
                  onChange={(e) => setExportType(e.target.value as 'pptx' | 'html' | 'pdf')}
                >
                  <option value="pptx">PowerPoint (PPTX)</option>
                  <option value="html">HTML Presentation</option>
                  <option value="pdf">PDF Summary</option>
                </select>
              </div>
              <div className="modal-actions">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setShowCreateModal(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={createExportMutation.isPending}
                >
                  {createExportMutation.isPending ? 'Creating...' : 'Create'}
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
        <div className="exports-list">
          {!exports || exports.length === 0 ? (
            <div className="empty-state">
              <p>No exports yet. Create your first export!</p>
            </div>
          ) : (
            exports.map((exportItem: Export) => (
              <div key={exportItem.id} className="export-card">
                <div className="export-icon">{getFileIcon(exportItem.type)}</div>
                <div className="export-info">
                  <h3>{exportItem.type.toUpperCase()} Export</h3>
                  <p className="export-meta">
                    Created {new Date(exportItem.created_at).toLocaleString()}
                  </p>
                </div>
                <div className="export-status">
                  <span className="status-icon">
                    {getStatusIcon(exportItem.status)}
                  </span>
                  <span className="status-text capitalize">{exportItem.status}</span>
                </div>
                {exportItem.status === 'complete' && exportItem.download_url && (
                  <a
                    href={exportItem.download_url}
                    className="btn btn-primary"
                    download
                  >
                    Download
                  </a>
                )}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}

function getFileIcon(type: string): string {
  switch (type) {
    case 'pptx':
      return '📊';
    case 'html':
      return '🌐';
    case 'pdf':
      return '📄';
    default:
      return '📁';
  }
}
