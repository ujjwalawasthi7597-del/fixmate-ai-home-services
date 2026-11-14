import React, { useEffect, useState, useCallback } from 'react';
import {
  LayoutDashboard,
  Users,
  ShieldCheck,
  Layers,
  Calendar,
  CreditCard,
  AlertTriangle,
  Star,
} from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts';
import { api, extractApiError } from '../lib/api';
import type { Booking, PaymentRecord, ProviderProfile, ReviewItem, ServiceCategory, User } from '../types';
import { StatusText, VerifiedBadgeText } from '../components/StatusText';

type AdminTab = 'overview' | 'customers' | 'providers' | 'verifications' | 'services' | 'bookings' | 'payments' | 'complaints';

interface AdminAnalytics {
  stats: {
    totalCustomers: number;
    totalProviders: number;
    pendingVerifications: number;
    totalBookings: number;
    activeJobs: number;
    completedJobs: number;
    totalTransactions: number;
    totalRevenue: number;
    openComplaints: number;
  };
  bookingsByCategory: Array<{ _id: string; count: number }>;
  revenueByDay: Array<{ _id: string; revenue: number; count: number }>;
}

interface AdminUserRow extends User {
  _id: string;
  providerProfile?: ProviderProfile | null;
}

interface ComplaintRow {
  _id: string;
  userId?: { name: string; email: string; role: string };
  bookingId?: { bookingCode: string; problemTitle: string };
  subject: string;
  description: string;
  status: 'Open' | 'Investigating' | 'Resolved';
  adminResolution?: string;
}

export function AdminDashboard() {
  const [tab, setTab] = useState<AdminTab>('overview');
  const [analytics, setAnalytics] = useState<AdminAnalytics | null>(null);
  const [users, setUsers] = useState<AdminUserRow[]>([]);
  const [categories, setCategories] = useState<ServiceCategory[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [payments, setPayments] = useState<PaymentRecord[]>([]);
  const [complaints, setComplaints] = useState<ComplaintRow[]>([]);
  const [reviews, setReviews] = useState<ReviewItem[]>([]);
  const [banner, setBanner] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  const [newCat, setNewCat] = useState({ name: '', slug: '', description: '', basePriceRange: '₹299 – ₹1,999' });

  const loadData = useCallback(async () => {
    try {
      const [aRes, uRes, cRes, bRes, pRes, cmpRes, rRes] = await Promise.all([
        api.get<AdminAnalytics>('/admin/analytics'),
        api.get<{ users: AdminUserRow[] }>('/admin/users'),
        api.get<{ categories: ServiceCategory[] }>('/categories/all'),
        api.get<{ bookings: Booking[] }>('/bookings'),
        api.get<{ payments: PaymentRecord[] }>('/payments'),
        api.get<{ complaints: ComplaintRow[] }>('/admin/complaints'),
        api.get<{ reviews: ReviewItem[] }>('/admin/reviews'),
      ]);
      setAnalytics(aRes.data);
      setUsers(uRes.data.users || []);
      setCategories(cRes.data.categories || []);
      setBookings(bRes.data.bookings || []);
      setPayments(pRes.data.payments || []);
      setComplaints(cmpRes.data.complaints || []);
      setReviews(rRes.data.reviews || []);
    } catch (err) {
      setBanner({ type: 'err', text: extractApiError(err) });
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const handleVerifyProvider = async (profileId: string, verificationStatus: 'verified' | 'rejected') => {
    try {
      await api.patch(`/admin/providers/${profileId}/verify`, { verificationStatus });
      setBanner({ type: 'ok', text: `Provider marked as ${verificationStatus}.` });
      await loadData();
    } catch (err) {
      setBanner({ type: 'err', text: extractApiError(err) });
    }
  };

  const handleToggleUserStatus = async (userId: string, isActive: boolean) => {
    try {
      await api.patch(`/admin/users/${userId}/status`, { isActive });
      await loadData();
    } catch (err) {
      setBanner({ type: 'err', text: extractApiError(err) });
    }
  };

  const handleAddCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.post('/categories', newCat);
      setNewCat({ name: '', slug: '', description: '', basePriceRange: '₹299 – ₹1,999' });
      await loadData();
      setBanner({ type: 'ok', text: 'Service category created.' });
    } catch (err) {
      setBanner({ type: 'err', text: extractApiError(err) });
    }
  };

  const handleResolveComplaint = async (id: string, status: 'Investigating' | 'Resolved') => {
    try {
      await api.patch(`/admin/complaints/${id}`, {
        status,
        adminResolution: status === 'Resolved' ? 'Resolved by FixMate Support Administration.' : 'Under review.',
      });
      await loadData();
    } catch (err) {
      setBanner({ type: 'err', text: extractApiError(err) });
    }
  };

  const handleToggleReviewVisibility = async (id: string, isVisible: boolean) => {
    try {
      await api.patch(`/reviews/${id}/moderate`, { isVisible });
      await loadData();
    } catch (err) {
      setBanner({ type: 'err', text: extractApiError(err) });
    }
  };

  const handleRefundPayment = async (paymentId: string) => {
    try {
      await api.post(`/payments/${paymentId}/refund`, { reason: 'Admin processed refund' });
      setBanner({ type: 'ok', text: 'Refund processed via Razorpay.' });
      await loadData();
    } catch (err) {
      setBanner({ type: 'err', text: extractApiError(err) });
    }
  };

  const customers = users.filter((u) => u.role === 'customer');
  const providers = users.filter((u) => u.role === 'provider');
  const pendingVerifications = providers.filter((p) => p.providerProfile?.verificationStatus === 'pending');

  const navItems: Array<{ id: AdminTab; label: string; icon: React.ReactNode }> = [
    { id: 'overview', label: 'Overview', icon: <LayoutDashboard className="w-4 h-4" /> },
    { id: 'verifications', label: 'Verifications', icon: <ShieldCheck className="w-4 h-4" /> },
    { id: 'customers', label: 'Customers', icon: <Users className="w-4 h-4" /> },
    { id: 'providers', label: 'Providers', icon: <Users className="w-4 h-4" /> },
    { id: 'services', label: 'Categories', icon: <Layers className="w-4 h-4" /> },
    { id: 'bookings', label: 'Bookings', icon: <Calendar className="w-4 h-4" /> },
    { id: 'payments', label: 'Payments', icon: <CreditCard className="w-4 h-4" /> },
    { id: 'complaints', label: 'Disputes & Reviews', icon: <AlertTriangle className="w-4 h-4" /> },
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
        <div>
          <h1 className="font-display text-2xl font-bold text-navy-900">FixMate Administration Console</h1>
          <p className="text-xs text-slate-500 mt-0.5">Platform Governance, Verifications & Revenue Analytics</p>
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

        {tab === 'overview' && analytics && (
          <>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {[
                { label: 'Total Customers', value: analytics.stats.totalCustomers },
                { label: 'Service Providers', value: analytics.stats.totalProviders },
                { label: 'Pending Verifications', value: analytics.stats.pendingVerifications },
                { label: 'Total Bookings', value: analytics.stats.totalBookings },
                { label: 'Active Jobs', value: analytics.stats.activeJobs },
                { label: 'Completed Jobs', value: analytics.stats.completedJobs },
                { label: 'Paid Transactions', value: analytics.stats.totalTransactions },
                { label: 'Platform Volume', value: `₹${analytics.stats.totalRevenue}` },
              ].map((m) => (
                <div key={m.label} className="bg-white border border-slate-200 rounded-xl p-4">
                  <p className="text-xs text-slate-500">{m.label}</p>
                  <p className="font-mono text-2xl font-bold text-navy-900 mt-1 tabular-nums">{m.value}</p>
                </div>
              ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="bg-white border border-slate-200 rounded-xl p-6">
                <h2 className="font-display text-base font-bold text-navy-900 mb-4">Platform Revenue Trend (₹)</h2>
                {analytics.revenueByDay.length === 0 ? (
                  <p className="text-sm text-slate-500 py-10 text-center">No paid transactions yet.</p>
                ) : (
                  <div className="h-56">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={analytics.revenueByDay}>
                        <XAxis dataKey="_id" tick={{ fontSize: 11 }} />
                        <YAxis tick={{ fontSize: 11 }} />
                        <Tooltip />
                        <Area type="monotone" dataKey="revenue" stroke="#2563EB" fill="#DBEAFE" />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </div>

              <div className="bg-white border border-slate-200 rounded-xl p-6">
                <h2 className="font-display text-base font-bold text-navy-900 mb-4">Bookings by Category</h2>
                {analytics.bookingsByCategory.length === 0 ? (
                  <p className="text-sm text-slate-500 py-10 text-center">No bookings recorded yet.</p>
                ) : (
                  <div className="h-56">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={analytics.bookingsByCategory}>
                        <XAxis dataKey="_id" tick={{ fontSize: 11 }} />
                        <YAxis tick={{ fontSize: 11 }} />
                        <Tooltip />
                        <Bar dataKey="count" fill="#0B1F3A" radius={[6, 6, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </div>
            </div>
          </>
        )}

        {tab === 'verifications' && (
          <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
            <h2 className="font-display text-lg font-bold text-navy-900">
              Pending Provider Verifications ({pendingVerifications.length})
            </h2>
            {pendingVerifications.length === 0 ? (
              <p className="text-sm text-slate-500">All registered providers have been reviewed.</p>
            ) : (
              <div className="divide-y divide-slate-100">
                {pendingVerifications.map((p) => (
                  <div key={p._id} className="py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                      <p className="font-semibold text-navy-900">{p.providerProfile?.businessName}</p>
                      <p className="text-xs text-slate-600 mt-0.5">
                        {p.name} ({p.email}) · {p.providerProfile?.serviceLocation?.city} ·{' '}
                        {p.providerProfile?.categories?.join(', ')}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => p.providerProfile && void handleVerifyProvider(p.providerProfile._id, 'verified')}
                        className="px-3.5 py-2 bg-emerald-600 text-white text-xs font-semibold rounded-lg"
                      >
                        Verify Pro
                      </button>
                      <button
                        type="button"
                        onClick={() => p.providerProfile && void handleVerifyProvider(p.providerProfile._id, 'rejected')}
                        className="px-3.5 py-2 border border-rose-300 text-rose-700 text-xs font-semibold rounded-lg"
                      >
                        Reject
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {(tab === 'customers' || tab === 'providers') && (
          <div className="bg-white border border-slate-200 rounded-xl p-6 overflow-x-auto">
            <h2 className="font-display text-lg font-bold text-navy-900 mb-4 capitalize">{tab} Directory</h2>
            <table className="w-full text-left text-xs">
              <thead className="border-b border-slate-200 text-slate-500">
                <tr>
                  <th className="py-2.5 pr-4">Name</th>
                  <th className="py-2.5 pr-4">Email</th>
                  {tab === 'providers' && <th className="py-2.5 pr-4">Verification</th>}
                  <th className="py-2.5 pr-4">Account</th>
                  <th className="py-2.5">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {(tab === 'customers' ? customers : providers).map((u) => (
                  <tr key={u._id} className="h-11">
                    <td className="pr-4 font-semibold text-navy-900">
                      {tab === 'providers' ? u.providerProfile?.businessName || u.name : u.name}
                    </td>
                    <td className="pr-4 text-slate-600">{u.email}</td>
                    {tab === 'providers' && (
                      <td className="pr-4">
                        {u.providerProfile && <VerifiedBadgeText status={u.providerProfile.verificationStatus} />}
                      </td>
                    )}
                    <td className="pr-4">{u.isActive !== false ? 'Active' : 'Suspended'}</td>
                    <td>
                      <button
                        type="button"
                        onClick={() => void handleToggleUserStatus(u._id, u.isActive === false)}
                        className="text-electric-600 font-semibold hover:underline"
                      >
                        {u.isActive !== false ? 'Suspend' : 'Activate'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {tab === 'services' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <form onSubmit={handleAddCategory} className="lg:col-span-5 bg-white border border-slate-200 rounded-xl p-6 space-y-3">
              <h2 className="font-display text-base font-bold text-navy-900">Add Service Category</h2>
              <input
                type="text"
                required
                placeholder="Category Name (e.g., Solar Inverter Service)"
                value={newCat.name}
                onChange={(e) => setNewCat({ ...newCat, name: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
              />
              <input
                type="text"
                required
                placeholder="Slug (e.g., solar-inverter)"
                value={newCat.slug}
                onChange={(e) => setNewCat({ ...newCat, slug: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg font-mono"
              />
              <input
                type="text"
                placeholder="Base Price Range (e.g., ₹499 – ₹2,999)"
                value={newCat.basePriceRange}
                onChange={(e) => setNewCat({ ...newCat, basePriceRange: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
              />
              <textarea
                rows={2}
                placeholder="Short category description..."
                value={newCat.description}
                onChange={(e) => setNewCat({ ...newCat, description: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
              />
              <button type="submit" className="w-full py-2.5 bg-navy-900 text-white text-xs font-semibold rounded-lg">
                Create Category
              </button>
            </form>

            <div className="lg:col-span-7 bg-white border border-slate-200 rounded-xl p-6">
              <h2 className="font-display text-base font-bold text-navy-900 mb-4">Active Categories ({categories.length})</h2>
              <div className="divide-y divide-slate-100">
                {categories.map((c) => (
                  <div key={c._id} className="py-3 flex items-center justify-between text-xs">
                    <div>
                      <p className="font-semibold text-navy-900">{c.name}</p>
                      <p className="text-slate-500 font-mono">{c.slug} · {c.basePriceRange}</p>
                    </div>
                    <span className="text-emerald-700 font-medium">{c.isActive ? 'Active' : 'Disabled'}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {tab === 'bookings' && (
          <div className="bg-white border border-slate-200 rounded-xl p-6 overflow-x-auto">
            <h2 className="font-display text-lg font-bold text-navy-900 mb-4">Platform Bookings</h2>
            <table className="w-full text-left text-xs">
              <thead className="border-b border-slate-200 text-slate-500">
                <tr>
                  <th className="py-2.5 pr-4">Code</th>
                  <th className="py-2.5 pr-4">Issue</th>
                  <th className="py-2.5 pr-4">Date & Slot</th>
                  <th className="py-2.5 pr-4">Status</th>
                  <th className="py-2.5">Payment</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {bookings.map((b) => (
                  <tr key={b._id} className="h-11">
                    <td className="pr-4 font-mono font-semibold">{b.bookingCode}</td>
                    <td className="pr-4">{b.problemTitle}</td>
                    <td className="pr-4 font-mono">{b.scheduledDate} · {b.timeSlot}</td>
                    <td className="pr-4"><StatusText status={b.status} /></td>
                    <td className="font-mono">{b.paymentStatus}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {tab === 'payments' && (
          <div className="bg-white border border-slate-200 rounded-xl p-6 overflow-x-auto">
            <h2 className="font-display text-lg font-bold text-navy-900 mb-4">All Transactions</h2>
            <table className="w-full text-left text-xs">
              <thead className="border-b border-slate-200 text-slate-500">
                <tr>
                  <th className="py-2.5 pr-4">Order ID</th>
                  <th className="py-2.5 pr-4 text-right">Amount</th>
                  <th className="py-2.5 pr-4">Status</th>
                  <th className="py-2.5">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {payments.map((p) => (
                  <tr key={p._id} className="h-11">
                    <td className="pr-4 font-mono">{p.razorpayOrderId}</td>
                    <td className="pr-4 text-right font-mono font-semibold tabular-nums">₹{p.amount}</td>
                    <td className="pr-4"><StatusText status={p.status} /></td>
                    <td>
                      {p.status === 'Paid' || p.status === 'Refund Requested' ? (
                        <button
                          type="button"
                          onClick={() => void handleRefundPayment(p._id)}
                          className="text-rose-600 font-semibold hover:underline"
                        >
                          Process Refund
                        </button>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {tab === 'complaints' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white border border-slate-200 rounded-xl p-6">
              <h2 className="font-display text-base font-bold text-navy-900 mb-4">Complaints & Disputes</h2>
              {complaints.length === 0 ? (
                <p className="text-sm text-slate-500">No complaints filed.</p>
              ) : (
                <div className="divide-y divide-slate-100">
                  {complaints.map((c) => (
                    <div key={c._id} className="py-3.5 space-y-1.5">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-semibold text-navy-900">{c.subject}</p>
                        <StatusText status={c.status} />
                      </div>
                      <p className="text-xs text-slate-600">{c.description}</p>
                      {c.status !== 'Resolved' && (
                        <div className="flex gap-2 pt-1">
                          <button
                            type="button"
                            onClick={() => void handleResolveComplaint(c._id, 'Investigating')}
                            className="text-xs text-electric-600 hover:underline"
                          >
                            Mark Investigating
                          </button>
                          <button
                            type="button"
                            onClick={() => void handleResolveComplaint(c._id, 'Resolved')}
                            className="text-xs text-emerald-700 font-semibold hover:underline"
                          >
                            Resolve
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="bg-white border border-slate-200 rounded-xl p-6">
              <h2 className="font-display text-base font-bold text-navy-900 mb-4 inline-flex items-center gap-2">
                <Star className="w-4 h-4 text-amber-500" />
                Review Moderation
              </h2>
              {reviews.length === 0 ? (
                <p className="text-sm text-slate-500">No reviews to moderate.</p>
              ) : (
                <div className="divide-y divide-slate-100">
                  {reviews.map((r) => (
                    <div key={r._id} className="py-3 flex items-start justify-between gap-3 text-xs">
                      <div>
                        <p className="font-semibold text-navy-900">
                          {r.customerId?.name} → {r.providerProfileId?.businessName} ({r.rating}★)
                        </p>
                        <p className="text-slate-600 mt-0.5">{r.comment}</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => void handleToggleReviewVisibility(r._id, !r.isVisible)}
                        className="text-electric-600 font-semibold shrink-0 hover:underline"
                      >
                        {r.isVisible ? 'Hide' : 'Restore'}
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
