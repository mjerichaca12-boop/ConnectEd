import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
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
  const [notificationList, setNotificationList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [subjects] = useState([]);
  const [recentGrades] = useState([]);
  const [recentAttendance] = useState([]);
  const [announcements] = useState([]);
  const [upNext] = useState([
    { id: 1, title: "Math Assignment 1", due: "Tomorrow, 11:59 PM", type: "Assignment" },
    { id: 2, title: "Science Term Paper", due: "Friday, 5:00 PM", type: "Project" }
  ]);

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
              <h1 className="text-3xl font-bold mb-2 text-gray-900">Welcome, {studentName}!</h1>
              <p className="text-gray-600">Here is your academic overview</p>
            </div>
          </div>

          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="bg-white rounded-xl p-6 border border-gray-200 hover:border-gray-300 transition-colors">
              <div className="flex items-center justify-between mb-4">
                <div className="p-3 bg-green-100 rounded-lg">
                  <BookOpen className="w-5 h-5 text-green-600" />
                </div>
              </div>
              <p className="text-gray-500 text-sm mb-1">Total Subjects</p>
              <p className="text-2xl font-bold text-gray-900">{subjects.length}</p>
            </div>

            <div className="bg-white rounded-xl p-6 border border-gray-200 hover:border-gray-300 transition-colors">
              <div className="flex items-center justify-between mb-4">
                <div className="p-3 bg-blue-100 rounded-lg">
                  <TrendingUp className="w-5 h-5 text-blue-600" />
                </div>
              </div>
              <p className="text-gray-500 text-sm mb-1">Average Grade</p>
              <p className="text-2xl font-bold text-gray-900">{averageGrade}%</p>
            </div>

            <div className="bg-white rounded-xl p-6 border border-gray-200 hover:border-gray-300 transition-colors">
              <div className="flex items-center justify-between mb-4">
                <div className="p-3 bg-blue-100 rounded-lg">
                  <Calendar className="w-5 h-5 text-blue-600" />
                </div>
              </div>
              <p className="text-gray-500 text-sm mb-1">Attendance Rate</p>
              <p className="text-2xl font-bold text-gray-900">{attendanceRate}%</p>
            </div>

            <div className="bg-white rounded-xl p-6 border border-gray-200 hover:border-gray-300 transition-colors">
              <div className="flex items-center justify-between mb-4">
                <div className="p-3 bg-blue-100 rounded-lg">
                  <Megaphone className="w-5 h-5 text-blue-600" />
                </div>
              </div>
              <p className="text-gray-500 text-sm mb-1">Unread Announcements</p>
              <p className="text-2xl font-bold text-gray-900">{unreadAnnouncements}</p>
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
                    <div className="space-y-4">
                      {announcements.map((announcement) => (
                        <div key={announcement.id} className={`p-4 rounded-lg border transition-all ${announcement.isRead ? "bg-gray-50 border-gray-100" : "bg-green-50 border-green-200"}`}>
                          <div className="flex items-start justify-between mb-2">
                            <h4 className="font-semibold text-gray-900 flex items-center gap-2">
                              {announcement.title}
                              {!announcement.isRead && <span className="w-2 h-2 bg-green-500 rounded-full" />}
                            </h4>
                            <span className="text-xs text-gray-500">{announcement.timestamp}</span>
                          </div>
                          <p className="text-sm text-gray-600">{announcement.preview}</p>
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
