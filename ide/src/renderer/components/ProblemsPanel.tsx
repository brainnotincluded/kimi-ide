import React, { useState, useEffect } from 'react';
import './ProblemsPanel.css';

const { ipcRenderer } = window.require('electron');

interface Problem {
  file: string;
  line: number;
  column?: number;
  severity: 'error' | 'warning' | 'info';
  message: string;
  source?: string;
  code?: string;
}

export const ProblemsPanel: React.FC = () => {
  const [problems, setProblems] = useState<Problem[]>([]);
  const [filter, setFilter] = useState<'all' | 'error' | 'warning' | 'info'>('all');

  useEffect(() => {
    // Load initial problems
    ipcRenderer.invoke('problems:getAll').then((allProblems: Problem[]) => {
      setProblems(allProblems);
    });

    // Listen for updates
    const handleUpdate = (_: any, allProblems: Problem[]) => {
      setProblems(allProblems);
    };

    ipcRenderer.on('problems:updated', handleUpdate);

    return () => {
      ipcRenderer.off('problems:updated', handleUpdate);
    };
  }, []);

  const filteredProblems = problems.filter(p => {
    if (filter === 'all') return true;
    return p.severity === filter;
  });

  const errors = problems.filter(p => p.severity === 'error').length;
  const warnings = problems.filter(p => p.severity === 'warning').length;
  const infos = problems.filter(p => p.severity === 'info').length;

  const handleClick = (problem: Problem) => {
    // Open file at line
    ipcRenderer.send('file:openAtLine', problem.file, problem.line);
  };

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'error': return '●';
      case 'warning': return '●';
      case 'info': return '●';
      default: return '●';
    }
  };

  const getSeverityClass = (severity: string) => {
    return `problem-item ${severity}`;
  };

  return (
    <div className="problems-panel">
      <div className="problems-header">
        <div className="problems-filters">
          <button 
            className={`filter-btn ${filter === 'all' ? 'active' : ''}`}
            onClick={() => setFilter('all')}
          >
            All ({problems.length})
          </button>
          <button 
            className={`filter-btn ${filter === 'error' ? 'active' : ''} error`}
            onClick={() => setFilter('error')}
          >
            Errors ({errors})
          </button>
          <button 
            className={`filter-btn ${filter === 'warning' ? 'active' : ''} warning`}
            onClick={() => setFilter('warning')}
          >
            Warnings ({warnings})
          </button>
          <button 
            className={`filter-btn ${filter === 'info' ? 'active' : ''} info`}
            onClick={() => setFilter('info')}
          >
            Info ({infos})
          </button>
        </div>
        <button 
          className="clear-btn"
          onClick={() => ipcRenderer.invoke('problems:clear')}
        >
          Clear All
        </button>
      </div>
      <div className="problems-list">
        {filteredProblems.length === 0 ? (
          <div className="problems-empty">
            No problems detected
          </div>
        ) : (
          filteredProblems.map((problem, index) => (
            <div 
              key={index}
              className={getSeverityClass(problem.severity)}
              onClick={() => handleClick(problem)}
            >
              <span className="severity-icon">{getSeverityIcon(problem.severity)}</span>
              <div className="problem-content">
                <div className="problem-message">{problem.message}</div>
                <div className="problem-location">
                  {problem.file.split('/').pop()}:{problem.line}
                  {problem.column ? `:${problem.column}` : ''}
                  {problem.source && ` [${problem.source}]`}
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
