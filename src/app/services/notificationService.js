import { supabase } from "@/app/lib/supabaseClient";

const isValidUuid = (value) =>
  typeof value === "string" &&
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);

/**
 * Resolve the current authenticated user's authoritative profile ID.
 * Prevents sharing generic fallback IDs across different user accounts.
 */
export const resolveCurrentUserId = async (user) => {
  if (user?.id && isValidUuid(user.id) && user.id !== "11111111-1111-1111-1111-111111111111") {
    return String(user.id).trim();
  }

  const email = String(user?.email || "").trim().toLowerCase();
  if (email && supabase) {
    try {
      const { data } = await supabase
        .from("profiles")
        .select("id")
        .ilike("email", email)
        .limit(1)
        .maybeSingle();

      if (data?.id && isValidUuid(data.id)) {
        return String(data.id).trim();
      }
    } catch (err) {
      console.warn("[notificationService] Profile lookup by email failed:", err);
    }
  }

  if (supabase?.auth?.getUser) {
    try {
      const { data: authData } = await supabase.auth.getUser();
      if (authData?.user?.id && isValidUuid(authData.user.id)) {
        return String(authData.user.id).trim();
      }
    } catch {}
  }

  return user?.id ? String(user.id).trim() : "";
};

/**
 * Get localStorage cache key for notifications scoped strictly to user ID & role
 */
export const getNotificationStorageKey = (role, userId) => {
  const safeRole = String(role || "guest").toLowerCase().trim();
  const safeId = userId && isValidUuid(userId) ? userId : "guest";
  return `notifications_${safeRole}_${safeId}_v3`;
};

/**
 * Standardize path navigation based on notification type and target role
 */
export const getNotificationNavigationPath = (notification, role, currentPath = "") => {
  const type = String(notification.type || "").toLowerCase().trim();
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
    case "chat":
      return isTeacher ? "/teacher/messages" : isAdmin ? "/admin/messages" : "/messages";

    case "grades":
    case "grade":
      return isTeacher ? "/teacher/grades" : "/grades";

    default:
      if (targetPage && !targetPage.endsWith("/notifications")) {
        return targetPage;
      }
      if (currentPath && !currentPath.endsWith("/notifications")) {
        return currentPath;
      }
      return isTeacher ? "/teacher/dashboard" : isAdmin ? "/admin/dashboard" : "/";
  }
};

/**
 * Deduplicate notification items by ID
 */
export const deduplicateNotifications = (items) => {
  const seen = new Set();
  return (Array.isArray(items) ? items : []).filter((item) => {
    const id = String(item?.id || "").trim();
    if (!id || seen.has(id)) return false;
    seen.add(id);
    return true;
  });
};

/**
 * Map raw database row to standardized Notification object
 */
export const mapNotificationRow = (row, role) => ({
  id: String(row.id),
  userId: String(row.user_id || ""),
  type: String(row.type || "system").toLowerCase().trim(),
  title: String(row.title || "Notification"),
  message: String(row.body || row.message || ""),
  isRead: Boolean(row.is_read),
  timestamp: row.created_at ? new Date(row.created_at).toLocaleString() : new Date().toLocaleString(),
  createdAt: row.created_at || new Date().toISOString(),
  path: row.path || getNotificationNavigationPath(row, role),
  relatedId: row.related_id || null,
  relatedType: row.related_type || null,
  classId: row.class_id || row.related_id || null,
  targetPage: row.target_page || null,
});

/**
 * Auto-sync announcements from `school_announcements` table into per-user `notifications`
 * records for the currently authenticated user based on target audience.
 */
export const syncAnnouncementsToUserNotifications = async (userId, userRole) => {
  if (!supabase || !userId || !isValidUuid(userId)) return;

  try {
    // 1. Fetch school announcements
    const { data: announcements, error: annErr } = await supabase
      .from("school_announcements")
      .select("id, title, content, target_audience, created_at")
      .order("created_at", { ascending: false })
      .limit(50);

    if (annErr || !announcements || announcements.length === 0) return;

    // 2. Filter announcements matching user role
    const normalizedRole = String(userRole || "").toLowerCase().trim();
    const authorizedAnnouncements = announcements.filter((ann) => {
      const audience = String(ann.target_audience || "").toLowerCase().trim();
      if (!audience || audience.includes("school") || audience.includes("all")) return true;
      if (normalizedRole === "teacher" && (audience.includes("teacher") || audience.includes("faculty"))) return true;
      if (normalizedRole === "admin" && (audience.includes("admin") || audience.includes("staff"))) return true;
      return false;
    });

    if (authorizedAnnouncements.length === 0) return;

    // 3. Check existing notifications for this user
    const annIds = authorizedAnnouncements.map((a) => String(a.id));
    const { data: existingNotifs } = await supabase
      .from("notifications")
      .select("related_id")
      .eq("user_id", userId)
      .in("related_id", annIds);

    const existingAnnIdSet = new Set((existingNotifs || []).map((n) => String(n.related_id)));

    // 4. Identify missing announcements and batch insert per-user notifications
    const missingNotifs = authorizedAnnouncements
      .filter((a) => !existingAnnIdSet.has(String(a.id)))
      .map((a) => ({
        user_id: userId,
        type: "announcement",
        title: String(a.title || "School Announcement").trim(),
        body: String(a.content || "A new school announcement has been posted.").trim(),
        message: String(a.content || "A new school announcement has been posted.").trim(),
        related_id: String(a.id),
        related_type: "school_announcements",
        is_read: false,
        created_at: a.created_at || new Date().toISOString(),
      }));

    if (missingNotifs.length > 0) {
      const { error: insertErr } = await supabase.from("notifications").insert(missingNotifs);
      if (insertErr) {
        console.warn("[notificationService] Error inserting announcement notifications:", insertErr);
      }
    }
  } catch (err) {
    console.error("[notificationService] Error syncing announcements:", err);
  }
};

/**
 * Authoritative function to fetch notifications for the authenticated user
 */
export const fetchUserNotifications = async (currentUser) => {
  if (!currentUser) return [];

  const role = String(currentUser.role || "user").toLowerCase().trim();
  const userId = await resolveCurrentUserId(currentUser);

  if (!userId || !isValidUuid(userId)) {
    // Fallback to local storage if unauthenticated
    const storageKey = getNotificationStorageKey(role, "guest");
    try {
      const stored = localStorage.getItem(storageKey);
      return stored ? deduplicateNotifications(JSON.parse(stored)) : [];
    } catch {
      return [];
    }
  }

  const storageKey = getNotificationStorageKey(role, userId);

  try {
    // Sync missing announcements to notifications table for this user first
    await syncAnnouncementsToUserNotifications(userId, role);

    // Fetch per-user notifications strictly by user_id
    const { data, error } = await supabase
      .from("notifications")
      .select("id, user_id, type, title, body, message, is_read, created_at, related_id, related_type")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(150);

    if (!error && data) {
      const mapped = data.map((n) => mapNotificationRow(n, role));
      const deduplicated = deduplicateNotifications(mapped);
      localStorage.setItem(storageKey, JSON.stringify(deduplicated));
      return deduplicated;
    }
  } catch (err) {
    console.error("[notificationService] Failed to fetch notifications from Supabase:", err);
  }

  // Fallback to cached local storage
  try {
    const stored = localStorage.getItem(storageKey);
    return stored ? deduplicateNotifications(JSON.parse(stored)) : [];
  } catch {
    return [];
  }
};

/**
 * Mark a single notification as READ for the authenticated user
 */
export const markNotificationAsRead = async (currentUser, notificationId) => {
  if (!currentUser || !notificationId) return;

  const role = String(currentUser.role || "user").toLowerCase().trim();
  const userId = await resolveCurrentUserId(currentUser);
  const notifIdStr = String(notificationId).trim();

  if (userId && isValidUuid(userId) && supabase) {
    try {
      await supabase
        .from("notifications")
        .update({ is_read: true })
        .eq("id", notifIdStr)
        .eq("user_id", userId);
    } catch (err) {
      console.error("[notificationService] Failed to mark read in DB:", err);
    }
  }

  // Broadcast window event for instant multi-component reactivity
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("connected_notification_change", {
      detail: { action: "read", notificationId: notifIdStr, userId }
    }));
  }
};

/**
 * Toggle read status of a notification
 */
export const toggleNotificationReadStatus = async (currentUser, notificationId, currentReadStatus) => {
  if (!currentUser || !notificationId) return;

  const role = String(currentUser.role || "user").toLowerCase().trim();
  const userId = await resolveCurrentUserId(currentUser);
  const notifIdStr = String(notificationId).trim();
  const nextReadStatus = !currentReadStatus;

  if (userId && isValidUuid(userId) && supabase) {
    try {
      await supabase
        .from("notifications")
        .update({ is_read: nextReadStatus })
        .eq("id", notifIdStr)
        .eq("user_id", userId);
    } catch (err) {
      console.error("[notificationService] Failed to toggle read status in DB:", err);
    }
  }

  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("connected_notification_change", {
      detail: { action: "toggle", notificationId: notifIdStr, nextReadStatus, userId }
    }));
  }
};

/**
 * Mark ALL notifications as READ for the authenticated user
 */
export const markAllNotificationsAsRead = async (currentUser) => {
  if (!currentUser) return;

  const role = String(currentUser.role || "user").toLowerCase().trim();
  const userId = await resolveCurrentUserId(currentUser);

  if (userId && isValidUuid(userId) && supabase) {
    try {
      await supabase
        .from("notifications")
        .update({ is_read: true })
        .eq("user_id", userId)
        .eq("is_read", false);
    } catch (err) {
      console.error("[notificationService] Failed to mark all read in DB:", err);
    }
  }

  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("connected_notification_change", {
      detail: { action: "mark_all_read", userId }
    }));
  }
};

/**
 * Delete a notification record for the authenticated user
 */
export const deleteNotification = async (currentUser, notificationId) => {
  if (!currentUser || !notificationId) return;

  const role = String(currentUser.role || "user").toLowerCase().trim();
  const userId = await resolveCurrentUserId(currentUser);
  const notifIdStr = String(notificationId).trim();

  if (userId && isValidUuid(userId) && supabase) {
    try {
      await supabase
        .from("notifications")
        .delete()
        .eq("id", notifIdStr)
        .eq("user_id", userId);
    } catch (err) {
      console.error("[notificationService] Failed to delete notification in DB:", err);
    }
  }

  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("connected_notification_change", {
      detail: { action: "delete", notificationId: notifIdStr, userId }
    }));
  }
};
