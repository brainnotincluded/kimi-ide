/**
 * @fileoverview Sidebar layout component
 * @module renderer/components/layout/Sidebar
 */

import React, { useState } from 'react';
import { ActivityBar } from './ActivityBar';
import { SidebarView } from '../../../shared/types';

export interface SidebarProps {
  children?: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}

export const Sidebar: React.FC<SidebarProps> = ({
  children,
  className = '',
  style = {},
}) => {
  const [activeView, setActiveView] = useState<SidebarView>('explorer');

  const containerStyles: React.CSSProperties = {
    display: 'flex',
    height: '100%',
    backgroundColor: '#1e1e1e',
    ...style,
  };

  const contentStyles: React.CSSProperties = {
    flex: 1,
    overflow: 'hidden',
  };

  return (
    <div className={`sidebar ${className}`} style={containerStyles}>
      <ActivityBar activeView={activeView} onViewChange={setActiveView} />
      <div className="sidebar-content" style={contentStyles}>
        {children}
      </div>
    </div>
  );
};

export default Sidebar;
