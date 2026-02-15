/**
 * SymbolIcon Component
 * Renders icons for different symbol types
 */

import React, { memo } from 'react';
import { SymbolKind, SymbolTag, DEFAULT_SYMBOL_ICONS, SymbolIconConfig } from './types';

interface SymbolIconProps {
  kind: SymbolKind;
  tags?: SymbolTag[];
  size?: 'small' | 'medium' | 'large';
  className?: string;
  customIcon?: string;
  showAccessibility?: boolean;
  accessibility?: 'public' | 'private' | 'protected' | 'internal';
}

const SIZE_MAP = {
  small: { fontSize: 12, width: 16 },
  medium: { fontSize: 14, width: 20 },
  large: { fontSize: 16, width: 24 },
};

/**
 * Get accessibility modifier icon
 */
const getAccessibilityIcon = (
  accessibility?: 'public' | 'private' | 'protected' | 'internal'
): string => {
  switch (accessibility) {
    case 'private':
      return '-';
    case 'protected':
      return '#';
    case 'internal':
      return '~';
    case 'public':
    default:
      return '+';
  }
};

/**
 * Get color for symbol kind
 */
const getSymbolColor = (kind: SymbolKind): string => {
  const config = DEFAULT_SYMBOL_ICONS[kind];
  return config?.color || '#cccccc';
};

/**
 * SymbolIcon component
 */
export const SymbolIcon: React.FC<SymbolIconProps> = memo(({
  kind,
  tags = [],
  size = 'medium',
  className = '',
  customIcon,
  showAccessibility = false,
  accessibility,
}) => {
  const config = DEFAULT_SYMBOL_ICONS[kind];
  const sizeConfig = SIZE_MAP[size];
  
  const isDeprecated = tags.includes('deprecated');
  const isStatic = tags.includes('static');
  const isAbstract = tags.includes('abstract');
  const isAsync = tags.includes('async');

  const icon = customIcon || config.icon;
  const color = config.color || '#cccccc';
  const tooltip = config.tooltip || kind;

  // Build tooltip with tags info
  const tagInfo: string[] = [];
  if (isDeprecated) tagInfo.push('deprecated');
  if (isStatic) tagInfo.push('static');
  if (isAbstract) tagInfo.push('abstract');
  if (isAsync) tagInfo.push('async');
  if (accessibility) tagInfo.push(accessibility);

  const fullTooltip = tagInfo.length > 0 
    ? `${tooltip} (${tagInfo.join(', ')})`
    : tooltip;

  return (
    <span
      className={`symbol-icon ${className}`}
      title={fullTooltip}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: sizeConfig.width,
        height: sizeConfig.width,
        fontSize: sizeConfig.fontSize,
        fontFamily: 'var(--font-mono, "SF Mono", Monaco, monospace)',
        color: isDeprecated ? '#666666' : color,
        opacity: isDeprecated ? 0.6 : 1,
        textDecoration: isDeprecated ? 'line-through' : 'none',
        fontStyle: isAbstract ? 'italic' : 'normal',
        fontWeight: isStatic ? 'bold' : 'normal',
        position: 'relative',
      }}
    >
      {showAccessibility && accessibility && (
        <span
          style={{
            position: 'absolute',
            bottom: -2,
            right: -2,
            fontSize: 8,
            color: accessibility === 'private' ? '#f48771' : '#4ec9b0',
          }}
        >
          {getAccessibilityIcon(accessibility)}
        </span>
      )}
      {icon}
      {isAsync && (
        <span
          style={{
            position: 'absolute',
            top: -2,
            right: -2,
            fontSize: 8,
            color: '#b180d7',
          }}
        >
          ⚡
        </span>
      )}
    </span>
  );
});

SymbolIcon.displayName = 'SymbolIcon';

/**
 * SymbolIconGroup - shows multiple icons for composite symbols
 */
interface SymbolIconGroupProps {
  kinds: SymbolKind[];
  size?: 'small' | 'medium' | 'large';
  className?: string;
}

export const SymbolIconGroup: React.FC<SymbolIconGroupProps> = memo(({
  kinds,
  size = 'small',
  className = '',
}) => {
  return (
    <span
      className={`symbol-icon-group ${className}`}
      style={{
        display: 'inline-flex',
        gap: 2,
        alignItems: 'center',
      }}
    >
      {kinds.map((kind, index) => (
        <SymbolIcon key={index} kind={kind} size={size} />
      ))}
    </span>
  );
});

SymbolIconGroup.displayName = 'SymbolIconGroup';

/**
 * SymbolBadge - shows symbol kind as a badge
 */
interface SymbolBadgeProps {
  kind: SymbolKind;
  className?: string;
}

export const SymbolBadge: React.FC<SymbolBadgeProps> = memo(({
  kind,
  className = '',
}) => {
  const config = DEFAULT_SYMBOL_ICONS[kind];
  
  return (
    <span
      className={`symbol-badge ${className}`}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        padding: '1px 6px',
        borderRadius: 3,
        fontSize: 11,
        fontFamily: 'var(--font-mono, "SF Mono", Monaco, monospace)',
        backgroundColor: `${config.color}20`,
        color: config.color,
        textTransform: 'uppercase',
        letterSpacing: 0.5,
      }}
    >
      {config.icon} {kind}
    </span>
  );
});

SymbolBadge.displayName = 'SymbolBadge';

export default SymbolIcon;
