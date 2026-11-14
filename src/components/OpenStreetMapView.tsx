import { useEffect, useMemo, useRef } from 'react';
import { Link } from 'react-router-dom';
import L from 'leaflet';
import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  Circle,
  useMap,
  useMapEvents,
} from 'react-leaflet';
import { Clock, MapPin, Navigation, ShieldCheck, Star } from 'lucide-react';
import type { ProviderProfile } from '../types';

const OSM_TILE_URL = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
const OSM_ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';

const CATEGORY_LABELS: Record<string, string> = {
  electrician: 'Electrician',
  plumbing: 'Plumbing',
  'ac-repair': 'AC Repair & Maintenance',
  'refrigerator-repair': 'Refrigerator Repair',
  'washing-machine-repair': 'Washing Machine Repair',
  carpenter: 'Carpenter',
  painting: 'Painting',
  cleaning: 'Cleaning',
  'appliance-repair': 'Appliance Repair',
  'pest-control': 'Pest Control',
};

export function formatCategoryName(slug: string): string {
  return (
    CATEGORY_LABELS[slug] ||
    slug
      .split('-')
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(' ')
  );
}

export function calculateHaversineKm(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function createTechnicianIcon(selected: boolean): L.DivIcon {
  const bg = selected ? '#F97316' : '#0B1F3A';
  const ring = selected ? '#EA580C' : '#2563EB';
  const size = selected ? 34 : 28;

  return L.divIcon({
    className: 'fixmate-tech-pin',
    html: `<div style="width:${size}px;height:${size}px;display:flex;align-items:center;justify-content:center;filter:drop-shadow(0 3px 6px rgba(11,31,58,0.35));">
      <svg width="${size}" height="${size}" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M16 2C10.477 2 6 6.477 6 12C6 19.5 16 30 16 30C16 30 26 19.5 26 12C26 6.477 21.523 2 16 2Z" fill="${bg}" stroke="${ring}" stroke-width="2"/>
        <circle cx="16" cy="12" r="4.2" fill="#FFFFFF"/>
      </svg>
    </div>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size],
    popupAnchor: [0, -size + 4],
  });
}

const CUSTOMER_LOCATION_ICON = L.divIcon({
  className: 'fixmate-customer-pin',
  html: `<div style="width:22px;height:22px;border-radius:9999px;background:#2563EB;border:3px solid #FFFFFF;box-shadow:0 2px 8px rgba(37,99,235,0.45);"></div>`,
  iconSize: [22, 22],
  iconAnchor: [11, 11],
  popupAnchor: [0, -12],
});

function hasValidCoords(lat: unknown, lng: unknown): boolean {
  return (
    typeof lat === 'number' &&
    typeof lng === 'number' &&
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    lat >= -90 &&
    lat <= 90 &&
    lng >= -180 &&
    lng <= 180
  );
}

function MapViewportController({
  providers,
  center,
  customerLocation,
  selectedProviderId,
}: {
  providers: ProviderProfile[];
  center: { lat: number; lng: number };
  customerLocation?: { lat: number; lng: number } | null;
  selectedProviderId?: string;
}) {
  const map = useMap();
  const prevFitKeyRef = useRef<string>('');

  // Keep Leaflet tiles aligned across responsive mobile/desktop resizes
  useEffect(() => {
    const container = map.getContainer();
    const timer = window.setTimeout(() => map.invalidateSize({ animate: false }), 120);
    if (typeof ResizeObserver === 'undefined') {
      return () => window.clearTimeout(timer);
    }
    const ro = new ResizeObserver(() => {
      map.invalidateSize({ animate: false });
    });
    ro.observe(container);
    return () => {
      window.clearTimeout(timer);
      ro.disconnect();
    };
  }, [map]);

  // Fit bounds when provider set or customer GPS location changes
  useEffect(() => {
    const points: Array<[number, number]> = [];
    if (customerLocation && hasValidCoords(customerLocation.lat, customerLocation.lng)) {
      points.push([customerLocation.lat, customerLocation.lng]);
    }
    for (const p of providers) {
      if (hasValidCoords(p.serviceLocation?.lat, p.serviceLocation?.lng)) {
        points.push([p.serviceLocation.lat, p.serviceLocation.lng]);
      }
    }

    const fitKey = `${customerLocation ? `${customerLocation.lat.toFixed(4)},${customerLocation.lng.toFixed(4)}` : 'none'}|${providers
      .map((p) => p._id)
      .join(',')}`;

    if (fitKey === prevFitKeyRef.current) return;
    prevFitKeyRef.current = fitKey;

    if (points.length >= 2) {
      const bounds = L.latLngBounds(points);
      map.fitBounds(bounds, { padding: [36, 36], maxZoom: 14, animate: true });
    } else if (points.length === 1) {
      map.setView(points[0], 13, { animate: true });
    } else if (hasValidCoords(center.lat, center.lng)) {
      map.setView([center.lat, center.lng], 12, { animate: true });
    }
  }, [map, providers, customerLocation, center.lat, center.lng]);

  // Gently pan to selected provider when selected from list
  useEffect(() => {
    if (!selectedProviderId) return;
    const match = providers.find((p) => p._id === selectedProviderId);
    if (match && hasValidCoords(match.serviceLocation?.lat, match.serviceLocation?.lng)) {
      map.panTo([match.serviceLocation.lat, match.serviceLocation.lng], { animate: true });
    }
  }, [map, selectedProviderId, providers]);

  return null;
}

export function TechnicianDiscoveryMap({
  providers,
  center,
  customerLocation,
  radiusKm,
  selectedProviderId,
  onSelectProvider,
  heightClass = 'h-[300px] sm:h-[380px] lg:h-[440px]',
}: {
  providers: ProviderProfile[];
  center: { lat: number; lng: number };
  customerLocation?: { lat: number; lng: number } | null;
  radiusKm?: number;
  selectedProviderId?: string;
  onSelectProvider?: (p: ProviderProfile) => void;
  heightClass?: string;
}) {
  const defaultIcon = useMemo(() => createTechnicianIcon(false), []);
  const selectedIcon = useMemo(() => createTechnicianIcon(true), []);

  const mappableProviders = useMemo(
    () =>
      providers.filter((p) =>
        hasValidCoords(p.serviceLocation?.lat, p.serviceLocation?.lng)
      ),
    [providers]
  );

  const initialCenter: [number, number] =
    customerLocation && hasValidCoords(customerLocation.lat, customerLocation.lng)
      ? [customerLocation.lat, customerLocation.lng]
      : hasValidCoords(center.lat, center.lng)
      ? [center.lat, center.lng]
      : [12.9716, 77.5946];

  return (
    <div className="space-y-2">
      <div
        className={`${heightClass} w-full rounded-xl overflow-hidden border border-slate-200 bg-slate-100 relative z-0`}
      >
        <MapContainer
          center={initialCenter}
          zoom={12}
          scrollWheelZoom={true}
          attributionControl={true}
          className="w-full h-full"
        >
          <TileLayer url={OSM_TILE_URL} attribution={OSM_ATTRIBUTION} />

          <MapViewportController
            providers={mappableProviders}
            center={center}
            customerLocation={customerLocation}
            selectedProviderId={selectedProviderId}
          />

          {customerLocation && hasValidCoords(customerLocation.lat, customerLocation.lng) && (
            <>
              <Marker
                position={[customerLocation.lat, customerLocation.lng]}
                icon={CUSTOMER_LOCATION_ICON}
              >
                <Popup maxWidth={220}>
                  <div className="text-slate-900 space-y-1">
                    <p className="font-display font-bold text-xs text-electric-600">
                      Your Location
                    </p>
                    <p className="font-mono text-[11px] text-slate-600 tabular-nums">
                      {customerLocation.lat.toFixed(4)}, {customerLocation.lng.toFixed(4)}
                    </p>
                  </div>
                </Popup>
              </Marker>
              {radiusKm && radiusKm > 0 && (
                <Circle
                  center={[customerLocation.lat, customerLocation.lng]}
                  radius={radiusKm * 1000}
                  pathOptions={{
                    color: '#2563EB',
                    fillColor: '#3B82F6',
                    fillOpacity: 0.08,
                    weight: 1.5,
                  }}
                />
              )}
            </>
          )}

          {mappableProviders.map((provider) => {
            const isSelected = provider._id === selectedProviderId;
            const categoryText =
              provider.categories?.map(formatCategoryName).join(' · ') || 'Home Repair';
            const hoursText = `${provider.workingHours?.start || '09:00'} – ${
              provider.workingHours?.end || '19:00'
            }`;
            const daysText = provider.workingHours?.days?.length
              ? provider.workingHours.days.join(', ')
              : 'Mon–Sat';

            const computedDistance =
              provider.distanceKm !== null && provider.distanceKm !== undefined
                ? provider.distanceKm
                : customerLocation &&
                  hasValidCoords(customerLocation.lat, customerLocation.lng)
                ? Number(
                    calculateHaversineKm(
                      customerLocation.lat,
                      customerLocation.lng,
                      provider.serviceLocation.lat,
                      provider.serviceLocation.lng
                    ).toFixed(1)
                  )
                : null;

            return (
              <Marker
                key={provider._id}
                position={[provider.serviceLocation.lat, provider.serviceLocation.lng]}
                icon={isSelected ? selectedIcon : defaultIcon}
                eventHandlers={{
                  click: () => onSelectProvider?.(provider),
                }}
              >
                <Popup maxWidth={260}>
                  <div className="text-slate-900 space-y-1.5 min-w-[205px]">
                    <div className="flex items-start justify-between gap-2">
                      <p className="font-display font-bold text-sm text-navy-900 leading-snug">
                        {provider.businessName}
                      </p>
                      {provider.verificationStatus === 'verified' && (
                        <ShieldCheck
                          className="w-4 h-4 text-electric-600 shrink-0 mt-0.5"
                          aria-label="Verified technician"
                        />
                      )}
                    </div>

                    <p className="text-xs font-medium text-electric-600">{categoryText}</p>

                    <div className="text-[11px] text-slate-600 space-y-1 pt-1 border-t border-slate-100">
                      <p className="flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span>
                          Available: <span className="font-mono">{hoursText}</span> ({daysText})
                        </span>
                      </p>
                      <p className="flex items-center gap-1.5">
                        <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span>
                          {provider.serviceLocation.area ? `${provider.serviceLocation.area}, ` : ''}
                          {provider.serviceLocation.city}
                          {computedDistance !== null ? (
                            <span className="font-mono font-semibold text-navy-900">
                              {' '}
                              · {computedDistance} km away
                            </span>
                          ) : null}
                        </span>
                      </p>
                    </div>

                    <div className="flex items-center justify-between pt-1.5 text-xs">
                      <span className="font-mono font-semibold text-navy-900 tabular-nums">
                        {provider.pricingMode === 'quotation'
                          ? 'Quote-Based'
                          : `From ₹${provider.startingPrice}`}
                      </span>
                      <span className="inline-flex items-center gap-1 text-slate-700 font-mono tabular-nums">
                        <Star className="w-3 h-3 text-amber-500 fill-amber-500" />
                        {provider.ratingAverage.toFixed(1)}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 pt-2">
                      <Link
                        to={`/professionals/${provider._id}`}
                        className="flex-1 text-center py-1.5 px-2 text-[11px] font-semibold border border-slate-300 text-navy-900 rounded-md hover:bg-slate-50"
                      >
                        View Profile
                      </Link>
                      <Link
                        to={`/book/${provider._id}`}
                        className="flex-1 text-center py-1.5 px-2 text-[11px] font-semibold bg-accent-500 text-white rounded-md hover:bg-accent-600"
                      >
                        Book Now
                      </Link>
                    </div>
                  </div>
                </Popup>
              </Marker>
            );
          })}
        </MapContainer>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-500">
        <div className="flex flex-wrap items-center gap-3">
          <span>Dark pin: Technician</span>
          {customerLocation && <span>Blue dot: Your GPS location</span>}
        </div>
        <span>
          Tiles &amp; data{' '}
          <a
            href="https://www.openstreetmap.org/copyright"
            target="_blank"
            rel="noopener noreferrer"
            className="underline hover:text-slate-700"
          >
            © OpenStreetMap contributors
          </a>
        </span>
      </div>
    </div>
  );
}

function PickerEvents({
  lat,
  lng,
  onChange,
}: {
  lat: number;
  lng: number;
  onChange: (nextLat: number, nextLng: number) => void;
}) {
  const map = useMap();

  useEffect(() => {
    const timer = window.setTimeout(() => map.invalidateSize({ animate: false }), 120);
    return () => window.clearTimeout(timer);
  }, [map]);

  useEffect(() => {
    if (hasValidCoords(lat, lng)) {
      map.panTo([lat, lng], { animate: true });
    }
  }, [map, lat, lng]);

  useMapEvents({
    click(e) {
      onChange(Number(e.latlng.lat.toFixed(6)), Number(e.latlng.lng.toFixed(6)));
    },
  });

  return null;
}

export function CoordinatePickerMap({
  lat,
  lng,
  onChange,
  onDetectGps,
  gpsLoading = false,
  heightClass = 'h-56',
}: {
  lat: number;
  lng: number;
  onChange: (nextLat: number, nextLng: number) => void;
  onDetectGps?: () => void;
  gpsLoading?: boolean;
  heightClass?: string;
}) {
  const pinIcon = useMemo(() => createTechnicianIcon(true), []);
  const safeLat = hasValidCoords(lat, lng) ? lat : 12.9716;
  const safeLng = hasValidCoords(lat, lng) ? lng : 77.5946;

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-xs text-slate-600">
          Click anywhere on the map to pin your exact coordinates
        </span>
        {onDetectGps && (
          <button
            type="button"
            onClick={onDetectGps}
            disabled={gpsLoading}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-electric-600 border border-blue-200 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors whitespace-nowrap"
          >
            <Navigation className="w-3.5 h-3.5" />
            {gpsLoading ? 'Detecting GPS...' : 'Use My Current Location'}
          </button>
        )}
      </div>

      <div
        className={`${heightClass} w-full rounded-xl overflow-hidden border border-slate-200 bg-slate-100 relative z-0`}
      >
        <MapContainer
          center={[safeLat, safeLng]}
          zoom={13}
          scrollWheelZoom={true}
          attributionControl={true}
          className="w-full h-full"
        >
          <TileLayer url={OSM_TILE_URL} attribution={OSM_ATTRIBUTION} />
          <PickerEvents lat={safeLat} lng={safeLng} onChange={onChange} />
          <Marker position={[safeLat, safeLng]} icon={pinIcon}>
            <Popup>
              <span className="font-mono text-xs tabular-nums">
                {safeLat.toFixed(5)}, {safeLng.toFixed(5)}
              </span>
            </Popup>
          </Marker>
        </MapContainer>
      </div>
    </div>
  );
}
