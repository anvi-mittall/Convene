import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

export function Pagination({ page, totalPages, onPageChange, className = '' }) {
  if (totalPages <= 1) return null;

  return (
    <div className={`flex items-center justify-center gap-3 mt-8 ${className}`}>
      <button
        onClick={() => onPageChange(page - 1)}
        disabled={page <= 1}
        className="btn-secondary min-h-[38px] px-3 py-1 font-mono text-xs uppercase"
      >
        <ChevronLeft className="w-4 h-4 mr-1" />
        <span>PREV</span>
      </button>

      <span className="font-mono text-xs uppercase tracking-wider text-[#2B2340] px-3 font-semibold">
        PAGE <span className="font-bold underline">{page}</span> OF <span className="font-bold">{totalPages}</span>
      </span>

      <button
        onClick={() => onPageChange(page + 1)}
        disabled={page >= totalPages}
        className="btn-secondary min-h-[38px] px-3 py-1 font-mono text-xs uppercase"
      >
        <span>NEXT</span>
        <ChevronRight className="w-4 h-4 ml-1" />
      </button>
    </div>
  );
}
