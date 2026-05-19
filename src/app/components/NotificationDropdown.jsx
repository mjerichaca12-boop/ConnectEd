import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Bell, X } from "lucide-react";
import { supabase, supabaseAdmin } from "@/app/lib/supabaseClient";

const db = () => supabaseAdmin || supabase;

const isValidUuid = (value) =>
  typeof value === "string" &&
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);

const getCurrentUser = () => {
  try {
    const raw = localStorage.getItem("currentUser");
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};

const getStorageKey = (user) => {
  const role = user?.role || "guest";
  const id = isValidUuid(user?.id) ? user.id : "guest";
  return `notifications_${role}_${id}`;
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

const getPathForType = (type, role) => {
  switch (type) {
    case "announcement":
      return role === "teacher" ? "/teacher/announcements" : role === "admin" ? "/admin/announcements" : "/announcements";
    case "messages":
      return role === "teacher" ? "/teacher/messages" : role === "admin" ? "/admin/messages" : "/messages";
    case "grades":
      return role === "teacher" ? "/teacher/grades" : "/grades";
    case "assignments":
      return role === "teacher" ? "/teacher/classes" : "/subjects";
    default:
      return role === "teacher" ? "/teacher/notifications" : role === "admin" ? "/admin/notifications" : "/notifications";
  }
};

const getViewAllPath = (role) => {
  if (role === "admin") return "/admin/notifications";
  if (role === "teacher") return "/teacher/notifications";
  return "/notifications";
};

const getNotificationNavigationPath = (notification, role, currentPath = "") => {
  const type = String(notification.type || "").toLowerCase();
  const classId = notification.classId || notification.relatedId || notification.related_id;
  const targetPage = notification.targetPage || notification.path;

  const isTeacher = role === "teacher";
  const isAdmin = role === "admin";

  switch (type) {
    case "assignment":
    case "assignments":
      if (classId) {
        return isTeacher ? `/teacher/class/${classId}` : `/classes/${classId}`;
      }
      return isTeacher ? "/teacher/classes" : "/subjects";

    case "announcement":
    case "announcements":
      return isTeacher ? "/teacher/announcements" : isAdmin ? "/admin/announcements" : "/announcements";

    case "messages":
    case "message":
      return isTeacher ? "/teacher/messages" : isAdmin ? "/admin/messages" : "/messages";

    case "grades":
    case "grade":
      return isTeacher ? "/teacher/grades" : "/grades";

    case "attendance":
      return isTeacher ? "/teacher/attendance" : "/attendance";

    default:
      if (targetPage && targetPage !== "/teacher/notifications" && targetPage !== "/admin/notifications" && targetPage !== "/notifications") {
        return targetPage;
      }
      if (currentPath && currentPath !== "/teacher/notifications" && currentPath !== "/admin/notifications" && currentPath !== "/notifications") {
        return currentPath;
      }
      return isTeacher ? "/teacher/dashboard" : isAdmin ? "/admin/dashboard" : "/";
  }
};

const mapRow = (n, role) => ({
  id: String(n.id),
  userId: String(n.user_id || ""),
  type: String(n.type || "").toLowerCase(),
  title: String(n.title || ""),
  message: String(n.body || n.message || ""),
  isRead: Boolean(n.is_read),
  timestamp: new Date(n.created_at).toLocaleString(),
  path: getPathForType(n.type, role),
  relatedId: n.related_id,
  classId: n.class_id || n.related_id,
  targetPage: n.target_page || getPathForType(n.type, role),
});

function NotificationDropdown({
  notifications: defaultNotifications,
  onMarkAsRead,
  onNotificationsChange
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [categoryFilter, setCategoryFilter] = useState("all");
  const dropdownRef = useRef(null);
  const audioRef = useRef(null);
  const navigate = useNavigate();

  useEffect(() => {
    try {
      audioRef.current = new Audio("/sounds/notify.mp3");
    } catch {
      audioRef.current = null;
    }
  }, []);

  useEffect(() => {
    let isMounted = true;
    let authSubscription = null;

    const load = async () => {
      const currentUser = getCurrentUser();
      console.log("[NotificationDropdown] current user object:", currentUser);
      console.log("[NotificationDropdown] current user.id:", currentUser?.id);

      const key = getStorageKey(currentUser);

      if (!supabase?.auth?.getUser) {
        console.warn("[NotificationDropdown] Supabase auth client is unavailable; falling back to local notifications.");
      } else {
        const { data: authData, error: authError } = await supabase.auth.getUser();
        if (authError) {
          if (!authError.message?.toLowerCase().includes("session missing") && authError.name !== "AuthSessionMissingError") {
            console.error("[NotificationDropdown] Supabase auth error:", authError);
          }
        }

        const authUser = authData?.user ?? null;
        console.log("[NotificationDropdown] auth user object:", authUser);
        console.log("[NotificationDropdown] auth user.id:", authUser?.id);

        if (db() && isValidUuid(authUser?.id)) {
          try {
            const res = await db()
              .from("notifications")
              .select("id, user_id, type, title, body, is_read, created_at")
              .eq("user_id", authUser.id)
              .order("created_at", { ascending: false })
              .limit(50);

            console.log("[NotificationDropdown] Notification fetch data length:", Array.isArray(res.data) ? res.data.length : 0);

            if (!res.error && res.data && isMounted) {
              const mapped = res.data.map((n) => mapRow(n, currentUser?.role || authUser?.role));
              const deduped = dedupeNotifications(mapped);
              setNotifications(deduped);
              localStorage.setItem(key, JSON.stringify(deduped));
              return;
            }

            if (res.error) {
              console.error("[NotificationDropdown] Supabase notification fetch error:", res.error);
            }
          } catch (err) {
            console.error("[NotificationDropdown] Notification DB load error:", err);
          }
        } else {
          console.warn("[NotificationDropdown] Skipping notification fetch until a valid authenticated user exists.");
        }
      }

      if (!isMounted) return;

      const stored = localStorage.getItem(key);
      if (stored) {
        try {
          setNotifications(dedupeNotifications(JSON.parse(stored)));
        } catch {
          setNotifications([]);
        }
      } else {
        const initial = dedupeNotifications(defaultNotifications || []);
        localStorage.setItem(key, JSON.stringify(initial));
        setNotifications(initial);
      }
    };

    load();

    if (supabase?.auth?.onAuthStateChange) {
      const { data } = supabase.auth.onAuthStateChange(() => {
        if (isMounted) {
          load();
        }
      });
      authSubscription = data?.subscription || null;
    }

    return () => {
      isMounted = false;
      try {
        authSubscription?.unsubscribe?.();
      } catch {}
    };
  }, []);

  // Close on outside click
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Realtime subscription for new notifications
  useEffect(() => {
    let channel = null;
    const user = getCurrentUser();
    if (!supabase || !user?.id) return;

    try {
      channel = supabase
        .channel(`notifications-${user.id}`)
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "notifications",
            filter: `user_id=eq.${user.id}`,
          },
          (payload) => {
            const newRow = payload.new;
            if (!newRow || String(newRow.user_id) !== String(user.id)) return;

            const item = mapRow(newRow, user.role);
            setNotifications((prev) => {
              const merged = dedupeNotifications([item, ...(prev || [])]);
              localStorage.setItem(getStorageKey(user), JSON.stringify(merged));
              onNotificationsChange?.(merged);
              try {
                if (audioRef.current) audioRef.current.play().catch(() => {});
              } catch {}
              return merged;
            });
          }
        )
        .subscribe();
    } catch (err) {
      console.warn("Realtime notifications setup failed:", err);
    }

    return () => {
      try {
        if (channel && supabase) supabase.removeChannel(channel);
      } catch {}
    };
  }, []);

  const unreadCount = notifications.filter((n) => !n.isRead).length;
  const user = getCurrentUser();

  const handleNotificationClick = async (item) => {
    try {
      const { data: authData, error: authError } = supabase?.auth?.getUser ? await supabase.auth.getUser() : { data: null, error: null };
      if (authError) {
        console.error("[NotificationDropdown] Supabase auth error:", authError);
      }

      const authUser = authData?.user ?? null;
      console.log("[NotificationDropdown] handleNotificationClick auth user:", authUser);
      console.log("[NotificationDropdown] handleNotificationClick auth user.id:", authUser?.id);

      if (db() && isValidUuid(authUser?.id)) {
        await db()
          .from("notifications")
          .update({ is_read: true })
          .eq("id", item.id)
          .eq("user_id", authUser.id);
      } else {
        console.warn("[NotificationDropdown] Skipping mark-read because the authenticated user is missing or invalid.");
      }
    } catch (err) {
      console.error("[NotificationDropdown] Failed to mark notification read in DB:", err);
    }

    const updated = dedupeNotifications(notifications).map((n) =>
      n.id === item.id ? { ...n, isRead: true } : n
    );
    setNotifications(updated);
    localStorage.setItem(getStorageKey(user), JSON.stringify(updated));
    onMarkAsRead?.(item.id);
    onNotificationsChange?.(updated);
    setIsOpen(false);

    // Conditional contextual navigation
    const currentPath = window.location.pathname;
    const targetPath = getNotificationNavigationPath(item, user?.role, currentPath);
    if (targetPath && targetPath !== currentPath) {
      navigate(targetPath);
    }
  };

  const handleMarkAllRead = async () => {
    try {
      const { data: authData, error: authError } = supabase?.auth?.getUser ? await supabase.auth.getUser() : { data: null, error: null };
      if (authError) {
        console.error("[NotificationDropdown] Supabase auth error:", authError);
      }

      const authUser = authData?.user ?? null;
      console.log("[NotificationDropdown] handleMarkAllRead auth user:", authUser);
      console.log("[NotificationDropdown] handleMarkAllRead auth user.id:", authUser?.id);

      if (db() && isValidUuid(authUser?.id)) {
        await db()
          .from("notifications")
          .update({ is_read: true })
          .eq("user_id", authUser.id)
          .eq("is_read", false);
      } else {
        console.warn("[NotificationDropdown] Skipping mark-all-read because the authenticated user is missing or invalid.");
      }
    } catch (err) {
      console.error("[NotificationDropdown] Failed to mark all read in DB:", err);
    }

    const updated = dedupeNotifications(notifications).map((n) => ({ ...n, isRead: true }));
    setNotifications(updated);
    localStorage.setItem(getStorageKey(user), JSON.stringify(updated));
    onNotificationsChange?.(updated);
  };

  const filtered = dedupeNotifications(notifications).filter((n) => {
    if (categoryFilter === "all") return true;
    const t = String(n.type || "").toLowerCase().trim();
    if (categoryFilter === "messages" && (t === "messages" || t === "message")) return true;
    if (categoryFilter === "assignments" && (t === "assignments" || t === "assignment")) return true;
    if (categoryFilter === "grades" && (t === "grades" || t === "grade")) return true;
    if (categoryFilter === "attendance" && (t === "attendance")) return true;
    if (categoryFilter === "system" && (t === "system" || t === "announcement" || t === "announcements")) return true;
    return t === categoryFilter;
  });

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 hover:bg-green-50 rounded-xl transition-colors cursor-pointer"
        aria-label="Notifications"
      >
        <Bell className="w-6 h-6 text-gray-500 group-hover:text-green-600" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 text-[10px] bg-red-500 text-white rounded-full px-1.5 py-[2px]">
            {unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 top-full mt-2 w-80 bg-white rounded-2xl shadow-xl border border-gray-200 z-50 py-2">
          {/* Header */}
          <div className="px-4 py-2 border-b border-gray-100">
            <div className="flex items-center gap-2">
              <h3 className="font-semibold text-gray-900 text-sm">Notifications</h3>
              {unreadCount > 0 && (
                <span className="text-xs bg-red-100 text-red-600 px-2 py-0.5 rounded-full">
                  {unreadCount} unread
                </span>
              )}
            </div>
            <div className="mt-2 flex items-center justify-between">
              <div className="flex items-center gap-2 flex-wrap">
                {unreadCount > 0 && (
                  <button
                    onClick={handleMarkAllRead}
                    className="text-xs text-green-600 hover:text-green-700 cursor-pointer whitespace-nowrap"
                  >
                    Mark all read
                  </button>
                )}
                {["all", "attendance", "assignments", "messages", "grades", "system"].map((cat) => (
                  <button
                    key={cat}
                    onClick={() => setCategoryFilter(cat)}
                    className={`text-xs px-2 py-1 rounded capitalize ${
                      categoryFilter === cat
                        ? "bg-emerald-100 text-emerald-700"
                        : "text-gray-500 hover:bg-gray-100"
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => { setIsOpen(false); navigate(getViewAllPath(user?.role)); }}
                  className="text-xs text-gray-600 hover:text-gray-800 whitespace-nowrap"
                >
                  View all
                </button>
                <button
                  onClick={() => setIsOpen(false)}
                  className="text-gray-600 hover:text-gray-800 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>

          {/* Notifications List */}
          <div className="max-h-72 overflow-y-auto">
            {filtered.length === 0 ? (
              <div className="px-4 py-6 text-center text-sm text-gray-500">
                No notifications
              </div>
            ) : (
              filtered.map((item, index) => (
                <button
                  key={`${item.id}-notification-${index}`}
                  type="button"
                  onClick={() => handleNotificationClick(item)}
                  className={`w-full text-left px-4 py-3 hover:bg-green-50 transition-colors cursor-pointer border-b border-gray-50 last:border-0 ${
                    !item.isRead ? "bg-green-50/50" : ""
                  }`}
                >
                  <div className="flex items-start gap-2">
                    {!item.isRead && (
                      <span className="w-2 h-2 rounded-full bg-green-500 flex-shrink-0 mt-1.5" />
                    )}
                    <div className={`flex-1 min-w-0 ${item.isRead ? "pl-4" : ""}`}>
                      <p className={`text-sm font-medium ${!item.isRead ? "text-gray-900" : "text-gray-500"}`}>
                        {item.title}
                      </p>
                      <p className="text-xs text-gray-500 truncate">{item.message}</p>
                      <p className="text-[10px] text-gray-400 mt-0.5">{item.timestamp}</p>
                    </div>
                  </div>
                </button>
              ))
            )}
            {notifications.length > 0 && notifications.every((n) => n.isRead) && (
              <div className="px-4 py-4 text-center text-sm text-gray-500">
                All caught up! No new notifications.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export { NotificationDropdown };
