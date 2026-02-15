/**
 * @fileoverview Resizer logic hook
 * @module renderer/hooks/useResizer
 */

import { useState, useCallback, useEffect } from 'react';

export type ResizeDirection = 'vertical' | 'horizontal';

export interface UseResizerOptions {
  direction: ResizeDirection;
  min: number;
  max: number;
  default: number;
}

export interface UseResizerReturn {
  size: number;
  isResizing: boolean;
  startResize: () => void;
  stopResize: () => void;
}

export function useResizer(options: UseResizerOptions): UseResizerReturn {
  const [size, setSize] = useState(options.default);
  const [isResizing, setIsResizing] = useState(false);

  const startResize = useCallback(() => {
    setIsResizing(true);
  }, []);

  const stopResize = useCallback(() => {
    setIsResizing(false);
  }, []);

  useEffect(() => {
    if (!isResizing) return;

    const handleMouseMove = (e: MouseEvent) => {
      const newSize = options.direction === 'vertical'
        ? Math.max(options.min, Math.min(options.max, e.clientX))
        : Math.max(options.min, Math.min(options.max, window.innerHeight - e.clientY));
      
      setSize(newSize);
    };

    const handleMouseUp = () => {
      setIsResizing(false);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    document.body.style.cursor = options.direction === 'vertical' ? 'ew-resize' : 'ns-resize';
    document.body.style.userSelect = 'none';

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
  }, [isResizing, options.direction, options.min, options.max]);

  return {
    size,
    isResizing,
    startResize,
    stopResize,
  };
}

export default useResizer;
