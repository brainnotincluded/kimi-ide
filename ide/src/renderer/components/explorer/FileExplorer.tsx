/**
 * @fileoverview FileExplorer component (lean version)
 * @module renderer/components/explorer/FileExplorer
 */

import React, { useState, useEffect, useCallback } from 'react';
import { FileTree } from './FileTree';
import type { FileNode as FileNodeType } from '../../../shared/types';

const { ipcRenderer } = window.require('electron');

export interface FileExplorerProps {
  workspace: string | null;
  onFileSelect: (path: string) => void;
  activeFile: string | null;
}

export const FileExplorer: React.FC<FileExplorerProps> = ({
  workspace,
  onFileSelect,
  activeFile,
}) => {
  const [files, setFiles] = useState<FileNodeType[]>([]);
  const [expandedDirs, setExpandedDirs] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(false);

  const loadDirectory = useCallback(async (path: string) => {
    setIsLoading(true);
    try {
      const entries = await ipcRenderer.invoke('workspace:readDirectory', path);
      const nodes: FileNodeType[] = entries.map((entry: any) => ({
        name: entry.name,
        path: entry.path,
        type: entry.isDirectory ? 'directory' : 'file',
        expanded: false,
      }));
      
      nodes.sort((a, b) => {
        if (a.type === b.type) return a.name.localeCompare(b.name);
        return a.type === 'directory' ? -1 : 1;
      });
      
      setFiles(nodes);
    } catch (err) {
      console.error('Failed to load directory:', err);
      setFiles([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (workspace) {
      loadDirectory(workspace);
    } else {
      setFiles([]);
    }
  }, [workspace, loadDirectory]);

  const handleToggleDir = useCallback(async (node: FileNodeType) => {
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
            type: entry.isDirectory ? 'directory' : 'file',
          })).sort((a: FileNodeType, b: FileNodeType) => {
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
  }, [expandedDirs, files]);

  const containerStyles: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
    backgroundColor: '#1e1e1e',
    color: '#cccccc',
    fontSize: '13px',
  };

  const headerStyles: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    padding: '0 12px',
    height: '35px',
    fontSize: '11px',
    fontWeight: 600,
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
    borderBottom: '1px solid #3c3c3c',
  };

  const emptyStyles: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
    padding: '20px',
    color: '#858585',
    fontSize: '12px',
  };

  if (!workspace) {
    return (
      <div style={containerStyles}>
        <div style={headerStyles}>Explorer</div>
        <div style={emptyStyles}>No folder opened</div>
      </div>
    );
  }

  return (
    <div style={containerStyles}>
      <div style={headerStyles}>Explorer</div>
      {isLoading ? (
        <div style={emptyStyles}>Loading...</div>
      ) : (
        <FileTree
          nodes={files}
          activeFile={activeFile}
          expandedDirs={expandedDirs}
          onToggleDir={handleToggleDir}
          onFileSelect={onFileSelect}
        />
      )}
    </div>
  );
};

export default FileExplorer;
