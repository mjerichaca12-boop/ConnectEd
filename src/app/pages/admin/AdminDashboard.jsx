import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { AdminSidebar } from "../../components/AdminSidebar";
import { supabase, supabaseAdmin } from "../../lib/supabaseClient";

const db = supabaseAdmin || supabase;
import { useActivity } from "../../lib/ActivityContext";
import {
  Users,
  UserCog,
  BookOpen,
  Activity,
  FileText,
  Megaphone,
  AlertTriangle,
  Loader2,
  Sparkles,
  Key
} from "lucide-react";
import { NotificationDropdown } from "../../components/NotificationDropdown";
import { adminNotifications } from "../../components/NotificationDefault";

const subjectTableCandidates = ["subjects"];

export function AdminDashboard() {
  const navigate = useNavigate();
  const { activities: contextActivities, logActivity } = useActivity();
  const [adminName, setAdminName] = useState("");
  const [notificationList, setNotificationList] = useState(adminNotifications);
  const [teacherOptions, setTeacherOptions] = useState([]);
  const [subjectOptions, setSubjectOptions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalStudents: 0,
    totalTeachers: 0,
    totalSubjects: 0,
    totalEnrollments: 0,
    activeAnnouncements: 0,
    newStudentsThisMonth: 0,
    newTeachersThisMonth: 0,
    totalPendingResets: 0
  });
  const [statsLoading, setStatsLoading] = useState(true);
  const [statsError, setStatsError] = useState("");
  const [recentActivity, setRecentActivity] = useState([]);
  const [activityLoading, setActivityLoading] = useState(true);
  const [activityError, setActivityError] = useState("");

  const normalizeRecentActivity = (source) => {
    const seenKeys = new Set();

    return (source || [])
      .filter(Boolean)
      .filter((activity) => {
        const key = activity.key || activity.id;
        if (!key) return false;
        if (seenKeys.has(key)) return false;
        seenKeys.add(key);
        return true;
      })
      .sort((left, right) => new Date(right.timestamp) - new Date(left.timestamp))
      .slice(0, 5);
  };

  const getSubjectLabel = (subjectId) => {
    const subject = subjectOptions.find((item) => item.id === subjectId);
    if (!subject) return subjectId || "Unknown subject";
    return `${subject.code} - ${subject.name}`;
  };

  const getTeacherLabel = (teacherId) => {
    const teacher = teacherOptions.find((item) => item.id === teacherId);
    if (!teacher) return teacherId || "Unknown teacher";
    return teacher.name;
  };

  const fetchSubjectOptions = async () => {
    if (!supabase) {
      throw new Error("Supabase client is not configured.");
    }

    const { data, error } = await db
      .from("subjects")
      .select("id, code, name")
      .order("code", { ascending: true });

    if (error) {
      throw new Error(error.message);
    }

    setSubjectOptions(data ?? []);
  };

  const fetchTeacherOptions = async () => {
    if (!supabase) {
      throw new Error("Supabase client is not configured.");
    }

    const { data, error } = await db
      .from("profiles")
      .select("id, first_name, middle_name, last_name, email, role")
      .eq("role", "teacher")
      .order("first_name", { ascending: true });

    if (error) {
      throw new Error(error.message);
    }

    setTeacherOptions((data ?? []).map((teacher) => ({
      id: teacher.id,
      name: [teacher.first_name, teacher.middle_name, teacher.last_name].filter(Boolean).join(" ").trim() || teacher.email || "Unknown teacher"
    })));
  };

  const toProfileRealtimeActivityPayload = (payload) => {
    const current = payload?.new || {};
    const previous = payload?.old || {};
    const entityType = current.role || previous.role;

    if (entityType !== "student" && entityType !== "teacher") {
      return null;
    }

    const entityName = entityType === "student"
      ? [current.first_name, current.middle_name, current.last_name, previous.first_name, previous.middle_name, previous.last_name]
          .filter(Boolean)
          .slice(0, 3)
          .join(" ")
      : current.first_name || previous.first_name || "Unknown teacher";

    const basePayload = {
      entityType,
      entityId: current.id || previous.id,
      entityName,
      user: "System",
      timestamp: current.updated_at || current.created_at || payload?.commit_timestamp || new Date().toISOString()
    };

    if (payload.eventType === "INSERT") {
      return {
        ...basePayload,
        actionType: "added",
        timestamp: current.created_at || basePayload.timestamp
      };
    }

    if (payload.eventType === "DELETE") {
      return {
        ...basePayload,
        actionType: "assigned_class",
        details: { assignedClass: nextClass }
      };
    }

    if (payload.eventType === "UPDATE") {
      if (entityType === "teacher") {
        const previousClass = previous.assigned_class || "";
        const nextClass = current.assigned_class || "";
        if (nextClass && nextClass !== previousClass) {
          return {
            ...basePayload,
            actionType: "assigned_class",
            details: { assignedClass: nextClass }
          };
        }

        const prevSubjects = Array.isArray(previous.subjects)
          ? previous.subjects
          : previous.subjects
            ? String(previous.subjects).split(",").map((item) => item.trim()).filter(Boolean)
            : [];
        const nextSubjects = Array.isArray(current.subjects)
          ? current.subjects
          : current.subjects
            ? String(current.subjects).split(",").map((item) => item.trim()).filter(Boolean)
            : [];

        const addedSubjects = nextSubjects.filter((subjectId) => !prevSubjects.includes(subjectId));
        const removedSubjects = prevSubjects.filter((subjectId) => !nextSubjects.includes(subjectId));

        if (addedSubjects.length > 0 || removedSubjects.length > 0) {
          return {
            ...basePayload,
            actionType: addedSubjects.length > 0 && removedSubjects.length === 0
              ? "assigned_subject_to_teacher"
              : removedSubjects.length > 0 && addedSubjects.length === 0
                ? "removed_subject_from_teacher"
                : "updated_teacher_subject_assignment",
            details: {
              subjects: nextSubjects.map((subjectId) => getSubjectLabel(subjectId)),
              addedSubjects: addedSubjects.map((subjectId) => getSubjectLabel(subjectId)),
              removedSubjects: removedSubjects.map((subjectId) => getSubjectLabel(subjectId))
            }
          };
        }
      }

      return {
        ...basePayload,
        actionType: "updated"
      };
    }

    return null;
  };

  const toSubjectRealtimeActivityPayload = (payload) => {
    const current = payload?.new || {};
    const previous = payload?.old || {};
    const subjectId = current.id || previous.id;
    const code = current.code || previous.code || "UNKNOWN";
    const name = current.name || previous.name || "Unknown subject";
    const entityName = `${code} - ${name}`;

    const basePayload = {
      entityType: "subject",
      entityId: subjectId,
      entityName,
      user: "System",
      timestamp: current.updated_at || current.created_at || payload?.commit_timestamp || new Date().toISOString()
    };

    if (payload.eventType === "INSERT") {
      return {
        ...basePayload,
        actionType: "added",
        timestamp: current.created_at || basePayload.timestamp
      };
    }

    if (payload.eventType === "DELETE") {
      return {
        ...basePayload,
        actionType: "deleted",
        timestamp: payload?.commit_timestamp || new Date().toISOString()
      };
    }

    if (payload.eventType === "UPDATE") {
      const previousTeacher = previous.teacher_id || "";
      const nextTeacher = current.teacher_id || "";

      if (nextTeacher && nextTeacher !== previousTeacher) {
        return {
          ...basePayload,
          actionType: previousTeacher ? "updated_teacher_subject_assignment" : "assigned_subject_to_teacher",
          details: { teacher: getTeacherLabel(nextTeacher) }
        };
      }

      if (!nextTeacher && previousTeacher) {
        return {
          ...basePayload,
          actionType: "removed_subject_from_teacher",
          details: { teacher: getTeacherLabel(previousTeacher) }
        };
      }

      return {
        ...basePayload,
        actionType: "updated"
      };
    }

    return null;
  };

  const fetchDashboardCounts = async () => {
    if (!supabase) {
      throw new Error("Supabase client is not configured.");
    }

    const fetchSubjectsCount = async () => {
      for (const tableName of subjectTableCandidates) {
        const result = await db.from(tableName).select("id", { count: "exact", head: true });
        if (!result.error) {
          return result.count ?? 0;
        }
      }

      return 0;
    };

    const [studentsResult, teachersResult, subjectsCount, pendingResetsResult] = await Promise.all([
      db.from("profiles").select("id", { count: "exact", head: true }).eq("role", "student"),
      db.from("profiles").select("id", { count: "exact", head: true }).eq("role", "teacher"),
      fetchSubjectsCount(),
      db.from("password_reset_requests").select("id", { count: "exact", head: true }).eq("status", "Pending")
    ]);

    if (studentsResult.error) {
      throw new Error(studentsResult.error.message);
    }

    if (teachersResult.error) {
      throw new Error(teachersResult.error.message);
    }

    setStats((current) => ({
      ...current,
      totalStudents: studentsResult.count ?? 0,
      totalTeachers: teachersResult.count ?? 0,
      totalSubjects: subjectsCount,
      totalPendingResets: pendingResetsResult.count ?? 0
    }));
  };

  const fetchRecentActivity = async () => {
    try {
      setRecentActivity(normalizeRecentActivity(contextActivities));
    } catch {
      throw new Error("Unable to load recent activity.");
    }
  };

  useEffect(() => {
    let isMounted = true;

    const userData = localStorage.getItem("currentUser");
    if (!userData) {
      navigate("/login");
      return;
    }
    const user = JSON.parse(userData);
    if (user.role !== "admin") {
      navigate("/login");
      return;
    }

    const initializeDashboard = async () => {
      try {
        setAdminName(user.name);
        setStatsLoading(true);
        setActivityLoading(true);
        setStatsError("");
        setActivityError("");
        await Promise.all([fetchDashboardCounts(), fetchSubjectOptions(), fetchTeacherOptions()]);
        await fetchRecentActivity();
      } catch (error) {
        if (isMounted) {
          const message = error instanceof Error ? error.message : "Unable to load dashboard data.";
          setStatsError(message);
          setActivityError(message);
        }
      } finally {
        if (isMounted) {
          setStatsLoading(false);
          setActivityLoading(false);
          setLoading(false);
        }
      }
    };

    initializeDashboard();

    const refreshDashboardData = async () => {
      try {
        await fetchDashboardCounts();
        await fetchSubjectOptions();
        await fetchTeacherOptions();
        await fetchRecentActivity();

        if (isMounted) {
          setStatsError("");
          setActivityError("");
        }
      } catch (error) {
        if (isMounted) {
          const message = error instanceof Error ? error.message : "Unable to refresh dashboard data.";
          setStatsError(message);
          setActivityError(message);
        }
      }
    };

    const profilesChannel = supabase
      ? supabase
          .channel("admin-dashboard-profiles")
          .on("postgres_changes", { event: "*", schema: "public", table: "profiles" }, (payload) => {
            const isTeacher = payload.new?.role === "teacher" || payload.old?.role === "teacher";
            const isStudent = payload.new?.role === "student" || payload.old?.role === "student";

            if (isTeacher || isStudent) {
              const nextActivity = toProfileRealtimeActivityPayload(payload);
              if (nextActivity) {
                logActivity(nextActivity);
              }
              void refreshDashboardData();
            }
          })
          .subscribe()
      : null;

    const subjectChannel = supabase
      ? supabase
          .channel("admin-dashboard-subject")
          .on("postgres_changes", { event: "*", schema: "public", table: "subjects" }, (payload) => {
            const nextActivity = toSubjectRealtimeActivityPayload(payload);
            if (nextActivity) {
              logActivity(nextActivity);
            }
            void refreshDashboardData();
          })
          .subscribe()
      : null;

    return () => {
      isMounted = false;
      if (profilesChannel) {
        supabase.removeChannel(profilesChannel);
      }
      if (subjectChannel) {
        supabase.removeChannel(subjectChannel);
      }
    };
  }, [navigate]);

  useEffect(() => {
    setRecentActivity(normalizeRecentActivity(contextActivities));
  }, [contextActivities]);

  const handleLogout = () => {
    localStorage.removeItem("currentUser");
    navigate("/login");
  };

  const getActivityIcon = (type, status) => {
    let baseIcon = null;
    let iconColor = "text-gray-600";

    // Determine color based on status
    if (status === "deleted") {
      iconColor = "text-red-600";
    } else if (status === "assigned") {
      iconColor = "text-amber-600";
    } else if (status === "updated") {
      iconColor = "text-blue-600";
    } else if (status === "created") {
      iconColor = type === "teacher" ? "text-green-600" : "text-blue-600";
    }

    // Determine icon based on type
    switch (type) {
      case "student":
        baseIcon = <Users className={`w-4 h-4 ${iconColor}`} />;
        break;
      case "teacher":
        baseIcon = <UserCog className={`w-4 h-4 ${iconColor}`} />;
        break;
      case "subject":
        baseIcon = <BookOpen className={`w-4 h-4 ${iconColor}`} />;
        break;
      case "enrollment":
        baseIcon = <FileText className={`w-4 h-4 ${iconColor}`} />;
        break;
      case "announcement":
        baseIcon = <Megaphone className={`w-4 h-4 ${iconColor}`} />;
        break;
      default:
        baseIcon = <Activity className={`w-4 h-4 ${iconColor}`} />;
    }

    return baseIcon;
  };

  const getActivityColor = (type, status) => {
    // Color by status first
    if (status === "deleted") {
      return "bg-red-50 border-red-200 text-red-900";
    }
    if (status === "assigned") {
      return "bg-amber-50 border-amber-200 text-amber-900";
    }
    if (status === "updated") {
      return "bg-blue-50 border-blue-200 text-blue-900";
    }
    if (status === "created") {
      return type === "teacher" ? "bg-green-50 border-green-200 text-green-900" : "bg-blue-50 border-blue-200 text-blue-900";
    }

    // Fallback to type-based color
    switch (type) {
      case "student":
        return "bg-blue-50 border-blue-200 text-blue-900";
      case "teacher":
        return "bg-green-50 border-green-200 text-green-900";
      case "subject":
        return "bg-blue-50 border-blue-200 text-blue-900";
      case "enrollment":
        return "bg-blue-50 border-blue-200 text-blue-900";
      case "announcement":
        return status === "deleted" ? "bg-red-50 border-red-200 text-red-900" : "bg-green-50 border-green-200 text-green-900";
      default:
        return "bg-gray-50 border-gray-200 text-gray-900";
    }
  };

  const formatTimestamp = (timestamp) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffInHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60);

    if (diffInHours < 1) {
      const minutes = Math.floor(diffInHours * 60);
      return `${minutes} minute${minutes !== 1 ? "s" : ""} ago`;
    } else if (diffInHours < 24) {
      const hours = Math.floor(diffInHours);
      return `${hours} hour${hours !== 1 ? "s" : ""} ago`;
    } else {
      return date.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit"
      });
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="flex gap-1.5 justify-center mb-4">
            <div className="w-3 h-3 rounded-full bg-green-500 animate-bounce" style={{animationDelay:'0ms'}} />
            <div className="w-3 h-3 rounded-full bg-blue-500 animate-bounce" style={{animationDelay:'150ms'}} />
            <div className="w-3 h-3 rounded-full bg-red-500 animate-bounce" style={{animationDelay:'300ms'}} />
          </div>
          <p className="text-gray-500 text-sm">Loading admin dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex relative overflow-hidden">
      <div className="absolute inset-0 z-0 pointer-events-none">
        <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-green-100/50 rounded-full blur-[150px]" />
        <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-blue-50/50 rounded-full blur-[120px]" />
        <div className="absolute top-1/2 right-1/4 w-[300px] h-[300px] bg-red-50/50 rounded-full blur-[100px]" />
      </div>

      <AdminSidebar adminName={adminName} onLogout={handleLogout} />

      <main className="flex-1 h-screen overflow-y-auto lg:pl-64">
        {/* Top Bar */}
        <div className="bg-white/80 backdrop-blur-md border-b border-gray-200 sticky top-0 z-20 relative shadow-sm">
          <div className="px-6 py-4">
            <div className="flex items-center justify-end gap-4">
              <NotificationDropdown
                notifications={notificationList}
                onMarkAsRead={(id) =>
                  setNotificationList((prev) =>
                    prev.map((n) => (n.id === id ? { ...n, isRead: true } : n))
                  )
                }
                onNotificationsChange={setNotificationList}
              />
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Welcome Section */}
          <div className="relative rounded-2xl p-8 shadow-sm overflow-hidden bg-white border border-gray-200">
            {/* Tri-color left accent */}
            <div className="absolute left-0 top-0 bottom-0 w-1 flex flex-col">
              <div className="flex-1 bg-green-500" />
              <div className="flex-1 bg-blue-600" />
              <div className="flex-1 bg-red-600" />
            </div>
            {/* Subtle glow */}
            <div className="absolute inset-0 bg-gradient-to-r from-green-50 via-blue-50/30 to-red-50/30 pointer-events-none" />
            <div className="relative pl-4">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                <span className="text-green-600 text-xs font-semibold uppercase tracking-widest">Admin Portal</span>
              </div>
              <h1 className="text-3xl font-bold mb-1 text-gray-900">{JSON.parse(localStorage.getItem("currentUser"))?.isFirstLogin ? "Welcome" : "Welcome back"}, {adminName}!</h1>
              <p className="text-gray-600">ConnectEd system overview and management center</p>
            </div>
          </div>

          {/* Main Layout Grid */}
          <div className="grid grid-cols-1 gap-6">
            <div className="space-y-6">
              {statsError && (
                <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 flex items-start gap-3">
                  <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                  <span>{statsError}</span>
                </div>
              )}

              {/* Primary Stats Cards */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-white rounded-xl p-6 border border-gray-200 shadow-sm hover:border-blue-300 transition-colors">
                  <div className="flex items-center justify-between mb-4">
                    <div className="p-3 bg-blue-50 rounded-xl border border-blue-100">
                      <Users className="w-6 h-6 text-blue-500" />
                    </div>
                  </div>
                  <p className="text-gray-600 text-sm mb-1">Total Students</p>
                  <p className="text-3xl font-bold text-gray-900">
                    {statsLoading ? <Loader2 className="w-7 h-7 animate-spin text-gray-600" /> : stats.totalStudents.toLocaleString()}
                  </p>
                </div>

                <div className="bg-white rounded-xl p-6 border border-gray-200 shadow-sm hover:border-green-300 transition-colors">
                  <div className="flex items-center justify-between mb-4">
                    <div className="p-3 bg-green-50 rounded-xl border border-green-100">
                      <UserCog className="w-6 h-6 text-green-500" />
                    </div>
                  </div>
                  <p className="text-gray-600 text-sm mb-1">Total Teachers</p>
                  <p className="text-3xl font-bold text-gray-900">
                    {statsLoading ? <Loader2 className="w-7 h-7 animate-spin text-gray-600" /> : stats.totalTeachers.toLocaleString()}
                  </p>
                </div>

                <div className="bg-white rounded-xl p-6 border border-gray-200 shadow-sm hover:border-purple-300 transition-colors">
                  <div className="flex items-center justify-between mb-4">
                    <div className="p-3 bg-purple-50 rounded-xl border border-purple-100">
                      <BookOpen className="w-6 h-6 text-purple-500" />
                    </div>
                  </div>
                  <p className="text-gray-600 text-sm mb-1">Total Subjects</p>
                  <p className="text-3xl font-bold text-gray-900">
                    {statsLoading ? <Loader2 className="w-7 h-7 animate-spin text-gray-600" /> : stats.totalSubjects.toLocaleString()}
                  </p>
                </div>

                <div className="bg-white rounded-xl p-6 border border-gray-200 shadow-sm hover:border-amber-300 transition-colors cursor-pointer" onClick={() => navigate("/admin/password-resets")}>
                  <div className="flex items-center justify-between mb-4">
                    <div className="p-3 bg-amber-50 rounded-xl border border-amber-100">
                      <Key className="w-6 h-6 text-amber-500" />
                    </div>
                  </div>
                  <p className="text-gray-600 text-sm mb-1">Pending Password Resets</p>
                  <div className="flex items-baseline gap-2">
                    <p className="text-3xl font-bold text-gray-900">
                      {statsLoading ? <Loader2 className="w-7 h-7 animate-spin text-gray-600" /> : stats.totalPendingResets.toLocaleString()}
                    </p>
                    {!statsLoading && stats.totalPendingResets > 0 && (
                      <span className="text-xs font-semibold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">Needs Action</span>
                    )}
                  </div>
                </div>
              </div>

              {/* Recent Activity */}
              <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                <div className="p-6 border-b border-gray-100 bg-gray-50">
                  <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                    <Activity className="w-5 h-5 text-green-500" />
                    Recent Activity
                  </h3>
                </div>
                <div className="p-6">
                  {activityLoading ? (
                    <div className="flex items-center justify-center py-8 text-gray-500">
                      <Loader2 className="w-5 h-5 animate-spin mr-2" />
                      Loading recent activity...
                    </div>
                  ) : activityError ? (
                    <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600 flex items-start gap-3">
                      <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                      <span>{activityError}</span>
                    </div>
                  ) : recentActivity.length === 0 ? (
                    <div className="text-center py-8">
                      <Activity className="w-12 h-12 text-gray-600 mx-auto mb-3" />
                      <p className="text-gray-500">No recent activity yet</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {recentActivity.map((activity) => (
                        <div
                          key={activity.id}
                          className={`flex items-start gap-3 p-4 rounded-xl border ${getActivityColor(
                            activity.type,
                            activity.status
                          )}`}
                        >
                          <div className="mt-0.5">{getActivityIcon(activity.type, activity.status)}</div>
                          <div className="flex-1">
                            <p className="font-medium text-gray-900">{activity.action}</p>
                            <p className="text-sm text-gray-600">{activity.user}</p>
                          </div>
                          <p className="text-xs text-gray-500 whitespace-nowrap">
                            {formatTimestamp(activity.timestamp)}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>


            </div>
          </div>
        </div>
        
        {/* Floating AI Assistant Button */}
        <button 
          onClick={() => navigate("/admin/ai-assistant")}
          className="fixed bottom-6 right-6 z-50 bg-green-600 hover:bg-green-700 text-white rounded-2xl px-4 py-3 flex items-center gap-2 shadow-lg shadow-green-600/20 transition-all"
        >
          <Sparkles className="w-5 h-5" />
          Ask AI Assistant
        </button>
      </main>
    </div>
  );
}

export default AdminDashboard;
