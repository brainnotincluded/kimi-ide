/**
 * Breadcrumbs Component
 * Shows symbol path above the editor
 */

import React, { memo, useCallback, useMemo } from 'react';
import { BreadcrumbItem, Position, Range } from './types';
import { SymbolIcon } from './SymbolIcon';

interface BreadcrumbsProps {
  /** Breadcrumb items (path from root to current) */
  items: BreadcrumbItem[];
  /** Current cursor position */
  cursorPosition?: Position;
  /** Callback when breadcrumb is clicked */
  onNavigate?: (item: BreadcrumbItem, index: number) => void;
  /** Maximum number of items to show (0 = unlimited) */
  maxItems?: number;
  /** Class name */
  className?: string;
  /** Show file name as first item */
  fileName?: string;
  /** Show line/column info */
  showPosition?: boolean;
}

const SEPARATOR = '›';
const ELLIPSIS = '...';

/**
 * Breadcrumbs component
 */
export const Breadcrumbs: React.FC<BreadcrumbsProps> = memo(({
  items,
  cursorPosition,
  onNavigate,
  maxItems = 0,
  className = '',
  fileName,
  showPosition = true,
}) => {
  // Filter and limit items
  const visibleItems = useMemo(() => {
    let result = items;
    
    // Skip certain types if needed
    result = result.filter(item => 
      !['variable', 'constant', 'string', 'number'].includes(item.kind)
    );

    // Apply max items limit
    if (maxItems > 0 && result.length > maxItems) {
      const start = result.slice(0, Math.floor(maxItems / 2));
      const end = result.slice(result.length - Math.ceil(maxItems / 2));
      return [
        ...start,
        { name: ELLIPSIS, kind: 'null', range: { start: { line: 0, character: 0 }, end: { line: 0, character: 0 } } },
        ...end,
      ] as BreadcrumbItem[];
    }

    return result;
  }, [items, maxItems]);

  const handleClick = useCallback((item: BreadcrumbItem, index: number) => {
    if (item.name === ELLIPSIS) return;
    onNavigate?.(item, index);
  }, [onNavigate]);

  const formatPosition = useCallback((pos: Position) => {
    return `Ln ${pos.line + 1}, Col ${pos.character + 1}`;
  }, []);

  return (
    <div
      className={`breadcrumbs ${className}`}
      style={{
        display: 'flex',
        alignItems: 'center',
        padding: '4px 12px',
        fontSize: 12,
        fontFamily: 'var(--font-sans, system-ui, sans-serif)',
        backgroundColor: 'var(--breadcrumb-bg, #252526)',
        borderBottom: '1px solid var(--border-color, #3c3c3c)',
        overflow: 'hidden',
        whiteSpace: 'nowrap',
      }}
    >
      {/* File name */}
      {fileName && (
        <>
          <span
            className="breadcrumb-file"
            style={{
              color: 'var(--breadcrumb-foreground, #cccccc)',
              fontWeight: 500,
            }}
          >
            {fileName}
          </span>
          {visibleItems.length > 0 && (
            <span
              className="breadcrumb-separator"
              style={{
                margin: '0 6px',
                color: 'var(--breadcrumb-foreground, #cccccc)',
                opacity: 0.5,
              }}
            >
              {SEPARATOR}
            </span>
          )}
        </>
      )}

      {/* Breadcrumb items */}
      {visibleItems.map((item, index) => {
        const isLast = index === visibleItems.length - 1;
        const isEllipsis = item.name === ELLIPSIS;

        return (
          <React.Fragment key={index}>
            <button
              className={`breadcrumb-item ${isLast ? 'active' : ''}`}
              onClick={() => handleClick(item, index)}
              disabled={isEllipsis}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
                padding: '2px 4px',
                borderRadius: 3,
                border: 'none',
                background: 'transparent',
                color: isLast 
                  ? 'var(--breadcrumb-active-foreground, #ffffff)'
                  : 'var(--breadcrumb-foreground, #cccccc)',
                fontSize: 'inherit',
                fontFamily: 'inherit',
                cursor: isEllipsis ? 'default' : 'pointer',
                fontWeight: isLast ? 500 : 400,
                opacity: isEllipsis ? 0.5 : 1,
                transition: 'background-color 0.15s',
              }}
              onMouseEnter={(e) => {
                if (!isEllipsis) {
                  e.currentTarget.style.backgroundColor = 'var(--breadcrumb-hover-bg, #2a2d2e)';
                }
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'transparent';
              }}
            >
              {!isEllipsis && (
                <SymbolIcon kind={item.kind} size="small" />
              )}
              <span className="breadcrumb-name">{item.name}</span>
            </button>

            {!isLast && (
              <span
                className="breadcrumb-separator"
                style={{
                  margin: '0 6px',
                  color: 'var(--breadcrumb-foreground, #cccccc)',
                  opacity: 0.5,
                }}
              >
                {SEPARATOR}
              </span>
            )}
          </React.Fragment>
        );
      })}

      {/* Position indicator */}
      {showPosition && cursorPosition && (
        <span
          className="breadcrumb-position"
          style={{
            marginLeft: 'auto',
            paddingLeft: 12,
            color: 'var(--breadcrumb-foreground, #cccccc)',
            opacity: 0.6,
            fontFamily: 'var(--font-mono, monospace)',
          }}
        >
          {formatPosition(cursorPosition)}
        </span>
      )}
    </div>
  );
});

Breadcrumbs.displayName = 'Breadcrumbs';

/**
 * FlatBreadcrumbs - alternative compact view
 */
interface FlatBreadcrumbsProps {
  items: BreadcrumbItem[];
  onNavigate?: (item: BreadcrumbItem) => void;
  className?: string;
}

export const FlatBreadcrumbs: React.FC<FlatBreadcrumbsProps> = memo(({
  items,
  onNavigate,
  className = '',
}) => {
  const lastItem = items[items.length - 1];
  const parentItems = items.slice(0, -1);

  if (!lastItem) return null;

  return (
    <div
      className={`flat-breadcrumbs ${className}`}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '4px 12px',
        fontSize: 12,
        backgroundColor: 'var(--breadcrumb-bg, #252526)',
      }}
    >
      {parentItems.length > 0 && (
        <select
          className="breadcrumb-parent-select"
          onChange={(e) => {
            const index = parseInt(e.target.value);
            onNavigate?.(parentItems[index]);
          }}
          style={{
            background: 'transparent',
            border: 'none',
            color: 'var(--breadcrumb-foreground, #cccccc)',
            fontSize: 'inherit',
            cursor: 'pointer',
            padding: '2px 4px',
            borderRadius: 3,
          }}
        >
          {parentItems.map((item, index) => (
            <option key={index} value={index}>
              {item.name}
            </option>
          ))}
        </select>
      )}
      
      {parentItems.length > 0 && (
        <span style={{ opacity: 0.5 }}>{SEPARATOR}</span>
      )}

      <span
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 4,
          color: 'var(--breadcrumb-active-foreground, #ffffff)',
          fontWeight: 500,
        }}
      >
        <SymbolIcon kind={lastItem.kind} size="small" />
        {lastItem.name}
      </span>
    </div>
  );
});

FlatBreadcrumbs.displayName = 'FlatBreadcrumbs';

export default Breadcrumbs;
