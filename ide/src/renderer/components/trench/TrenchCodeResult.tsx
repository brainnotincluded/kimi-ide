/**
 * TrenchCodeResult - Component for displaying Trench code search results
 */

import React from 'react';

export interface CodeResultItem {
  file: string;
  line: number;
  content: string;
  repository?: string;
  language?: string;
  score?: number;
}

interface TrenchCodeResultProps {
  results: CodeResultItem[];
  onFileClick?: (file: string, line: number) => void;
}

export const TrenchCodeResult: React.FC<TrenchCodeResultProps> = ({
  results,
  onFileClick
}) => {
  if (results.length === 0) {
    return (
      <div className="trench-empty-results">
        <p>No code results found</p>
      </div>
    );
  }

  const getLanguageFromFile = (file: string): string => {
    const ext = file.split('.').pop()?.toLowerCase();
    const langMap: Record<string, string> = {
      'ts': 'typescript',
      'tsx': 'tsx',
      'js': 'javascript',
      'jsx': 'jsx',
      'py': 'python',
      'rs': 'rust',
      'go': 'go',
      'java': 'java',
      'cpp': 'cpp',
      'c': 'c',
      'h': 'c',
      'cs': 'csharp',
      'rb': 'ruby',
      'php': 'php',
      'swift': 'swift',
      'kt': 'kotlin'
    };
    return langMap[ext || ''] || 'text';
  };

  return (
    <div className="trench-code-results">
      {results.map((result, index) => (
        <div key={index} className="trench-code-item">
          <div className="trench-code-header">
            <span className="trench-code-number">{index + 1}</span>
            <div className="trench-code-file-info">
              <span 
                className="trench-code-file"
                onClick={() => onFileClick?.(result.file, result.line)}
              >
                {result.file}:{result.line}
              </span>
              {result.repository && (
                <span className="trench-code-repo">{result.repository}</span>
              )}
            </div>
            <span className={`trench-code-lang ${getLanguageFromFile(result.file)}`}>
              {getLanguageFromFile(result.file)}
            </span>
          </div>
          <pre className="trench-code-content">
            <code>{result.content}</code>
          </pre>
        </div>
      ))}
    </div>
  );
};
