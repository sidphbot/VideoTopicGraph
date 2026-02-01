import { useRef, useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useKeycloak } from '@react-keycloak/web';
import ForceGraph2D from 'react-force-graph-2d';
import { api } from '../utils/api';
import './GraphViewerPage.css';

interface GraphNode {
  id: string;
  level: number;
  title: string;
  summary: string;
  importance_score: number;
  cluster_id?: string;
}

interface GraphEdge {
  id: string;
  source: string;
  target: string;
  edge_type: string;
  weight: number;
}

interface GraphData {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

export default function GraphViewerPage() {
  const { id } = useParams<{ id: string }>();
  const { keycloak } = useKeycloak();
  const fgRef = useRef<any>(null);
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);
  const [filteredLevel, setFilteredLevel] = useState<number | null>(null);

  const { data: graph, isLoading } = useQuery<GraphData>({
    queryKey: ['graph', id],
    queryFn: async () => {
      const response = await api.get(`/videos/${id}/graph`, {
        headers: {
          Authorization: `Bearer ${keycloak.token}`,
        },
      });
      return {
        nodes: response.data.nodes,
        edges: response.data.edges,
      };
    },
  });

  useEffect(() => {
    if (fgRef.current) {
      fgRef.current.d3Force('charge')?.strength(-300);
      fgRef.current.d3Force('link')?.distance(100);
    }
  }, [graph]);

  if (isLoading) {
    return (
      <div className="loading">
        <div className="spinner" />
      </div>
    );
  }

  if (!graph || graph.nodes.length === 0) {
    return <div>No graph data available</div>;
  }

  // Filter nodes by level if specified
  const filteredNodes = filteredLevel !== null
    ? graph.nodes.filter((n) => n.level === filteredLevel)
    : graph.nodes;

  const filteredNodeIds = new Set(filteredNodes.map((n) => n.id));
  const filteredEdges = graph.edges.filter(
    (e) => filteredNodeIds.has(e.source) && filteredNodeIds.has(e.target)
  );

  // Get unique levels
  const levels = Array.from(new Set(graph.nodes.map((n) => n.level))).sort();

  const graphData = {
    nodes: filteredNodes.map((n) => ({
      ...n,
      val: n.importance_score * 10 + 5,
      color: getNodeColor(n.level),
    })),
    links: filteredEdges.map((e) => ({
      ...e,
      color: getEdgeColor(e.edge_type),
    })),
  };

  return (
    <div className="graph-viewer-page">
      <div className="graph-controls">
        <h1>Topic Graph</h1>
        <div className="level-filter">
          <span>Filter by level:</span>
          <button
            className={`filter-btn ${filteredLevel === null ? 'active' : ''}`}
            onClick={() => setFilteredLevel(null)}
          >
            All
          </button>
          {levels.map((level) => (
            <button
              key={level}
              className={`filter-btn ${filteredLevel === level ? 'active' : ''}`}
              onClick={() => setFilteredLevel(level)}
            >
              Level {level}
            </button>
          ))}
        </div>
      </div>

      <div className="graph-container">
        <ForceGraph2D
          ref={fgRef}
          graphData={graphData}
          nodeLabel={(node: any) => node.title}
          nodeAutoColorBy="cluster_id"
          linkDirectionalArrowLength={6}
          linkDirectionalArrowRelPos={1}
          linkCurvature={0.25}
          onNodeClick={(node: any) => setSelectedNode(node)}
          width={800}
          height={600}
        />

        {selectedNode && (
          <div className="node-panel">
            <div className="node-panel-header">
              <h3>{selectedNode.title}</h3>
              <button
                className="close-btn"
                onClick={() => setSelectedNode(null)}
              >
                ×
              </button>
            </div>
            <div className="node-panel-content">
              <p>{selectedNode.summary}</p>
              <div className="node-meta">
                <span className="badge">Level {selectedNode.level}</span>
                <span className="badge">
                  Importance: {(selectedNode.importance_score * 100).toFixed(0)}%
                </span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function getNodeColor(level: number): string {
  const colors = ['#3b82f6', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981'];
  return colors[level % colors.length];
}

function getEdgeColor(type: string): string {
  switch (type) {
    case 'hierarchy':
      return '#3b82f6';
    case 'sequence':
      return '#10b981';
    case 'semantic':
      return '#8b5cf6';
    case 'reference':
      return '#f59e0b';
    default:
      return '#94a3b8';
  }
}
