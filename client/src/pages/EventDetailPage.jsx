import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, useLocation, Link } from 'react-router-dom';
import { fetchEventById } from '../api/events.js';
import { registerForEvent, cancelRegistration } from '../api/registrations.js';
import { useAuth } from '../context/AuthContext.jsx';
import { StatusBadge } from '../components/StatusBadge.jsx';
import { Spinner } from '../components/Spinner.jsx';
import { ConfirmModal } from '../components/ConfirmModal.jsx';
import toast from 'react-hot-toast';
import { ArrowLeft, ExternalLink, Star } from 'lucide-react';

export function EventDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();

  const [event, setEvent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [registering, setRegistering] = useState(false);
  const [cancelModalOpen, setCancelModalOpen] = useState(false);
  const [cancelling, setCancelling] = useState(false);

  const loadEvent = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetchEventById(id);
      if (res.success && res.data) {
        setEvent(res.data);
      }
    } catch (err) {
      toast.error(err.response?.data?.error?.message || 'Failed to load event details');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    loadEvent();
  }, [loadEvent]);

  const handleRegister = async () => {
    if (!user) {
      navigate('/login', { state: { from: location } });
      return;
    }

    setRegistering(true);
    try {
      const res = await registerForEvent(id);
      if (res.success) {
        toast.success(
          res.data.status === 'confirmed'
            ? 'Registration confirmed!'
            : 'Added to waitlist. We will notify you if a seat opens!'
        );
        loadEvent();
      }
    } catch (err) {
      toast.error(err.response?.data?.error?.message || 'Failed to register');
    } finally {
      setRegistering(false);
    }
  };

  const handleCancelRegistration = async () => {
    setCancelling(true);
    try {
      const res = await cancelRegistration(id);
      if (res.success) {
        toast.success('Registration cancelled');
        setCancelModalOpen(false);
        loadEvent();
      }
    } catch (err) {
      toast.error(err.response?.data?.error?.message || 'Failed to cancel registration');
    } finally {
      setCancelling(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-[50vh] flex flex-col items-center justify-center p-12">
        <Spinner size="lg" className="mb-4" />
        <p className="font-mono text-xs uppercase tracking-widest font-semibold text-[#2B2340]">
          Loading workshop details...
        </p>
      </div>
    );
  }

  if (!event) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-16 text-center">
        <div className="bg-white border-2 border-[#2B2340] shadow-[5px_5px_0px_#2B2340] p-8">
          <h2 className="text-3xl font-black text-[#2B2340]">Event not found</h2>
          <p className="mt-3 text-sm text-[#2B2340]/80 font-mono">
            This session may have ended or been unlisted.
          </p>
          <Link
            to="/"
            className="mt-6 btn-secondary font-mono text-xs uppercase"
          >
            ← Back to Explore Events
          </Link>
        </div>
      </div>
    );
  }

  const backendBase = import.meta.env.VITE_API_URL?.replace(/\/api$/, '') || 'http://localhost:5000';
  const posterSrc = event.posterUrl ? `${backendBase}${event.posterUrl}` : null;
  const isOwner = user && event.createdBy?._id === user._id;
  const myReg = event.myRegistration;
  const isStarted = new Date(event.startTime) <= new Date();

  // Date parsing
  const startDate = event.startTime ? new Date(event.startTime) : new Date();
  const endDate = event.endTime ? new Date(event.endTime) : new Date();
  const dayName = startDate.toLocaleDateString('en-US', { weekday: 'short' }).toUpperCase();
  const dayNum = String(startDate.getDate()).padStart(2, '0');
  const monthName = startDate.toLocaleDateString('en-US', { month: 'short' }).toUpperCase();
  const startTimeStr = startDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const endTimeStr = endDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  // Seat calculations
  const capacity = Number(event.capacity) || 1;
  const seatsLeft = Number(event.seatsLeft) ?? capacity;
  const takenSeats = Math.max(0, capacity - seatsLeft);
  const fillPercent = Math.min(100, Math.max(0, Math.round((takenSeats / capacity) * 100)));

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-10">
      {/* Return link */}
      <Link
        to="/"
        className="inline-flex items-center gap-2 font-mono text-xs uppercase tracking-wider font-bold text-[#2B2340] hover:underline decoration-2 underline-offset-4 mb-6 group"
      >
        <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
        <span>BACK TO EVENTS</span>
      </Link>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Main Content (Left Col: ~7-8 cols) */}
        <div className="lg:col-span-7 xl:col-span-8 space-y-8">
          {/* Poster Block */}
          <div className="bg-white border-2 border-[#2B2340] shadow-[5px_5px_0px_#2B2340] overflow-hidden relative">
            {posterSrc ? (
              <div className="h-64 sm:h-80 w-full overflow-hidden border-b-2 border-[#2B2340]">
                <img src={posterSrc} alt={event.title} className="w-full h-full object-cover" />
              </div>
            ) : (
              <div className="h-64 sm:h-72 w-full bg-[#FFD6A5] relative overflow-hidden border-b-2 border-[#2B2340] p-6 flex flex-col justify-between">
                {/* Decorative abstract circle per design */}
                <div className="absolute -top-10 -right-10 w-44 h-44 rounded-full bg-[#B8E0D2] border-2 border-[#2B2340] pointer-events-none" />
                <div className="absolute -bottom-12 right-20 w-32 h-32 bg-[#FFB3C7] border-2 border-[#2B2340] pointer-events-none" />

                <div className="relative z-10 flex gap-2">
                  <span className="badge badge-white">
                    {event.category || 'WORKSHOP'}
                  </span>
                  <span className="badge badge-pink">
                    {event.mode || 'OFFLINE'}
                  </span>
                </div>

                <div className="relative z-10">
                  <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black text-[#2B2340] leading-tight">
                    {event.title}
                  </h1>
                </div>
              </div>
            )}

            {/* If there was a custom poster uploaded, show title & badges below it */}
            {posterSrc && (
              <div className="p-6">
                <div className="flex gap-2 mb-3">
                  <span className="badge badge-white">
                    {event.category || 'WORKSHOP'}
                  </span>
                  <span className="badge badge-pink">
                    {event.mode || 'OFFLINE'}
                  </span>
                </div>
                <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black text-[#2B2340] leading-tight">
                  {event.title}
                </h1>
              </div>
            )}
          </div>

          {/* About this session */}
          <div className="bg-white border-2 border-[#2B2340] shadow-[5px_5px_0px_#2B2340] p-6 sm:p-8">
            <h2 className="text-2xl font-black text-[#2B2340] tracking-tight mb-4">
              About this session
            </h2>
            <div className="text-base text-[#2B2340]/90 whitespace-pre-line leading-relaxed font-sans">
              {event.description ||
                '[Event description goes here: what will be covered, who it is for, and what to bring.]'}
            </div>

            {event.avgRating > 0 && (
              <div className="mt-6 pt-4 border-t-2 border-[#2B2340]/20 flex items-center gap-2 font-mono text-xs font-bold text-[#2B2340]">
                <Star className="w-4 h-4 fill-[#2B2340]" />
                <span>RATING: {event.avgRating} / 5 ({event.ratingCount} reviews)</span>
              </div>
            )}
          </div>

          {/* SPEAKER Box */}
          <div className="bg-white border-2 border-[#2B2340] shadow-[5px_5px_0px_#2B2340] p-6 sm:p-8">
            <div className="flex items-start gap-5">
              {/* Circle Avatar (circles allowed for avatars per prompt spec) */}
              <div className="w-16 h-16 rounded-full bg-[#FFD6A5] border-2 border-[#2B2340] flex items-center justify-center font-black text-2xl text-[#2B2340] flex-shrink-0 shadow-[2px_2px_0px_#2B2340]">
                {event.speakerName?.charAt(0) || 'S'}
              </div>
              <div className="flex-1">
                <span className="font-mono text-xs uppercase tracking-widest font-bold text-[#2B2340]/70 block mb-1">
                  SPEAKER
                </span>
                <h3 className="font-extrabold text-2xl text-[#2B2340] leading-tight">
                  {event.speakerName}
                </h3>
                <p className="mt-2 text-sm text-[#2B2340]/80 leading-relaxed">
                  {event.speakerBio || '[Speaker bio]'}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Right Sticky Ticket Card (Right Col: ~4-5 cols) */}
        <div className="lg:col-span-5 xl:col-span-4">
          <div className="bg-white border-2 border-[#2B2340] shadow-[5px_5px_0px_#2B2340] sticky top-24">
            {/* Header Date Info */}
            <div className="p-6 sm:p-7">
              <div className="font-mono text-xs uppercase tracking-wider font-bold text-[#2B2340]/80">
                {dayName} · {startTimeStr} – {endTimeStr}
              </div>

              <div className="text-4xl sm:text-5xl font-black text-[#2B2340] tracking-tight my-2">
                {dayNum} {monthName}
              </div>

              <div className="font-mono text-xs uppercase tracking-wider font-bold text-[#2B2340]">
                {event.mode === 'online' ? (
                  <span>ONLINE WEBINAR</span>
                ) : (
                  <span>{event.venue || '[Venue]'} · {event.mode.toUpperCase()}</span>
                )}
              </div>

              {event.mode !== 'offline' && myReg?.status === 'confirmed' && event.meetingLink && (
                <a
                  href={event.meetingLink}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-2 inline-flex items-center gap-1.5 font-mono text-xs font-bold text-[#2B2340] underline decoration-2 underline-offset-4"
                >
                  <span>JOIN MEETING LINK</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              )}

              {/* Seat Meter */}
              <div className="mt-6">
                <div className="seat-meter-container">
                  <div
                    className="seat-meter-bar"
                    style={{ width: `${fillPercent}%` }}
                  />
                </div>
                <div className="mt-2 font-mono text-xs uppercase tracking-wider font-bold text-[#2B2340]">
                  {seatsLeft} OF {capacity} SEATS LEFT
                </div>
              </div>

              {/* Reserve / Status Button */}
              <div className="mt-6">
                {event.status === 'cancelled' ? (
                  <div className="p-3 bg-[#FFB3C7] border-2 border-[#2B2340] font-mono text-xs uppercase font-bold text-[#2B2340] text-center">
                    THIS EVENT HAS BEEN CANCELLED
                  </div>
                ) : event.phase === 'completed' ? (
                  <div className="p-3 bg-[#FFF4EC] border-2 border-[#2B2340] font-mono text-xs uppercase font-bold text-[#2B2340] text-center">
                    THIS SESSION IS COMPLETED
                  </div>
                ) : isOwner ? (
                  <div className="space-y-3">
                    <div className="p-2.5 bg-[#B8E0D2] border-2 border-[#2B2340] font-mono text-xs uppercase font-bold text-[#2B2340] text-center">
                      YOU ORGANIZED THIS EVENT
                    </div>
                    <Link
                      to={`/organizer/events/${event._id}/manage`}
                      className="btn-primary w-full text-center uppercase font-mono tracking-wider"
                    >
                      Open Management Studio
                    </Link>
                  </div>
                ) : myReg?.status === 'confirmed' ? (
                  <div className="space-y-3">
                    <div className="p-3 bg-[#B8E0D2] border-2 border-[#2B2340] font-mono text-xs uppercase font-bold text-[#2B2340] text-center">
                      ✓ SEAT RESERVED & CONFIRMED
                    </div>
                    <Link
                      to="/dashboard"
                      className="btn-primary w-full text-center uppercase font-mono tracking-wider"
                    >
                      View Ticket & QR Pass
                    </Link>
                    {!isStarted && !myReg.attended && (
                      <button
                        onClick={() => setCancelModalOpen(true)}
                        className="btn-secondary w-full text-center font-mono text-xs uppercase"
                      >
                        Cancel Reservation
                      </button>
                    )}
                  </div>
                ) : myReg?.status === 'waitlisted' ? (
                  <div className="space-y-3">
                    <div className="p-3 bg-[#FFB3C7] border-2 border-[#2B2340] font-mono text-xs uppercase font-bold text-[#2B2340] text-center">
                      WAITLISTED · POSITION #{myReg.waitlistPosition || '1'}
                    </div>
                    <Link
                      to="/dashboard"
                      className="btn-secondary w-full text-center uppercase font-mono tracking-wider"
                    >
                      View Waitlist Status
                    </Link>
                    {!isStarted && (
                      <button
                        onClick={() => setCancelModalOpen(true)}
                        className="btn-secondary w-full text-center font-mono text-xs uppercase"
                      >
                        Leave Waitlist
                      </button>
                    )}
                  </div>
                ) : isStarted ? (
                  <div className="p-3 bg-[#FFF4EC] border-2 border-[#2B2340] font-mono text-xs uppercase font-bold text-[#2B2340] text-center">
                    REGISTRATION CLOSED (SESSION STARTED)
                  </div>
                ) : seatsLeft > 0 ? (
                  <button
                    onClick={handleRegister}
                    disabled={registering}
                    className="btn-primary w-full text-base font-extrabold tracking-wide"
                  >
                    {registering ? 'Reserving...' : 'Reserve my seat'}
                  </button>
                ) : (
                  <button
                    onClick={handleRegister}
                    disabled={registering}
                    className="btn-primary w-full text-base font-extrabold tracking-wide bg-[#FFB3C7]"
                  >
                    {registering ? 'Joining Waitlist...' : 'Join waitlist'}
                  </button>
                )}
              </div>

              {/* Helper text under button */}
              <p className="mt-4 text-xs text-[#2B2340]/80 leading-relaxed font-sans">
                Seats full? You join the waitlist and get promoted automatically.
              </p>
            </div>

            {/* Bottom Stub Banner */}
            <div className="p-4 bg-[#B8E0D2] border-t-2 border-dashed border-[#2B2340] font-mono text-[11px] font-bold uppercase tracking-wider text-[#2B2340] text-center">
              {myReg?.status === 'confirmed'
                ? `YOUR TICKET ID: #${myReg._id}`
                : 'YOUR TICKET NUMBER APPEARS HERE AFTER YOU REGISTER'}
            </div>
          </div>
        </div>
      </div>

      <ConfirmModal
        isOpen={cancelModalOpen}
        title="Cancel Registration"
        message="Are you sure you want to cancel your seat? If you cancel, your seat will be automatically given to the next person on the waitlist."
        confirmText="Yes, Cancel Seat"
        loading={cancelling}
        onConfirm={handleCancelRegistration}
        onCancel={() => setCancelModalOpen(false)}
      />
    </div>
  );
}
