import { useEffect, useState } from "react";
import { supabase } from "@/app/lib/supabaseClient";
import { adminApi } from "@/app/lib/adminApi";
import { useNavigate } from "react-router-dom";
import { 
  X, 
  Bell, 
  MessageCircle, 
  CheckCircle, 
  AlertCircle, 
  Info,
  Clock,
  Trash2,
  Check
} from "lucide-react";

const db = () => supabase;

const isValidUuid = (value) =>
  typeof value === "string" &&
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);

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

const dedupeNotifications = (items) => {
  const seen = new Set();
  return (Array.isArray(items) ? items : []).filter((item) => {
    const id = String(item?.id || "").trim();
    if (!id || seen.has(id)) return false;
    seen.add(id);
    return true;
  });
};

const getTypeIcon = (type) => {
  const t = String(type).toLowerCase();
  if (t.includes('message')) return <MessageCircle className="w-5 h-5 text-blue-500" />;
  if (t.includes('assignment') || t.includes('grade')) return <CheckCircle className="w-5 h-5 text-green-500" />;
  if (t.includes('alert') || t.includes('system')) return <AlertCircle className="w-5 h-5 text-orange-500" />;
  return <Info className="w-5 h-5 text-gray-500" />;
};

const formatTimeAgo = (dateString) => {
  const date = new Date(dateString);
  const now = new Date();
  const diffInSeconds = Math.floor((now - date) / 1000);
  
  if (diffInSeconds < 60) return 'Just now';
  
  const diffInMinutes = Math.floor(diffInSeconds / 60);
  if (diffInMinutes < 60) return `${diffInMinutes}m ago`;
  
  const diffInHours = Math.floor(diffInMinutes / 60);
  if (diffInHours < 24) return `${diffInHours}h ago`;
  
  const diffInDays = Math.floor(diffInHours / 24);
  if (diffInDays < 7) return `${diffInDays}d ago`;
  
  return date.toLocaleDateString();
};

export function Notifications() {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");
  const navigate = useNavigate();

  useEffect(() => {
    let isMounted = true;
    const load = async () => {
      try {
        const raw = localStorage.getItem("currentUser");
        const user = raw ? JSON.parse(raw) : null;
        
        const { data: authData, error: authError } = supabase?.auth?.getUser ? await supabase.auth.getUser() : { data: null, error: null };
        const authUser = authData?.user ?? null;

        if (db() && isValidUuid(authUser?.id)) {
          try {
            const candidateFields = ["message", "content", "body", "description", "text"];
            let data = null;
            let error = null;

            for (const f of candidateFields) {
              const sel = `id, user_id, type, title, ${f} as message, is_read, created_at`;
              const res = await db()
                .from("notifications")
                .select(sel)
                .eq("user_id", authUser.id)
                .order("created_at", { ascending: false })
                .limit(200);
              data = res.data;
              error = res.error;
              if (!error) break;
            }

            if (!error && isMounted) {
              setNotifications((data || []).map((n) => ({
                id: String(n.id),
                type: String(n.type || ""),
                title: String(n.title || ""),
                message: String(n.message || ""),
                isRead: Boolean(n.is_read),
                timestamp: n.created_at,
                path: getPathForType(n.type, user?.role),
                relatedId: n.related_id,
                classId: n.class_id || n.related_id,
                targetPage: n.target_page || getPathForType(n.type, user?.role),
              })));
              setLoading(false);
              return;
            }
          } catch (err) {
            console.error("[TeacherNotifications] Notification DB load error:", err);
          }
        }
      } catch (err) {
        console.error("[TeacherNotifications] Failed to load notifications from DB:", err);
      }

      // fallback
      const raw = localStorage.getItem("currentUser");
      const user = raw ? JSON.parse(raw) : null;
      const key = `notifications_${user?.role || "guest"}_${isValidUuid(user?.id) ? user.id : "guest"}`;
      const stored = localStorage.getItem(key);
      if (stored) {
        setNotifications(dedupeNotifications(JSON.parse(stored)));
      } else {
        setNotifications([]);
      }
      setLoading(false);
    };
    load();
    return () => { isMounted = false; };
  }, []);

  const markRead = async (id, e) => {
    if (e) e.stopPropagation();
    try {
      const { data: authData } = await supabase.auth.getUser();
      const authUser = authData?.user;
      if (db() && isValidUuid(authUser?.id)) {
        await db().from("notifications").update({ is_read: true }).eq("id", id).eq("user_id", authUser.id);
      }
    } catch (err) {
      console.error("[TeacherNotifications] Failed to mark read:", err);
    }
    setNotifications((prev) => prev.map((n) => n.id === id ? { ...n, isRead: true } : n));
  };

  const markAllRead = async () => {
    try {
      const { data: authData } = await supabase.auth.getUser();
      const authUser = authData?.user;
      if (db() && isValidUuid(authUser?.id)) {
        await db().from("notifications").update({ is_read: true }).eq("user_id", authUser.id).eq("is_read", false);
      }
    } catch (err) {
      console.error("[TeacherNotifications] Failed to mark all read:", err);
    }
    setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
  };

  const removeNotification = async (id, e) => {
    if (e) e.stopPropagation();
    try {
      const { data: authData } = await supabase.auth.getUser();
      const authUser = authData?.user;
      if (db() && isValidUuid(authUser?.id)) {
        await db().from("notifications").delete().eq("id", id).eq("user_id", authUser.id);
      }
    } catch (err) {
      console.error("[TeacherNotifications] Failed to delete notification:", err);
    }
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  };
  
  const handleNotificationClick = async (n) => {
    if (!n.isRead) {
      await markRead(n.id);
    }
    const rawUser = localStorage.getItem("currentUser");
    const currentUser = rawUser ? JSON.parse(rawUser) : null;
    const targetPath = getNotificationNavigationPath(n, currentUser?.role, window.location.pathname);
    if (targetPath && targetPath !== window.location.pathname) {
      navigate(targetPath);
    }
  };

  const filtered = notifications.filter((n) => {
    if (filter === 'all') return true;
    const t = String(n.type || '').toLowerCase().trim();
    if (filter === 'unread') return !n.isRead;
    if (filter === 'messages' && (t === 'messages' || t === 'message')) return true;
    if (filter === 'assignments' && (t === 'assignments' || t === 'assignment')) return true;
    if (filter === 'grades' && (t === 'grades' || t === 'grade')) return true;
    if (filter === 'system' && (t === 'system' || t === 'announcement' || t === 'announcements')) return true;
    return t === filter;
  });

  const unreadCount = notifications.filter(n => !n.isRead).length;

  return (
    <div className="min-h-screen bg-gray-50/50 p-4 md:p-8">
      <div className="max-w-5xl mx-auto">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <Bell className="w-6 h-6 text-emerald-600" />
              Notifications
              {unreadCount > 0 && (
                <span className="bg-emerald-100 text-emerald-700 text-sm font-semibold px-2.5 py-0.5 rounded-full">
                  {unreadCount} new
                </span>
              )}
            </h1>
            <p className="text-gray-500 text-sm mt-1">Manage your system alerts and messages</p>
          </div>
          
          {notifications.length > 0 && (
            <button 
              onClick={markAllRead} 
              className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 text-gray-700 rounded-lg hover:bg-gray-50 hover:text-emerald-600 transition-colors shadow-sm text-sm font-medium"
            >
              <Check className="w-4 h-4" />
              Mark all as read
            </button>
          )}
        </div>

        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden flex flex-col md:flex-row">
          
          {/* Sidebar Filters */}
          <div className="w-full md:w-64 bg-gray-50/50 border-b md:border-b-0 md:border-r border-gray-200 p-4 shrink-0">
            <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-4 px-3">Filters</h3>
            <div className="flex flex-row md:flex-col gap-1 overflow-x-auto pb-2 md:pb-0 scrollbar-hide">
              {[
                { id: 'all', label: 'All Notifications' },
                { id: 'unread', label: 'Unread Only' },
                { id: 'assignments', label: 'Assignments' },
                { id: 'grades', label: 'Grades' },
                { id: 'messages', label: 'Messages' },
                { id: 'system', label: 'System & Announcements' }
              ].map(f => (
                <button
                  key={f.id}
                  onClick={() => setFilter(f.id)}
                  className={`flex items-center justify-between px-3 py-2.5 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${
                    filter === f.id 
                      ? 'bg-emerald-50 text-emerald-700' 
                      : 'text-gray-600 hover:bg-gray-100/80 hover:text-gray-900'
                  }`}
                >
                  {f.label}
                  {f.id === 'unread' && unreadCount > 0 && (
                    <span className="bg-emerald-500 text-white text-xs px-2 py-0.5 rounded-full">
                      {unreadCount}
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Main Content Area */}
          <div className="flex-1 min-h-[500px]">
            {loading ? (
              <div className="h-full flex items-center justify-center p-12">
                <div className="flex flex-col items-center gap-4">
                  <div className="w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
                  <p className="text-gray-500 font-medium">Loading notifications...</p>
                </div>
              </div>
            ) : filtered.length === 0 ? (
              <div className="h-full flex items-center justify-center p-12">
                <div className="text-center">
                  <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-4 border border-gray-100">
                    <Bell className="w-8 h-8 text-gray-300" />
                  </div>
                  <h3 className="text-lg font-medium text-gray-900 mb-1">You're all caught up!</h3>
                  <p className="text-gray-500 text-sm">No notifications found for this filter.</p>
                </div>
              </div>
            ) : (
              <div className="divide-y divide-gray-100">
                {filtered.map((n) => (
                  <div 
                    key={n.id} 
                    onClick={() => handleNotificationClick(n)}
                    className={`group relative p-4 sm:p-5 flex gap-4 transition-all hover:bg-gray-50 cursor-pointer ${
                      !n.isRead ? 'bg-emerald-50/30' : ''
                    }`}
                  >
                    {!n.isRead && (
                      <div className="absolute left-0 top-0 bottom-0 w-1 bg-emerald-500 rounded-r" />
                    )}
                    
                    <div className="shrink-0 mt-1">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                        !n.isRead ? 'bg-white shadow-sm' : 'bg-gray-50'
                      }`}>
                        {getTypeIcon(n.type)}
                      </div>
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <h4 className={`text-sm font-semibold mb-1 ${!n.isRead ? 'text-gray-900' : 'text-gray-700'}`}>
                            {n.title}
                          </h4>
                          <p className="text-sm text-gray-600 line-clamp-2">
                            {n.message}
                          </p>
                        </div>
                        
                        <div className="flex flex-col items-end gap-2 shrink-0">
                          <span className="flex items-center gap-1 text-xs text-gray-400 font-medium whitespace-nowrap">
                            <Clock className="w-3.5 h-3.5" />
                            {formatTimeAgo(n.timestamp)}
                          </span>
                          
                          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            {!n.isRead && (
                              <button 
                                onClick={(e) => markRead(n.id, e)}
                                className="p-1.5 text-gray-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-md transition-colors tooltip-trigger"
                                title="Mark as read"
                              >
                                <CheckCircle className="w-4 h-4" />
                              </button>
                            )}
                            <button 
                              onClick={(e) => removeNotification(n.id, e)}
                              className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors"
                              title="Delete notification"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
