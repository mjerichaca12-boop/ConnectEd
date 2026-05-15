export interface NotificationItem {
  id: string;
  title: string;
  message: string;
  type: 'blue' | 'emerald' | 'amber' | 'red' | 'purple';
  isRead: boolean;
  route: string;
  timestamp: string;
}

const getStorageKey = (): string => {
  const userData = localStorage.getItem('currentUser');
  if (!userData) return 'notifications_guest';
  const user = JSON.parse(userData);
  return `notifications_${user.role}`;
};

export const getNotifications = (): NotificationItem[] => {
  const stored = localStorage.getItem(getStorageKey());
  if (stored) return JSON.parse(stored);
  return [];
};

export const saveNotifications = (notifications: NotificationItem[]) => {
  localStorage.setItem(getStorageKey(), JSON.stringify(notifications));
};

export const markAsRead = (id: string): NotificationItem[] => {
  const notifications = getNotifications();
  const updated = notifications.map(n => n.id === id ? { ...n, isRead: true } : n);
  saveNotifications(updated);
  return updated;
};

export const markAllAsRead = (): NotificationItem[] => {
  const notifications = getNotifications();
  const updated = notifications.map(n => ({ ...n, isRead: true }));
  saveNotifications(updated);
  return updated;
};

export const getUnreadCount = (): number => {
  return getNotifications().filter(n => !n.isRead).length;
};

export const initializeNotifications = (defaults: NotificationItem[]): NotificationItem[] => {
  const key = getStorageKey();
  const stored = localStorage.getItem(key);
  if (!stored) {
    localStorage.setItem(key, JSON.stringify(defaults));
    return defaults;
  }
  return JSON.parse(stored);
};