import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Html5QrcodeScanner } from 'html5-qrcode';
import {
  fetchEventRegistrations,
  updateAttendance,
  scanQrAttendance
} from '../api/registrations.js';
import { fetchEventById, fetchEventStats } from '../api/events.js';
import { uploadResource, fetchEventResources, deleteResource } from '../api/resources.js';
import { fetchEventFeedback } from '../api/feedback.js';
import { StatusBadge } from '../components/StatusBadge.jsx';
import { Spinner } from '../components/Spinner.jsx';
import { Pagination } from '../components/Pagination.jsx';
import { ConfirmModal } from '../components/ConfirmModal.jsx';
import toast from 'react-hot-toast';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell
} from 'recharts';
import {
  ArrowLeft,
  FileText,
  Trash2,
  Upload,
  RefreshCw
} from 'lucide-react';

export function OrganizerManagePage() {
  const { id: eventId } = useParams();
  const [event, setEvent] = useState(null);
  const [activeTab, setActiveTab] = useState('checkin');
  const [loading, setLoading] = useState(true);

  // --- Registrations Tab State ---
  const [registrations, setRegistrations] = useState([]);
  const [regStatus, setRegStatus] = useState('');
  const [regSearch, setRegSearch] = useState('');
  const [regPage, setRegPage] = useState(1);
  const [regTotalPages, setRegTotalPages] = useState(1);
  const [regLoading, setRegLoading] = useState(false);

  // --- Check-in Tab State ---
  const [manualToken, setManualToken] = useState('');
  const [scanning, setScanning] = useState(false);
  const [scanResult, setScanResult] = useState(null);
  const [scanLogs, setScanLogs] = useState([
    { id: 1, name: 'Riya Sharma', time: '10:02', status: 'success' },
    { id: 2, name: 'Kabir Anand', time: '10:01', status: 'success' },
    { id: 3, name: 'Meera Joshi', time: 'ALREADY SCANNED', status: 'duplicate' },
    { id: 4, name: 'Dev Patel', time: '09:58', status: 'success' }
  ]);
  const scannerRef = useRef(null);

  // --- Resources Tab State ---
  const [resources, setResources] = useState([]);
  const [resourceTitle, setResourceTitle] = useState('');
  const [resourceFile, setResourceFile] = useState(null);
  const [uploadingResource, setUploadingResource] = useState(false);
  const [deleteResourceId, setDeleteResourceId] = useState(null);

  // --- Feedback Tab State ---
  const [feedbacks, setFeedbacks] = useState([]);
  const [feedbackLoading, setFeedbackLoading] = useState(false);

  // --- Stats Tab State ---
  const [stats, setStats] = useState(null);
  const [statsLoading, setStatsLoading] = useState(false);

  // Load Event info
  const loadEvent = useCallback(async () => {
    try {
      const res = await fetchEventById(eventId);
      if (res.success) setEvent(res.data);
    } catch (err) {
      toast.error('Failed to load event details');
    }
  }, [eventId]);

  // Load Registrations
  const loadRegistrations = useCallback(async () => {
    setRegLoading(true);
    try {
      const res = await fetchEventRegistrations(eventId, {
        status: regStatus || undefined,
        q: regSearch.trim() || undefined,
        page: regPage,
        limit: 10
      });
      if (res.success) {
        setRegistrations(res.data.items || []);
        setRegTotalPages(res.data.totalPages || 1);
      }
    } catch (err) {
      toast.error('Failed to load registrations');
    } finally {
      setRegLoading(false);
    }
  }, [eventId, regStatus, regSearch, regPage]);

  // Load Resources
  const loadResources = useCallback(async () => {
    try {
      const res = await fetchEventResources(eventId);
      if (res.success) setResources(res.data || []);
    } catch {
      // ignore
    }
  }, [eventId]);

  // Load Feedback
  const loadFeedback = useCallback(async () => {
    setFeedbackLoading(true);
    try {
      const res = await fetchEventFeedback(eventId);
      if (res.success) setFeedbacks(res.data?.items || []);
    } catch {
      // ignore
    } finally {
      setFeedbackLoading(false);
    }
  }, [eventId]);

  // Load Stats
  const loadStats = useCallback(async () => {
    setStatsLoading(true);
    try {
      const res = await fetchEventStats(eventId);
      if (res.success) setStats(res.data);
    } catch {
      // ignore
    } finally {
      setStatsLoading(false);
    }
  }, [eventId]);

  useEffect(() => {
    Promise.all([loadEvent(), loadRegistrations(), loadStats()]).finally(() => setLoading(false));
  }, [loadEvent, loadRegistrations, loadStats]);

  useEffect(() => {
    if (activeTab === 'registrations') loadRegistrations();
    if (activeTab === 'resources') loadResources();
    if (activeTab === 'feedback') loadFeedback();
    if (activeTab === 'stats') loadStats();
    if (activeTab === 'checkin') loadStats();
  }, [activeTab, loadRegistrations, loadResources, loadFeedback, loadStats]);

  // Initialize html5-qrcode scanner when Check-in tab is active
  useEffect(() => {
    if (activeTab === 'checkin') {
      let scanner = null;
      try {
        scanner = new Html5QrcodeScanner(
          'qr-reader',
          {
            fps: 10,
            qrbox: { width: 250, height: 250 },
            rememberLastUsedCamera: true
          },
          false
        );

        scanner.render(
          async (decodedText) => {
            scanner.pause(true);
            await handleScanSubmit(decodedText);
            setTimeout(() => {
              try {
                scanner.resume();
              } catch {
                // ignore
              }
            }, 2500);
          },
          () => {}
        );
        scannerRef.current = scanner;
      } catch (err) {
        console.warn('QR scanner failed to mount camera:', err);
      }

      return () => {
        if (scannerRef.current) {
          try {
            scannerRef.current.clear();
          } catch {
            // ignore
          }
        }
      };
    }
  }, [activeTab]);

  const handleManualToggleAttendance = async (reg) => {
    try {
      const newStatus = !reg.attended;
      const res = await updateAttendance(eventId, reg._id, newStatus);
      if (res.success) {
        toast.success(`Attendance updated for ${reg.user?.name}`);
        loadRegistrations();
        loadStats();
      }
    } catch (err) {
      toast.error(err.response?.data?.error?.message || 'Failed to update attendance');
    }
  };

  const handleScanSubmit = async (tokenToScan) => {
    const token = tokenToScan || manualToken.trim();
    if (!token) {
      toast.error('Please enter or scan a QR token');
      return;
    }

    setScanning(true);
    setScanResult(null);
    try {
      const res = await scanQrAttendance(eventId, token);
      if (res.success) {
        const attendeeName = res.data?.user?.name || 'Attendee';
        const nowTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        setScanResult({
          success: true,
          message: `CHECKED IN · ${attendeeName}`
        });
        setScanLogs((prev) => [
          { id: Date.now(), name: attendeeName, time: nowTime, status: 'success' },
          ...prev
        ]);
        toast.success(`Checked in: ${attendeeName}`);
        setManualToken('');
        loadStats();
      }
    } catch (err) {
      const errMsg = err.response?.data?.error?.message || 'Check-in failed';
      setScanResult({
        success: false,
        message: errMsg
      });
      setScanLogs((prev) => [
        { id: Date.now(), name: 'Scan attempt', time: errMsg.toUpperCase(), status: 'duplicate' },
        ...prev
      ]);
      toast.error(errMsg);
    } finally {
      setScanning(false);
    }
  };

  const handleUploadResourceSubmit = async (e) => {
    e.preventDefault();
    if (!resourceTitle.trim() || !resourceFile) {
      toast.error('Please provide a resource title and file');
      return;
    }

    setUploadingResource(true);
    const formData = new FormData();
    formData.append('title', resourceTitle.trim());
    formData.append('file', resourceFile);

    try {
      await uploadResource(eventId, formData);
      toast.success('Resource uploaded successfully');
      setResourceTitle('');
      setResourceFile(null);
      loadResources();
    } catch (err) {
      toast.error(err.response?.data?.error?.message || 'Upload failed');
    } finally {
      setUploadingResource(false);
    }
  };

  const handleDeleteResourceConfirm = async () => {
    if (!deleteResourceId) return;
    try {
      await deleteResource(deleteResourceId);
      toast.success('Resource deleted');
      setDeleteResourceId(null);
      loadResources();
    } catch (err) {
      toast.error('Failed to delete resource');
    }
  };

  if (loading || !event) {
    return (
      <div className="min-h-[50vh] flex flex-col items-center justify-center p-12">
        <Spinner size="lg" className="mb-4" />
        <p className="font-mono text-xs uppercase tracking-widest font-semibold text-[#2B2340]">
          Loading management console...
        </p>
      </div>
    );
  }

  const startDate = event.startTime ? new Date(event.startTime) : new Date();
  const dayNum = String(startDate.getDate()).padStart(2, '0');
  const monthName = startDate.toLocaleDateString('en-US', { month: 'short' }).toUpperCase();

  const confirmedCount = stats?.confirmed ?? event.confirmedCount ?? 0;
  const attendedCount = stats?.attended ?? 0;
  const capacityTotal = event.capacity || 40;
  const fillPercent = Math.min(100, Math.max(0, Math.round((attendedCount / capacityTotal) * 100)));

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-10">
      {/* Top Header */}
      <div className="mb-6">
        <Link
          to="/organizer"
          className="inline-flex items-center gap-2 font-mono text-xs uppercase tracking-wider font-bold text-[#2B2340] hover:underline decoration-2 underline-offset-4 mb-3 group"
        >
          <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
          <span>BACK TO ORGANIZER STUDIO</span>
        </Link>

        <div className="font-mono text-xs uppercase tracking-widest font-bold text-[#2B2340]/80">
          {event.title.toUpperCase()} · {dayNum} {monthName}
        </div>
        <h1 className="text-4xl sm:text-5xl font-black text-[#2B2340] tracking-tight mt-1">
          Manage event
        </h1>
      </div>

      {/* Navigation Tabs */}
      <div className="flex gap-2.5 mb-8 overflow-x-auto pb-2">
        {[
          { key: 'registrations', label: 'REGISTRATIONS' },
          { key: 'checkin', label: 'CHECK-IN' },
          { key: 'resources', label: 'RESOURCES' },
          { key: 'feedback', label: 'FEEDBACK' },
          { key: 'stats', label: 'STATS' }
        ].map((tab) => {
          const isActive = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveTab(tab.key)}
              className={`font-mono uppercase text-xs tracking-wider font-bold border-2 border-[#2B2340] px-5 py-2.5 whitespace-nowrap transition-all ${
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

      {/* --- TAB 1: CHECK-IN (Matches Screenshot 5) --- */}
      {activeTab === 'checkin' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Left Column: Viewfinder + Result Banner + Manual Input */}
          <div className="lg:col-span-7 xl:col-span-8 space-y-5">
            {/* Camera Viewfinder Box */}
            <div className="bg-[#2B2340] border-2 border-[#2B2340] shadow-[5px_5px_0px_#2B2340] p-6 sm:p-10 relative overflow-hidden text-center min-h-[380px] flex flex-col items-center justify-center">
              {/* Corner Brackets */}
              <div className="absolute top-6 left-6 w-8 h-8 border-t-4 border-l-4 border-white pointer-events-none" />
              <div className="absolute top-6 right-6 w-8 h-8 border-t-4 border-r-4 border-white pointer-events-none" />
              <div className="absolute bottom-6 left-6 w-8 h-8 border-b-4 border-l-4 border-white pointer-events-none" />
              <div className="absolute bottom-6 right-6 w-8 h-8 border-b-4 border-r-4 border-white pointer-events-none" />

              <div id="qr-reader" className="w-full max-w-sm mb-4"></div>

              <div className="font-mono text-xs uppercase tracking-widest font-bold text-white/90">
                POINT CAMERA AT TICKET QR
              </div>
            </div>

            {/* Check-in Result Banner */}
            {scanResult ? (
              <div
                className={`p-4 border-2 border-[#2B2340] shadow-[4px_4px_0px_#2B2340] font-mono text-sm font-bold uppercase tracking-wider text-[#2B2340] ${
                  scanResult.success ? 'bg-[#B8E0D2]' : 'bg-[#FFB3C7]'
                }`}
              >
                {scanResult.message}
              </div>
            ) : (
              <div className="p-4 bg-[#B8E0D2] border-2 border-[#2B2340] shadow-[4px_4px_0px_#2B2340] font-mono text-sm font-bold uppercase tracking-wider text-[#2B2340]">
                CHECKED IN · Ready to scan next attendee
              </div>
            )}

            {/* Manual Token Fallback */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleScanSubmit();
              }}
              className="flex flex-col sm:flex-row gap-3 pt-2"
            >
              <input
                type="text"
                placeholder="Or type the ticket token"
                value={manualToken}
                onChange={(e) => setManualToken(e.target.value)}
                className="input-base flex-1 font-mono text-xs"
              />
              <button
                type="submit"
                disabled={scanning}
                className="btn-primary sm:w-auto w-full font-mono text-xs uppercase tracking-wider"
              >
                {scanning ? 'Checking...' : 'Check in'}
              </button>
            </form>
          </div>

          {/* Right Column: Checked-in Counts + Scan Log */}
          <div className="lg:col-span-5 xl:col-span-4 space-y-6">
            {/* Top Stat Card: Checked in */}
            <div className="bg-white border-2 border-[#2B2340] shadow-[5px_5px_0px_#2B2340] p-6">
              <div className="font-mono text-xs uppercase tracking-widest font-bold text-[#2B2340]/80">
                CHECKED IN
              </div>
              <div className="text-4xl sm:text-5xl font-black text-[#2B2340] tracking-tight my-2">
                {attendedCount} <span className="text-3xl text-[#2B2340]/60 font-bold">/ {confirmedCount || capacityTotal}</span>
              </div>

              {/* Stripes Seat Meter */}
              <div className="mt-4">
                <div className="seat-meter-container">
                  <div
                    className="seat-meter-bar"
                    style={{ width: `${fillPercent}%` }}
                  />
                </div>
              </div>
            </div>

            {/* Scan Log Card */}
            <div className="bg-white border-2 border-[#2B2340] shadow-[5px_5px_0px_#2B2340] p-6">
              <div className="font-mono text-xs uppercase tracking-widest font-bold text-[#2B2340]/80 border-b-2 border-dashed border-[#2B2340] pb-2 mb-3">
                SCAN LOG
              </div>

              <div className="space-y-2">
                {scanLogs.map((log) => {
                  const isDuplicate = log.status === 'duplicate';
                  return (
                    <div
                      key={log.id}
                      className={`flex items-center justify-between font-mono text-xs ${
                        isDuplicate
                          ? 'bg-[#FFB3C7] border-2 border-[#2B2340] p-2 font-bold text-[#2B2340]'
                          : 'py-2 border-b border-[#2B2340]/10 font-medium text-[#2B2340]'
                      }`}
                    >
                      <span>{log.name}</span>
                      <span className={isDuplicate ? 'font-bold' : 'text-[#2B2340]/70'}>
                        {log.time}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* --- TAB 2: REGISTRATIONS TABLE --- */}
      {activeTab === 'registrations' && (
        <div className="space-y-6">
          {/* Filters Bar */}
          <div className="bg-white border-2 border-[#2B2340] shadow-[5px_5px_0px_#2B2340] p-4 flex flex-col sm:flex-row gap-4 items-center justify-between">
            <input
              type="text"
              placeholder="Search attendee by name or email..."
              value={regSearch}
              onChange={(e) => {
                setRegSearch(e.target.value);
                setRegPage(1);
              }}
              className="input-base w-full sm:w-80 text-xs font-mono"
            />

            <div className="flex items-center gap-3 w-full sm:w-auto">
              <select
                value={regStatus}
                onChange={(e) => {
                  setRegStatus(e.target.value);
                  setRegPage(1);
                }}
                className="input-base w-auto text-xs font-mono uppercase"
              >
                <option value="">ALL STATUSES</option>
                <option value="confirmed">CONFIRMED</option>
                <option value="waitlisted">WAITLISTED</option>
                <option value="cancelled">CANCELLED</option>
              </select>

              <button
                onClick={loadRegistrations}
                className="btn-secondary min-h-[44px] px-3 font-mono text-xs uppercase"
                title="Refresh"
              >
                <RefreshCw className="w-4 h-4 mr-1" />
                <span>REFRESH</span>
              </button>
            </div>
          </div>

          {/* Table */}
          {regLoading ? (
            <div className="py-12 flex justify-center">
              <Spinner size="md" />
            </div>
          ) : registrations.length === 0 ? (
            <div className="bg-white border-2 border-[#2B2340] shadow-[5px_5px_0px_#2B2340] p-10 text-center font-mono text-xs text-[#2B2340]">
              NO REGISTRATIONS FOUND MATCHING CRITERIA
            </div>
          ) : (
            <div className="bg-white border-2 border-[#2B2340] shadow-[5px_5px_0px_#2B2340] overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm text-[#2B2340]">
                  <thead className="bg-[#FFF4EC] font-mono text-xs font-bold uppercase tracking-wider border-b-2 border-[#2B2340]">
                    <tr>
                      <th className="px-6 py-4">ATTENDEE</th>
                      <th className="px-6 py-4">STATUS</th>
                      <th className="px-6 py-4">REGISTERED</th>
                      <th className="px-6 py-4">CHECK-IN</th>
                      <th className="px-6 py-4 text-right">MANUAL ACTION</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y-2 divide-[#2B2340]/10">
                    {registrations.map((reg) => (
                      <tr key={reg._id} className="hover:bg-[#FFF4EC]/50 transition-colors">
                        <td className="px-6 py-4">
                          <div className="font-bold">{reg.user?.name}</div>
                          <div className="font-mono text-xs text-[#2B2340]/70">{reg.user?.email}</div>
                        </td>
                        <td className="px-6 py-4">
                          <StatusBadge status={reg.status} type="registration" />
                        </td>
                        <td className="px-6 py-4 font-mono text-xs">
                          {new Date(reg.createdAt).toLocaleDateString('en-IN')}
                        </td>
                        <td className="px-6 py-4 font-mono text-xs font-bold">
                          {reg.attended ? (
                            <span className="text-[#2B2340] bg-[#B8E0D2] px-2 py-0.5 border border-[#2B2340]">
                              ✓ ATTENDED
                            </span>
                          ) : (
                            <span className="text-[#2B2340]/60">NOT CHECKED IN</span>
                          )}
                        </td>
                        <td className="px-6 py-4 text-right">
                          {reg.status === 'confirmed' ? (
                            <button
                              onClick={() => handleManualToggleAttendance(reg)}
                              className={`btn-secondary min-h-[36px] px-3 py-1 font-mono text-xs uppercase ${
                                reg.attended ? 'bg-[#FFB3C7]' : 'bg-[#B8E0D2]'
                              }`}
                            >
                              {reg.attended ? 'Mark Unattended' : 'Mark Attended'}
                            </button>
                          ) : (
                            <span className="font-mono text-xs text-[#2B2340]/40">N/A</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="p-4 border-t-2 border-[#2B2340]">
                <Pagination page={regPage} totalPages={regTotalPages} onPageChange={(p) => setRegPage(p)} />
              </div>
            </div>
          )}
        </div>
      )}

      {/* --- TAB 3: MATERIALS & RESOURCES --- */}
      {activeTab === 'resources' && (
        <div className="space-y-8">
          <div className="bg-white border-2 border-[#2B2340] shadow-[5px_5px_0px_#2B2340] p-6 sm:p-8">
            <h3 className="text-2xl font-black text-[#2B2340] tracking-tight mb-2">
              Upload Session Materials
            </h3>
            <p className="font-mono text-xs uppercase tracking-wider text-[#2B2340]/70 mb-6">
              Upload lecture slides, code files, and PDFs for confirmed attendees (max 10MB)
            </p>

            <form onSubmit={handleUploadResourceSubmit} className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-end">
              <div>
                <label className="block font-mono text-xs uppercase tracking-wider font-bold text-[#2B2340] mb-2">
                  DOCUMENT TITLE *
                </label>
                <input
                  type="text"
                  placeholder="e.g. Slide Deck & Code Repo"
                  value={resourceTitle}
                  onChange={(e) => setResourceTitle(e.target.value)}
                  className="input-base"
                />
              </div>

              <div>
                <label className="block font-mono text-xs uppercase tracking-wider font-bold text-[#2B2340] mb-2">
                  ATTACH FILE *
                </label>
                <input
                  type="file"
                  onChange={(e) => setResourceFile(e.target.files[0])}
                  className="font-mono text-xs file:btn-secondary file:min-h-[44px] file:mr-3"
                />
              </div>

              <div>
                <button
                  type="submit"
                  disabled={uploadingResource}
                  className="btn-primary w-full font-mono text-xs uppercase"
                >
                  <Upload className="w-4 h-4 mr-2" />
                  <span>{uploadingResource ? 'Uploading...' : 'Upload Resource'}</span>
                </button>
              </div>
            </form>
          </div>

          <div className="bg-white border-2 border-[#2B2340] shadow-[5px_5px_0px_#2B2340] p-6 sm:p-8">
            <h3 className="text-2xl font-black text-[#2B2340] tracking-tight mb-4">
              Uploaded Files ({resources.length})
            </h3>

            {resources.length === 0 ? (
              <p className="font-mono text-xs text-[#2B2340]/60 py-4 text-center">
                NO MATERIALS UPLOADED YET
              </p>
            ) : (
              <div className="divide-y-2 divide-[#2B2340]/10">
                {resources.map((res) => (
                  <div key={res._id} className="py-4 flex items-center justify-between">
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
                      onClick={() => setDeleteResourceId(res._id)}
                      className="p-2 border-2 border-[#2B2340] bg-white hover:bg-[#FFB3C7] shadow-[2px_2px_0px_#2B2340]"
                      title="Delete"
                    >
                      <Trash2 className="w-4 h-4 text-[#2B2340]" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* --- TAB 4: FEEDBACK REVIEWS --- */}
      {activeTab === 'feedback' && (
        <div className="bg-white border-2 border-[#2B2340] shadow-[5px_5px_0px_#2B2340] p-6 sm:p-8">
          <div className="flex items-center justify-between mb-6 pb-4 border-b-2 border-[#2B2340]">
            <h3 className="text-2xl font-black text-[#2B2340] tracking-tight">
              Attendee Reviews
            </h3>
            <div className="font-mono text-sm font-bold text-[#2B2340]">
              AVG: {event.avgRating ? `${event.avgRating} / 5` : 'NEW'} ({event.ratingCount} reviews)
            </div>
          </div>

          {feedbackLoading ? (
            <div className="py-8 flex justify-center">
              <Spinner size="md" />
            </div>
          ) : feedbacks.length === 0 ? (
            <p className="font-mono text-xs text-[#2B2340]/60 py-6 text-center">
              NO REVIEWS SUBMITTED YET
            </p>
          ) : (
            <div className="space-y-4">
              {feedbacks.map((fb) => (
                <div
                  key={fb._id}
                  className="p-4 bg-[#FFF4EC] border-2 border-[#2B2340]"
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-bold text-[#2B2340]">{fb.user?.name || 'Attendee'}</span>
                    <span className="font-mono text-xs font-bold text-[#2B2340]">
                      {'★'.repeat(fb.rating)} ({fb.rating}/5)
                    </span>
                  </div>
                  {fb.comment && <p className="text-sm text-[#2B2340]/90 mt-2">{fb.comment}</p>}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* --- TAB 5: STATS --- */}
      {activeTab === 'stats' && (
        <div className="space-y-6">
          {statsLoading || !stats ? (
            <div className="py-12 flex justify-center">
              <Spinner size="lg" />
            </div>
          ) : (
            <>
              {/* Stat Cards */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="p-5 bg-white border-2 border-[#2B2340] shadow-[5px_5px_0px_#2B2340]">
                  <div className="font-mono text-xs uppercase font-bold text-[#2B2340]/70">CONFIRMED</div>
                  <div className="text-3xl font-black text-[#2B2340] mt-1">{stats.confirmed}</div>
                </div>

                <div className="p-5 bg-white border-2 border-[#2B2340] shadow-[5px_5px_0px_#2B2340]">
                  <div className="font-mono text-xs uppercase font-bold text-[#2B2340]/70">WAITLISTED</div>
                  <div className="text-3xl font-black text-[#2B2340] mt-1">{stats.waitlisted}</div>
                </div>

                <div className="p-5 bg-white border-2 border-[#2B2340] shadow-[5px_5px_0px_#2B2340]">
                  <div className="font-mono text-xs uppercase font-bold text-[#2B2340]/70">ATTENDED</div>
                  <div className="text-3xl font-black text-[#2B2340] mt-1">{stats.attended}</div>
                </div>

                <div className="p-5 bg-[#B8E0D2] border-2 border-[#2B2340] shadow-[5px_5px_0px_#2B2340]">
                  <div className="font-mono text-xs uppercase font-bold text-[#2B2340]/70">ATTENDANCE RATE</div>
                  <div className="text-3xl font-black text-[#2B2340] mt-1">{stats.attendanceRate}%</div>
                </div>
              </div>

              {/* Breakdown Chart */}
              <div className="p-6 bg-white border-2 border-[#2B2340] shadow-[5px_5px_0px_#2B2340]">
                <h4 className="font-mono text-xs uppercase tracking-widest font-bold text-[#2B2340] mb-4">
                  REGISTRATION FUNNEL BREAKDOWN
                </h4>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={[
                        { name: 'Confirmed', count: stats.confirmed, fill: '#2B2340' },
                        { name: 'Waitlisted', count: stats.waitlisted, fill: '#FFB3C7' },
                        { name: 'Attended', count: stats.attended, fill: '#B8E0D2' },
                        { name: 'Cancelled', count: stats.cancelled, fill: '#FFD6A5' }
                      ]}
                    >
                      <XAxis dataKey="name" stroke="#2B2340" fontSize={11} fontFamily="DM Mono" />
                      <YAxis stroke="#2B2340" fontSize={11} allowDecimals={false} fontFamily="DM Mono" />
                      <Tooltip
                        contentStyle={{
                          background: '#FFFFFF',
                          borderColor: '#2B2340',
                          borderWidth: '2px',
                          borderRadius: '0px',
                          boxShadow: '4px 4px 0px #2B2340',
                          fontFamily: 'DM Mono'
                        }}
                      />
                      <Bar dataKey="count" stroke="#2B2340" strokeWidth={2}>
                        {[
                          { fill: '#2B2340' },
                          { fill: '#FFB3C7' },
                          { fill: '#B8E0D2' },
                          { fill: '#FFD6A5' }
                        ].map((entry, index) => (
                          <Cell key={`funnel-${index}`} fill={entry.fill} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* Delete Resource Confirm Modal */}
      <ConfirmModal
        isOpen={Boolean(deleteResourceId)}
        title="Delete Resource File"
        message="Are you sure you want to delete this resource file? Attendees will no longer have access to it."
        confirmText="Delete File"
        onConfirm={handleDeleteResourceConfirm}
        onCancel={() => setDeleteResourceId(null)}
      />
    </div>
  );
}
