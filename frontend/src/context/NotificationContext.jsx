import { createContext, useState, useEffect, useCallback, useContext } from 'react';
import { notificationService } from '../services/notificationService';
import { AuthContext } from './AuthContext';

export const NotificationContext = createContext(null);

export function NotificationProvider({ children }) {
  const { isAuthenticated } = useContext(AuthContext);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);

  const fetchNotifications = useCallback(async () => {
    if (!isAuthenticated) return;
    try {
      const { data } = await notificationService.getAll({ limit: 20 });
      setNotifications(data.data);
      setUnreadCount(data.unread_count || 0);
    } catch {}
  }, [isAuthenticated]);

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 30000);
    return () => clearInterval(interval);
  }, [fetchNotifications]);

  const markRead = async (id) => {
    await notificationService.markRead(id);
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, is_read: true } : n)));
    setUnreadCount((prev) => Math.max(0, prev - 1));
  };

  const markAllRead = async () => {
    await notificationService.markAllRead();
    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
    setUnreadCount(0);
  };

  return (
    <NotificationContext.Provider value={{ notifications, unreadCount, markRead, markAllRead, fetchNotifications }}>
      {children}
    </NotificationContext.Provider>
  );
}
