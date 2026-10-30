import React, { useEffect, useRef } from 'react';
import { X } from 'lucide-react';

export default function Modal({
  isOpen,
  onClose,
  title,
  subtitle,
  children,
  footer,
  maxWidth = 'max-w-2xl',
  className = ''
}) {
  const modalRef = useRef(null);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isOpen) onClose();
    };

    if (isOpen) {
      // Prevent background shift when scrollbar hides
      const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;
      document.body.style.overflow = 'hidden';
      if (scrollbarWidth > 0) {
        document.body.style.paddingRight = `${scrollbarWidth}px`;
      }
      window.addEventListener('keydown', handleKeyDown);
    }

    return () => {
      document.body.style.overflow = '';
      document.body.style.paddingRight = '';
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 md:p-6 overflow-hidden">
      {/* Minimalist luminous backdrop */}
      <div
        className="fixed inset-0 bg-slate-900/25 backdrop-blur-[2px] transition-opacity duration-150 ease-out"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Modal Surface */}
      <div
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        className={`relative w-full ${maxWidth} max-h-[88vh] flex flex-col bg-white rounded-xl shadow-[0_20px_50px_-12px_rgba(0,0,0,0.12),0_0_1px_1px_rgba(0,0,0,0.04)] border border-slate-200/80 overflow-hidden z-10 transition-all transform animate-fadeIn ${className}`}
      >
        {/* Pinned Minimalist Header */}
        <div className="flex items-start justify-between px-6 py-4 border-b border-slate-100 bg-white shrink-0">
          <div className="pr-4">
            <h3 className="text-base font-semibold text-slate-900 tracking-tight">{title}</h3>
            {subtitle && <p className="mt-0.5 text-xs text-slate-500 leading-normal">{subtitle}</p>}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors shrink-0"
            aria-label="Close dialog"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Scrollable Body: Always smoothly scrolable */}
        <div className="px-6 py-5 overflow-y-auto overscroll-contain flex-1 text-slate-800 text-xs">
          {children}
        </div>

        {/* Optional Pinned Footer */}
        {footer && (
          <div className="px-6 py-3.5 border-t border-slate-100 bg-slate-50/60 shrink-0 flex items-center justify-end gap-2">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
