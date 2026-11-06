import React from 'react';

export function StatusBadge({ status, type = 'phase', className = '' }) {
  const normStatus = (status || '').toLowerCase();

  const configs = {
    // Event phase or status
    upcoming: {
      label: 'UPCOMING',
      bg: 'bg-[#B8E0D2]'
    },
    ongoing: {
      label: 'LIVE NOW',
      bg: 'bg-[#FFB3C7]'
    },
    completed: {
      label: 'COMPLETED',
      bg: 'bg-white'
    },
    published: {
      label: 'PUBLISHED',
      bg: 'bg-[#B8E0D2]'
    },
    // Registration statuses
    confirmed: {
      label: 'CONFIRMED',
      bg: 'bg-[#B8E0D2]'
    },
    waitlisted: {
      label: 'WAITLISTED',
      bg: 'bg-[#FFB3C7]'
    },
    cancelled: {
      label: 'CANCELLED',
      bg: 'bg-white'
    },
    attended: {
      label: 'ATTENDED',
      bg: 'bg-[#FFD6A5]'
    },
    // User Roles
    admin: {
      label: 'ADMIN',
      bg: 'bg-[#C9B6FF]'
    },
    organizer: {
      label: 'ORGANIZER',
      bg: 'bg-[#FFD6A5]'
    },
    attendee: {
      label: 'ATTENDEE',
      bg: 'bg-white'
    }
  };

  const config = configs[normStatus] || {
    label: (status || '').toUpperCase(),
    bg: 'bg-[#B8E0D2]'
  };

  return (
    <span
      className={`font-mono uppercase text-[12px] tracking-[0.06em] font-medium border-2 border-[#2B2340] px-2 py-0.5 text-[#2B2340] inline-flex items-center justify-center ${config.bg} ${className}`}
    >
      {config.label}
    </span>
  );
}
