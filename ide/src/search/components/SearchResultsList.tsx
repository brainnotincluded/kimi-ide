/**
 * Search Results List Component
 * Displays search results with file tree and match previews
 */

import React, { useState, useCallback, useMemo } from 'react';
import { SearchResult, SearchMatch } from '../types';
import './SearchResultsList.css';

export interface SearchResultsListProps {
  /** Search results */
  results: SearchResult[];
  /** Current search query */
  query: string;
  /** Whether search is case sensitive */
  caseSensitive?: boolean;
  /** Whether to highlight matches */
  highlightMatches?: boolean;
  /** Callback when a match is clicked */
  onMatchClick: (file: string, match: SearchMatch) => void;
  /** Callback when a file is clicked */
  onFileClick?: (file: string) => void;
  /** Callback to collapse/expand file */
  onToggleFile?: (file: string) => void;
  /** Set of collapsed files */
  collapsedFiles?: Set<string>;
  /** Additional CSS class */
  className?: string;
}

export const SearchResultsList: React.FC<SearchResultsListProps> = ({
  results,
  query,
  caseSensitive = false,
  highlightMatches = true,
  onMatchClick,
  onFileClick,
  onToggleFile,
  collapsedFiles = new Set(),
  className = '',
}) => {
  const [selectedMatch, setSelectedMatch] = useState<{ file: string; line: number } | null>(null);

  const handleMatchClick = useCallback((file: string, match: SearchMatch) => {
    setSelectedMatch({ file, line: match.line });
    onMatchClick(file, match);
  }, [onMatchClick]);

  const handleFileClick = useCallback((file: string) => {
    onFileClick?.(file);
    onToggleFile?.(file);
  }, [onFileClick, onToggleFile]);

  // Group results by directory for tree view
  const groupedResults = useMemo(() => {
    const groups = new Map<string, SearchResult[]>();
    
    for (const result of results) {
      const dir = result.relativePath.includes('/') 
        ? result.relativePath.substring(0, result.relativePath.lastIndexOf('/'))
        : '';
      
      if (!groups.has(dir)) {
        groups.set(dir, []);
      }
      groups.get(dir)!.push(result);
    }
    
    return Array.from(groups.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [results]);

  if (results.length === 0) {
    return (
      <div className={`search-results-list empty ${className}`}>
        <div className="search-results-empty">
          <svg width="48" height="48" viewBox="0 0 16 16" fill="currentColor" opacity="0.4">
            <path d="M11.7422 10.3439C12.5329 9.2673 13 7.9382 13 6.5C13 2.91015 10.0899 0 6.5 0C2.91015 0 0 2.91015 0 6.5C0 10.0899 2.91015 13 6.5 13C7.9382 13 9.2673 12.5329 10.3439 11.7422L14.1464 15.1464L15 14.2929L11.7422 10.3439ZM6.5 11.5C3.73858 11.5 1.5 9.26142 1.5 6.5C1.5 3.73858 3.73858 1.5 6.5 1.5C9.26142 1.5 11.5 3.73858 11.5 6.5C11.5 9.26142 9.26142 11.5 6.5 11.5Z"/>
          </svg>
          <p>No results found</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`search-results-list ${className}`}>
      {groupedResults.map(([directory, dirResults]) => (
        <div key={directory} className="search-results-directory">
          {directory && (
            <div className="search-results-dir-header">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                <path d="M14.5 3H7.71l-.85-.85L6.29 2H1.5l-.5.5v10l.5.5h13l.5-.5v-9l-.5-.5zM14.5 12.5h-13v-10h4.29l.85.85.35.35h7.51v8.8z"/>
              </svg>
              <span>{directory || 'Root'}</span>
            </div>
          )}
          
          {dirResults.map((result) => (
            <SearchResultItem
              key={result.file}
              result={result}
              query={query}
              caseSensitive={caseSensitive}
              highlightMatches={highlightMatches}
              isCollapsed={collapsedFiles.has(result.file)}
              selectedMatch={selectedMatch}
              onMatchClick={handleMatchClick}
              onFileClick={handleFileClick}
              onToggle={() => onToggleFile?.(result.file)}
            />
          ))}
        </div>
      ))}
    </div>
  );
};

// Individual search result item
interface SearchResultItemProps {
  result: SearchResult;
  query: string;
  caseSensitive: boolean;
  highlightMatches: boolean;
  isCollapsed: boolean;
  selectedMatch: { file: string; line: number } | null;
  onMatchClick: (file: string, match: SearchMatch) => void;
  onFileClick: (file: string) => void;
  onToggle: () => void;
}

const SearchResultItem: React.FC<SearchResultItemProps> = ({
  result,
  query,
  caseSensitive,
  highlightMatches,
  isCollapsed,
  selectedMatch,
  onMatchClick,
  onFileClick,
  onToggle,
}) => {
  const fileName = result.relativePath.split('/').pop() || result.relativePath;
  
  const getFileIcon = (fileName: string): string => {
    if (fileName.endsWith('.ts') || fileName.endsWith('.tsx')) return 'typescript';
    if (fileName.endsWith('.js') || fileName.endsWith('.jsx')) return 'javascript';
    if (fileName.endsWith('.json')) return 'json';
    if (fileName.endsWith('.css') || fileName.endsWith('.scss')) return 'css';
    if (fileName.endsWith('.html')) return 'html';
    if (fileName.endsWith('.md')) return 'markdown';
    if (fileName.endsWith('.py')) return 'python';
    if (fileName.endsWith('.java')) return 'java';
    if (fileName.endsWith('.go')) return 'go';
    if (fileName.endsWith('.rs')) return 'rust';
    return 'file';
  };

  const fileIcon = getFileIcon(fileName);

  return (
    <div className="search-result-item">
      {/* File Header */}
      <div 
        className="search-result-file-header"
        onClick={onToggle}
        onDoubleClick={() => onFileClick(result.file)}
      >
        <span className={`search-result-chevron ${isCollapsed ? 'collapsed' : ''}`}>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
            <path d="M6 4l4 4-4 4V4z"/>
          </svg>
        </span>
        
        <span className={`search-result-file-icon ${fileIcon}`}>
          <FileIcon type={fileIcon} />
        </span>
        
        <span className="search-result-file-name">{fileName}</span>
        
        <span className="search-result-match-count">
          {result.matchCount} match{result.matchCount !== 1 ? 'es' : ''}
        </span>
      </div>

      {/* Match List */}
      {!isCollapsed && (
        <div className="search-result-matches">
          {result.matches.map((match, index) => (
            <SearchMatchItem
              key={`${match.line}-${match.column}-${index}`}
              match={match}
              query={query}
              caseSensitive={caseSensitive}
              highlightMatches={highlightMatches}
              isSelected={selectedMatch?.file === result.file && selectedMatch?.line === match.line}
              onClick={() => onMatchClick(result.file, match)}
            />
          ))}
        </div>
      )}
    </div>
  );
};

// Individual match item
interface SearchMatchItemProps {
  match: SearchMatch;
  query: string;
  caseSensitive: boolean;
  highlightMatches: boolean;
  isSelected: boolean;
  onClick: () => void;
}

const SearchMatchItem: React.FC<SearchMatchItemProps> = ({
  match,
  query,
  caseSensitive,
  highlightMatches,
  isSelected,
  onClick,
}) => {
  const renderHighlightedText = () => {
    if (!highlightMatches || !query) {
      return (
        <>
          <span className="match-before">{match.preview.before}</span>
          <span className="match-text">{match.preview.match}</span>
          <span className="match-after">{match.preview.after}</span>
        </>
      );
    }

    // Simple highlight - escape regex for non-regex mode
    const escapedQuery = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const flags = caseSensitive ? 'g' : 'gi';
    
    try {
      const regex = new RegExp(`(${escapedQuery})`, flags);
      const parts = match.text.split(regex);
      
      return parts.map((part, i) => {
        const isMatch = regex.test(part);
        regex.lastIndex = 0; // Reset regex
        
        if (isMatch) {
          return <mark key={i} className="match-highlight">{part}</mark>;
        }
        return <span key={i}>{part}</span>;
      });
    } catch {
      return (
        <>
          <span className="match-before">{match.preview.before}</span>
          <span className="match-text">{match.preview.match}</span>
          <span className="match-after">{match.preview.after}</span>
        </>
      );
    }
  };

  return (
    <div 
      className={`search-match-item ${isSelected ? 'selected' : ''}`}
      onClick={onClick}
    >
      <span className="search-match-line">{match.line}</span>
      <span className="search-match-text" title={match.text}>
        {renderHighlightedText()}
      </span>
    </div>
  );
};

// File icon component
const FileIcon: React.FC<{ type: string }> = ({ type }) => {
  const icons: Record<string, JSX.Element> = {
    typescript: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="#3178c6">
        <path d="M1 2.5A2.5 2.5 0 013.5 0h9A2.5 2.5 0 0115 2.5v11a2.5 2.5 0 01-2.5 2.5h-9A2.5 2.5 0 011 13.5v-11zM3.5 1A1.5 1.5 0 002 2.5v11A1.5 1.5 0 003.5 15h9a1.5 1.5 0 001.5-1.5v-11A1.5 1.5 0 0012.5 1h-9zM8 7h2v1H8v-1zm-3 3h5v1H5v-1zm0-6h5v1H5V4z"/>
      </svg>
    ),
    javascript: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="#f1e05a">
        <path d="M1 2.5A2.5 2.5 0 013.5 0h9A2.5 2.5 0 0115 2.5v11a2.5 2.5 0 01-2.5 2.5h-9A2.5 2.5 0 011 13.5v-11zM3.5 1A1.5 1.5 0 002 2.5v11A1.5 1.5 0 003.5 15h9a1.5 1.5 0 001.5-1.5v-11A1.5 1.5 0 0012.5 1h-9zM8 7h2v1H8v-1zm-3 3h5v1H5v-1zm0-6h5v1H5V4z"/>
      </svg>
    ),
    json: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="#6cf">
        <path d="M1 2.5A2.5 2.5 0 013.5 0h9A2.5 2.5 0 0115 2.5v11a2.5 2.5 0 01-2.5 2.5h-9A2.5 2.5 0 011 13.5v-11zM3.5 1A1.5 1.5 0 002 2.5v11A1.5 1.5 0 003.5 15h9a1.5 1.5 0 001.5-1.5v-11A1.5 1.5 0 0012.5 1h-9z"/>
      </svg>
    ),
    css: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="#563d7c">
        <path d="M1 2.5A2.5 2.5 0 013.5 0h9A2.5 2.5 0 0115 2.5v11a2.5 2.5 0 01-2.5 2.5h-9A2.5 2.5 0 011 13.5v-11zM3.5 1A1.5 1.5 0 002 2.5v11A1.5 1.5 0 003.5 15h9a1.5 1.5 0 001.5-1.5v-11A1.5 1.5 0 0012.5 1h-9z"/>
      </svg>
    ),
    html: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="#e34c26">
        <path d="M1 2.5A2.5 2.5 0 013.5 0h9A2.5 2.5 0 0115 2.5v11a2.5 2.5 0 01-2.5 2.5h-9A2.5 2.5 0 011 13.5v-11zM3.5 1A1.5 1.5 0 002 2.5v11A1.5 1.5 0 003.5 15h9a1.5 1.5 0 001.5-1.5v-11A1.5 1.5 0 0012.5 1h-9z"/>
      </svg>
    ),
    markdown: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="#083fa1">
        <path d="M1 2.5A2.5 2.5 0 013.5 0h9A2.5 2.5 0 0115 2.5v11a2.5 2.5 0 01-2.5 2.5h-9A2.5 2.5 0 011 13.5v-11zM3.5 1A1.5 1.5 0 002 2.5v11A1.5 1.5 0 003.5 15h9a1.5 1.5 0 001.5-1.5v-11A1.5 1.5 0 0012.5 1h-9z"/>
      </svg>
    ),
    python: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="#3572A5">
        <path d="M1 2.5A2.5 2.5 0 013.5 0h9A2.5 2.5 0 0115 2.5v11a2.5 2.5 0 01-2.5 2.5h-9A2.5 2.5 0 011 13.5v-11zM3.5 1A1.5 1.5 0 002 2.5v11A1.5 1.5 0 003.5 15h9a1.5 1.5 0 001.5-1.5v-11A1.5 1.5 0 0012.5 1h-9z"/>
      </svg>
    ),
    default: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
        <path d="M10.5 0h-8A2.5 2.5 0 000 2.5v11A2.5 2.5 0 002.5 16h11a2.5 2.5 0 002.5-2.5v-9l-5.5-4.5zM14 13.5a1.5 1.5 0 01-1.5 1.5h-11A1.5 1.5 0 010 13.5v-11A1.5 1.5 0 011.5 1H9v4.5A1.5 1.5 0 0010.5 7H15v6.5z"/>
      </svg>
    ),
  };

  return icons[type] || icons.default;
};

export default SearchResultsList;
