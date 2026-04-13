import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Bell, X } from "lucide-react";
const getStorageKey = () => {
  try {
    const userData = localStorage.getItem("currentUser");
    if (!userData) return "notifications_guest";
    const user = JSON.parse(userData);
    return `notifications_${user.role}`;
  } catch {
    return "notifications_guest";
  }
};
function NotificationDropdown({
  notifications: defaultNotifications,
  onMarkAsRead,
  onNotificationsChange
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const dropdownRef = useRef(null);
  const navigate = useNavigate();
  useEffect(() => {
    const key = getStorageKey();
    const stored = localStorage.getItem(key);
    if (stored) {
      setNotifications(JSON.parse(stored));
    } else {
      localStorage.setItem(key, JSON.stringify(defaultNotifications));
      setNotifications(defaultNotifications);
    }
  }, []);
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);
  const unreadCount = notifications.filter((n) => !n.isRead).length;
  const handleNotificationClick = (item) => {
    const updated = notifications.map(
      (n) => n.id === item.id ? { ...n, isRead: true } : n
    );
    setNotifications(updated);
    localStorage.setItem(getStorageKey(), JSON.stringify(updated));
    onMarkAsRead(item.id);
    onNotificationsChange?.(updated);
    setIsOpen(false);
    navigate(item.path);
  };
  const handleMarkAllRead = () => {
    const updated = notifications.map((n) => ({ ...n, isRead: true }));
    setNotifications(updated);
    localStorage.setItem(getStorageKey(), JSON.stringify(updated));
    onNotificationsChange?.(updated);
  };
  return <div className="relative" ref={dropdownRef}>
      <button
    type="button"
    onClick={() => setIsOpen(!isOpen)}
    className="relative p-2 hover:bg-gray-100 rounded-lg transition-colors cursor-pointer"
    aria-label="Notifications"
  >
        <Bell className="w-6 h-6 text-gray-600" />

      </button>

      {isOpen && <div className="absolute right-0 top-full mt-2 w-80 bg-white rounded-xl shadow-lg border border-gray-200 z-50 py-2">
          {
    /* Header */
  }
          <div className="px-4 py-2 border-b border-gray-100 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <h3 className="font-semibold text-gray-900 text-sm">Notifications</h3>
              {unreadCount > 0 && <span className="text-xs bg-red-100 text-red-600 px-2 py-0.5 rounded-full">
                  {unreadCount} unread
                </span>}
            </div>
            <div className="flex items-center gap-2">
              {unreadCount > 0 && <button
    onClick={handleMarkAllRead}
    className="text-xs text-emerald-600 hover:text-emerald-700 cursor-pointer whitespace-nowrap"
  >
                  Mark all read
                </button>}
              <button
    onClick={() => setIsOpen(false)}
    className="text-gray-400 hover:text-gray-600 cursor-pointer"
  >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {
    /* Notifications List */
  }
          <div className="max-h-72 overflow-y-auto">
            {notifications.length === 0 ? <div className="px-4 py-6 text-center text-sm text-gray-500">
                No notifications
              </div> : notifications.map((item) => <button
    key={item.id}
    type="button"
    onClick={() => handleNotificationClick(item)}
    className={`w-full text-left px-4 py-3 hover:bg-gray-50 transition-colors cursor-pointer border-b border-gray-50 last:border-0 ${!item.isRead ? "bg-emerald-50/50" : ""}`}
  >
                  <div className="flex items-start gap-2">
                    {!item.isRead && <span className="w-2 h-2 rounded-full bg-emerald-500 flex-shrink-0 mt-1.5" />}
                    <div className={`flex-1 min-w-0 ${item.isRead ? "pl-4" : ""}`}>
                      <p className={`text-sm font-medium ${!item.isRead ? "text-gray-900" : "text-gray-500"}`}>
                        {item.title}
                      </p>
                      <p className="text-xs text-gray-500 truncate">{item.message}</p>
                      <p className="text-[10px] text-gray-400 mt-0.5">{item.timestamp}</p>
                    </div>
                  </div>
                </button>)}

            {notifications.length > 0 && notifications.every((n) => n.isRead) && <div className="px-4 py-4 text-center text-sm text-gray-500">
                All caught up! No new notifications.
              </div>}
          </div>
        </div>}
    </div>;
}
export {
  NotificationDropdown
};
