import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Search,
  ArrowRight,
  ShieldCheck,
  Sparkles,
  CheckCircle2,
  Star,
  MapPin,
} from 'lucide-react';
import { api } from '../lib/api';
import type { ProviderProfile, ServiceCategory } from '../types';
import { CategoryIcon } from '../components/CategoryIcon';
import { useAuth } from '../context/AuthContext';

const HERO_IMG = '/src/assets/images/hero_home_repair_1794547807127.jpg';
const TOOLS_IMG = '/src/assets/images/service_electrical_hvac_1794547807687.jpg';
const PLUMBING_IMG = '/src/assets/images/service_plumbing_kitchen_1794547807689.jpg';
const PRO_ARJUN_IMG = '/src/assets/images/avatar_technician_arjun_1794547808471.jpg';
const PRO_PRIYA_IMG = '/src/assets/images/avatar_technician_priya_1794547809247.jpg';

const FALLBACK_CATEGORIES: Array<Omit<ServiceCategory, '_id' | 'isActive' | 'sortOrder'>> = [
  { name: 'Electrician', slug: 'electrician', description: 'Wiring, MCB panels, smart switches, inverter setup.', iconName: 'Zap', basePriceRange: '₹299 – ₹1,499' },
  { name: 'Plumbing', slug: 'plumbing', description: 'Leak repairs, concealed piping, bathroom fittings.', iconName: 'Droplets', basePriceRange: '₹249 – ₹1,299' },
  { name: 'AC Repair & Maintenance', slug: 'ac-repair', description: 'Split/window AC servicing, gas check, PCB repair.', iconName: 'Wind', basePriceRange: '₹499 – ₹2,499' },
  { name: 'Refrigerator Repair', slug: 'refrigerator-repair', description: 'Compressor diagnostics, cooling & defrost issues.', iconName: 'ThermometerSnowflake', basePriceRange: '₹399 – ₹1,999' },
  { name: 'Washing Machine Repair', slug: 'washing-machine-repair', description: 'Front & top-load drum, drain pump, control board.', iconName: 'RefreshCw', basePriceRange: '₹399 – ₹1,899' },
  { name: 'Carpenter', slug: 'carpenter', description: 'Cabinetry, door locks, hinge alignment, assembly.', iconName: 'Hammer', basePriceRange: '₹349 – ₹1,999' },
  { name: 'Painting', slug: 'painting', description: 'Interior/exterior painting & waterproofing coats.', iconName: 'Paintbrush', basePriceRange: '₹1,499 – ₹8,999' },
  { name: 'Cleaning', slug: 'cleaning', description: 'Deep home sanitization, kitchen & bathroom care.', iconName: 'Sparkles', basePriceRange: '₹599 – ₹3,499' },
  { name: 'Appliance Repair', slug: 'appliance-repair', description: 'Microwave, RO purifier, chimney & geyser service.', iconName: 'Wrench', basePriceRange: '₹349 – ₹1,799' },
  { name: 'Pest Control', slug: 'pest-control', description: 'Termite barrier, gel treatment & sanitization.', iconName: 'ShieldCheck', basePriceRange: '₹799 – ₹2,999' },
];

export function LandingPage() {
  const navigate = useNavigate();
  const { health } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');
  const [cityQuery, setCityQuery] = useState('');
  const [categories, setCategories] = useState<Array<Partial<ServiceCategory>>>(FALLBACK_CATEGORIES);
  const [featuredProviders, setFeaturedProviders] = useState<ProviderProfile[]>([]);

  useEffect(() => {
    api
      .get<{ categories: ServiceCategory[] }>('/categories')
      .then((res) => {
        if (res.data.categories?.length) setCategories(res.data.categories);
      })
      .catch(() => {});

    api
      .get<{ providers: ProviderProfile[] }>('/providers?limit=4&sort=rating')
      .then((res) => {
        if (res.data.providers?.length) setFeaturedProviders(res.data.providers);
      })
      .catch(() => {});
  }, []);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const params = new URLSearchParams();
    if (searchQuery.trim()) params.set('q', searchQuery.trim());
    if (cityQuery.trim()) params.set('city', cityQuery.trim());
    navigate(`/explore?${params.toString()}`);
  };

  return (
    <div className="bg-slate-50">
      {health && !health.dbConnected && (
        <div className="bg-amber-50 border-b border-amber-200 px-6 py-2.5 text-center text-xs text-amber-900">
          {health.integrations.mongodbConfigured ? (
            <span>
              MongoDB Atlas connection issue: {health.dbError || 'Unable to reach cluster.'}{' '}
              (Ensure <span className="font-mono font-semibold">0.0.0.0/0</span> is allowed in Atlas Network Access.)
            </span>
          ) : (
            <span>
              MongoDB Atlas is not connected yet. Add <span className="font-mono font-semibold">MONGODB_URI</span> in Settings &gt; Secrets to enable live accounts, bookings, and provider listings.
            </span>
          )}
        </div>
      )}

      {/* Hero Section */}
      <section className="bg-navy-900 text-white">
        <div className="max-w-7xl mx-auto px-6 py-16 lg:py-20 grid grid-cols-1 lg:grid-cols-12 gap-10 items-stretch">
          <div className="lg:col-span-7 flex flex-col justify-center">
            <p className="text-sm font-medium text-blue-300 mb-3">
              Verified Local Home Services · Transparent Quotations
            </p>
            <h1
              className="font-display font-bold tracking-tight text-white leading-[1.12] max-w-2xl"
              style={{ fontSize: 'clamp(2.25rem, 4vw, 3.5rem)', textWrap: 'balance' }}
            >
              Find. Fix. Feel Better — reliable home repairs without guesswork.
            </h1>
            <p className="text-slate-300 text-base mt-5 max-w-xl leading-relaxed">
              Describe your issue to our Gemini AI assistant, match with background-verified
              local technicians near you, approve itemized quotations before work begins, and pay securely.
            </p>

            {/* Search Bar */}
            <form
              onSubmit={handleSearch}
              className="mt-8 bg-white rounded-xl p-2 flex flex-col sm:flex-row gap-2 max-w-2xl shadow-lg"
            >
              <div className="flex-1 flex items-center gap-2 px-3">
                <Search className="w-4 h-4 text-slate-400 shrink-0" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="What needs fixing? (e.g., AC not cooling, MCB tripping)"
                  className="w-full py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none"
                />
              </div>
              <div className="sm:w-44 flex items-center gap-2 px-3 sm:border-l border-slate-200">
                <MapPin className="w-4 h-4 text-slate-400 shrink-0" />
                <input
                  type="text"
                  value={cityQuery}
                  onChange={(e) => setCityQuery(e.target.value)}
                  placeholder="City (e.g. Bengaluru)"
                  className="w-full py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none"
                />
              </div>
              <button
                type="submit"
                className="px-5 py-2.5 bg-accent-500 hover:bg-accent-600 text-white text-sm font-semibold rounded-lg transition-colors whitespace-nowrap shrink-0"
              >
                Find Specialists
              </button>
            </form>

            <div className="mt-5 flex flex-wrap items-center gap-6 text-sm">
              <Link
                to="/ai-assistant"
                className="inline-flex items-center gap-2 text-blue-300 hover:text-white font-medium transition-colors"
              >
                <Sparkles className="w-4 h-4" />
                Diagnose with AI Repair Assistant
                <ArrowRight className="w-4 h-4" />
              </Link>
              <Link
                to="/register"
                className="text-slate-300 hover:text-white font-medium transition-colors"
              >
                Join as a Service Professional
              </Link>
            </div>
          </div>

          <div className="lg:col-span-5">
            <div className="h-72 lg:h-full min-h-[340px] rounded-2xl overflow-hidden bg-navy-800 border border-navy-800 relative">
              <img
                src={HERO_IMG}
                alt="Verified FixMate technician calibrating a residential split AC unit"
                referrerPolicy="no-referrer"
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-navy-950/75 via-transparent to-transparent" />
              <div className="absolute bottom-4 left-4 right-4 text-white">
                <p className="text-sm font-semibold">Standardized Inspection & Upfront Quotes</p>
                <p className="text-xs text-slate-200 mt-0.5">
                  No paid work begins until you review and approve the itemized quotation.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Full-width Value & Guarantee Strip */}
      <section className="bg-white border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-6 py-6 grid grid-cols-2 lg:grid-cols-4 gap-6">
          <div>
            <p className="font-mono text-lg font-bold text-navy-900 tabular-nums">10 Categories</p>
            <p className="text-xs text-slate-500 mt-0.5">Electrical, HVAC, Plumbing & Appliances</p>
          </div>
          <div>
            <p className="font-mono text-lg font-bold text-navy-900 tabular-nums">Zero Double-Booking</p>
            <p className="text-xs text-slate-500 mt-0.5">Atomic slot locking on confirmed dates</p>
          </div>
          <div>
            <p className="font-mono text-lg font-bold text-navy-900 tabular-nums">100% Quote Approval</p>
            <p className="text-xs text-slate-500 mt-0.5">Customer approves itemized costs first</p>
          </div>
          <div>
            <p className="font-mono text-lg font-bold text-navy-900 tabular-nums">Razorpay Verified</p>
            <p className="text-xs text-slate-500 mt-0.5">Backend cryptographic signature checks</p>
          </div>
        </div>
      </section>

      {/* Popular Service Categories */}
      <section className="max-w-7xl mx-auto px-6 py-16">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-8">
          <div>
            <h2 className="font-display text-2xl sm:text-3xl font-bold text-navy-900">
              Popular Service Categories
            </h2>
            <p className="text-sm text-slate-600 mt-1">
              Select a trade to browse verified specialists and open time slots near you.
            </p>
          </div>
          <Link
            to="/explore"
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-electric-600 hover:underline whitespace-nowrap"
          >
            Browse All Services <ArrowRight className="w-4 h-4" />
          </Link>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          {categories.map((cat) => (
            <Link
              key={cat.slug}
              to={`/explore?category=${cat.slug}`}
              className="group bg-white border border-slate-200 rounded-xl p-5 hover:border-electric-500 hover:shadow-sm transition-all flex flex-col justify-between"
            >
              <div>
                <div className="w-10 h-10 rounded-lg bg-slate-100 text-navy-900 flex items-center justify-center group-hover:bg-electric-600 group-hover:text-white transition-colors">
                  <CategoryIcon name={cat.iconName || 'Wrench'} />
                </div>
                <h3 className="font-display font-semibold text-base text-navy-900 mt-4">
                  {cat.name}
                </h3>
                <p className="text-xs text-slate-600 mt-1.5 line-clamp-2 leading-relaxed">
                  {cat.description}
                </p>
              </div>
              <p className="font-mono text-xs font-medium text-slate-500 mt-4 tabular-nums">
                {cat.basePriceRange}
              </p>
            </Link>
          ))}
        </div>
      </section>

      {/* How It Works */}
      <section className="bg-white border-y border-slate-200">
        <div className="max-w-7xl mx-auto px-6 py-16">
          <div className="max-w-xl mb-10">
            <h2 className="font-display text-2xl sm:text-3xl font-bold text-navy-900">
              How FixMate Works
            </h2>
            <p className="text-sm text-slate-600 mt-1.5">
              A structured workflow built around transparency from initial triage to final sign-off.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            {[
              {
                num: '01.',
                title: 'Describe or Scan the Issue',
                body: 'Explain the fault in plain language or upload a photo. Our AI assistant suggests likely categories and safe preliminary steps.',
              },
              {
                num: '02.',
                title: 'Pick a Verified Specialist',
                body: 'Compare local professionals by verified status, experience, customer ratings, starting prices, and live time slots.',
              },
              {
                num: '03.',
                title: 'Approve the Itemized Quote',
                body: 'Receive a clear breakdown of inspection, labour, and material charges. Paid work only starts after your explicit approval.',
              },
              {
                num: '04.',
                title: 'Track & Pay Securely',
                body: 'Follow real-time job updates, message your technician directly, and complete verified Razorpay checkout.',
              },
            ].map((step) => (
              <div key={step.num} className="pt-2 border-t border-slate-200">
                <p className="font-mono text-sm font-semibold text-electric-600">{step.num}</p>
                <h3 className="font-display font-semibold text-lg text-navy-900 mt-2">
                  {step.title}
                </h3>
                <p className="text-sm text-slate-600 mt-2 leading-relaxed">{step.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* AI Repair Assistant Spotlight + Craftsmanship */}
      <section className="max-w-7xl mx-auto px-6 py-16">
        <div className="bg-navy-900 text-white rounded-2xl overflow-hidden grid grid-cols-1 lg:grid-cols-12 items-stretch">
          <div className="lg:col-span-7 p-8 lg:p-12 flex flex-col justify-center">
            <p className="text-xs font-medium text-blue-300">Powered by Google Gemini</p>
            <h2
              className="font-display text-2xl sm:text-3xl font-bold mt-2 max-w-lg"
              style={{ textWrap: 'balance' }}
            >
              Unsure what is wrong? Get a structured AI triage before booking.
            </h2>
            <p className="text-slate-300 text-sm mt-4 max-w-xl leading-relaxed">
              Upload a photo of a tripping breaker panel, leaking under-sink pipe, or error code on
              your washing machine. FixMate generates a structured job summary for technicians
              while advising safe precautions without risky DIY instructions.
            </p>
            <div className="mt-6 flex flex-wrap gap-4">
              <Link
                to="/ai-assistant"
                className="px-5 py-2.5 bg-accent-500 hover:bg-accent-600 text-white text-sm font-semibold rounded-lg transition-colors whitespace-nowrap"
              >
                Open AI Repair Assistant
              </Link>
              <Link
                to="/explore"
                className="px-5 py-2.5 border border-slate-500 hover:border-white text-white text-sm font-medium rounded-lg transition-colors whitespace-nowrap"
              >
                Browse Technicians
              </Link>
            </div>
          </div>

          <div className="lg:col-span-5 grid grid-cols-2 gap-1 bg-navy-950">
            <img
              src={TOOLS_IMG}
              alt="Precision electrical multimeter and HVAC gauges"
              referrerPolicy="no-referrer"
              className="w-full h-56 lg:h-full object-cover"
            />
            <img
              src={PLUMBING_IMG}
              alt="Clean modern residential kitchen plumbing installation"
              referrerPolicy="no-referrer"
              className="w-full h-56 lg:h-full object-cover"
            />
          </div>
        </div>
      </section>

      {/* Verified Professionals Showcase */}
      <section className="bg-white border-t border-slate-200">
        <div className="max-w-7xl mx-auto px-6 py-16">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-8">
            <div>
              <h2 className="font-display text-2xl sm:text-3xl font-bold text-navy-900">
                Verified Service Professionals
              </h2>
              <p className="text-sm text-slate-600 mt-1">
                Every provider profile displays verified credentials, experience, and real customer ratings.
              </p>
            </div>
            <Link
              to="/explore"
              className="text-sm font-semibold text-electric-600 hover:underline whitespace-nowrap"
            >
              View Directory
            </Link>
          </div>

          {featuredProviders.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
              {featuredProviders.map((pro) => (
                <Link
                  key={pro._id}
                  to={`/professionals/${pro._id}`}
                  className="bg-slate-50 border border-slate-200 rounded-xl p-5 hover:border-electric-500 transition-colors flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-center gap-3">
                      <img
                        src={pro.avatarUrl || PRO_ARJUN_IMG}
                        alt={pro.businessName}
                        referrerPolicy="no-referrer"
                        className="w-12 h-12 rounded-full object-cover bg-slate-200 shrink-0"
                      />
                      <div className="min-w-0">
                        <h3 className="font-display font-semibold text-sm text-navy-900 truncate">
                          {pro.businessName}
                        </h3>
                        <p className="text-xs text-slate-500 truncate">
                          {pro.serviceLocation.city} · {pro.experienceYears} yrs exp
                        </p>
                      </div>
                    </div>
                    <p className="text-xs text-slate-600 mt-3 line-clamp-2">{pro.bio || 'Local home repair specialist.'}</p>
                  </div>
                  <div className="mt-4 pt-3 border-t border-slate-200 flex items-center justify-between text-xs">
                    <span className="font-mono font-semibold text-navy-900 tabular-nums">
                      From ₹{pro.startingPrice}
                    </span>
                    <span className="inline-flex items-center gap-1 text-slate-700 font-medium tabular-nums">
                      <Star className="w-3.5 h-3.5 text-amber-500 fill-amber-500" />
                      {pro.ratingAverage.toFixed(1)} ({pro.ratingCount})
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="border border-slate-200 rounded-xl p-6 flex items-center gap-5 bg-slate-50">
                <img
                  src={PRO_ARJUN_IMG}
                  alt="Master Electrical and HVAC Specialist"
                  referrerPolicy="no-referrer"
                  className="w-20 h-20 rounded-xl object-cover shrink-0"
                />
                <div>
                  <div className="flex items-center gap-2 text-xs text-blue-700 font-medium">
                    <ShieldCheck className="w-4 h-4" />
                    <span>Identity & Trade Verified</span>
                  </div>
                  <h3 className="font-display font-semibold text-lg text-navy-900 mt-1">
                    Electrical & Inverter HVAC Specialists
                  </h3>
                  <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                    Register as a technician or connect MongoDB Atlas to view live verified professionals in your city.
                  </p>
                </div>
              </div>

              <div className="border border-slate-200 rounded-xl p-6 flex items-center gap-5 bg-slate-50">
                <img
                  src={PRO_PRIYA_IMG}
                  alt="Smart Home and Appliance Specialist"
                  referrerPolicy="no-referrer"
                  className="w-20 h-20 rounded-xl object-cover shrink-0"
                />
                <div>
                  <div className="flex items-center gap-2 text-xs text-blue-700 font-medium">
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Itemized Quotes Before Repair</span>
                  </div>
                  <h3 className="font-display font-semibold text-lg text-navy-900 mt-1">
                    Major Home Appliance & Plumbing Pros
                  </h3>
                  <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                    Front-load washers, frost-free refrigerators, RO purifiers, and concealed plumbing repairs.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* Customer Testimonials */}
      <section className="max-w-7xl mx-auto px-6 py-16">
        <h2 className="font-display text-2xl sm:text-3xl font-bold text-navy-900 mb-8">
          Homeowner Outcomes
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[
            {
              quote:
                'Before FixMate, AC technicians quoted arbitrary gas refill charges on arrival. Here I uploaded a photo of our iced evaporator coil, approved an itemized ₹1,650 cleaning and drain flush quote upfront, and cooling returned within 90 minutes.',
              author: 'Meera Deshmukh',
              role: 'Homeowner, Indiranagar, Bengaluru',
            },
            {
              quote:
                'Our main MCB kept tripping every evening. The AI assistant flagged an overloaded kitchen appliance circuit as a possible cause without giving unsafe DIY wiring advice, and our verified electrician traced a melted geyser socket the next morning.',
              author: 'Karthik Nair',
              role: 'Apartment Association Secretary, Kochi',
            },
            {
              quote:
                'Managing three rental flats used to mean endless phone calls. FixMate keeps every quotation, inspection photo, and Razorpay receipt tied to the booking code so maintenance records stay effortless.',
              author: 'Ananya Chatterjee',
              role: 'Property Manager, Salt Lake, Kolkata',
            },
          ].map((t) => (
            <div key={t.author} className="bg-white border border-slate-200 rounded-xl p-6 flex flex-col justify-between">
              <p className="text-sm text-slate-700 leading-relaxed">“{t.quote}”</p>
              <div className="mt-5 pt-4 border-t border-slate-100">
                <p className="text-sm font-semibold text-navy-900">{t.author}</p>
                <p className="text-xs text-slate-500 mt-0.5">{t.role}</p>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
