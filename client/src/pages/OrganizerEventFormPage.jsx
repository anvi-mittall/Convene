import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { createEvent, updateEvent, fetchEventById } from '../api/events.js';
import { Spinner } from '../components/Spinner.jsx';
import toast from 'react-hot-toast';
import { ArrowLeft, Save } from 'lucide-react';

export function OrganizerEventFormPage() {
  const { id } = useParams();
  const isEdit = Boolean(id);
  const navigate = useNavigate();

  const [formData, setFormData] = useState({
    title: '',
    description: '',
    category: 'workshop',
    speakerName: '',
    speakerBio: '',
    mode: 'offline',
    venue: '',
    meetingLink: '',
    startTime: '',
    endTime: '',
    capacity: 50
  });

  const [posterFile, setPosterFile] = useState(null);
  const [posterPreview, setPosterPreview] = useState(null);
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);
  const [confirmedCount, setConfirmedCount] = useState(0);

  useEffect(() => {
    if (isEdit) {
      fetchEventById(id)
        .then((res) => {
          if (res.success && res.data) {
            const e = res.data;
            setConfirmedCount(e.confirmedCount || 0);
            const formatForInput = (d) => {
              if (!d) return '';
              const date = new Date(d);
              const pad = (n) => String(n).padStart(2, '0');
              return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
            };

            setFormData({
              title: e.title,
              description: e.description,
              category: e.category,
              speakerName: e.speakerName,
              speakerBio: e.speakerBio || '',
              mode: e.mode,
              venue: e.venue || '',
              meetingLink: e.meetingLink || '',
              startTime: formatForInput(e.startTime),
              endTime: formatForInput(e.endTime),
              capacity: e.capacity
            });

            if (e.posterUrl) {
              const backendBase = import.meta.env.VITE_API_URL?.replace(/\/api$/, '') || 'http://localhost:5000';
              setPosterPreview(`${backendBase}${e.posterUrl}`);
            }
          }
        })
        .catch((err) => {
          toast.error(err.response?.data?.error?.message || 'Failed to load event for editing');
          navigate('/organizer');
        })
        .finally(() => setLoading(false));
    }
  }, [id, isEdit, navigate]);

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (file.size > 2 * 1024 * 1024) {
        toast.error('Poster image must be less than 2MB');
        return;
      }
      setPosterFile(file);
      setPosterPreview(URL.createObjectURL(file));
    }
  };

  const validate = () => {
    const errs = {};
    if (!formData.title.trim() || formData.title.trim().length < 3) {
      errs.title = 'Title must be between 3 and 120 characters';
    }
    if (!formData.description.trim() || formData.description.trim().length < 10) {
      errs.description = 'Description must be between 10 and 5000 characters';
    }
    if (!formData.speakerName.trim()) {
      errs.speakerName = 'Speaker name is required';
    }
    if (['offline', 'hybrid'].includes(formData.mode) && !formData.venue.trim()) {
      errs.venue = 'Venue location is required for offline and hybrid events';
    }
    if (['online', 'hybrid'].includes(formData.mode)) {
      if (!formData.meetingLink.trim() || !/^https?:\/\/.+/i.test(formData.meetingLink.trim())) {
        errs.meetingLink = 'A valid HTTP(S) link is required for online and hybrid events';
      }
    }
    if (!formData.startTime) {
      errs.startTime = 'Start time is required';
    } else if (!isEdit && new Date(formData.startTime) <= new Date()) {
      errs.startTime = 'Start time must be in the future';
    }
    if (!formData.endTime) {
      errs.endTime = 'End time is required';
    } else if (new Date(formData.endTime) <= new Date(formData.startTime)) {
      errs.endTime = 'End time must be after start time';
    }

    const cap = parseInt(formData.capacity, 10);
    if (isNaN(cap) || cap < 1 || cap > 10000) {
      errs.capacity = 'Capacity must be an integer between 1 and 10000';
    } else if (isEdit && cap < confirmedCount) {
      errs.capacity = `Capacity cannot be lower than confirmed attendees (${confirmedCount})`;
    }

    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;

    setSaving(true);
    const data = new FormData();
    data.append('title', formData.title.trim());
    data.append('description', formData.description.trim());
    data.append('category', formData.category);
    data.append('speakerName', formData.speakerName.trim());
    if (formData.speakerBio) data.append('speakerBio', formData.speakerBio.trim());
    data.append('mode', formData.mode);
    if (['offline', 'hybrid'].includes(formData.mode)) data.append('venue', formData.venue.trim());
    if (['online', 'hybrid'].includes(formData.mode)) data.append('meetingLink', formData.meetingLink.trim());
    data.append('startTime', new Date(formData.startTime).toISOString());
    data.append('endTime', new Date(formData.endTime).toISOString());
    data.append('capacity', formData.capacity);

    if (posterFile) {
      data.append('poster', posterFile);
    }

    try {
      if (isEdit) {
        await updateEvent(id, data);
        toast.success('Event updated successfully');
      } else {
        await createEvent(data);
        toast.success('Event published successfully!');
      }
      navigate('/organizer');
    } catch (err) {
      toast.error(err.response?.data?.error?.message || 'Failed to save event');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-[50vh] flex flex-col items-center justify-center p-12">
        <Spinner size="lg" className="mb-4" />
        <p className="font-mono text-xs uppercase tracking-widest font-semibold text-[#2B2340]">
          Loading session data...
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-10">
      <Link
        to="/organizer"
        className="inline-flex items-center gap-2 font-mono text-xs uppercase tracking-wider font-bold text-[#2B2340] hover:underline decoration-2 underline-offset-4 mb-6 group"
      >
        <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
        <span>BACK TO ORGANIZER STUDIO</span>
      </Link>

      <div className="bg-white border-2 border-[#2B2340] shadow-[5px_5px_0px_#2B2340] p-6 sm:p-10">
        <div className="mb-8 border-b-2 border-[#2B2340] pb-6">
          <h1 className="text-3xl sm:text-4xl font-black text-[#2B2340] tracking-tight">
            {isEdit ? 'Edit Event' : 'Create New Event'}
          </h1>
          <p className="mt-1 font-mono text-xs uppercase tracking-wider text-[#2B2340]/70 font-bold">
            SCHEDULE, VENUE, SPEAKER AND CAPACITY DETAILS
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6" noValidate>
          {/* Title */}
          <div>
            <label className="block font-mono text-xs uppercase tracking-wider font-bold text-[#2B2340] mb-2">
              EVENT TITLE *
            </label>
            <input
              type="text"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              placeholder="e.g. Modern Web Architecture & Micro-frontends"
              className="input-base"
            />
            {errors.title && <p className="mt-1.5 font-mono text-xs text-[#2B2340] underline">{errors.title}</p>}
          </div>

          {/* Description */}
          <div>
            <label className="block font-mono text-xs uppercase tracking-wider font-bold text-[#2B2340] mb-2">
              DETAILED DESCRIPTION *
            </label>
            <textarea
              rows={5}
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Outline what attendees will learn, prerequisites, and agenda..."
              className="input-base"
            />
            {errors.description && <p className="mt-1.5 font-mono text-xs text-[#2B2340] underline">{errors.description}</p>}
          </div>

          {/* Category & Mode */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block font-mono text-xs uppercase tracking-wider font-bold text-[#2B2340] mb-2">
                CATEGORY *
              </label>
              <select
                value={formData.category}
                onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                className="input-base uppercase font-mono text-xs"
              >
                <option value="workshop">Workshop</option>
                <option value="seminar">Seminar</option>
                <option value="webinar">Webinar</option>
                <option value="conference">Conference</option>
                <option value="other">Other</option>
              </select>
            </div>

            <div>
              <label className="block font-mono text-xs uppercase tracking-wider font-bold text-[#2B2340] mb-2">
                DELIVERY MODE *
              </label>
              <select
                value={formData.mode}
                onChange={(e) => setFormData({ ...formData, mode: e.target.value })}
                className="input-base uppercase font-mono text-xs"
              >
                <option value="offline">Offline (In-Person)</option>
                <option value="online">Online (Virtual)</option>
                <option value="hybrid">Hybrid</option>
              </select>
            </div>
          </div>

          {/* Conditional Venue / Meeting Link */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {['offline', 'hybrid'].includes(formData.mode) && (
              <div>
                <label className="block font-mono text-xs uppercase tracking-wider font-bold text-[#2B2340] mb-2">
                  VENUE LOCATION *
                </label>
                <input
                  type="text"
                  value={formData.venue}
                  onChange={(e) => setFormData({ ...formData, venue: e.target.value })}
                  placeholder="e.g. Hall A, Tech Convention Center"
                  className="input-base"
                />
                {errors.venue && <p className="mt-1.5 font-mono text-xs text-[#2B2340] underline">{errors.venue}</p>}
              </div>
            )}

            {['online', 'hybrid'].includes(formData.mode) && (
              <div>
                <label className="block font-mono text-xs uppercase tracking-wider font-bold text-[#2B2340] mb-2">
                  ONLINE MEETING LINK *
                </label>
                <input
                  type="url"
                  value={formData.meetingLink}
                  onChange={(e) => setFormData({ ...formData, meetingLink: e.target.value })}
                  placeholder="https://meet.google.com/xyz-abc"
                  className="input-base"
                />
                {errors.meetingLink && <p className="mt-1.5 font-mono text-xs text-[#2B2340] underline">{errors.meetingLink}</p>}
              </div>
            )}
          </div>

          {/* Schedule: Start Time & End Time */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block font-mono text-xs uppercase tracking-wider font-bold text-[#2B2340] mb-2">
                START TIME *
              </label>
              <input
                type="datetime-local"
                value={formData.startTime}
                onChange={(e) => setFormData({ ...formData, startTime: e.target.value })}
                className="input-base font-mono text-xs"
              />
              {errors.startTime && <p className="mt-1.5 font-mono text-xs text-[#2B2340] underline">{errors.startTime}</p>}
            </div>

            <div>
              <label className="block font-mono text-xs uppercase tracking-wider font-bold text-[#2B2340] mb-2">
                END TIME *
              </label>
              <input
                type="datetime-local"
                value={formData.endTime}
                onChange={(e) => setFormData({ ...formData, endTime: e.target.value })}
                className="input-base font-mono text-xs"
              />
              {errors.endTime && <p className="mt-1.5 font-mono text-xs text-[#2B2340] underline">{errors.endTime}</p>}
            </div>
          </div>

          {/* Speaker Details & Capacity */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block font-mono text-xs uppercase tracking-wider font-bold text-[#2B2340] mb-2">
                SPEAKER NAME *
              </label>
              <input
                type="text"
                value={formData.speakerName}
                onChange={(e) => setFormData({ ...formData, speakerName: e.target.value })}
                placeholder="Dr. Alan Turing"
                className="input-base"
              />
              {errors.speakerName && <p className="mt-1.5 font-mono text-xs text-[#2B2340] underline">{errors.speakerName}</p>}
            </div>

            <div>
              <label className="block font-mono text-xs uppercase tracking-wider font-bold text-[#2B2340] mb-2">
                SPEAKER BIO
              </label>
              <input
                type="text"
                value={formData.speakerBio}
                onChange={(e) => setFormData({ ...formData, speakerBio: e.target.value })}
                placeholder="Chief Scientist at TechLabs"
                className="input-base"
              />
            </div>

            <div>
              <label className="block font-mono text-xs uppercase tracking-wider font-bold text-[#2B2340] mb-2">
                MAX CAPACITY *
              </label>
              <input
                type="number"
                min="1"
                max="10000"
                value={formData.capacity}
                onChange={(e) => setFormData({ ...formData, capacity: e.target.value })}
                className="input-base font-mono"
              />
              {errors.capacity && <p className="mt-1.5 font-mono text-xs text-[#2B2340] underline">{errors.capacity}</p>}
            </div>
          </div>

          {/* Poster File Upload */}
          <div>
            <label className="block font-mono text-xs uppercase tracking-wider font-bold text-[#2B2340] mb-2">
              EVENT POSTER (OPTIONAL, JPG/PNG/WEBP, MAX 2MB)
            </label>
            <div className="flex items-center gap-4">
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={handleFileChange}
                className="font-mono text-xs file:btn-secondary file:min-h-[44px] file:mr-4"
              />
              {posterPreview && (
                <div className="w-16 h-16 border-2 border-[#2B2340] overflow-hidden flex-shrink-0">
                  <img src={posterPreview} alt="Preview" className="w-full h-full object-cover" />
                </div>
              )}
            </div>
          </div>

          {/* Submit */}
          <div className="pt-6 border-t-2 border-[#2B2340] flex justify-end gap-3">
            <Link
              to="/organizer"
              className="btn-secondary font-mono text-xs uppercase"
            >
              Cancel
            </Link>
            <button
              type="submit"
              disabled={saving}
              className="btn-primary font-mono text-xs uppercase"
            >
              <Save className="w-4 h-4 mr-2" />
              <span>{saving ? 'Saving...' : isEdit ? 'Update Event' : 'Publish Event'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
