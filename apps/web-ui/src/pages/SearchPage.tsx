import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useKeycloak } from '@react-keycloak/web';
import { api } from '../utils/api';
import './SearchPage.css';

interface SearchResult {
  topic: {
    id: string;
    title: string;
    summary: string;
    keywords: string[];
    start_ts: number;
    end_ts: number;
  };
  score: number;
  highlight: string | null;
}

export default function SearchPage() {
  const { keycloak } = useKeycloak();
  const [query, setQuery] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [isDeepSearch, setIsDeepSearch] = useState(false);

  const { data: results, isLoading } = useQuery({
    queryKey: ['search', searchQuery, isDeepSearch],
    queryFn: async () => {
      if (!searchQuery) return null;

      const endpoint = isDeepSearch ? '/search/deep' : '/search';
      const response = await api.post(
        endpoint,
        { query: searchQuery },
        {
          headers: {
            Authorization: `Bearer ${keycloak.token}`,
          },
        }
      );
      return response.data;
    },
    enabled: !!searchQuery,
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSearchQuery(query);
  };

  return (
    <div className="search-page">
      <div className="page-header">
        <h1>Search</h1>
        <p>Find topics by semantic similarity</p>
      </div>

      <form onSubmit={handleSubmit} className="search-form">
        <div className="search-input-wrapper">
          <input
            type="text"
            className="input search-input"
            placeholder="Enter your search query..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <button
            type="submit"
            className="btn btn-primary search-btn"
            disabled={isLoading || !query.trim()}
          >
            {isLoading ? 'Searching...' : 'Search'}
          </button>
        </div>
        <label className="deep-search-toggle">
          <input
            type="checkbox"
            checked={isDeepSearch}
            onChange={(e) => setIsDeepSearch(e.target.checked)}
          />
          <span>Deep search (uses LLM reasoning)</span>
        </label>
      </form>

      {results && (
        <div className="search-results">
          {isDeepSearch && results.answer && (
            <div className="deep-search-answer">
              <h3>Answer</h3>
              <p>{results.answer}</p>
            </div>
          )}

          <div className="results-header">
            <span>{results.total} results</span>
            <span className="took">{results.took_ms}ms</span>
          </div>

          <div className="results-list">
            {results.results?.map((result: SearchResult, index: number) => (
              <div key={result.topic.id} className="result-card">
                <div className="result-header">
                  <h3>{result.topic.title}</h3>
                  <span className="result-score">
                    {(result.score * 100).toFixed(1)}% match
                  </span>
                </div>
                <p className="result-summary">{result.topic.summary}</p>
                {result.highlight && (
                  <p className="result-highlight">{result.highlight}</p>
                )}
                <div className="result-meta">
                  <div className="result-keywords">
                    {result.topic.keywords.map((kw) => (
                      <span key={kw} className="keyword-tag">
                        {kw}
                      </span>
                    ))}
                  </div>
                  <span className="result-timestamp">
                    {formatTimestamp(result.topic.start_ts)} -{' '}
                    {formatTimestamp(result.topic.end_ts)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function formatTimestamp(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}
