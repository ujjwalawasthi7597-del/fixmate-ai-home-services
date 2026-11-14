import { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { MapPin, Star, Calendar, Clock, MessageSquare, Bookmark, ArrowLeft } from 'lucide-react';
import { api, extractApiError } from '../lib/api';
import type { ProviderProfile, ReviewItem, ServiceItem } from '../types';
import { VerifiedBadgeText } from '../components/StatusText';
import { useAuth } from '../context/AuthContext';
import { TechnicianDiscoveryMap } from '../components/OpenStreetMapView';

const FALLBACK_AVATAR = '/src/assets/images/avatar_technician_arjun_1794547808471.jpg';

export function ProviderDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [provider, setProvider] = useState<ProviderProfile | null>(null);
  const [services, setServices] = useState<ServiceItem[]>([]);
  const [reviews, setReviews] = useState<ReviewItem[]>([]);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().slice(0, 10));
  const [slots, setSlots] = useState<Array<{ time: string; isBooked: boolean }>>([]);
  const [isBlockedDay, setIsBlockedDay] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    api
      .get<{ provider: ProviderProfile; services: ServiceItem[]; reviews: ReviewItem[] }>(`/providers/${id}`)
      .then((res) => {
        setProvider(res.data.provider);
        setServices(res.data.services || []);
        setReviews(res.data.reviews || []);
      })
      .catch((err) => setError(extractApiError(err, 'Provider not found.')))
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(() => {
    if (!id || !selectedDate) return;
    api
      .get<{ availability: { slots: Array<{ time: string; isBooked: boolean }>; isBlockedDay: boolean } }>(
        `/providers/${id}/availability?date=${selectedDate}`
      )
      .then((res) => {
        setSlots(res.data.availability.slots || []);
        setIsBlockedDay(Boolean(res.data.availability.isBlockedDay));
      })
      .catch(() => {});
  }, [id, selectedDate]);

  const handleToggleSave = async () => {
    if (!user) {
      navigate('/login');
      return;
    }
    if (!id) return;
    try {
      const { data } = await api.post<{ saved: boolean }>(`/providers/${id}/save`);
      setSaved(data.saved);
    } catch {
      // ignore
    }
  };

  const handleMessagePro = async () => {
    if (!user) {
      navigate('/login');
      return;
    }
    if (!provider) return;
    const recipientId = typeof provider.userId === 'string' ? provider.userId : provider.userId._id;
    try {
      const { data } = await api.post<{ conversation: { _id: string } }>('/conversations', { recipientId });
      navigate(`/messages?conversationId=${data.conversation._id}`);
    } catch (err) {
      setError(extractApiError(err));
    }
  };

  if (loading) {
    return (
      <div className="max-w-5xl mx-auto px-6 py-12">
        <div className="h-48 bg-white border border-slate-200 rounded-xl animate-pulse" />
      </div>
    );
  }

  if (error || !provider) {
    return (
      <div className="max-w-5xl mx-auto px-6 py-12 text-center">
        <p className="text-rose-700 font-medium">{error || 'Provider profile unavailable.'}</p>
        <Link to="/explore" className="inline-block mt-4 text-sm text-electric-600 hover:underline">
          Back to Explore Services
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-6 py-10 space-y-8">
      <Link to="/explore" className="inline-flex items-center gap-1.5 text-sm text-slate-600 hover:text-navy-900">
        <ArrowLeft className="w-4 h-4" />
        Back to Professionals
      </Link>

      {/* Header Card */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 sm:p-8 flex flex-col md:flex-row justify-between gap-6">
        <div className="flex flex-col sm:flex-row gap-5">
          <img
            src={provider.avatarUrl || FALLBACK_AVATAR}
            alt={provider.businessName}
            referrerPolicy="no-referrer"
            className="w-24 h-24 rounded-2xl object-cover bg-slate-100 shrink-0"
          />
          <div>
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="font-display text-2xl font-bold text-navy-900">{provider.businessName}</h1>
              <VerifiedBadgeText status={provider.verificationStatus} />
            </div>
            <p className="text-sm text-slate-600 mt-1">
              {provider.categories.join(', ')} · {provider.experienceYears} years experience ·{' '}
              <span className="font-mono tabular-nums">{provider.completedJobsCount}</span> jobs completed
            </p>
            <div className="flex flex-wrap items-center gap-4 mt-2 text-xs text-slate-600">
              <span className="inline-flex items-center gap-1">
                <MapPin className="w-3.5 h-3.5 text-slate-400" />
                {provider.serviceLocation.area ? `${provider.serviceLocation.area}, ` : ''}
                {provider.serviceLocation.city} (within {provider.serviceLocation.radiusKm} km)
              </span>
              <span className="inline-flex items-center gap-1 font-medium text-navy-900 tabular-nums">
                <Star className="w-3.5 h-3.5 text-amber-500 fill-amber-500" />
                {provider.ratingAverage.toFixed(1)} ({provider.ratingCount} reviews)
              </span>
            </div>
            {provider.bio && <p className="text-sm text-slate-700 mt-4 max-w-2xl leading-relaxed">{provider.bio}</p>}
            {provider.skills?.length > 0 && (
              <p className="text-xs text-slate-500 mt-3">
                Specialties: <span className="text-slate-700 font-medium">{provider.skills.join(' · ')}</span>
              </p>
            )}
          </div>
        </div>

        <div className="flex flex-col justify-between md:items-end gap-4 shrink-0">
          <div className="md:text-right">
            <p className="text-xs text-slate-500">Base inspection / starting fee</p>
            <p className="font-mono text-2xl font-bold text-navy-900 tabular-nums">
              {provider.pricingMode === 'quotation' ? 'Quote-Based' : `₹${provider.startingPrice}`}
            </p>
          </div>
          <div className="flex flex-wrap gap-2.5">
            {user?.role === 'customer' && (
              <button
                type="button"
                onClick={handleToggleSave}
                className="px-3.5 py-2 text-xs font-semibold border border-slate-300 rounded-lg hover:bg-slate-50 inline-flex items-center gap-1.5"
              >
                <Bookmark className={`w-3.5 h-3.5 ${saved ? 'fill-navy-900 text-navy-900' : ''}`} />
                {saved ? 'Saved' : 'Save'}
              </button>
            )}
            <button
              type="button"
              onClick={handleMessagePro}
              className="px-3.5 py-2 text-xs font-semibold border border-slate-300 rounded-lg hover:bg-slate-50 inline-flex items-center gap-1.5"
            >
              <MessageSquare className="w-3.5 h-3.5" />
              Message
            </button>
            <Link
              to={`/book/${provider._id}`}
              className="px-4 py-2 text-xs font-semibold text-white bg-accent-500 hover:bg-accent-600 rounded-lg"
            >
              Request Booking
            </Link>
          </div>
        </div>
      </div>

      {/* Availability & Services Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-7 bg-white border border-slate-200 rounded-xl p-6">
          <h2 className="font-display text-lg font-bold text-navy-900 mb-4">Services Offered</h2>
          {services.length === 0 ? (
            <p className="text-sm text-slate-500">
              This specialist provides custom quotation-based repairs across {provider.categories.join(', ')}.
            </p>
          ) : (
            <div className="divide-y divide-slate-100">
              {services.map((s) => (
                <div key={s._id} className="py-3.5 flex items-center justify-between gap-4">
                  <div>
                    <p className="text-sm font-semibold text-navy-900">{s.title}</p>
                    <p className="text-xs text-slate-600 mt-0.5">{s.description}</p>
                    <p className="text-xs text-slate-400 mt-1 font-mono tabular-nums">
                      Est. {s.durationMinutes} mins
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="font-mono text-sm font-bold text-navy-900 tabular-nums">₹{s.basePrice}</p>
                    <Link
                      to={`/book/${provider._id}?serviceId=${s._id}&category=${s.categorySlug}`}
                      className="text-xs font-semibold text-electric-600 hover:underline"
                    >
                      Select
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="lg:col-span-5 bg-white border border-slate-200 rounded-xl p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-display text-lg font-bold text-navy-900 inline-flex items-center gap-2">
              <Calendar className="w-4 h-4 text-electric-600" />
              Available Slots
            </h2>
            <input
              type="date"
              min={new Date().toISOString().slice(0, 10)}
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="px-2.5 py-1.5 text-xs border border-slate-300 rounded-lg font-mono"
            />
          </div>

          {isBlockedDay ? (
            <p className="text-sm text-amber-700 py-4">Provider is unavailable on {selectedDate}.</p>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              {slots.map((slot) => (
                <button
                  key={slot.time}
                  type="button"
                  disabled={slot.isBooked}
                  onClick={() =>
                    navigate(`/book/${provider._id}?date=${selectedDate}&slot=${encodeURIComponent(slot.time)}`)
                  }
                  className={`py-2.5 px-3 text-xs font-mono rounded-lg border inline-flex items-center justify-center gap-1.5 transition-colors ${
                    slot.isBooked
                      ? 'bg-slate-100 border-slate-200 text-slate-400 cursor-not-allowed line-through'
                      : 'bg-white border-slate-300 text-navy-900 hover:border-electric-600 hover:bg-blue-50'
                  }`}
                >
                  <Clock className="w-3.5 h-3.5" />
                  {slot.time}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Service Coverage Map */}
      <div className="bg-white border border-slate-200 rounded-xl p-6">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
          <h2 className="font-display text-lg font-bold text-navy-900">
            Service Base &amp; Coverage Map
          </h2>
          <span className="text-xs text-slate-500">
            {provider.serviceLocation.area ? `${provider.serviceLocation.area}, ` : ''}
            {provider.serviceLocation.city} · Coverage within {provider.serviceLocation.radiusKm} km
          </span>
        </div>
        <TechnicianDiscoveryMap
          providers={[provider]}
          center={{
            lat: provider.serviceLocation.lat,
            lng: provider.serviceLocation.lng,
          }}
          selectedProviderId={provider._id}
          heightClass="h-[260px] sm:h-[320px]"
        />
      </div>

      {/* Customer Reviews */}
      <div className="bg-white border border-slate-200 rounded-xl p-6">
        <h2 className="font-display text-lg font-bold text-navy-900 mb-4">
          Verified Customer Reviews ({reviews.length})
        </h2>
        {reviews.length === 0 ? (
          <p className="text-sm text-slate-500">No reviews yet. Be the first customer to rate after completion.</p>
        ) : (
          <div className="divide-y divide-slate-100">
            {reviews.map((r) => (
              <div key={r._id} className="py-4">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold text-navy-900">{r.customerId?.name || 'Verified Customer'}</p>
                  <span className="text-xs font-mono text-amber-600 font-semibold tabular-nums">
                    {r.rating.toFixed(1)} ★
                  </span>
                </div>
                <p className="text-sm text-slate-700 mt-1.5">{r.comment}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
