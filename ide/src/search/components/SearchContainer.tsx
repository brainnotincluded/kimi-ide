/**
 * Search Container Component
 * Complete search UI with panel, replace box, and results
 */

import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { SearchPanel } from './SearchPanel';
import { ReplaceBox } from './ReplaceBox';
import { SearchResultsList } from './SearchResultsList';
import { SearchOptions, SearchResult, SearchMatch } from '../types';
import './SearchContainer.css';

export interface SearchContainerProps {
  /** Search results */
  results: SearchResult[];
  /** Current search state */
  query: string;
  options: SearchOptions;
  isSearching: boolean;
  /** Optional stats */
  filesSearched?: number;
  totalMatches?: number;
  searchDuration?: number;
  /** Event handlers */
  onSearch: (query: string, options?: Partial<SearchOptions>) => void;
  onCancel: () => void;
  onClear: () => void;
  onReplace: (replacement: string, preserveCase?: boolean) => void;
  onResultClick: (file: string, match: SearchMatch) => void;
  onOptionsChange: (options: Partial<SearchOptions>) => void;
  /** Optional callbacks */
  onResultHover?: (file: string, match: SearchMatch) => void;
  /** Additional CSS class */
  className?: string;
  /** Placeholder text */
  placeholder?: string;
}

export const SearchContainer: React.FC<SearchContainerProps> = ({
  results,
  query,
  options,
  isSearching,
  filesSearched,
  totalMatches,
  searchDuration,
  onSearch,
  onCancel,
  onClear,
  onReplace,
  onResultClick,
  onOptionsChange,
  onResultHover,
  className = '',
  placeholder = 'Search',
}) => {
  const [showReplace, setShowReplace] = useState(false);
  const [replacement, setReplacement] = useState('');
  const [preserveCase, setPreserveCase] = useState(false);
  const [isReplacing, setIsReplacing] = useState(false);
  const [collapsedFiles, setCollapsedFiles] = useState<Set<string>>(new Set());

  // Calculate stats
  const stats = useMemo(() => {
    const matchCount = results.reduce((sum, r) => sum + r.matchCount, 0);
    const fileCount = results.length;
    return { matchCount, fileCount };
  }, [results]);

  // Collapse/expand file
  const toggleFile = useCallback((file: string) => {
    setCollapsedFiles(prev => {
      const next = new Set(prev);
      if (next.has(file)) {
        next.delete(file);
      } else {
        next.add(file);
      }
      return next;
    });
  }, []);

  // Handle replace all
  const handleReplaceAll = useCallback(async () => {
    if (!replacement || stats.matchCount === 0) return;
    
    setIsReplacing(true);
    try {
      await onReplace(replacement, preserveCase);
    } finally {
      setIsReplacing(false);
    }
  }, [replacement, preserveCase, stats.matchCount, onReplace]);

  // Handle query change with debounce (handled by parent)
  const handleQueryChange = useCallback((newQuery: string) => {
    onSearch(newQuery, options);
  }, [onSearch, options]);

  // Handle manual search trigger
  const handleSearch = useCallback(() => {
    onSearch(query, options);
  }, [onSearch, query, options]);

  // Handle options change
  const handleOptionsChange = useCallback((newOptions: Partial<SearchOptions>) => {
    onOptionsChange(newOptions);
  }, [onOptionsChange]);

  // Format duration for display
  const formatDuration = useCallback((ms?: number): string => {
    if (!ms) return '';
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(2)}s`;
  }, []);

  return (
    <div className={`search-container ${className}`}>
      {/* Search Panel */}
      <SearchPanel
        query={query}
        options={options}
        isSearching={isSearching}
        onQueryChange={handleQueryChange}
        onOptionsChange={handleOptionsChange}
        onSearch={handleSearch}
        onCancel={onCancel}
        onClear={onClear}
        onToggleReplace={() => setShowReplace(!showReplace)}
        showReplace={showReplace}
        placeholder={placeholder}
      />

      {/* Replace Box */}
      {showReplace && (
        <ReplaceBox
          replacement={replacement}
          onReplacementChange={setReplacement}
          preserveCase={preserveCase}
          onPreserveCaseChange={setPreserveCase}
          isReplacing={isReplacing}
          onReplaceAll={handleReplaceAll}
          matchCount={stats.matchCount}
          fileCount={stats.fileCount}
          disabled={isSearching}
        />
      )}

      {/* Status Bar */}
      {(isSearching || results.length > 0 || query) && (
        <div className="search-status-bar">
          {isSearching ? (
            <span className="search-status searching">
              Searching{filesSearched ? ` ${filesSearched} files` : ''}...
            </span>
          ) : query ? (
            <>
              <span className="search-status results">
                {stats.matchCount} result{stats.matchCount !== 1 ? 's' : ''} in {stats.fileCount} file{stats.fileCount !== 1 ? 's' : ''}
                {searchDuration && (
                  <span className="search-duration"> ({formatDuration(searchDuration)})</span>
                )}
              </span>
              {stats.matchCount > 0 && (
                <button 
                  className="search-collapse-all"
                  onClick={() => setCollapsedFiles(new Set(results.map(r => r.file)))}
                >
                  Collapse All
                </button>
              )}
            </>
          ) : null}
        </div>
      )}

      {/* Results List */}
      <SearchResultsList
        results={results}
        query={query}
        caseSensitive={options.caseSensitive || false}
        onMatchClick={onResultClick}
        onToggleFile={toggleFile}
        collapsedFiles={collapsedFiles}
      />
    </div>
  );
};

export default SearchContainer;
