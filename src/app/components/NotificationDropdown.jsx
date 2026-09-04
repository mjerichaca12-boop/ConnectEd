import { useState, useRef, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Bell, X, MessageSquare, FileSpreadsheet, BookOpen, Calendar, AlertCircle, Trash2, CheckCircle2 } from "lucide-react";
import { supabase } from "@/app/lib/supabaseClient";
import {
  resolveCurrentUserId,
  fetchUserNotifications,
  markNotificationAsRead,
  toggleNotificationReadStatus,
  markAllNotificationsAsRead,
  deleteNotification,
  getNotificationNavigationPath,
  deduplicateNotifications,
  getNotificationStorageKey,
} from "@/app/services/notificationService";

const getCurrentUser = () => {
  try {
    const raw = localStorage.getItem("currentUser");
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};

const getIconForType = (type) => {
  const t = String(type || "").toLowerCase().trim();
  switch (t) {
    case "messages":
    case "message":
    case "chat":
      return <MessageSquare className="w-4 h-4 text-blue-500 flex-shrink-0" />;
    case "grades":
    case "grade":
      return <FileSpreadsheet className="w-4 h-4 text-emerald-500 flex-shrink-0" />;
    case "assignments":
    case "assignment":
      return <BookOpen className="w-4 h-4 text-orange-500 flex-shrink-0" />;
    case "event":
      return <Calendar className="w-4 h-4 text-purple-500 flex-shrink-0" />;
    case "announcement":
    case "announcements":
    case "system":
      return <Bell className="w-4 h-4 text-indigo-500 flex-shrink-0" />;
    default:
      return <AlertCircle className="w-4 h-4 text-gray-500 flex-shrink-0" />;
  }
};

const getViewAllPath = (role) => {
  if (role === "admin") return "/admin/notifications";
  if (role === "teacher") return "/teacher/notifications";
  return "/notifications";
};

export function NotificationDropdown({
  onMarkAsRead,
  onNotificationsChange
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const dropdownRef = useRef(null);
  const navigate = useNavigate();

  const loadNotifications = useCallback(async () => {
    const currentUser = getCurrentUser();
    if (!currentUser) return;
    const items = await fetchUserNotifications(currentUser);
    setNotifications(items);
    onNotificationsChange?.(items);
  }, [onNotificationsChange]);

  useEffect(() => {
    loadNotifications();

    if (supabase?.auth?.onAuthStateChange) {
      const { data } = supabase.auth.onAuthStateChange(() => {
        loadNotifications();
      });
      return () => {
        data?.subscription?.unsubscribe?.();
      };
    }
  }, [loadNotifications]);

  // Click outside to close dropdown
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Listen to custom window notification events for instant multi-component sync
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

  // Realtime Supabase subscription for user notifications
  useEffect(() => {
    let channel = null;
    let isSubscribed = true;

    const setupRealtime = async () => {
      const currentUser = getCurrentUser();
      if (!currentUser || !supabase) return;

      const userId = await resolveCurrentUserId(currentUser);
      if (!userId || !isSubscribed) return;

      try {
        channel = supabase
          .channel(`notifications-${userId}-${Date.now()}`)
          .on(
            "postgres_changes",
            {
              event: "*",
              schema: "public",
              table: "notifications",
              filter: `user_id=eq.${userId}`,
            },
            () => {
              if (isSubscribed) {
                loadNotifications();
              }
            }
          )
          .subscribe();
      } catch (e) {
        console.warn("[NotificationDropdown] Realtime subscription error:", e);
      }
    };

    setupRealtime();

    return () => {
      isSubscribed = false;
      if (channel && supabase) {
        supabase.removeChannel(channel);
      }
    };
  }, [loadNotifications]);

  // Total unread count for current user
  const totalUnreadCount = notifications.filter((n) => !n.isRead).length;

  // Unread badge count is ALWAYS equal to totalUnreadCount!
  // Opening the dropdown menu DOES NOT mark notifications as read or clear the badge.
  const badgeCount = totalUnreadCount;

  const handleToggleOpen = () => {
    setIsOpen((prev) => !prev);
  };

  const currentUser = getCurrentUser();

  const handleNotificationClick = async (item) => {
    if (!item.isRead) {
      setNotifications((prev) =>
        prev.map((n) => (n.id === item.id ? { ...n, isRead: true } : n))
      );
      await markNotificationAsRead(currentUser, item.id);
      onMarkAsRead?.(item.id);
    }

    setIsOpen(false);

    const currentPath = window.location.pathname;
    const targetPath = getNotificationNavigationPath(item, currentUser?.role, currentPath);
    if (targetPath && targetPath !== currentPath) {
      navigate(targetPath);
    }
  };

  const handleToggleReadStatus = async (e, item) => {
    e.stopPropagation();
    const nextStatus = !item.isRead;
    setNotifications((prev) =>
      prev.map((n) => (n.id === item.id ? { ...n, isRead: nextStatus } : n))
    );
    await toggleNotificationReadStatus(currentUser, item.id, item.isRead);
  };

  const handleDeleteNotification = async (e, id) => {
    e.stopPropagation();
    setNotifications((prev) => prev.filter((n) => n.id !== id));
    await deleteNotification(currentUser, id);
  };

  const handleMarkAllRead = async () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
    await markAllNotificationsAsRead(currentUser);
  };

  const filtered = deduplicateNotifications(notifications).filter((n) => {
    // 1. Category Filter
    let matchesCategory = false;
    if (categoryFilter === "all") {
      matchesCategory = true;
    } else {
      const t = String(n.type || "").toLowerCase().trim();
      if (categoryFilter === "messages" && (t === "messages" || t === "message" || t === "chat")) matchesCategory = true;
      else if (categoryFilter === "assignments" && (t === "assignments" || t === "assignment")) matchesCategory = true;
      else if (categoryFilter === "grades" && (t === "grades" || t === "grade")) matchesCategory = true;
      else if (categoryFilter === "system" && (t === "system" || t === "announcement" || t === "announcements" || t === "event")) matchesCategory = true;
      else if (t === categoryFilter) matchesCategory = true;
    }

    // 2. Status Filter
    let matchesStatus = false;
    if (statusFilter === "all") {
      matchesStatus = true;
    } else if (statusFilter === "unread") {
      matchesStatus = !n.isRead;
    } else if (statusFilter === "read") {
      matchesStatus = n.isRead;
    }

    return matchesCategory && matchesStatus;
  });

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        data-tour="dashboard-notifications"
        type="button"
        onClick={handleToggleOpen}
        className="relative p-2 hover:bg-green-50 rounded-xl transition-colors cursor-pointer"
        aria-label="Notifications"
      >
        <Bell className="w-6 h-6 text-gray-500 hover:text-green-600 transition-colors" />
        {badgeCount > 0 && (
          <span className="absolute -top-1 -right-1 text-[10px] bg-red-500 text-white rounded-full px-1.5 py-[2px] font-bold shadow-sm">
            {badgeCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 top-full mt-2 w-80 bg-white rounded-2xl shadow-xl border border-gray-200 z-50 py-2 animate-in fade-in slide-in-from-top-2 duration-150">
          {/* Header */}
          <div className="px-4 py-2 border-b border-gray-100">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <h3 className="font-semibold text-gray-900 text-sm">Notifications</h3>
                {totalUnreadCount > 0 && (
                  <span className="text-xs bg-red-100 text-red-600 px-2 py-0.5 rounded-full font-semibold">
                    {totalUnreadCount} unread
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => { setIsOpen(false); navigate(getViewAllPath(currentUser?.role)); }}
                  className="text-xs text-green-600 hover:text-green-700 font-semibold whitespace-nowrap cursor-pointer"
                >
                  History
                </button>
                <button
                  onClick={() => setIsOpen(false)}
                  className="text-gray-400 hover:text-gray-600 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Status Tabs */}
            <div className="mt-2.5 flex items-center gap-1.5 border-b border-gray-100 pb-2">
              {["all", "unread", "read"].map((sf) => (
                <button
                  key={sf}
                  onClick={() => setStatusFilter(sf)}
                  className={`text-[10px] font-bold px-2 py-0.5 rounded capitalize cursor-pointer transition-colors ${
                    statusFilter === sf
                      ? "bg-emerald-600 text-white"
                      : "text-gray-500 hover:bg-gray-100"
                  }`}
                >
                  {sf === "all" ? "All" : sf === "unread" ? "Unread Only" : "Read"}
                </button>
              ))}
            </div>

            {/* Category Tabs */}
            <div className="mt-2 flex items-center justify-between">
              <div className="flex items-center gap-1 flex-wrap">
                {totalUnreadCount > 0 && (
                  <button
                    onClick={handleMarkAllRead}
                    className="text-[10px] text-green-600 hover:text-green-700 font-bold cursor-pointer whitespace-nowrap mr-1"
                  >
                    Mark all read
                  </button>
                )}
                {(currentUser?.role === "admin" 
                  ? ["all", "messages", "system"] 
                  : ["all", "assignments", "messages", "grades", "system"]
                ).map((cat) => (
                  <button
                    key={cat}
                    onClick={() => setCategoryFilter(cat)}
                    className={`text-[10px] px-1.5 py-0.5 rounded capitalize cursor-pointer ${
                      categoryFilter === cat
                        ? "bg-emerald-100 text-emerald-700 font-semibold"
                        : "text-gray-400 hover:bg-gray-50"
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Notifications List */}
          <div className="max-h-72 overflow-y-auto divide-y divide-gray-50 select-scrollbar">
            {filtered.length === 0 ? (
              <div className="px-4 py-6 text-center text-xs text-gray-500">
                No notifications matching filters
              </div>
            ) : (
              filtered.map((item, index) => (
                <div
                  key={`${item.id}-notif-${index}`}
                  className={`group relative px-4 py-3 hover:bg-green-50/30 transition-colors border-b border-gray-50 last:border-0 flex items-start gap-3 ${
                    !item.isRead ? "bg-green-50/20" : ""
                  }`}
                >
                  {/* Status Indicator Dot */}
                  <div className="pt-1.5">
                    {!item.isRead ? (
                      <span className="block w-2 h-2 rounded-full bg-emerald-500 shadow-sm" />
                    ) : (
                      <span className="block w-2 h-2 rounded-full border border-gray-300" />
                    )}
                  </div>

                  {/* Icon matching Type */}
                  <div className="pt-0.5">
                    {getIconForType(item.type)}
                  </div>

                  {/* Content button */}
                  <button
                    type="button"
                    onClick={() => handleNotificationClick(item)}
                    className="flex-1 text-left min-w-0 cursor-pointer"
                  >
                    <p className={`text-xs font-semibold truncate ${!item.isRead ? "text-gray-900" : "text-gray-600"}`}>
                      {item.title}
                    </p>
                    <p className="text-[11px] text-gray-500 line-clamp-2 mt-0.5">{item.message}</p>
                    <p className="text-[9px] text-gray-400 mt-1">{item.timestamp}</p>
                  </button>

                  {/* Quick Controls */}
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity pt-0.5">
                    <button
                      onClick={(e) => handleToggleReadStatus(e, item)}
                      title={item.isRead ? "Mark as unread" : "Mark as read"}
                      className="p-1 hover:bg-gray-100 rounded text-gray-400 hover:text-emerald-600 transition-colors cursor-pointer"
                    >
                      <CheckCircle2 className={`w-3.5 h-3.5 ${!item.isRead ? "text-emerald-500" : ""}`} />
                    </button>
                    <button
                      onClick={(e) => handleDeleteNotification(e, item.id)}
                      title="Delete notification"
                      className="p-1 hover:bg-gray-100 rounded text-gray-400 hover:text-red-500 transition-colors cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))
            )}
            {notifications.length > 0 && notifications.every((n) => n.isRead) && (
              <div className="px-4 py-4 text-center text-xs text-gray-400 font-medium">
                All caught up! No unread notifications.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
