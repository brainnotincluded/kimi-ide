/**
 * Search Panel Component
 * Main search interface with input, filters, and controls
 */

import React, { useState, useCallback, useEffect, useRef } from 'react';
import { SearchOptions, DEFAULT_EXCLUDE_PATTERNS } from '../types';
import './SearchPanel.css';

export interface SearchPanelProps {
  /** Current query */
  query: string;
  /** Current options */
  options: SearchOptions;
  /** Whether search is in progress */
  isSearching: boolean;
  /** Callback when query changes */
  onQueryChange: (query: string) => void;
  /** Callback when options change */
  onOptionsChange: (options: Partial<SearchOptions>) => void;
  /** Callback to trigger search */
  onSearch: () => void;
  /** Callback to cancel search */
  onCancel: () => void;
  /** Callback to clear results */
  onClear: () => void;
  /** Callback to toggle replace box */
  onToggleReplace?: () => void;
  /** Whether replace box is visible */
  showReplace?: boolean;
  /** Placeholder text */
  placeholder?: string;
  /** Additional CSS class */
  className?: string;
}

export const SearchPanel: React.FC<SearchPanelProps> = ({
  query,
  options,
  isSearching,
  onQueryChange,
  onOptionsChange,
  onSearch,
  onCancel,
  onClear,
  onToggleReplace,
  showReplace = false,
  placeholder = 'Search',
  className = '',
}) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [includeInput, setIncludeInput] = useState(options.include?.join(', ') || '');
  const [excludeInput, setExcludeInput] = useState(options.exclude?.join(', ') || '');

  // Focus input on mount
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Handle keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl+Shift+F or Cmd+Shift+F to focus search
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'F') {
        e.preventDefault();
        inputRef.current?.focus();
        inputRef.current?.select();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Update include/exclude inputs when options change
  useEffect(() => {
    setIncludeInput(options.include?.join(', ') || '');
    setExcludeInput(options.exclude?.join(', ') || '');
  }, [options.include, options.exclude]);

  const handleQueryChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    onQueryChange(e.target.value);
  }, [onQueryChange]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      onSearch();
    } else if (e.key === 'Escape') {
      if (isSearching) {
        onCancel();
      } else if (query) {
        onClear();
      }
    }
  }, [onSearch, onCancel, onClear, isSearching, query]);

  const toggleOption = useCallback((option: keyof SearchOptions) => {
    onOptionsChange({ [option]: !options[option] });
  }, [options, onOptionsChange]);

  const handleIncludeChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setIncludeInput(e.target.value);
    const patterns = e.target.value.split(',').map(p => p.trim()).filter(Boolean);
    onOptionsChange({ include: patterns.length > 0 ? patterns : undefined });
  }, [onOptionsChange]);

  const handleExcludeChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setExcludeInput(e.target.value);
    const patterns = e.target.value.split(',').map(p => p.trim()).filter(Boolean);
    onOptionsChange({ exclude: patterns.length > 0 ? patterns : undefined });
  }, [onOptionsChange]);

  const addDefaultExcludes = useCallback(() => {
    const currentExcludes = options.exclude || [];
    const newExcludes = [...new Set([...currentExcludes, ...DEFAULT_EXCLUDE_PATTERNS])];
    onOptionsChange({ exclude: newExcludes });
  }, [options.exclude, onOptionsChange]);

  const clearExcludes = useCallback(() => {
    onOptionsChange({ exclude: undefined });
  }, [onOptionsChange]);

  return (
    <div className={`search-panel ${className}`}>
      {/* Search Input */}
      <div className="search-input-container">
        <div className="search-icon">
          {isSearching ? (
            <span className="spinner" />
          ) : (
            <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
              <path d="M11.7422 10.3439C12.5329 9.2673 13 7.9382 13 6.5C13 2.91015 10.0899 0 6.5 0C2.91015 0 0 2.91015 0 6.5C0 10.0899 2.91015 13 6.5 13C7.9382 13 9.2673 12.5329 10.3439 11.7422L14.1464 15.1464L15 14.2929L11.7422 10.3439ZM6.5 11.5C3.73858 11.5 1.5 9.26142 1.5 6.5C1.5 3.73858 3.73858 1.5 6.5 1.5C9.26142 1.5 11.5 3.73858 11.5 6.5C11.5 9.26142 9.26142 11.5 6.5 11.5Z"/>
            </svg>
          )}
        </div>
        
        <input
          ref={inputRef}
          type="text"
          className="search-input"
          value={query}
          onChange={handleQueryChange}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          spellCheck={false}
        />

        {query && (
          <button
            className="search-clear-button"
            onClick={onClear}
            title="Clear search"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
              <path d="M8 8.707l3.146 3.147.707-.707L8.707 8l3.147-3.146-.707-.707L8 7.293 4.854 4.146l-.707.707L7.293 8l-3.146 3.146.707.707L8 8.707z"/>
            </svg>
          </button>
        )}

        {isSearching && (
          <button
            className="search-cancel-button"
            onClick={onCancel}
            title="Cancel search"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
              <path d="M4 4l8 8M4 12l8-8" stroke="currentColor" strokeWidth="1.5"/>
            </svg>
          </button>
        )}

        <button
          className={`search-toggle-replace ${showReplace ? 'active' : ''}`}
          onClick={onToggleReplace}
          title="Toggle replace"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
            <path d="M4 4h8v1.5H4zM4 7.5h8V9H4zM4 11h5v1.5H4z"/>
          </svg>
        </button>
      </div>

      {/* Options Toolbar */}
      <div className="search-options-bar">
        <button
          className={`search-option-button ${options.caseSensitive ? 'active' : ''}`}
          onClick={() => toggleOption('caseSensitive')}
          title="Match Case (Alt+C)"
        >
          Aa
        </button>
        <button
          className={`search-option-button ${options.wholeWord ? 'active' : ''}`}
          onClick={() => toggleOption('wholeWord')}
          title="Match Whole Word (Alt+W)"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
            <path d="M4 4h1v8H4zm7 0h1v8h-1zM2.5 7.5h11v1h-11z"/>
          </svg>
        </button>
        <button
          className={`search-option-button ${options.regex ? 'active' : ''}`}
          onClick={() => toggleOption('regex')}
          title="Use Regular Expression (Alt+R)"
        >
          .*
        </button>
        
        <div className="search-options-divider" />
        
        <button
          className={`search-option-button ${showFilters ? 'active' : ''}`}
          onClick={() => setShowFilters(!showFilters)}
          title="Files to Include/Exclude"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
            <path d="M1 3h14v1.5l-5.5 5.5V14l-3-1.5V10L1 4.5V3zm1.5 1.5v.5l5 5v2.5l1.5.75V10l5-5V4.5h-11.5z"/>
          </svg>
        </button>
      </div>

      {/* Filters Panel */}
      {showFilters && (
        <div className="search-filters">
          <div className="search-filter-group">
            <label>files to include</label>
            <input
              type="text"
              value={includeInput}
              onChange={handleIncludeChange}
              placeholder="e.g., *.ts, src/**"
              spellCheck={false}
            />
          </div>
          
          <div className="search-filter-group">
            <label>files to exclude</label>
            <input
              type="text"
              value={excludeInput}
              onChange={handleExcludeChange}
              placeholder="e.g., node_modules/**, *.test.ts"
              spellCheck={false}
            />
            <div className="search-filter-actions">
              <button onClick={addDefaultExcludes} className="text-button">
                Add defaults
              </button>
              <button onClick={clearExcludes} className="text-button">
                Clear
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SearchPanel;
