/**
 * @fileoverview FileNode component
 * @module renderer/components/explorer/FileNode
 */

import React from 'react';
import type { FileNode as FileNodeType } from '../../../shared/types';
import { getFileIcon } from './FileIcons';

export interface FileNodeProps {
  node: FileNodeType;
  depth: number;
  isActive: boolean;
  isExpanded: boolean;
  onToggle: () => void;
  onSelect: () => void;
}

export const FileNode: React.FC<FileNodeProps> = ({
  node,
  depth,
  isActive,
  isExpanded,
  onToggle,
  onSelect,
}) => {
  const isDirectory = node.type === 'directory';
  const paddingLeft = 12 + depth * 16;

  const containerStyles: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
    padding: `4px 8px 4px ${paddingLeft}px`,
    cursor: 'pointer',
    fontSize: '13px',
    color: isActive ? '#ffffff' : '#cccccc',
    backgroundColor: isActive ? '#37373d' : 'transparent',
    transition: 'background-color 0.1s',
  };

  const chevronStyles: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '16px',
    height: '16px',
    transform: isExpanded ? 'rotate(90deg)' : 'none',
    transition: 'transform 0.15s',
    opacity: isDirectory ? 1 : 0,
  };

  const iconStyles: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '16px',
    height: '16px',
  };

  const nameStyles: React.CSSProperties = {
    flex: 1,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  };

  const handleClick = () => {
    if (isDirectory) {
      onToggle();
    } else {
      onSelect();
    }
  };

  return (
    <>
      <div
        className={`file-node ${isActive ? 'active' : ''} ${isDirectory ? 'directory' : 'file'}`}
        style={containerStyles}
        onClick={handleClick}
      >
        <span style={chevronStyles}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="9 18 15 12 9 6"/>
          </svg>
        </span>
        <span style={iconStyles}>
          {getFileIcon(node.name, isDirectory, isExpanded)}
        </span>
        <span style={nameStyles}>{node.name}</span>
      </div>
      {isDirectory && isExpanded && node.children && (
        <div>
          {node.children.map((child) => (
            <FileNode
              key={child.path}
              node={child}
              depth={depth + 1}
              isActive={false}
              isExpanded={false}
              onToggle={() => {}}
              onSelect={() => onSelect()}
            />
          ))}
        </div>
      )}
    </>
  );
};

export default FileNode;
