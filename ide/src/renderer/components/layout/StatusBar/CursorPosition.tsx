/**
 * @fileoverview Cursor position component
 * @module renderer/components/layout/StatusBar/CursorPosition
 */

import React from 'react';

export interface CursorPositionProps {
  line: number;
  column: number;
}

export const CursorPosition: React.FC<CursorPositionProps> = ({ line, column }) => {
  return (
    <span className="statusbar-cursor">
      Ln {line}, Col {column}
    </span>
  );
};

export default CursorPosition;
