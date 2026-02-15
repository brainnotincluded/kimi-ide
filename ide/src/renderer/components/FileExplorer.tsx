import React, { useState, useEffect } from 'react';
import './FileExplorer.css';

const { ipcRenderer } = window.require('electron');

interface FileNode {
  name: string;
  path: string;
  type: 'file' | 'directory';
  children?: FileNode[];
  expanded?: boolean;
}

interface FileExplorerProps {
  workspace: string | null;
  onFileSelect: (path: string) => void;
  activeFile: string | null;
}

// SVG Icons
const FolderIcon = ({ expanded }: { expanded?: boolean }) => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    {expanded ? (
      <path d="m22 19-10-10L2 19M2 19l10-10 10 10M2 19h20"/>
    ) : (
      <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
    )}
  </svg>
);

const FileIcons: Record<string, JSX.Element> = {
  ts: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="#3178c6">
      <path d="M3 3h18v18H3V3zm7.5 13.5v-1.3H9v1.3h1.5zm0-2.6V7.5H9v6.4h1.5zm3.8 2.6v-2.3h2.3v-1.3h-2.3V9.6h2.9V8.3h-4.4v8.2h4.4v-1.3h-2.9z"/>
    </svg>
  ),
  tsx: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="#3178c6">
      <path d="M3 3h18v18H3V3zm7.5 13.5v-1.3H9v1.3h1.5zm0-2.6V7.5H9v6.4h1.5zm3.8 2.6v-2.3h2.3v-1.3h-2.3V9.6h2.9V8.3h-4.4v8.2h4.4v-1.3h-2.9z"/>
    </svg>
  ),
  js: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="#f1e05a">
      <path d="M3 3h18v18H3V3zm11.8 13.5c0 1.5-1 2.2-2.3 2.2-1.5 0-2.2-.8-2.2-2.1h1.6c0 .5.2.9.7.9.4 0 .7-.2.7-.8 0-.5-.4-.7-1-.9l-.8-.3c-1-.4-1.5-1-1.5-2 0-1.4.9-2 2.2-2 1.3 0 2.1.7 2.1 2h-1.6c0-.4-.3-.7-.7-.7-.4 0-.6.3-.6.7 0 .5.3.7.9.9l.8.3c1.1.4 1.6 1 1.6 2.1v.7z"/>
    </svg>
  ),
  jsx: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="#f1e05a">
      <path d="M3 3h18v18H3V3zm11.8 13.5c0 1.5-1 2.2-2.3 2.2-1.5 0-2.2-.8-2.2-2.1h1.6c0 .5.2.9.7.9.4 0 .7-.2.7-.8 0-.5-.4-.7-1-.9l-.8-.3c-1-.4-1.5-1-1.5-2 0-1.4.9-2 2.2-2 1.3 0 2.1.7 2.1 2h-1.6c0-.4-.3-.7-.7-.7-.4 0-.6.3-.6.7 0 .5.3.7.9.9l.8.3c1.1.4 1.6 1 1.6 2.1v.7z"/>
    </svg>
  ),
  json: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="#858585">
      <path d="M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2zm-1 15h2v-2h-2v2zm0-4h2V7h-2v6z"/>
    </svg>
  ),
  md: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="#858585">
      <path d="M3 3h18v18H3V3zm4 12V9h2l2 3 2-3h2v6h-2v-3.5l-2 3-2-3V15H7zm10 0V9h-2v6h2z"/>
    </svg>
  ),
  css: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="#563d7c">
      <path d="M3 3h18v18H3V3zm7.5 13.5v-1.3H9v1.3h1.5zm0-2.6V7.5H9v6.4h1.5zm3.8 2.6v-2.3h2.3v-1.3h-2.3V9.6h2.9V8.3h-4.4v8.2h4.4v-1.3h-2.9z"/>
    </svg>
  ),
  html: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="#e34c26">
      <path d="M3 3h18v18H3V3zm7.5 13.5v-1.3H9v1.3h1.5zm0-2.6V7.5H9v6.4h1.5zm3.8 2.6v-2.3h2.3v-1.3h-2.3V9.6h2.9V8.3h-4.4v8.2h4.4v-1.3h-2.9z"/>
    </svg>
  ),
  py: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="#3572A5">
      <path d="M12 2c-3 0-5.5 1-5.5 3v3h5.5v1H4.5C2.5 9 2 10 2 12c0 2 .5 3 2.5 3h2v-2c0-2.5 2-4.5 4.5-4.5h5c2 0 3.5-1.5 3.5-3.5V5c0-2.5-2-3-5.5-3zM8.5 4.5c.8 0 1.5.7 1.5 1.5S9.3 7.5 8.5 7.5 7 6.8 7 6s.7-1.5 1.5-1.5z"/>
      <path d="M12 22c3 0 5.5-1 5.5-3v-3h-5.5v-1h6.5c2 0 2.5-1 2.5-3 0-2-.5-3-2.5-3h-2v2c0 2.5-2 4.5-4.5 4.5h-5c-2 0-3.5 1.5-3.5 3.5V19c0 2.5 2 3 5.5 3zm3.5-1.5c-.8 0-1.5-.7-1.5-1.5s.7-1.5 1.5-1.5 1.5.7 1.5 1.5-.7 1.5-1.5 1.5z"/>
    </svg>
  ),
  rs: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="#dea584">
      <circle cx="12" cy="12" r="10"/>
    </svg>
  ),
  go: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="#00ADD8">
      <circle cx="12" cy="12" r="10"/>
    </svg>
  ),
  default: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#858585" strokeWidth="2">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
      <polyline points="14 2 14 8 20 8"/>
      <line x1="16" y1="13" x2="8" y2="13"/>
      <line x1="16" y1="17" x2="8" y2="17"/>
      <polyline points="10 9 9 9 8 9"/>
    </svg>
  )
};

const getFileIcon = (name: string, type: 'file' | 'directory') => {
  if (type === 'directory') return null;
  const ext = name.split('.').pop()?.toLowerCase() || '';
  return FileIcons[ext] || FileIcons.default;
};

export const FileExplorer: React.FC<FileExplorerProps> = ({ 
  workspace, 
  onFileSelect,
  activeFile 
}) => {
  const [files, setFiles] = useState<FileNode[]>([]);
  const [expandedDirs, setExpandedDirs] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (workspace) {
      loadDirectory(workspace);
    } else {
      setFiles([]);
    }
  }, [workspace]);

  const loadDirectory = async (path: string) => {
    try {
      const entries = await ipcRenderer.invoke('workspace:readDirectory', path);
      const nodes: FileNode[] = entries.map((entry: any) => ({
        name: entry.name,
        path: entry.path,
        type: entry.isDirectory ? 'directory' : 'file' as 'file' | 'directory',
        expanded: false
      }));
      
      nodes.sort((a, b) => {
        if (a.type === b.type) return a.name.localeCompare(b.name);
        return a.type === 'directory' ? -1 : 1;
      });
      
      setFiles(nodes);
    } catch (err) {
      console.error('Failed to load directory:', err);
      setFiles([]);
    }
  };

  const toggleDir = async (node: FileNode) => {
    if (node.type !== 'directory') return;
    
    const newExpanded = new Set(expandedDirs);
    if (newExpanded.has(node.path)) {
      newExpanded.delete(node.path);
      node.expanded = false;
    } else {
      newExpanded.add(node.path);
      node.expanded = true;
      
      if (!node.children) {
        try {
          const entries = await ipcRenderer.invoke('workspace:readDirectory', node.path);
          node.children = entries.map((entry: any) => ({
            name: entry.name,
            path: entry.path,
            type: entry.isDirectory ? 'directory' : 'file' as 'file' | 'directory'
          })).sort((a: FileNode, b: FileNode) => {
            if (a.type === b.type) return a.name.localeCompare(b.name);
            return a.type === 'directory' ? -1 : 1;
          });
          setFiles([...files]);
        } catch (err) {
          console.error('Failed to load subdirectory:', err);
        }
      }
    }
    setExpandedDirs(newExpanded);
  };

  const renderNode = (node: FileNode, depth: number = 0) => {
    const isActive = activeFile === node.path;
    const isExpanded = expandedDirs.has(node.path);
    const paddingLeft = 12 + depth * 16;

    if (node.type === 'directory') {
      return (
        <div key={node.path}>
          <div 
            className="file-item"
            style={{ paddingLeft }}
            onClick={() => toggleDir(node)}
          >
            <span className={`folder-chevron ${isExpanded ? 'expanded' : ''}`}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="9 18 15 12 9 6"/>
              </svg>
            </span>
            <span className="file-item-icon folder-icon">
              <FolderIcon expanded={isExpanded} />
            </span>
            <span className="file-item-name file-item-folder">{node.name}</span>
          </div>
          {isExpanded && node.children && (
            <div>
              {node.children.map(child => renderNode(child, depth + 1))}
            </div>
          )}
        </div>
      );
    }

    const fileIcon = getFileIcon(node.name, node.type);

    return (
      <div 
        key={node.path}
        className={`file-item ${isActive ? 'active' : ''}`}
        style={{ paddingLeft }}
        onClick={() => onFileSelect(node.path)}
      >
        <span className="file-item-chevron-placeholder" />
        <span className="file-item-icon">{fileIcon}</span>
        <span className="file-item-name">{node.name}</span>
      </div>
    );
  };

  if (!workspace) {
    return (
      <div className="file-explorer">
        <div className="file-explorer-header">
          <span>Explorer</span>
        </div>
        <div className="file-tree empty">
          <span>No folder opened</span>
        </div>
      </div>
    );
  }

  return (
    <div className="file-explorer">
      <div className="file-explorer-header">
        <span>Explorer</span>
      </div>
      <div className="file-tree">
        {files.map(node => renderNode(node))}
      </div>
    </div>
  );
};
