import React from 'react';
import type { StudentStatus } from '../../types';

interface StatusBadgeProps {
  status: StudentStatus | string;
  size?: 'sm' | 'md';
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status, size = 'md' }) => {
  let bgClass = 'bg-slate-100 text-slate-700 border-slate-200';

  switch (status) {
    case 'Ready':
      bgClass = 'bg-emerald-50 text-emerald-700 border-emerald-200/70';
      break;
    case 'Invalid Data':
      bgClass = 'bg-rose-50 text-rose-700 border-rose-200/70';
      break;
    case 'Needs Review':
      bgClass = 'bg-amber-50 text-amber-800 border-amber-200/70';
      break;
    case 'Correction Requested':
      bgClass = 'bg-orange-50 text-orange-800 border-orange-200/70';
      break;
    case 'Resolved':
      bgClass = 'bg-blue-50 text-blue-700 border-blue-200/70';
      break;
    case 'False Positive':
      bgClass = 'bg-purple-50 text-purple-700 border-purple-200/70';
      break;
    case 'Within Capacity':
      bgClass = 'bg-emerald-50 text-emerald-700 border-emerald-200/70';
      break;
    case 'Near Capacity':
      bgClass = 'bg-amber-50 text-amber-800 border-amber-200/70';
      break;
    case 'Exceeds Capacity':
      bgClass = 'bg-rose-50 text-rose-700 border-rose-200/70';
      break;
    case 'Configuration Missing':
      bgClass = 'bg-slate-100 text-slate-600 border-slate-200';
      break;
  }

  const px = size === 'sm' ? 'px-2 py-0.5 text-[11px]' : 'px-2.5 py-0.5 text-xs font-semibold';

  return (
    <span className={`inline-flex items-center rounded-full border tracking-tight ${px} ${bgClass}`}>
      <span className="w-1.5 h-1.5 rounded-full mr-1.5 bg-current opacity-70"></span>
      {status}
    </span>
  );
};
