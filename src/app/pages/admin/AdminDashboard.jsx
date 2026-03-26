import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { AdminSidebar } from "../../components/AdminSidebar";
import {
  Users,
  UserCog,
  BookOpen,
  Activity,
  UserPlus,
  FileText,
  ShieldCheck,
  Settings
} from "lucide-react";
import { DashboardCalendar } from "../../components/DashboardCalendar";
import { NotificationDropdown } from "../../components/NotificationDropdown";
import { adminNotifications } from "../../components/NotificationDefault";
function AdminDashboard() {
  const navigate = useNavigate();
  const [adminName, setAdminName] = useState("");
  const [notificationList, setNotificationList] = useState(adminNotifications);
  const [loading, setLoading] = useState(true);
  const [stats] = useState({
    totalStudents: 0,
    totalTeachers: 0,
    totalSubjects: 0,
    totalEnrollments: 0,
    activeAnnouncements: 0,
    newStudentsThisMonth: 0,
    newTeachersThisMonth: 0
  });
  const [recentActivity] = useState([]);
  useEffect(() => {
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
    setAdminName(user.name);
    setTimeout(() => setLoading(false), 800);
  }, [navigate]);
  const handleLogout = () => {
    localStorage.removeItem("currentUser");
    navigate("/login");
  };
  const getActivityIcon = (type) => {
    switch (type) {
      case "student":
        return <Users className="w-4 h-4 text-blue-600" />;
      case "teacher":
        return <UserCog className="w-4 h-4 text-emerald-600" />;
      case "subject":
        return <BookOpen className="w-4 h-4 text-blue-600" />;
      case "enrollment":
        return <FileText className="w-4 h-4 text-blue-600" />;
      default:
        return <Activity className="w-4 h-4 text-gray-600" />;
    }
  };
  const getActivityColor = (type) => {
    switch (type) {
      case "student":
        return "bg-blue-50 border-blue-200";
      case "teacher":
        return "bg-emerald-50 border-emerald-200";
      case "subject":
        return "bg-blue-50 border-blue-200";
      case "enrollment":
        return "bg-blue-50 border-blue-200";
      default:
        return "bg-gray-50 border-gray-200";
    }
  };
  const formatTimestamp = (timestamp) => {
    const date = new Date(timestamp);
    const now = /* @__PURE__ */ new Date();
    const diffInHours = (now.getTime() - date.getTime()) / (1e3 * 60 * 60);
    if (diffInHours < 1) {
      const minutes = Math.floor(diffInHours * 60);
      return `${minutes} minute${minutes !== 1 ? "s" : ""} ago`;
    } else if (diffInHours < 24) {
      const hours = Math.floor(diffInHours);
      return `${hours} hour${hours !== 1 ? "s" : ""} ago`;
    } else {
      return date.toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
    }
  };
  if (loading) {
    return <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-600">Loading admin dashboard...</p>
        </div>
      </div>;
  }
  return <div className="min-h-screen bg-gray-50 flex relative overflow-hidden">
      <div className="absolute inset-0 z-0 pointer-events-none opacity-[0.03]">
        <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-emerald-600 rounded-full blur-[120px] -translate-y-1/2 translate-x-1/2" />
        <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-blue-600 rounded-full blur-[120px] translate-y-1/2 -translate-x-1/2" />
      </div>

      <AdminSidebar adminName={adminName} onLogout={handleLogout} />
      <div className="hidden lg:block w-72 flex-shrink-0" />

      <main className="flex-1 overflow-y-auto custom-scrollbar relative z-10">
        {
    /* Top Bar */
  }
        <div className="bg-white/80 backdrop-blur-md border-b border-gray-200 sticky top-0 z-20 relative">
          <div className="px-6 py-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold text-gray-900">Admin Dashboard</h2>
              <NotificationDropdown
    notifications={notificationList}
    onMarkAsRead={(id) => setNotificationList((prev) => prev.map((n) => n.id === id ? { ...n, isRead: true } : n))}
    onNotificationsChange={setNotificationList}
  />
            </div>
          </div>
        </div>

        {
    /* Content */
  }
        <div className="p-6 space-y-6">
          {
    /* Welcome Section */
  }
          <div className="bg-gradient-to-r from-emerald-600 to-teal-600 rounded-2xl p-8 text-white shadow-lg">
            <h1 className="text-3xl font-bold mb-2">Welcome back, {adminName}!</h1>
            <p className="text-emerald-50">System overview and management center</p>
          </div>

          {
    /* Main Layout Grid */
  }
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-6">
              {
    /* Primary Stats Cards */
  }
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-white rounded-xl p-6 border border-gray-200 shadow-sm hover:shadow-md transition-shadow">
                  <div className="flex items-center justify-between mb-4">
                    <div className="p-3 bg-blue-50 rounded-lg">
                      <Users className="w-6 h-6 text-blue-600" />
                    </div>
                  </div>
                  <p className="text-gray-600 text-sm mb-1">Total Students</p>
                  <p className="text-3xl font-bold text-gray-900">{stats.totalStudents.toLocaleString()}</p>
                </div>

                <div className="bg-white rounded-xl p-6 border border-gray-200 shadow-sm hover:shadow-md transition-shadow">
                  <div className="flex items-center justify-between mb-4">
                    <div className="p-3 bg-emerald-50 rounded-lg">
                      <UserCog className="w-6 h-6 text-emerald-600" />
                    </div>
                  </div>
                  <p className="text-gray-600 text-sm mb-1">Total Teachers</p>
                  <p className="text-3xl font-bold text-gray-900">{stats.totalTeachers}</p>
                </div>
              </div>

              {
    /* Quick Actions */
  }
              <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
                <div className="p-6 border-b border-gray-200">
                  <h3 className="text-lg font-semibold text-gray-900">Quick Actions</h3>
                </div>
                <div className="p-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <button
    onClick={() => navigate("/admin/students")}
    className="p-4 border-2 border-gray-200 rounded-lg hover:border-emerald-500 hover:bg-emerald-50 transition-all text-left group"
  >
                      <UserPlus className="w-8 h-8 text-blue-600 mb-3" />
                      <p className="font-semibold text-gray-900 group-hover:text-emerald-700">Add Student</p>
                    </button>
                    <button
    onClick={() => navigate("/admin/teachers")}
    className="p-4 border-2 border-gray-200 rounded-lg hover:border-emerald-500 hover:bg-emerald-50 transition-all text-left group"
  >
                      <UserCog className="w-8 h-8 text-emerald-600 mb-3" />
                      <p className="font-semibold text-gray-900 group-hover:text-emerald-700">Add Teacher</p>
                    </button>
                  </div>
                </div>
              </div>

              {
    /* Recent Activity */
  }
              <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
                <div className="p-6 border-b border-gray-200">
                  <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                    <Activity className="w-5 h-5 text-emerald-600" />
                    Recent Activity
                  </h3>
                </div>
                <div className="p-6">
                  {recentActivity.length === 0 ? <div className="text-center py-8">
                      <Activity className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                      <p className="text-gray-500">No recent activity</p>
                    </div> : <div className="space-y-3">
                      {recentActivity.map((activity) => <div
    key={activity.id}
    className={`flex items-start gap-3 p-4 rounded-lg border ${getActivityColor(activity.type)}`}
  >
                          <div className="mt-0.5">{getActivityIcon(activity.type)}</div>
                          <div className="flex-1">
                            <p className="font-medium text-gray-900">{activity.action}</p>
                            <p className="text-sm text-gray-600">{activity.user}</p>
                          </div>
                          <p className="text-xs text-gray-500 whitespace-nowrap">{formatTimestamp(activity.timestamp)}</p>
                        </div>)}
                    </div>}
                </div>
              </div>
            </div>

            {
    /* Sidebar Column */
  }
            <div className="space-y-6">
              <DashboardCalendar />

              {
    /* System Health */
  }
              <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
                <h3 className="text-sm font-bold text-gray-400 uppercase mb-4">System Health</h3>
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-3 bg-emerald-50 rounded-lg">
                    <div className="flex items-center gap-2">
                      <ShieldCheck className="w-4 h-4 text-emerald-600" />
                      <span className="text-sm font-medium text-emerald-900">Security Scan</span>
                    </div>
                    <span className="text-[10px] font-bold text-emerald-600 uppercase">Healthy</span>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-blue-50 rounded-lg">
                    <div className="flex items-center gap-2">
                      <Activity className="w-4 h-4 text-blue-600" />
                      <span className="text-sm font-medium text-blue-900">Server Status</span>
                    </div>
                    <span className="text-[10px] font-bold text-blue-600 uppercase">99.9% Uptime</span>
                  </div>
                </div>
              </div>

              {
    /* Quick Settings Card */
  }
              <div className="bg-gray-900 rounded-xl p-6 text-white relative overflow-hidden">
                <div className="relative z-10">
                  <div className="flex items-center gap-3 mb-4">
                    <Settings className="w-6 h-6 text-emerald-400" />
                    <h4 className="font-bold">System Console</h4>
                  </div>
                  <p className="text-sm text-gray-400 mb-4">Access global system configuration and administrative tools.</p>
                  <button
    onClick={() => navigate("/admin/settings")}
    className="w-full py-2 bg-emerald-600 hover:bg-emerald-700 rounded-lg text-sm font-medium transition-colors"
  >
                    Manage Settings
                  </button>
                </div>
                <Activity className="absolute bottom-[-20px] left-[-20px] w-32 h-32 opacity-5 rotate-12 text-white" />
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>;
}
export {
  AdminDashboard
};
