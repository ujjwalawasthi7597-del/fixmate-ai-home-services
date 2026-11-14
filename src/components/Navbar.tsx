import { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { Bell, Menu, X, CheckCheck } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export function Navbar() {
  const { user, unreadCount, notifications, markNotificationRead, markAllNotificationsRead, logout } = useAuth();
  const [notifOpen, setNotifOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  const dashboardPath =
    user?.role === 'admin'
      ? '/dashboard/admin'
      : user?.role === 'provider'
      ? '/dashboard/provider'
      : '/dashboard/customer';

  const navLinks =
    user?.role === 'provider'
      ? [
          { to: '/dashboard/provider', label: 'Dashboard' },
          { to: '/explore', label: 'Marketplace' },
          { to: '/messages', label: 'Messages' },
          { to: '/ai-assistant', label: 'AI Assistant' },
        ]
      : user?.role === 'admin'
      ? [
          { to: '/dashboard/admin', label: 'Admin Console' },
          { to: '/explore', label: 'Marketplace' },
          { to: '/messages', label: 'Messages' },
        ]
      : [
          { to: '/', label: 'Home' },
          { to: '/explore', label: 'Explore Services' },
          { to: '/ai-assistant', label: 'AI Assistant' },
          ...(user ? [{ to: '/dashboard/customer', label: 'My Bookings' }, { to: '/messages', label: 'Messages' }] : []),
        ];

  const handleLogout = async () => {
    await logout();
    navigate('/');
  };

  return (
    <header className="sticky top-0 z-40 bg-white/95 backdrop-blur border-b border-slate-200">
      <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between gap-8">
        {/* Zone 1: Single-element clean wordmark */}
        <Link
          to="/"
          className="font-display text-xl font-bold tracking-tight text-navy-900 whitespace-nowrap shrink-0"
        >
          FixMate
        </Link>

        {/* Zone 2: 4–5 concise single-line text links */}
        <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-600">
          {navLinks.map((item) => {
            const active = location.pathname === item.to;
            return (
              <Link
                key={item.to}
                to={item.to}
                className={`whitespace-nowrap shrink-0 py-1 transition-colors ${
                  active
                    ? 'text-navy-900 font-semibold border-b-2 border-electric-600'
                    : 'hover:text-navy-900'
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        {/* Zone 3: Single primary action or authenticated controls */}
        <div className="flex items-center gap-3 shrink-0">
          {user ? (
            <>
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setNotifOpen((o) => !o)}
                  aria-label="Notifications"
                  className="relative p-2 text-slate-600 hover:text-navy-900 rounded-lg hover:bg-slate-100 transition-colors"
                >
                  <Bell className="w-5 h-5" />
                  {unreadCount > 0 && (
                    <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-accent-500 text-white text-[11px] font-mono font-semibold flex items-center justify-center tabular-nums">
                      {unreadCount > 9 ? '9+' : unreadCount}
                    </span>
                  )}
                </button>

                {notifOpen && (
                  <div className="absolute right-0 mt-2 w-80 bg-white border border-slate-200 rounded-xl shadow-lg overflow-hidden z-50">
                    <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
                      <span className="text-sm font-semibold text-navy-900">Notifications</span>
                      {unreadCount > 0 && (
                        <button
                          type="button"
                          onClick={() => void markAllNotificationsRead()}
                          className="text-xs text-electric-600 hover:underline inline-flex items-center gap-1"
                        >
                          <CheckCheck className="w-3.5 h-3.5" />
                          Mark all read
                        </button>
                      )}
                    </div>
                    <div className="max-h-80 overflow-y-auto divide-y divide-slate-100">
                      {notifications.length === 0 ? (
                        <p className="p-4 text-xs text-slate-500">No notifications yet.</p>
                      ) : (
                        notifications.slice(0, 12).map((n) => (
                          <button
                            key={n._id}
                            type="button"
                            onClick={() => {
                              if (!n.isRead) void markNotificationRead(n._id);
                              setNotifOpen(false);
                              navigate(dashboardPath);
                            }}
                            className={`w-full text-left px-4 py-3 hover:bg-slate-50 transition-colors ${
                              n.isRead ? 'bg-white' : 'bg-blue-50/50'
                            }`}
                          >
                            <p className="text-xs font-semibold text-navy-900">{n.title}</p>
                            <p className="text-xs text-slate-600 mt-0.5 line-clamp-2">{n.message}</p>
                          </button>
                        ))
                      )}
                    </div>
                  </div>
                )}
              </div>

              <Link
                to={dashboardPath}
                className="hidden sm:inline-flex items-center px-3.5 py-2 text-xs font-semibold text-white bg-navy-900 rounded-lg hover:bg-navy-800 transition-colors whitespace-nowrap shrink-0"
              >
                {user.name.split(' ')[0]} · Dashboard
              </Link>
              <button
                type="button"
                onClick={handleLogout}
                className="hidden sm:inline-flex px-3 py-2 text-xs font-medium text-slate-600 hover:text-navy-900 whitespace-nowrap shrink-0"
              >
                Sign out
              </button>
            </>
          ) : (
            <Link
              to="/login"
              className="px-4 py-2 text-xs font-semibold text-white bg-navy-900 rounded-lg hover:bg-navy-800 transition-colors whitespace-nowrap shrink-0"
            >
              Sign In
            </Link>
          )}

          <button
            type="button"
            onClick={() => setMobileOpen((o) => !o)}
            aria-label="Toggle menu"
            className="md:hidden p-2 text-slate-700 rounded-lg hover:bg-slate-100"
          >
            {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {mobileOpen && (
        <div className="md:hidden border-t border-slate-200 bg-white px-6 py-4 space-y-2">
          {navLinks.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              onClick={() => setMobileOpen(false)}
              className="block py-2 text-sm font-medium text-slate-700 hover:text-navy-900"
            >
              {item.label}
            </Link>
          ))}
          {user ? (
            <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
              <Link
                to={dashboardPath}
                onClick={() => setMobileOpen(false)}
                className="text-sm font-semibold text-electric-600"
              >
                Open Dashboard
              </Link>
              <button type="button" onClick={handleLogout} className="text-sm text-rose-600 font-medium">
                Sign out
              </button>
            </div>
          ) : (
            <Link
              to="/login"
              onClick={() => setMobileOpen(false)}
              className="block w-full text-center py-2.5 text-sm font-semibold text-white bg-navy-900 rounded-lg"
            >
              Sign In / Register
            </Link>
          )}
        </div>
      )}
    </header>
  );
}
