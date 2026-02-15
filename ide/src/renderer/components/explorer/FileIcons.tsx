/**
 * @fileoverview File icons for the explorer
 * @module renderer/components/explorer/FileIcons
 */

import React from 'react';

// Color mappings for file types
const FILE_COLORS: Record<string, string> = {
  ts: '#3178c6',
  tsx: '#3178c6',
  js: '#f1e05a',
  jsx: '#f1e05a',
  py: '#3572A5',
  rs: '#dea584',
  go: '#00ADD8',
  java: '#b07219',
  kt: '#A97BFF',
  swift: '#ffac45',
  cpp: '#f34b7d',
  c: '#555555',
  cs: '#178600',
  rb: '#701516',
  php: '#4F5D95',
  html: '#e34c26',
  css: '#563d7c',
  scss: '#c6538c',
  json: '#858585',
  md: '#858585',
  yml: '#858585',
  yaml: '#858585',
  xml: '#858585',
  sql: '#858585',
  sh: '#89e051',
  dockerfile: '#384d54',
};

const FolderIcon: React.FC<{ expanded?: boolean }> = ({ expanded }) => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#dcb67a" strokeWidth="2">
    {expanded ? (
      <path d="m22 19-10-10L2 19M2 19l10-10 10 10M2 19h20"/>
    ) : (
      <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
    )}
  </svg>
);

const DefaultFileIcon: React.FC = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#858585" strokeWidth="2">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
    <polyline points="14 2 14 8 20 8"/>
    <line x1="16" y1="13" x2="8" y2="13"/>
    <line x1="16" y1="17" x2="8" y2="17"/>
    <polyline points="10 9 9 9 8 9"/>
  </svg>
);

const TypeScriptIcon: React.FC = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill={FILE_COLORS.ts}>
    <path d="M3 3h18v18H3V3zm7.5 13.5v-1.3H9v1.3h1.5zm0-2.6V7.5H9v6.4h1.5zm3.8 2.6v-2.3h2.3v-1.3h-2.3V9.6h2.9V8.3h-4.4v8.2h4.4v-1.3h-2.9z"/>
  </svg>
);

const JavaScriptIcon: React.FC = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill={FILE_COLORS.js}>
    <path d="M3 3h18v18H3V3zm11.8 13.5c0 1.5-1 2.2-2.3 2.2-1.5 0-2.2-.8-2.2-2.1h1.6c0 .5.2.9.7.9.4 0 .7-.2.7-.8 0-.5-.4-.7-1-.9l-.8-.3c-1-.4-1.5-1-1.5-2 0-1.4.9-2 2.2-2 1.3 0 2.1.7 2.1 2h-1.6c0-.4-.3-.7-.7-.7-.4 0-.6.3-.6.7 0 .5.3.7.9.9l.8.3c1.1.4 1.6 1 1.6 2.1v.7z"/>
  </svg>
);

const PythonIcon: React.FC = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill={FILE_COLORS.py}>
    <path d="M12 2c-3 0-5.5 1-5.5 3v3h5.5v1H4.5C2.5 9 2 10 2 12c0 2 .5 3 2.5 3h2v-2c0-2.5 2-4.5 4.5-4.5h5c2 0 3.5-1.5 3.5-3.5V5c0-2.5-2-3-5.5-3zM8.5 4.5c.8 0 1.5.7 1.5 1.5S9.3 7.5 8.5 7.5 7 6.8 7 6s.7-1.5 1.5-1.5z"/>
    <path d="M12 22c3 0 5.5-1 5.5-3v-3h-5.5v-1h6.5c2 0 2.5-1 2.5-3 0-2-.5-3-2.5-3h-2v2c0 2.5-2 4.5-4.5 4.5h-5c-2 0-3.5 1.5-3.5 3.5V19c0 2.5 2 3 5.5 3zm3.5-1.5c-.8 0-1.5-.7-1.5-1.5s.7-1.5 1.5-1.5 1.5.7 1.5 1.5-.7 1.5-1.5 1.5z"/>
  </svg>
);

const RustIcon: React.FC = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill={FILE_COLORS.rs}>
    <circle cx="12" cy="12" r="10"/>
  </svg>
);

const GoIcon: React.FC = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill={FILE_COLORS.go}>
    <circle cx="12" cy="12" r="10"/>
  </svg>
);

const JSONIcon: React.FC = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill={FILE_COLORS.json}>
    <path d="M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2zm-1 15h2v-2h-2v2zm0-4h2V7h-2v6z"/>
  </svg>
);

const MarkdownIcon: React.FC = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill={FILE_COLORS.md}>
    <path d="M3 3h18v18H3V3zm4 12V9h2l2 3 2-3h2v6h-2v-3.5l-2 3-2-3V15H7zm10 0V9h-2v6h2z"/>
  </svg>
);

const CSSIcon: React.FC = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill={FILE_COLORS.css}>
    <path d="M3 3h18v18H3V3zm7.5 13.5v-1.3H9v1.3h1.5zm0-2.6V7.5H9v6.4h1.5zm3.8 2.6v-2.3h2.3v-1.3h-2.3V9.6h2.9V8.3h-4.4v8.2h4.4v-1.3h-2.9z"/>
  </svg>
);

const HTMLIcon: React.FC = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill={FILE_COLORS.html}>
    <path d="M3 3h18v18H3V3zm7.5 13.5v-1.3H9v1.3h1.5zm0-2.6V7.5H9v6.4h1.5zm3.8 2.6v-2.3h2.3v-1.3h-2.3V9.6h2.9V8.3h-4.4v8.2h4.4v-1.3h-2.9z"/>
  </svg>
);

/**
 * Get file icon component based on file name and type
 */
export function getFileIcon(
  name: string,
  isDirectory: boolean,
  isExpanded?: boolean
): React.ReactNode {
  if (isDirectory) {
    return <FolderIcon expanded={isExpanded} />;
  }

  const ext = name.split('.').pop()?.toLowerCase() || '';

  switch (ext) {
    case 'ts':
    case 'tsx':
      return <TypeScriptIcon />;
    case 'js':
    case 'jsx':
      return <JavaScriptIcon />;
    case 'py':
      return <PythonIcon />;
    case 'rs':
      return <RustIcon />;
    case 'go':
      return <GoIcon />;
    case 'json':
      return <JSONIcon />;
    case 'md':
    case 'mdx':
      return <MarkdownIcon />;
    case 'css':
      return <CSSIcon />;
    case 'scss':
    case 'sass':
      return <CSSIcon />;
    case 'html':
    case 'htm':
      return <HTMLIcon />;
    default:
      return <DefaultFileIcon />;
  }
}

export { FolderIcon, DefaultFileIcon };
