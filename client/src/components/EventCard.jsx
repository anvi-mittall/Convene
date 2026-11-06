import React from 'react';
import { Link } from 'react-router-dom';

export function formatDate(dateString) {
  if (!dateString) return '';
  const date = new Date(dateString);
  return new Intl.DateTimeFormat('en-IN', {
    dateStyle: 'medium',
    timeStyle: 'short'
  }).format(date);
}

export function EventCard({ event, index = 0 }) {
  const dateObj = event.startTime ? new Date(event.startTime) : new Date();
  const day = String(dateObj.getDate()).padStart(2, '0');
  const month = dateObj.toLocaleDateString('en-US', { month: 'short' }).toUpperCase();

  // Vary date block color between pink, mint, and peach
  const bgColors = ['bg-[#FFB3C7]', 'bg-[#B8E0D2]', 'bg-[#FFD6A5]'];
  const blockColor = bgColors[index % bgColors.length];

  // Calculate seat meter fill (percentage of taken seats)
  const capacity = Number(event.capacity) || 1;
  const seatsLeft = Number(event.seatsLeft) ?? capacity;
  const takenSeats = Math.max(0, capacity - seatsLeft);
  const fillPercent = Math.min(100, Math.max(0, Math.round((takenSeats / capacity) * 100)));

  return (
    <Link
      to={`/events/${event._id}`}
      className="group ticket-card flex flex-col sm:flex-row overflow-hidden block"
    >
      {/* Left Date Block: 96px wide with 2px dashed right border */}
      <div
        className={`w-full sm:w-24 flex-shrink-0 ${blockColor} border-b-2 sm:border-b-0 sm:border-r-2 border-dashed border-[#2B2340] flex flex-row sm:flex-col items-center justify-center py-4 px-3 gap-2 sm:gap-0`}
      >
        <span className="font-extrabold text-3xl sm:text-4xl text-[#2B2340] tracking-tight leading-none">
          {day}
        </span>
        <span className="font-mono text-xs uppercase tracking-widest font-semibold text-[#2B2340]">
          {month}
        </span>
      </div>

      {/* Right Content Block */}
      <div className="p-4 sm:p-5 flex-1 flex flex-col justify-between min-w-0">
        <div>
          {/* Badges */}
          <div className="flex flex-wrap gap-2 items-center">
            <span className="badge badge-white">
              {event.mode || 'OFFLINE'}
            </span>
            <span className="badge">
              {event.category || 'WORKSHOP'}
            </span>
          </div>

          {/* Title: 24px / 800 */}
          <h3 className="text-xl sm:text-[22px] font-extrabold text-[#2B2340] leading-tight mt-2.5 line-clamp-2 group-hover:underline decoration-2 underline-offset-2">
            {event.title}
          </h3>

          {/* Mono Meta Line */}
          <p className="mt-1 font-mono text-xs uppercase tracking-[0.06em] text-[#2B2340]/80 font-medium truncate">
            {event.speakerName || 'GUEST SPEAKER'}
          </p>

          {/* Seat Meter: 14px tall, 2px ink border, repeating stripes */}
          <div className="mt-3">
            <div className="seat-meter-container">
              <div
                className="seat-meter-bar"
                style={{ width: `${fillPercent}%` }}
              />
            </div>
          </div>
        </div>

        {/* Footer: Seats left and Details / Join waitlist */}
        <div className="mt-4 pt-3 border-t-2 border-[#2B2340]/20 flex items-center justify-between font-mono text-xs tracking-wider font-bold text-[#2B2340]">
          <span>
            {seatsLeft > 0 ? `${seatsLeft} SEATS LEFT` : 'FULL'}
          </span>
          <span className="underline decoration-2 underline-offset-4 flex items-center gap-1 group-hover:translate-x-1 transition-transform">
            {seatsLeft > 0 ? 'DETAILS →' : 'JOIN WAITLIST →'}
          </span>
        </div>
      </div>
    </Link>
  );
}
