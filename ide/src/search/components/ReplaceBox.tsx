/**
 * Replace Box Component
 * Replace input with Replace/Replace All buttons
 */

import React, { useState, useCallback, useRef, useEffect } from 'react';
import './ReplaceBox.css';

export interface ReplaceBoxProps {
  /** Current replacement text */
  replacement: string;
  /** Callback when replacement changes */
  onReplacementChange: (value: string) => void;
  /** Whether preserve case is enabled */
  preserveCase?: boolean;
  /** Callback when preserve case changes */
  onPreserveCaseChange?: (value: boolean) => void;
  /** Whether replace is in progress */
  isReplacing?: boolean;
  /** Callback for Replace action */
  onReplace?: () => void;
  /** Callback for Replace All action */
  onReplaceAll: () => void;
  /** Number of matches found */
  matchCount?: number;
  /** Number of files with matches */
  fileCount?: number;
  /** Whether replace is disabled */
  disabled?: boolean;
  /** Additional CSS class */
  className?: string;
}

export const ReplaceBox: React.FC<ReplaceBoxProps> = ({
  replacement,
  onReplacementChange,
  preserveCase = false,
  onPreserveCaseChange,
  isReplacing = false,
  onReplace,
  onReplaceAll,
  matchCount = 0,
  fileCount = 0,
  disabled = false,
  className = '',
}) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [showPreview, setShowPreview] = useState(false);

  // Focus input when shown
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && e.ctrlKey) {
      onReplaceAll();
    } else if (e.key === 'Enter') {
      onReplace?.();
    }
  }, [onReplace, onReplaceAll]);

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    onReplacementChange(e.target.value);
  }, [onReplacementChange]);

  const hasMatches = matchCount > 0;
  const replaceDisabled = disabled || isReplacing || !hasMatches;

  return (
    <div className={`replace-box ${className}`}>
      {/* Replace Input */}
      <div className="replace-input-container">
        <div className="replace-icon">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
            <path d="M11 8.5L8.5 6l-.707.707L9.086 8H3v1h6.086l-1.293 1.293L8.5 11l2.5-2.5zM8 2a6 6 0 100 12A6 6 0 008 2zm0 11a5 5 0 110-10 5 5 0 010 10z"/>
          </svg>
        </div>
        
        <input
          ref={inputRef}
          type="text"
          className="replace-input"
          value={replacement}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          placeholder="Replace"
          disabled={disabled}
          spellCheck={false}
        />

        {replacement && (
          <button
            className="replace-clear-button"
            onClick={() => onReplacementChange('')}
            title="Clear"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
              <path d="M8 8.707l3.146 3.147.707-.707L8.707 8l3.147-3.146-.707-.707L8 7.293 4.854 4.146l-.707.707L7.293 8l-3.146 3.146.707.707L8 8.707z"/>
            </svg>
          </button>
        )}

        {/* Preserve Case Toggle */}
        {onPreserveCaseChange && (
          <button
            className={`replace-option ${preserveCase ? 'active' : ''}`}
            onClick={() => onPreserveCaseChange(!preserveCase)}
            title="Preserve Case"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
              <path d="M4 3h2l3 10H7l-.75-2.5H3.75L3 13H1l3-10zm1.5 2L4.25 8.5h2.5L6 5h-.5zM9 3h2v10H9V3z"/>
            </svg>
          </button>
        )}
      </div>

      {/* Replace Actions */}
      <div className="replace-actions">
        {onReplace && (
          <button
            className="replace-button"
            onClick={onReplace}
            disabled={replaceDisabled}
            title="Replace (Enter)"
          >
            Replace
          </button>
        )}
        
        <button
          className="replace-all-button"
          onClick={onReplaceAll}
          disabled={replaceDisabled}
          title="Replace All (Ctrl+Enter)"
        >
          {isReplacing ? 'Replacing...' : `Replace All${hasMatches ? ` (${matchCount})` : ''}`}
        </button>

        {hasMatches && (
          <span className="replace-stats">
            {matchCount} match{matchCount !== 1 ? 'es' : ''} in {fileCount} file{fileCount !== 1 ? 's' : ''}
          </span>
        )}
      </div>

      {/* Replace Preview Tooltip */}
      {showPreview && replacement && hasMatches && (
        <div className="replace-preview">
          <div className="replace-preview-title">Preview</div>
          <div className="replace-preview-content">
            Will replace with: <code>{replacement}</code>
          </div>
        </div>
      )}
    </div>
  );
};

export default ReplaceBox;
