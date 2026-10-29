import React, { forwardRef } from 'react';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helperText?: string;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  isRequired?: boolean;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(({
  label,
  error,
  helperText,
  leftIcon,
  rightIcon,
  isRequired,
  className = '',
  id,
  required,
  ...props
}, ref) => {
  const inputId = id || (label ? label.toLowerCase().replace(/[^a-z0-9]+/g, '-') : undefined);
  const errorId = inputId ? `${inputId}-error` : undefined;
  const helperId = inputId ? `${inputId}-helper` : undefined;
  const isFieldRequired = isRequired || required;

  return (
    <div className="w-full space-y-1">
      {label && (
        <label htmlFor={inputId} className="block text-xs font-semibold text-slate-700">
          {label}
          {isFieldRequired && (
            <span className="text-rose-500 ml-0.5 font-bold" aria-hidden="true">
              *
            </span>
          )}
          {isFieldRequired && <span className="sr-only"> (required)</span>}
        </label>
      )}
      <div className="relative rounded-md shadow-sm">
        {leftIcon && (
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
            {leftIcon}
          </div>
        )}
        <input
          ref={ref}
          id={inputId}
          required={required}
          aria-invalid={!!error}
          aria-describedby={error ? errorId : helperText ? helperId : undefined}
          className={`block w-full rounded-md border text-sm transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-offset-0 disabled:bg-slate-50 disabled:text-slate-500 disabled:cursor-not-allowed ${
            leftIcon ? 'pl-9' : 'pl-3'
          } ${rightIcon ? 'pr-9' : 'pr-3'} py-2 ${
            error
              ? 'border-rose-400 text-rose-900 focus:border-rose-500 focus:ring-rose-200'
              : 'border-slate-300 text-slate-900 focus:border-indigo-500 focus:ring-indigo-100'
          } ${className}`}
          {...props}
        />
        {rightIcon && (
          <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none text-slate-400">
            {rightIcon}
          </div>
        )}
      </div>
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

Input.displayName = 'Input';

