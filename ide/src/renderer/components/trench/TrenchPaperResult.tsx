/**
 * TrenchPaperResult - Component for displaying Trench paper search results
 */

import React from 'react';

export interface PaperResultItem {
  title: string;
  authors: string[];
  year: number;
  url: string;
  abstract?: string;
  venue?: string;
  citations?: number;
}

interface TrenchPaperResultProps {
  results: PaperResultItem[];
  onPaperClick?: (url: string) => void;
}

export const TrenchPaperResult: React.FC<TrenchPaperResultProps> = ({
  results,
  onPaperClick
}) => {
  if (results.length === 0) {
    return (
      <div className="trench-empty-results">
        <p>No papers found</p>
      </div>
    );
  }

  return (
    <div className="trench-paper-results">
      {results.map((paper, index) => (
        <div key={index} className="trench-paper-item">
          <div className="trench-paper-header">
            <span className="trench-paper-number">{index + 1}</span>
            <h4 
              className="trench-paper-title"
              onClick={() => onPaperClick?.(paper.url)}
            >
              {paper.title}
            </h4>
          </div>
          
          <div className="trench-paper-meta">
            <span className="trench-paper-authors">
              {paper.authors.slice(0, 3).join(', ')}
              {paper.authors.length > 3 && ' et al.'}
            </span>
            <span className="trench-paper-year">{paper.year}</span>
            {paper.venue && (
              <span className="trench-paper-venue">{paper.venue}</span>
            )}
            {paper.citations !== undefined && (
              <span className="trench-paper-citations">
                {paper.citations} citations
              </span>
            )}
          </div>
          
          {paper.abstract && (
            <p className="trench-paper-abstract">{paper.abstract}</p>
          )}
          
          <a 
            href={paper.url}
            className="trench-paper-link"
            onClick={(e) => {
              e.preventDefault();
              onPaperClick?.(paper.url);
            }}
          >
            View Paper →
          </a>
        </div>
      ))}
    </div>
  );
};
