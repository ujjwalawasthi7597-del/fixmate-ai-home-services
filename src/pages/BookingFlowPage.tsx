import React, { useEffect, useState } from 'react';
import { useParams, useSearchParams, useNavigate, Link } from 'react-router-dom';
import { Sparkles, Upload, Calendar, Clock, MapPin, ArrowLeft, Navigation } from 'lucide-react';
import { api, extractApiError } from '../lib/api';
import { requestBrowserLocation } from '../lib/geolocation';
import type { Address, ProviderProfile, ServiceItem } from '../types';
import { useAuth } from '../context/AuthContext';

export function BookingFlowPage() {
  const { providerId } = useParams<{ providerId: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user, health } = useAuth();

  const [provider, setProvider] = useState<ProviderProfile | null>(null);
  const [services, setServices] = useState<ServiceItem[]>([]);
  const [addresses, setAddresses] = useState<Address[]>([]);

  const [categorySlug, setCategorySlug] = useState(searchParams.get('category') || '');
  const [serviceId, setServiceId] = useState(searchParams.get('serviceId') || '');
  const [problemTitle, setProblemTitle] = useState('');
  const [problemDescription, setProblemDescription] = useState('');
  const [symptomsText, setSymptomsText] = useState('');
  const [customerRequirements, setCustomerRequirements] = useState('');
  const [technicianNotes, setTechnicianNotes] = useState('');
  const [issueImages, setIssueImages] = useState<string[]>([]);

  const [scheduledDate, setScheduledDate] = useState(
    searchParams.get('date') || new Date(Date.now() + 86400000).toISOString().slice(0, 10)
  );
  const [timeSlot, setTimeSlot] = useState(searchParams.get('slot') || '');
  const [slots, setSlots] = useState<Array<{ time: string; isBooked: boolean }>>([]);
  const [isBlockedDay, setIsBlockedDay] = useState(false);

  const [selectedAddressId, setSelectedAddressId] = useState<string>('new');
  const [label, setLabel] = useState('Home');
  const [line1, setLine1] = useState('');
  const [locality, setLocality] = useState('');
  const [city, setCity] = useState('Bengaluru');
  const [stateName, setStateName] = useState('Karnataka');
  const [postalCode, setPostalCode] = useState('');
  const [lat, setLat] = useState<number | undefined>();
  const [lng, setLng] = useState<number | undefined>();
  const [gpsLoading, setGpsLoading] = useState(false);
  const [gpsNote, setGpsNote] = useState<string | null>(null);

  const [uploading, setUploading] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const rawDraft = sessionStorage.getItem('fixmate_ai_draft');
    if (rawDraft) {
      try {
        const draft = JSON.parse(rawDraft);
        if (draft.problemTitle) setProblemTitle(draft.problemTitle);
        if (draft.problemDescription) setProblemDescription(draft.problemDescription);
        if (Array.isArray(draft.symptoms)) setSymptomsText(draft.symptoms.join(', '));
        if (draft.customerRequirements) setCustomerRequirements(draft.customerRequirements);
        if (draft.technicianNotes) setTechnicianNotes(draft.technicianNotes);
        if (draft.category && !categorySlug) setCategorySlug(draft.category);
      } catch {
        // ignore
      }
    }
  }, []);

  useEffect(() => {
    if (!providerId) return;
    api
      .get<{ provider: ProviderProfile; services: ServiceItem[] }>(`/providers/${providerId}`)
      .then((res) => {
        setProvider(res.data.provider);
        setServices(res.data.services || []);
        if (!categorySlug && res.data.provider.categories?.[0]) {
          setCategorySlug(res.data.provider.categories[0]);
        }
      })
      .catch((err) => setError(extractApiError(err)));
  }, [providerId]);

  useEffect(() => {
    if (!providerId || !scheduledDate) return;
    api
      .get<{ availability: { slots: Array<{ time: string; isBooked: boolean }>; isBlockedDay: boolean } }>(
        `/providers/${providerId}/availability?date=${scheduledDate}`
      )
      .then((res) => {
        setSlots(res.data.availability.slots || []);
        setIsBlockedDay(Boolean(res.data.availability.isBlockedDay));
      })
      .catch(() => {});
  }, [providerId, scheduledDate]);

  useEffect(() => {
    if (!user) return;
    api
      .get<{ addresses: Address[] }>('/addresses')
      .then((res) => {
        setAddresses(res.data.addresses || []);
        if (res.data.addresses?.length) {
          const def = res.data.addresses.find((a) => a.isDefault) || res.data.addresses[0];
          setSelectedAddressId(def._id);
        }
      })
      .catch(() => {});
  }, [user]);

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.append('image', file);
      const { data } = await api.post<{ url: string }>('/upload', formData);
      setIssueImages((prev) => [...prev, data.url]);
    } catch (err) {
      setError(extractApiError(err, 'Image upload failed.'));
    } finally {
      setUploading(false);
    }
  };

  const handleAiPolish = async () => {
    const raw = `${problemTitle} ${problemDescription}`.trim();
    if (raw.length < 5) {
      setError('Enter a brief description of the issue before generating a structured summary.');
      return;
    }
    setAiLoading(true);
    setError(null);
    try {
      const { data } = await api.post<{
        jobDescription: {
          problemTitle: string;
          issueDescription: string;
          reportedSymptoms: string[];
          customerRequirements: string;
          technicianNotes: string;
        };
      }>('/ai/job-description', {
        rawProblem: raw,
        category: categorySlug,
      });
      const jd = data.jobDescription;
      setProblemTitle(jd.problemTitle);
      setProblemDescription(jd.issueDescription);
      setSymptomsText(jd.reportedSymptoms.join(', '));
      setCustomerRequirements(jd.customerRequirements);
      setTechnicianNotes(jd.technicianNotes);
    } catch (err) {
      setError(extractApiError(err));
    } finally {
      setAiLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      navigate('/login');
      return;
    }
    if (user.role !== 'customer') {
      setError('Please sign in with a Customer account to create a booking.');
      return;
    }
    if (!timeSlot) {
      setError('Please select an available time slot.');
      return;
    }

    let addressSnapshot;
    if (selectedAddressId !== 'new') {
      const saved = addresses.find((a) => a._id === selectedAddressId);
      if (!saved) {
        setError('Please select a valid address.');
        return;
      }
      addressSnapshot = {
        label: saved.label,
        line1: saved.line1,
        line2: saved.line2,
        city: saved.city,
        state: saved.state,
        postalCode: saved.postalCode,
        lat: saved.lat,
        lng: saved.lng,
      };
    } else {
      if (!line1.trim() || !city.trim() || !stateName.trim() || !postalCode.trim()) {
        setError('Complete street address, city, state, and postal code are required.');
        return;
      }
      addressSnapshot = {
        label,
        line1: line1.trim(),
        line2: locality.trim(),
        city: city.trim(),
        state: stateName.trim(),
        postalCode: postalCode.trim(),
        lat,
        lng,
      };
      // Also save for future reuse
      api.post('/addresses', { ...addressSnapshot, isDefault: addresses.length === 0 }).catch(() => {});
    }

    setSubmitting(true);
    setError(null);
    try {
      await api.post('/bookings', {
        providerProfileId: providerId,
        serviceId: serviceId || undefined,
        categorySlug: categorySlug || provider?.categories?.[0] || 'appliance-repair',
        problemTitle: problemTitle.trim(),
        problemDescription: problemDescription.trim(),
        symptoms: symptomsText
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean),
        customerRequirements,
        technicianNotes,
        issueImages,
        scheduledDate,
        timeSlot,
        addressSnapshot,
      });

      sessionStorage.removeItem('fixmate_ai_draft');
      navigate('/dashboard/customer');
    } catch (err) {
      setError(extractApiError(err, 'Could not submit booking request.'));
    } finally {
      setSubmitting(false);
    }
  };

  if (!provider) {
    return (
      <div className="max-w-3xl mx-auto px-6 py-12">
        <p className="text-sm text-slate-600">{error || 'Loading booking workspace...'}</p>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-6 py-10">
      <Link
        to={`/professionals/${provider._id}`}
        className="inline-flex items-center gap-1.5 text-sm text-slate-600 hover:text-navy-900 mb-6"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to {provider.businessName}
      </Link>

      <div className="bg-white border border-slate-200 rounded-2xl p-6 sm:p-8">
        <div className="border-b border-slate-100 pb-5 mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="font-display text-2xl font-bold text-navy-900">
              Request Service Booking
            </h1>
            <p className="text-sm text-slate-600 mt-1">
              Professional: <span className="font-semibold text-navy-900">{provider.businessName}</span> ·{' '}
              {provider.serviceLocation.city}
            </p>
          </div>
          {!user && (
            <Link
              to="/login"
              className="px-4 py-2 bg-navy-900 text-white text-xs font-semibold rounded-lg"
            >
              Sign In to Submit
            </Link>
          )}
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Category & Optional Specific Service */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Service Category</label>
              <select
                value={categorySlug}
                onChange={(e) => setCategorySlug(e.target.value)}
                className="w-full px-3 py-2.5 text-sm border border-slate-300 rounded-lg bg-white"
              >
                {provider.categories.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Listed Service Package (optional)
              </label>
              <select
                value={serviceId}
                onChange={(e) => setServiceId(e.target.value)}
                className="w-full px-3 py-2.5 text-sm border border-slate-300 rounded-lg bg-white"
              >
                <option value="">Custom Inspection & Quotation</option>
                {services.map((s) => (
                  <option key={s._id} value={s._id}>
                    {s.title} (₹{s.basePrice})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Problem Description + AI Job Description Generator */}
          <div className="space-y-4 pt-2 border-t border-slate-100">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="font-display text-base font-bold text-navy-900">1. Describe the Problem</h2>
              <button
                type="button"
                onClick={handleAiPolish}
                disabled={aiLoading}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-electric-600 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors"
              >
                <Sparkles className="w-3.5 h-3.5" />
                {aiLoading ? 'Generating...' : 'AI Format Job Description'}
              </button>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Problem Title</label>
              <input
                type="text"
                required
                value={problemTitle}
                onChange={(e) => setProblemTitle(e.target.value)}
                placeholder="e.g., Split AC indoor unit blowing warm air and leaking water"
                className="w-full px-3.5 py-2.5 text-sm border border-slate-300 rounded-lg"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Detailed Description</label>
              <textarea
                rows={4}
                required
                value={problemDescription}
                onChange={(e) => setProblemDescription(e.target.value)}
                placeholder="Describe when the issue started, unusual sounds, error codes, or visible damage..."
                className="w-full px-3.5 py-2.5 text-sm border border-slate-300 rounded-lg"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Symptoms (comma separated)
                </label>
                <input
                  type="text"
                  value={symptomsText}
                  onChange={(e) => setSymptomsText(e.target.value)}
                  placeholder="Warm air, water dripping, frost on coil"
                  className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Additional Notes for Technician
                </label>
                <input
                  type="text"
                  value={technicianNotes}
                  onChange={(e) => setTechnicianNotes(e.target.value)}
                  placeholder="Unit mounted at 9ft height, ladder needed"
                  className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-lg"
                />
              </div>
            </div>

            {/* Cloudinary Issue Photo Upload */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Supporting Issue Photos (Cloudinary)
              </label>
              <div className="flex flex-wrap items-center gap-3">
                <label className="inline-flex items-center gap-2 px-3.5 py-2 border border-slate-300 rounded-lg text-xs font-medium text-slate-700 cursor-pointer hover:bg-slate-50">
                  <Upload className="w-3.5 h-3.5" />
                  {uploading ? 'Uploading...' : 'Upload Photo'}
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    className="hidden"
                    disabled={uploading}
                    onChange={handleImageUpload}
                  />
                </label>
                {health && !health.integrations.cloudinaryConfigured && (
                  <span className="text-xs text-slate-500">
                    Cloudinary keys not configured yet (optional for booking submission).
                  </span>
                )}
              </div>
              {issueImages.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-3">
                  {issueImages.map((url) => (
                    <img
                      key={url}
                      src={url}
                      alt="Uploaded issue"
                      className="w-20 h-20 object-cover rounded-lg border border-slate-200"
                    />
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Date & Time Slot */}
          <div className="space-y-4 pt-4 border-t border-slate-100">
            <h2 className="font-display text-base font-bold text-navy-900 inline-flex items-center gap-2">
              <Calendar className="w-4 h-4 text-electric-600" />
              2. Choose Date & Available Time Slot
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-start">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Preferred Date</label>
                <input
                  type="date"
                  min={new Date().toISOString().slice(0, 10)}
                  value={scheduledDate}
                  onChange={(e) => {
                    setScheduledDate(e.target.value);
                    setTimeSlot('');
                  }}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg font-mono"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Select Open Time Slot
                </label>
                {isBlockedDay ? (
                  <p className="text-xs text-rose-700 py-2">Provider is unavailable on this date.</p>
                ) : (
                  <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                    {slots.map((s) => (
                      <button
                        key={s.time}
                        type="button"
                        disabled={s.isBooked}
                        onClick={() => setTimeSlot(s.time)}
                        className={`py-2 px-2 text-xs font-mono rounded-lg border inline-flex items-center justify-center gap-1 transition-colors ${
                          s.isBooked
                            ? 'bg-slate-100 border-slate-200 text-slate-400 cursor-not-allowed line-through'
                            : timeSlot === s.time
                            ? 'bg-navy-900 border-navy-900 text-white'
                            : 'bg-white border-slate-300 text-slate-800 hover:border-electric-600'
                        }`}
                      >
                        <Clock className="w-3 h-3" />
                        {s.time}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Service Address */}
          <div className="space-y-4 pt-4 border-t border-slate-100">
            <h2 className="font-display text-base font-bold text-navy-900 inline-flex items-center gap-2">
              <MapPin className="w-4 h-4 text-electric-600" />
              3. Service Address
            </h2>

            {addresses.length > 0 && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {addresses.map((addr) => (
                  <button
                    key={addr._id}
                    type="button"
                    onClick={() => setSelectedAddressId(addr._id)}
                    className={`text-left p-3.5 rounded-xl border transition-colors ${
                      selectedAddressId === addr._id
                        ? 'border-electric-600 bg-blue-50/40'
                        : 'border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <p className="text-xs font-bold text-navy-900">{addr.label}</p>
                    <p className="text-xs text-slate-600 mt-0.5">
                      {addr.line1}, {addr.city}, {addr.state} {addr.postalCode}
                    </p>
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => setSelectedAddressId('new')}
                  className={`text-left p-3.5 rounded-xl border transition-colors ${
                    selectedAddressId === 'new'
                      ? 'border-electric-600 bg-blue-50/40'
                      : 'border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <p className="text-xs font-bold text-navy-900">+ Enter New Address</p>
                  <p className="text-xs text-slate-500 mt-0.5">Enter street, locality, city, or share GPS pin</p>
                </button>
              </div>
            )}

            {selectedAddressId === 'new' && (
              <div className="space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2 bg-slate-50 border border-slate-200 rounded-lg px-3.5 py-2.5">
                  <div className="text-xs text-slate-600">
                    {lat !== undefined && lng !== undefined ? (
                      <span className="font-mono text-navy-900 tabular-nums">
                        GPS Attached: {lat.toFixed(4)}, {lng.toFixed(4)}
                      </span>
                    ) : (
                      <span>Optionally attach your GPS coordinates for technician navigation</span>
                    )}
                    {gpsNote && <p className="text-rose-700 mt-0.5">{gpsNote}</p>}
                  </div>
                  <button
                    type="button"
                    disabled={gpsLoading}
                    onClick={async () => {
                      setGpsLoading(true);
                      setGpsNote(null);
                      try {
                        const coords = await requestBrowserLocation();
                        setLat(coords.lat);
                        setLng(coords.lng);
                      } catch (err) {
                        setGpsNote(err instanceof Error ? err.message : 'Unable to detect location.');
                      } finally {
                        setGpsLoading(false);
                      }
                    }}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-electric-600 bg-white border border-blue-200 hover:bg-blue-50 rounded-lg transition-colors whitespace-nowrap"
                  >
                    <Navigation className="w-3.5 h-3.5" />
                    {gpsLoading ? 'Locating...' : 'Use Current GPS'}
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Label</label>
                    <input
                      type="text"
                      value={label}
                      onChange={(e) => setLabel(e.target.value)}
                      placeholder="Home / Office"
                      className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Flat / Street Line</label>
                    <input
                      type="text"
                      required
                      value={line1}
                      onChange={(e) => setLine1(e.target.value)}
                      placeholder="Flat 402, 12th Main Road"
                      className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Locality / Neighbourhood</label>
                    <input
                      type="text"
                      value={locality}
                      onChange={(e) => setLocality(e.target.value)}
                      placeholder="Indiranagar"
                      className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">City</label>
                    <input
                      type="text"
                      required
                      value={city}
                      onChange={(e) => setCity(e.target.value)}
                      className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">State</label>
                      <input
                        type="text"
                        required
                        value={stateName}
                        onChange={(e) => setStateName(e.target.value)}
                        className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">PIN Code</label>
                      <input
                        type="text"
                        required
                        value={postalCode}
                        onChange={(e) => setPostalCode(e.target.value)}
                        placeholder="560038"
                        className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg font-mono"
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {error && (
            <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800">
              {error}
            </div>
          )}

          <div className="pt-4 border-t border-slate-200 flex items-center justify-between gap-4">
            <p className="text-xs text-slate-500">
              You will review and approve the specialist&apos;s itemized quotation before paid work begins.
            </p>
            <button
              type="submit"
              disabled={submitting}
              className="px-6 py-3 bg-accent-500 hover:bg-accent-600 disabled:opacity-60 text-white text-sm font-semibold rounded-xl transition-colors whitespace-nowrap shrink-0"
            >
              {submitting ? 'Submitting...' : 'Submit Booking Request'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
