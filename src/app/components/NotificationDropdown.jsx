import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Bell, X } from "lucide-react";
import { supabase } from "@/app/lib/supabaseClient";
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

const dedupeNotifications = (items) => {
  const seen = new Set();
  return (Array.isArray(items) ? items : []).filter((item) => {
    const id = String(item?.id || "").trim();
    if (!id || seen.has(id)) return false;
    seen.add(id);
    return true;
  });
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
    let isMounted = true;
    const load = async () => {
      const key = getStorageKey();
      // try DB first when supabase available and user resolved
      try {
        const userData = localStorage.getItem("currentUser");
        const user = userData ? JSON.parse(userData) : null;
        if (supabase && user && user.id) {
          // Check if user is authenticated
          const { data: authData } = await supabase.auth.getUser();
          if (authData.user) {
            let { data, error } = await supabase
              .from("notifications")
              .select("id, user_id, type, title, body, is_read, created_at")
              .eq("user_id", user.id)
              .order("created_at", { ascending: false })
              .limit(50);
            
            // Handle case where notifications table doesn't exist or permissions issue
            if (error && (error.code === 'PGRST116' || error.status === 400)) {
              console.warn("Notifications table not accessible, falling back to localStorage:", error);
              error = null;
              data = [];
            }
            if (!error && data && isMounted) {
              const mapped = (data || []).map((n) => ({
                id: String(n.id),
                userId: String(n.user_id || ""),
                type: String(n.type || ""),
                title: String(n.title || ""),
                message: String(n.body || ""),
                isRead: Boolean(n.is_read),
                timestamp: new Date(n.created_at).toLocaleString(),
                path: n.type === "announcement" ? "/announcements" : "/notifications",
              }));
              setNotifications(dedupeNotifications(mapped));
              return;
            }
          }
        }
      } catch (err) {
        console.warn("Notification DB load failed:", err);
      }

      // fallback to localStorage
      const stored = localStorage.getItem(key);
      if (stored && isMounted) {
        setNotifications(dedupeNotifications(JSON.parse(stored)));
      } else {
        const initialNotifications = dedupeNotifications(defaultNotifications);
        localStorage.setItem(key, JSON.stringify(initialNotifications));
        if (isMounted) setNotifications(initialNotifications);
      }
    };
    load();
    return () => { isMounted = false; };
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
  const [categoryFilter, setCategoryFilter] = useState("all");
  // sound for new notifications
  const audioRef = useRef(null);
  useEffect(() => {
    try {
      audioRef.current = new Audio('/sounds/notify.mp3');
    } catch (e) {
      audioRef.current = null;
    }
  }, []);
  const handleNotificationClick = async (item) => {
    try {
      // mark in DB if available
      const userData = localStorage.getItem("currentUser");
      const user = userData ? JSON.parse(userData) : null;
      if (supabase && user && user.id) {
        await supabase.from("notifications").update({ is_read: true }).eq("id", item.id).eq("user_id", user.id);
      }
    } catch (err) {
      console.warn("Failed to mark notification read in DB:", err);
    }

    const updated = dedupeNotifications(notifications).map((n) => (n.id === item.id ? { ...n, isRead: true } : n));
    setNotifications(updated);
    localStorage.setItem(getStorageKey(), JSON.stringify(updated));
    onMarkAsRead?.(item.id);
    onNotificationsChange?.(updated);
    setIsOpen(false);
    navigate(item.path || "/notifications");
  };
  const handleMarkAllRead = () => {
    (async () => {
      try {
        const userData = localStorage.getItem("currentUser");
        const user = userData ? JSON.parse(userData) : null;
        if (supabase && user && user.id) {
          // update DB rows
          await supabase.from("notifications").update({ is_read: true }).eq("user_id", user.id).eq("is_read", false);
        }
      } catch (err) {
        console.warn("Failed to mark all read in DB:", err);
      }
    })();
    const updated = dedupeNotifications(notifications).map((n) => ({ ...n, isRead: true }));
    setNotifications(updated);
    localStorage.setItem(getStorageKey(), JSON.stringify(updated));
    onNotificationsChange?.(updated);
  };

  // realtime listener for new notifications
  useEffect(() => {
    let channel = null;
    try {
      const userData = localStorage.getItem("currentUser");
      const user = userData ? JSON.parse(userData) : null;
      if (supabase && user && user.id) {
        channel = supabase
          .channel(`notifications-${user.id}`)
          .on("postgres_changes", { event: "INSERT", schema: "public", table: "notifications" }, (payload) => {
            const newRow = payload.new;
            if (!newRow || String(newRow.user_id) !== String(user.id)) return;
            const item = {
              id: String(newRow.id),
              userId: String(newRow.user_id || ""),
              type: String(newRow.type || ""),
              title: String(newRow.title || ""),
              message: String(newRow.body || ""),
              isRead: Boolean(newRow.is_read),
              timestamp: new Date(newRow.created_at).toLocaleString(),
              path: newRow.type === "announcement" ? "/announcements" : "/notifications",
            };
            setNotifications((prev) => {
              const merged = dedupeNotifications([item, ...(prev || [])]);
              localStorage.setItem(getStorageKey(), JSON.stringify(merged));
              onNotificationsChange?.(merged);
              // play sound for new notification
              try { if (audioRef.current) audioRef.current.play().catch(() => {}); } catch (e) {}
              return merged;
            });
          })
          .subscribe();
      }
    } catch (err) {
      console.warn("Realtime notifications setup failed:", err);
    }
    return () => {
      try {
        if (channel && supabase) supabase.removeChannel(channel);
      } catch (e) {}
    };
  }, []);
  return <div className="relative" ref={dropdownRef}>
      <button
    type="button"
    onClick={() => setIsOpen(!isOpen)}
    className="relative p-2 hover:bg-green-50 rounded-xl transition-colors cursor-pointer"
    aria-label="Notifications"
  >
        <Bell className="w-6 h-6 text-gray-500 group-hover:text-green-600" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 text-[10px] bg-red-500 text-white rounded-full px-1.5 py-[2px]">{unreadCount}</span>
        )}
      </button>

      {isOpen && <div className="absolute right-0 top-full mt-2 w-80 bg-white rounded-2xl shadow-xl border border-gray-200 z-50 py-2">
          {
    /* Header */
  }
          <div className="px-4 py-2 border-b border-gray-100">
            <div className="flex items-center gap-2">
              <h3 className="font-semibold text-gray-900 text-sm">Notifications</h3>
              {unreadCount > 0 && <span className="text-xs bg-red-100 text-red-600 px-2 py-0.5 rounded-full">
                  {unreadCount} unread
                </span>}
            </div>
            <div className="mt-2 flex items-center justify-between">
              <div className="flex items-center gap-2">
                {unreadCount > 0 && <button
    onClick={handleMarkAllRead}
    className="text-xs text-green-600 hover:text-green-700 cursor-pointer whitespace-nowrap"
  >
                    Mark all read
                  </button>}
                <button onClick={() => setCategoryFilter('all')} className={`text-xs px-2 py-1 rounded ${categoryFilter==='all' ? 'bg-emerald-100 text-emerald-700' : 'text-gray-500 hover:bg-gray-100'}`}>All</button>
                <button onClick={() => setCategoryFilter('attendance')} className={`text-xs px-2 py-1 rounded ${categoryFilter==='attendance' ? 'bg-emerald-100 text-emerald-700' : 'text-gray-500 hover:bg-gray-100'}`}>Attendance</button>
                <button onClick={() => setCategoryFilter('assignments')} className={`text-xs px-2 py-1 rounded ${categoryFilter==='assignments' ? 'bg-emerald-100 text-emerald-700' : 'text-gray-500 hover:bg-gray-100'}`}>Assignments</button>
                <button onClick={() => setCategoryFilter('messages')} className={`text-xs px-2 py-1 rounded ${categoryFilter==='messages' ? 'bg-emerald-100 text-emerald-700' : 'text-gray-500 hover:bg-gray-100'}`}>Messages</button>
                <button onClick={() => setCategoryFilter('grades')} className={`text-xs px-2 py-1 rounded ${categoryFilter==='grades' ? 'bg-emerald-100 text-emerald-700' : 'text-gray-500 hover:bg-gray-100'}`}>Grades</button>
                <button onClick={() => setCategoryFilter('system')} className={`text-xs px-2 py-1 rounded ${categoryFilter==='system' ? 'bg-emerald-100 text-emerald-700' : 'text-gray-500 hover:bg-gray-100'}`}>System</button>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => navigate('/teacher/notifications')} className="text-xs text-gray-600 hover:text-gray-800">View all</button>
                <button
    onClick={() => setIsOpen(false)}
    className="text-gray-600 hover:text-gray-600 cursor-pointer"
  >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>

          {
    /* Notifications List */
  }
          <div className="max-h-72 overflow-y-auto">
            {dedupeNotifications(notifications).filter(n => categoryFilter === 'all' ? true : (n.type || '').toLowerCase() === categoryFilter).length === 0 ? <div className="px-4 py-6 text-center text-sm text-gray-500">
                No notifications
              </div> : dedupeNotifications(notifications).filter(n => categoryFilter === 'all' ? true : (n.type || '').toLowerCase() === categoryFilter).map((item, index) => <button
    key={`${item.id}-notification-${index}`}
    type="button"
    onClick={() => handleNotificationClick(item)}
    className={`w-full text-left px-4 py-3 hover:bg-green-50 transition-colors cursor-pointer border-b border-gray-50 last:border-0 ${!item.isRead ? "bg-green-50/50" : ""}`}
  >
                  <div className="flex items-start gap-2">
                    {!item.isRead && <span className="w-2 h-2 rounded-full bg-green-500 flex-shrink-0 mt-1.5" />}
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
