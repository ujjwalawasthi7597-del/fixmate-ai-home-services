import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  ClipboardList,
  Wrench,
  Calendar,
  FileSpreadsheet,
  IndianRupee,
  Star,
  User as UserIcon,
  Sparkles,
  MessageSquare,
} from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { api, extractApiError } from '../lib/api';
import { requestBrowserLocation } from '../lib/geolocation';
import { useAuth } from '../context/AuthContext';
import type { Booking, PaymentRecord, ReviewItem, ServiceItem } from '../types';
import { StatusText, VerifiedBadgeText } from '../components/StatusText';
import { CoordinatePickerMap } from '../components/OpenStreetMapView';

type ProviderTab = 'overview' | 'requests' | 'services' | 'availability' | 'quotations' | 'earnings' | 'reviews' | 'profile';

interface TroubleshootingGuide {
  troubleshootingChecklist: string[];
  potentialCauses: string[];
  inspectionSteps: string[];
  safetyPrecautions: string[];
  suggestedToolsAndMaterials: string[];
}

const STANDARD_SLOTS = ['09:00 AM', '10:30 AM', '12:00 PM', '02:00 PM', '03:30 PM', '05:00 PM', '06:30 PM'];

export function ProviderDashboard() {
  const { user, providerProfile, refreshUser, socket } = useAuth();
  const navigate = useNavigate();
  const [tab, setTab] = useState<ProviderTab>('overview');
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [services, setServices] = useState<ServiceItem[]>([]);
  const [payments, setPayments] = useState<PaymentRecord[]>([]);
  const [reviews, setReviews] = useState<ReviewItem[]>([]);
  const [banner, setBanner] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  // Quotation modal state
  const [quoteBooking, setQuoteBooking] = useState<Booking | null>(null);
  const [quoteForm, setQuoteForm] = useState({
    inspectionCharges: '299',
    labourCharges: '500',
    estimatedMaterialCosts: '0',
    additionalCharges: '0',
    expectedCompletionTime: '2 hours',
    workDescription: '',
  });

  // AI Troubleshooting Drawer
  const [aiGuideBooking, setAiGuideBooking] = useState<Booking | null>(null);
  const [aiGuide, setAiGuide] = useState<TroubleshootingGuide | null>(null);
  const [aiGuideLoading, setAiGuideLoading] = useState(false);

  // New Service form
  const [serviceForm, setServiceForm] = useState({
    categorySlug: providerProfile?.categories?.[0] || 'electrician',
    title: '',
    description: '',
    basePrice: '499',
    durationMinutes: '60',
  });

  // Availability manager
  const [availDate, setAvailDate] = useState(new Date().toISOString().slice(0, 10));
  const [selectedSlots, setSelectedSlots] = useState<string[]>(STANDARD_SLOTS);
  const [blockedDay, setBlockedDay] = useState(false);

  // Profile editor
  const [profForm, setProfForm] = useState({
    businessName: providerProfile?.businessName || '',
    bio: providerProfile?.bio || '',
    skills: (providerProfile?.skills || []).join(', '),
    experienceYears: String(providerProfile?.experienceYears || 2),
    startingPrice: String(providerProfile?.startingPrice || 299),
    city: providerProfile?.serviceLocation?.city || 'Bengaluru',
    area: providerProfile?.serviceLocation?.area || '',
    lat: String(providerProfile?.serviceLocation?.lat ?? 12.9716),
    lng: String(providerProfile?.serviceLocation?.lng ?? 77.5946),
    radiusKm: String(providerProfile?.serviceLocation?.radiusKm || 15),
    workStart: providerProfile?.workingHours?.start || '09:00',
    workEnd: providerProfile?.workingHours?.end || '19:00',
  });
  const [gpsLoading, setGpsLoading] = useState(false);

  useEffect(() => {
    if (!providerProfile) return;
    setProfForm({
      businessName: providerProfile.businessName || '',
      bio: providerProfile.bio || '',
      skills: (providerProfile.skills || []).join(', '),
      experienceYears: String(providerProfile.experienceYears || 2),
      startingPrice: String(providerProfile.startingPrice || 299),
      city: providerProfile.serviceLocation?.city || 'Bengaluru',
      area: providerProfile.serviceLocation?.area || '',
      lat: String(providerProfile.serviceLocation?.lat ?? 12.9716),
      lng: String(providerProfile.serviceLocation?.lng ?? 77.5946),
      radiusKm: String(providerProfile.serviceLocation?.radiusKm || 15),
      workStart: providerProfile.workingHours?.start || '09:00',
      workEnd: providerProfile.workingHours?.end || '19:00',
    });
  }, [providerProfile]);

  const loadData = useCallback(async () => {
    try {
      const [bRes, sRes, pRes, rRes] = await Promise.all([
        api.get<{ bookings: Booking[] }>('/bookings'),
        api.get<{ services: ServiceItem[] }>('/providers/me/services'),
        api.get<{ payments: PaymentRecord[] }>('/payments'),
        api.get<{ reviews: ReviewItem[] }>('/reviews'),
      ]);
      setBookings(bRes.data.bookings || []);
      setServices(sRes.data.services || []);
      setPayments(pRes.data.payments || []);
      setReviews(rRes.data.reviews || []);
    } catch (err) {
      setBanner({ type: 'err', text: extractApiError(err) });
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  useEffect(() => {
    if (!socket) return;
    const onUpdate = () => void loadData();
    socket.on('booking:updated', onUpdate);
    return () => {
      socket.off('booking:updated', onUpdate);
    };
  }, [socket, loadData]);

  useEffect(() => {
    if (!providerProfile?._id) return;
    api
      .get<{ availability: { slots: Array<{ time: string }>; isBlockedDay: boolean } }>(
        `/providers/${providerProfile._id}/availability?date=${availDate}`
      )
      .then((res) => {
        setSelectedSlots(res.data.availability.slots.map((s) => s.time));
        setBlockedDay(Boolean(res.data.availability.isBlockedDay));
      })
      .catch(() => {});
  }, [providerProfile?._id, availDate]);

  const updateJobStatus = async (bookingId: string, status: string) => {
    try {
      await api.patch(`/bookings/${bookingId}/status`, { status });
      setBanner({ type: 'ok', text: `Booking status updated to ${status}.` });
      await loadData();
    } catch (err) {
      setBanner({ type: 'err', text: extractApiError(err) });
    }
  };

  const handleSendQuotation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!quoteBooking) return;
    try {
      await api.post(`/bookings/${quoteBooking._id}/quotation`, {
        inspectionCharges: Number(quoteForm.inspectionCharges) || 0,
        labourCharges: Number(quoteForm.labourCharges) || 0,
        estimatedMaterialCosts: Number(quoteForm.estimatedMaterialCosts) || 0,
        additionalCharges: Number(quoteForm.additionalCharges) || 0,
        expectedCompletionTime: quoteForm.expectedCompletionTime,
        workDescription: quoteForm.workDescription,
      });
      setQuoteBooking(null);
      setBanner({ type: 'ok', text: 'Itemized quotation sent to customer for approval.' });
      await loadData();
    } catch (err) {
      setBanner({ type: 'err', text: extractApiError(err) });
    }
  };

  const handleLoadAiGuide = async (booking: Booking) => {
    setAiGuideBooking(booking);
    setAiGuide(null);
    setAiGuideLoading(true);
    try {
      const { data } = await api.post<{ troubleshooting: TroubleshootingGuide }>('/ai/troubleshoot', {
        problemTitle: booking.problemTitle,
        problemDescription: booking.problemDescription,
        category: booking.categorySlug,
        symptoms: booking.symptoms,
      });
      setAiGuide(data.troubleshooting);
    } catch (err) {
      setBanner({ type: 'err', text: extractApiError(err) });
      setAiGuideBooking(null);
    } finally {
      setAiGuideLoading(false);
    }
  };

  const handleAddService = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.post('/providers/me/services', {
        ...serviceForm,
        basePrice: Number(serviceForm.basePrice),
        durationMinutes: Number(serviceForm.durationMinutes),
      });
      setServiceForm({ ...serviceForm, title: '', description: '' });
      await loadData();
      setBanner({ type: 'ok', text: 'Service added to your marketplace profile.' });
    } catch (err) {
      setBanner({ type: 'err', text: extractApiError(err) });
    }
  };

  const handleDeleteService = async (id: string) => {
    await api.delete(`/providers/me/services/${id}`);
    await loadData();
  };

  const handleSaveAvailability = async () => {
    try {
      await api.put('/providers/me/availability', {
        date: availDate,
        slots: selectedSlots,
        isBlockedDay: blockedDay,
      });
      setBanner({ type: 'ok', text: `Availability updated for ${availDate}.` });
    } catch (err) {
      setBanner({ type: 'err', text: extractApiError(err) });
    }
  };

  const handleDetectGps = async () => {
    setGpsLoading(true);
    try {
      const coords = await requestBrowserLocation();
      setProfForm((prev) => ({
        ...prev,
        lat: String(coords.lat),
        lng: String(coords.lng),
      }));
      setBanner({ type: 'ok', text: `GPS coordinates updated (${coords.lat}, ${coords.lng}). Save profile to persist.` });
    } catch (err) {
      setBanner({ type: 'err', text: err instanceof Error ? err.message : 'Unable to detect GPS location.' });
    } finally {
      setGpsLoading(false);
    }
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.put('/providers/profile', {
        businessName: profForm.businessName,
        bio: profForm.bio,
        skills: profForm.skills.split(',').map((s) => s.trim()).filter(Boolean),
        experienceYears: Number(profForm.experienceYears),
        startingPrice: Number(profForm.startingPrice),
        serviceLocation: {
          city: profForm.city,
          area: profForm.area,
          address: providerProfile?.serviceLocation?.address || '',
          lat: Number(profForm.lat),
          lng: Number(profForm.lng),
          radiusKm: Number(profForm.radiusKm) || 15,
        },
        workingHours: {
          start: profForm.workStart,
          end: profForm.workEnd,
          days: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
        },
      });
      await refreshUser();
      setBanner({ type: 'ok', text: 'Provider profile and coordinates updated.' });
    } catch (err) {
      setBanner({ type: 'err', text: extractApiError(err) });
    }
  };

  const openChatWithCustomer = async (booking: Booking) => {
    const recipientId = typeof booking.customerId === 'string' ? booking.customerId : booking.customerId._id;
    const { data } = await api.post<{ conversation: { _id: string } }>('/conversations', {
      recipientId,
      bookingId: booking._id,
    });
    navigate(`/messages?conversationId=${data.conversation._id}`);
  };

  const pendingRequests = bookings.filter((b) => b.status === 'Pending');
  const upcomingJobs = bookings.filter((b) => ['Accepted', 'Awaiting Approval', 'Confirmed', 'In Progress'].includes(b.status));
  const completedJobs = bookings.filter((b) => b.status === 'Completed');
  const paidPayments = payments.filter((p) => p.status === 'Paid');
  const totalEarnings = paidPayments.reduce((s, p) => s + p.amount, 0);

  const earningsChartData = paidPayments.slice(0, 7).map((p) => ({
    date: new Date(p.createdAt).toLocaleDateString([], { month: 'short', day: 'numeric' }),
    amount: p.amount,
  }));

  const navItems: Array<{ id: ProviderTab; label: string; icon: React.ReactNode }> = [
    { id: 'overview', label: 'Dashboard', icon: <LayoutDashboard className="w-4 h-4" /> },
    { id: 'requests', label: 'Booking Requests', icon: <ClipboardList className="w-4 h-4" /> },
    { id: 'services', label: 'My Services', icon: <Wrench className="w-4 h-4" /> },
    { id: 'availability', label: 'Availability', icon: <Calendar className="w-4 h-4" /> },
    { id: 'quotations', label: 'Quotations', icon: <FileSpreadsheet className="w-4 h-4" /> },
    { id: 'earnings', label: 'Earnings', icon: <IndianRupee className="w-4 h-4" /> },
    { id: 'reviews', label: 'Reviews', icon: <Star className="w-4 h-4" /> },
    { id: 'profile', label: 'Profile', icon: <UserIcon className="w-4 h-4" /> },
  ];

  return (
    <div className="max-w-7xl mx-auto px-6 py-8 flex flex-col lg:flex-row gap-8">
      <aside className="lg:w-60 shrink-0">
        <div className="bg-white border border-slate-200 rounded-xl p-3 space-y-1">
          {navItems.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setTab(item.id)}
              className={`w-full flex items-center gap-2.5 px-3 py-2.5 text-sm font-medium rounded-lg transition-colors ${
                tab === item.id ? 'bg-navy-900 text-white' : 'text-slate-700 hover:bg-slate-100'
              }`}
            >
              {item.icon}
              {item.label}
            </button>
          ))}
        </div>
      </aside>

      <main className="flex-1 min-w-0 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="font-display text-2xl font-bold text-navy-900">
                {providerProfile?.businessName || user?.name}
              </h1>
              {providerProfile && <VerifiedBadgeText status={providerProfile.verificationStatus} />}
            </div>
            <p className="text-xs text-slate-500 mt-0.5">Service Provider Operations Console</p>
          </div>
        </div>

        {banner && (
          <div
            className={`p-3.5 rounded-xl border text-xs flex items-center justify-between ${
              banner.type === 'ok'
                ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                : 'bg-rose-50 border-rose-200 text-rose-900'
            }`}
          >
            <span>{banner.text}</span>
            <button type="button" onClick={() => setBanner(null)} className="underline">
              Dismiss
            </button>
          </div>
        )}

        {tab === 'overview' && (
          <>
            <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
              {[
                { label: 'Total Jobs', value: bookings.length },
                { label: 'Pending Requests', value: pendingRequests.length },
                { label: 'Upcoming Jobs', value: upcomingJobs.length },
                { label: 'Completed Jobs', value: completedJobs.length },
                { label: 'Verified Earnings', value: `₹${totalEarnings}` },
              ].map((s) => (
                <div key={s.label} className="bg-white border border-slate-200 rounded-xl p-4">
                  <p className="text-xs text-slate-500">{s.label}</p>
                  <p className="font-mono text-xl font-bold text-navy-900 mt-1 tabular-nums">{s.value}</p>
                </div>
              ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              <div className="lg:col-span-7 bg-white border border-slate-200 rounded-xl p-6">
                <h2 className="font-display text-base font-bold text-navy-900 mb-4">Earnings Overview</h2>
                {earningsChartData.length === 0 ? (
                  <p className="text-sm text-slate-500 py-12 text-center">
                    Verified payments will chart here as customers settle approved quotations.
                  </p>
                ) : (
                  <div className="h-56">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={earningsChartData}>
                        <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                        <YAxis tick={{ fontSize: 11 }} />
                        <Tooltip />
                        <Bar dataKey="amount" fill="#0B1F3A" radius={[6, 6, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </div>

              <div className="lg:col-span-5 bg-white border border-slate-200 rounded-xl p-6">
                <h2 className="font-display text-base font-bold text-navy-900 mb-4">Recent Activity</h2>
                {bookings.length === 0 ? (
                  <p className="text-sm text-slate-500">No booking requests yet.</p>
                ) : (
                  <div className="divide-y divide-slate-100">
                    {bookings.slice(0, 5).map((b) => (
                      <div key={b._id} className="py-3 flex items-center justify-between gap-2">
                        <div className="min-w-0">
                          <p className="text-xs font-semibold text-navy-900 truncate">{b.problemTitle}</p>
                          <p className="text-[11px] font-mono text-slate-500">
                            {b.scheduledDate} · {b.timeSlot}
                          </p>
                        </div>
                        <StatusText status={b.status} />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </>
        )}

        {(tab === 'requests' || tab === 'quotations') && (
          <div className="space-y-4">
            {bookings.length === 0 ? (
              <div className="bg-white border border-slate-200 rounded-xl p-10 text-center">
                <p className="font-semibold text-navy-900">No job requests assigned yet</p>
              </div>
            ) : (
              bookings.map((b) => {
                const customerName = typeof b.customerId === 'object' ? b.customerId.name : 'Customer';
                return (
                  <div key={b._id} className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
                    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                      <div>
                        <p className="font-mono text-xs text-slate-500">
                          {b.bookingCode} · {b.categorySlug}
                        </p>
                        <h3 className="font-display text-lg font-bold text-navy-900">{b.problemTitle}</h3>
                        <p className="text-xs text-slate-600 mt-1">
                          Customer: <span className="font-semibold">{customerName}</span> · {b.scheduledDate} at{' '}
                          <span className="font-mono">{b.timeSlot}</span>
                        </p>
                        <p className="text-xs text-slate-500 mt-0.5">
                          Address: {b.addressSnapshot.line1}, {b.addressSnapshot.city} {b.addressSnapshot.postalCode}
                        </p>
                      </div>
                      <StatusText status={b.status} />
                    </div>

                    <p className="text-sm text-slate-700">{b.problemDescription}</p>
                    {b.technicianNotes && (
                      <p className="text-xs text-slate-600">
                        <span className="font-semibold">Customer Notes:</span> {b.technicianNotes}
                      </p>
                    )}

                    {b.quotation && (
                      <div className="bg-slate-50 border border-slate-200 rounded-lg p-3.5 text-xs flex flex-wrap items-center justify-between gap-2">
                        <span>
                          Quotation Total: <strong className="font-mono">₹{b.quotation.totalEstimatedAmount}</strong> ·{' '}
                          {b.quotation.expectedCompletionTime}
                        </span>
                        <StatusText status={b.quotation.status} />
                      </div>
                    )}

                    <div className="pt-3 border-t border-slate-100 flex flex-wrap items-center gap-2.5">
                      {b.status === 'Pending' && (
                        <>
                          <button
                            type="button"
                            onClick={() => void updateJobStatus(b._id, 'Accepted')}
                            className="px-3.5 py-2 bg-navy-900 text-white text-xs font-semibold rounded-lg"
                          >
                            Accept Request
                          </button>
                          <button
                            type="button"
                            onClick={() => void updateJobStatus(b._id, 'Rejected')}
                            className="px-3.5 py-2 border border-rose-300 text-rose-700 text-xs font-semibold rounded-lg"
                          >
                            Reject
                          </button>
                        </>
                      )}

                      {['Accepted', 'Awaiting Approval'].includes(b.status) && (
                        <button
                          type="button"
                          onClick={() => {
                            setQuoteBooking(b);
                            setQuoteForm({
                              inspectionCharges: String(providerProfile?.startingPrice || 299),
                              labourCharges: '500',
                              estimatedMaterialCosts: '0',
                              additionalCharges: '0',
                              expectedCompletionTime: '2 hours',
                              workDescription: `Inspection and repair for: ${b.problemTitle}`,
                            });
                          }}
                          className="px-3.5 py-2 bg-electric-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg"
                        >
                          {b.quotation ? 'Update Quotation' : 'Submit Quotation'}
                        </button>
                      )}

                      {b.status === 'Confirmed' && (
                        <button
                          type="button"
                          onClick={() => void updateJobStatus(b._id, 'In Progress')}
                          className="px-3.5 py-2 bg-accent-500 hover:bg-accent-600 text-white text-xs font-semibold rounded-lg"
                        >
                          Start Job
                        </button>
                      )}

                      {b.status === 'In Progress' && (
                        <button
                          type="button"
                          onClick={() => void updateJobStatus(b._id, 'Completed')}
                          className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-lg"
                        >
                          Mark Completed
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={() => void handleLoadAiGuide(b)}
                        className="px-3.5 py-2 border border-slate-300 text-navy-900 hover:bg-slate-50 text-xs font-semibold rounded-lg inline-flex items-center gap-1.5"
                      >
                        <Sparkles className="w-3.5 h-3.5 text-electric-600" />
                        AI Troubleshooting Guide
                      </button>

                      <button
                        type="button"
                        onClick={() => void openChatWithCustomer(b)}
                        className="ml-auto px-3 py-2 border border-slate-300 text-xs font-semibold rounded-lg inline-flex items-center gap-1.5"
                      >
                        <MessageSquare className="w-3.5 h-3.5" />
                        Chat
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}

        {tab === 'services' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <form onSubmit={handleAddService} className="lg:col-span-5 bg-white border border-slate-200 rounded-xl p-6 space-y-3">
              <h2 className="font-display text-base font-bold text-navy-900">Add Service Listing</h2>
              <select
                value={serviceForm.categorySlug}
                onChange={(e) => setServiceForm({ ...serviceForm, categorySlug: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white"
              >
                {(providerProfile?.categories?.length ? providerProfile.categories : ['electrician']).map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
              <input
                type="text"
                required
                placeholder="Service Title (e.g., Split AC Foam Jet Cleaning)"
                value={serviceForm.title}
                onChange={(e) => setServiceForm({ ...serviceForm, title: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
              />
              <textarea
                rows={3}
                placeholder="Scope included in base price..."
                value={serviceForm.description}
                onChange={(e) => setServiceForm({ ...serviceForm, description: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
              />
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="number"
                  required
                  placeholder="Base Price (₹)"
                  value={serviceForm.basePrice}
                  onChange={(e) => setServiceForm({ ...serviceForm, basePrice: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg font-mono"
                />
                <input
                  type="number"
                  required
                  placeholder="Duration (mins)"
                  value={serviceForm.durationMinutes}
                  onChange={(e) => setServiceForm({ ...serviceForm, durationMinutes: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg font-mono"
                />
              </div>
              <button type="submit" className="w-full py-2.5 bg-navy-900 text-white text-xs font-semibold rounded-lg">
                Publish Service
              </button>
            </form>

            <div className="lg:col-span-7 bg-white border border-slate-200 rounded-xl p-6">
              <h2 className="font-display text-base font-bold text-navy-900 mb-4">Your Published Services</h2>
              {services.length === 0 ? (
                <p className="text-sm text-slate-500">No services listed yet.</p>
              ) : (
                <div className="divide-y divide-slate-100">
                  {services.map((s) => (
                    <div key={s._id} className="py-3 flex items-center justify-between gap-4">
                      <div>
                        <p className="text-sm font-semibold text-navy-900">{s.title}</p>
                        <p className="text-xs text-slate-500">
                          {s.categorySlug} · <span className="font-mono">₹{s.basePrice}</span> · {s.durationMinutes} mins
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => void handleDeleteService(s._id)}
                        className="text-xs text-rose-600 hover:underline"
                      >
                        Delete
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {tab === 'availability' && (
          <div className="bg-white border border-slate-200 rounded-xl p-6 max-w-2xl space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <h2 className="font-display text-lg font-bold text-navy-900">Availability Calendar</h2>
                <p className="text-xs text-slate-500">Manage open appointment slots per date.</p>
              </div>
              <input
                type="date"
                value={availDate}
                onChange={(e) => setAvailDate(e.target.value)}
                className="px-3 py-2 text-sm border border-slate-300 rounded-lg font-mono"
              />
            </div>

            <label className="inline-flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
              <input
                type="checkbox"
                checked={blockedDay}
                onChange={(e) => setBlockedDay(e.target.checked)}
                className="rounded border-slate-300"
              />
              Mark entire day as unavailable
            </label>

            {!blockedDay && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                {STANDARD_SLOTS.map((slot) => {
                  const active = selectedSlots.includes(slot);
                  return (
                    <button
                      key={slot}
                      type="button"
                      onClick={() =>
                        setSelectedSlots((prev) =>
                          prev.includes(slot) ? prev.filter((s) => s !== slot) : [...prev, slot]
                        )
                      }
                      className={`py-2.5 px-3 text-xs font-mono rounded-lg border ${
                        active
                          ? 'bg-navy-900 border-navy-900 text-white'
                          : 'bg-white border-slate-300 text-slate-600'
                      }`}
                    >
                      {slot}
                    </button>
                  );
                })}
              </div>
            )}

            <button
              type="button"
              onClick={handleSaveAvailability}
              className="px-5 py-2.5 bg-navy-900 text-white text-xs font-semibold rounded-lg"
            >
              Save Schedule for {availDate}
            </button>
          </div>
        )}

        {tab === 'earnings' && (
          <div className="bg-white border border-slate-200 rounded-xl p-6 overflow-x-auto">
            <h2 className="font-display text-lg font-bold text-navy-900 mb-4">
              Earnings Ledger (Total Verified: <span className="font-mono">₹{totalEarnings}</span>)
            </h2>
            {payments.length === 0 ? (
              <p className="text-sm text-slate-500">No payments received yet.</p>
            ) : (
              <table className="w-full text-left text-xs">
                <thead className="border-b border-slate-200 text-slate-500">
                  <tr>
                    <th className="py-2.5 pr-4">Booking</th>
                    <th className="py-2.5 pr-4">Customer</th>
                    <th className="py-2.5 pr-4 text-right">Amount</th>
                    <th className="py-2.5 pr-4">Status</th>
                    <th className="py-2.5">Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {payments.map((p) => (
                    <tr key={p._id} className="h-10">
                      <td className="pr-4 font-mono">
                        {typeof p.bookingId === 'object' ? p.bookingId.bookingCode : p.bookingId}
                      </td>
                      <td className="pr-4">{p.customerId?.name || 'Customer'}</td>
                      <td className="pr-4 text-right font-mono font-semibold tabular-nums">₹{p.amount}</td>
                      <td className="pr-4">
                        <StatusText status={p.status} />
                      </td>
                      <td className="font-mono text-slate-500">{new Date(p.createdAt).toLocaleDateString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        {tab === 'reviews' && (
          <div className="bg-white border border-slate-200 rounded-xl p-6">
            <h2 className="font-display text-lg font-bold text-navy-900 mb-4">Customer Ratings & Feedback</h2>
            {reviews.length === 0 ? (
              <p className="text-sm text-slate-500">No reviews received yet.</p>
            ) : (
              <div className="divide-y divide-slate-100">
                {reviews.map((r) => (
                  <div key={r._id} className="py-3.5">
                    <div className="flex justify-between text-sm font-semibold text-navy-900">
                      <span>{r.customerId?.name || 'Customer'}</span>
                      <span className="font-mono text-amber-600">{r.rating.toFixed(1)} ★</span>
                    </div>
                    <p className="text-sm text-slate-700 mt-1">{r.comment}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {tab === 'profile' && (
          <form onSubmit={handleSaveProfile} className="bg-white border border-slate-200 rounded-xl p-6 max-w-2xl space-y-4">
            <h2 className="font-display text-lg font-bold text-navy-900">Service Profile Settings</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Business Name</label>
                <input
                  type="text"
                  required
                  value={profForm.businessName}
                  onChange={(e) => setProfForm({ ...profForm, businessName: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Starting Inspection Price (₹)</label>
                <input
                  type="number"
                  value={profForm.startingPrice}
                  onChange={(e) => setProfForm({ ...profForm, startingPrice: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg font-mono"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">City</label>
                <input
                  type="text"
                  value={profForm.city}
                  onChange={(e) => setProfForm({ ...profForm, city: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Locality / Area</label>
                <input
                  type="text"
                  value={profForm.area}
                  onChange={(e) => setProfForm({ ...profForm, area: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Experience (Years)</label>
                <input
                  type="number"
                  value={profForm.experienceYears}
                  onChange={(e) => setProfForm({ ...profForm, experienceYears: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg font-mono"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Service Radius (km)</label>
                <input
                  type="number"
                  value={profForm.radiusKm}
                  onChange={(e) => setProfForm({ ...profForm, radiusKm: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg font-mono"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Base Latitude</label>
                <input
                  type="number"
                  step="any"
                  required
                  value={profForm.lat}
                  onChange={(e) => setProfForm({ ...profForm, lat: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg font-mono"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Base Longitude</label>
                <input
                  type="number"
                  step="any"
                  required
                  value={profForm.lng}
                  onChange={(e) => setProfForm({ ...profForm, lng: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg font-mono"
                />
              </div>
            </div>

            <div className="pt-2 border-t border-slate-100">
              <CoordinatePickerMap
                lat={Number(profForm.lat) || 12.9716}
                lng={Number(profForm.lng) || 77.5946}
                gpsLoading={gpsLoading}
                onDetectGps={() => void handleDetectGps()}
                onChange={(nextLat, nextLng) =>
                  setProfForm((prev) => ({
                    ...prev,
                    lat: String(nextLat),
                    lng: String(nextLng),
                  }))
                }
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Skills (comma separated)</label>
              <input
                type="text"
                value={profForm.skills}
                onChange={(e) => setProfForm({ ...profForm, skills: e.target.value })}
                placeholder="Split AC PCB repair, MCB panel rewiring, RO servicing"
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Bio</label>
              <textarea
                rows={3}
                value={profForm.bio}
                onChange={(e) => setProfForm({ ...profForm, bio: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
              />
            </div>
            <button type="submit" className="px-5 py-2.5 bg-navy-900 text-white text-xs font-semibold rounded-lg">
              Update Profile
            </button>
          </form>
        )}

        {/* Quotation Modal */}
        {quoteBooking && (
          <div className="fixed inset-0 z-50 bg-navy-950/50 flex items-center justify-center p-4">
            <form onSubmit={handleSendQuotation} className="bg-white rounded-2xl p-6 max-w-lg w-full space-y-4">
              <h3 className="font-display text-lg font-bold text-navy-900">
                Submit Quotation · {quoteBooking.bookingCode}
              </h3>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Inspection Charges (₹)</label>
                  <input
                    type="number"
                    min={0}
                    value={quoteForm.inspectionCharges}
                    onChange={(e) => setQuoteForm({ ...quoteForm, inspectionCharges: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Labour Charges (₹)</label>
                  <input
                    type="number"
                    min={0}
                    value={quoteForm.labourCharges}
                    onChange={(e) => setQuoteForm({ ...quoteForm, labourCharges: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Estimated Materials (₹)</label>
                  <input
                    type="number"
                    min={0}
                    value={quoteForm.estimatedMaterialCosts}
                    onChange={(e) => setQuoteForm({ ...quoteForm, estimatedMaterialCosts: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Additional Charges (₹)</label>
                  <input
                    type="number"
                    min={0}
                    value={quoteForm.additionalCharges}
                    onChange={(e) => setQuoteForm({ ...quoteForm, additionalCharges: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg font-mono"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Expected Completion Time</label>
                <input
                  type="text"
                  required
                  value={quoteForm.expectedCompletionTime}
                  onChange={(e) => setQuoteForm({ ...quoteForm, expectedCompletionTime: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Description of Proposed Work</label>
                <textarea
                  rows={3}
                  required
                  value={quoteForm.workDescription}
                  onChange={(e) => setQuoteForm({ ...quoteForm, workDescription: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                />
              </div>
              <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                <p className="font-mono text-sm font-bold text-navy-900">
                  Total: ₹
                  {(Number(quoteForm.inspectionCharges) || 0) +
                    (Number(quoteForm.labourCharges) || 0) +
                    (Number(quoteForm.estimatedMaterialCosts) || 0) +
                    (Number(quoteForm.additionalCharges) || 0)}
                </p>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setQuoteBooking(null)}
                    className="px-4 py-2 text-xs font-semibold border border-slate-300 rounded-lg"
                  >
                    Cancel
                  </button>
                  <button type="submit" className="px-4 py-2 text-xs font-semibold bg-navy-900 text-white rounded-lg">
                    Send Quotation
                  </button>
                </div>
              </div>
            </form>
          </div>
        )}

        {/* AI Troubleshooting Assistant Modal */}
        {aiGuideBooking && (
          <div className="fixed inset-0 z-50 bg-navy-950/50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl p-6 max-w-2xl w-full max-h-[85vh] overflow-y-auto space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <h3 className="font-display text-lg font-bold text-navy-900">
                  AI Technician Troubleshooting · {aiGuideBooking.bookingCode}
                </h3>
                <button
                  type="button"
                  onClick={() => setAiGuideBooking(null)}
                  className="text-xs font-semibold text-slate-500 hover:text-navy-900"
                >
                  Close
                </button>
              </div>
              {aiGuideLoading ? (
                <p className="text-sm text-slate-500 py-8 text-center">Generating field checklist...</p>
              ) : (
                aiGuide && (
                  <div className="space-y-4 text-sm">
                    <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-900">
                      <p className="font-bold mb-1">Safety Precautions</p>
                      <ul className="list-disc pl-4 space-y-0.5">
                        {aiGuide.safetyPrecautions.map((s, i) => (
                          <li key={i}>{s}</li>
                        ))}
                      </ul>
                    </div>
                    <div>
                      <p className="font-semibold text-navy-900 mb-1">Potential Causes</p>
                      <ul className="list-disc pl-5 text-slate-700 space-y-0.5">
                        {aiGuide.potentialCauses.map((c, i) => (
                          <li key={i}>{c}</li>
                        ))}
                      </ul>
                    </div>
                    <div>
                      <p className="font-semibold text-navy-900 mb-1">Recommended Inspection Steps</p>
                      <ol className="list-decimal pl-5 text-slate-700 space-y-0.5">
                        {aiGuide.inspectionSteps.map((s, i) => (
                          <li key={i}>{s}</li>
                        ))}
                      </ol>
                    </div>
                    <div>
                      <p className="font-semibold text-navy-900 mb-1">Suggested Tools & Materials</p>
                      <p className="text-slate-700">{aiGuide.suggestedToolsAndMaterials.join(' · ')}</p>
                    </div>
                  </div>
                )
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
