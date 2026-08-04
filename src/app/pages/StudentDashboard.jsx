import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";
import { Sidebar } from "../components/Sidebar";
import {
  BookOpen,
  TrendingUp,
  Calendar,
  Megaphone,
  CheckCircle,
  XCircle,
  AlertCircle,
  ArrowRight,
  GraduationCap,
  Clock
} from "lucide-react";
import { DashboardCalendar } from "../components/DashboardCalendar";
import { NotificationDropdown } from "../components/NotificationDropdown";

export function StudentDashboard() {
  const navigate = useNavigate();
  const [studentName, setStudentName] = useState("");
  const [studentId, setStudentId] = useState("");
  const [notificationList, setNotificationList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [subjects, setSubjects] = useState([]);
  const [recentGrades, setRecentGrades] = useState([]);
  const [recentAttendance, setRecentAttendance] = useState([]);
  const [announcements, setAnnouncements] = useState([]);
  const [upNext] = useState([
    { id: 1, title: "Math Assignment 1", due: "Tomorrow, 11:59 PM", type: "Assignment" },
    { id: 2, title: "Science Term Paper", due: "Friday, 5:00 PM", type: "Project" }
  ]);

  const fetchDashboardData = async (currentStudentId) => {
    try {
      // Fetch subjects with teacher info
      const { data: assignments, error: subError } = await supabase
        .from("teacher_student_assignments")
        .select(`
          subject_id,
          subjects (
            id,
            code,
            name,
            profiles!teacher_id (
              first_name,
              last_name
            )
          )
        `)
        .eq("student_id", currentStudentId);
      
      if (!subError && assignments) {
        const formatted = assignments.map(a => {
          const s = a.subjects;
          return {
            id: s.id,
            code: s.code,
            name: s.name,
            teacher: s.profiles ? `${s.profiles.first_name} ${s.profiles.last_name}` : "Unknown Teacher"
          };
        });
        setSubjects(formatted);
      }

      // Fetch recent grades
      const { data: gradeRows } = await supabase
        .from("teacher_student_grades")
        .select("*, subjects(name)")
        .eq("student_id", currentStudentId)
        .order("updated_at", { ascending: false })
        .limit(3);
      
      if (gradeRows) {
        setRecentGrades(gradeRows.map(row => ({
          id: row.id,
          subjectName: row.subjects?.name || "Subject",
          value: row.overall_grade,
          dateRecorded: row.updated_at || row.created_at
        })));
      }

      // Fetch 3 most recent announcements for students
      const { data: announcementRows } = await supabase
        .from("school_announcements")
        .select("id, title, content, priority, created_at, audience_type")
        .in("audience_type", ["school", "student"])
        .order("created_at", { ascending: false })
        .limit(3);

      if (announcementRows) {
        const readIds = new Set(JSON.parse(localStorage.getItem("student_announcement_reads") || "[]"));
        setAnnouncements(announcementRows.map(row => ({
          id: String(row.id),
          title: row.title || "",
          preview: (row.content || "").slice(0, 120),
          priority: row.priority || "Medium",
          timestamp: new Date(row.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
          isRead: readIds.has(String(row.id))
        })));
      }
    } catch (err) {
      console.error("Error fetching dashboard data:", err);
    }
  };

  useEffect(() => {
    const userData = localStorage.getItem("currentUser");
    if (!userData) {
      navigate("/login");
      return;
    }
    const user = JSON.parse(userData);
    if (user.role !== "student") {
      navigate("/login");
      return;
    }
    setStudentName(user.name);
    setStudentId(user.id);
    fetchDashboardData(user.id);
    setTimeout(() => setLoading(false), 800);
  }, [navigate]);

  const handleLogout = () => {
    localStorage.removeItem("currentUser");
    navigate("/login");
  };

  const averageGrade =
    recentGrades.length > 0
      ? Math.round(recentGrades.reduce((sum, g) => sum + g.value, 0) / recentGrades.length)
      : 0;

  const attendanceRate =
    recentAttendance.length > 0
      ? Math.round(
          (recentAttendance.filter((a) => a.status === "Present").length /
            recentAttendance.length) *
            100
        )
      : 0;

  const unreadAnnouncements = announcements.filter((a) => !a.isRead).length;

  const getAttendanceIcon = (status) => {
    switch (status) {
      case "Present":
        return <CheckCircle className="w-4 h-4 text-emerald-600" />;
      case "Absent":
        return <XCircle className="w-4 h-4 text-red-600" />;
      case "Late":
        return <AlertCircle className="w-4 h-4 text-red-600" />;
      default:
        return null;
    }
  };

  const getAttendanceColor = (status) => {
    switch (status) {
      case "Present":
        return "text-emerald-600 bg-emerald-50";
      case "Absent":
        return "text-red-600 bg-red-50";
      case "Late":
        return "text-red-600 bg-red-50";
      default:
        return "text-gray-600 bg-gray-50";
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="flex gap-1.5 justify-center mb-4">
            <div className="w-3 h-3 rounded-full bg-green-500 animate-bounce" style={{ animationDelay: "0ms" }} />
            <div className="w-3 h-3 rounded-full bg-blue-500 animate-bounce"    style={{ animationDelay: "150ms" }} />
            <div className="w-3 h-3 rounded-full bg-red-500 animate-bounce"     style={{ animationDelay: "300ms" }} />
          </div>
          <p className="text-gray-500">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex relative overflow-hidden">
      <div className="absolute inset-0 z-0 pointer-events-none">
        <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-green-500/5 rounded-full blur-[150px] -translate-y-1/2 translate-x-1/2" />
        <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-blue-500/5 rounded-full blur-[120px] translate-y-1/2 -translate-x-1/2" />
      </div>

      <Sidebar studentName={studentName} onLogout={handleLogout} />

      <main className="flex-1 overflow-y-auto scrollbar-hide relative z-10">
        {/* Top Bar */}
        <div className="bg-white/80 backdrop-blur-md border-b border-gray-200 sticky top-0 z-20">
          <div className="px-6 py-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-500 text-xs font-medium uppercase tracking-widest">Student Portal</p>
                <h2 className="text-lg font-bold text-gray-900">Dashboard</h2>
              </div>
              <div className="flex items-center gap-4">
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
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Welcome Section */}
          <div className="relative rounded-2xl p-8 text-gray-900 shadow-xl overflow-hidden bg-white border border-gray-200">
            {/* Tri-color left accent */}
            <div className="absolute left-0 top-0 bottom-0 w-1 flex flex-col">
              <div className="flex-1 bg-green-500" />
              <div className="flex-1 bg-blue-600" />
              <div className="flex-1 bg-red-600" />
            </div>
            {/* Subtle glow */}
            <div className="absolute inset-0 bg-gradient-to-r from-green-500/10 via-blue-500/5 to-transparent pointer-events-none" />
            <div className="relative pl-4">
              <div className="flex items-center gap-3 mb-1">
                <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-green-100 text-green-700">SY 2026-2027</span>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-blue-100 text-blue-700">Term 1</span>
              </div>
              <h1 className="text-3xl font-bold mb-2 text-gray-900">Welcome, {studentName}!</h1>
              <p className="text-gray-600">Here is your academic overview for the current term.</p>
            </div>
          </div>

          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-white rounded-xl p-6 border border-gray-200 hover:border-gray-300 transition-colors shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <div className="p-3 bg-green-100 rounded-lg">
                  <BookOpen className="w-5 h-5 text-green-600" />
                </div>
              </div>
              <p className="text-gray-500 text-sm mb-1">Total Subjects</p>
              <p className="text-2xl font-bold text-gray-900">{subjects.length}</p>
            </div>

            <div className="bg-white rounded-xl p-6 border border-gray-200 hover:border-gray-300 transition-colors shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <div className="p-3 bg-blue-100 rounded-lg">
                  <TrendingUp className="w-5 h-5 text-blue-600" />
                </div>
              </div>
              <p className="text-gray-500 text-sm mb-1">Average Grade</p>
              <p className="text-2xl font-bold text-gray-900">{averageGrade}%</p>
            </div>

            <div className="bg-white rounded-xl p-6 border border-gray-200 hover:border-gray-300 transition-colors shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <div className="p-3 bg-amber-100 rounded-lg">
                  <Megaphone className="w-5 h-5 text-amber-600" />
                </div>
              </div>
              <p className="text-gray-500 text-sm mb-1">Unread Announcements</p>
              <p className="text-2xl font-bold text-gray-900">{unreadAnnouncements}</p>
            </div>
          </div>

          {/* Enrolled Subjects Section */}
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="p-6 border-b border-gray-200 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <BookOpen className="w-5 h-5 text-emerald-600" />
                <h3 className="text-lg font-bold text-gray-900">My Classes</h3>
              </div>
              <button onClick={() => navigate("/subjects")} className="text-emerald-600 hover:text-emerald-700 text-sm font-semibold flex items-center gap-1 transition-colors">
                View All <ArrowRight className="w-4 h-4" />
              </button>
            </div>
            <div className="p-6">
              {subjects.length === 0 ? (
                <div className="text-center py-10 bg-gray-50 rounded-xl border border-dashed border-gray-200">
                  <BookOpen className="w-10 h-10 text-gray-300 mx-auto mb-3" />
                  <p className="text-gray-500 font-medium">No subjects enrolled yet</p>
                  <p className="text-xs text-gray-400 mt-1">Check back later or contact your teacher</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {subjects.map((subject) => (
                    <div
                      key={subject.id}
                      onClick={() => navigate(`/subject/${subject.id}`)}
                      className="group p-5 bg-white border border-gray-200 rounded-2xl hover:border-emerald-500 hover:shadow-lg hover:-translate-y-1.5 transition-all duration-300 ease-out cursor-pointer relative overflow-hidden flex flex-col justify-between min-h-[160px]"
                    >
                      <div>
                        <span className="inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-emerald-50 text-emerald-700 group-hover:bg-emerald-600 group-hover:text-white transition-all duration-300 mb-3">
                          {subject.code || "SUBJ"}
                        </span>
                        <h4 className="font-bold text-gray-900 group-hover:text-emerald-700 transition-colors text-base line-clamp-2 leading-snug mb-4">
                          {subject.name}
                        </h4>
                      </div>
                      
                      <div className="flex items-center gap-2 pt-3 border-t border-gray-100 group-hover:border-emerald-100 transition-colors">
                        <div className="w-6 h-6 rounded-full bg-emerald-100 flex items-center justify-center text-[10px] font-bold text-emerald-700 group-hover:bg-emerald-600 group-hover:text-white transition-all duration-300">
                          {subject.teacher?.charAt(0) || "T"}
                        </div>
                        <p className="text-xs text-gray-500 font-medium truncate group-hover:text-gray-800 transition-colors">
                          {subject.teacher}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Main Layout Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-6">
              {/* Recent Grades */}
              <div className="bg-white rounded-xl border border-gray-200">
                <div className="p-6 border-b border-gray-200">
                  <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                    <TrendingUp className="w-5 h-5 text-green-600" />
                    Recent Grades
                  </h3>
                </div>
                <div className="p-6">
                  {recentGrades.length === 0 ? (
                    <div className="text-center py-6 text-gray-500">No recent grades</div>
                  ) : (
                    <div className="space-y-4">
                      {recentGrades.map((grade) => (
                        <div key={grade.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border border-gray-100">
                          <div className="flex-1">
                            <p className="font-medium text-gray-900">{grade.subjectName}</p>
                            <p className="text-sm text-gray-500">{new Date(grade.dateRecorded).toLocaleDateString()}</p>
                          </div>
                          <div className="text-right">
                            <p className="text-2xl font-bold text-green-600">{grade.value}%</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Up Next List Preview */}
              <div className="bg-white rounded-xl border border-gray-200">
                <div className="p-6 border-b border-gray-200 flex items-center justify-between">
                  <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                    <Clock className="w-5 h-5 text-green-600" />
                    Up Next
                  </h3>
                </div>
                <div className="p-6">
                  {upNext.length === 0 ? (
                    <div className="text-center py-6 text-gray-500">No upcoming events</div>
                  ) : (
                    <div className="space-y-4">
                      {upNext.map((item) => (
                        <div key={item.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border border-gray-100 hover:border-green-200">
                          <div className="flex-1">
                            <p className="font-medium text-gray-900">{item.title}</p>
                            <p className="text-sm text-gray-500">{item.type} â€¢ {item.due}</p>
                          </div>
                          <div>
                            <Clock className="w-5 h-5 text-green-300" />
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Announcements Preview */}
              <div className="bg-white rounded-xl border border-gray-200">
                <div className="p-6 border-b border-gray-200 flex items-center justify-between">
                  <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                    <Megaphone className="w-5 h-5 text-green-600" />
                    Latest Announcements
                  </h3>
                  <button onClick={() => navigate("/announcements")} className="text-green-600 hover:text-green-700 text-sm font-medium flex items-center gap-1">
                    View All <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
                <div className="p-6">
                  {announcements.length === 0 ? (
                    <div className="text-center py-6 text-gray-500">No recent announcements</div>
                  ) : (
                    <div className="space-y-3">
                      {announcements.map((announcement) => (
                        <div
                          key={announcement.id}
                          onClick={() => navigate("/announcements")}
                          className={`p-4 rounded-lg border transition-all cursor-pointer hover:shadow-sm ${announcement.isRead ? "bg-gray-50 border-gray-100 hover:border-gray-200" : "bg-green-50 border-green-200 hover:border-green-300"}`}
                        >
                          <div className="flex items-start justify-between mb-1.5">
                            <h4 className="font-semibold text-gray-900 text-sm flex items-center gap-2 flex-1 pr-2">
                              {announcement.title}
                              {!announcement.isRead && <span className="w-2 h-2 bg-green-500 rounded-full flex-shrink-0" />}
                            </h4>
                            <span className="text-xs text-gray-400 flex-shrink-0">{announcement.timestamp}</span>
                          </div>
                          <p className="text-xs text-gray-500 line-clamp-2 mb-2">{announcement.preview}</p>
                          <span className={`inline-block text-[10px] font-bold px-2 py-0.5 rounded-full ${
                            announcement.priority === "High" ? "bg-red-100 text-red-700" :
                            announcement.priority === "Low" ? "bg-green-100 text-green-700" :
                            "bg-amber-100 text-amber-700"
                          }`}>
                            {announcement.priority}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Sidebar Column */}
            <div className="space-y-6">
              <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                <DashboardCalendar viewerRole="student" />
              </div>

              {/* Learning Progress Card */}
              <div className="bg-white rounded-xl border border-gray-200 p-6">
                <h3 className="text-sm font-bold text-gray-500 uppercase mb-4 tracking-widest">Learning Progress</h3>
                <div className="space-y-4">
                  <div>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-gray-600">Curriculum Completion</span>
                      <span className="font-bold text-green-600">75%</span>
                    </div>
                    <div className="w-full bg-gray-100 h-2 rounded-full overflow-hidden border border-gray-200">
                      <div className="bg-green-500 h-full rounded-full" style={{ width: "75%" }} />
                    </div>
                  </div>
                  <div>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-gray-600">Attendance Goal</span>
                      <span className="font-bold text-blue-600">92%</span>
                    </div>
                    <div className="w-full bg-gray-100 h-2 rounded-full overflow-hidden border border-gray-200">
                      <div className="bg-blue-500 h-full rounded-full" style={{ width: "92%" }} />
                    </div>
                  </div>
                </div>
              </div>

              {/* Quick Info */}
              <div className="bg-green-50 border border-green-200 rounded-xl p-6 text-gray-900 text-center">
                <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-3">
                  <GraduationCap className="w-6 h-6 text-green-600" />
                </div>
                <h4 className="font-bold text-green-800 mb-2">Academic Status</h4>
                <p className="text-sm text-green-700 mb-5">
                  You are currently in good academic standing. Keep up the great work!
                </p>
                <button onClick={() => navigate("/grades")} className="w-full py-2 bg-green-600 hover:bg-green-700 rounded-lg text-sm font-semibold transition-colors text-white">
                  View Full Report
                </button>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

export default StudentDashboard;
