import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { TeacherSidebar } from "../../components/TeacherSidebar";
import {
  BookOpen, Users, Megaphone, TrendingUp, Calendar,
  MessageSquare, ClipboardCheck, Plus, ArrowRight,
  GraduationCap, BarChart2, Bell
} from "lucide-react";
import { DashboardCalendar } from "../../components/DashboardCalendar";
import { NotificationDropdown } from "../../components/NotificationDropdown";

const colorMap = {
  emerald: { icon: "text-emerald-400", bg: "bg-emerald-500/10", hover: "hover:border-emerald-500/40 hover:bg-emerald-500/5" },
  blue:    { icon: "text-blue-400",    bg: "bg-blue-500/10",    hover: "hover:border-blue-500/40 hover:bg-blue-500/5" },
  red:     { icon: "text-red-400",     bg: "bg-red-500/10",     hover: "hover:border-red-500/40 hover:bg-red-500/5" },
};

export function TeacherDashboard() {
  const navigate = useNavigate();
  const [teacherName, setTeacherName] = useState("");
  const [notificationList, setNotificationList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [classes] = useState([]);
  const [recentGrades] = useState([]);

  useEffect(() => {
    const userData = localStorage.getItem("currentUser");
    if (!userData) { navigate("/login"); return; }
    const user = JSON.parse(userData);
    if (user.role !== "teacher") { navigate("/login"); return; }
    setTeacherName(user.name);
    setTimeout(() => setLoading(false), 700);
  }, [navigate]);

  const handleLogout = () => {
    localStorage.removeItem("currentUser");
    navigate("/login");
  };

  const totalStudents = classes.reduce((sum, c) => sum + c.studentCount, 0);

  const getGreeting = () => {
    const h = new Date().getHours();
    if (h < 12) return "Good morning";
    if (h < 17) return "Good afternoon";
    return "Good evening";
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-950">
        <div className="text-center">
          <div className="flex gap-1.5 justify-center mb-4">
            <div className="w-3 h-3 rounded-full bg-emerald-500 animate-bounce" style={{ animationDelay: "0ms" }} />
            <div className="w-3 h-3 rounded-full bg-blue-500 animate-bounce"    style={{ animationDelay: "150ms" }} />
            <div className="w-3 h-3 rounded-full bg-red-500 animate-bounce"     style={{ animationDelay: "300ms" }} />
          </div>
          <p className="text-gray-500 text-sm">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-950 flex relative overflow-hidden">
      {/* Background glow */}
      <div className="absolute inset-0 z-0 pointer-events-none">
        <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-emerald-500/5 rounded-full blur-[150px]" />
        <div className="absolute bottom-0 left-1/3 w-[500px] h-[500px] bg-blue-500/4 rounded-full blur-[130px]" />
        <div className="absolute top-1/2 right-1/4 w-[400px] h-[400px] bg-red-500/3 rounded-full blur-[120px]" />
      </div>

      <TeacherSidebar teacherName={teacherName} onLogout={handleLogout} />

      <main className="flex-1 overflow-y-auto scrollbar-hide relative z-10">
        {/* Top Bar */}
        <div className="bg-gray-950/80 backdrop-blur-md border-b border-white/8 sticky top-0 z-20">
          <div className="px-6 py-4 flex items-center justify-between">
            <div>
              <p className="text-gray-500 text-xs font-medium uppercase tracking-widest">Teacher Portal</p>
              <h2 className="text-lg font-bold text-white">Dashboard</h2>
            </div>
            <NotificationDropdown
              notifications={notificationList}
              onMarkAsRead={(id) => setNotificationList((prev) => prev.map((n) => n.id === id ? { ...n, isRead: true } : n))}
              onNotificationsChange={setNotificationList}
            />
          </div>
        </div>

        <div className="p-6 space-y-6">

          {/* ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ Welcome Banner ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ */}
          <div className="relative rounded-2xl overflow-hidden bg-gray-900 border border-white/10 p-8">
            {/* Tri-color left stripe */}
            <div className="absolute left-0 top-0 bottom-0 w-1 flex flex-col">
              <div className="flex-1 bg-emerald-500" />
              <div className="flex-1 bg-blue-600" />
              <div className="flex-1 bg-red-600" />
            </div>
            {/* Glow */}
            <div className="absolute inset-0 bg-gradient-to-r from-emerald-500/8 via-blue-500/4 to-transparent pointer-events-none" />
            <div className="relative pl-4">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <p className="text-emerald-400 text-xs font-semibold uppercase tracking-widest">{getGreeting()}</p>
              </div>
              <h1 className="text-3xl font-extrabold text-white mb-1 tracking-tight">
                Welcome back, <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-emerald-300">{teacherName}!</span>
              </h1>
              <p className="text-gray-400">Here's an overview of your teaching responsibilities.</p>
            </div>
          </div>

          {/* Ã¢â€â‚¬Ã¢â€â‚¬ Stats Row Ã¢â€â‚¬Ã¢â€â‚¬ */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[
              { icon: BookOpen,    label: "Total Classes",   value: classes.length,  color: "emerald" },
              { icon: Users,       label: "Total Students",  value: totalStudents,   color: "blue" },
              { icon: GraduationCap, label: "Grades Encoded", value: recentGrades.length, color: "emerald" },
            ].map((stat) => {
              const Icon = stat.icon;
              const c = colorMap[stat.color];
              return (
                <div key={stat.label} className="bg-gray-900/60 border border-white/8 rounded-2xl p-5 hover:border-white/15 transition-colors">
                  <div className={`w-9 h-9 ${c.bg} rounded-xl flex items-center justify-center mb-3`}>
                    <Icon className={`w-4 h-4 ${c.icon}`} />
                  </div>
                  <p className="text-2xl font-extrabold text-white mb-0.5">{stat.value}</p>
                  <p className="text-gray-500 text-xs">{stat.label}</p>
                </div>
              );
            })}
          </div>

          {/* ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ Main Grid ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

            {/* Left Ã¢â‚¬â€ Main Content */}
            <div className="lg:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-6 items-start">

              {/* Tasks & Deadlines (Moved to prominent position) */}
              <div className="bg-gray-900/60 border border-white/8 rounded-2xl p-6">
                <h3 className="text-white font-bold text-base mb-4 flex items-center gap-2 border-b border-white/8 pb-4">
                  <ClipboardCheck className="w-5 h-5 text-blue-400" />
                  Tasks & Deadlines
                </h3>
                <div className="text-center py-8 flex-1 flex flex-col items-center justify-center">
                  <div className="w-12 h-12 bg-blue-500/10 rounded-2xl flex items-center justify-center mx-auto mb-3 border border-blue-500/20">
                    <ClipboardCheck className="w-6 h-6 text-blue-400" />
                  </div>
                  <p className="text-gray-400 font-medium">You're all caught up!</p>
                  <p className="text-gray-500 text-sm mt-1">No pending tasks or deadlines.</p>
                </div>
              </div>

              {/* Recent Grades */}
              <div className="bg-gray-900/60 border border-white/8 rounded-2xl overflow-hidden">
                <div className="px-6 py-4 border-b border-white/8 flex items-center justify-between">
                  <h3 className="text-white font-bold flex items-center gap-2">
                    <TrendingUp className="w-5 h-5 text-emerald-400" />
                    Recently Updated Grades
                  </h3>
                </div>
                <div className="p-6 flex-1 flex flex-col items-center justify-center">
                  {recentGrades.length === 0 ? (
                    <div className="text-center py-6">
                      <div className="w-12 h-12 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl flex items-center justify-center mx-auto mb-3">
                        <TrendingUp className="w-6 h-6 text-emerald-400" />
                      </div>
                      <p className="text-gray-400 font-medium">No grades recorded yet</p>

                    </div>
                  ) : (
                    <div className="space-y-3 w-full">
                      {recentGrades.map((grade) => (
                        <div key={grade.id} className="flex items-center justify-between px-4 py-3 bg-white/4 rounded-xl hover:bg-white/8 transition-colors border border-transparent hover:border-white/5">
                          <div>
                            <p className="text-white text-sm font-medium">{grade.studentName}</p>
                            <p className="text-gray-500 text-xs mt-0.5">{grade.subject} Ã¢â‚¬Â¢ {new Date(grade.dateRecorded).toLocaleDateString()}</p>
                          </div>
                          <p className="text-lg font-bold text-emerald-400 bg-emerald-500/10 px-3 py-1 rounded-lg border border-emerald-500/20">{grade.grade}%</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Right Column */}
            <div className="space-y-6">
              {/* Calendar */}
              <div className="bg-gray-900/60 border border-white/8 rounded-2xl overflow-hidden">
                <DashboardCalendar />
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

export default TeacherDashboard;
