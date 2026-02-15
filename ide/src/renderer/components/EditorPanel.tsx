import React, { useState, useCallback, useEffect, useRef } from 'react';
import './EditorPanel.css';
import { CodeEditor } from './Editor';

interface EditorTab {
  id: string;
  filePath: string;
  isDirty: boolean;
}

interface EditorPanelProps {
  tabs: EditorTab[];
  activeTabId: string | null;
  onTabClick: (tabId: string) => void;
  onTabClose: (tabId: string) => void;
  onTabChange: (tabId: string, isDirty: boolean) => void;
}

export const EditorPanel: React.FC<EditorPanelProps> = ({
  tabs,
  activeTabId,
  onTabClick,
  onTabClose,
  onTabChange,
}) => {
  const getFileName = (path: string) => path.split('/').pop() || path;
  const contentAreaRef = useRef<HTMLDivElement>(null);

  // Handle resize to notify Monaco editor
  useEffect(() => {
    const handleResize = () => {
      // Monaco editor will automatically resize when container changes
      // This effect runs when component mounts to ensure proper sizing
    };

    window.addEventListener('resize', handleResize);
    
    // Initial resize after mount
    const timeout = setTimeout(handleResize, 100);
    
    return () => {
      window.removeEventListener('resize', handleResize);
      clearTimeout(timeout);
    };
  }, []);

  if (tabs.length === 0) {
    return (
      <div className="empty-editor">
        <div className="empty-editor-content">
          <div className="empty-logo">T</div>
          <h1>Kimi IDE</h1>
          <p>Open a folder to start coding</p>
        </div>
      </div>
    );
  }

  return (
    <div className="editor-panel">
      <div className="editor-tabs">
        {tabs.map((tab) => (
          <div
            key={tab.id}
            className={`editor-tab ${activeTabId === tab.id ? 'active' : ''} ${tab.isDirty ? 'dirty' : ''}`}
            onClick={() => onTabClick(tab.id)}
          >
            <span className="tab-filename">{getFileName(tab.filePath)}</span>
            {tab.isDirty && <span className="tab-dot">●</span>}
            <button
              className="tab-close"
              onClick={(e) => {
                e.stopPropagation();
                onTabClose(tab.id);
              }}
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="18" y1="6" x2="6" y2="18"/>
                <line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </button>
          </div>
        ))}
      </div>
      <div className="editor-content-area" ref={contentAreaRef}>
        {tabs.map((tab) => (
          <div
            key={tab.id}
            className={`editor-tab-content ${activeTabId === tab.id ? 'active' : ''}`}
          >
            {activeTabId === tab.id && (
              <CodeEditor
                filePath={tab.filePath}
                onDirtyChange={(isDirty) => onTabChange(tab.id, isDirty)}
              />
            )}
          </div>
        ))}
      </div>
    </div>
  );
};
