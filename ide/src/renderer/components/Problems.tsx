import React, { useState } from 'react';
import './Problems.css';

interface Diagnostic {
  file: string;
  line: number;
  column?: number;
  severity: 'error' | 'warning' | 'info';
  message: string;
  source?: string;
  code?: string;
}

interface ProblemsProps {
  diagnostics?: Diagnostic[];
}

type FilterType = 'all' | 'error' | 'warning';

export const Problems: React.FC<ProblemsProps> = ({ diagnostics = [] }) => {
  const [filter, setFilter] = useState<FilterType>('all');
  
  const filtered = diagnostics.filter(d => 
    filter === 'all' ? true : d.severity === filter
  );

  const errorCount = diagnostics.filter(d => d.severity === 'error').length;
  const warningCount = diagnostics.filter(d => d.severity === 'warning').length;

  const getIconClass = (severity: string) => {
    switch (severity) {
      case 'error': return 'error';
      case 'warning': return 'warning';
      case 'info': return 'info';
      default: return 'info';
    }
  };

  const handleClick = (diagnostic: Diagnostic) => {
    // TODO: Navigate to the file and position
    console.log('Navigate to:', diagnostic);
  };

  return (
    <div className="problems-panel">
      <div className="problems-header">
        <button 
          className={`problems-filter ${filter === 'all' ? 'active' : ''}`}
          onClick={() => setFilter('all')}
        >
          All
        </button>
        <button 
          className={`problems-filter ${filter === 'error' ? 'active' : ''}`}
          onClick={() => setFilter('error')}
        >
          Errors
        </button>
        <button 
          className={`problems-filter ${filter === 'warning' ? 'active' : ''}`}
          onClick={() => setFilter('warning')}
        >
          Warnings
        </button>
        <span className="problems-stats">
          {errorCount} errors, {warningCount} warnings
        </span>
      </div>
      <div className="problems-list">
        {filtered.length === 0 ? (
          <div className="problems-empty">
            No problems have been detected in the workspace.
          </div>
        ) : (
          filtered.map((d, i) => (
            <div 
              key={i} 
              className="problem-item"
              onClick={() => handleClick(d)}
            >
              <div className={`problem-icon ${getIconClass(d.severity)}`} />
              <div className="problem-details">
                <div className="problem-message">{d.message}</div>
                <div className="problem-source">
                  <span className="problem-file">
                    {d.file}:{d.line}{d.column !== undefined ? `:${d.column}` : ''}
                  </span>
                  {d.source && (
                    <span className="problem-code">
                      [{d.source}]
                    </span>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
