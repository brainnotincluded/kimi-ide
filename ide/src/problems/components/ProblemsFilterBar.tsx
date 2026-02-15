/**
 * Problems Filter Bar Component
 * IDE Kimi IDE - Filter buttons for problems panel
 */

import React from 'react';
import { ProblemsFilter, ProblemsGroupBy, ProblemsCount } from '../types';

interface ProblemsFilterBarProps {
  filter: ProblemsFilter;
  groupBy: ProblemsGroupBy;
  counts: ProblemsCount;
  onFilterChange: (filter: Partial<ProblemsFilter>) => void;
  onGroupByChange: (groupBy: ProblemsGroupBy) => void;
  onExpandAll: () => void;
  onCollapseAll: () => void;
  onClearAll: () => void;
}

export const ProblemsFilterBar: React.FC<ProblemsFilterBarProps> = ({
  filter,
  groupBy,
  counts,
  onFilterChange,
  onGroupByChange,
  onExpandAll,
  onCollapseAll,
  onClearAll,
}) => {
  return (
    <div style={styles.container}>
      {/* Severity Filters */}
      <div style={styles.filterGroup}>
        <FilterButton
          active={filter.errors}
          count={counts.errors}
          color="#f44336"
          label="Errors"
          onClick={() => onFilterChange({ errors: !filter.errors })}
        />
        <FilterButton
          active={filter.warnings}
          count={counts.warnings}
          color="#ff9800"
          label="Warnings"
          onClick={() => onFilterChange({ warnings: !filter.warnings })}
        />
        <FilterButton
          active={filter.information}
          count={counts.information}
          color="#2196f3"
          label="Info"
          onClick={() => onFilterChange({ information: !filter.information })}
        />
      </div>

      {/* Separator */}
      <div style={styles.separator} />

      {/* Group By */}
      <div style={styles.groupBy}>
        <select
          style={styles.select}
          value={groupBy}
          onChange={(e) => onGroupByChange(e.target.value as ProblemsGroupBy)}
          title="Group By"
        >
          <option value="file">Group by File</option>
          <option value="severity">Group by Severity</option>
          <option value="source">Group by Source</option>
          <option value="none">No Grouping</option>
        </select>
      </div>

      {/* Separator */}
      <div style={styles.separator} />

      {/* Actions */}
      <div style={styles.actions}>
        <button style={styles.iconButton} onClick={onExpandAll} title="Expand All">
          <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
            <path d="M8 4a.5.5 0 0 1 .5.5v3h3a.5.5 0 0 1 0 1h-3v3a.5.5 0 0 1-1 0v-3h-3a.5.5 0 0 1 0-1h3v-3A.5.5 0 0 1 8 4z" />
          </svg>
        </button>
        <button style={styles.iconButton} onClick={onCollapseAll} title="Collapse All">
          <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
            <path d="M4 8a.5.5 0 0 1 .5-.5h7a.5.5 0 0 1 0 1h-7A.5.5 0 0 1 4 8z" />
          </svg>
        </button>
        <button style={styles.iconButton} onClick={onClearAll} title="Clear All">
          <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
            <path d="M5.5 5.5A.5.5 0 0 1 6 6v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm2.5 0a.5.5 0 0 1 .5.5v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm3 .5a.5.5 0 0 0-1 0v6a.5.5 0 0 0 1 0V6z" />
            <path d="M14.5 3a1 1 0 0 1-1 1H13v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V4h-.5a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1H6a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1h3.5a1 1 0 0 1 1 1v1zM4.118 4 4 4.059V13a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1V4.059L11.882 4H4.118zM2.5 3V2h11v1h-11z" />
          </svg>
        </button>
      </div>
    </div>
  );
};

interface FilterButtonProps {
  active: boolean;
  count: number;
  color: string;
  label: string;
  onClick: () => void;
}

const FilterButton: React.FC<FilterButtonProps> = ({ active, count, color, label, onClick }) => {
  return (
    <button
      style={{
        ...styles.filterButton,
        ...(active ? styles.filterButtonActive : {}),
      }}
      onClick={onClick}
      title={`${label}: ${count}`}
    >
      <span
        style={{
          ...styles.filterDot,
          backgroundColor: active ? color : '#555555',
        }}
      />
      <span style={styles.filterLabel}>{label}</span>
      <span
        style={{
          ...styles.filterCount,
          color: active ? '#cccccc' : '#666666',
        }}
      >
        {count}
      </span>
    </button>
  );
};

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex',
    alignItems: 'center',
    padding: '6px 12px',
    backgroundColor: '#252526',
    borderBottom: '1px solid #2d2d2d',
    gap: '8px',
  },
  filterGroup: {
    display: 'flex',
    gap: '4px',
  },
  filterButton: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    padding: '4px 10px',
    backgroundColor: 'transparent',
    border: '1px solid #3c3c3c',
    borderRadius: '3px',
    color: '#858585',
    fontSize: '12px',
    cursor: 'pointer',
    transition: 'all 0.15s',
  },
  filterButtonActive: {
    backgroundColor: '#2d2d2d',
    borderColor: '#505050',
  },
  filterDot: {
    width: '8px',
    height: '8px',
    borderRadius: '50%',
  },
  filterLabel: {
    fontWeight: 500,
  },
  filterCount: {
    fontSize: '11px',
    minWidth: '16px',
    textAlign: 'center',
  },
  separator: {
    width: '1px',
    height: '20px',
    backgroundColor: '#3c3c3c',
    margin: '0 4px',
  },
  groupBy: {
    display: 'flex',
    alignItems: 'center',
  },
  select: {
    padding: '4px 8px',
    backgroundColor: '#3c3c3c',
    border: '1px solid #3c3c3c',
    borderRadius: '3px',
    color: '#cccccc',
    fontSize: '12px',
    cursor: 'pointer',
    outline: 'none',
  },
  actions: {
    display: 'flex',
    gap: '4px',
    marginLeft: 'auto',
  },
  iconButton: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '24px',
    height: '24px',
    padding: 0,
    backgroundColor: 'transparent',
    border: 'none',
    borderRadius: '3px',
    color: '#858585',
    cursor: 'pointer',
    transition: 'all 0.15s',
  },
};

export default ProblemsFilterBar;
