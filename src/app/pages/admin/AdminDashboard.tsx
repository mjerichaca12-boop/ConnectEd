import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { AdminSidebar } from '../../components/AdminSidebar';
import { 
  Users, 
  UserCog,
  BookOpen,
  TrendingUp,
  Activity,
  UserPlus,
  FileText,
  ChevronRight,
  ShieldCheck,
  Settings
} from 'lucide-react';
import { DashboardCalendar } from '../../components/DashboardCalendar';
import { NotificationDropdown, type NotificationItem } from '../../components/NotificationDropdown';
interface ActivityLog {
  id: string;
  action: string;
  user: string;
  timestamp: string;
  type: 'student' | 'teacher' | 'subject' | 'enrollment';
}

export function AdminDashboard() {
  const navigate = useNavigate();
  const [adminName, setAdminName] = useState('');
  const [notificationList, setNotificationList] = useState<NotificationItem[]>([
    { id: '1', title: 'New student enrollment', message: '5 new enrollment requests pending approval.', path: '/admin/enrollment', isRead: false, timestamp: '1 hour ago' },
    { id: '2', title: 'System backup complete', message: 'Nightly backup completed successfully.', path: '/admin/settings', isRead: false, timestamp: '3 hours ago' },
    { id: '3', title: 'Teacher account created', message: 'Maria Santos was added to the system.', path: '/admin/teachers', isRead: true, timestamp: '1 day ago' },
  ]);
  const [loading, setLoading] = useState(true);

  // Mock data
  const [stats] = useState({
    totalStudents: 1247,
    totalTeachers: 58,
    totalSubjects: 42,
    totalEnrollments: 5486,
    activeAnnouncements: 12,
    newStudentsThisMonth: 34,
    newTeachersThisMonth: 3
  });

  const [recentActivity] = useState<ActivityLog[]>([
    { id: '1', action: 'New student enrolled', user: 'Juan Dela Cruz', timestamp: '2026-01-19T10:30:00', type: 'student' },
    { id: '2', action: 'Teacher account created', user: 'Maria Santos', timestamp: '2026-01-19T09:15:00', type: 'teacher' },
    { id: '3', action: 'Subject updated', user: 'Advanced Mathematics - MATH101', timestamp: '2026-01-18T16:45:00', type: 'subject' },
    { id: '4', action: 'Enrollment processed', user: 'Pedro Garcia enrolled in CS101', timestamp: '2026-01-18T14:20:00', type: 'enrollment' },
    { id: '5', action: 'New student enrolled', user: 'Ana Reyes', timestamp: '2026-01-18T11:00:00', type: 'student' },
  ]);

  useEffect(() => {
    const userData = localStorage.getItem('currentUser');
    if (!userData) {
      navigate('/login');
      return;
    }

    const user = JSON.parse(userData);
    if (user.role !== 'admin') {
      navigate('/login');
      return;
    }

    setAdminName(user.name);

    setTimeout(() => setLoading(false), 800);
  }, [navigate]);

  const handleLogout = () => {
    localStorage.removeItem('currentUser');
    navigate('/login');
  };

  const getActivityIcon = (type: string) => {
    switch (type) {
      case 'student':
        return <Users className="w-4 h-4 text-blue-600" />;
      case 'teacher':
        return <UserCog className="w-4 h-4 text-emerald-600" />;
      case 'subject':
        return <BookOpen className="w-4 h-4 text-blue-600" />;
      case 'enrollment':
        return <FileText className="w-4 h-4 text-blue-600" />;
      default:
        return <Activity className="w-4 h-4 text-gray-600" />;
    }
  };

  const getActivityColor = (type: string) => {
    switch (type) {
      case 'student':
        return 'bg-blue-50 border-blue-200';
      case 'teacher':
        return 'bg-emerald-50 border-emerald-200';
      case 'subject':
        return 'bg-blue-50 border-blue-200';
      case 'enrollment':
        return 'bg-blue-50 border-blue-200';
      default:
        return 'bg-gray-50 border-gray-200';
    }
  };

  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffInHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60);

    if (diffInHours < 1) {
      const minutes = Math.floor(diffInHours * 60);
      return `${minutes} minute${minutes !== 1 ? 's' : ''} ago`;
    } else if (diffInHours < 24) {
      const hours = Math.floor(diffInHours);
      return `${hours} hour${hours !== 1 ? 's' : ''} ago`;
    } else {
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Loading admin dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex relative overflow-hidden">
      {/* Decorative Background Patterns */}
      <div className="absolute inset-0 z-0 pointer-events-none opacity-[0.03]">
        <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-emerald-600 rounded-full blur-[120px] -translate-y-1/2 translate-x-1/2"></div>
        <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-blue-600 rounded-full blur-[120px] translate-y-1/2 -translate-x-1/2"></div>
      </div>

      <AdminSidebar adminName={adminName} onLogout={handleLogout} />

      <main className="flex-1 overflow-y-auto custom-scrollbar relative z-10 lg:ml-72">
        {/* Top Bar */}
        <div className="bg-white/80 backdrop-blur-md border-b border-gray-200 sticky top-0 z-20">
          <div className="px-6 py-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-semibold text-gray-900">Admin Dashboard</h2>
              </div>
              <div className="flex items-center gap-4">
                <NotificationDropdown
                  notifications={notificationList}
                  onMarkAsRead={(id: string) => setNotificationList(prev => prev.map(n => n.id === id ? { ...n, isRead: true } : n))}
                  onNotificationsChange={setNotificationList}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Welcome Section */}
          <div className="bg-gradient-to-r from-emerald-600 to-teal-600 rounded-2xl p-8 text-white shadow-lg">
            <h1 className="text-3xl font-bold mb-2">Welcome back, {adminName}!</h1>
            <p className="text-emerald-50">System overview and management center</p>
          </div>

          {/* Main Layout Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-6">
              {/* Primary Stats Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Total Students */}
                <div className="bg-white rounded-xl p-6 border border-gray-200 shadow-sm hover:shadow-md transition-shadow">
                  <div className="flex items-center justify-between mb-4">
                    <div className="p-3 bg-blue-50 rounded-lg">
                      <Users className="w-6 h-6 text-blue-600" />
                    </div>
                  </div>
                  <p className="text-gray-600 text-sm mb-1">Total Students</p>
                  <p className="text-3xl font-bold text-gray-900">{stats.totalStudents.toLocaleString()}</p>
                </div>

                {/* Total Teachers */}
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

              {/* Quick Actions */}
              <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
                <div className="p-6 border-b border-gray-200">
                  <h3 className="text-lg font-semibold text-gray-900">Quick Actions</h3>
                </div>
                <div className="p-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <button
                      onClick={() => navigate('/admin/students')}
                      className="p-4 border-2 border-gray-200 rounded-lg hover:border-emerald-500 hover:bg-emerald-50 transition-all text-left group"
                    >
                      <UserPlus className="w-8 h-8 text-blue-600 mb-3" />
                      <p className="font-semibold text-gray-900 group-hover:text-emerald-700">Add Student</p>
                    </button>

                    <button
                      onClick={() => navigate('/admin/teachers')}
                      className="p-4 border-2 border-gray-200 rounded-lg hover:border-emerald-500 hover:bg-emerald-50 transition-all text-left group"
                    >
                      <UserCog className="w-8 h-8 text-emerald-600 mb-3" />
                      <p className="font-semibold text-gray-900 group-hover:text-emerald-700">Add Teacher</p>
                    </button>
                  </div>
                </div>
              </div>

              {/* Recent Activity */}
              <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
                <div className="p-6 border-b border-gray-200 flex items-center justify-between">
                  <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                    <Activity className="w-5 h-5 text-emerald-600" />
                    Recent Activity
                  </h3>
                </div>
                <div className="p-6">
                  <div className="space-y-3">
                    {recentActivity.map((activity) => (
                      <div 
                        key={activity.id} 
                        className={`flex items-start gap-3 p-4 rounded-lg border ${getActivityColor(activity.type)} hover:shadow-sm transition-shadow`}
                      >
                        <div className="mt-0.5">
                          {getActivityIcon(activity.type)}
                        </div>
                        <div className="flex-1">
                          <p className="font-medium text-gray-900">{activity.action}</p>
                          <p className="text-sm text-gray-600">{activity.user}</p>
                        </div>
                        <p className="text-xs text-gray-500 whitespace-nowrap">{formatTimestamp(activity.timestamp)}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Sidebar Column */}
            <div className="space-y-6">
              <DashboardCalendar />

              {/* System Health */}
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

              {/* Quick Settings Card */}
              <div className="bg-gray-900 rounded-xl p-6 text-white relative overflow-hidden">
                <div className="relative z-10">
                  <div className="flex items-center gap-3 mb-4">
                    <Settings className="w-6 h-6 text-emerald-400" />
                    <h4 className="font-bold">System Console</h4>
                  </div>
                  <p className="text-sm text-gray-400 mb-4">Access global system configuration and administrative tools.</p>
                  <button 
                    onClick={() => navigate('/admin/settings')}
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
    </div>
  );
}