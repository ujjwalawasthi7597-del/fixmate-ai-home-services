import React, { useEffect, useState, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Calendar,
  CreditCard,
  MapPin,
  Bookmark,
  Star,
  User as UserIcon,
  LayoutDashboard,
  AlertCircle,
  MessageSquare,
} from 'lucide-react';
import { api, extractApiError } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import type { Address, Booking, PaymentRecord, ProviderProfile, ReviewItem } from '../types';
import { StatusText } from '../components/StatusText';

type CustomerTab = 'overview' | 'bookings' | 'saved' | 'addresses' | 'payments' | 'profile';

declare global {
  interface Window {
    Razorpay?: new (options: Record<string, unknown>) => { open: () => void };
  }
}

export function CustomerDashboard() {
  const { user, refreshUser, socket } = useAuth();
  const navigate = useNavigate();
  const [tab, setTab] = useState<CustomerTab>('overview');
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [payments, setPayments] = useState<PaymentRecord[]>([]);
  const [reviews, setReviews] = useState<ReviewItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [banner, setBanner] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  // Review modal state
  const [reviewBookingId, setReviewBookingId] = useState<string | null>(null);
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');

  // Complaint modal state
  const [complaintBookingId, setComplaintBookingId] = useState<string | null>(null);
  const [complaintSubject, setComplaintSubject] = useState('');
  const [complaintDesc, setComplaintDesc] = useState('');

  // New Address form
  const [addrForm, setAddrForm] = useState({ label: 'Home', line1: '', city: '', state: '', postalCode: '' });
  // Profile form
  const [profileName, setProfileName] = useState(user?.name || '');
  const [profilePhone, setProfilePhone] = useState(user?.phone || '');

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [bRes, aRes, pRes, rRes] = await Promise.all([
        api.get<{ bookings: Booking[] }>('/bookings'),
        api.get<{ addresses: Address[] }>('/addresses'),
        api.get<{ payments: PaymentRecord[] }>('/payments'),
        api.get<{ reviews: ReviewItem[] }>('/reviews'),
      ]);
      setBookings(bRes.data.bookings || []);
      setAddresses(aRes.data.addresses || []);
      setPayments(pRes.data.payments || []);
      setReviews(rRes.data.reviews || []);
    } catch (err) {
      setBanner({ type: 'err', text: extractApiError(err) });
    } finally {
      setLoading(false);
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

  const handleQuotationDecision = async (bookingId: string, decision: 'Approved' | 'Rejected') => {
    try {
      await api.patch(`/bookings/${bookingId}/quotation/decision`, { decision });
      setBanner({
        type: 'ok',
        text: decision === 'Approved' ? 'Quotation approved. Booking is now Confirmed.' : 'Quotation declined.',
      });
      await loadData();
    } catch (err) {
      setBanner({ type: 'err', text: extractApiError(err) });
    }
  };

  const handleCancelBooking = async (bookingId: string) => {
    try {
      await api.patch(`/bookings/${bookingId}/status`, {
        status: 'Cancelled',
        cancellationReason: 'Cancelled by customer',
      });
      setBanner({ type: 'ok', text: 'Booking cancelled and time slot released.' });
      await loadData();
    } catch (err) {
      setBanner({ type: 'err', text: extractApiError(err) });
    }
  };

  const handlePayNow = async (booking: Booking) => {
    try {
      const { data } = await api.post<{
        orderId: string;
        amount: number;
        currency: string;
        keyId: string;
        bookingCode: string;
      }>('/payments/create-order', { bookingId: booking._id });

      if (!window.Razorpay) {
        setBanner({ type: 'err', text: 'Razorpay checkout script is still loading. Please retry in a moment.' });
        return;
      }

      const rzp = new window.Razorpay({
        key: data.keyId,
        amount: data.amount,
        currency: data.currency,
        name: 'FixMate',
        description: `Service Payment · ${data.bookingCode}`,
        order_id: data.orderId,
        prefill: {
          name: user?.name,
          email: user?.email,
          contact: user?.phone,
        },
        handler: async (response: {
          razorpay_order_id: string;
          razorpay_payment_id: string;
          razorpay_signature: string;
        }) => {
          try {
            await api.post('/payments/verify', response);
            setBanner({ type: 'ok', text: `Payment verified for ${data.bookingCode}.` });
            await loadData();
          } catch (verifyErr) {
            setBanner({ type: 'err', text: extractApiError(verifyErr) });
          }
        },
        theme: { color: '#0B1F3A' },
      });
      rzp.open();
    } catch (err) {
      setBanner({ type: 'err', text: extractApiError(err) });
    }
  };

  const handleSubmitReview = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reviewBookingId) return;
    try {
      await api.post('/reviews', { bookingId: reviewBookingId, rating, comment });
      setReviewBookingId(null);
      setComment('');
      setBanner({ type: 'ok', text: 'Thank you! Your review has been published.' });
      await loadData();
    } catch (err) {
      setBanner({ type: 'err', text: extractApiError(err) });
    }
  };

  const handleSubmitComplaint = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.post('/admin/complaints', {
        bookingId: complaintBookingId,
        subject: complaintSubject,
        description: complaintDesc,
      });
      setComplaintBookingId(null);
      setComplaintSubject('');
      setComplaintDesc('');
      setBanner({ type: 'ok', text: 'Support ticket submitted to FixMate resolution team.' });
    } catch (err) {
      setBanner({ type: 'err', text: extractApiError(err) });
    }
  };

  const handleAddAddress = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.post('/addresses', addrForm);
      setAddrForm({ label: 'Home', line1: '', city: '', state: '', postalCode: '' });
      await loadData();
    } catch (err) {
      setBanner({ type: 'err', text: extractApiError(err) });
    }
  };

  const handleDeleteAddress = async (id: string) => {
    await api.delete(`/addresses/${id}`);
    await loadData();
  };

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.patch('/auth/me', { name: profileName, phone: profilePhone });
      await refreshUser();
      setBanner({ type: 'ok', text: 'Profile updated.' });
    } catch (err) {
      setBanner({ type: 'err', text: extractApiError(err) });
    }
  };

  const openChatWithProvider = async (booking: Booking) => {
    const recipientId = typeof booking.providerId === 'string' ? booking.providerId : booking.providerId._id;
    const { data } = await api.post<{ conversation: { _id: string } }>('/conversations', {
      recipientId,
      bookingId: booking._id,
    });
    navigate(`/messages?conversationId=${data.conversation._id}`);
  };

  const activeBookings = bookings.filter((b) =>
    ['Pending', 'Accepted', 'Quotation Sent', 'Awaiting Approval', 'Confirmed', 'In Progress'].includes(b.status)
  );
  const pendingQuotes = bookings.filter((b) => b.quotation?.status === 'Pending Approval');
  const completedBookings = bookings.filter((b) => b.status === 'Completed');
  const savedPros = (user?.savedProviders || []).filter((p): p is ProviderProfile => typeof p !== 'string');

  const navItems: Array<{ id: CustomerTab; label: string; icon: React.ReactNode }> = [
    { id: 'overview', label: 'Overview', icon: <LayoutDashboard className="w-4 h-4" /> },
    { id: 'bookings', label: 'My Bookings', icon: <Calendar className="w-4 h-4" /> },
    { id: 'saved', label: 'Saved Pros', icon: <Bookmark className="w-4 h-4" /> },
    { id: 'addresses', label: 'Addresses', icon: <MapPin className="w-4 h-4" /> },
    { id: 'payments', label: 'Transactions', icon: <CreditCard className="w-4 h-4" /> },
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
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="font-display text-2xl font-bold text-navy-900">
              Welcome back, {user?.name}
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">Customer Service Workspace</p>
          </div>
          <Link
            to="/explore"
            className="px-4 py-2.5 bg-accent-500 hover:bg-accent-600 text-white text-xs font-semibold rounded-lg whitespace-nowrap self-start"
          >
            + Book New Service
          </Link>
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
            <button type="button" onClick={() => setBanner(null)} className="underline font-medium">
              Dismiss
            </button>
          </div>
        )}

        {tab === 'overview' && (
          <>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {[
                { label: 'Total Bookings', value: bookings.length },
                { label: 'Active Bookings', value: activeBookings.length },
                { label: 'Pending Quotations', value: pendingQuotes.length },
                { label: 'Completed Services', value: completedBookings.length },
              ].map((stat) => (
                <div key={stat.label} className="bg-white border border-slate-200 rounded-xl p-5">
                  <p className="text-xs text-slate-500">{stat.label}</p>
                  <p className="font-mono text-2xl font-bold text-navy-900 mt-1 tabular-nums">{stat.value}</p>
                </div>
              ))}
            </div>

            <div className="bg-white border border-slate-200 rounded-xl p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-display text-lg font-bold text-navy-900">Upcoming & Active Appointments</h2>
                <button
                  type="button"
                  onClick={() => setTab('bookings')}
                  className="text-xs font-semibold text-electric-600 hover:underline"
                >
                  View All
                </button>
              </div>
              {loading ? (
                <div className="h-24 bg-slate-100 rounded-lg animate-pulse" />
              ) : activeBookings.length === 0 ? (
                <p className="text-sm text-slate-500 py-4">
                  No active appointments right now. Explore verified pros or run an AI diagnosis to start a booking.
                </p>
              ) : (
                <div className="divide-y divide-slate-100">
                  {activeBookings.slice(0, 5).map((b) => (
                    <div key={b._id} className="py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-navy-900">
                          {b.problemTitle}{' '}
                          <span className="font-mono text-xs text-slate-400 font-normal">({b.bookingCode})</span>
                        </p>
                        <p className="text-xs text-slate-500 mt-0.5 font-mono tabular-nums">
                          {b.scheduledDate} · {b.timeSlot} ·{' '}
                          {typeof b.providerProfileId === 'object' ? b.providerProfileId.businessName : ''}
                        </p>
                      </div>
                      <StatusText status={b.status} />
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-white border border-slate-200 rounded-xl p-6">
                <h2 className="font-display text-base font-bold text-navy-900 mb-3">Recent Transactions</h2>
                {payments.length === 0 ? (
                  <p className="text-xs text-slate-500">No transactions recorded yet.</p>
                ) : (
                  <div className="divide-y divide-slate-100">
                    {payments.slice(0, 4).map((p) => (
                      <div key={p._id} className="py-2.5 flex items-center justify-between text-xs">
                        <span className="font-mono text-slate-700">{p.razorpayOrderId}</span>
                        <span className="font-mono font-semibold text-navy-900 tabular-nums">₹{p.amount}</span>
                        <StatusText status={p.status} />
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="bg-white border border-slate-200 rounded-xl p-6">
                <h2 className="font-display text-base font-bold text-navy-900 mb-3">Your Recent Reviews</h2>
                {reviews.length === 0 ? (
                  <p className="text-xs text-slate-500">Reviews appear here after you rate a completed job.</p>
                ) : (
                  <div className="divide-y divide-slate-100">
                    {reviews.slice(0, 4).map((r) => (
                      <div key={r._id} className="py-2.5 text-xs">
                        <div className="flex justify-between font-semibold text-navy-900">
                          <span>{r.providerProfileId?.businessName || 'Specialist'}</span>
                          <span className="font-mono text-amber-600">{r.rating} ★</span>
                        </div>
                        <p className="text-slate-600 mt-0.5 line-clamp-2">{r.comment}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </>
        )}

        {tab === 'bookings' && (
          <div className="space-y-4">
            {bookings.length === 0 ? (
              <div className="bg-white border border-slate-200 rounded-xl p-10 text-center">
                <p className="font-semibold text-navy-900">No bookings yet</p>
                <p className="text-sm text-slate-500 mt-1">Find a verified technician to submit your first request.</p>
              </div>
            ) : (
              bookings.map((b) => {
                const proName =
                  typeof b.providerProfileId === 'object' ? b.providerProfileId.businessName : 'Technician';
                return (
                  <div key={b._id} className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
                    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                      <div>
                        <p className="font-mono text-xs text-slate-500">
                          {b.bookingCode} · {b.categorySlug}
                        </p>
                        <h3 className="font-display text-lg font-bold text-navy-900 mt-0.5">{b.problemTitle}</h3>
                        <p className="text-xs text-slate-600 mt-1">
                          Provider: <span className="font-semibold">{proName}</span> · {b.scheduledDate} at{' '}
                          <span className="font-mono">{b.timeSlot}</span>
                        </p>
                      </div>
                      <div className="flex flex-col sm:items-end gap-1">
                        <StatusText status={b.status} />
                        <span className="text-xs font-mono text-slate-500">Payment: {b.paymentStatus}</span>
                      </div>
                    </div>

                    <p className="text-sm text-slate-700">{b.problemDescription}</p>

                    {b.quotation && (
                      <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
                        <div className="flex items-center justify-between">
                          <p className="text-xs font-bold text-navy-900">
                            Itemized Quotation ({b.quotation.status})
                          </p>
                          <p className="font-mono text-base font-bold text-navy-900 tabular-nums">
                            Total: ₹{b.quotation.totalEstimatedAmount}
                          </p>
                        </div>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                          <div>
                            <span className="text-slate-500">Inspection:</span>{' '}
                            <span className="font-mono tabular-nums">₹{b.quotation.inspectionCharges}</span>
                          </div>
                          <div>
                            <span className="text-slate-500">Labour:</span>{' '}
                            <span className="font-mono tabular-nums">₹{b.quotation.labourCharges}</span>
                          </div>
                          <div>
                            <span className="text-slate-500">Materials:</span>{' '}
                            <span className="font-mono tabular-nums">₹{b.quotation.estimatedMaterialCosts}</span>
                          </div>
                          <div>
                            <span className="text-slate-500">Est. Time:</span>{' '}
                            <span className="font-mono">{b.quotation.expectedCompletionTime}</span>
                          </div>
                        </div>
                        <p className="text-xs text-slate-600">{b.quotation.workDescription}</p>

                        {b.quotation.status === 'Pending Approval' && (
                          <div className="flex flex-wrap gap-2 pt-1">
                            <button
                              type="button"
                              onClick={() => void handleQuotationDecision(b._id, 'Approved')}
                              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-lg"
                            >
                              Approve Quotation & Confirm
                            </button>
                            <button
                              type="button"
                              onClick={() => void handleQuotationDecision(b._id, 'Rejected')}
                              className="px-4 py-2 border border-rose-300 text-rose-700 hover:bg-rose-50 text-xs font-semibold rounded-lg"
                            >
                              Reject Quotation
                            </button>
                          </div>
                        )}
                      </div>
                    )}

                    <div className="pt-3 border-t border-slate-100 flex flex-wrap items-center gap-3">
                      <button
                        type="button"
                        onClick={() => void openChatWithProvider(b)}
                        className="px-3 py-1.5 text-xs font-semibold border border-slate-300 rounded-lg hover:bg-slate-50 inline-flex items-center gap-1.5"
                      >
                        <MessageSquare className="w-3.5 h-3.5" />
                        Message Pro
                      </button>

                      {b.quotation?.status === 'Approved' && b.paymentStatus === 'Unpaid' && (
                        <button
                          type="button"
                          onClick={() => void handlePayNow(b)}
                          className="px-4 py-1.5 text-xs font-semibold bg-accent-500 hover:bg-accent-600 text-white rounded-lg"
                        >
                          Pay ₹{b.quotation.totalEstimatedAmount} via Razorpay
                        </button>
                      )}

                      {b.status === 'Completed' && (
                        <button
                          type="button"
                          onClick={() => setReviewBookingId(b._id)}
                          className="px-3.5 py-1.5 text-xs font-semibold bg-navy-900 text-white rounded-lg inline-flex items-center gap-1"
                        >
                          <Star className="w-3.5 h-3.5" />
                          Leave Review
                        </button>
                      )}

                      {['Pending', 'Accepted', 'Awaiting Approval'].includes(b.status) && (
                        <button
                          type="button"
                          onClick={() => void handleCancelBooking(b._id)}
                          className="px-3 py-1.5 text-xs font-medium text-rose-700 hover:underline"
                        >
                          Cancel Booking
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={() => setComplaintBookingId(b._id)}
                        className="ml-auto text-xs text-slate-500 hover:text-navy-900 inline-flex items-center gap-1"
                      >
                        <AlertCircle className="w-3.5 h-3.5" />
                        Report Issue
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}

        {tab === 'saved' && (
          <div className="bg-white border border-slate-200 rounded-xl p-6">
            <h2 className="font-display text-lg font-bold text-navy-900 mb-4">Saved Professionals</h2>
            {savedPros.length === 0 ? (
              <p className="text-sm text-slate-500">You haven&apos;t saved any professionals yet.</p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {savedPros.map((p) => (
                  <Link
                    key={p._id}
                    to={`/professionals/${p._id}`}
                    className="p-4 border border-slate-200 rounded-xl hover:border-electric-500 transition-colors"
                  >
                    <p className="font-semibold text-navy-900">{p.businessName}</p>
                    <p className="text-xs text-slate-500 mt-1">
                      {p.serviceLocation?.city} · {p.ratingAverage?.toFixed(1)} ★
                    </p>
                  </Link>
                ))}
              </div>
            )}
          </div>
        )}

        {tab === 'addresses' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <form onSubmit={handleAddAddress} className="lg:col-span-5 bg-white border border-slate-200 rounded-xl p-6 space-y-3">
              <h2 className="font-display text-base font-bold text-navy-900">Add New Address</h2>
              <input
                type="text"
                required
                placeholder="Label (Home, Parents Flat)"
                value={addrForm.label}
                onChange={(e) => setAddrForm({ ...addrForm, label: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
              />
              <input
                type="text"
                required
                placeholder="Street / Apartment"
                value={addrForm.line1}
                onChange={(e) => setAddrForm({ ...addrForm, line1: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
              />
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="text"
                  required
                  placeholder="City"
                  value={addrForm.city}
                  onChange={(e) => setAddrForm({ ...addrForm, city: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                />
                <input
                  type="text"
                  required
                  placeholder="State"
                  value={addrForm.state}
                  onChange={(e) => setAddrForm({ ...addrForm, state: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                />
              </div>
              <input
                type="text"
                required
                placeholder="Postal / PIN Code"
                value={addrForm.postalCode}
                onChange={(e) => setAddrForm({ ...addrForm, postalCode: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg font-mono"
              />
              <button type="submit" className="w-full py-2.5 bg-navy-900 text-white text-xs font-semibold rounded-lg">
                Save Address
              </button>
            </form>

            <div className="lg:col-span-7 bg-white border border-slate-200 rounded-xl p-6">
              <h2 className="font-display text-base font-bold text-navy-900 mb-4">Saved Addresses</h2>
              {addresses.length === 0 ? (
                <p className="text-sm text-slate-500">No addresses saved yet.</p>
              ) : (
                <div className="divide-y divide-slate-100">
                  {addresses.map((a) => (
                    <div key={a._id} className="py-3 flex items-center justify-between gap-4">
                      <div>
                        <p className="text-sm font-semibold text-navy-900">{a.label}</p>
                        <p className="text-xs text-slate-600">
                          {a.line1}, {a.city}, {a.state} {a.postalCode}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => void handleDeleteAddress(a._id)}
                        className="text-xs text-rose-600 hover:underline"
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {tab === 'payments' && (
          <div className="bg-white border border-slate-200 rounded-xl p-6 overflow-x-auto">
            <h2 className="font-display text-lg font-bold text-navy-900 mb-4">Payment History</h2>
            {payments.length === 0 ? (
              <p className="text-sm text-slate-500">No payments recorded yet.</p>
            ) : (
              <table className="w-full text-left text-xs">
                <thead className="border-b border-slate-200 text-slate-500">
                  <tr>
                    <th className="py-2.5 pr-4">Order ID</th>
                    <th className="py-2.5 pr-4">Booking</th>
                    <th className="py-2.5 pr-4 text-right">Amount</th>
                    <th className="py-2.5 pr-4">Status</th>
                    <th className="py-2.5">Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {payments.map((p) => (
                    <tr key={p._id} className="h-10">
                      <td className="pr-4 font-mono">{p.razorpayOrderId}</td>
                      <td className="pr-4">
                        {typeof p.bookingId === 'object' ? p.bookingId.bookingCode : p.bookingId}
                      </td>
                      <td className="pr-4 text-right font-mono font-semibold tabular-nums">₹{p.amount}</td>
                      <td className="pr-4">
                        <StatusText status={p.status} />
                      </td>
                      <td className="font-mono text-slate-500">
                        {new Date(p.createdAt).toLocaleDateString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        {tab === 'profile' && (
          <form onSubmit={handleUpdateProfile} className="bg-white border border-slate-200 rounded-xl p-6 max-w-lg space-y-4">
            <h2 className="font-display text-lg font-bold text-navy-900">Account Settings</h2>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Full Name</label>
              <input
                type="text"
                value={profileName}
                onChange={(e) => setProfileName(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Phone</label>
              <input
                type="text"
                value={profilePhone}
                onChange={(e) => setProfilePhone(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Email</label>
              <input
                type="email"
                disabled
                value={user?.email || ''}
                className="w-full px-3 py-2 text-sm border border-slate-200 bg-slate-50 rounded-lg text-slate-500"
              />
            </div>
            <button type="submit" className="px-5 py-2.5 bg-navy-900 text-white text-xs font-semibold rounded-lg">
              Save Changes
            </button>
          </form>
        )}

        {/* Review Modal */}
        {reviewBookingId && (
          <div className="fixed inset-0 z-50 bg-navy-950/50 flex items-center justify-center p-4">
            <form onSubmit={handleSubmitReview} className="bg-white rounded-2xl p-6 max-w-md w-full space-y-4">
              <h3 className="font-display text-lg font-bold text-navy-900">Rate Completed Service</h3>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Rating (1–5)</label>
                <select
                  value={rating}
                  onChange={(e) => setRating(Number(e.target.value))}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                >
                  {[5, 4, 3, 2, 1].map((n) => (
                    <option key={n} value={n}>
                      {n} Stars
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Review Comment</label>
                <textarea
                  rows={3}
                  required
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  placeholder="Share punctuality, diagnosis clarity, and workmanship quality..."
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                />
              </div>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setReviewBookingId(null)}
                  className="px-4 py-2 text-xs font-semibold border border-slate-300 rounded-lg"
                >
                  Cancel
                </button>
                <button type="submit" className="px-4 py-2 text-xs font-semibold bg-navy-900 text-white rounded-lg">
                  Submit Review
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Complaint Modal */}
        {complaintBookingId && (
          <div className="fixed inset-0 z-50 bg-navy-950/50 flex items-center justify-center p-4">
            <form onSubmit={handleSubmitComplaint} className="bg-white rounded-2xl p-6 max-w-md w-full space-y-4">
              <h3 className="font-display text-lg font-bold text-navy-900">Report Booking Issue</h3>
              <input
                type="text"
                required
                value={complaintSubject}
                onChange={(e) => setComplaintSubject(e.target.value)}
                placeholder="Subject (e.g., Delayed arrival or billing dispute)"
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
              />
              <textarea
                rows={4}
                required
                value={complaintDesc}
                onChange={(e) => setComplaintDesc(e.target.value)}
                placeholder="Explain what happened so an admin can investigate..."
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
              />
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setComplaintBookingId(null)}
                  className="px-4 py-2 text-xs font-semibold border border-slate-300 rounded-lg"
                >
                  Cancel
                </button>
                <button type="submit" className="px-4 py-2 text-xs font-semibold bg-navy-900 text-white rounded-lg">
                  Submit Ticket
                </button>
              </div>
            </form>
          </div>
        )}
      </main>
    </div>
  );
}
