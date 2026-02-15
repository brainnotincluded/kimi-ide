/**
 * @fileoverview FileTree component
 * @module renderer/components/explorer/FileTree
 */

import React from 'react';
import { FileNode } from './FileNode';
import type { FileNode as FileNodeType } from '../../../shared/types';

export interface FileTreeProps {
  nodes: FileNodeType[];
  activeFile: string | null;
  expandedDirs: Set<string>;
  onToggleDir: (node: FileNodeType) => void;
  onFileSelect: (path: string) => void;
  depth?: number;
}

export const FileTree: React.FC<FileTreeProps> = ({
  nodes,
  activeFile,
  expandedDirs,
  onToggleDir,
  onFileSelect,
  depth = 0,
}) => {
  const containerStyles: React.CSSProperties = {
    overflow: 'auto',
    flex: 1,
  };

  return (
    <div style={containerStyles}>
      {nodes.map((node) => (
        <FileNode
          key={node.path}
          node={node}
          depth={depth}
          isActive={activeFile === node.path}
          isExpanded={expandedDirs.has(node.path)}
          onToggle={() => onToggleDir(node)}
          onSelect={() => onFileSelect(node.path)}
        />
      ))}
    </div>
  );
};

export default FileTree;
