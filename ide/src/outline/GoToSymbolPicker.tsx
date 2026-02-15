/**
 * GoToSymbolPicker Component
 * Quick symbol picker (Ctrl+Shift+O / Cmd+Shift+O)
 */

import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { DocumentSymbol, WorkspaceSymbol, SymbolKind, NavigationTarget, Position } from './types';
import { SymbolIcon } from './SymbolIcon';

interface GoToSymbolPickerProps {
  /** Whether picker is open */
  isOpen: boolean;
  /** Document symbols for current file */
  documentSymbols: DocumentSymbol[];
  /** Workspace symbols (for @ search) */
  workspaceSymbols?: WorkspaceSymbol[];
  /** Current file URI */
  currentUri?: string;
  /** Callback when symbol is selected */
  onSelect: (target: NavigationTarget) => void;
  /** Callback when picker is closed */
  onClose: () => void;
  /** Show workspace symbols */
  showWorkspaceSymbols?: boolean;
  /** Initial query */
  initialQuery?: string;
}

interface PickerItem {
  id: string;
  name: string;
  detail?: string;
  kind: SymbolKind;
  location: NavigationTarget;
  containerName?: string;
  path?: string[];
  score?: number;
  isWorkspace?: boolean;
}

const MAX_RESULTS = 50;

/**
 * Flatten document symbols into picker items
 */
const flattenSymbols = (
  symbols: DocumentSymbol[],
  uri: string,
  path: string[] = []
): PickerItem[] => {
  const items: PickerItem[] = [];

  for (const sym of symbols) {
    const currentPath = [...path, sym.name];
    
    items.push({
      id: currentPath.join('::'),
      name: sym.name,
      detail: sym.detail,
      kind: sym.kind,
      location: {
        uri,
        range: sym.selectionRange || sym.range,
      },
      path: currentPath,
      isWorkspace: false,
    });

    if (sym.children?.length) {
      items.push(...flattenSymbols(sym.children, uri, currentPath));
    }
  }

  return items;
};

/**
 * Convert workspace symbols to picker items
 */
const workspaceToPickerItems = (symbols: WorkspaceSymbol[]): PickerItem[] => {
  return symbols.map(sym => ({
    id: `${sym.location.uri}::${sym.name}`,
    name: sym.name,
    kind: sym.kind,
    location: {
      uri: sym.location.uri,
      range: sym.location.range,
    },
    containerName: sym.containerName,
    isWorkspace: true,
  }));
};

/**
 * Score a match between query and text
 */
const scoreMatch = (query: string, text: string): number => {
  const lowerQuery = query.toLowerCase();
  const lowerText = text.toLowerCase();

  // Exact match
  if (lowerText === lowerQuery) return 100;

  // Starts with
  if (lowerText.startsWith(lowerQuery)) return 80;

  // Contains as word boundary
  const wordBoundaryIndex = lowerText.search(new RegExp(`\\b${lowerQuery}`));
  if (wordBoundaryIndex !== -1) return 60;

  // Contains anywhere
  if (lowerText.includes(lowerQuery)) return 40;

  // Fuzzy match (all characters in order)
  let queryIndex = 0;
  let textIndex = 0;
  while (queryIndex < lowerQuery.length && textIndex < lowerText.length) {
    if (lowerQuery[queryIndex] === lowerText[textIndex]) {
      queryIndex++;
    }
    textIndex++;
  }
  if (queryIndex === lowerQuery.length) return 20;

  return 0;
};

/**
 * GoToSymbolPicker component
 */
export const GoToSymbolPicker: React.FC<GoToSymbolPickerProps> = memo(({
  isOpen,
  documentSymbols,
  workspaceSymbols,
  currentUri,
  onSelect,
  onClose,
  showWorkspaceSymbols = false,
  initialQuery = '',
}) => {
  // State
  const [query, setQuery] = useState(initialQuery);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Reset state when opened
  useEffect(() => {
    if (isOpen) {
      setQuery(initialQuery);
      setSelectedIndex(0);
      // Focus input after a short delay
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen, initialQuery]);

  // Build items list
  const allItems = useMemo(() => {
    const items: PickerItem[] = [];

    // Add document symbols
    if (currentUri) {
      items.push(...flattenSymbols(documentSymbols, currentUri));
    }

    // Add workspace symbols if available and enabled
    if (showWorkspaceSymbols && workspaceSymbols) {
      items.push(...workspaceToPickerItems(workspaceSymbols));
    }

    return items;
  }, [documentSymbols, workspaceSymbols, currentUri, showWorkspaceSymbols]);

  // Filter and sort items
  const filteredItems = useMemo(() => {
    if (!query.trim()) {
      // Show all items sorted by position
      return allItems.slice(0, MAX_RESULTS);
    }

    const scored = allItems.map(item => {
      const nameScore = scoreMatch(query, item.name);
      const containerScore = item.containerName ? scoreMatch(query, item.containerName) : 0;
      const detailScore = item.detail ? scoreMatch(query, item.detail) : 0;
      
      // Boost exact matches in name
      const score = Math.max(nameScore, containerScore * 0.8, detailScore * 0.6);
      
      return { ...item, score };
    }).filter(item => item.score > 0);

    // Sort by score descending, then by name
    scored.sort((a, b) => {
      if (b.score !== a.score) return (b.score || 0) - (a.score || 0);
      return a.name.localeCompare(b.name);
    });

    return scored.slice(0, MAX_RESULTS);
  }, [allItems, query]);

  // Handle selection
  const handleSelect = useCallback((item: PickerItem) => {
    onSelect(item.location);
    onClose();
  }, [onSelect, onClose]);

  // Handle keyboard navigation
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex(prev => 
          Math.min(prev + 1, filteredItems.length - 1)
        );
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex(prev => Math.max(prev - 1, 0));
        break;
      case 'Enter':
        e.preventDefault();
        if (filteredItems[selectedIndex]) {
          handleSelect(filteredItems[selectedIndex]);
        }
        break;
      case 'Escape':
        e.preventDefault();
        onClose();
        break;
      case 'Home':
        e.preventDefault();
        setSelectedIndex(0);
        break;
      case 'End':
        e.preventDefault();
        setSelectedIndex(filteredItems.length - 1);
        break;
      case 'PageUp':
        e.preventDefault();
        setSelectedIndex(prev => Math.max(prev - 10, 0));
        break;
      case 'PageDown':
        e.preventDefault();
        setSelectedIndex(prev => 
          Math.min(prev + 10, filteredItems.length - 1)
        );
        break;
    }
  }, [filteredItems, selectedIndex, handleSelect, onClose]);

  // Scroll selected item into view
  useEffect(() => {
    const selectedElement = listRef.current?.querySelector(
      `[data-index="${selectedIndex}"]`
    );
    selectedElement?.scrollIntoView({ block: 'nearest' });
  }, [selectedIndex]);

  // Handle backdrop click
  const handleBackdropClick = useCallback((e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  }, [onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="goto-symbol-picker-overlay"
      onClick={handleBackdropClick}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'center',
        paddingTop: '10vh',
        zIndex: 10000,
      }}
    >
      <div
        className="goto-symbol-picker"
        style={{
          width: 600,
          maxWidth: '90vw',
          backgroundColor: 'var(--picker-bg, #252526)',
          borderRadius: 6,
          boxShadow: '0 4px 20px rgba(0, 0, 0, 0.5)',
          display: 'flex',
          flexDirection: 'column',
          maxHeight: '70vh',
        }}
      >
        {/* Input */}
        <div
          style={{
            padding: '12px 16px',
            borderBottom: '1px solid var(--border-color, #3c3c3c)',
          }}
        >
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelectedIndex(0);
            }}
            onKeyDown={handleKeyDown}
            placeholder={showWorkspaceSymbols 
              ? 'Type symbol name in workspace...' 
              : 'Type symbol name in file...'}
            style={{
              width: '100%',
              padding: '8px 0',
              fontSize: 16,
              background: 'transparent',
              border: 'none',
              color: 'var(--picker-fg, #cccccc)',
              outline: 'none',
              fontFamily: 'var(--font-sans, system-ui, sans-serif)',
            }}
          />
          <div
            style={{
              fontSize: 11,
              color: 'var(--description-foreground, #858585)',
              marginTop: 4,
            }}
          >
            {showWorkspaceSymbols 
              ? 'Press @ to search in workspace' 
              : 'Press # for workspace symbols'}
          </div>
        </div>

        {/* Results list */}
        <div
          ref={listRef}
          style={{
            flex: 1,
            overflow: 'auto',
            padding: '4px 0',
          }}
        >
          {filteredItems.length === 0 ? (
            <div
              style={{
                padding: '20px 16px',
                textAlign: 'center',
                color: 'var(--description-foreground, #858585)',
              }}
            >
              {query ? 'No matching symbols found' : 'No symbols available'}
            </div>
          ) : (
            filteredItems.map((item, index) => {
              const isSelected = index === selectedIndex;
              
              return (
                <div
                  key={item.id}
                  data-index={index}
                  onClick={() => handleSelect(item)}
                  onMouseEnter={() => setSelectedIndex(index)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    padding: '8px 16px',
                    cursor: 'pointer',
                    backgroundColor: isSelected
                      ? 'var(--list-active-selection-bg, #094771)'
                      : 'transparent',
                    color: isSelected
                      ? 'var(--list-active-selection-fg, #ffffff)'
                      : 'var(--picker-fg, #cccccc)',
                  }}
                >
                  <SymbolIcon kind={item.kind} size="medium" />
                  
                  <div
                    style={{
                      marginLeft: 10,
                      flex: 1,
                      minWidth: 0,
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                      }}
                    >
                      <span
                        style={{
                          fontSize: 14,
                          fontWeight: 500,
                          fontFamily: 'var(--font-sans, system-ui, sans-serif)',
                        }}
                      >
                        {highlightMatch(item.name, query)}
                      </span>
                      
                      {item.detail && (
                        <span
                          style={{
                            fontSize: 12,
                            color: isSelected
                              ? 'var(--list-active-selection-fg, #ffffff)'
                              : 'var(--description-foreground, #858585)',
                            opacity: 0.8,
                            fontFamily: 'var(--font-mono, monospace)',
                          }}
                        >
                          {item.detail}
                        </span>
                      )}
                    </div>

                    <div
                      style={{
                        fontSize: 11,
                        color: isSelected
                          ? 'var(--list-active-selection-fg, #ffffff)'
                          : 'var(--description-foreground, #858585)',
                        opacity: 0.7,
                        marginTop: 2,
                      }}
                    >
                      {item.containerName && (
                        <span>{item.containerName} › </span>
                      )}
                      <span style={{ opacity: 0.7 }}>
                        {item.isWorkspace 
                          ? getFileName(item.location.uri)
                          : item.path?.slice(0, -1).join(' › ') || 'File'}
                      </span>
                    </div>
                  </div>

                  {/* Line number */}
                  <div
                    style={{
                      marginLeft: 8,
                      fontSize: 11,
                      color: isSelected
                        ? 'var(--list-active-selection-fg, #ffffff)'
                        : 'var(--description-foreground, #858585)',
                      opacity: 0.6,
                      fontFamily: 'var(--font-mono, monospace)',
                    }}
                  >
                    :{item.location.range.start.line + 1}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div
          style={{
            padding: '8px 16px',
            borderTop: '1px solid var(--border-color, #3c3c3c)',
            fontSize: 11,
            color: 'var(--description-foreground, #858585)',
            display: 'flex',
            justifyContent: 'space-between',
          }}
        >
          <span>
            {filteredItems.length} of {allItems.length} symbols
          </span>
          <span>
            ↑↓ to navigate • Enter to select • Esc to close
          </span>
        </div>
      </div>
    </div>
  );
});

GoToSymbolPicker.displayName = 'GoToSymbolPicker';

/**
 * Get file name from URI
 */
const getFileName = (uri: string): string => {
  try {
    const url = new URL(uri);
    const pathParts = url.pathname.split('/');
    return pathParts[pathParts.length - 1] || uri;
  } catch {
    const parts = uri.split('/');
    return parts[parts.length - 1] || uri;
  }
};

/**
 * Highlight matching text
 */
const highlightMatch = (text: string, query: string): React.ReactNode => {
  if (!query) return text;

  const lowerText = text.toLowerCase();
  const lowerQuery = query.toLowerCase();
  const parts: React.ReactNode[] = [];
  let lastIndex = 0;

  // Simple highlighting for now
  let queryIndex = 0;
  for (let i = 0; i < text.length && queryIndex < query.length; i++) {
    if (lowerText[i] === lowerQuery[queryIndex]) {
      if (i > lastIndex) {
        parts.push(text.slice(lastIndex, i));
      }
      parts.push(
        <mark
          key={i}
          style={{
            backgroundColor: 'transparent',
            color: 'var(--picker-highlight-fg, #4ec9b0)',
            fontWeight: 600,
          }}
        >
          {text[i]}
        </mark>
      );
      lastIndex = i + 1;
      queryIndex++;
    }
  }

  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }

  return parts.length > 0 ? parts : text;
};

export default GoToSymbolPicker;
