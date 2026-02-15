/**
 * @fileoverview Panel UI primitive
 * @module renderer/components/ui/Panel
 */

import React from 'react';

export interface PanelProps {
  children: React.ReactNode;
  title?: string;
  className?: string;
  style?: React.CSSProperties;
  headerActions?: React.ReactNode;
}

export const Panel: React.FC<PanelProps> = ({
  children,
  title,
  className = '',
  style = {},
  headerActions,
}) => {
  const panelStyles: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    backgroundColor: '#1e1e1e',
    overflow: 'hidden',
    ...style,
  };

  const headerStyles: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '0 12px',
    height: '35px',
    backgroundColor: '#2d2d2d',
    borderBottom: '1px solid #3c3c3c',
    fontSize: '11px',
    fontWeight: 600,
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
  };

  const contentStyles: React.CSSProperties = {
    flex: 1,
    overflow: 'auto',
  };

  return (
    <div className={`ui-panel ${className}`} style={panelStyles}>
      {(title || headerActions) && (
        <div className="ui-panel__header" style={headerStyles}>
          {title && <span className="ui-panel__title">{title}</span>}
          {headerActions && (
            <div className="ui-panel__actions">{headerActions}</div>
          )}
        </div>
      )}
      <div className="ui-panel__content" style={contentStyles}>
        {children}
      </div>
    </div>
  );
};

export default Panel;
