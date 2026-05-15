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
  emerald: { icon: "text-green-600", bg: "bg-green-50", hover: "hover:border-green-200 hover:shadow-md" },
  blue:    { icon: "text-blue-600",  bg: "bg-blue-50",  hover: "hover:border-blue-200 hover:shadow-md" },
  red:     { icon: "text-red-600",   bg: "bg-red-50",   hover: "hover:border-red-200 hover:shadow-md" },
};

export function TeacherDashboard() {
  const navigate = useNavigate();
  const [teacherName, setTeacherName] = useState("");
  const [teacherFirstName, setTeacherFirstName] = useState("");
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

    const tableName = "school_announcements";
    setAnnouncementTable(tableName);
    return tableName;
  };

  const loadAnnouncements = async () => {
    if (!supabase) {
      throw new Error("Supabase client is not configured.");
    }

    const { data, error } = await supabase
      .from("school_announcements")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      throw new Error(error.message);
    }

    const rows = data ?? [];

    let attachmentRowsByAnnouncementId = new Map();
    try {
      const { data: attachmentData, error: attachmentError } = await supabase
        .from("announcement_attachments")
        .select("school_announcement_id, file_url, file_name, file_path, file_type, created_at")
        .in("school_announcement_id", rows.map((r) => String(r.id)).filter(Boolean));

      if (!attachmentError && attachmentData) {
        for (const attachment of attachmentData) {
          const announcementId = String(attachment.school_announcement_id || "");
          const list = attachmentRowsByAnnouncementId.get(announcementId) || [];
          list.push(attachment);
          attachmentRowsByAnnouncementId.set(announcementId, list);
        }
      }
    } catch (e) {
      console.warn("Failed to load attachments:", e);
    }

    return sortAnnouncements(
      rows
        .map((row) => normalizeAnnouncement(row, attachmentRowsByAnnouncementId.get(String(row.id)) || []))
        .filter((item) => item.id)
    );
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
    setTeacherFirstName(user.first_name || "");
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

  // Handle announcement modal (ESC key, body scroll, click-outside)
  useEffect(() => {
    if (!selectedAnnouncement) return;

    // Disable body scroll when modal is open
    document.body.style.overflow = "hidden";

    // Handle ESC key to close modal
    const handleKeyDown = (e) => {
      if (e.key === "Escape") {
        setSelectedAnnouncement(null);
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "unset";
    };
  }, [selectedAnnouncement]);

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

  const getFirstName = (fullName) => {
    if (!fullName) return "Educator";
    // Split by space first (for "John Doe" format)
    const parts = fullName.split(/\s+/).filter(Boolean);
    if (parts.length > 0) {
      const firstName = parts[0];
      // If it looks like an email (has dot), extract before the dot
      if (firstName.includes(".")) {
        return firstName.split(".")[0];
      }
      return firstName;
    }
    return fullName;
  };

  if (loading) {
    return <LoadingScreen message="Loading dashboard..." />;
  }

  return (
    <div className="min-h-screen bg-gray-50 flex">
      <TeacherSidebar teacherName={teacherName} onLogout={handleLogout} />

      <main className="flex-1 flex flex-col min-h-screen lg:pl-64">
        {/* Top Bar */}
        <div className="bg-white border-b border-gray-200 sticky top-0 z-20 flex-shrink-0">
          <div className="px-6 py-4 flex items-center justify-between">
            <div>
              <p className="text-green-600 text-xs font-bold uppercase tracking-widest">Teacher Portal</p>
              <h2 className="text-lg font-bold text-gray-900">Dashboard</h2>
            </div>
            <NotificationDropdown
              notifications={notificationList}
              onMarkAsRead={(id) => setNotificationList((prev) => prev.map((n) => n.id === id ? { ...n, isRead: true } : n))}
              onNotificationsChange={setNotificationList}
            />
          </div>
        </div>

        <div className="flex-1 p-6 space-y-6">

          {/* Welcome Banner */}
          <div className="bg-gradient-to-r from-green-600 to-emerald-500 rounded-2xl p-6 text-white shadow-md relative overflow-hidden">
            <div className="absolute top-0 right-0 p-4 opacity-20">
              <div className="flex flex-col items-end gap-1">
                <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-white text-green-700">SY 2026-2027</span>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-green-200 text-green-800">Term 1</span>
              </div>
            </div>
            <div className="flex items-center gap-2 mb-1">
              <div className="w-2 h-2 rounded-full bg-green-200 animate-pulse" />
              <p className="text-green-100 text-xs font-bold uppercase tracking-widest">{getGreeting()}</p>
            </div>
            <h1 className="text-2xl font-bold text-white">
              Welcome back, {teacherFirstName || getFirstName(teacherName)}!
            </h1>
            <p className="text-green-100 text-sm mt-1">Here's an overview of your teaching responsibilities for the current term.</p>
          </div>

          {/* Stats Row */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[
              { icon: BookOpen,    label: "Total Classes",   value: totalClasses,  color: "emerald" },
              { icon: Users,       label: "Total Students",  value: totalStudents,   color: "blue" },
              { icon: GraduationCap, label: "Grades Encoded", value: gradesEncodedTotal, color: "emerald" },
            ].map((stat) => {
              const Icon = stat.icon;
              const c = colorMap[stat.color];
              return (
                <div key={stat.label} className={`bg-white border border-gray-100 rounded-2xl p-6 shadow-sm transition-all ${c.hover}`}>
                  <div className={`w-12 h-12 ${c.bg} rounded-xl flex items-center justify-center mb-4`}>
                    <Icon className={`w-5 h-5 ${c.icon}`} />
                  </div>
                  <p className="text-3xl font-bold text-gray-900">{stat.value}</p>
                  <p className="text-sm text-gray-500 font-medium">{stat.label}</p>
                </div>
              );
            })}
          </div>

          {/* ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ Main Grid ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

            {/* Left Ã¢â‚¬â€ Main Content */}
            <div className="lg:col-span-2 flex flex-col gap-6">

              {/* Top row: Tasks & Grades */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
                {/* Tasks & Deadlines */}
                <div className="bg-white border border-gray-100 rounded-2xl p-6 shadow-sm">
                  <h3 className="text-gray-900 font-bold text-base mb-4 flex items-center gap-2 border-b border-gray-100 pb-4">
                    <ClipboardCheck className="w-5 h-5 text-blue-400" />
                    Tasks & Deadlines
                  </h3>
                  <div className="text-center py-8 flex flex-col items-center justify-center">
                    <div className="w-12 h-12 bg-blue-50 rounded-2xl flex items-center justify-center mx-auto mb-3 border border-blue-100">
                      <ClipboardCheck className="w-6 h-6 text-blue-500" />
                    </div>
                    <p className="text-gray-900 font-bold">You're all caught up!</p>
                    <p className="text-gray-500 text-sm mt-1">No pending tasks or deadlines.</p>
                  </div>
                </div>

                {/* Recent Grades */}
                <div className="bg-white border border-gray-100 rounded-2xl overflow-hidden shadow-sm">
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
                        <p className="text-gray-700 font-medium">No grades recorded yet</p>
                      </div>
                    ) : (
                      <div className="space-y-3 w-full">
                        {recentGrades.map((grade) => (
                          <div key={grade.id} className="flex items-center justify-between px-4 py-3 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors border border-transparent hover:border-gray-200">
                            <div>
                              <p className="text-gray-900 text-sm font-bold">{grade.studentName}</p>
                              <p className="text-gray-500 text-xs mt-0.5">{grade.subject} - {new Date(grade.dateRecorded).toLocaleDateString()}</p>
                            </div>
                            <p className="text-lg font-bold text-green-600 bg-green-50 px-3 py-1 rounded-lg border border-green-200">{grade.grade}%</p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* School Announcements — full width */}

              <div className="bg-white border border-gray-100 rounded-2xl overflow-hidden shadow-sm">
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
                            <p className="text-sm font-bold text-gray-900 line-clamp-1">{announcement.title || "Untitled announcement"}</p>
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
              <div className="bg-white border border-gray-100 rounded-2xl overflow-hidden shadow-sm">
                <DashboardCalendar viewerRole="teacher" />
              </div>
            </div>
          </div>
        </div>
      </main>

      {selectedAnnouncement && (
        <div 
          className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-300"
          onClick={() => setSelectedAnnouncement(null)}
        >
          <div 
            className="w-full max-w-4xl max-h-[90vh] rounded-2xl bg-white border border-gray-200 shadow-2xl overflow-hidden flex flex-col animate-in fade-in scale-in-95 duration-300"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
              <h3 className="text-gray-900 text-lg font-bold">Announcement Details</h3>
              <button
                type="button"
                onClick={() => setSelectedAnnouncement(null)}
                className="p-1.5 rounded-lg text-gray-500 hover:text-gray-700 hover:bg-gray-100 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="px-6 py-5 space-y-4 overflow-y-auto flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold border ${getPriorityStyles(selectedAnnouncement.priority)}`}>
                  {selectedAnnouncement.priority}
                </span>
                <span className="text-xs text-gray-500">{formatAnnouncementDate(selectedAnnouncement.createdAt)}</span>
                <span className="text-xs text-gray-500">•</span>
                <span className="text-xs text-gray-500">{selectedAnnouncement.targetAudience}</span>
              </div>

              <h4 className="text-gray-900 text-lg font-bold break-words">{selectedAnnouncement.title || "Untitled announcement"}</h4>
              <p className="text-sm text-gray-700 whitespace-pre-line leading-relaxed break-words">{selectedAnnouncement.content || "No content."}</p>

              {Array.isArray(selectedAnnouncement.attachments) && selectedAnnouncement.attachments.length > 0 && (
                <div className="pt-2 space-y-3">
                  <div className="text-xs font-semibold uppercase tracking-wide text-gray-400">Attachments</div>
                  <div className="grid gap-3">
                    {selectedAnnouncement.attachments.map((attachment, index) => (
                      <AnnouncementAttachmentPreview
                        key={`${selectedAnnouncement.id}-attachment-${index}`}
                        attachment={attachment}
                        index={index}
                        announcementId={selectedAnnouncement.id}
                        variant="light"
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
