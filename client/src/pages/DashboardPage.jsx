import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { fetchMyRegistrations, cancelRegistration, fetchRegistrationQr, fetchCertificate } from '../api/registrations.js';
import { submitFeedback } from '../api/feedback.js';
import { fetchEventResources, downloadResource } from '../api/resources.js';
import { Spinner } from '../components/Spinner.jsx';
import { Pagination } from '../components/Pagination.jsx';
import { ConfirmModal } from '../components/ConfirmModal.jsx';
import { QrModal } from '../components/QrModal.jsx';
import toast from 'react-hot-toast';
import { FileText, Download, QrCode } from 'lucide-react';

export function DashboardPage() {
  const [activeTab, setActiveTab] = useState('confirmed');
  const [registrations, setRegistrations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  // Cancellation state
  const [cancelTargetId, setCancelTargetId] = useState(null);
  const [cancelling, setCancelling] = useState(false);

  // QR Modal state
  const [qrModalOpen, setQrModalOpen] = useState(false);
  const [selectedReg, setSelectedReg] = useState(null);
  const [qrDataUrl, setQrDataUrl] = useState(null);

  // Feedback Modal state
  const [feedbackModalOpen, setFeedbackModalOpen] = useState(false);
  const [feedbackEventId, setFeedbackEventId] = useState(null);
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');
  const [submittingFeedback, setSubmittingFeedback] = useState(false);

  // Resources state
  const [resourcesModalOpen, setResourcesModalOpen] = useState(false);
  const [currentEventResources, setCurrentEventResources] = useState([]);
  const [loadingResources, setLoadingResources] = useState(false);

  const loadRegistrations = useCallback(async () => {
    setLoading(true);
    try {
      // Backend status query: 'past' maps to querying all or confirmed and filtering client-side
      const queryStatus = activeTab === 'past' ? undefined : activeTab;
      const res = await fetchMyRegistrations({
        status: queryStatus,
        page,
        limit: 12
      });

      if (res.success && res.data) {
        let items = res.data.items || [];
        if (activeTab === 'past') {
          // Attended or completed
          items = items.filter(
            (r) => r.attended || r.event?.phase === 'completed' || r.status === 'attended'
          );
        }
        setRegistrations(items);
        setTotalPages(res.data.totalPages || 1);
      }
    } catch (err) {
      toast.error(err.response?.data?.error?.message || 'Failed to load registrations');
    } finally {
      setLoading(false);
    }
  }, [activeTab, page]);

  useEffect(() => {
    loadRegistrations();
  }, [loadRegistrations]);

  const handleTabChange = (tab) => {
    setActiveTab(tab);
    setPage(1);
  };

  const handleOpenQr = async (reg) => {
    setSelectedReg(reg);
    setQrDataUrl(null);
    setQrModalOpen(true);
    try {
      const res = await fetchRegistrationQr(reg._id);
      if (res.success && res.data?.qrDataUrl) {
        setQrDataUrl(res.data.qrDataUrl);
      }
    } catch (err) {
      toast.error(err.response?.data?.error?.message || 'Failed to generate QR code');
    }
  };

  const handleDownloadCertificate = async (reg) => {
    const toastId = toast.loading('Generating your certificate...');
    try {
      const response = await fetchCertificate(reg._id);
      const blob = new Blob([response.data], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `certificate-${reg._id}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      a.remove();
      toast.success('Certificate downloaded!', { id: toastId });
    } catch (err) {
      toast.error(err.response?.data?.error?.message || 'Certificate not yet eligible or available', {
        id: toastId
      });
    }
  };

  const handleOpenFeedback = (reg) => {
    setFeedbackEventId(reg.event?._id || reg.event);
    setRating(5);
    setComment('');
    setFeedbackModalOpen(true);
  };

  const handleSubmitFeedback = async (e) => {
    e.preventDefault();
    if (!feedbackEventId) return;

    setSubmittingFeedback(true);
    try {
      const res = await submitFeedback(feedbackEventId, { rating, comment });
      if (res.success) {
        toast.success('Thank you for your feedback!');
        setFeedbackModalOpen(false);
        loadRegistrations();
      }
    } catch (err) {
      toast.error(err.response?.data?.error?.message || 'Failed to submit feedback');
    } finally {
      setSubmittingFeedback(false);
    }
  };

  const handleOpenResources = async (reg) => {
    setResourcesModalOpen(true);
    setLoadingResources(true);
    setCurrentEventResources([]);
    try {
      const res = await fetchEventResources(reg.event._id);
      if (res.success) {
        setCurrentEventResources(res.data || []);
      }
    } catch (err) {
      toast.error(err.response?.data?.error?.message || 'Failed to load event resources');
    } finally {
      setLoadingResources(false);
    }
  };

  const handleDownloadResource = async (resourceId, originalName) => {
    try {
      const res = await downloadResource(resourceId);
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', originalName);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (err) {
      toast.error('Download failed');
    }
  };

  const handleCancelRegistration = async () => {
    if (!cancelTargetId) return;
    setCancelling(true);
    try {
      const res = await cancelRegistration(cancelTargetId);
      if (res.success) {
        toast.success('Registration cancelled');
        setCancelTargetId(null);
        loadRegistrations();
      }
    } catch (err) {
      toast.error(err.response?.data?.error?.message || 'Failed to cancel registration');
    } finally {
      setCancelling(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-4xl sm:text-5xl font-black text-[#2B2340] tracking-tight">
          My tickets
        </h1>
      </div>

      {/* Tabs */}
      <div className="flex gap-2.5 mb-8">
        {[
          { key: 'confirmed', label: 'CONFIRMED' },
          { key: 'waitlisted', label: 'WAITLISTED' },
          { key: 'past', label: 'PAST' }
        ].map((tab) => {
          const isActive = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => handleTabChange(tab.key)}
              className={`font-mono uppercase text-xs tracking-wider font-bold border-2 border-[#2B2340] px-5 py-2 transition-all ${
                isActive
                  ? 'bg-[#2B2340] text-white shadow-[2px_2px_0px_#2B2340]'
                  : 'bg-white text-[#2B2340] hover:bg-[#FFF4EC] shadow-[3px_3px_0px_#2B2340] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none'
              }`}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Registrations Grid */}
      {loading ? (
        <div className="min-h-[300px] flex flex-col items-center justify-center p-12">
          <Spinner size="lg" className="mb-4" />
          <p className="font-mono text-xs uppercase tracking-widest font-semibold text-[#2B2340]">
            Loading passes...
          </p>
        </div>
      ) : registrations.length === 0 ? (
        <div className="bg-white border-2 border-[#2B2340] shadow-[5px_5px_0px_#2B2340] p-10 text-center max-w-md mx-auto">
          <div className="font-mono text-xs uppercase tracking-widest font-bold text-[#2B2340]/60 mb-2">
            NO PASSES
          </div>
          <h3 className="text-2xl font-black text-[#2B2340]">No {activeTab} tickets</h3>
          <p className="mt-2 text-sm text-[#2B2340]/80">
            {activeTab === 'confirmed'
              ? 'You do not have any confirmed tickets right now.'
              : `No registrations found under ${activeTab}.`}
          </p>
          {activeTab === 'confirmed' && (
            <Link
              to="/"
              className="mt-6 btn-primary font-mono text-xs uppercase"
            >
              Find a session
            </Link>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {registrations.map((reg) => {
            const event = reg.event;
            if (!event) return null;

            const isCompleted = event.phase === 'completed';
            const isStarted = new Date(event.startTime) <= new Date();
            const canGetCertificate = reg.attended && isCompleted;
            const canGiveFeedback = reg.attended && isCompleted;

            const dateObj = event.startTime ? new Date(event.startTime) : new Date();
            const dayNum = String(dateObj.getDate()).padStart(2, '0');
            const monthStr = dateObj.toLocaleDateString('en-US', { month: 'short' }).toUpperCase();

            // Block color: confirmed = mint, waitlisted = pink, attended/past = peach
            const blockColor =
              reg.status === 'waitlisted'
                ? 'bg-[#FFB3C7]'
                : reg.attended || activeTab === 'past'
                ? 'bg-[#FFD6A5]'
                : 'bg-[#B8E0D2]';

            const badgeConfig =
              reg.status === 'waitlisted'
                ? { label: 'WAITLISTED', color: 'badge-pink' }
                : reg.attended
                ? { label: 'ATTENDED', color: 'badge-peach' }
                : { label: 'CONFIRMED', color: 'badge' };

            return (
              <div
                key={reg._id}
                className="ticket-card flex flex-col sm:flex-row overflow-hidden"
              >
                {/* Left Date Block */}
                <div
                  className={`w-full sm:w-24 flex-shrink-0 ${blockColor} border-b-2 sm:border-b-0 sm:border-r-2 border-dashed border-[#2B2340] flex flex-row sm:flex-col items-center justify-center py-4 px-3 gap-2 sm:gap-0`}
                >
                  <span className="font-extrabold text-3xl sm:text-4xl text-[#2B2340] tracking-tight leading-none">
                    {dayNum}
                  </span>
                  <span className="font-mono text-xs uppercase tracking-widest font-semibold text-[#2B2340]">
                    {monthStr}
                  </span>
                </div>

                {/* Right Ticket Body */}
                <div className="p-5 flex-1 flex flex-col justify-between min-w-0">
                  <div>
                    {/* Badge */}
                    <div className="mb-2">
                      <span className={`badge ${badgeConfig.color}`}>
                        {badgeConfig.label}
                      </span>
                    </div>

                    {/* Title */}
                    <Link
                      to={`/events/${event._id}`}
                      className="text-xl font-extrabold text-[#2B2340] leading-snug hover:underline decoration-2 underline-offset-2 block line-clamp-2"
                    >
                      {event.title}
                    </Link>
                  </div>

                  {/* Dynamic Action Area based on status */}
                  <div className="mt-4 pt-4 border-t-2 border-[#2B2340]/15 flex flex-wrap items-center gap-3">
                    {/* Confirmed State: Show QR + Materials */}
                    {reg.status === 'confirmed' && (
                      <div className="flex flex-wrap items-center gap-2 w-full">
                        <button
                          onClick={() => handleOpenQr(reg)}
                          className="btn-primary min-h-[40px] px-3.5 py-1.5 text-xs font-mono uppercase"
                        >
                          <QrCode className="w-4 h-4 mr-1.5" />
                          <span>Show QR</span>
                        </button>

                        <button
                          onClick={() => handleOpenResources(reg)}
                          className="btn-secondary min-h-[40px] px-3 py-1.5 text-xs font-mono uppercase"
                        >
                          <span>Materials</span>
                        </button>

                        {!isStarted && !reg.attended && (
                          <button
                            onClick={() => setCancelTargetId(event._id)}
                            className="font-mono text-xs font-semibold text-[#2B2340]/70 hover:text-[#2B2340] hover:underline ml-auto"
                          >
                            Cancel
                          </button>
                        )}
                      </div>
                    )}

                    {/* Waitlisted State: #3 IN LINE + Leave waitlist */}
                    {reg.status === 'waitlisted' && (
                      <div className="flex items-center justify-between w-full">
                        <div className="flex items-baseline gap-1.5">
                          <span className="text-2xl font-black text-[#2B2340]">
                            #{reg.waitlistPosition || '1'}
                          </span>
                          <span className="font-mono text-xs uppercase tracking-wider font-bold text-[#2B2340]/70">
                            IN LINE
                          </span>
                        </div>

                        {!isStarted && (
                          <button
                            onClick={() => setCancelTargetId(event._id)}
                            className="btn-secondary min-h-[40px] px-3.5 py-1.5 text-xs font-mono uppercase"
                          >
                            Leave waitlist
                          </button>
                        )}
                      </div>
                    )}

                    {/* Attended / Past State: Certificate (PDF) + Rate it */}
                    {(reg.attended || activeTab === 'past') && (
                      <div className="flex flex-wrap items-center gap-2 w-full">
                        <button
                          onClick={() => handleDownloadCertificate(reg)}
                          className="btn-primary min-h-[40px] px-3.5 py-1.5 text-xs font-mono uppercase"
                        >
                          Certificate (PDF)
                        </button>

                        <button
                          onClick={() => handleOpenFeedback(reg)}
                          className="btn-secondary min-h-[40px] px-3.5 py-1.5 text-xs font-mono uppercase"
                        >
                          Rate it
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Pagination page={page} totalPages={totalPages} onPageChange={(p) => setPage(p)} />

      {/* QR Code Modal */}
      <QrModal
        isOpen={qrModalOpen}
        onClose={() => setQrModalOpen(false)}
        qrDataUrl={qrDataUrl}
        registration={selectedReg}
      />

      {/* Confirm Cancellation Modal */}
      <ConfirmModal
        isOpen={Boolean(cancelTargetId)}
        title="Leave Waitlist / Cancel"
        message="Are you sure you want to release your reservation? This action cannot be undone."
        confirmText="Confirm"
        loading={cancelling}
        onConfirm={handleCancelRegistration}
        onCancel={() => setCancelTargetId(null)}
      />

      {/* Feedback Review Modal */}
      {feedbackModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#2B2340]/50">
          <div className="bg-white border-2 border-[#2B2340] shadow-[5px_5px_0px_#2B2340] w-full max-w-md p-6 relative">
            <h3 className="text-2xl font-black text-[#2B2340] tracking-tight mb-2">
              Rate session
            </h3>
            <p className="font-mono text-xs uppercase tracking-wider text-[#2B2340]/70 mb-5">
              Share your feedback for the workshop organizer
            </p>

            <form onSubmit={handleSubmitFeedback} className="space-y-4">
              <div>
                <label className="block font-mono text-xs uppercase tracking-wider font-bold text-[#2B2340] mb-2">
                  RATING
                </label>
                <div className="flex gap-2">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      type="button"
                      key={star}
                      onClick={() => setRating(star)}
                      className={`font-mono text-sm font-bold border-2 border-[#2B2340] px-3 py-1.5 transition-all ${
                        rating >= star
                          ? 'bg-[#FFD6A5] shadow-[2px_2px_0px_#2B2340]'
                          : 'bg-white hover:bg-[#FFF4EC]'
                      }`}
                    >
                      ★ {star}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block font-mono text-xs uppercase tracking-wider font-bold text-[#2B2340] mb-2">
                  FEEDBACK COMMENT (OPTIONAL)
                </label>
                <textarea
                  rows={4}
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  maxLength={1000}
                  placeholder="What did you learn? How was the pacing?"
                  className="input-base"
                />
              </div>

              <div className="pt-4 border-t-2 border-[#2B2340] flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setFeedbackModalOpen(false)}
                  className="btn-secondary font-mono text-xs uppercase"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingFeedback}
                  className="btn-primary font-mono text-xs uppercase"
                >
                  {submittingFeedback ? 'Submitting...' : 'Submit review'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Resources Modal */}
      {resourcesModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#2B2340]/50">
          <div className="bg-white border-2 border-[#2B2340] shadow-[5px_5px_0px_#2B2340] w-full max-w-lg p-6 relative">
            <h3 className="text-2xl font-black text-[#2B2340] tracking-tight mb-1">
              Workshop Materials
            </h3>
            <p className="font-mono text-xs uppercase tracking-wider text-[#2B2340]/70 mb-5">
              Download session slides and attachments
            </p>

            {loadingResources ? (
              <div className="py-8 flex justify-center">
                <Spinner size="md" />
              </div>
            ) : currentEventResources.length === 0 ? (
              <p className="font-mono text-xs text-[#2B2340]/80 text-center py-6">
                No materials have been uploaded by the organizer for this event yet.
              </p>
            ) : (
              <div className="space-y-3 max-h-60 overflow-y-auto pr-1">
                {currentEventResources.map((res) => (
                  <div
                    key={res._id}
                    className="p-3 bg-[#FFF4EC] border-2 border-[#2B2340] flex items-center justify-between"
                  >
                    <div className="flex items-center gap-3">
                      <FileText className="w-5 h-5 text-[#2B2340]" />
                      <div>
                        <div className="text-sm font-bold text-[#2B2340]">{res.title}</div>
                        <div className="font-mono text-[11px] text-[#2B2340]/70">
                          {res.originalName} • {(res.size / 1024 / 1024).toFixed(2)} MB
                        </div>
                      </div>
                    </div>
                    <button
                      onClick={() => handleDownloadResource(res._id, res.originalName)}
                      className="p-2 bg-white border-2 border-[#2B2340] hover:bg-[#FFB3C7] shadow-[2px_2px_0px_#2B2340] transition-colors"
                      title="Download"
                    >
                      <Download className="w-4 h-4 text-[#2B2340]" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            <div className="mt-6 pt-4 border-t-2 border-[#2B2340] flex justify-end">
              <button
                type="button"
                onClick={() => setResourcesModalOpen(false)}
                className="btn-secondary font-mono text-xs uppercase"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
