import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';

export function NotFoundPage() {
  return (
    <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center p-6 text-center">
      <div className="bg-white border-2 border-[#2B2340] shadow-[5px_5px_0px_#2B2340] p-8 sm:p-12 max-w-md w-full">
        <div className="font-mono text-xs uppercase tracking-widest font-bold text-[#2B2340]/60 mb-2">
          ERROR 404
        </div>
        <h1 className="text-5xl font-black text-[#2B2340] tracking-tight">
          Page not found
        </h1>
        <p className="mt-3 text-sm text-[#2B2340]/80">
          The workshop or page you are looking for does not exist or has been moved.
        </p>
        <div className="mt-8">
          <Link
            to="/"
            className="btn-primary font-mono text-xs uppercase"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            <span>Back to Explore Events</span>
          </Link>
        </div>
      </div>
    </div>
  );
}
