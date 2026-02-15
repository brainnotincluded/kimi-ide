import React, { useState } from 'react';
import './Sidebar.css';
import { FileExplorer } from './FileExplorer';

type SidebarView = 'explorer' | 'search' | 'git' | 'debug' | 'extensions';

interface SidebarProps {
  workspace: string | null;
  onOpenFolder: () => void;
  onFileSelect: (path: string) => void;
}

const ExplorerIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M3 3h7v7H3zM14 3h7v7h-7zM14 14h7v7h-7zM3 14h7v7H3z"/>
  </svg>
);

const SearchIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <circle cx="11" cy="11" r="8"/>
    <path d="m21 21-4.35-4.35"/>
  </svg>
);

const GitIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <circle cx="6" cy="6" r="3"/>
    <circle cx="6" cy="18" r="3"/>
    <path d="M6 9v6"/>
    <path d="m9 6 3-3 3 3"/>
    <path d="m15 18-3 3-3-3"/>
  </svg>
);

const DebugIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="m12 5 7 7-7 7"/>
    <path d="M5 5v14"/>
  </svg>
);

const ExtensionsIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <rect x="4" y="4" width="16" height="16" rx="2"/>
    <rect x="9" y="9" width="6" height="6"/>
    <path d="M9 1v3M15 1v3M9 20v3M15 20v3M20 9h3M20 14h3M1 9h3M1 14h3"/>
  </svg>
);

export const Sidebar: React.FC<SidebarProps> = ({ 
  workspace, 
  onOpenFolder,
  onFileSelect 
}) => {
  const [activeView, setActiveView] = useState<SidebarView>('explorer');
  const [activeFile, setActiveFile] = useState<string | null>(null);

  const handleFileSelect = (path: string) => {
    setActiveFile(path);
    onFileSelect(path);
  };

  const renderView = () => {
    switch (activeView) {
      case 'explorer':
        return (
          <FileExplorer 
            workspace={workspace} 
            onFileSelect={handleFileSelect}
            activeFile={activeFile}
          />
        );
      case 'search':
        return (
          <div className="sidebar-view">
            <div className="sidebar-view-header">Search</div>
            <div className="sidebar-view-content empty">
              <span>Search across files</span>
            </div>
          </div>
        );
      case 'git':
        return (
          <div className="sidebar-view">
            <div className="sidebar-view-header">Source Control</div>
            <div className="sidebar-view-content empty">
              <span>No changes</span>
            </div>
          </div>
        );
      case 'debug':
        return (
          <div className="sidebar-view">
            <div className="sidebar-view-header">Run and Debug</div>
            <div className="sidebar-view-content empty">
              <span>No configurations</span>
            </div>
          </div>
        );
      case 'extensions':
        return (
          <div className="sidebar-view">
            <div className="sidebar-view-header">Extensions</div>
            <div className="sidebar-view-content empty">
              <span>Installed extensions</span>
            </div>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className="sidebar">
      <div className="sidebar-activity">
        <button 
          className={`activity-item ${activeView === 'explorer' ? 'active' : ''}`}
          onClick={() => setActiveView('explorer')}
          title="Explorer"
        >
          <ExplorerIcon />
        </button>
        <button 
          className={`activity-item ${activeView === 'search' ? 'active' : ''}`}
          onClick={() => setActiveView('search')}
          title="Search"
        >
          <SearchIcon />
        </button>
        <button 
          className={`activity-item ${activeView === 'git' ? 'active' : ''}`}
          onClick={() => setActiveView('git')}
          title="Source Control"
        >
          <GitIcon />
        </button>
        <button 
          className={`activity-item ${activeView === 'debug' ? 'active' : ''}`}
          onClick={() => setActiveView('debug')}
          title="Run and Debug"
        >
          <DebugIcon />
        </button>
        <button 
          className={`activity-item ${activeView === 'extensions' ? 'active' : ''}`}
          onClick={() => setActiveView('extensions')}
          title="Extensions"
        >
          <ExtensionsIcon />
        </button>
      </div>
      <div className="sidebar-content">
        {renderView()}
      </div>
    </div>
  );
};
