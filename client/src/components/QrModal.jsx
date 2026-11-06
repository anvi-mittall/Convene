import React from 'react';
import { X, QrCode } from 'lucide-react';

export function QrModal({ isOpen, onClose, qrDataUrl, registration }) {
  if (!isOpen || !registration) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#2B2340]/50 backdrop-blur-none">
      <div className="bg-white border-2 border-[#2B2340] shadow-[5px_5px_0px_#2B2340] w-full max-w-sm p-6 relative text-center text-[#2B2340]">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-[#2B2340] hover:bg-[#FFB3C7] p-1 border-2 border-transparent hover:border-[#2B2340] transition-colors"
          aria-label="Close modal"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="w-12 h-12 mx-auto mb-3 bg-[#C9B6FF] border-2 border-[#2B2340] flex items-center justify-center">
          <QrCode className="w-6 h-6 text-[#2B2340]" />
        </div>

        <h3 className="text-2xl font-extrabold text-[#2B2340] tracking-tight">Check-in Pass</h3>
        <p className="mt-1 font-mono text-xs uppercase tracking-wider text-[#2B2340]/80 line-clamp-1">
          {registration.event?.title}
        </p>

        {/* QR Code Container */}
        <div className="my-5 p-4 bg-white border-2 border-[#2B2340] shadow-[4px_4px_0px_#2B2340] inline-block mx-auto">
          {qrDataUrl ? (
            <img src={qrDataUrl} alt="Check-in QR Code" className="w-52 h-52 object-contain mx-auto" />
          ) : (
            <div className="w-52 h-52 flex items-center justify-center font-mono text-xs text-[#2B2340]">
              GENERATING QR...
            </div>
          )}
        </div>

        <div className="font-mono text-xs text-[#2B2340] space-y-1">
          <div>
            HOLDER: <strong className="font-bold">{registration.user?.name || 'Attendee'}</strong>
          </div>
          <div className="text-[10px] text-[#2B2340]/70">
            TICKET ID: {registration._id}
          </div>
        </div>

        <div className="mt-4 p-2 bg-[#FFF4EC] border-2 border-[#2B2340] font-mono text-[11px] font-medium text-[#2B2340]">
          Show this QR code at the entrance for quick door scan.
        </div>
      </div>
    </div>
  );
}
