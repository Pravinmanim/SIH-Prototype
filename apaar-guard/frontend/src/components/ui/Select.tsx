import React, { forwardRef } from 'react';

export interface SelectOption {
  value: string | number;
  label: string;
}

export interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  options?: SelectOption[];
  error?: string;
  helperText?: string;
  isRequired?: boolean;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(({
  label,
  options = [],
  error,
  helperText,
  isRequired,
  className = '',
  children,
  id,
  required,
  ...props
}, ref) => {
  const selectId = id || (label ? label.toLowerCase().replace(/[^a-z0-9]+/g, '-') : undefined);
  const errorId = selectId ? `${selectId}-error` : undefined;
  const helperId = selectId ? `${selectId}-helper` : undefined;
  const isFieldRequired = isRequired || required;

  return (
    <div className="w-full space-y-1">
      {label && (
        <label htmlFor={selectId} className="block text-xs font-semibold text-slate-700">
          {label}
          {isFieldRequired && (
            <span className="text-rose-500 ml-0.5 font-bold" aria-hidden="true">
              *
            </span>
          )}
          {isFieldRequired && <span className="sr-only"> (required)</span>}
        </label>
      )}
      <select
        ref={ref}
        id={selectId}
        required={required}
        aria-invalid={!!error}
        aria-describedby={error ? errorId : helperText ? helperId : undefined}
        className={`block w-full rounded-md border text-sm py-2 px-3 bg-white text-slate-900 transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-offset-0 disabled:bg-slate-50 disabled:text-slate-500 disabled:cursor-not-allowed shadow-sm ${
          error
            ? 'border-rose-400 focus:border-rose-500 focus:ring-rose-200'
            : 'border-slate-300 focus:border-indigo-500 focus:ring-indigo-100'
        } ${className}`}
        {...props}
      >
        {children ||
          options.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
      </select>
      {error ? (
        <p id={errorId} role="alert" className="text-xs text-rose-600 font-medium">
          {error}
        </p>
      ) : helperText ? (
        <p id={helperId} className="text-xs text-slate-500">
          {helperText}
        </p>
      ) : null}
    </div>
  );
});

Select.displayName = 'Select';

