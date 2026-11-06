import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { fetchEvents } from '../api/events.js';
import { EventCard, formatDate } from '../components/EventCard.jsx';
import { Pagination } from '../components/Pagination.jsx';
import { Spinner } from '../components/Spinner.jsx';
import toast from 'react-hot-toast';

export function HomePage() {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);

  // Filters state
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const [mode, setMode] = useState('');
  const [phase, setPhase] = useState('');
  const [activeChip, setActiveChip] = useState('ALL');

  const loadEvents = useCallback(async () => {
    setLoading(true);
    try {
      const params = {
        page,
        limit: 9,
        ...(search.trim() && { q: search.trim() }),
        ...(category && { category }),
        ...(mode && { mode }),
        ...(phase && { phase })
      };

      const res = await fetchEvents(params);
      if (res.success && res.data) {
        setEvents(res.data.items || []);
        setTotal(res.data.total || 0);
        setTotalPages(res.data.totalPages || 1);
      }
    } catch (err) {
      toast.error(err.response?.data?.error?.message || 'Failed to load events');
    } finally {
      setLoading(false);
    }
  }, [page, search, category, mode, phase]);

  useEffect(() => {
    loadEvents();
  }, [loadEvents]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    setPage(1);
    loadEvents();
  };

  const handleChipClick = (chip) => {
    setActiveChip(chip);
    setPage(1);
    if (chip === 'ALL') {
      setCategory('');
      setMode('');
      setPhase('');
    } else if (chip === 'WORKSHOP') {
      setCategory('workshop');
      setMode('');
      setPhase('');
    } else if (chip === 'SEMINAR') {
      setCategory('seminar');
      setMode('');
      setPhase('');
    } else if (chip === 'WEBINAR') {
      setCategory('webinar');
      setMode('');
      setPhase('');
    } else if (chip === 'ONLINE') {
      setCategory('');
      setMode('online');
      setPhase('');
    } else if (chip === 'THIS WEEK') {
      setCategory('');
      setMode('');
      setPhase('upcoming');
    }
  };

  const handleResetFilters = () => {
    setSearch('');
    setCategory('');
    setMode('');
    setPhase('');
    setActiveChip('ALL');
    setPage(1);
  };

  // Find next upcoming event for hero ticket
  const nextUpEvent = events.length > 0 ? events[0] : null;
  const nextDate = nextUpEvent?.startTime ? new Date(nextUpEvent.startTime) : new Date();
  const nextDay = String(nextDate.getDate()).padStart(2, '0');
  const nextMonth = nextDate.toLocaleDateString('en-US', { month: 'short' }).toUpperCase();
  const nextTime = nextDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
      {/* Hero Section */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center mb-10 sm:mb-14">
        {/* Left Hero Text */}
        <div className="lg:col-span-7">
          <div className="font-mono uppercase text-xs tracking-widest font-semibold text-[#2B2340]/80 mb-3">
            WORKSHOPS · SEMINARS · WEBINARS
          </div>
          <h1 className="text-5xl sm:text-6xl lg:text-7xl font-extrabold text-[#2B2340] tracking-tight leading-[1.05]">
            Show up.<br />
            Learn live.
          </h1>
          <p className="mt-4 text-base sm:text-lg text-[#2B2340]/90 leading-relaxed max-w-xl font-medium">
            Find a session, grab a seat, scan in at the door.<br />
            Certificate in your inbox when you are done.
          </p>
        </div>

        {/* Right "NEXT UP" Ticket Stub */}
        <div className="lg:col-span-5 flex justify-start lg:justify-end">
          {nextUpEvent ? (
            <Link
              to={`/events/${nextUpEvent._id}`}
              className="w-full max-w-md bg-[#FFB3C7] border-2 border-[#2B2340] shadow-[5px_5px_0px_#2B2340] p-6 block transform hover:-translate-y-1 transition-transform"
            >
              <div className="font-mono text-xs uppercase tracking-widest font-bold text-[#2B2340]/80">
                NEXT UP
              </div>
              <div className="text-4xl sm:text-5xl font-black text-[#2B2340] tracking-tight my-2">
                {nextDay} {nextMonth}
              </div>
              <div className="text-xl sm:text-2xl font-extrabold text-[#2B2340] leading-snug line-clamp-2">
                {nextUpEvent.title}
              </div>
              <div className="mt-3 font-mono text-xs uppercase tracking-wider text-[#2B2340]/90 font-bold">
                {nextTime} · {nextUpEvent.mode === 'online' ? 'ONLINE' : nextUpEvent.venue || '[VENUE]'}
              </div>
            </Link>
          ) : (
            <div className="w-full max-w-md bg-[#FFB3C7] border-2 border-[#2B2340] shadow-[5px_5px_0px_#2B2340] p-6">
              <div className="font-mono text-xs uppercase tracking-widest font-bold text-[#2B2340]/80">
                NEXT UP
              </div>
              <div className="text-4xl sm:text-5xl font-black text-[#2B2340] tracking-tight my-2">
                14 NOV
              </div>
              <div className="text-xl sm:text-2xl font-extrabold text-[#2B2340] leading-snug">
                Python for Data Folks
              </div>
              <div className="mt-3 font-mono text-xs uppercase tracking-wider text-[#2B2340]/90 font-bold">
                10:00 AM · [VENUE]
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Search Bar */}
      <form onSubmit={handleSearchSubmit} className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="flex-1">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search events or speakers"
            className="input-base text-base placeholder-[#2B2340]/50"
          />
        </div>
        <button
          type="submit"
          className="btn-primary sm:w-auto w-full text-sm uppercase font-mono tracking-wider"
        >
          Search
        </button>
      </form>

      {/* Filter Chips */}
      <div className="flex flex-wrap gap-2.5 mb-8">
        {['ALL', 'WORKSHOP', 'SEMINAR', 'WEBINAR', 'ONLINE', 'THIS WEEK'].map((chip) => {
          const isActive = activeChip === chip;
          return (
            <button
              key={chip}
              type="button"
              onClick={() => handleChipClick(chip)}
              className={`font-mono uppercase text-xs tracking-wider font-bold border-2 border-[#2B2340] px-4 py-2 transition-all ${
                isActive
                  ? 'bg-[#2B2340] text-white shadow-[2px_2px_0px_#2B2340]'
                  : 'bg-white text-[#2B2340] hover:bg-[#FFF4EC] shadow-[3px_3px_0px_#2B2340] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none'
              }`}
            >
              {chip}
            </button>
          );
        })}
      </div>

      {/* Events Grid / Loading / Empty State */}
      {loading ? (
        <div className="min-h-[300px] flex flex-col items-center justify-center p-12">
          <Spinner size="lg" className="mb-4" />
          <p className="font-mono text-xs uppercase tracking-widest font-semibold text-[#2B2340]">
            Loading sessions...
          </p>
        </div>
      ) : events.length === 0 ? (
        <div className="min-h-[300px] flex flex-col items-center justify-center p-8 bg-white border-2 border-[#2B2340] shadow-[5px_5px_0px_#2B2340] text-center max-w-lg mx-auto">
          <div className="font-mono text-xs uppercase tracking-widest font-bold text-[#2B2340]/60 mb-2">
            NOTICEBOARD EMPTY
          </div>
          <h3 className="text-2xl font-black text-[#2B2340]">No events found</h3>
          <p className="mt-2 text-sm text-[#2B2340]/80 max-w-sm">
            {search || category || mode || phase
              ? "We couldn't find any events matching your search criteria. Try resetting filters."
              : 'There are no published events currently on the board. Check back soon!'}
          </p>
          {(search || category || mode || phase) && (
            <button
              onClick={handleResetFilters}
              className="mt-6 btn-primary font-mono text-xs uppercase"
            >
              Reset all filters
            </button>
          )}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {events.map((event, index) => (
              <EventCard key={event._id} event={event} index={index} />
            ))}
          </div>

          <Pagination page={page} totalPages={totalPages} onPageChange={(p) => setPage(p)} />
        </>
      )}
    </div>
  );
}
