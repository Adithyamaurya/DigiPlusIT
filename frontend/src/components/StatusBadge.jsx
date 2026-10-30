import React from 'react';

const STATUS_CONFIGS = {
  // Task statuses
  'Pending': { bg: 'bg-amber-50 text-amber-700 border-amber-200', dot: 'bg-amber-500' },
  'In Progress': { bg: 'bg-blue-50 text-blue-700 border-blue-200', dot: 'bg-blue-500' },
  'Completed': { bg: 'bg-emerald-50 text-emerald-700 border-emerald-200', dot: 'bg-emerald-500' },
  'Blocked': { bg: 'bg-rose-50 text-rose-700 border-rose-200', dot: 'bg-rose-500' },
  
  // Work Transfer statuses
  'Draft': { bg: 'bg-slate-100 text-slate-700 border-slate-200', dot: 'bg-slate-400' },
  'Pending Acknowledgement': { bg: 'bg-amber-50 text-amber-700 border-amber-200', dot: 'bg-amber-500 animate-pulse' },
  'Acknowledged': { bg: 'bg-indigo-50 text-indigo-700 border-indigo-200', dot: 'bg-indigo-500' },

  // Priorities
  'Urgent': { bg: 'bg-rose-100 text-rose-800 border-rose-300 font-semibold', dot: 'bg-rose-600' },
  'High': { bg: 'bg-orange-50 text-orange-700 border-orange-200', dot: 'bg-orange-500' },
  'Medium': { bg: 'bg-blue-50 text-blue-700 border-blue-200', dot: 'bg-blue-500' },
  'Low': { bg: 'bg-slate-100 text-slate-600 border-slate-200', dot: 'bg-slate-400' },

  // Risks
  'Critical': { bg: 'bg-red-100 text-red-800 border-red-300 font-semibold', dot: 'bg-red-600' },
  'Healthy': { bg: 'bg-emerald-50 text-emerald-700 border-emerald-200', dot: 'bg-emerald-500' },
  'Moderate Risk': { bg: 'bg-amber-50 text-amber-700 border-amber-200', dot: 'bg-amber-500' },
  'High Risk': { bg: 'bg-rose-50 text-rose-700 border-rose-200', dot: 'bg-rose-500' },

  // Project statuses
  'Active': { bg: 'bg-indigo-50 text-indigo-700 border-indigo-200', dot: 'bg-indigo-500' },
  'On Hold': { bg: 'bg-amber-50 text-amber-700 border-amber-200', dot: 'bg-amber-500' },
};

export default function StatusBadge({ status, size = 'sm', className = '' }) {
  const config = STATUS_CONFIGS[status] || {
    bg: 'bg-slate-100 text-slate-700 border-slate-200',
    dot: 'bg-slate-400'
  };

  const sizeClasses = size === 'xs'
    ? 'text-xs px-2 py-0.5'
    : size === 'md'
    ? 'text-sm px-3 py-1 font-medium'
    : 'text-xs px-2.5 py-1 font-medium';

  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border ${config.bg} ${sizeClasses} ${className}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${config.dot}`} />
      <span>{status}</span>
    </span>
  );
}

