/**
 * OutlinePanel Component
 * Main outline view panel (left sidebar)
 */

import React, { memo, useCallback, useEffect, useMemo, useState } from 'react';
import {
  DocumentSymbol,
  WorkspaceSymbol,
  SymbolKind,
  SymbolFilter,
  SymbolSortOptions,
  Position,
  OutlineOptions,
  NavigationTarget,
} from './types';
import { SymbolTree } from './SymbolTree';

interface OutlinePanelProps {
  /** Current file URI */
  currentUri?: string;
  /** Document symbols for current file */
  symbols: DocumentSymbol[];
  /** Loading state */
  isLoading?: boolean;
  /** Error message */
  error?: string;
  /** Current cursor position */
  cursorPosition?: Position;
  /** View options */
  options?: OutlineOptions;
  /** Callback when symbol is selected */
  onNavigate?: (target: NavigationTarget) => void;
  /** Callback when options change */
  onOptionsChange?: (options: Partial<OutlineOptions>) => void;
  /** Callback to refresh symbols */
  onRefresh?: () => void;
  /** Callback to follow cursor */
  onFollowCursor?: () => void;
  /** Class name */
  className?: string;
}

// Available symbol filters
const SYMBOL_KIND_GROUPS: { label: string; kinds: SymbolKind[] }[] = [
  { label: 'All', kinds: [] },
  { label: 'Functions', kinds: ['function', 'method', 'constructor'] },
  { label: 'Classes', kinds: ['class', 'interface', 'struct', 'enum'] },
  { label: 'Variables', kinds: ['variable', 'constant', 'field', 'property'] },
  { label: 'Types', kinds: ['interface', 'typeParameter', 'enum'] },
];

// Sort options
const SORT_OPTIONS: { label: string; value: SymbolSortOptions }[] = [
  { label: 'Position', value: { by: 'position' } },
  { label: 'Name', value: { by: 'name' } },
  { label: 'Type', value: { by: 'type' } },
  { label: 'Accessibility', value: { by: 'accessibility' } },
];

/**
 * OutlinePanel component
 */
export const OutlinePanel: React.FC<OutlinePanelProps> = memo(({
  currentUri,
  symbols,
  isLoading = false,
  error,
  cursorPosition,
  options = {},
  onNavigate,
  onOptionsChange,
  onRefresh,
  onFollowCursor,
  className = '',
}) => {
  // Local state
  const [filterQuery, setFilterQuery] = useState('');
  const [selectedPath, setSelectedPath] = useState<string[] | undefined>();
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());

  // Merge options with defaults
  const mergedOptions = useMemo<OutlineOptions>(() => ({
    sort: { by: 'position', direction: 'asc' },
    filter: {},
    followCursor: true,
    expandLevel: 0,
    showBreadcrumbs: true,
    groupByType: false,
    ...options,
  }), [options]);

  // Reset state when file changes
  useEffect(() => {
    setSelectedPath(undefined);
    setFilterQuery('');
    setExpandedNodes(new Set());
  }, [currentUri]);

  // Handle symbol selection
  const handleSelect = useCallback((symbol: DocumentSymbol, path: string[]) => {
    setSelectedPath(path);
    
    if (symbol.range && currentUri) {
      onNavigate?.({
        uri: currentUri,
        range: symbol.selectionRange || symbol.range,
      });
    }
  }, [currentUri, onNavigate]);

  // Handle expand
  const handleExpand = useCallback((path: string[]) => {
    const nodeId = path.join('::');
    setExpandedNodes(prev => new Set([...prev, nodeId]));
  }, []);

  // Handle collapse
  const handleCollapse = useCallback((path: string[]) => {
    const nodeId = path.join('::');
    setExpandedNodes(prev => {
      const next = new Set(prev);
      next.delete(nodeId);
      return next;
    });
  }, []);

  // Handle sort change
  const handleSortChange = useCallback((sort: SymbolSortOptions) => {
    onOptionsChange?.({ sort });
  }, [onOptionsChange]);

  // Handle filter change
  const handleFilterChange = useCallback((filter: SymbolFilter) => {
    onOptionsChange?.({ filter });
  }, [onOptionsChange]);

  // Toggle follow cursor
  const toggleFollowCursor = useCallback(() => {
    onOptionsChange?.({ followCursor: !mergedOptions.followCursor });
  }, [mergedOptions.followCursor, onOptionsChange]);

  // Expand all nodes
  const expandAll = useCallback(() => {
    const allNodes = new Set<string>();
    const collect = (symbols: DocumentSymbol[], path: string[]) => {
      for (const sym of symbols) {
        const currentPath = [...path, sym.name];
        const nodeId = currentPath.join('::');
        if (sym.children?.length) {
          allNodes.add(nodeId);
          collect(sym.children, currentPath);
        }
      }
    };
    collect(symbols, []);
    setExpandedNodes(allNodes);
  }, [symbols]);

  // Collapse all nodes
  const collapseAll = useCallback(() => {
    setExpandedNodes(new Set());
  }, []);

  // Get current filter kinds
  const currentFilterKinds = mergedOptions.filter?.kinds;

  return (
    <div
      className={`outline-panel ${className}`}
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        backgroundColor: 'var(--side-bar-bg, #252526)',
        color: 'var(--side-bar-fg, #cccccc)',
      }}
    >
      {/* Header */}
      <div
        className="outline-header"
        style={{
          padding: '8px 12px',
          borderBottom: '1px solid var(--border-color, #3c3c3c)',
          display: 'flex',
          flexDirection: 'column',
          gap: 8,
        }}
      >
        {/* Title and actions */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <span
            style={{
              fontSize: 11,
              fontWeight: 600,
              textTransform: 'uppercase',
              letterSpacing: 0.5,
              color: 'var(--side-bar-section-header-fg, #bbbbbb)',
            }}
          >
            Outline
          </span>
          <div style={{ display: 'flex', gap: 4 }}>
            <button
              onClick={onRefresh}
              disabled={isLoading}
              title="Refresh"
              style={{
                padding: '2px 6px',
                background: 'transparent',
                border: 'none',
                color: 'var(--foreground, #cccccc)',
                cursor: 'pointer',
                fontSize: 12,
                opacity: isLoading ? 0.5 : 1,
              }}
            >
              {isLoading ? '⟳' : '↻'}
            </button>
            <button
              onClick={toggleFollowCursor}
              title={mergedOptions.followCursor ? 'Follow cursor: ON' : 'Follow cursor: OFF'}
              style={{
                padding: '2px 6px',
                background: mergedOptions.followCursor ? 'var(--button-bg, #0e639c)' : 'transparent',
                border: 'none',
                color: 'var(--foreground, #cccccc)',
                cursor: 'pointer',
                fontSize: 12,
                borderRadius: 3,
              }}
            >
              📍
            </button>
          </div>
        </div>

        {/* Search/filter */}
        <div style={{ position: 'relative' }}>
          <input
            type="text"
            value={filterQuery}
            onChange={(e) => setFilterQuery(e.target.value)}
            placeholder="Filter symbols..."
            style={{
              width: '100%',
              padding: '4px 24px 4px 8px',
              fontSize: 12,
              backgroundColor: 'var(--input-bg, #3c3c3c)',
              color: 'var(--input-fg, #cccccc)',
              border: '1px solid var(--input-border, #3c3c3c)',
              borderRadius: 3,
              outline: 'none',
            }}
          />
          {filterQuery && (
            <button
              onClick={() => setFilterQuery('')}
              style={{
                position: 'absolute',
                right: 4,
                top: '50%',
                transform: 'translateY(-50%)',
                background: 'transparent',
                border: 'none',
                color: 'var(--foreground, #cccccc)',
                cursor: 'pointer',
                fontSize: 10,
                padding: '2px 4px',
              }}
            >
              ✕
            </button>
          )}
        </div>

        {/* Filter tabs */}
        <div
          style={{
            display: 'flex',
            gap: 4,
            overflowX: 'auto',
            paddingBottom: 4,
          }}
        >
          {SYMBOL_KIND_GROUPS.map(group => {
            const isActive = JSON.stringify(currentFilterKinds) === JSON.stringify(group.kinds);
            return (
              <button
                key={group.label}
                onClick={() => handleFilterChange({ kinds: group.kinds })}
                style={{
                  padding: '2px 8px',
                  fontSize: 11,
                  background: isActive ? 'var(--button-bg, #0e639c)' : 'transparent',
                  color: 'var(--foreground, #cccccc)',
                  border: 'none',
                  borderRadius: 3,
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                }}
              >
                {group.label}
              </button>
            );
          })}
        </div>

        {/* Sort and expand controls */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            fontSize: 11,
          }}
        >
          <select
            value={mergedOptions.sort?.by}
            onChange={(e) => handleSortChange({ 
              by: e.target.value as SymbolSortOptions['by'],
              direction: mergedOptions.sort?.direction 
            })}
            style={{
              padding: '2px 4px',
              fontSize: 11,
              backgroundColor: 'var(--dropdown-bg, #3c3c3c)',
              color: 'var(--dropdown-fg, #cccccc)',
              border: '1px solid var(--dropdown-border, #3c3c3c)',
              borderRadius: 3,
            }}
          >
            {SORT_OPTIONS.map(opt => (
              <option key={opt.label} value={opt.value.by}>
                {opt.label}
              </option>
            ))}
          </select>

          <div style={{ display: 'flex', gap: 4 }}>
            <button
              onClick={expandAll}
              title="Expand All"
              style={{
                padding: '2px 6px',
                background: 'transparent',
                border: 'none',
                color: 'var(--foreground, #cccccc)',
                cursor: 'pointer',
                fontSize: 11,
              }}
            >
              ▼
            </button>
            <button
              onClick={collapseAll}
              title="Collapse All"
              style={{
                padding: '2px 6px',
                background: 'transparent',
                border: 'none',
                color: 'var(--foreground, #cccccc)',
                cursor: 'pointer',
                fontSize: 11,
              }}
            >
              ▶
            </button>
          </div>
        </div>
      </div>

      {/* Error message */}
      {error && (
        <div
          style={{
            padding: '8px 12px',
            backgroundColor: 'var(--error-bg, #5a1d1d)',
            color: 'var(--error-fg, #f48771)',
            fontSize: 12,
          }}
        >
          {error}
        </div>
      )}

      {/* Symbol tree */}
      <div style={{ flex: 1, overflow: 'auto' }}>
        <SymbolTree
          symbols={symbols}
          selectedPath={selectedPath}
          expandedNodes={expandedNodes}
          sort={mergedOptions.sort}
          onSelect={handleSelect}
          onExpand={handleExpand}
          onCollapse={handleCollapse}
          filterQuery={filterQuery}
          filterKinds={currentFilterKinds}
          cursorPosition={mergedOptions.followCursor ? cursorPosition : undefined}
        />
      </div>

      {/* Status bar */}
      <div
        className="outline-status"
        style={{
          padding: '4px 12px',
          borderTop: '1px solid var(--border-color, #3c3c3c)',
          fontSize: 11,
          color: 'var(--description-foreground, #858585)',
          display: 'flex',
          justifyContent: 'space-between',
        }}
      >
        <span>{symbols.length} symbols</span>
        {isLoading && <span>Loading...</span>}
      </div>
    </div>
  );
});

OutlinePanel.displayName = 'OutlinePanel';

export default OutlinePanel;
