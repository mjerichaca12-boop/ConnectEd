import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Bell, X, MessageSquare, FileSpreadsheet, BookOpen, Calendar, AlertCircle, Trash2, CheckCircle2 } from "lucide-react";
import { supabase, supabaseAdmin } from "@/app/lib/supabaseClient";

const db = () => supabaseAdmin || supabase;

const isValidUuid = (value) =>
  typeof value === "string" &&
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);

const getCurrentUser = () => {
  try {
    const raw = localStorage.getItem("currentUser");
    if (!raw) return null;
    const user = JSON.parse(raw);
    if (user?.role === "admin" && !isValidUuid(user?.id)) {
      user.id = "11111111-1111-1111-1111-111111111111"; // Patch for old admin sessions
    }
    return user;
  } catch {
    return null;
  }
};

const getStorageKey = (user) => {
  const role = user?.role || "guest";
  let id = isValidUuid(user?.id) ? user.id : "guest";
  if (role === "admin" && id === "guest") id = "11111111-1111-1111-1111-111111111111"; // Fallback for old sessions
  return `notifications_${role}_${id}_v2`;
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
  createdAt: n.created_at,
  path: getPathForType(n.type, role),
  relatedId: n.related_id,
  classId: n.class_id || n.related_id,
  targetPage: n.target_page || getPathForType(n.type, role),
});

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

function NotificationDropdown({
  notifications: defaultNotifications,
  onMarkAsRead,
  onNotificationsChange
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all"); // "all", "unread", "read"
  const [lastViewedAt, setLastViewedAt] = useState(() => localStorage.getItem("notifications_last_viewed") || null);
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
      console.log("[NotificationDropdown] Loading notifications for user:", currentUser?.id);

      if (currentUser?.role === "admin" && !isValidUuid(currentUser.id)) {
        currentUser.id = "11111111-1111-1111-1111-111111111111"; // Patch for old admin sessions
      }

      const key = getStorageKey(currentUser);

      if (!currentUser || !currentUser.id) {
        console.warn("[NotificationDropdown] Skipping notification fetch: currentUser is null.");
        setNotifications([]);
        return;
      }

      if (!supabase?.auth?.getUser) {
        console.warn("[NotificationDropdown] Supabase auth client is unavailable; falling back to local notifications.");
      } else {
        const { data: sessionData } = await supabase.auth.getSession();
        if (!sessionData.session) {
           console.warn("[NotificationDropdown] No active session found. Skipping user fetch.");
           return;
        }

        const { data: authData, error: authError } = await supabase.auth.getUser();
        if (authError) {
          if (!authError.message?.toLowerCase().includes("session missing") && authError.name !== "AuthSessionMissingError") {
            console.error("[NotificationDropdown] Supabase auth error:", authError);
          }
        }

        const authUser = authData?.user ?? null;
        if (db() && isValidUuid(authUser?.id)) {
          try {
            console.log("[NotificationDropdown] Retrieving notifications from DB for:", authUser.id);
            const res = await db()
              .from("notifications")
              .select("id, user_id, type, title, body, message, is_read, created_at, related_id, related_type")
              .eq("user_id", authUser.id)
              .order("created_at", { ascending: false })
              .limit(100);

            if (!res.error && res.data && isMounted) {
              const mapped = res.data.map((n) => mapRow(n, currentUser?.role || authUser?.role));
              let finalItems = dedupeNotifications(mapped);
              
              if (finalItems.length === 0) {
                const stored = localStorage.getItem(key);
                if (stored) {
                  try {
                    const parsed = JSON.parse(stored);
                    if (parsed.length > 0) finalItems = parsed;
                  } catch {}
                }
                if (finalItems.length === 0 && defaultNotifications?.length > 0) {
                  finalItems = dedupeNotifications(defaultNotifications);
                }
              }

              console.log("[NotificationDropdown] Retrieved", finalItems.length, "notifications.");
              setNotifications(finalItems);
              localStorage.setItem(key, JSON.stringify(finalItems));
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
      console.log("[NotificationDropdown] Setting up realtime subscription for notifications channel:", `notifications-${user.id}`);
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
            console.log("[NotificationDropdown] Realtime INSERT event received payload:", payload);
            if (!newRow || String(newRow.user_id) !== String(user.id)) return;

            const item = mapRow(newRow, user.role);
            setNotifications((prev) => {
              const merged = dedupeNotifications([item, ...(prev || [])]);
              localStorage.setItem(getStorageKey(user), JSON.stringify(merged));
              onNotificationsChange?.(merged);
              try {
                if (audioRef.current) {
                  audioRef.current.play().catch((err) => {
                    console.log("[NotificationDropdown] Sound playback failed:", err);
                  });
                }
              } catch {}
              return merged;
            });
          }
        )
        .subscribe((status) => {
          console.log("[NotificationDropdown] Realtime channel subscription status changed:", status);
        });
    } catch (err) {
      console.warn("[NotificationDropdown] Realtime notifications setup failed:", err);
    }

    return () => {
      try {
        if (channel && supabase) {
          supabase.removeChannel(channel);
          console.log("[NotificationDropdown] Unsubscribed from realtime channel.");
        }
      } catch {}
    };
  }, []);

  const totalUnreadCount = notifications.filter((n) => !n.isRead).length;

  // Unseen notifications badge count (Unread notifications created after lastViewedAt)
  const unseenNotifications = notifications.filter(
    (n) => !n.isRead && (!lastViewedAt || new Date(n.createdAt || n.timestamp) > new Date(lastViewedAt))
  );
  const badgeCount = unseenNotifications.length;

  const handleToggleOpen = () => {
    const nextState = !isOpen;
    setIsOpen(nextState);
    if (nextState) {
      const nowStr = new Date().toISOString();
      localStorage.setItem("notifications_last_viewed", nowStr);
      setLastViewedAt(nowStr);
      console.log("[NotificationDropdown] Resetting unseen badge count. lastViewedAt set to:", nowStr);
    }
  };

  const handleNotificationClick = async (item) => {
    console.log("[NotificationDropdown] Notification item clicked:", item.id);
    try {
      const { data: authData, error: authError } = supabase?.auth?.getUser ? await supabase.auth.getUser() : { data: null, error: null };
      const authUser = authData?.user ?? null;

      if (db() && isValidUuid(authUser?.id)) {
        console.log("[NotificationDropdown] Updating is_read to true in DB for:", item.id);
        const { error } = await db()
          .from("notifications")
          .update({ is_read: true })
          .eq("id", item.id)
          .eq("user_id", authUser.id);
        
        if (error) {
          console.error("[NotificationDropdown] Failed to update read status in DB:", error);
        }
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

    const currentPath = window.location.pathname;
    const targetPath = getNotificationNavigationPath(item, user?.role, currentPath);
    console.log("[NotificationDropdown] Navigating from", currentPath, "to", targetPath);
    if (targetPath && targetPath !== currentPath) {
      navigate(targetPath);
    }
  };

  const handleToggleReadStatus = async (e, item) => {
    e.stopPropagation();
    const nextStatus = !item.isRead;
    console.log("[NotificationDropdown] Toggling read status to:", nextStatus, "for notification:", item.id);
    try {
      const { data: authData, error: authError } = supabase?.auth?.getUser ? await supabase.auth.getUser() : { data: null, error: null };
      const authUser = authData?.user ?? null;
      if (db() && isValidUuid(authUser?.id)) {
        const { error } = await db()
          .from("notifications")
          .update({ is_read: nextStatus })
          .eq("id", item.id)
          .eq("user_id", authUser.id);

        if (error) {
          console.error("[NotificationDropdown] Failed to toggle read status in DB:", error);
        }
      }
    } catch (err) {
      console.error("[NotificationDropdown] Failed to toggle read status:", err);
    }

    const updated = notifications.map((n) =>
      n.id === item.id ? { ...n, isRead: nextStatus } : n
    );
    setNotifications(updated);
    localStorage.setItem(getStorageKey(user), JSON.stringify(updated));
    onNotificationsChange?.(updated);
  };

  const handleDeleteNotification = async (e, id) => {
    e.stopPropagation();
    console.log("[NotificationDropdown] Deleting notification:", id);
    try {
      const { data: authData, error: authError } = supabase?.auth?.getUser ? await supabase.auth.getUser() : { data: null, error: null };
      const authUser = authData?.user ?? null;
      if (db() && isValidUuid(authUser?.id)) {
        const { error } = await db()
          .from("notifications")
          .delete()
          .eq("id", id)
          .eq("user_id", authUser.id);
        
        if (error) {
          console.error("[NotificationDropdown] Failed to delete notification from DB:", error);
        }
      }
    } catch (err) {
      console.error("[NotificationDropdown] Failed to delete notification:", err);
    }

    const updated = notifications.filter((n) => n.id !== id);
    setNotifications(updated);
    localStorage.setItem(getStorageKey(user), JSON.stringify(updated));
    onNotificationsChange?.(updated);
  };

  const handleMarkAllRead = async () => {
    console.log("[NotificationDropdown] Marking all notifications as read.");
    try {
      const { data: authData, error: authError } = supabase?.auth?.getUser ? await supabase.auth.getUser() : { data: null, error: null };
      const authUser = authData?.user ?? null;

      if (db() && isValidUuid(authUser?.id)) {
        const { error } = await db()
          .from("notifications")
          .update({ is_read: true })
          .eq("user_id", authUser.id)
          .eq("is_read", false);
        
        if (error) {
          console.error("[NotificationDropdown] Failed to mark all read in DB:", error);
        }
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

  const user = getCurrentUser();

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        type="button"
        onClick={handleToggleOpen}
        className="relative p-2 hover:bg-green-50 rounded-xl transition-colors cursor-pointer"
        aria-label="Notifications"
      >
        <Bell className="w-6 h-6 text-gray-500 group-hover:text-green-600" />
        {badgeCount > 0 && (
          <span className="absolute -top-1 -right-1 text-[10px] bg-red-500 text-white rounded-full px-1.5 py-[2px] font-bold">
            {badgeCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 top-full mt-2 w-80 bg-white rounded-2xl shadow-xl border border-gray-200 z-50 py-2">
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
                  onClick={() => { setIsOpen(false); navigate(getViewAllPath(user?.role)); }}
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
                {(user?.role === "admin" 
                  ? ["all", "messages", "users", "system", "reports"] 
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
          <div className="max-h-72 overflow-y-auto divide-y divide-gray-50">
            {filtered.length === 0 ? (
              <div className="px-4 py-6 text-center text-xs text-gray-500">
                No notifications matching filters
              </div>
            ) : (
              filtered.map((item, index) => (
                <div
                  key={`${item.id}-notification-${index}`}
                  className={`group relative px-4 py-3 hover:bg-green-50/30 transition-colors border-b border-gray-50 last:border-0 flex items-start gap-3 ${
                    !item.isRead ? "bg-green-50/20" : ""
                  }`}
                >
                  {/* Status Indicator Dot */}
                  <div className="pt-1.5">
                    {!item.isRead ? (
                      <span className="block w-2 h-2 rounded-full bg-emerald-500" />
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

export { NotificationDropdown };
