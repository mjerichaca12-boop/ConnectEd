import { useEffect, useState } from "react";
import { supabase, supabaseAdmin } from "@/app/lib/supabaseClient";
import { useNavigate } from "react-router-dom";
import { X } from "lucide-react";

const db = () => supabaseAdmin || supabase;

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

const dedupeNotifications = (items) => {
  const seen = new Set();
  return (Array.isArray(items) ? items : []).filter((item) => {
    const id = String(item?.id || "").trim();
    if (!id || seen.has(id)) return false;
    seen.add(id);
    return true;
  });
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
        console.log("[TeacherNotifications] current user object:", user);
        console.log("[TeacherNotifications] current user.id:", user?.id);

        const { data: authData, error: authError } = supabase?.auth?.getUser ? await supabase.auth.getUser() : { data: null, error: null };
        if (authError) {
          console.error("[TeacherNotifications] Supabase auth error:", authError);
        }

        const authUser = authData?.user ?? null;
        console.log("[TeacherNotifications] auth user object:", authUser);
        console.log("[TeacherNotifications] auth user.id:", authUser?.id);

        if (db() && isValidUuid(authUser?.id)) {
          try {
            const candidateFields = ["message", "content", "body", "description", "text"];
            let data = null;
            let error = null;
            let usedField = null;

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
              if (!error) {
                usedField = f;
                break;
              }

              const code = String(error?.code || error?.status || "");
              const msg = String(error?.message || "").toLowerCase();
              if (code === "42703" || msg.includes("column") || msg.includes("does not exist")) {
                continue;
              }
              break;
            }

            console.log("[TeacherNotifications] Notification fetch used field:", usedField);

            if (!error && isMounted) {
              setNotifications((data || []).map((n) => ({
                id: String(n.id),
                type: String(n.type || ""),
                title: String(n.title || ""),
                message: String(n.message || ""),
                isRead: Boolean(n.is_read),
                timestamp: new Date(n.created_at).toLocaleString(),
                path: getPathForType(n.type, user?.role),
              })));
              setLoading(false);
              return;
            }
            if (error) console.error("[TeacherNotifications] Supabase notification fetch error:", error);
          } catch (err) {
            console.error("[TeacherNotifications] Notification DB load error:", err);
          }
        } else {
          console.warn("[TeacherNotifications] Skipping notification fetch until a valid authenticated user exists.");
        }
      } catch (err) {
        console.error("[TeacherNotifications] Failed to load notifications from DB:", err);
      }

      // fallback to localStorage
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

  const markRead = async (id) => {
    try {
      const { data: authData, error: authError } = supabase?.auth?.getUser ? await supabase.auth.getUser() : { data: null, error: null };
      if (authError) {
        console.error("[TeacherNotifications] Supabase auth error:", authError);
      }

      const authUser = authData?.user ?? null;
      console.log("[TeacherNotifications] markRead auth user object:", authUser);
      console.log("[TeacherNotifications] markRead auth user.id:", authUser?.id);

      if (db() && isValidUuid(authUser?.id)) {
        await db().from("notifications").update({ is_read: true }).eq("id", id).eq("user_id", authUser.id);
      } else {
        console.warn("[TeacherNotifications] Skipping mark-read because the authenticated user is missing or invalid.");
      }
    } catch (err) {
      console.error("[TeacherNotifications] Failed to mark read:", err);
    }
    setNotifications((prev) => prev.map((n) => n.id === id ? { ...n, isRead: true } : n));
  };

  const markAllRead = async () => {
    try {
      const { data: authData, error: authError } = supabase?.auth?.getUser ? await supabase.auth.getUser() : { data: null, error: null };
      if (authError) {
        console.error("[TeacherNotifications] Supabase auth error:", authError);
      }

      const authUser = authData?.user ?? null;
      console.log("[TeacherNotifications] markAllRead auth user object:", authUser);
      console.log("[TeacherNotifications] markAllRead auth user.id:", authUser?.id);

      if (db() && isValidUuid(authUser?.id)) {
        await db().from("notifications").update({ is_read: true }).eq("user_id", authUser.id).eq("is_read", false);
      } else {
        console.warn("[TeacherNotifications] Skipping mark-all-read because the authenticated user is missing or invalid.");
      }
    } catch (err) {
      console.error("[TeacherNotifications] Failed to mark all read:", err);
    }
    setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
  };

  const removeNotification = async (id) => {
    try {
      const { data: authData, error: authError } = supabase?.auth?.getUser ? await supabase.auth.getUser() : { data: null, error: null };
      if (authError) {
        console.error("[TeacherNotifications] Supabase auth error:", authError);
      }

      const authUser = authData?.user ?? null;
      console.log("[TeacherNotifications] removeNotification auth user object:", authUser);
      console.log("[TeacherNotifications] removeNotification auth user.id:", authUser?.id);

      if (db() && isValidUuid(authUser?.id)) {
        await db().from("notifications").delete().eq("id", id).eq("user_id", authUser.id);
      } else {
        console.warn("[TeacherNotifications] Skipping delete because the authenticated user is missing or invalid.");
      }
    } catch (err) {
      console.error("[TeacherNotifications] Failed to delete notification:", err);
    }
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  };

  const filtered = notifications.filter((n) => filter === 'all' ? true : (String(n.type || '').toLowerCase() === filter));

  return (
    <div className="p-6">
      <div className="max-w-3xl mx-auto bg-white rounded-2xl border border-gray-200 shadow-sm p-4">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-gray-900">Notifications</h2>
          <div className="flex items-center gap-2">
            <button onClick={markAllRead} className="text-sm text-green-600">Mark all read</button>
            <button onClick={() => setFilter('all')} className={`text-sm px-2 py-1 rounded ${filter==='all' ? 'bg-green-600 text-white' : 'text-gray-600 bg-gray-100 hover:bg-gray-200'}`}>All</button>
            <button onClick={() => setFilter('attendance')} className={`text-sm px-2 py-1 rounded ${filter==='attendance' ? 'bg-green-600 text-white' : 'text-gray-600 bg-gray-100 hover:bg-gray-200'}`}>Attendance</button>
            <button onClick={() => setFilter('assignments')} className={`text-sm px-2 py-1 rounded ${filter==='assignments' ? 'bg-green-600 text-white' : 'text-gray-600 bg-gray-100 hover:bg-gray-200'}`}>Assignments</button>
            <button onClick={() => setFilter('messages')} className={`text-sm px-2 py-1 rounded ${filter==='messages' ? 'bg-green-600 text-white' : 'text-gray-600 bg-gray-100 hover:bg-gray-200'}`}>Messages</button>
            <button onClick={() => setFilter('grades')} className={`text-sm px-2 py-1 rounded ${filter==='grades' ? 'bg-green-600 text-white' : 'text-gray-600 bg-gray-100 hover:bg-gray-200'}`}>Grades</button>
            <button onClick={() => setFilter('system')} className={`text-sm px-2 py-1 rounded ${filter==='system' ? 'bg-green-600 text-white' : 'text-gray-600 bg-gray-100 hover:bg-gray-200'}`}>System</button>
          </div>
        </div>

        <div className="max-h-[60vh] overflow-y-auto divide-y divide-gray-100">
          {loading ? (
            <div className="py-12 text-center text-sm text-gray-400">Loading...</div>
          ) : filtered.length === 0 ? (
            <div className="py-12 text-center text-sm text-gray-500">No notifications</div>
          ) : (
            filtered.map((n) => (
              <div key={n.id} className={`px-4 py-3 flex items-start gap-3 ${!n.isRead ? 'bg-green-50' : ''}`}>
                {!n.isRead && <div className="w-2 h-2 rounded-full bg-green-500 mt-1.5" />}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <p className={`text-sm font-medium ${!n.isRead ? 'text-gray-900' : 'text-gray-600'}`}>{n.title}</p>
                    <div className="flex items-center gap-2">
                      <p className="text-xs text-gray-400">{n.timestamp}</p>
                      <button onClick={() => removeNotification(n.id)} className="text-gray-400 hover:text-gray-700"><X className="w-4 h-4" /></button>
                    </div>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">{n.message}</p>
                  <div className="mt-2">
                    <button onClick={async () => { await markRead(n.id); navigate(n.path || '/teacher/notifications'); }} className="text-xs text-green-600 hover:text-green-700">Open</button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
