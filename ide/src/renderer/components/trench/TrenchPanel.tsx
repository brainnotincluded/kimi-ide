/**
 * TrenchPanel - Main panel component for Trench CLI integration
 * Provides UI for search, research, code search, papers, and archive
 */

import React, { useState, useCallback, useEffect } from 'react';
import { useTrench, TrenchOptions, TrenchResult } from '../../hooks/useTrench';
import { TrenchSearchResult, SearchResultItem } from './TrenchSearchResult';
import { TrenchCodeResult, CodeResultItem } from './TrenchCodeResult';
import { TrenchPaperResult, PaperResultItem } from './TrenchPaperResult';

const { shell } = window.require('electron');

type TrenchTab = 'search' | 'research' | 'code' | 'papers' | 'archive';

interface TrenchPanelProps {
  onInsertToChat?: (content: string) => void;
  onOpenFile?: (file: string, line?: number) => void;
}

export const TrenchPanel: React.FC<TrenchPanelProps> = ({
  onInsertToChat,
  onOpenFile
}) => {
  const [activeTab, setActiveTab] = useState<TrenchTab>('search');
  const [query, setQuery] = useState('');
  const [limit, setLimit] = useState(10);
  const [result, setResult] = useState<TrenchResult | null>(null);
  const [parsedResults, setParsedResults] = useState<any[]>([]);
  const [showRaw, setShowRaw] = useState(false);

  const {
    isAvailable,
    isLoading,
    version,
    progress,
    search,
    research,
    code,
    papers,
    archive,
    checkAvailability,
    parseSearchResults,
    parseCodeResults,
    parsePaperResults
  } = useTrench();

  // Check availability on mount
  useEffect(() => {
    checkAvailability();
  }, [checkAvailability]);

  // Parse results when they change
  useEffect(() => {
    if (!result || !result.success) {
      setParsedResults([]);
      return;
    }

    switch (activeTab) {
      case 'search':
      case 'research':
        setParsedResults(parseSearchResults(result));
        break;
      case 'code':
        setParsedResults(parseCodeResults(result));
        break;
      case 'papers':
        setParsedResults(parsePaperResults(result));
        break;
      default:
        setParsedResults([]);
    }
  }, [result, activeTab, parseSearchResults, parseCodeResults, parsePaperResults]);

  const handleExecute = useCallback(async () => {
    if (!query.trim() || isLoading) return;

    const options: TrenchOptions = {
      query: query.trim(),
      limit,
      outputFormat: 'json',
      timeout: activeTab === 'research' ? 600000 : 300000 // 10 min for research, 5 min for others
    };

    let response: TrenchResult;

    switch (activeTab) {
      case 'search':
        response = await search(options);
        break;
      case 'research':
        response = await research(options);
        break;
      case 'code':
        response = await code(options);
        break;
      case 'papers':
        response = await papers(options);
        break;
      case 'archive':
        response = await archive(options);
        break;
      default:
        return;
    }

    setResult(response);
  }, [query, limit, activeTab, isLoading, search, research, code, papers, archive]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      handleExecute();
    }
  }, [handleExecute]);

  const handleInsertToChat = useCallback(() => {
    if (!result) return;

    let content = '';
    if (activeTab === 'archive') {
      content = `Archived: ${result.stdout || result.data?.raw || query}`;
    } else if (showRaw) {
      content = result.stdout || result.data?.raw || '';
    } else {
      // Format structured results
      content = formatResultsForChat(parsedResults, activeTab);
    }

    onInsertToChat?.(content);
  }, [result, parsedResults, activeTab, showRaw, query, onInsertToChat]);

  const formatResultsForChat = (results: any[], tab: TrenchTab): string => {
    if (results.length === 0) return 'No results found.';

    let formatted = `## ${tab.charAt(0).toUpperCase() + tab.slice(1)} Results for "${query}"\n\n`;

    results.forEach((item, index) => {
      formatted += `${index + 1}. `;
      
      if (tab === 'code' && item.file) {
        formatted += `**${item.file}:${item.line}**\n`;
        formatted += `\`\`\`\n${item.content}\n\`\`\`\n`;
      } else if (tab === 'papers' && item.title) {
        formatted += `**${item.title}** (${item.year})\n`;
        formatted += `Authors: ${item.authors?.join(', ') || 'Unknown'}\n`;
        formatted += `URL: ${item.url}\n`;
        if (item.abstract) {
          formatted += `> ${item.abstract.substring(0, 200)}...\n`;
        }
      } else {
        formatted += `**${item.title || 'Result'}**\n`;
        formatted += `${item.url || ''}\n`;
        if (item.snippet) {
          formatted += `> ${item.snippet}\n`;
        }
      }
      
      formatted += '\n';
    });

    return formatted;
  };

  const handleOpenUrl = useCallback((url: string) => {
    shell.openExternal(url);
  }, []);

  const tabs: { id: TrenchTab; label: string; icon: string }[] = [
    { id: 'search', label: 'Search', icon: '🔍' },
    { id: 'research', label: 'Research', icon: '📚' },
    { id: 'code', label: 'Code', icon: '💻' },
    { id: 'papers', label: 'Papers', icon: '📄' },
    { id: 'archive', label: 'Archive', icon: '📦' }
  ];

  if (isAvailable === false) {
    return (
      <div className="trench-panel trench-unavailable">
        <div className="trench-warning">
          <h3>⚠️ Trench CLI Not Available</h3>
          <p>Trench CLI was not found on your system.</p>
          <p>Please install Trench CLI to use this feature:</p>
          <code>cargo install trench-cli</code>
          <button onClick={checkAvailability} className="trench-retry-btn">
            Check Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="trench-panel">
      <div className="trench-header">
        <div className="trench-tabs">
          {tabs.map(tab => (
            <button
              key={tab.id}
              className={`trench-tab ${activeTab === tab.id ? 'active' : ''}`}
              onClick={() => {
                setActiveTab(tab.id);
                setResult(null);
                setParsedResults([]);
              }}
            >
              <span className="trench-tab-icon">{tab.icon}</span>
              <span className="trench-tab-label">{tab.label}</span>
            </button>
          ))}
        </div>
        {version && (
          <span className="trench-version" title="Trench CLI version">
            {version}
          </span>
        )}
      </div>

      <div className="trench-input-section">
        <div className="trench-query-row">
          <input
            type="text"
            className="trench-query-input"
            placeholder={getPlaceholder(activeTab)}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={isLoading}
          />
          <button
            className="trench-execute-btn"
            onClick={handleExecute}
            disabled={isLoading || !query.trim()}
          >
            {isLoading ? '⏳' : '▶️'}
          </button>
        </div>

        <div className="trench-options-row">
          <label className="trench-limit-label">
            Results:
            <select
              value={limit}
              onChange={(e) => setLimit(Number(e.target.value))}
              disabled={isLoading}
            >
              <option value={5}>5</option>
              <option value={10}>10</option>
              <option value={20}>20</option>
              <option value={50}>50</option>
            </select>
          </label>

          {result && (
            <>
              <label className="trench-view-toggle">
                <input
                  type="checkbox"
                  checked={showRaw}
                  onChange={(e) => setShowRaw(e.target.checked)}
                />
                Raw output
              </label>
              <button
                className="trench-insert-btn"
                onClick={handleInsertToChat}
              >
                Insert to Chat
              </button>
            </>
          )}
        </div>
      </div>

      {isLoading && progress && (
        <div className="trench-progress">
          <div className="trench-progress-bar">
            <div className="trench-progress-fill" />
          </div>
          <span className="trench-progress-text">{progress}</span>
        </div>
      )}

      <div className="trench-results">
        {result && !result.success && (
          <div className="trench-error">
            <h4>Error</h4>
            <p>{result.error}</p>
            {result.stderr && (
              <pre className="trench-error-details">{result.stderr}</pre>
            )}
          </div>
        )}

        {result && result.success && showRaw && (
          <pre className="trench-raw-output">{result.stdout}</pre>
        )}

        {result && result.success && !showRaw && (
          <div className="trench-structured-results">
            {activeTab === 'search' && (
              <TrenchSearchResult
                results={parsedResults as SearchResultItem[]}
                onResultClick={handleOpenUrl}
              />
            )}
            {activeTab === 'research' && (
              <TrenchSearchResult
                results={parsedResults as SearchResultItem[]}
                onResultClick={handleOpenUrl}
              />
            )}
            {activeTab === 'code' && (
              <TrenchCodeResult
                results={parsedResults as CodeResultItem[]}
                onFileClick={onOpenFile}
              />
            )}
            {activeTab === 'papers' && (
              <TrenchPaperResult
                results={parsedResults as PaperResultItem[]}
                onPaperClick={handleOpenUrl}
              />
            )}
            {activeTab === 'archive' && (
              <div className="trench-archive-result">
                <h4>✅ Archive Complete</h4>
                <pre>{result.stdout}</pre>
              </div>
            )}
          </div>
        )}

        {!result && !isLoading && (
          <div className="trench-hint">
            <p>Enter a query and press ▶️ to search</p>
            <p className="trench-shortcut-hint">Cmd+Enter to execute</p>
          </div>
        )}
      </div>
    </div>
  );
};

function getPlaceholder(tab: TrenchTab): string {
  switch (tab) {
    case 'search':
      return 'Search the web...';
    case 'research':
      return 'Deep research topic...';
    case 'code':
      return 'Search for code...';
    case 'papers':
      return 'Search academic papers...';
    case 'archive':
      return 'URL to archive...';
    default:
      return 'Enter query...';
  }
}
