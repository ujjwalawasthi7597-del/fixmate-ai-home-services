import React, { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Navigation } from 'lucide-react';
import { api, extractApiError } from '../lib/api';
import { requestBrowserLocation } from '../lib/geolocation';
import { useAuth } from '../context/AuthContext';
import type { ProviderProfile, User, UserRole } from '../types';

const CATEGORY_OPTIONS = [
  { slug: 'electrician', name: 'Electrician' },
  { slug: 'plumbing', name: 'Plumbing' },
  { slug: 'ac-repair', name: 'AC Repair & Maintenance' },
  { slug: 'refrigerator-repair', name: 'Refrigerator Repair' },
  { slug: 'washing-machine-repair', name: 'Washing Machine Repair' },
  { slug: 'carpenter', name: 'Carpenter' },
  { slug: 'painting', name: 'Painting' },
  { slug: 'cleaning', name: 'Cleaning' },
  { slug: 'appliance-repair', name: 'Appliance Repair' },
  { slug: 'pest-control', name: 'Pest Control' },
];

export function AuthPage({ mode }: { mode: 'login' | 'register' }) {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { setSession, health } = useAuth();

  const initialRole = (searchParams.get('role') as UserRole) || 'customer';
  const [role, setRole] = useState<UserRole>(initialRole);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');

  // Provider onboarding fields
  const [businessName, setBusinessName] = useState('');
  const [selectedCategories, setSelectedCategories] = useState<string[]>(['electrician']);
  const [city, setCity] = useState('Bengaluru');
  const [area, setArea] = useState('');
  const [lat, setLat] = useState('12.9716');
  const [lng, setLng] = useState('77.5946');
  const [gpsLoading, setGpsLoading] = useState(false);
  const [experienceYears, setExperienceYears] = useState('3');
  const [startingPrice, setStartingPrice] = useState('399');

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const toggleCategory = (slug: string) => {
    setSelectedCategories((prev) =>
      prev.includes(slug) ? (prev.length > 1 ? prev.filter((c) => c !== slug) : prev) : [...prev, slug]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      if (mode === 'login') {
        const { data } = await api.post<{
          token: string;
          user: User;
          providerProfile: ProviderProfile | null;
        }>('/auth/login', { email, password });

        setSession(data.token, data.user, data.providerProfile);
        if (data.user.role === 'admin') navigate('/dashboard/admin');
        else if (data.user.role === 'provider') navigate('/dashboard/provider');
        else navigate('/dashboard/customer');
      } else {
        const { data } = await api.post<{
          token: string;
          user: User;
          providerProfile: ProviderProfile | null;
        }>('/auth/register', {
          name,
          email,
          phone,
          password,
          role,
          ...(role === 'provider' && {
            businessName: businessName || `${name} Home Services`,
            categories: selectedCategories,
            city,
            area,
            lat: Number(lat),
            lng: Number(lng),
            experienceYears: Number(experienceYears) || 1,
            startingPrice: Number(startingPrice) || 299,
          }),
        });

        setSession(data.token, data.user, data.providerProfile);
        if (data.user.role === 'admin') navigate('/dashboard/admin');
        else if (data.user.role === 'provider') navigate('/dashboard/provider');
        else navigate('/dashboard/customer');
      }
    } catch (err) {
      setError(extractApiError(err, 'Authentication failed.'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-[calc(100vh-140px)] flex items-center justify-center px-6 py-12 bg-slate-50">
      <div className="w-full max-w-lg bg-white border border-slate-200 rounded-2xl p-8">
        <div className="mb-6">
          <h1 className="font-display text-2xl font-bold text-navy-900">
            {mode === 'login' ? 'Sign in to FixMate' : 'Create your FixMate account'}
          </h1>
          <p className="text-sm text-slate-600 mt-1">
            {mode === 'login'
              ? 'Access your bookings, quotations, or service dashboard.'
              : 'Join as a homeowner, verified service professional, or platform administrator.'}
          </p>
        </div>

        {health && !health.dbConnected && (
          <div className="mb-5 p-3.5 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-900">
            {health.integrations.mongodbConfigured ? (
              <span>
                MongoDB Atlas connection error: {health.dbError || 'Cluster unreachable.'} Ensure{' '}
                <span className="font-mono font-semibold">0.0.0.0/0</span> is whitelisted in MongoDB Atlas Network Access.
              </span>
            ) : (
              <span>
                MongoDB is not connected yet. Configure <span className="font-mono font-semibold">MONGODB_URI</span> in
                Settings &gt; Secrets before creating or signing into accounts.
              </span>
            )}
          </div>
        )}

        {mode === 'register' && (
          <div className="grid grid-cols-3 gap-1 p-1 bg-slate-100 rounded-xl mb-6">
            {(['customer', 'provider', 'admin'] as const).map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => setRole(r)}
                className={`py-2 text-xs font-semibold rounded-lg capitalize transition-colors ${
                  role === r ? 'bg-white text-navy-900 shadow-sm' : 'text-slate-600 hover:text-navy-900'
                }`}
              >
                {r === 'provider' ? 'Service Pro' : r}
              </button>
            ))}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {mode === 'register' && (
            <>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Full Name</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Rohan Sharma"
                  className="w-full px-3.5 py-2.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-electric-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Phone Number</label>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+91 98765 43210"
                  className="w-full px-3.5 py-2.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-electric-500"
                />
              </div>
            </>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Email Address</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="name@example.com"
              className="w-full px-3.5 py-2.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-electric-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Password {mode === 'register' && <span className="font-normal text-slate-500">(min 8 characters)</span>}
            </label>
            <input
              type="password"
              required
              minLength={mode === 'register' ? 8 : 1}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full px-3.5 py-2.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-electric-500"
            />
          </div>

          {mode === 'register' && role === 'provider' && (
            <div className="pt-3 border-t border-slate-200 space-y-4">
              <p className="text-xs font-semibold text-navy-900">Service Professional Details</p>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Business / Trade Name</label>
                <input
                  type="text"
                  required
                  value={businessName}
                  onChange={(e) => setBusinessName(e.target.value)}
                  placeholder="Sharma Electrical & HVAC Care"
                  className="w-full px-3.5 py-2.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-electric-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Select Service Categories
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {CATEGORY_OPTIONS.map((c) => {
                    const selected = selectedCategories.includes(c.slug);
                    return (
                      <button
                        key={c.slug}
                        type="button"
                        onClick={() => toggleCategory(c.slug)}
                        className={`px-2.5 py-1 text-xs rounded-md border transition-colors ${
                          selected
                            ? 'bg-navy-900 text-white border-navy-900'
                            : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
                        }`}
                      >
                        {c.name}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
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
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Locality / Area</label>
                  <input
                    type="text"
                    value={area}
                    onChange={(e) => setArea(e.target.value)}
                    placeholder="Indiranagar"
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Experience (Yrs)</label>
                  <input
                    type="number"
                    min={0}
                    value={experienceYears}
                    onChange={(e) => setExperienceYears(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Starting Fee (₹)</label>
                  <input
                    type="number"
                    min={99}
                    value={startingPrice}
                    onChange={(e) => setStartingPrice(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Latitude</label>
                  <input
                    type="number"
                    step="any"
                    value={lat}
                    onChange={(e) => setLat(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Longitude</label>
                  <input
                    type="number"
                    step="any"
                    value={lng}
                    onChange={(e) => setLng(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg font-mono"
                  />
                </div>
              </div>

              <button
                type="button"
                disabled={gpsLoading}
                onClick={async () => {
                  setGpsLoading(true);
                  setError(null);
                  try {
                    const coords = await requestBrowserLocation();
                    setLat(String(coords.lat));
                    setLng(String(coords.lng));
                  } catch (geoErr) {
                    setError(geoErr instanceof Error ? geoErr.message : 'Unable to detect GPS coordinates.');
                  } finally {
                    setGpsLoading(false);
                  }
                }}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-electric-600 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-lg transition-colors"
              >
                <Navigation className="w-3.5 h-3.5" />
                {gpsLoading ? 'Detecting GPS...' : 'Use My Current GPS Location'}
              </button>
            </div>
          )}

          {mode === 'register' && role === 'admin' && (
            <p className="text-xs text-slate-500">
              First-time admin registration is enabled only when no administrator account exists in the database.
            </p>
          )}

          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-800">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="w-full py-3 px-4 bg-navy-900 hover:bg-navy-800 disabled:opacity-60 text-white text-sm font-semibold rounded-xl transition-colors"
          >
            {submitting ? 'Please wait...' : mode === 'login' ? 'Sign In' : 'Create Account'}
          </button>
        </form>

        <p className="text-xs text-slate-600 text-center mt-6">
          {mode === 'login' ? (
            <>
              New to FixMate?{' '}
              <Link to="/register" className="text-electric-600 font-semibold hover:underline">
                Create an account
              </Link>
            </>
          ) : (
            <>
              Already have an account?{' '}
              <Link to="/login" className="text-electric-600 font-semibold hover:underline">
                Sign in
              </Link>
            </>
          )}
        </p>
      </div>
    </div>
  );
}
