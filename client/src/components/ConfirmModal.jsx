import React from 'react';
import { AlertTriangle, X } from 'lucide-react';

export function ConfirmModal({
  isOpen,
  title = 'Are you sure?',
  message = 'This action cannot be undone.',
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  isDanger = true,
  loading = false,
  onConfirm,
  onCancel
}) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#2B2340]/50 backdrop-blur-none">
      <div className="bg-white border-2 border-[#2B2340] shadow-[5px_5px_0px_#2B2340] w-full max-w-md p-6 relative text-[#2B2340]">
        <button
          onClick={onCancel}
          disabled={loading}
          className="absolute top-4 right-4 text-[#2B2340] hover:bg-[#FFB3C7] p-1 border-2 border-transparent hover:border-[#2B2340] transition-colors"
          aria-label="Close modal"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-start gap-4">
          <div
            className={`p-2.5 border-2 border-[#2B2340] flex-shrink-0 ${
              isDanger ? 'bg-[#FFB3C7]' : 'bg-[#FFD6A5]'
            }`}
          >
            <AlertTriangle className="w-6 h-6 text-[#2B2340]" />
          </div>

          <div>
            <h3 className="text-xl font-extrabold text-[#2B2340] tracking-tight">{title}</h3>
            <p className="mt-2 text-sm text-[#2B2340]/80 leading-relaxed">{message}</p>
          </div>
        </div>

        <div className="mt-6 flex items-center justify-end gap-3 pt-4 border-t-2 border-[#2B2340]">
          <button
            onClick={onCancel}
            disabled={loading}
            className="btn-secondary"
          >
            {cancelText}
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className={`btn-primary ${isDanger ? 'bg-[#FFB3C7]' : 'bg-[#B8E0D2]'}`}
          >
            {loading && <span className="w-4 h-4 border-2 border-[#2B2340] border-t-transparent rounded-full animate-spin"></span>}
            <span>{confirmText}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
