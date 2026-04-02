import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { AdminSidebar } from "../../components/AdminSidebar";
import {
  Users,
  UserCog,
  BookOpen,
  Activity,
  FileText
} from "lucide-react";
import { NotificationDropdown } from "../../components/NotificationDropdown";
import { adminNotifications } from "../../components/NotificationDefault";

export function AdminDashboard() {
  const navigate = useNavigate();
  const [adminName, setAdminName] = useState("");
  const [notificationList, setNotificationList] = useState([]);
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
        return "bg-blue-500/10 border-blue-500/20";
      case "teacher":
        return "bg-emerald-500/10 border-emerald-500/20";
      case "subject":
        return "bg-blue-500/10 border-blue-500/20";
      case "enrollment":
        return "bg-blue-500/10 border-blue-500/20";
      default:
        return "bg-gray-500/10 border-gray-500/20";
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
      <div className="min-h-screen flex items-center justify-center bg-gray-950">
        <div className="text-center">
          <div className="flex gap-1.5 justify-center mb-4">
            <div className="w-3 h-3 rounded-full bg-emerald-500 animate-bounce" style={{animationDelay:'0ms'}} />
            <div className="w-3 h-3 rounded-full bg-blue-500 animate-bounce" style={{animationDelay:'150ms'}} />
            <div className="w-3 h-3 rounded-full bg-red-500 animate-bounce" style={{animationDelay:'300ms'}} />
          </div>
          <p className="text-gray-500 text-sm">Loading admin dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-950 flex relative overflow-hidden">
      <div className="absolute inset-0 z-0 pointer-events-none">
        <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-emerald-600/5 rounded-full blur-[150px]" />
        <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-blue-600/5 rounded-full blur-[120px]" />
        <div className="absolute top-1/2 right-1/4 w-[300px] h-[300px] bg-red-600/3 rounded-full blur-[100px]" />
      </div>

      <AdminSidebar adminName={adminName} onLogout={handleLogout} />
      <div className="hidden lg:block w-72 flex-shrink-0" />

      <main className="flex-1 overflow-y-auto scrollbar-hide relative z-10">
        {/* Top Bar */}
        <div className="bg-gray-950/80 backdrop-blur-md border-b border-white/8 sticky top-0 z-20 relative">
          <div className="px-6 py-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-500 text-xs font-medium uppercase tracking-widest">Admin Portal</p>
                <h2 className="text-lg font-bold text-white">Admin Dashboard</h2>
              </div>
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
          {/* Welcome Section â€” DepEd tri-color */}
          <div className="relative rounded-2xl p-8 text-white shadow-lg overflow-hidden bg-gray-900 border border-white/10">
            {/* Tri-color left accent */}
            <div className="absolute left-0 top-0 bottom-0 w-1 flex flex-col">
              <div className="flex-1 bg-emerald-500" />
              <div className="flex-1 bg-blue-600" />
              <div className="flex-1 bg-red-600" />
            </div>
            {/* Subtle glow */}
            <div className="absolute inset-0 bg-gradient-to-r from-emerald-500/8 via-blue-500/5 to-red-500/5 pointer-events-none" />
            <div className="relative pl-4">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <span className="text-emerald-400 text-xs font-semibold uppercase tracking-widest">Admin Portal</span>
              </div>
              <h1 className="text-3xl font-bold mb-1">Welcome back, {adminName}!</h1>
              <p className="text-gray-400">ConnectEd system overview and management center</p>
            </div>
          </div>

          {/* Main Layout Grid */}
          <div className="grid grid-cols-1 gap-6">
            <div className="space-y-6">
              {/* Primary Stats Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-gray-900/60 rounded-xl p-6 border border-white/10 shadow-sm hover:border-emerald-500/30 transition-colors">
                  <div className="flex items-center justify-between mb-4">
                    <div className="p-3 bg-blue-500/10 rounded-xl border border-blue-500/20">
                      <Users className="w-6 h-6 text-blue-400" />
                    </div>
                  </div>
                  <p className="text-gray-400 text-sm mb-1">Total Students</p>
                  <p className="text-3xl font-bold text-white">
                    {stats.totalStudents.toLocaleString()}
                  </p>
                </div>

                <div className="bg-gray-900/60 rounded-xl p-6 border border-white/10 shadow-sm hover:border-emerald-500/30 transition-colors">
                  <div className="flex items-center justify-between mb-4">
                    <div className="p-3 bg-emerald-500/10 rounded-xl border border-emerald-500/20">
                      <UserCog className="w-6 h-6 text-emerald-400" />
                    </div>
                  </div>
                  <p className="text-gray-400 text-sm mb-1">Total Teachers</p>
                  <p className="text-3xl font-bold text-white">{stats.totalTeachers}</p>
                </div>
              </div>

              {/* Recent Activity */}
              <div className="bg-gray-900/60 rounded-xl border border-white/10 shadow-sm overflow-hidden">
                <div className="p-6 border-b border-white/5 bg-black/20">
                  <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                    <Activity className="w-5 h-5 text-emerald-400" />
                    Recent Activity
                  </h3>
                </div>
                <div className="p-6">
                  {recentActivity.length === 0 ? (
                    <div className="text-center py-8">
                      <Activity className="w-12 h-12 text-gray-600 mx-auto mb-3" />
                      <p className="text-gray-500">No recent activity</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {recentActivity.map((activity) => (
                        <div
                          key={activity.id}
                          className={`flex items-start gap-3 p-4 rounded-xl border ${getActivityColor(
                            activity.type
                          )}`}
                        >
                          <div className="mt-0.5">{getActivityIcon(activity.type)}</div>
                          <div className="flex-1">
                            <p className="font-medium text-white">{activity.action}</p>
                            <p className="text-sm text-gray-400">{activity.user}</p>
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
      </main>
    </div>
  );
}

export default AdminDashboard;
