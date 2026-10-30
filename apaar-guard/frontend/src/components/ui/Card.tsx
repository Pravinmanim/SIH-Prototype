import React from 'react';

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'interactive' | 'subtle' | 'flat';
  rounded?: 'lg' | 'xl' | '2xl';
}

export function Card({
  children,
  className = '',
  variant = 'default',
  rounded = '2xl',
  onClick,
  ...props
}: CardProps) {
  const isInteractive = Boolean(onClick) || variant === 'interactive';

  const roundedStyles: Record<'lg' | 'xl' | '2xl', string> = {
    lg: 'rounded-lg',
    xl: 'rounded-xl',
    '2xl': 'rounded-2xl',
  };

  const baseStyles = 'bg-white border border-slate-200/80 shadow-xs overflow-hidden';
  const interactiveStyles = isInteractive
    ? 'cursor-pointer hover:border-slate-300 hover:shadow-sm transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 select-none'
    : '';

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (onClick && (e.key === 'Enter' || e.key === ' ')) {
      e.preventDefault();
      onClick(e as any);
    }
  };

  return (
    <div
      onClick={onClick}
      onKeyDown={isInteractive ? handleKeyDown : props.onKeyDown}
      tabIndex={isInteractive && props.tabIndex === undefined ? 0 : props.tabIndex}
      role={isInteractive && !props.role ? 'button' : props.role}
      className={`${baseStyles} ${roundedStyles[rounded]} ${interactiveStyles} ${className}`}
      {...props}
    >
      {children}
    </div>
  );
}

export function CardHeader({
  children,
  className = '',
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={`px-6 py-5 border-b border-slate-100 flex items-center justify-between ${className}`} {...props}>
      {children}
    </div>
  );
}

export function CardTitle({
  children,
  className = '',
  ...props
}: React.HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h3 className={`text-base font-bold text-slate-900 tracking-tight ${className}`} {...props}>
      {children}
    </h3>
  );
}

export function CardDescription({
  children,
  className = '',
  ...props
}: React.HTMLAttributes<HTMLParagraphElement>) {
  return (
    <p className={`text-xs text-slate-500 mt-0.5 leading-relaxed ${className}`} {...props}>
      {children}
    </p>
  );
}

export function CardContent({
  children,
  className = '',
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={`p-6 ${className}`} {...props}>
      {children}
    </div>
  );
}

export function CardFooter({
  children,
  className = '',
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={`px-6 py-3.5 bg-slate-50/70 border-t border-slate-100 flex items-center justify-between text-xs text-slate-600 ${className}`}
      {...props}
    >
      {children}
    </div>
  );
}

export interface MetricCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: React.ElementType;
  colorVariant?: 'blue' | 'emerald' | 'rose' | 'amber' | 'purple' | 'indigo';
  badgeText?: string;
  badgeVariant?: 'emerald' | 'rose' | 'amber' | 'blue' | 'purple';
  onClick?: () => void;
  className?: string;
  ariaLabel?: string;
}

const COLOR_VARIANTS = {
  blue: {
    iconBg: 'bg-blue-50 text-blue-600 border border-blue-100/80',
    valueColor: 'text-slate-900',
    accentBorder: 'hover:border-blue-400/80',
    subtextColor: 'text-slate-400',
  },
  emerald: {
    iconBg: 'bg-emerald-50 text-emerald-600 border border-emerald-100/80',
    valueColor: 'text-emerald-700',
    accentBorder: 'hover:border-emerald-400/80',
    subtextColor: 'text-slate-400',
  },
  rose: {
    iconBg: 'bg-rose-50 text-rose-600 border border-rose-100/80',
    valueColor: 'text-rose-700',
    accentBorder: 'hover:border-rose-400/80',
    subtextColor: 'text-slate-400',
  },
  amber: {
    iconBg: 'bg-amber-50 text-amber-600 border border-amber-100/80',
    valueColor: 'text-amber-700',
    accentBorder: 'hover:border-amber-400/80',
    subtextColor: 'text-slate-400',
  },
  purple: {
    iconBg: 'bg-purple-50 text-purple-600 border border-purple-100/80',
    valueColor: 'text-purple-700',
    accentBorder: 'hover:border-purple-400/80',
    subtextColor: 'text-slate-400',
  },
  indigo: {
    iconBg: 'bg-indigo-50 text-indigo-600 border border-indigo-100/80',
    valueColor: 'text-indigo-700',
    accentBorder: 'hover:border-indigo-400/80',
    subtextColor: 'text-slate-400',
  },
};

const BADGE_STYLES: Record<'emerald' | 'rose' | 'amber' | 'blue' | 'indigo' | 'purple', string> = {
  emerald: 'bg-emerald-50 text-emerald-700 border-emerald-200/70',
  rose: 'bg-rose-50 text-rose-700 border-rose-200/70',
  amber: 'bg-amber-50 text-amber-700 border-amber-200/70',
  blue: 'bg-blue-50 text-blue-700 border-blue-200/70',
  indigo: 'bg-indigo-50 text-indigo-700 border-indigo-200/70',
  purple: 'bg-purple-50 text-purple-700 border-purple-200/70',
};

export const MetricCard: React.FC<MetricCardProps> = ({
  title,
  value,
  subtitle,
  icon: Icon,
  colorVariant = 'blue',
  badgeText,
  badgeVariant = 'emerald',
  onClick,
  className = '',
  ariaLabel,
}) => {
  const variant = COLOR_VARIANTS[colorVariant] || COLOR_VARIANTS.blue;
  const isInteractive = Boolean(onClick);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (onClick && (e.key === 'Enter' || e.key === ' ')) {
      e.preventDefault();
      onClick();
    }
  };

  return (
    <div
      onClick={onClick}
      onKeyDown={isInteractive ? handleKeyDown : undefined}
      tabIndex={isInteractive ? 0 : undefined}
      role={isInteractive ? 'button' : undefined}
      aria-label={ariaLabel || `${title}: ${value}`}
      className={`bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col justify-between h-full min-h-[135px] transition-all duration-150 ${
        isInteractive
          ? `cursor-pointer ${variant.accentBorder} hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2`
          : ''
      } ${className}`}
    >
      {/* Top Header: Title & Icon Container */}
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block truncate">
            {title}
          </span>
          {subtitle && (
            <span className="text-[11px] text-slate-400 block truncate mt-0.5">
              {subtitle}
            </span>
          )}
        </div>
        <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${variant.iconBg}`}>
          <Icon className="w-4 h-4" />
        </div>
      </div>

      {/* Bottom Metric: Value & optional Badge */}
      <div className="mt-3 flex items-baseline gap-2">
        <span className={`text-2xl sm:text-3xl font-extrabold tracking-tight ${variant.valueColor}`}>
          {value}
        </span>
        {badgeText && (
          <span className={`inline-flex items-center text-[11px] font-semibold px-2 py-0.5 rounded-full border ${BADGE_STYLES[badgeVariant] || BADGE_STYLES.emerald}`}>
            {badgeText}
          </span>
        )}
      </div>
    </div>
  );
};
