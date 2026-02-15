/**
 * @fileoverview Button UI primitive
 * @module renderer/components/ui/Button
 */

import React from 'react';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'icon';
  size?: 'sm' | 'md' | 'lg';
  children: React.ReactNode;
}

export const Button: React.FC<ButtonProps> = ({
  variant = 'secondary',
  size = 'md',
  children,
  className = '',
  ...props
}) => {
  const baseStyles: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '6px',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    fontFamily: 'inherit',
    transition: 'all 0.15s ease',
  };

  const variantStyles: Record<string, React.CSSProperties> = {
    primary: {
      backgroundColor: '#0e639c',
      color: '#ffffff',
    },
    secondary: {
      backgroundColor: '#3c3c3c',
      color: '#cccccc',
    },
    ghost: {
      backgroundColor: 'transparent',
      color: '#cccccc',
    },
    icon: {
      backgroundColor: 'transparent',
      color: '#cccccc',
      padding: '4px',
    },
  };

  const sizeStyles: Record<string, React.CSSProperties> = {
    sm: { padding: '4px 8px', fontSize: '11px' },
    md: { padding: '6px 12px', fontSize: '12px' },
    lg: { padding: '8px 16px', fontSize: '13px' },
  };

  const combinedStyles: React.CSSProperties = {
    ...baseStyles,
    ...variantStyles[variant],
    ...sizeStyles[size],
  };

  return (
    <button
      className={`ui-button ui-button--${variant} ui-button--${size} ${className}`}
      style={combinedStyles}
      {...props}
    >
      {children}
    </button>
  );
};

export default Button;
