/**
 * Problem Icon Component
 * IDE Kimi IDE - Severity icon for problems
 */

import React from 'react';
import { DiagnosticSeverity } from '../../languages/core/types';
import { severityToColor } from '../types';

interface ProblemIconProps {
  severity: DiagnosticSeverity;
  size?: number;
}

export const ProblemIcon: React.FC<ProblemIconProps> = ({ severity, size = 16 }) => {
  const color = severityToColor(severity);

  switch (severity) {
    case DiagnosticSeverity.Error:
      return (
        <svg width={size} height={size} viewBox="0 0 16 16" fill="none">
          <circle cx="8" cy="8" r="7" stroke={color} strokeWidth="1.5" />
          <line x1="5" y1="5" x2="11" y2="11" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
          <line x1="11" y1="5" x2="5" y2="11" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      );

    case DiagnosticSeverity.Warning:
      return (
        <svg width={size} height={size} viewBox="0 0 16 16" fill="none">
          <path
            d="M8 2L14 13H2L8 2Z"
            stroke={color}
            strokeWidth="1.5"
            strokeLinejoin="round"
            fill="none"
          />
          <line x1="8" y1="6" x2="8" y2="9" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
          <circle cx="8" cy="11.5" r="0.75" fill={color} />
        </svg>
      );

    case DiagnosticSeverity.Information:
      return (
        <svg width={size} height={size} viewBox="0 0 16 16" fill="none">
          <circle cx="8" cy="8" r="7" stroke={color} strokeWidth="1.5" />
          <line x1="8" y1="7" x2="8" y2="11" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
          <circle cx="8" cy="4.5" r="0.75" fill={color} />
        </svg>
      );

    case DiagnosticSeverity.Hint:
      return (
        <svg width={size} height={size} viewBox="0 0 16 16" fill="none">
          <path
            d="M8 2L8.5 5.5L12 6L8.5 6.5L8 10L7.5 6.5L4 6L7.5 5.5L8 2Z"
            fill={color}
          />
          <circle cx="8" cy="12" r="1.5" fill={color} />
        </svg>
      );

    default:
      return (
        <svg width={size} height={size} viewBox="0 0 16 16" fill="none">
          <circle cx="8" cy="8" r="7" stroke={color} strokeWidth="1.5" />
        </svg>
      );
  }
};

export default ProblemIcon;
