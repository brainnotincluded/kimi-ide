/**
 * @fileoverview Tabs UI primitive
 * @module renderer/components/ui/Tabs
 */

import React, { useState, createContext, useContext } from 'react';

interface TabsContextValue {
  activeTab: string;
  setActiveTab: (id: string) => void;
}

const TabsContext = createContext<TabsContextValue | null>(null);

export interface TabsProps {
  children: React.ReactNode;
  defaultTab: string;
  className?: string;
  style?: React.CSSProperties;
}

export const Tabs: React.FC<TabsProps> = ({
  children,
  defaultTab,
  className = '',
  style = {},
}) => {
  const [activeTab, setActiveTab] = useState(defaultTab);

  return (
    <TabsContext.Provider value={{ activeTab, setActiveTab }}>
      <div className={`ui-tabs ${className}`} style={{ display: 'flex', flexDirection: 'column', height: '100%', ...style }}>
        {children}
      </div>
    </TabsContext.Provider>
  );
};

export interface TabItemProps {
  id: string;
  label: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}

export const TabItem: React.FC<TabItemProps> = ({ id, label, children, className = '' }) => {
  const context = useContext(TabsContext);
  
  if (!context) {
    throw new Error('TabItem must be used within Tabs');
  }

  const { activeTab, setActiveTab } = context;
  const isActive = activeTab === id;

  return (
    <>
      {isActive && (
        <div className={`ui-tab-content ${className}`} style={{ flex: 1, overflow: 'hidden' }}>
          {children}
        </div>
      )}
    </>
  );
};

export interface TabListProps {
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}

export const TabList: React.FC<TabListProps> = ({ children, className = '', style = {} }) => {
  return (
    <div 
      className={`ui-tab-list ${className}`} 
      style={{ 
        display: 'flex', 
        backgroundColor: '#2d2d2d',
        borderBottom: '1px solid #3c3c3c',
        ...style 
      }}
    >
      {children}
    </div>
  );
};

export interface TabProps {
  id: string;
  children: React.ReactNode;
  className?: string;
  onClose?: () => void;
}

export const Tab: React.FC<TabProps> = ({ id, children, className = '', onClose }) => {
  const context = useContext(TabsContext);
  
  if (!context) {
    throw new Error('Tab must be used within Tabs');
  }

  const { activeTab, setActiveTab } = context;
  const isActive = activeTab === id;

  const tabStyles: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    padding: '0 12px',
    height: '35px',
    fontSize: '12px',
    color: isActive ? '#ffffff' : '#969696',
    backgroundColor: isActive ? '#1e1e1e' : 'transparent',
    border: 'none',
    borderBottom: isActive ? '1px solid #007acc' : 'none',
    cursor: 'pointer',
    transition: 'all 0.15s ease',
  };

  return (
    <button
      className={`ui-tab ${isActive ? 'active' : ''} ${className}`}
      style={tabStyles}
      onClick={() => setActiveTab(id)}
    >
      {children}
      {onClose && (
        <span 
          className="ui-tab__close"
          onClick={(e) => {
            e.stopPropagation();
            onClose();
          }}
          style={{ 
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '16px',
            height: '16px',
            borderRadius: '3px',
            marginLeft: '4px',
          }}
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M18 6 6 18M6 6l12 12" />
          </svg>
        </span>
      )}
    </button>
  );
};
