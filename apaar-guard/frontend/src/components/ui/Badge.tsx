import React from 'react';

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: 'ready' | 'needs-review' | 'invalid' | 'neutral' | 'success' | 'warning' | 'error' | 'info';
  size?: 'sm' | 'md';
}

export function Badge({
  children,
  variant = 'neutral',
  size = 'md',
  className = '',
  ...props
}: BadgeProps) {
  const sizeStyles = {
    sm: 'text-[10px] px-1.5 py-0.5',
    md: 'text-xs px-2.5 py-0.5'
  };

  const variantStyles = {
    ready: 'bg-emerald-50 text-emerald-700 border border-emerald-200/60 font-medium',
    'needs-review': 'bg-amber-50 text-amber-800 border border-amber-200/60 font-medium',
    invalid: 'bg-rose-50 text-rose-700 border border-rose-200/60 font-medium',
    neutral: 'bg-slate-100 text-slate-700 border border-slate-200 font-medium',
    success: 'bg-emerald-50 text-emerald-700 border border-emerald-200/60 font-medium',
    warning: 'bg-amber-50 text-amber-800 border border-amber-200/60 font-medium',
    error: 'bg-rose-50 text-rose-700 border border-rose-200/60 font-medium',
    info: 'bg-blue-50 text-blue-700 border border-blue-200/60 font-medium',
  };

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full font-medium tracking-tight ${sizeStyles[size]} ${variantStyles[variant]} ${className}`}
      {...props}
    >
      {children}
    </span>
  );
}

