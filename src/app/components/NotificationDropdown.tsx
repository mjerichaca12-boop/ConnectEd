import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell } from 'lucide-react';

export interface NotificationItem {
  id: string;
  title: string;
  message: string;
  path: string;
  isRead: boolean;
  timestamp: string;
}

interface NotificationDropdownProps {
  notifications: NotificationItem[];
  onMarkAsRead: (id: string) => void;
  onNotificationsChange?: (updated: NotificationItem[]) => void;
}

export function NotificationDropdown({
  notifications,
  onMarkAsRead,
  onNotificationsChange,
}: NotificationDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleNotificationClick = (item: NotificationItem) => {
    if (!item.isRead) {
      onMarkAsRead(item.id);
      const updated = notifications.map(n =>
        n.id === item.id ? { ...n, isRead: true } : n
      );
      onNotificationsChange?.(updated);
    }
    setIsOpen(false);
    navigate(item.path);
  };

  const unreadCount = notifications.filter(n => !n.isRead).length;

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 hover:bg-gray-100 rounded-lg transition-colors cursor-pointer"
        aria-label="Notifications"
      >
        <Bell className="w-6 h-6 text-gray-600" />
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 w-4 h-4 bg-red-500 text-white text-xs rounded-full flex items-center justify-center">
            {unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 top-full mt-2 w-80 max-h-96 overflow-y-auto bg-white rounded-xl shadow-lg border border-gray-200 z-50 py-2">
          <div className="px-4 py-2 border-b border-gray-100">
            <h3 className="font-semibold text-gray-900 text-sm">Notifications</h3>
          </div>
          <div className="max-h-72 overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="px-4 py-6 text-center text-sm text-gray-500">
                No notifications
              </div>
            ) : (
              notifications.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => handleNotificationClick(item)}
                  className={`w-full text-left px-4 py-3 hover:bg-gray-50 transition-colors cursor-pointer border-b border-gray-50 last:border-0 ${
                    !item.isRead ? 'bg-emerald-50/50' : ''
                  }`}
                >
                  <div className="flex items-start gap-2">
                    {!item.isRead && (
                      <span className="w-2 h-2 rounded-full bg-emerald-500 flex-shrink-0 mt-1.5" />
                    )}
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm font-medium ${!item.isRead ? 'text-gray-900' : 'text-gray-700'}`}>
                        {item.title}
                      </p>
                      <p className="text-xs text-gray-500 truncate">{item.message}</p>
                      <p className="text-[10px] text-gray-400 mt-0.5">{item.timestamp}</p>
                    </div>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
