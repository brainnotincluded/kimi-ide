import React, { useEffect, useState } from 'react';

interface StatusBarProps {
  activeFile: string | null;
  activeLanguage: string | null;
  workspace: string | null;
  isDebugging?: boolean;
}

const StatusBar: React.FC<StatusBarProps> = ({
  activeFile,
  activeLanguage,
  workspace,
  isDebugging = false,
}) => {
  const [cursorPosition, setCursorPosition] = useState({ line: 1, column: 1 });
  const [gitInfo, setGitInfo] = useState<{ branch: string; changes: number } | null>(null);
  const [aiConnected, setAiConnected] = useState(true);
  const [problemsCount, setProblemsCount] = useState({ errors: 0, warnings: 0 });

  // Get file type from extension or language
  const getFileType = (filePath: string | null, language: string | null): string => {
    if (language) {
      const languageMap: Record<string, string> = {
        typescript: 'TypeScript',
        javascript: 'JavaScript',
        python: 'Python',
        java: 'Java',
        cpp: 'C++',
        go: 'Go',
        rust: 'Rust',
      };
      if (languageMap[language]) {
        return languageMap[language];
      }
    }

    if (!filePath) return 'Plain Text';
    const ext = filePath.split('.').pop()?.toLowerCase();
    const typeMap: Record<string, string> = {
      ts: 'TypeScript',
      tsx: 'TypeScript React',
      js: 'JavaScript',
      jsx: 'JavaScript React',
      mjs: 'JavaScript Module',
      cjs: 'CommonJS',
      py: 'Python',
      pyw: 'Python',
      pyi: 'Python Stub',
      json: 'JSON',
      jsonc: 'JSON with Comments',
      md: 'Markdown',
      mdx: 'MDX',
      css: 'CSS',
      scss: 'SCSS',
      sass: 'Sass',
      less: 'Less',
      html: 'HTML',
      htm: 'HTML',
      xml: 'XML',
      yaml: 'YAML',
      yml: 'YAML',
      rs: 'Rust',
      go: 'Go',
      java: 'Java',
      kt: 'Kotlin',
      kts: 'Kotlin Script',
      scala: 'Scala',
      cpp: 'C++',
      cc: 'C++',
      cxx: 'C++',
      c: 'C',
      h: 'C Header',
      hpp: 'C++ Header',
      cs: 'C#',
      rb: 'Ruby',
      php: 'PHP',
      swift: 'Swift',
      sql: 'SQL',
      sh: 'Shell',
      bash: 'Bash',
      zsh: 'Zsh',
      dockerfile: 'Dockerfile',
      toml: 'TOML',
      ini: 'INI',
      cfg: 'Config',
    };
    return typeMap[ext || ''] || 'Plain Text';
  };

  // Simulate git info fetch
  useEffect(() => {
    if (workspace) {
      // In real implementation, this would fetch actual git info
      setGitInfo({ branch: 'main', changes: 0 });
    } else {
      setGitInfo(null);
    }
  }, [workspace]);

  // Listen to editor cursor position updates
  useEffect(() => {
    const handleCursorUpdate = (e: CustomEvent<{ line: number; column: number }>) => {
      setCursorPosition(e.detail);
    };

    window.addEventListener('editor:cursorChange' as any, handleCursorUpdate);
    return () => {
      window.removeEventListener('editor:cursorChange' as any, handleCursorUpdate);
    };
  }, []);

  const fileType = getFileType(activeFile, activeLanguage);

  return (
    <div style={styles.container}>
      {/* Left Section - Debug, Git & File Info */}
      <div style={styles.leftSection}>
        {/* Debug Indicator */}
        {isDebugging && (
          <div style={styles.debugIndicator}>
            <span style={styles.debugIcon}>●</span>
            <span>Debugging</span>
          </div>
        )}

        {/* Problems Count */}
        {(problemsCount.errors > 0 || problemsCount.warnings > 0) && (
          <div style={styles.problemsIndicator}>
            {problemsCount.errors > 0 && (
              <span style={styles.errorCount}>{problemsCount.errors} Errors</span>
            )}
            {problemsCount.warnings > 0 && (
              <span style={styles.warningCount}>{problemsCount.warnings} Warnings</span>
            )}
          </div>
        )}

        {/* Git Info */}
        {gitInfo && (
          <div style={styles.gitInfo}>
            <svg style={styles.icon} viewBox="0 0 16 16" fill="currentColor">
              <path d="M4.72 3.22a.75.75 0 011.06 1.06L2.06 8l3.72 3.72a.75.75 0 11-1.06 1.06L.47 8.53a.75.75 0 010-1.06l4.25-4.25zm6.56 0a.75.75 0 10-1.06 1.06L13.94 8l-3.72 3.72a.75.75 0 101.06 1.06l4.25-4.25a.75.75 0 000-1.06l-4.25-4.25z"/>
            </svg>
            <span style={styles.branchName}>{gitInfo.branch}</span>
            {gitInfo.changes > 0 && (
              <span style={styles.changesBadge}>
                <span style={styles.dot} />{gitInfo.changes}
              </span>
            )}
          </div>
        )}
      </div>

      {/* Center Section - Cursor Position & File Info */}
      <div style={styles.centerSection}>
        {activeFile && (
          <>
            <span style={styles.fileType}>{fileType}</span>
            <span style={styles.separator}>|</span>
            <span style={styles.encoding}>UTF-8</span>
            <span style={styles.separator}>|</span>
            <span style={styles.cursorPos}>
              Ln {cursorPosition.line}, Col {cursorPosition.column}
            </span>
          </>
        )}
      </div>

      {/* Right Section - AI Status */}
      <div style={styles.rightSection}>
        {/* AI Connection Indicator */}
        <div style={styles.aiIndicator} title={aiConnected ? 'AI Connected' : 'AI Disconnected'}>
          <div style={{ ...styles.aiDot, backgroundColor: aiConnected ? '#4ade80' : '#ef4444' }} />
          <svg style={styles.aiIcon} viewBox="0 0 16 16" fill="currentColor">
            <path d="M9.793 2.143a.75.75 0 01-.351.92 7.3 7.3 0 00-.805.408.75.75 0 01-1.077-.64V2.047a.75.75 0 01.502-.708 8.13 8.13 0 011.457-.387.75.75 0 01.274 1.191zM7.534 4.232a.75.75 0 01-.526.919 9.9 9.9 0 00-1.135.41.75.75 0 11-.612-1.37c.407-.18.82-.338 1.24-.473a.75.75 0 011.033.514zM5.236 7.093a.75.75 0 11.612 1.37c-.42.135-.833.293-1.24.473a.75.75 0 11-.612-1.37c.385-.151.773-.28 1.168-.387a.75.75 0 01.072-.086zM3.674 10.374a.75.75 0 01-.275-1.025 8.137 8.137 0 011.085-1.365.75.75 0 011.1 1.02 6.636 6.636 0 00-.886 1.115.75.75 0 01-1.024.255zM2.182 13.544a.75.75 0 01.336-.93 6.35 6.35 0 001.353-1.02.75.75 0 111.036 1.083 7.85 7.85 0 01-1.67 1.261.75.75 0 01-1.055-.394z"/>
            <path d="M7.354 15.854a.5.5 0 00.707 0l3-3a.5.5 0 00-.707-.707L8 14.293V4.5a.5.5 0 00-1 0v9.793l-2.354-2.146a.5.5 0 00-.707.707l3 3z"/>
          </svg>
          <span style={styles.aiText}>AI</span>
        </div>
      </div>
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    height: '24px',
    padding: '0 12px',
    backgroundColor: '#007acc',
    fontSize: '12px',
    color: '#ffffff',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    userSelect: 'none',
  },
  leftSection: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
  },
  centerSection: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  rightSection: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  debugIndicator: {
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
    padding: '2px 8px',
    backgroundColor: '#cc6633',
    borderRadius: '3px',
    fontWeight: 500,
  },
  debugIcon: {
    color: '#ff6b6b',
    fontSize: '10px',
  },
  problemsIndicator: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  errorCount: {
    color: '#ff6b6b',
    fontWeight: 500,
  },
  warningCount: {
    color: '#f1c40f',
    fontWeight: 500,
  },
  gitInfo: {
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
    cursor: 'pointer',
    padding: '2px 6px',
    borderRadius: '3px',
    transition: 'background-color 0.15s',
  },
  branchName: {
    color: '#ffffff',
  },
  changesBadge: {
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
    color: '#f1c40f',
  },
  dot: {
    width: '6px',
    height: '6px',
    borderRadius: '50%',
    backgroundColor: '#f1c40f',
  },
  separator: {
    color: 'rgba(255, 255, 255, 0.5)',
  },
  fileType: {
    color: '#ffffff',
  },
  encoding: {
    color: '#ffffff',
  },
  cursorPos: {
    color: '#ffffff',
    padding: '2px 6px',
    borderRadius: '3px',
  },
  icon: {
    width: '14px',
    height: '14px',
  },
  aiIndicator: {
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
    padding: '2px 8px',
    borderRadius: '3px',
    cursor: 'pointer',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  aiDot: {
    width: '6px',
    height: '6px',
    borderRadius: '50%',
  },
  aiIcon: {
    width: '12px',
    height: '12px',
  },
  aiText: {
    fontSize: '11px',
    fontWeight: 500,
  },
};

export { StatusBar };
export default StatusBar;
