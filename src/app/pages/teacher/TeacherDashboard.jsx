import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { TeacherSidebar } from "@/app/components/TeacherSidebar";
import {
  BookOpen, Users, Megaphone, TrendingUp, Calendar,
  MessageSquare, ClipboardCheck, Plus, ArrowRight,
  GraduationCap, BarChart2, Bell, X
} from "lucide-react";
import { DashboardCalendar } from "@/app/components/DashboardCalendar";
import { NotificationDropdown } from "@/app/components/NotificationDropdown";
import { LoadingScreen } from "@/app/components/LoadingScreen";
import { AnnouncementAttachmentPreview } from "@/app/components/AnnouncementAttachmentPreview";
import { supabase } from "@/app/lib/supabaseClient";
import {
  normalizeAudience,
  normalizePriority,
  normalizeTimestamp,
  normalizeAnnouncement,
  sortAnnouncements,
  resolveColumnName,
  matchesTeacherAudience,
  formatAnnouncementDate,
  getPriorityStyles
} from "@/app/lib/teacherHelpers";

const colorMap = {
  green: { icon: "text-green-600", bg: "bg-green-50", hover: "hover:border-green-500/40 hover:bg-green-500/5" },
  blue:    { icon: "text-blue-400",    bg: "bg-blue-50",    hover: "hover:border-blue-500/40 hover:bg-blue-500/5" },
  red:     { icon: "text-red-400",     bg: "bg-red-50",     hover: "hover:border-red-500/40 hover:bg-red-500/5" },
};

export function TeacherDashboard() {
  const navigate = useNavigate();
  const [teacherName, setTeacherName] = useState("");
  const [notificationList, setNotificationList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [recentGrades, setRecentGrades] = useState([]);
  const [teacherId, setTeacherId] = useState("");
  const [assignedSubjects, setAssignedSubjects] = useState([]);
  const [totalStudents, setTotalStudents] = useState(0);
  const [gradesEncodedTotal, setGradesEncodedTotal] = useState(0);
  const [teacherEmail, setTeacherEmail] = useState("");
  const [announcements, setAnnouncements] = useState([]);
  const [announcementTable, setAnnouncementTable] = useState("");
  const [announcementsError, setAnnouncementsError] = useState("");
  const [selectedAnnouncement, setSelectedAnnouncement] = useState(null);
  const totalClasses = assignedSubjects.length;

  const getAnnouncementTableName = async () => {
    if (!supabase) {
      throw new Error("Supabase client is not configured.");
    }

    const tableName = "announcements";
    setAnnouncementTable(tableName);
    return tableName;
  };

  const loadAnnouncements = async () => {
    if (!supabase) {
      throw new Error("Supabase client is not configured.");
    }

    const { data, error } = await supabase
      .from("announcements")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      throw new Error(error.message);
    }

    return sortAnnouncements((data ?? []).map(normalizeAnnouncement).filter((item) => item.id));
  };

  const refreshAnnouncements = async () => {
    const rows = await loadAnnouncements();
    setAnnouncements(rows);
    return rows;
  };

  const resolveTeacherIdByEmail = async (email) => {
    if (!supabase || !email) return;

    try {
      const normalizedEmail = String(email).trim().toLowerCase();
      const { data, error } = await supabase
        .from("profiles")
        .select("id")
        .ilike("email", normalizedEmail)
        .eq("role", "teacher")
        .limit(1)
        .maybeSingle();

      if (error) {
        console.error("Error resolving teacher profile:", error);
        return;
      }

      if (data) {
        setTeacherId(String(data.id || ""));
      }
    } catch (error) {
      console.error("Failed to resolve teacher profile:", error);
    }
  };

  const fetchTeacherSubjects = async (id) => {
    if (!supabase || !id) {
      setAssignedSubjects([]);
      return;
    }

    const { data, error } = await supabase
      .from("subjects")
      .select("id")
      .eq("teacher_id", id);

    if (error) {
      console.error("Error fetching teacher subjects:", error);
      return;
    }

    setAssignedSubjects(data ?? []);
  };

  const fetchTeacherStudentTotal = async (id) => {
    if (!supabase || !id) {
      setTotalStudents(0);
      return;
    }

    const { data, error } = await supabase
      .from("teacher_student_assignments")
      .select("student_id")
      .eq("teacher_id", id);

    if (error) {
      console.error("Error fetching teacher student total:", error);
      setTotalStudents(0);
      return;
    }

    const uniqueStudentCount = new Set(
      (data ?? []).map((row) => String(row.student_id || "")).filter(Boolean)
    ).size;

    setTotalStudents(uniqueStudentCount);
  };

  const fetchGradesEncodedTotal = async (id) => {
    if (!supabase || !id) {
      setGradesEncodedTotal(0);
      return;
    }

    const { count, error } = await supabase
      .from("teacher_student_grades")
      .select("id", { count: "exact", head: true })
      .eq("teacher_id", id);

    if (error) {
      console.error("Error fetching grades encoded total:", error);
      setGradesEncodedTotal(0);
      return;
    }

    setGradesEncodedTotal(Number(count || 0));
  };

  const fetchRecentGrades = async (id) => {
    if (!supabase || !id) {
      setRecentGrades([]);
      return;
    }

    const { data: gradeRows, error: gradeError } = await supabase
      .from("teacher_student_grades")
      .select("id, student_id, subject_id, overall_grade, updated_at")
      .eq("teacher_id", id)
      .order("updated_at", { ascending: false })
      .limit(5);

    if (gradeError) {
      console.error("Error fetching recent grades:", gradeError);
      setRecentGrades([]);
      return;
    }

    const rows = gradeRows ?? [];
    if (rows.length === 0) {
      setRecentGrades([]);
      return;
    }

    const studentIds = [...new Set(rows.map((row) => String(row.student_id || "")).filter(Boolean))];
    const subjectIds = [...new Set(rows.map((row) => String(row.subject_id || "")).filter(Boolean))];

    const [{ data: students }, { data: subjects }] = await Promise.all([
      studentIds.length
        ? supabase
          .from("profiles")
          .select("id, first_name, middle_name, last_name")
          .in("id", studentIds)
        : Promise.resolve({ data: [] }),
      subjectIds.length
        ? supabase
          .from("subjects")
          .select("id, code, name")
          .in("id", subjectIds)
        : Promise.resolve({ data: [] })
    ]);

    const studentMap = new Map(
      (students ?? []).map((student) => {
        const fullName = [student.first_name, student.middle_name, student.last_name]
          .map((part) => String(part || "").trim())
          .filter(Boolean)
          .join(" ")
          .trim() || "Student";
        return [String(student.id), fullName];
      })
    );

    const subjectMap = new Map(
      (subjects ?? []).map((subject) => {
        const label = [String(subject.code || "").trim(), String(subject.name || "").trim()]
          .filter(Boolean)
          .join(" - ") || "Subject";
        return [String(subject.id), label];
      })
    );

    const mapped = rows.map((row) => ({
      id: String(row.id),
      studentName: studentMap.get(String(row.student_id || "")) || "Student",
      subject: subjectMap.get(String(row.subject_id || "")) || "Subject",
      dateRecorded: row.updated_at,
      grade: Number(row.overall_grade || 0)
    }));

    setRecentGrades(mapped);
  };

  useEffect(() => {
    const userData = localStorage.getItem("currentUser");
    if (!userData) { navigate("/login"); return; }
    const user = JSON.parse(userData);
    if (user.role !== "teacher") { navigate("/login"); return; }
    setTeacherName(user.name);
    setTeacherEmail(user.email || "");
    resolveTeacherIdByEmail(user.email);
    
    setTimeout(() => setLoading(false), 700);
  }, [navigate]);

  useEffect(() => {
    let isMounted = true;

    const initializeAnnouncements = async () => {
      try {
        const rows = await loadAnnouncements();

        if (isMounted) {
          setAnnouncements(rows);
          setAnnouncementsError("");
        }
      } catch (error) {
        if (isMounted) {
          setAnnouncementsError(error instanceof Error ? error.message : "Unable to load announcements.");
        }
      }
    };

    initializeAnnouncements();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (!teacherId) return;
    fetchTeacherSubjects(teacherId);
    fetchTeacherStudentTotal(teacherId);
    fetchGradesEncodedTotal(teacherId);
    fetchRecentGrades(teacherId);
  }, [teacherId]);

  useEffect(() => {
    if (!supabase || !teacherId) return;

    let isMounted = true;
    let subjectsChannel;
    let assignmentsChannel;
    let gradesChannel;

    const setupSubscription = async () => {
      try {
        subjectsChannel = supabase
          .channel(`teacher-dashboard-subjects-${teacherId}`)
          .on(
            "postgres_changes",
            {
              event: "*",
              schema: "public",
              table: "subjects"
            },
            (payload) => {
              if (!isMounted) return;
              const newTeacherId = String(payload?.new?.teacher_id || "");
              const oldTeacherId = String(payload?.old?.teacher_id || "");
              if (newTeacherId === teacherId || oldTeacherId === teacherId) {
                fetchTeacherSubjects(teacherId);
              }
            }
          )
          .subscribe();

        assignmentsChannel = supabase
          .channel(`teacher-dashboard-assignments-${teacherId}`)
          .on(
            "postgres_changes",
            {
              event: "*",
              schema: "public",
              table: "teacher_student_assignments",
              filter: `teacher_id=eq.${teacherId}`
            },
            () => {
              if (!isMounted) return;
              fetchTeacherStudentTotal(teacherId);
            }
          )
          .subscribe();

        gradesChannel = supabase
          .channel(`teacher-dashboard-grades-${teacherId}`)
          .on(
            "postgres_changes",
            {
              event: "*",
              schema: "public",
              table: "teacher_student_grades",
              filter: `teacher_id=eq.${teacherId}`
            },
            () => {
              if (!isMounted) return;
              fetchGradesEncodedTotal(teacherId);
              fetchRecentGrades(teacherId);
            }
          )
          .subscribe();
      } catch (error) {
        console.error("Failed to set up real-time subscription:", error);
      }
    };

    setupSubscription();

    return () => {
      isMounted = false;
      if (subjectsChannel) supabase.removeChannel(subjectsChannel);
      if (assignmentsChannel) supabase.removeChannel(assignmentsChannel);
      if (gradesChannel) supabase.removeChannel(gradesChannel);
    };
  }, [teacherId]);

  useEffect(() => {
    if (!supabase || !announcementTable) {
      return undefined;
    }

    const channel = supabase
      .channel(`teacher-dashboard-announcements-${announcementTable}`)
      .on("postgres_changes", { event: "*", schema: "public", table: announcementTable }, async () => {
        try {
          await refreshAnnouncements(announcementTable);
        } catch {
          // Keep current announcements if realtime refresh fails.
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [announcementTable]);

  const visibleAnnouncements = sortAnnouncements(announcements.filter((item) => matchesTeacherAudience(item.targetAudience))).slice(0, 6);

  const handleLogout = async () => {
    if (supabase) {
      await supabase.auth.signOut();
    }
    localStorage.removeItem("currentUser");
    navigate("/login");
  };

  const getGreeting = () => {
    const h = new Date().getHours();
    if (h < 12) return "Good morning";
    if (h < 17) return "Good afternoon";
    return "Good evening";
  };

  if (loading) {
    return <LoadingScreen message="Loading dashboard..." />;
  }

  return (
    <div className="min-h-screen bg-gray-50 flex relative overflow-hidden">
      {/* Background glow */}
      <div className="absolute inset-0 z-0 pointer-events-none">
        <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-green-100/50 rounded-full blur-[150px]" />
        <div className="absolute bottom-0 left-1/3 w-[500px] h-[500px] bg-blue-50/50 rounded-full blur-[130px]" />
        <div className="absolute top-1/2 right-1/4 w-[400px] h-[400px] bg-red-50/50 rounded-full blur-[120px]" />
      </div>

      <TeacherSidebar teacherName={teacherName} onLogout={handleLogout} />

      <main className="flex-1 overflow-y-auto scrollbar-hide relative z-10">
        {/* Top Bar */}
        <div className="bg-gray-1000 backdrop-blur-md border-b border-gray-200 sticky top-0 z-20 shadow-sm">
          <div className="px-6 py-4 flex items-center justify-between">
            <div>
              <p className="text-gray-500 text-xs font-medium uppercase tracking-widest">Teacher Portal</p>
              <h2 className="text-lg font-bold text-gray-900">Dashboard</h2>
            </div>
            <NotificationDropdown
              notifications={notificationList}
              onMarkAsRead={(id) => setNotificationList((prev) => prev.map((n) => n.id === id ? { ...n, isRead: true } : n))}
              onNotificationsChange={setNotificationList}
            />
          </div>
        </div>

        <div className="p-6 space-y-6">

          {/* Welcome Banner */}
          <div className="relative rounded-2xl overflow-hidden bg-white border border-gray-200 shadow-sm p-8">
            {/* Tri-color left stripe */}
            <div className="absolute left-0 top-0 bottom-0 w-1 flex flex-col">
              <div className="flex-1 bg-green-500" />
              <div className="flex-1 bg-blue-600" />
              <div className="flex-1 bg-red-600" />
            </div>
            {/* Glow */}
            <div className="absolute inset-0 bg-gradient-to-r from-green-50 via-blue-50/30 to-transparent pointer-events-none" />
            <div className="relative pl-4">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                <p className="text-green-600 text-xs font-semibold uppercase tracking-widest">{getGreeting()}</p>
              </div>
              <h1 className="text-3xl font-extrabold text-gray-900 mb-1 tracking-tight">
                Welcome back, <span className="text-green-600">{teacherName}!</span>
              </h1>
              <p className="text-gray-600">Here's an overview of your teaching responsibilities.</p>
            </div>
          </div>

          {/* Stats Row */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[
              { icon: BookOpen,    label: "Total Classes",   value: totalClasses,  color: "green" },
              { icon: Users,       label: "Total Students",  value: totalStudents,   color: "blue" },
              { icon: GraduationCap, label: "Grades Encoded", value: gradesEncodedTotal, color: "green" },
            ].map((stat) => {
              const Icon = stat.icon;
              const c = colorMap[stat.color];
              return (
                <div key={stat.label} className="bg-white border border-gray-200 shadow-sm rounded-2xl p-5 hover:border-green-300 transition-colors">
                  <div className={`w-9 h-9 ${c.bg} rounded-xl flex items-center justify-center mb-3`}>
                    <Icon className={`w-4 h-4 ${c.icon}`} />
                  </div>
                  <p className="text-2xl font-extrabold text-gray-900 mb-0.5">{stat.value}</p>
                  <p className="text-gray-600 text-xs">{stat.label}</p>
                </div>
              );
            })}
          </div>

          {/* Main Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

            {/* Left — Main Content */}
            <div className="lg:col-span-2 flex flex-col gap-6">

              {/* Top row: Tasks & Grades */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
                {/* Tasks & Deadlines */}
                <div className="bg-white border border-gray-200 shadow-sm rounded-2xl p-6">
                  <h3 className="text-gray-900 font-bold text-base mb-4 flex items-center gap-2 border-b border-gray-100 pb-4">
                    <ClipboardCheck className="w-5 h-5 text-blue-500" />
                    Tasks & Deadlines
                  </h3>
                  <div className="text-center py-8 flex flex-col items-center justify-center">
                    <div className="w-12 h-12 bg-blue-50 rounded-2xl flex items-center justify-center mx-auto mb-3 border border-blue-100">
                      <ClipboardCheck className="w-6 h-6 text-blue-500" />
                    </div>
                    <p className="text-gray-600 font-medium">You're all caught up!</p>
                    <p className="text-gray-500 text-sm mt-1">No pending tasks or deadlines.</p>
                  </div>
                </div>

                {/* Recent Grades */}
                <div className="bg-white border border-gray-200 shadow-sm rounded-2xl overflow-hidden">
                  <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
                    <h3 className="text-gray-900 font-bold flex items-center gap-2">
                      <TrendingUp className="w-5 h-5 text-green-500" />
                      Recently Updated Grades
                    </h3>
                  </div>
                  <div className="p-6">
                    {recentGrades.length === 0 ? (
                      <div className="text-center py-6">
                        <div className="w-12 h-12 bg-green-50 border border-green-100 rounded-2xl flex items-center justify-center mx-auto mb-3">
                          <TrendingUp className="w-6 h-6 text-green-500" />
                        </div>
                        <p className="text-gray-600 font-medium">No grades recorded yet</p>
                      </div>
                    ) : (
                      <div className="space-y-3 w-full">
                        {recentGrades.map((grade) => (
                          <div key={grade.id} className="flex items-center justify-between px-4 py-3 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors border border-transparent hover:border-gray-200">
                            <div>
                              <p className="text-gray-900 text-sm font-medium">{grade.studentName}</p>
                              <p className="text-gray-500 text-xs mt-0.5">{grade.subject} - {new Date(grade.dateRecorded).toLocaleDateString()}</p>
                            </div>
                            <p className="text-lg font-bold text-green-600 bg-green-50 px-3 py-1 rounded-lg border border-green-100">{grade.grade}%</p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* School Announcements — full width */}

              <div className="bg-white border border-gray-200 shadow-sm rounded-2xl overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
                  <h3 className="text-gray-900 font-bold flex items-center gap-2">
                    <Megaphone className="w-5 h-5 text-green-500" />
                    Announcements
                  </h3>
                </div>

                <div className="p-6">
                  {announcementsError && (
                    <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-600">
                      {announcementsError}
                    </div>
                  )}

                  {visibleAnnouncements.length === 0 ? (
                    <div className="text-center py-6 text-gray-500">No teacher announcements yet</div>
                  ) : (
                    <div className="space-y-3">
                      {visibleAnnouncements.map((announcement) => (
                        <button
                          key={announcement.id}
                          type="button"
                          onClick={() => setSelectedAnnouncement(announcement)}
                          className="w-full text-left px-4 py-3 bg-gray-50 rounded-xl border border-transparent hover:border-gray-200 hover:bg-gray-100 transition-colors"
                        >
                          <div className="flex items-start justify-between gap-3 mb-1.5">
                            <p className="text-sm font-semibold text-gray-900 line-clamp-1">{announcement.title || "Untitled announcement"}</p>
                            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border ${getPriorityStyles(announcement.priority)}`}>
                              {announcement.priority}
                            </span>
                          </div>
                          <p className="text-xs text-gray-600 line-clamp-2">{announcement.content || "No content."}</p>
                          <div className="mt-2 flex items-center gap-2 text-[11px] text-gray-500">
                            <span>{formatAnnouncementDate(announcement.createdAt)}</span>
                            <span>•</span>
                            <span>{announcement.targetAudience}</span>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Right Column */}
            <div className="space-y-6">
              {/* Calendar */}
              <div className="bg-white border border-gray-200 shadow-sm rounded-2xl overflow-hidden">
                <DashboardCalendar viewerRole="teacher" />
              </div>
            </div>
          </div>
        </div>
      </main>

      {selectedAnnouncement && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-2xl rounded-2xl bg-white border border-gray-200 shadow-2xl overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-gray-50">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-green-50 rounded-xl border border-green-100">
                  <Megaphone className="w-5 h-5 text-green-600" />
                </div>
                <h3 className="text-lg font-bold text-gray-900">Announcement Details</h3>
              </div>
              <button onClick={() => setSelectedAnnouncement(null)} className="p-2 text-gray-500 hover:text-gray-900 hover:bg-gray-200 rounded-xl transition-all">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="px-6 py-5 space-y-4">
              <div className="flex flex-wrap items-center gap-2">
                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold border ${getPriorityStyles(selectedAnnouncement.priority)}`}>
                  {selectedAnnouncement.priority}
                </span>
                <span className="text-xs text-gray-500">{formatAnnouncementDate(selectedAnnouncement.createdAt)}</span>
                <span className="text-xs text-gray-500">•</span>
                <span className="text-xs text-gray-500">{selectedAnnouncement.targetAudience}</span>
              </div>

              <h4 className="text-gray-900 text-lg font-bold">{selectedAnnouncement.title || "Untitled announcement"}</h4>
              <p className="text-sm text-gray-700 whitespace-pre-line leading-relaxed">{selectedAnnouncement.content || "No content."}</p>

              {Array.isArray(selectedAnnouncement.attachments) && selectedAnnouncement.attachments.length > 0 && (
                <div className="pt-2 space-y-3">
                  <div className="text-xs font-semibold uppercase tracking-wide text-gray-600">Attachments</div>
                  <div className="grid gap-3">
                    {selectedAnnouncement.attachments.map((attachment, index) => (
                      <AnnouncementAttachmentPreview
                        key={`${selectedAnnouncement.id}-attachment-${index}`}
                        attachment={attachment}
                        index={index}
                        announcementId={selectedAnnouncement.id}
                        variant="dark"
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default TeacherDashboard;
