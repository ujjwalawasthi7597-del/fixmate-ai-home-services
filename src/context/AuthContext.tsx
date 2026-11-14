import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { api } from '../lib/api';
import type { HealthStatus, NotificationItem, ProviderProfile, User } from '../types';

interface AuthContextValue {
  user: User | null;
  providerProfile: ProviderProfile | null;
  loading: boolean;
  health: HealthStatus | null;
  notifications: NotificationItem[];
  unreadCount: number;
  socket: Socket | null;
  refreshUser: () => Promise<void>;
  refreshHealth: () => Promise<void>;
  refreshNotifications: () => Promise<void>;
  markNotificationRead: (id: string) => Promise<void>;
  markAllNotificationsRead: () => Promise<void>;
  setSession: (token: string, user: User, profile?: ProviderProfile | null) => void;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [providerProfile, setProviderProfile] = useState<ProviderProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [health, setHealth] = useState<HealthStatus | null>(null);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [socket, setSocket] = useState<Socket | null>(null);

  const refreshHealth = useCallback(async () => {
    try {
      const { data } = await api.get<HealthStatus>('/health');
      setHealth(data);
    } catch {
      setHealth(null);
    }
  }, []);

  const refreshNotifications = useCallback(async () => {
    if (!sessionStorage.getItem('fixmate_jwt')) return;
    try {
      const { data } = await api.get<{ notifications: NotificationItem[]; unreadCount: number }>('/notifications');
      setNotifications(data.notifications);
      setUnreadCount(data.unreadCount);
    } catch {
      // Ignore if DB not connected or unauthorized
    }
  }, []);

  const refreshUser = useCallback(async () => {
    const token = sessionStorage.getItem('fixmate_jwt');
    if (!token) {
      setUser(null);
      setProviderProfile(null);
      setLoading(false);
      return;
    }
    try {
      const { data } = await api.get<{ user: User; providerProfile: ProviderProfile | null }>('/auth/me');
      setUser(data.user);
      setProviderProfile(data.providerProfile);
    } catch {
      sessionStorage.removeItem('fixmate_jwt');
      setUser(null);
      setProviderProfile(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refreshHealth();
    void refreshUser();
  }, [refreshHealth, refreshUser]);

  useEffect(() => {
    if (!user) {
      if (socket) {
        socket.disconnect();
        setSocket(null);
      }
      setNotifications([]);
      setUnreadCount(0);
      return;
    }

    void refreshNotifications();
    const token = sessionStorage.getItem('fixmate_jwt');
    if (!token) return;

    const s = io({
      auth: { token },
      transports: ['websocket', 'polling'],
    });

    s.on('notification:new', (notif: NotificationItem) => {
      setNotifications((prev) => [notif, ...prev]);
      setUnreadCount((c) => c + 1);
    });

    setSocket(s);
    return () => {
      s.disconnect();
    };
  }, [user?.id]);

  const setSession = useCallback((token: string, nextUser: User, profile?: ProviderProfile | null) => {
    sessionStorage.setItem('fixmate_jwt', token);
    setUser(nextUser);
    setProviderProfile(profile ?? null);
  }, []);

  const logout = useCallback(async () => {
    try {
      await api.post('/auth/logout');
    } catch {
      // ignore
    }
    sessionStorage.removeItem('fixmate_jwt');
    setUser(null);
    setProviderProfile(null);
    setNotifications([]);
    setUnreadCount(0);
  }, []);

  const markNotificationRead = useCallback(async (id: string) => {
    await api.patch(`/notifications/${id}/read`);
    setNotifications((prev) => prev.map((n) => (n._id === id ? { ...n, isRead: true } : n)));
    setUnreadCount((c) => Math.max(0, c - 1));
  }, []);

  const markAllNotificationsRead = useCallback(async () => {
    await api.patch('/notifications/read-all');
    setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
    setUnreadCount(0);
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        providerProfile,
        loading,
        health,
        notifications,
        unreadCount,
        socket,
        refreshUser,
        refreshHealth,
        refreshNotifications,
        markNotificationRead,
        markAllNotificationsRead,
        setSession,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
