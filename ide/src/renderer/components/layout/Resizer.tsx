/**
 * @fileoverview Resizer layout component
 * @module renderer/components/layout/Resizer
 */

import React from 'react';

export type ResizerDirection = 'vertical' | 'horizontal';

export interface ResizerProps {
  direction: ResizerDirection;
  isActive?: boolean;
  position?: number;
  onMouseDown?: () => void;
  className?: string;
  style?: React.CSSProperties;
}

export const Resizer: React.FC<ResizerProps> = ({
  direction,
  isActive = false,
  position,
  onMouseDown,
  className = '',
  style = {},
}) => {
  const isVertical = direction === 'vertical';

  const baseStyles: React.CSSProperties = {
    position: 'absolute',
    zIndex: 100,
    backgroundColor: isActive ? '#007acc' : 'transparent',
    transition: 'background-color 0.15s',
  };

  const directionStyles: React.CSSProperties = isVertical
    ? {
        top: 0,
        bottom: 0,
        width: '4px',
        cursor: 'col-resize',
      }
    : {
        left: 0,
        right: 0,
        height: '4px',
        cursor: 'row-resize',
      };

  const positionStyles: React.CSSProperties = {};
  if (position !== undefined) {
    if (isVertical) {
      positionStyles.left = position;
    } else {
      positionStyles.bottom = position;
    }
  }

  return (
    <div
      className={`resizer resizer-${direction} ${isActive ? 'active' : ''} ${className}`}
      style={{ ...baseStyles, ...directionStyles, ...positionStyles, ...style }}
      onMouseDown={onMouseDown}
    />
  );
};

export default Resizer;
