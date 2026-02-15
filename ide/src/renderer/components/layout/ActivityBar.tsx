/**
 * @fileoverview ActivityBar layout component
 * @module renderer/components/layout/ActivityBar
 */

import React from 'react';
import { SidebarView } from '../../../shared/types';

export interface ActivityBarProps {
  activeView: SidebarView;
  onViewChange: (view: SidebarView) => void;
}

interface ActivityItem {
  id: SidebarView;
  icon: React.ReactNode;
  title: string;
}

const ACTIVITY_ITEMS: ActivityItem[] = [
  {
    id: 'explorer',
    title: 'Explorer',
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M3 3h7v7H3zM14 3h7v7h-7zM14 14h7v7h-7zM3 14h7v7H3z"/>
      </svg>
    ),
  },
  {
    id: 'search',
    title: 'Search',
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="11" cy="11" r="8"/>
        <path d="m21 21-4.35-4.35"/>
      </svg>
    ),
  },
  {
    id: 'git',
    title: 'Source Control',
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="6" cy="6" r="3"/>
        <circle cx="6" cy="18" r="3"/>
        <path d="M6 9v6"/>
        <path d="m9 6 3-3 3 3"/>
        <path d="m15 18-3 3-3-3"/>
      </svg>
    ),
  },
  {
    id: 'debug',
    title: 'Run and Debug',
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="m12 5 7 7-7 7"/>
        <path d="M5 5v14"/>
      </svg>
    ),
  },
  {
    id: 'extensions',
    title: 'Extensions',
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <rect x="4" y="4" width="16" height="16" rx="2"/>
        <rect x="9" y="9" width="6" height="6"/>
        <path d="M9 1v3M15 1v3M9 20v3M15 20v3M20 9h3M20 14h3M1 9h3M1 14h3"/>
      </svg>
    ),
  },
];

export const ActivityBar: React.FC<ActivityBarProps> = ({
  activeView,
  onViewChange,
}) => {
  const containerStyles: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    width: '48px',
    padding: '8px 0',
    backgroundColor: '#2d2d2d',
    borderRight: '1px solid #3c3c3c',
    gap: '4px',
  };

  const itemStyles = (isActive: boolean): React.CSSProperties => ({
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '40px',
    height: '40px',
    color: isActive ? '#ffffff' : '#858585',
    backgroundColor: isActive ? '#37373d' : 'transparent',
    border: 'none',
    borderLeft: isActive ? '2px solid #007acc' : '2px solid transparent',
    cursor: 'pointer',
    transition: 'all 0.15s ease',
  });

  return (
    <div className="activity-bar" style={containerStyles}>
      {ACTIVITY_ITEMS.map((item) => (
        <button
          key={item.id}
          className={`activity-item ${activeView === item.id ? 'active' : ''}`}
          style={itemStyles(activeView === item.id)}
          onClick={() => onViewChange(item.id)}
          title={item.title}
        >
          {item.icon}
        </button>
      ))}
    </div>
  );
};

export default ActivityBar;
