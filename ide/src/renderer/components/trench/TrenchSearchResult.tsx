/**
 * TrenchSearchResult - Component for displaying Trench search results
 */

import React from 'react';

export interface SearchResultItem {
  title: string;
  url: string;
  snippet: string;
  source?: string;
  relevance?: number;
}

interface TrenchSearchResultProps {
  results: SearchResultItem[];
  onResultClick?: (url: string) => void;
}

export const TrenchSearchResult: React.FC<TrenchSearchResultProps> = ({
  results,
  onResultClick
}) => {
  if (results.length === 0) {
    return (
      <div className="trench-empty-results">
        <p>No results found</p>
      </div>
    );
  }

  return (
    <div className="trench-search-results">
      {results.map((result, index) => (
        <div key={index} className="trench-result-item">
          <div className="trench-result-header">
            <span className="trench-result-number">{index + 1}</span>
            <h4 
              className="trench-result-title"
              onClick={() => onResultClick?.(result.url)}
            >
              {result.title}
            </h4>
          </div>
          <a 
            href={result.url} 
            className="trench-result-url"
            onClick={(e) => {
              e.preventDefault();
              onResultClick?.(result.url);
            }}
          >
            {result.url}
          </a>
          <p className="trench-result-snippet">{result.snippet}</p>
          {result.source && (
            <span className="trench-result-source">{result.source}</span>
          )}
        </div>
      ))}
    </div>
  );
};
