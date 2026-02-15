/**
 * SymbolTree Component
 * Tree view for document symbols with expand/collapse
 */

import React, { memo, useCallback, useMemo, useState } from 'react';
import { DocumentSymbol, SymbolKind, SymbolTag, Position, SymbolSortOptions } from './types';
import { SymbolIcon } from './SymbolIcon';

interface SymbolTreeProps {
  /** Root symbols */
  symbols: DocumentSymbol[];
  /** Selected symbol path */
  selectedPath?: string[];
  /** Expanded node IDs */
  expandedNodes: Set<string>;
  /** Sort options */
  sort?: SymbolSortOptions;
  /** Callback when symbol is selected */
  onSelect?: (symbol: DocumentSymbol, path: string[]) => void;
  /** Callback when node is expanded */
  onExpand?: (path: string[]) => void;
  /** Callback when node is collapsed */
  onCollapse?: (path: string[]) => void;
  /** Callback when symbol is double-clicked */
  onDoubleClick?: (symbol: DocumentSymbol) => void;
  /** Level for indentation */
  level?: number;
  /** Parent path */
  parentPath?: string[];
  /** Filter query */
  filterQuery?: string;
  /** Show only specific kinds */
  filterKinds?: SymbolKind[];
  /** Class name */
  className?: string;
  /** Follow cursor - highlight symbol at position */
  cursorPosition?: Position;
  /** Auto expand to selected */
  autoExpand?: boolean;
}

/**
 * Sort symbols based on options
 */
const sortSymbols = (
  symbols: DocumentSymbol[],
  sort?: SymbolSortOptions
): DocumentSymbol[] => {
  if (!sort) return symbols;

  const sorted = [...symbols];
  const direction = sort.direction === 'desc' ? -1 : 1;

  switch (sort.by) {
    case 'name':
      sorted.sort((a, b) => direction * a.name.localeCompare(b.name));
      break;
    case 'type':
      sorted.sort((a, b) => direction * a.kind.localeCompare(b.kind));
      break;
    case 'accessibility':
      sorted.sort((a, b) => {
        const aVal = a.accessibility || 'public';
        const bVal = b.accessibility || 'public';
        const order = { public: 0, protected: 1, private: 2, internal: 3 };
        return direction * (order[aVal] - order[bVal]);
      });
      break;
    case 'position':
    default:
      // Default document order (by range)
      sorted.sort((a, b) => {
        const aStart = a.range?.start?.line ?? 0;
        const bStart = b.range?.start?.line ?? 0;
        return direction * (aStart - bStart);
      });
      break;
  }

  return sorted;
};

/**
 * Filter symbols based on query and kinds
 */
const filterSymbols = (
  symbols: DocumentSymbol[],
  query?: string,
  kinds?: SymbolKind[]
): DocumentSymbol[] => {
  if (!query && (!kinds || kinds.length === 0)) return symbols;

  const lowerQuery = query?.toLowerCase();

  return symbols.filter(symbol => {
    // Filter by kind
    if (kinds && kinds.length > 0 && !kinds.includes(symbol.kind)) {
      return false;
    }

    // Filter by query (match name or detail)
    if (lowerQuery) {
      const nameMatch = symbol.name.toLowerCase().includes(lowerQuery);
      const detailMatch = symbol.detail?.toLowerCase().includes(lowerQuery);
      if (!nameMatch && !detailMatch) {
        return false;
      }
    }

    return true;
  });
};

/**
 * Get unique ID for a symbol path
 */
const getNodeId = (path: string[]): string => path.join('::');

/**
 * Check if position is within symbol range
 */
const isPositionInSymbol = (position: Position, symbol: DocumentSymbol): boolean => {
  const range = symbol.range;
  if (!range) return false;

  const afterStart = position.line > range.start.line ||
    (position.line === range.start.line && position.character >= range.start.character);
  const beforeEnd = position.line < range.end.line ||
    (position.line === range.end.line && position.character <= range.end.character);

  return afterStart && beforeEnd;
};

/**
 * Tree node component
 */
interface TreeNodeProps {
  symbol: DocumentSymbol;
  path: string[];
  level: number;
  isSelected: boolean;
  isExpanded: boolean;
  hasChildren: boolean;
  onSelect: (symbol: DocumentSymbol, path: string[]) => void;
  onToggle: (path: string[], expanded: boolean) => void;
  onDoubleClick: (symbol: DocumentSymbol) => void;
  isHighlighted: boolean;
}

const TreeNode: React.FC<TreeNodeProps> = memo(({
  symbol,
  path,
  level,
  isSelected,
  isExpanded,
  hasChildren,
  onSelect,
  onToggle,
  onDoubleClick,
  isHighlighted,
}) => {
  const handleClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    onSelect(symbol, path);
  }, [symbol, path, onSelect]);

  const handleToggle = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    onToggle(path, !isExpanded);
  }, [path, isExpanded, onToggle]);

  const handleDoubleClick = useCallback(() => {
    onDoubleClick(symbol);
  }, [symbol, onDoubleClick]);

  const indentSize = 16;

  return (
    <div
      className={`symbol-tree-node ${isSelected ? 'selected' : ''} ${isHighlighted ? 'highlighted' : ''}`}
      onClick={handleClick}
      onDoubleClick={handleDoubleClick}
      style={{
        display: 'flex',
        alignItems: 'center',
        padding: '2px 8px',
        paddingLeft: 8 + level * indentSize,
        cursor: 'pointer',
        backgroundColor: isSelected
          ? 'var(--list-active-selection-bg, #094771)'
          : isHighlighted
          ? 'var(--list-hover-bg, #2a2d2e)'
          : 'transparent',
        color: isSelected
          ? 'var(--list-active-selection-fg, #ffffff)'
          : 'var(--foreground, #cccccc)',
        borderLeft: isHighlighted ? '2px solid var(--focus-border, #007acc)' : '2px solid transparent',
      }}
    >
      {/* Expand/collapse chevron */}
      <span
        className="tree-node-toggle"
        onClick={hasChildren ? handleToggle : undefined}
        style={{
          width: 16,
          height: 16,
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: hasChildren ? 'pointer' : 'default',
          opacity: hasChildren ? 1 : 0,
          transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)',
          transition: 'transform 0.15s',
          fontSize: 10,
        }}
      >
        ▶
      </span>

      {/* Symbol icon */}
      <SymbolIcon
        kind={symbol.kind}
        tags={symbol.tags}
        size="small"
        accessibility={symbol.accessibility}
        showAccessibility
      />

      {/* Symbol name */}
      <span
        className="tree-node-name"
        style={{
          marginLeft: 6,
          fontSize: 13,
          fontFamily: 'var(--font-sans, system-ui, sans-serif)',
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          textDecoration: symbol.tags?.includes('deprecated') ? 'line-through' : 'none',
          opacity: symbol.tags?.includes('deprecated') ? 0.6 : 1,
        }}
        title={symbol.documentation || symbol.detail}
      >
        {symbol.name}
      </span>

      {/* Detail/signature */}
      {symbol.detail && (
        <span
          className="tree-node-detail"
          style={{
            marginLeft: 8,
            fontSize: 11,
            color: isSelected
              ? 'var(--list-active-selection-fg, #ffffff)'
              : 'var(--description-foreground, #858585)',
            opacity: 0.8,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            fontFamily: 'var(--font-mono, monospace)',
          }}
        >
          {symbol.detail}
        </span>
      )}
    </div>
  );
});

TreeNode.displayName = 'TreeNode';

/**
 * SymbolTree component
 */
export const SymbolTree: React.FC<SymbolTreeProps> = memo(({
  symbols,
  selectedPath,
  expandedNodes,
  sort,
  onSelect,
  onExpand,
  onCollapse,
  onDoubleClick,
  level = 0,
  parentPath = [],
  filterQuery,
  filterKinds,
  className = '',
  cursorPosition,
  autoExpand = true,
}) => {
  // Filter and sort symbols
  const processedSymbols = useMemo(() => {
    const filtered = filterSymbols(symbols, filterQuery, filterKinds);
    return sortSymbols(filtered, sort);
  }, [symbols, filterQuery, filterKinds, sort]);

  // Find symbol at cursor position
  const highlightedPath = useMemo(() => {
    if (!cursorPosition) return undefined;

    const findPath = (syms: DocumentSymbol[], path: string[]): string[] | undefined => {
      for (const sym of syms) {
        const currentPath = [...path, sym.name];
        
        if (isPositionInSymbol(cursorPosition, sym)) {
          // Check children first (more specific)
          if (sym.children?.length) {
            const childPath = findPath(sym.children, currentPath);
            if (childPath) return childPath;
          }
          return currentPath;
        }
      }
      return undefined;
    };

    return findPath(symbols, []);
  }, [cursorPosition, symbols]);

  // Auto expand to highlighted path
  React.useEffect(() => {
    if (autoExpand && highlightedPath && onExpand) {
      // Expand all parent nodes of highlighted path
      for (let i = 1; i < highlightedPath.length; i++) {
        const path = highlightedPath.slice(0, i);
        const nodeId = getNodeId(path);
        if (!expandedNodes.has(nodeId)) {
          onExpand(path);
        }
      }
    }
  }, [highlightedPath, autoExpand, expandedNodes, onExpand]);

  const handleToggle = useCallback((path: string[], expanded: boolean) => {
    if (expanded) {
      onExpand?.(path);
    } else {
      onCollapse?.(path);
    }
  }, [onExpand, onCollapse]);

  if (processedSymbols.length === 0) {
    return (
      <div
        className="symbol-tree-empty"
        style={{
          padding: '20px 12px',
          textAlign: 'center',
          color: 'var(--description-foreground, #858585)',
          fontSize: 13,
        }}
      >
        {filterQuery ? 'No symbols match your filter' : 'No symbols found'}
      </div>
    );
  }

  return (
    <div className={`symbol-tree ${className}`} style={{ overflow: 'auto' }}>
      {processedSymbols.map((symbol, index) => {
        const currentPath = [...parentPath, symbol.name];
        const nodeId = getNodeId(currentPath);
        const isSelected = selectedPath && getNodeId(selectedPath) === nodeId;
        const isExpanded = expandedNodes.has(nodeId);
        const hasChildren = symbol.children && symbol.children.length > 0;
        const isHighlighted = highlightedPath && getNodeId(highlightedPath) === nodeId;

        return (
          <React.Fragment key={nodeId}>
            <TreeNode
              symbol={symbol}
              path={currentPath}
              level={level}
              isSelected={!!isSelected}
              isExpanded={isExpanded}
              hasChildren={hasChildren}
              onSelect={onSelect || (() => {})}
              onToggle={handleToggle}
              onDoubleClick={onDoubleClick || (() => {})}
              isHighlighted={!!isHighlighted}
            />

            {/* Render children if expanded */}
            {isExpanded && hasChildren && (
              <SymbolTree
                symbols={symbol.children!}
                selectedPath={selectedPath}
                expandedNodes={expandedNodes}
                sort={sort}
                onSelect={onSelect}
                onExpand={onExpand}
                onCollapse={onCollapse}
                onDoubleClick={onDoubleClick}
                level={level + 1}
                parentPath={currentPath}
                filterQuery={filterQuery}
                filterKinds={filterKinds}
                cursorPosition={cursorPosition}
                autoExpand={autoExpand}
              />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
});

SymbolTree.displayName = 'SymbolTree';

export default SymbolTree;
