/**
 * Task Output Panel Component
 * Displays task output with filtering and problem navigation
 */

import React, { useRef, useEffect, useState, useCallback } from 'react';
import './TaskOutputPanel.css';
import {
  TaskOutputLine,
  TaskProblem,
  TaskStatus,
} from '../types';

interface TaskOutputPanelProps {
  taskId: string;
  taskName: string;
  status: TaskStatus;
  lines: TaskOutputLine[];
  onClear: () => void;
  onStop: () => void;
  onRestart: () => void;
  onProblemClick?: (problem: TaskProblem) => void;
  autoScroll?: boolean;
}

type FilterType = 'all' | 'stdout' | 'stderr' | 'problems';

export const TaskOutputPanel: React.FC<TaskOutputPanelProps> = ({
  taskId,
  taskName,
  status,
  lines,
  onClear,
  onStop,
  onRestart,
  onProblemClick,
  autoScroll: autoScrollProp = true,
}) => {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [filter, setFilter] = useState<FilterType>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [autoScroll, setAutoScroll] = useState(autoScrollProp);
  const [isUserScrolling, setIsUserScrolling] = useState(false);

  const filteredLines = React.useMemo(() => {
    let result = lines;

    if (filter === 'stdout') {
      result = lines.filter(l => l.type === 'stdout');
    } else if (filter === 'stderr') {
      result = lines.filter(l => l.type === 'stderr' || l.type === 'error');
    } else if (filter === 'problems') {
      result = lines.filter(l => l.problem);
    }

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(l => l.content.toLowerCase().includes(query));
    }

    return result;
  }, [lines, filter, searchQuery]);

  const problems = React.useMemo(() => {
    return lines.filter(l => l.problem).map(l => l.problem!);
  }, [lines]);

  const errorCount = problems.filter(p => p.severity === 'error').length;
  const warningCount = problems.filter(p => p.severity === 'warning').length;

  // Auto-scroll to bottom
  useEffect(() => {
    if (autoScroll && scrollRef.current && !isUserScrolling) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [filteredLines, autoScroll, isUserScrolling]);

  const handleScroll = useCallback(() => {
    if (scrollRef.current) {
      const { scrollTop, scrollHeight, clientHeight } = scrollRef.current;
      const isAtBottom = scrollHeight - scrollTop - clientHeight < 50;
      setIsUserScrolling(!isAtBottom);
    }
  }, []);

  const getLineClass = (type: TaskOutputLine['type']): string => {
    switch (type) {
      case 'stdout': return 'stdout';
      case 'stderr': return 'stderr';
      case 'error': return 'error';
      case 'success': return 'success';
      case 'info': return 'info';
      default: return 'stdout';
    }
  };

  const getStatusIcon = (): string => {
    switch (status) {
      case 'running': return '⏳';
      case 'success': return '✅';
      case 'error': return '❌';
      case 'cancelled': return '⏹️';
      default: return '⏸️';
    }
  };

  const getStatusColor = (): string => {
    switch (status) {
      case 'running': return '#73c991';
      case 'success': return '#73c991';
      case 'error': return '#f48771';
      case 'cancelled': return '#858585';
      default: return '#858585';
    }
  };

  const handleLineClick = useCallback((line: TaskOutputLine) => {
    if (line.problem && onProblemClick) {
      onProblemClick(line.problem);
    }
  }, [onProblemClick]);

  const scrollToProblem = useCallback((problem: TaskProblem) => {
    const index = lines.findIndex(l => l.problem === problem);
    if (index >= 0 && scrollRef.current) {
      const lineElement = scrollRef.current.querySelector(`[data-line-index="${index}"]`);
      if (lineElement) {
        lineElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }
  }, [lines]);

  return (
    <div className="task-output-panel">
      <div className="task-output-panel__header">
        <div className="task-output-panel__title">
          <span className="task-output-panel__status-icon" style={{ color: getStatusColor() }}>
            {getStatusIcon()}
          </span>
          <span className="task-output-panel__task-name">{taskName}</span>
          <span className="task-output-panel__task-id">({taskId})</span>
        </div>

        <div className="task-output-panel__stats">
          {errorCount > 0 && (
            <span className="task-output-panel__stat error">
              {errorCount} Errors
            </span>
          )}
          {warningCount > 0 && (
            <span className="task-output-panel__stat warning">
              {warningCount} Warnings
            </span>
          )}
          <span className="task-output-panel__stat">{lines.length} Lines</span>
        </div>

        <div className="task-output-panel__actions">
          <button
            className="task-output-panel__action-btn"
            onClick={() => setAutoScroll(!autoScroll)}
            title={autoScroll ? 'Disable auto-scroll' : 'Enable auto-scroll'}
            style={{ color: autoScroll ? '#73c991' : '#858585' }}
          >
            ⬇️
          </button>
          
          {status === 'running' ? (
            <button
              className="task-output-panel__action-btn stop"
              onClick={onStop}
              title="Stop"
            >
              ⏹️
            </button>
          ) : (
            <button
              className="task-output-panel__action-btn"
              onClick={onRestart}
              title="Restart"
            >
              🔄
            </button>
          )}
          
          <button
            className="task-output-panel__action-btn"
            onClick={onClear}
            title="Clear"
          >
            🗑️
          </button>
        </div>
      </div>

      <div className="task-output-panel__toolbar">
        <div className="task-output-panel__filters">
          <button
            className={`task-output-panel__filter-btn ${filter === 'all' ? 'active' : ''}`}
            onClick={() => setFilter('all')}
          >
            All
          </button>
          <button
            className={`task-output-panel__filter-btn ${filter === 'stdout' ? 'active' : ''}`}
            onClick={() => setFilter('stdout')}
          >
            Output
          </button>
          <button
            className={`task-output-panel__filter-btn ${filter === 'stderr' ? 'active' : ''}`}
            onClick={() => setFilter('stderr')}
          >
            Errors
          </button>
          <button
            className={`task-output-panel__filter-btn ${filter === 'problems' ? 'active' : ''}`}
            onClick={() => setFilter('problems')}
          >
            Problems
            {problems.length > 0 && (
              <span className="task-output-panel__filter-badge">{problems.length}</span>
            )}
          </button>
        </div>

        <div className="task-output-panel__search">
          <input
            type="text"
            placeholder="Search output..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="task-output-panel__search-input"
          />
          {searchQuery && (
            <span className="task-output-panel__search-count">
              {filteredLines.length} / {lines.length}
            </span>
          )}
        </div>
      </div>

      {/* Problems List (when filter is 'problems') */}
      {filter === 'problems' && problems.length > 0 && (
        <div className="task-output-panel__problems">
          {problems.map((problem, index) => (
            <div
              key={index}
              className={`task-output-panel__problem ${problem.severity}`}
              onClick={() => {
                scrollToProblem(problem);
                onProblemClick?.(problem);
              }}
            >
              <span className="task-output-panel__problem-icon">
                {problem.severity === 'error' ? '❌' : '⚠️'}
              </span>
              <span className="task-output-panel__problem-file">
                {problem.file.split('/').pop()}
              </span>
              <span className="task-output-panel__problem-location">
                {problem.line}{problem.column ? `:${problem.column}` : ''}
              </span>
              <span className="task-output-panel__problem-message">
                {problem.message}
              </span>
              {problem.code && (
                <span className="task-output-panel__problem-code">
                  {problem.code}
                </span>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Output Lines */}
      <div
        ref={scrollRef}
        className="task-output-panel__content"
        onScroll={handleScroll}
      >
        {filteredLines.map((line, index) => (
          <div
            key={index}
            data-line-index={lines.indexOf(line)}
            className={`task-output-panel__line ${getLineClass(line.type)} ${line.problem ? 'has-problem' : ''}`}
            onClick={() => handleLineClick(line)}
            title={line.problem ? `${line.problem.file}:${line.problem.line}: ${line.problem.message}` : undefined}
          >
            <span className="task-output-panel__line-timestamp">
              {line.timestamp.toLocaleTimeString('en-US', { 
                hour12: false, 
                hour: '2-digit', 
                minute: '2-digit',
                second: '2-digit'
              })}
            </span>
            <span className="task-output-panel__line-content">
              {line.content || ' '}
            </span>
            {line.problem && (
              <span className="task-output-panel__line-problem-icon">
                {line.problem.severity === 'error' ? '❌' : '⚠️'}
              </span>
            )}
          </div>
        ))}

        {filteredLines.length === 0 && (
          <div className="task-output-panel__empty">
            {lines.length === 0 ? (
              <>
                <div className="task-output-panel__empty-icon">📋</div>
                <div>No output yet</div>
                <small>Run a task to see output here</small>
              </>
            ) : filter === 'problems' ? (
              <>
                <div className="task-output-panel__empty-icon">✅</div>
                <div>No problems detected</div>
              </>
            ) : (
              <>
                <div className="task-output-panel__empty-icon">🔍</div>
                <div>No matching lines</div>
              </>
            )}
          </div>
        )}

        {status === 'running' && (
          <div className="task-output-panel__running-indicator">
            <span className="task-output-panel__spinner" />
            <span>Task is running...</span>
          </div>
        )}
      </div>
    </div>
  );
};

export default TaskOutputPanel;
