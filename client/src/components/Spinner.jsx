import React from 'react';

export function Spinner({ size = 'md', className = '' }) {
  const sizeClasses = {
    sm: 'w-4 h-4 border-2',
    md: 'w-8 h-8 border-3',
    lg: 'w-12 h-12 border-4'
  };

  return (
    <div
      className={`inline-block animate-spin rounded-full border-solid border-[#2B2340] border-r-transparent ${sizeClasses[size] || sizeClasses.md} ${className}`}
      role="status"
    >
      <span className="sr-only">Loading...</span>
    </div>
  );
}

export function LoadingScreen({ message = 'Loading Convene...' }) {
  return (
    <div className="min-h-[50vh] flex flex-col items-center justify-center p-8 text-center">
      <Spinner size="lg" className="mb-4" />
      <p className="font-mono text-xs uppercase tracking-wider text-[#2B2340] font-semibold">{message}</p>
    </div>
  );
}
