import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { fetchMyEvents, cancelEvent } from '../api/events.js';
import { StatusBadge } from '../components/StatusBadge.jsx';
import { formatDate } from '../components/EventCard.jsx';
import { Spinner } from '../components/Spinner.jsx';
import { Pagination } from '../components/Pagination.jsx';
import { ConfirmModal } from '../components/ConfirmModal.jsx';
import toast from 'react-hot-toast';
import { Plus, Sliders, Edit, XCircle } from 'lucide-react';

export function OrganizerEventsPage() {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  // Modal state
  const [cancelTargetId, setCancelTargetId] = useState(null);
  const [cancelling, setCancelling] = useState(false);

  const loadEvents = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetchMyEvents({ page, limit: 10 });
      if (res.success && res.data) {
        setEvents(res.data.items || []);
        setTotalPages(res.data.totalPages || 1);
      }
    } catch (err) {
      toast.error(err.response?.data?.error?.message || 'Failed to load organizer events');
    } finally {
      setLoading(false);
    }
  }, [page]);

  useEffect(() => {
    loadEvents();
  }, [loadEvents]);

  const handleConfirmCancel = async () => {
    if (!cancelTargetId) return;
    setCancelling(true);
    try {
      const res = await cancelEvent(cancelTargetId);
      if (res.success) {
        toast.success('Event cancelled successfully');
        setCancelTargetId(null);
        loadEvents();
      }
    } catch (err) {
      toast.error(err.response?.data?.error?.message || 'Failed to cancel event');
    } finally {
      setCancelling(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-10">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
        <div>
          <h1 className="text-4xl sm:text-5xl font-black text-[#2B2340] tracking-tight">
            Organizer Studio
          </h1>
          <p className="mt-1 font-mono text-xs uppercase tracking-wider text-[#2B2340]/70 font-bold">
            CREATE, MANAGE, AND MONITOR YOUR WORKSHOPS
          </p>
        </div>

        <Link
          to="/organizer/events/new"
          className="btn-primary font-mono text-xs uppercase"
        >
          <Plus className="w-4 h-4 mr-1" />
          <span>Create New Event</span>
        </Link>
      </div>

      {/* Table Container */}
      {loading ? (
        <div className="min-h-[40vh] flex flex-col items-center justify-center p-12">
          <Spinner size="lg" className="mb-4" />
          <p className="font-mono text-xs uppercase tracking-widest font-semibold text-[#2B2340]">
            Loading your workshops...
          </p>
        </div>
      ) : events.length === 0 ? (
        <div className="bg-white border-2 border-[#2B2340] shadow-[5px_5px_0px_#2B2340] p-12 text-center max-w-lg mx-auto">
          <div className="font-mono text-xs uppercase tracking-widest font-bold text-[#2B2340]/60 mb-2">
            STUDIO EMPTY
          </div>
          <h3 className="text-2xl font-black text-[#2B2340]">No events published yet</h3>
          <p className="mt-2 text-sm text-[#2B2340]/80">
            You haven't created any workshops or seminars yet. Launch your first event to get started.
          </p>
          <Link
            to="/organizer/events/new"
            className="mt-6 btn-primary font-mono text-xs uppercase"
          >
            Create first event
          </Link>
        </div>
      ) : (
        <div className="bg-white border-2 border-[#2B2340] shadow-[5px_5px_0px_#2B2340] overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-[#2B2340]">
              <thead className="bg-[#FFF4EC] font-mono text-xs font-bold uppercase tracking-wider border-b-2 border-[#2B2340]">
                <tr>
                  <th scope="col" className="px-6 py-4">EVENT</th>
                  <th scope="col" className="px-6 py-4">PHASE</th>
                  <th scope="col" className="px-6 py-4">CONFIRMED / CAPACITY</th>
                  <th scope="col" className="px-6 py-4">SCHEDULE</th>
                  <th scope="col" className="px-6 py-4 text-right">ACTIONS</th>
                </tr>
              </thead>
              <tbody className="divide-y-2 divide-[#2B2340]/10">
                {events.map((event) => {
                  const isLocked = event.phase === 'completed' || event.phase === 'cancelled';
                  return (
                    <tr key={event._id} className="hover:bg-[#FFF4EC]/50 transition-colors">
                      <td className="px-6 py-4 font-bold max-w-xs">
                        <Link
                          to={`/events/${event._id}`}
                          className="hover:underline decoration-2 underline-offset-2 line-clamp-1 text-[#2B2340]"
                        >
                          {event.title}
                        </Link>
                        <div className="font-mono text-xs text-[#2B2340]/70 font-normal mt-0.5">
                          Speaker: {event.speakerName} • {event.mode.toUpperCase()}
                        </div>
                      </td>

                      <td className="px-6 py-4">
                        <StatusBadge status={event.phase} type="phase" />
                      </td>

                      <td className="px-6 py-4 font-mono text-xs">
                        <div className="flex items-center gap-1.5 font-bold">
                          <span>{event.confirmedCount}</span>
                          <span className="text-[#2B2340]/40">/</span>
                          <span>{event.capacity}</span>
                          <span className="ml-1 text-[11px] text-[#2B2340]/70">({event.seatsLeft} left)</span>
                        </div>
                      </td>

                      <td className="px-6 py-4 font-mono text-xs whitespace-nowrap">
                        {formatDate(event.startTime)}
                      </td>

                      <td className="px-6 py-4 text-right space-x-2 whitespace-nowrap">
                        <Link
                          to={`/organizer/events/${event._id}/manage`}
                          className="btn-primary min-h-[36px] px-3 py-1 font-mono text-xs uppercase"
                        >
                          <Sliders className="w-3.5 h-3.5 mr-1" />
                          <span>Manage</span>
                        </Link>

                        {!isLocked && (
                          <Link
                            to={`/organizer/events/${event._id}/edit`}
                            className="btn-secondary min-h-[36px] px-3 py-1 font-mono text-xs uppercase"
                          >
                            <Edit className="w-3.5 h-3.5 mr-1" />
                            <span>Edit</span>
                          </Link>
                        )}

                        {!isLocked && (
                          <button
                            onClick={() => setCancelTargetId(event._id)}
                            className="btn-secondary min-h-[36px] px-3 py-1 font-mono text-xs uppercase bg-white hover:bg-[#FFB3C7]"
                          >
                            <XCircle className="w-3.5 h-3.5 mr-1" />
                            <span>Cancel</span>
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="p-4 border-t-2 border-[#2B2340]">
            <Pagination page={page} totalPages={totalPages} onPageChange={(p) => setPage(p)} />
          </div>
        </div>
      )}

      <ConfirmModal
        isOpen={Boolean(cancelTargetId)}
        title="Cancel Event"
        message="Are you sure you want to cancel this event? This action is irreversible. All confirmed and waitlisted attendees will be notified."
        confirmText="Cancel Event"
        isDanger={true}
        loading={cancelling}
        onConfirm={handleConfirmCancel}
        onCancel={() => setCancelTargetId(null)}
      />
    </div>
  );
}
