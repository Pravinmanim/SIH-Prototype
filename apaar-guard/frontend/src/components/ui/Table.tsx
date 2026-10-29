import React from 'react';

export function Table({
  children,
  className = '',
  ...props
}: React.TableHTMLAttributes<HTMLTableElement>) {
  return (
    <div className="w-full overflow-x-auto">
      <table className={`w-full text-left border-collapse text-sm ${className}`} {...props}>
        {children}
      </table>
    </div>
  );
}

export function TableHeader({
  children,
  className = '',
  ...props
}: React.HTMLAttributes<HTMLTableSectionElement>) {
  return (
    <thead className={`bg-slate-50 border-b border-slate-200 text-xs font-semibold uppercase tracking-wider text-slate-500 ${className}`} {...props}>
      {children}
    </thead>
  );
}

export function TableBody({
  children,
  className = '',
  ...props
}: React.HTMLAttributes<HTMLTableSectionElement>) {
  return (
    <tbody className={`divide-y divide-slate-100 bg-white ${className}`} {...props}>
      {children}
    </tbody>
  );
}

export function TableRow({
  children,
  className = '',
  isClickable = false,
  ...props
}: React.HTMLAttributes<HTMLTableRowElement> & { isClickable?: boolean }) {
  return (
    <tr
      className={`transition-colors duration-100 ${
        isClickable ? 'hover:bg-indigo-50/40 cursor-pointer' : 'hover:bg-slate-50/60'
      } ${className}`}
      {...props}
    >
      {children}
    </tr>
  );
}

export function TableHead({
  children,
  className = '',
  ...props
}: React.ThHTMLAttributes<HTMLTableCellElement>) {
  return (
    <th className={`px-4 py-3 font-semibold text-slate-600 ${className}`} {...props}>
      {children}
    </th>
  );
}

export function TableCell({
  children,
  className = '',
  ...props
}: React.TdHTMLAttributes<HTMLTableCellElement>) {
  return (
    <td className={`px-4 py-3 text-slate-700 whitespace-nowrap ${className}`} {...props}>
      {children}
    </td>
  );
}

