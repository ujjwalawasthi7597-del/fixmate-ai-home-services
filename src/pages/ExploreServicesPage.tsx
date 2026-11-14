import { useEffect, useState, useCallback } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  Search,
  Star,
  MapPin,
  ShieldCheck,
  SlidersHorizontal,
  Navigation,
  X,
} from 'lucide-react';
import { api, extractApiError } from '../lib/api';
import { requestBrowserLocation } from '../lib/geolocation';
import type { ProviderProfile, ServiceCategory } from '../types';
import {
  TechnicianDiscoveryMap,
  calculateHaversineKm,
  formatCategoryName,
} from '../components/OpenStreetMapView';

const FALLBACK_AVATAR = '/src/assets/images/avatar_technician_arjun_1794547808471.jpg';

export function ExploreServicesPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [categories, setCategories] = useState<ServiceCategory[]>([]);
  const [providers, setProviders] = useState<ProviderProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [q, setQ] = useState(searchParams.get('q') || '');
  const [category, setCategory] = useState(searchParams.get('category') || '');
  const [city, setCity] = useState(searchParams.get('city') || '');
  const [locality, setLocality] = useState(searchParams.get('locality') || '');
  const [verifiedOnly, setVerifiedOnly] = useState(false);
  const [maxPrice, setMaxPrice] = useState('');
  const [maxDistanceKm, setMaxDistanceKm] = useState('');
  const [sort, setSort] = useState('rating');

  const [customerLocation, setCustomerLocation] = useState<{ lat: number; lng: number } | null>(
    null
  );
  const [gpsLoading, setGpsLoading] = useState(false);
  const [gpsError, setGpsError] = useState<string | null>(null);
  const [mapCenter, setMapCenter] = useState<{ lat: number; lng: number }>({
    lat: 12.9716,
    lng: 77.5946,
  });
  const [selectedProviderId, setSelectedProviderId] = useState<string | undefined>();
  const [mobileView, setMobileView] = useState<'all' | 'list' | 'map'>('all');

  useEffect(() => {
    api
      .get<{ categories: ServiceCategory[] }>('/categories')
      .then((res) => setCategories(res.data.categories || []))
      .catch(() => {});
  }, []);

  const fetchProviders = useCallback(
    async (overrideLocation?: { lat: number; lng: number } | null, overrideSort?: string) => {
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams();
        if (q.trim()) params.set('q', q.trim());
        if (category) params.set('category', category);
        if (city.trim()) params.set('city', city.trim());
        if (locality.trim()) params.set('locality', locality.trim());
        if (verifiedOnly) params.set('verifiedOnly', 'true');
        if (maxPrice) params.set('maxPrice', maxPrice);

        const activeLocation = overrideLocation !== undefined ? overrideLocation : customerLocation;
        const activeSort = overrideSort || sort;
        params.set('sort', activeSort);

        if (activeLocation) {
          params.set('lat', String(activeLocation.lat));
          params.set('lng', String(activeLocation.lng));
          if (maxDistanceKm) params.set('maxDistanceKm', maxDistanceKm);
        }

        const { data } = await api.get<{ providers: ProviderProfile[] }>(
          `/providers?${params.toString()}`
        );
        const list = data.providers || [];
        setProviders(list);

        if (activeLocation) {
          setMapCenter(activeLocation);
        } else if (list[0]?.serviceLocation?.lat && list[0]?.serviceLocation?.lng) {
          setMapCenter({
            lat: list[0].serviceLocation.lat,
            lng: list[0].serviceLocation.lng,
          });
        }
      } catch (err) {
        setError(extractApiError(err, 'Unable to load service providers.'));
      } finally {
        setLoading(false);
      }
    },
    [q, category, city, locality, verifiedOnly, maxPrice, maxDistanceKm, sort, customerLocation]
  );

  const [resetCount, setResetCount] = useState(0);

  useEffect(() => {
    void fetchProviders();
  }, [category, verifiedOnly, sort, maxDistanceKm, resetCount]);

  const handleUseMyLocation = async () => {
    setGpsLoading(true);
    setGpsError(null);
    try {
      const coords = await requestBrowserLocation();
      setCustomerLocation(coords);
      setMapCenter(coords);
      setSort('distance');
      await fetchProviders(coords, 'distance');
    } catch (err) {
      setGpsError(err instanceof Error ? err.message : 'Unable to access your location.');
    } finally {
      setGpsLoading(false);
    }
  };

  const handleClearLocation = () => {
    setCustomerLocation(null);
    setMaxDistanceKm('');
    setGpsError(null);
    const nextSort = sort === 'distance' ? 'rating' : sort;
    setSort(nextSort);
    void fetchProviders(null, nextSort);
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const next = new URLSearchParams();
    if (q.trim()) next.set('q', q.trim());
    if (category) next.set('category', category);
    if (city.trim()) next.set('city', city.trim());
    if (locality.trim()) next.set('locality', locality.trim());
    setSearchParams(next);
    void fetchProviders();
  };

  const handleResetFilters = () => {
    setQ('');
    setCategory('');
    setCity('');
    setLocality('');
    setMaxPrice('');
    setMaxDistanceKm('');
    setVerifiedOnly(false);
    setSearchParams(new URLSearchParams());
    setResetCount((c) => c + 1);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 sm:py-10">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-6">
        <div>
          <h1 className="font-display text-2xl sm:text-3xl font-bold text-navy-900">
            Explore Services &amp; Local Professionals
          </h1>
          <p className="text-sm text-slate-600 mt-1">
            Enter your city and locality manually or share GPS location to find nearby verified technicians.
          </p>
        </div>
        <Link
          to="/ai-assistant"
          className="text-sm font-semibold text-electric-600 hover:underline whitespace-nowrap"
        >
          Not sure which category? Try AI Repair Assistant
        </Link>
      </div>

      {/* Filter Bar */}
      <form
        onSubmit={handleSearchSubmit}
        className="bg-white border border-slate-200 rounded-xl p-4 mb-6 space-y-3"
      >
        <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-center">
          <div className="md:col-span-4 relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search skills, name, or repair type..."
              className="w-full pl-9 pr-3 py-2.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-electric-500"
            />
          </div>

          <div className="md:col-span-2">
            <input
              type="text"
              value={city}
              onChange={(e) => setCity(e.target.value)}
              placeholder="City (e.g. Bengaluru)"
              aria-label="City"
              className="w-full px-3 py-2.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-electric-500"
            />
          </div>

          <div className="md:col-span-2">
            <input
              type="text"
              value={locality}
              onChange={(e) => setLocality(e.target.value)}
              placeholder="Locality (e.g. Indiranagar)"
              aria-label="Locality"
              className="w-full px-3 py-2.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-electric-500"
            />
          </div>

          <div className="md:col-span-2">
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value)}
              aria-label="Sort professionals"
              className="w-full px-3 py-2.5 text-sm border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-electric-500"
            >
              <option value="rating">Top Rated</option>
              <option value="distance" disabled={!customerLocation}>
                Nearest First{!customerLocation ? ' (Use GPS)' : ''}
              </option>
              <option value="price_asc">Lowest Price</option>
              <option value="experience">Most Experienced</option>
            </select>
          </div>

          <div className="md:col-span-2">
            <button
              type="submit"
              className="w-full py-2.5 px-4 bg-navy-900 hover:bg-navy-800 text-white text-sm font-semibold rounded-lg transition-colors whitespace-nowrap"
            >
              Apply Filters
            </button>
          </div>
        </div>

        {/* Geolocation & Quick Filters Row */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-100">
          <div className="flex flex-wrap items-center gap-2.5">
            <button
              type="button"
              onClick={() => void handleUseMyLocation()}
              disabled={gpsLoading}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-electric-600 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-lg transition-colors whitespace-nowrap"
            >
              <Navigation className="w-3.5 h-3.5" />
              {gpsLoading ? 'Locating...' : 'Use My Location'}
            </button>

            {customerLocation && (
              <div className="inline-flex items-center gap-2 text-xs text-slate-700">
                <span className="font-mono text-navy-900 tabular-nums">
                  GPS: {customerLocation.lat.toFixed(4)}, {customerLocation.lng.toFixed(4)}
                </span>
                <select
                  value={maxDistanceKm}
                  onChange={(e) => setMaxDistanceKm(e.target.value)}
                  aria-label="Radius filter"
                  className="px-2 py-1 text-xs border border-slate-300 rounded-md bg-white"
                >
                  <option value="">Any distance</option>
                  <option value="5">Within 5 km</option>
                  <option value="10">Within 10 km</option>
                  <option value="25">Within 25 km</option>
                  <option value="50">Within 50 km</option>
                </select>
                <button
                  type="button"
                  onClick={handleClearLocation}
                  className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-navy-900"
                  aria-label="Clear GPS location"
                >
                  <X className="w-3.5 h-3.5" />
                  Clear
                </button>
              </div>
            )}

            {gpsError && <span className="text-xs text-rose-700">{gpsError}</span>}
          </div>

          <div className="flex items-center gap-4 text-xs text-slate-700 shrink-0">
            <label className="inline-flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={verifiedOnly}
                onChange={(e) => setVerifiedOnly(e.target.checked)}
                className="rounded border-slate-300 text-electric-600 focus:ring-electric-500"
              />
              Verified only
            </label>
            <div className="inline-flex items-center gap-1.5">
              <SlidersHorizontal className="w-3.5 h-3.5 text-slate-400" />
              <input
                type="number"
                value={maxPrice}
                onChange={(e) => setMaxPrice(e.target.value)}
                placeholder="Max ₹"
                aria-label="Maximum starting price"
                className="w-24 px-2 py-1 border border-slate-300 rounded-md text-xs font-mono"
              />
            </div>
          </div>
        </div>

        {/* Category Filter Buttons */}
        <div className="flex items-center gap-1.5 overflow-x-auto pt-2 border-t border-slate-100 pb-1">
          <button
            type="button"
            onClick={() => setCategory('')}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg whitespace-nowrap transition-colors ${
              category === ''
                ? 'bg-navy-900 text-white'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            All Categories
          </button>
          {categories.map((c) => (
            <button
              key={c.slug}
              type="button"
              onClick={() => setCategory(c.slug)}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg whitespace-nowrap transition-colors ${
                category === c.slug
                  ? 'bg-navy-900 text-white'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              {c.name}
            </button>
          ))}
        </div>
      </form>

      {/* Mobile View Switcher */}
      <div className="flex lg:hidden items-center justify-between gap-3 mb-4">
        <span className="text-xs font-medium text-slate-600 tabular-nums">
          {providers.length} professionals found
        </span>
        <div className="inline-flex p-1 bg-slate-200/70 rounded-lg">
          {(['all', 'list', 'map'] as const).map((mode) => (
            <button
              key={mode}
              type="button"
              onClick={() => setMobileView(mode)}
              className={`px-3 py-1 text-xs font-semibold rounded-md capitalize transition-colors ${
                mobileView === mode
                  ? 'bg-white text-navy-900 shadow-sm'
                  : 'text-slate-600 hover:text-navy-900'
              }`}
            >
              {mode === 'all' ? 'Split' : mode}
            </button>
          ))}
        </div>
      </div>

      {/* Main Split: Provider Directory + Responsive OpenStreetMap */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <div
          className={`lg:col-span-7 space-y-4 order-2 lg:order-1 ${
            mobileView === 'map' ? 'hidden lg:block' : 'block'
          }`}
        >
          {error && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-5 text-sm text-amber-900">
              {error}
            </div>
          )}

          {loading ? (
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="h-36 bg-white border border-slate-200 rounded-xl animate-pulse"
                />
              ))}
            </div>
          ) : providers.length === 0 ? (
            <div className="bg-white border border-slate-200 rounded-xl p-10 text-center">
              <p className="font-display text-lg font-semibold text-navy-900">
                No matching service professionals found
              </p>
              <p className="text-sm text-slate-600 mt-1 max-w-md mx-auto">
                Try clearing your city, locality, distance, or price filters, or register a new Service Provider account.
              </p>
              <div className="mt-5 flex flex-wrap justify-center gap-3">
                <button
                  type="button"
                  onClick={handleResetFilters}
                  className="px-4 py-2 text-xs font-semibold border border-slate-300 rounded-lg hover:bg-slate-50"
                >
                  Reset Filters
                </button>
                <Link
                  to="/register?role=provider"
                  className="px-4 py-2 text-xs font-semibold bg-navy-900 text-white rounded-lg hover:bg-navy-800"
                >
                  Register as Provider
                </Link>
              </div>
            </div>
          ) : (
            providers.map((pro) => {
              const distanceKm =
                pro.distanceKm !== null && pro.distanceKm !== undefined
                  ? pro.distanceKm
                  : customerLocation &&
                    typeof pro.serviceLocation?.lat === 'number' &&
                    typeof pro.serviceLocation?.lng === 'number'
                  ? Number(
                      calculateHaversineKm(
                        customerLocation.lat,
                        customerLocation.lng,
                        pro.serviceLocation.lat,
                        pro.serviceLocation.lng
                      ).toFixed(1)
                    )
                  : null;

              return (
                <div
                  key={pro._id}
                  onMouseEnter={() => setSelectedProviderId(pro._id)}
                  onClick={() => setSelectedProviderId(pro._id)}
                  className={`bg-white border rounded-xl p-5 transition-all ${
                    selectedProviderId === pro._id
                      ? 'border-electric-500 shadow-sm'
                      : 'border-slate-200'
                  }`}
                >
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                    <div className="flex items-start gap-4">
                      <img
                        src={pro.avatarUrl || FALLBACK_AVATAR}
                        alt={pro.businessName}
                        referrerPolicy="no-referrer"
                        className="w-16 h-16 rounded-xl object-cover bg-slate-100 shrink-0"
                      />
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <h2 className="font-display text-lg font-bold text-navy-900">
                            {pro.businessName}
                          </h2>
                          {pro.verificationStatus === 'verified' && (
                            <span className="inline-flex items-center gap-1 text-xs font-medium text-blue-700">
                              <ShieldCheck className="w-3.5 h-3.5" />
                              Verified
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-slate-500 mt-1">
                          {pro.categories.map(formatCategoryName).join(', ')} · {pro.experienceYears} yrs
                          experience · {pro.completedJobsCount} jobs completed
                        </p>
                        <p className="text-xs text-slate-600 mt-1 flex flex-wrap items-center gap-1">
                          <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <span>
                            {pro.serviceLocation.area ? `${pro.serviceLocation.area}, ` : ''}
                            {pro.serviceLocation.city}
                          </span>
                          {distanceKm !== null ? (
                            <span className="font-mono font-semibold text-electric-600 tabular-nums">
                              · {distanceKm} km away
                            </span>
                          ) : null}
                        </p>
                      </div>
                    </div>

                    <div className="sm:text-right shrink-0">
                      <p className="font-mono text-base font-bold text-navy-900 tabular-nums">
                        {pro.pricingMode === 'quotation'
                          ? 'Quote-Based'
                          : `From ₹${pro.startingPrice}`}
                      </p>
                      <p className="text-xs text-slate-600 mt-1 inline-flex items-center gap-1 tabular-nums">
                        <Star className="w-3.5 h-3.5 text-amber-500 fill-amber-500" />
                        {pro.ratingAverage.toFixed(1)} ({pro.ratingCount} reviews)
                      </p>
                    </div>
                  </div>

                  {pro.bio && (
                    <p className="text-sm text-slate-600 mt-3 line-clamp-2">{pro.bio}</p>
                  )}

                  <div className="mt-4 pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3">
                    <span className="text-xs text-slate-500">
                      Available: {pro.workingHours?.start || '09:00'} –{' '}
                      {pro.workingHours?.end || '19:00'} (
                      {pro.workingHours?.days?.join(', ') || 'Mon–Sat'})
                    </span>
                    <div className="flex items-center gap-3">
                      <Link
                        to={`/professionals/${pro._id}`}
                        className="px-3.5 py-2 text-xs font-semibold text-navy-900 border border-slate-300 rounded-lg hover:bg-slate-50"
                      >
                        View Profile
                      </Link>
                      <Link
                        to={`/book/${pro._id}`}
                        className="px-3.5 py-2 text-xs font-semibold text-white bg-accent-500 hover:bg-accent-600 rounded-lg"
                      >
                        Book Now
                      </Link>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        <div
          className={`lg:col-span-5 lg:sticky lg:top-20 order-1 lg:order-2 ${
            mobileView === 'list' ? 'hidden lg:block' : 'block'
          }`}
        >
          <div className="bg-white border border-slate-200 rounded-xl p-4">
            <div className="flex items-center justify-between gap-2 mb-3">
              <p className="text-sm font-semibold text-navy-900 tabular-nums">
                Service Coverage Map ({providers.length} technicians)
              </p>
              {customerLocation && (
                <span className="text-[11px] font-medium text-electric-600">
                  Sorted by distance
                </span>
              )}
            </div>
            <TechnicianDiscoveryMap
              providers={providers}
              center={mapCenter}
              customerLocation={customerLocation}
              radiusKm={maxDistanceKm ? Number(maxDistanceKm) : undefined}
              selectedProviderId={selectedProviderId}
              onSelectProvider={(p) => setSelectedProviderId(p._id)}
              heightClass={
                mobileView === 'map'
                  ? 'h-[420px] sm:h-[460px]'
                  : 'h-[280px] sm:h-[360px] lg:h-[440px]'
              }
            />
          </div>
        </div>
      </div>
    </div>
  );
}
