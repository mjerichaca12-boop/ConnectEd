import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/app/lib/supabaseClient";
import { useNavigate } from "react-router-dom";
import { 
  Bell, 
  MessageCircle, 
  CheckCircle, 
  AlertCircle, 
  Info,
  Clock,
  Trash2,
  Check,
  ArrowLeft
} from "lucide-react";
import {
  resolveCurrentUserId,
  fetchUserNotifications,
  markNotificationAsRead,
  toggleNotificationReadStatus,
  markAllNotificationsAsRead,
  deleteNotification,
  getNotificationNavigationPath,
  deduplicateNotifications,
} from "@/app/services/notificationService";

const getCurrentUser = () => {
  try {
    const raw = localStorage.getItem("currentUser");
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};

const getTypeIcon = (type) => {
  const t = String(type || "").toLowerCase();
  if (t.includes("message")) return <MessageCircle className="w-5 h-5 text-blue-500" />;
  if (t.includes("assignment") || t.includes("grade")) return <CheckCircle className="w-5 h-5 text-green-500" />;
  if (t.includes("alert") || t.includes("system") || t.includes("announcement")) return <AlertCircle className="w-5 h-5 text-orange-500" />;
  return <Info className="w-5 h-5 text-gray-500" />;
};

const formatTimeAgo = (dateString) => {
  const date = new Date(dateString);
  const now = new Date();
  const diffInSeconds = Math.floor((now - date) / 1000);
  
  if (diffInSeconds < 60) return "Just now";
  if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
  if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`;
  return `${Math.floor(diffInSeconds / 86400)}d ago`;
};

export function NotificationsPage() {
  const [notifications, setNotifications] = useState([]);
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  const loadNotifications = useCallback(async () => {
    const currentUser = getCurrentUser();
    if (!currentUser) {
      setLoading(false);
      return;
    }
    const items = await fetchUserNotifications(currentUser);
    setNotifications(items);
    setLoading(false);
  }, []);

  useEffect(() => {
    loadNotifications();
  }, [loadNotifications]);

  // Window event listener for instant multi-component reactivity
  useEffect(() => {
    const handleNotificationEvent = (e) => {
      const detail = e.detail;
      if (!detail) return;

      if (detail.action === "read" && detail.notificationId) {
        setNotifications((prev) =>
          prev.map((n) => (n.id === String(detail.notificationId) ? { ...n, isRead: true } : n))
        );
      } else if (detail.action === "toggle" && detail.notificationId) {
        setNotifications((prev) =>
          prev.map((n) =>
            n.id === String(detail.notificationId) ? { ...n, isRead: detail.nextReadStatus } : n
          )
        );
      } else if (detail.action === "mark_all_read") {
        setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
      } else if (detail.action === "delete" && detail.notificationId) {
        setNotifications((prev) => prev.filter((n) => n.id !== String(detail.notificationId)));
      } else {
        loadNotifications();
      }
    };

    window.addEventListener("connected_notification_change", handleNotificationEvent);
    return () => window.removeEventListener("connected_notification_change", handleNotificationEvent);
  }, [loadNotifications]);

  // Real-time subscription
  useEffect(() => {
    let channel = null;
    let isMounted = true;

    const setupRealtime = async () => {
      const currentUser = getCurrentUser();
      if (!currentUser || !supabase) return;

      const userId = await resolveCurrentUserId(currentUser);
      if (!userId || !isMounted) return;

      try {
        channel = supabase
          .channel(`notifications-general-page-${userId}-${Date.now()}`)
          .on(
            "postgres_changes",
            {
              event: "*",
              schema: "public",
              table: "notifications",
              filter: `user_id=eq.${userId}`,
            },
            () => {
              if (isMounted) {
                loadNotifications();
              }
            }
          )
          .subscribe();
      } catch (e) {
        console.warn("Realtime setup error on notifications page:", e);
      }
    };

    setupRealtime();

    return () => {
      isMounted = false;
      if (channel && supabase) supabase.removeChannel(channel);
    };
  }, [loadNotifications]);

  const handleToggleRead = async (item) => {
    const currentUser = getCurrentUser();
    const nextStatus = !item.isRead;
    setNotifications((prev) =>
      prev.map((n) => (n.id === item.id ? { ...n, isRead: nextStatus } : n))
    );
    await toggleNotificationReadStatus(currentUser, item.id, item.isRead);
  };

  const handleDelete = async (id) => {
    const currentUser = getCurrentUser();
    setNotifications((prev) => prev.filter((n) => n.id !== id));
    await deleteNotification(currentUser, id);
  };

  const handleMarkAllRead = async () => {
    const currentUser = getCurrentUser();
    setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
    await markAllNotificationsAsRead(currentUser);
  };

  const handleNotificationClick = async (item) => {
    const currentUser = getCurrentUser();
    if (!item.isRead) {
      setNotifications((prev) =>
        prev.map((n) => (n.id === item.id ? { ...n, isRead: true } : n))
      );
      await markNotificationAsRead(currentUser, item.id);
    }
    const currentPath = window.location.pathname;
    const targetPath = getNotificationNavigationPath(item, currentUser?.role, currentPath);
    if (targetPath && targetPath !== currentPath) {
      navigate(targetPath);
    }
  };

  const filtered = deduplicateNotifications(notifications).filter((n) => {
    if (categoryFilter !== "all" && !n.type.includes(categoryFilter)) return false;
    if (statusFilter === "unread" && n.isRead) return false;
    if (statusFilter === "read" && !n.isRead) return false;
    return true;
  });

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  return (
    <div className="min-h-screen bg-gray-50 p-6 md:p-10">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-gray-200 shadow-sm">
          <div className="flex items-center gap-4">
            <button 
              onClick={() => navigate(-1)} 
              className="p-2 hover:bg-gray-100 rounded-xl transition-colors text-gray-600 cursor-pointer"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                Notifications
                {unreadCount > 0 && (
                  <span className="bg-emerald-100 text-emerald-700 text-xs px-2.5 py-1 rounded-full font-bold">
                    {unreadCount} new
                  </span>
                )}
              </h1>
              <p className="text-sm text-gray-500">Real-time updates and alerts for your account</p>
            </div>
          </div>
          {unreadCount > 0 && (
            <button
              onClick={handleMarkAllRead}
              className="inline-flex items-center gap-2 text-sm font-semibold text-emerald-600 hover:text-emerald-700 bg-emerald-50 hover:bg-emerald-100 px-4 py-2 rounded-xl transition-colors cursor-pointer"
            >
              <Check className="w-4 h-4" />
              Mark all as read
            </button>
          )}
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center justify-between gap-4 bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
          <div className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0">
            {["all", "announcement", "grades", "assignments", "messages", "system"].map((cat) => (
              <button
                key={cat}
                onClick={() => setCategoryFilter(cat)}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold capitalize transition-all cursor-pointer ${
                  categoryFilter === cat
                    ? "bg-gray-900 text-white"
                    : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2 border-l border-gray-200 pl-4">
            {["all", "unread", "read"].map((st) => (
              <button
                key={st}
                onClick={() => setStatusFilter(st)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold capitalize transition-all cursor-pointer ${
                  statusFilter === st
                    ? "bg-emerald-600 text-white"
                    : "text-gray-500 hover:bg-gray-100"
                }`}
              >
                {st}
              </button>
            ))}
          </div>
        </div>

        {/* Notification List */}
        {loading ? (
          <div className="bg-white p-12 rounded-2xl border border-gray-200 text-center text-gray-500">
            Loading notifications...
          </div>
        ) : filtered.length === 0 ? (
          <div className="bg-white p-12 rounded-2xl border border-gray-200 text-center space-y-3">
            <Bell className="w-10 h-10 text-gray-300 mx-auto" />
            <h3 className="text-base font-semibold text-gray-800">No notifications found</h3>
            <p className="text-sm text-gray-500">You're all caught up! Check back later for new updates.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map((item) => (
              <div
                key={item.id}
                onClick={() => handleNotificationClick(item)}
                className={`p-4 rounded-xl border transition-all flex items-start justify-between gap-4 cursor-pointer ${
                  item.isRead ? "bg-white border-gray-200" : "bg-emerald-50/40 border-emerald-200 shadow-sm"
                }`}
              >
                <div className="flex items-start gap-3.5 flex-1 min-w-0">
                  <div className="p-2 bg-gray-50 rounded-lg border border-gray-100 mt-0.5">
                    {getTypeIcon(item.type)}
                  </div>
                  <div className="space-y-1 flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h4 className={`text-sm font-semibold ${item.isRead ? "text-gray-900" : "text-emerald-950 font-bold"}`}>
                        {item.title}
                      </h4>
                      {!item.isRead && (
                        <span className="w-2 h-2 rounded-full bg-emerald-500" />
                      )}
                    </div>
                    <p className="text-xs text-gray-600 leading-relaxed">{item.message}</p>
                    <div className="flex items-center gap-1.5 text-xs text-gray-400 pt-1">
                      <Clock className="w-3.5 h-3.5" />
                      <span>{formatTimeAgo(item.createdAt || item.timestamp)}</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 flex-shrink-0">
                  <button
                    onClick={(e) => { e.stopPropagation(); handleToggleRead(item); }}
                    title={item.isRead ? "Mark as unread" : "Mark as read"}
                    className="p-2 hover:bg-gray-100 rounded-lg text-gray-500 transition-colors cursor-pointer"
                  >
                    <Check className={`w-4 h-4 ${item.isRead ? "text-emerald-600" : "text-gray-400"}`} />
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); handleDelete(item.id); }}
                    title="Delete notification"
                    className="p-2 hover:bg-red-50 text-gray-400 hover:text-red-600 rounded-lg transition-colors cursor-pointer"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
