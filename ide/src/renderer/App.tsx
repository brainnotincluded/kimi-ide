import React, { useState, useCallback, useEffect, useRef } from 'react';
import './App.css';
import { Sidebar } from './components/Sidebar';
import { EditorPanel } from './components/EditorPanel';
import { TerminalPanel } from './components/TerminalPanel';
import { Problems } from './components/Problems';
import { Output } from './components/Output';
import { DebugConsole } from './components/DebugConsole';

const { ipcRenderer } = window.require('electron');

type BottomTab = 'terminal' | 'problems' | 'output' | 'debug-console';

interface EditorTab {
  id: string;
  filePath: string;
  isDirty: boolean;
}

interface FileChangeEvent {
  path: string;
  type: 'add' | 'change' | 'unlink';
}

const DEFAULT_SIDEBAR_WIDTH = 260;
const DEFAULT_BOTTOM_PANEL_HEIGHT = 220;
const MIN_SIDEBAR_WIDTH = 180;
const MAX_SIDEBAR_WIDTH = 400;
const MIN_BOTTOM_PANEL_HEIGHT = 120;
const MAX_BOTTOM_PANEL_HEIGHT = 500;

function App() {
  const [workspace, setWorkspace] = useState<string | null>(null);
  const [editorTabs, setEditorTabs] = useState<EditorTab[]>([]);
  const [activeEditorId, setActiveEditorId] = useState<string | null>(null);
  const [activeBottomTab, setActiveBottomTab] = useState<BottomTab>('terminal');
  const [isBottomPanelVisible, setIsBottomPanelVisible] = useState(true);
  const [hasErrors, setHasErrors] = useState(false);

  // Panel sizes
  const [sidebarWidth, setSidebarWidth] = useState(DEFAULT_SIDEBAR_WIDTH);
  const [bottomPanelHeight, setBottomPanelHeight] = useState(DEFAULT_BOTTOM_PANEL_HEIGHT);

  // Resizing state
  const [isResizingSidebar, setIsResizingSidebar] = useState(false);
  const [isResizingBottom, setIsResizingBottom] = useState(false);

  useEffect(() => {
    const handleFileChange = (_: any, event: FileChangeEvent) => {
      console.log('File changed:', event);
    };

    ipcRenderer.on('workspace:change', handleFileChange);
    
    const handleFolderOpened = (_: any, folderPath: string) => {
      setWorkspace(folderPath);
    };
    ipcRenderer.on('folder:opened', handleFolderOpened);

    return () => {
      ipcRenderer.off('workspace:change', handleFileChange);
      ipcRenderer.off('folder:opened', handleFolderOpened);
    };
  }, []);

  // Global mouse handlers for resizing
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (isResizingSidebar) {
        const newWidth = Math.max(MIN_SIDEBAR_WIDTH, Math.min(MAX_SIDEBAR_WIDTH, e.clientX));
        setSidebarWidth(newWidth);
      }
      if (isResizingBottom) {
        const newHeight = Math.max(MIN_BOTTOM_PANEL_HEIGHT, Math.min(MAX_BOTTOM_PANEL_HEIGHT, window.innerHeight - e.clientY));
        setBottomPanelHeight(newHeight);
      }
    };

    const handleMouseUp = () => {
      setIsResizingSidebar(false);
      setIsResizingBottom(false);
    };

    if (isResizingSidebar || isResizingBottom) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = isResizingBottom ? 'ns-resize' : 'ew-resize';
      document.body.style.userSelect = 'none';
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
  }, [isResizingSidebar, isResizingBottom]);

  const handleOpenFolder = useCallback(async () => {
    const result = await ipcRenderer.invoke('dialog:openFolder');
    if (result) {
      setWorkspace(result);
    }
  }, []);

  const handleFileSelect = useCallback((filePath: string) => {
    const existingTab = editorTabs.find(tab => tab.filePath === filePath);
    if (existingTab) {
      setActiveEditorId(existingTab.id);
      return;
    }

    const newTab: EditorTab = {
      id: `editor-${Date.now()}`,
      filePath,
      isDirty: false
    };
    setEditorTabs(prev => [...prev, newTab]);
    setActiveEditorId(newTab.id);
  }, [editorTabs]);

  const handleEditorTabClick = useCallback((tabId: string) => {
    setActiveEditorId(tabId);
  }, []);

  const handleEditorTabClose = useCallback((tabId: string) => {
    setEditorTabs(prev => {
      const newTabs = prev.filter(t => t.id !== tabId);
      if (activeEditorId === tabId && newTabs.length > 0) {
        setActiveEditorId(newTabs[newTabs.length - 1].id);
      } else if (newTabs.length === 0) {
        setActiveEditorId(null);
      }
      return newTabs;
    });
  }, [activeEditorId]);

  const handleEditorTabChange = useCallback((tabId: string, isDirty: boolean) => {
    setEditorTabs(prev =>
      prev.map(tab =>
        tab.id === tabId ? { ...tab, isDirty } : tab
      )
    );
  }, []);

  const handleToggleBottomPanel = useCallback(() => {
    setIsBottomPanelVisible(prev => !prev);
  }, []);

  const renderBottomPanel = () => {
    switch (activeBottomTab) {
      case 'terminal':
        return <TerminalPanel workspace={workspace} />;
      case 'problems':
        return <Problems diagnostics={[]} />;
      case 'output':
        return <Output />;
      case 'debug-console':
        return <DebugConsole />;
      default:
        return null;
    }
  };

  const sidebarStyle = { width: sidebarWidth };
  const bottomPanelStyle = { height: isBottomPanelVisible ? bottomPanelHeight : 36 };

  return (
    <div className="app">
      {/* Titlebar */}
      <div className="titlebar">
        <div className="titlebar-left">
          <div className="app-logo">
            <span className="logo-letter">T</span>
          </div>
          <span className="app-name">Kimi IDE</span>
          <div className="titlebar-menu">
            <button className="menu-item">File</button>
            <button className="menu-item">Edit</button>
            <button className="menu-item">View</button>
            <button className="menu-item">Go</button>
            <button className="menu-item">Run</button>
            <button className="menu-item">Terminal</button>
            <button className="menu-item">Help</button>
          </div>
        </div>
        <div className="titlebar-center">
          {workspace ? workspace.split('/').pop() : 'Welcome'}
        </div>
        <div className="titlebar-right">
          <button className="titlebar-btn" onClick={handleOpenFolder}>
            Open Folder
          </button>
        </div>
      </div>

      {/* Main Container */}
      <div className="main-container">
        {/* Sidebar */}
        <div className="sidebar-wrapper" style={sidebarStyle}>
          <Sidebar 
            workspace={workspace} 
            onOpenFolder={handleOpenFolder}
            onFileSelect={handleFileSelect}
          />
        </div>
        
        {/* Sidebar Resize Handle */}
        <div 
          className={`resize-handle resize-handle-vertical ${isResizingSidebar ? 'active' : ''}`}
          onMouseDown={() => setIsResizingSidebar(true)}
        />

        {/* Editor Area */}
        <div className="editor-wrapper">
          {editorTabs.length > 0 ? (
            <EditorPanel
              tabs={editorTabs}
              activeTabId={activeEditorId}
              onTabClick={handleEditorTabClick}
              onTabClose={handleEditorTabClose}
              onTabChange={handleEditorTabChange}
            />
          ) : (
            <div className="empty-editor">
              <div className="empty-editor-content">
                <div className="welcome-rings">
                  <div className="welcome-ring ring-outer" />
                  <div className="welcome-ring ring-middle" />
                  <div className="welcome-ring ring-inner" />
                  <div className="welcome-logo">
                    <span className="welcome-letter">T</span>
                  </div>
                </div>
                
                <h1 className="welcome-title">Kimi IDE</h1>
                <p className="welcome-subtitle">Code Editor</p>
                
                <div className="welcome-actions">
                  <button className="welcome-btn primary" onClick={handleOpenFolder}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
                    </svg>
                    Open Folder
                  </button>
                </div>

                <div className="welcome-shortcuts">
                  <div className="shortcut">
                    <kbd>Cmd</kbd>
                    <kbd>O</kbd>
                    <span>Open</span>
                  </div>
                  <div className="shortcut">
                    <kbd>Cmd</kbd>
                    <kbd>J</kbd>
                    <span>Terminal</span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Bottom Panel Resize Handle */}
      <div 
        className={`resize-handle resize-handle-horizontal ${isResizingBottom ? 'active' : ''}`}
        onMouseDown={() => setIsResizingBottom(true)}
        style={{ bottom: isBottomPanelVisible ? bottomPanelHeight : 36 }}
      />

      {/* Bottom Panel */}
      <div className={`bottom-panel ${isBottomPanelVisible ? 'visible' : 'hidden'}`} style={bottomPanelStyle}>
        <div className="panel-tabs">
          <button 
            className={`panel-tab ${activeBottomTab === 'problems' ? 'active' : ''} ${hasErrors ? 'has-errors' : ''}`}
            onClick={() => setActiveBottomTab('problems')}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10"/>
              <line x1="12" y1="8" x2="12" y2="12"/>
              <line x1="12" y1="16" x2="12.01" y2="16"/>
            </svg>
            Problems
          </button>
          <button 
            className={`panel-tab ${activeBottomTab === 'output' ? 'active' : ''}`}
            onClick={() => setActiveBottomTab('output')}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="4 17 10 11 4 5"/>
              <line x1="12" y1="19" x2="20" y2="19"/>
            </svg>
            Output
          </button>
          <button 
            className={`panel-tab ${activeBottomTab === 'debug-console' ? 'active' : ''}`}
            onClick={() => setActiveBottomTab('debug-console')}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="16 18 22 12 16 6"/>
              <polyline points="8 6 2 12 8 18"/>
            </svg>
            Debug Console
          </button>
          <button 
            className={`panel-tab ${activeBottomTab === 'terminal' ? 'active' : ''}`}
            onClick={() => setActiveBottomTab('terminal')}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="4 17 10 11 4 5"/>
              <line x1="12" y1="19" x2="20" y2="19"/>
            </svg>
            Terminal
          </button>
          <div className="panel-actions">
            <button className="panel-toggle" onClick={handleToggleBottomPanel}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ transform: isBottomPanelVisible ? 'none' : 'rotate(180deg)' }}>
                <polyline points="18 15 12 9 6 15"/>
              </svg>
            </button>
          </div>
        </div>
        <div className="panel-content">
          {renderBottomPanel()}
        </div>
      </div>
    </div>
  );
}

export default App;
