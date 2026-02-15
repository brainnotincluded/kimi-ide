import React, { useState, useEffect, useCallback } from 'react';
import './WelcomeScreen.css';

interface WelcomeScreenProps {
  onOpenFolder: () => void;
}

// SVG Icons
const FolderIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
  </svg>
);

const PlusIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <line x1="12" y1="5" x2="12" y2="19"/>
    <line x1="5" y1="12" x2="19" y2="12"/>
  </svg>
);

const ClockIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <circle cx="12" cy="12" r="10"/>
    <polyline points="12 6 12 12 16 14"/>
  </svg>
);

const ChevronRightIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <polyline points="9 18 15 12 9 6"/>
  </svg>
);

const CommandIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M18 3a3 3 0 0 0-3 3v12a3 3 0 0 0 3 3 3 3 0 0 0 3-3 3 3 0 0 0-3-3H6a3 3 0 0 0-3 3 3 3 0 0 0 3 3 3 3 0 0 0 3-3V6a3 3 0 0 0-3-3 3 3 0 0 0-3 3 3 3 0 0 0 3 3h12a3 3 0 0 0 3-3 3 3 0 0 0-3-3z"/>
  </svg>
);

// Logo "T"
const LogoIcon = () => (
  <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#7c9a6d" strokeWidth="2">
    <line x1="4" y1="6" x2="20" y2="6"/>
    <line x1="12" y1="6" x2="12" y2="20"/>
  </svg>
);

interface RecentProject {
  id: string;
  name: string;
  path: string;
  lastOpened: string;
}

export const WelcomeScreen: React.FC<WelcomeScreenProps> = ({ onOpenFolder }) => {
  const [recentProjects, setRecentProjects] = useState<RecentProject[]>([]);

  useEffect(() => {
    const loadRecent = () => {
      try {
        const saved = localStorage.getItem('traitor-recent-projects');
        if (saved) {
          const parsed = JSON.parse(saved);
          setRecentProjects(parsed.slice(0, 5));
        }
      } catch {
        // ignore
      }
    };
    loadRecent();
  }, []);

  const handleOpenProject = (path: string) => {
    console.log('Open project:', path);
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    
    if (days === 0) return 'Today';
    if (days === 1) return 'Yesterday';
    if (days < 7) return `${days}d ago`;
    return date.toLocaleDateString();
  };

  const shortcuts = [
    { key: 'Open Folder', shortcut: '⌘O' },
    { key: 'New File', shortcut: '⌘N' },
    { key: 'Command Palette', shortcut: '⌘⇧P' },
    { key: 'Toggle Terminal', shortcut: '⌘J' },
  ];

  return (
    <div className="welcome-screen">
      <div className="welcome-content">
        {/* Header */}
        <div className="welcome-header">
          <div className="welcome-logo">
            <LogoIcon />
          </div>
          <h1 className="welcome-title">TRAITOR</h1>
          <p className="welcome-subtitle">A code editor</p>
        </div>

        {/* Start Section */}
        <section className="welcome-section">
          <h2 className="section-title">Start</h2>
          <div className="welcome-actions">
            <button className="welcome-btn primary" onClick={onOpenFolder}>
              <FolderIcon />
              <span>Open Folder</span>
              <kbd className="key-hint">⌘O</kbd>
            </button>
            <button className="welcome-btn secondary">
              <PlusIcon />
              <span>New File</span>
              <kbd className="key-hint">⌘N</kbd>
            </button>
          </div>
        </section>

        {/* Recent Projects */}
        {recentProjects.length > 0 && (
          <section className="welcome-section">
            <div className="section-header">
              <h2 className="section-title">
                <ClockIcon />
                Recent
              </h2>
              <button 
                className="clear-btn"
                onClick={() => {
                  localStorage.removeItem('traitor-recent-projects');
                  setRecentProjects([]);
                }}
              >
                Clear
              </button>
            </div>
            
            <div className="recent-list">
              {recentProjects.map((project) => (
                <button
                  key={project.id}
                  className="recent-item"
                  onClick={() => handleOpenProject(project.path)}
                >
                  <div className="recent-info">
                    <span className="recent-name">{project.name}</span>
                    <span className="recent-path">{project.path}</span>
                  </div>
                  <span className="recent-date">{formatDate(project.lastOpened)}</span>
                  <ChevronRightIcon />
                </button>
              ))}
            </div>
          </section>
        )}

        {/* Walkthroughs */}
        <section className="welcome-section">
          <h2 className="section-title">Walkthroughs</h2>
          <div className="walkthrough-list">
            <button key="ai" className="walkthrough-item">
              <div className="walkthrough-icon">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
                </svg>
              </div>
              <div className="walkthrough-info">
                <span className="walkthrough-title">AI Assistant</span>
                <span className="walkthrough-desc">Get help with your code</span>
              </div>
            </button>
            <button key="inline" className="walkthrough-item">
              <div className="walkthrough-icon">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polyline points="16 18 22 12 16 6"/>
                  <polyline points="8 6 2 12 8 18"/>
                </svg>
              </div>
              <div className="walkthrough-info">
                <span className="walkthrough-title">Inline Editing</span>
                <span className="walkthrough-desc">Edit code with AI directly</span>
              </div>
            </button>
            <button key="search" className="walkthrough-item">
              <div className="walkthrough-icon">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="11" cy="11" r="8"/>
                  <line x1="21" y1="21" x2="16.65" y2="16.65"/>
                </svg>
              </div>
              <div className="walkthrough-info">
                <span className="walkthrough-title">Smart Search</span>
                <span className="walkthrough-desc">Search across files</span>
              </div>
            </button>
          </div>
        </section>

        {/* Keyboard Shortcuts */}
        <section className="welcome-section shortcuts-section">
          <h2 className="section-title">
            <CommandIcon />
            Keyboard Shortcuts
          </h2>
          <div className="shortcuts-grid">
            {shortcuts.map(({ key, shortcut }) => (
              <div key={key} className="shortcut-item">
                <span className="shortcut-key">{key}</span>
                <kbd className="shortcut-kbd">{shortcut}</kbd>
              </div>
            ))}
          </div>
        </section>

        {/* Footer */}
        <footer className="welcome-footer">
          <span>v0.1.0</span>
          <span className="separator">•</span>
          <span>TypeScript + Electron</span>
        </footer>
      </div>
    </div>
  );
};
