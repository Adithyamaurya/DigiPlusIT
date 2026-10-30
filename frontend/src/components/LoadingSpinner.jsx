import React from 'react';
import { Loader2 } from 'lucide-react';

export default function LoadingSpinner({ message = 'Loading...', size = 'md' }) {
  const sizeMap = {
    sm: 'w-4 h-4',
    md: 'w-7 h-7',
    lg: 'w-10 h-10',
  };

  return (
    <div className="flex flex-col items-center justify-center py-12 gap-3 text-slate-500">
      <Loader2 className={`${sizeMap[size]} animate-spin text-indigo-600`} />
      {message && <p className="text-sm font-medium">{message}</p>}
    </div>
  );
}

