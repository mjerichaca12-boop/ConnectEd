import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { TeacherSidebar } from '@/app/components/TeacherSidebar';
import { 
  Bell, 
  BookOpen, 
  Users,
  Megaphone,
  TrendingUp,
  Calendar,
  ChevronRight,
  MessageSquare,
  ClipboardCheck
} from 'lucide-react';
import { DashboardCalendar } from '@/app/components/DashboardCalendar';

interface ClassSummary {
  id: string;
  code: string;
  name: string;
  studentCount: number;
}

interface RecentGrade {
  id: string;
  studentName: string;
  subject: string;
  grade: number;
  dateRecorded: string;
}

interface RecentAnnouncement {
  id: string;
  title: string;
  subject: string;
  datePosted: string;
}

export function TeacherDashboard() {
  const navigate = useNavigate();
  const [teacherName, setTeacherName] = useState('');
  const [schoolName, setSchoolName] = useState('');
  const [notifications, setNotifications] = useState(5);
  const [loading, setLoading] = useState(true);

  // Mock data
  const [classes] = useState<ClassSummary[]>([
    { id: '1', code: 'MATH101', name: 'Advanced Mathematics', studentCount: 32 },
    { id: '2', code: 'MATH102', name: 'Calculus I', studentCount: 28 },
    { id: '3', code: 'MATH201', name: 'Linear Algebra', studentCount: 25 },
  ]);

  const [recentGrades] = useState<RecentGrade[]>([
    { id: '1', studentName: 'Juan Dela Cruz', subject: 'MATH101', grade: 92, dateRecorded: '2026-01-16' },
    { id: '2', studentName: 'Maria Santos', subject: 'MATH102', grade: 88, dateRecorded: '2026-01-15' },
    { id: '3', studentName: 'Pedro Garcia', subject: 'MATH101', grade: 95, dateRecorded: '2026-01-15' },
  ]);

  const [recentAnnouncements] = useState<RecentAnnouncement[]>([
    { id: '1', title: 'Quiz on Friday', subject: 'MATH101', datePosted: '2026-01-14' },
    { id: '2', title: 'Project Submission Deadline', subject: 'MATH102', datePosted: '2026-01-12' },
  ]);

  useEffect(() => {
    const userData = localStorage.getItem('currentUser');
    const schoolData = localStorage.getItem('selectedSchool');

    if (!userData) {
      navigate('/school-selection');
      return;
    }

    const user = JSON.parse(userData);
    if (user.role !== 'teacher') {
      navigate('/school-selection');
      return;
    }

    setTeacherName(user.name);
    if (schoolData) {
      const school = JSON.parse(schoolData);
      setSchoolName(school.name);
    }

    setTimeout(() => setLoading(false), 800);
  }, [navigate]);

  const handleLogout = () => {
    localStorage.removeItem('currentUser');
    navigate('/school-selection');
  };

  const totalStudents = classes.reduce((sum, c) => sum + c.studentCount, 0);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Loading dashboard...</p>
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

      <TeacherSidebar teacherName={teacherName} onLogout={handleLogout} />

      <main className="flex-1 overflow-y-auto custom-scrollbar relative z-10 ml-0 lg:ml-72">
        {/* Top Bar */}
        <div className="bg-white/80 backdrop-blur-md border-b border-gray-200 sticky top-0 z-20">
          <div className="px-6 py-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-semibold text-gray-900">Dashboard</h2>
                <p className="text-sm text-gray-600">{schoolName}</p>
              </div>
              <div className="flex items-center gap-4">
                <button className="relative p-2 hover:bg-gray-100 rounded-lg transition-colors">
                  <Bell className="w-6 h-6 text-gray-600" />
                  {notifications > 0 && (
                    <span className="absolute top-1 right-1 w-4 h-4 bg-red-500 text-white text-xs rounded-full flex items-center justify-center">
                      {notifications}
                    </span>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Welcome Section */}
          <div className="bg-gradient-to-r from-emerald-600 to-teal-600 rounded-2xl p-8 text-white shadow-lg">
            <h1 className="text-3xl font-bold mb-2">Welcome back, {teacherName}!</h1>
            <p className="text-emerald-50">Here's an overview of your teaching responsibilities</p>
          </div>

          {/* Main Layout Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-6">
              {/* Quick Actions */}
              <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
                <div className="p-6 border-b border-gray-200">
                  <h3 className="text-lg font-semibold text-gray-900">Quick Actions</h3>
                </div>
                <div className="p-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <button
                      onClick={() => navigate('/teacher/attendance')}
                      className="p-4 border-2 border-gray-200 rounded-lg hover:border-emerald-500 hover:bg-emerald-50 transition-all text-left group"
                    >
                      <Calendar className="w-8 h-8 text-emerald-600 mb-3" />
                      <p className="font-semibold text-gray-900 group-hover:text-emerald-700">Record Attendance</p>
                      <p className="text-sm text-gray-600 mt-1">Mark today's attendance</p>
                    </button>

                    <button
                      onClick={() => navigate('/teacher/grades')}
                      className="p-4 border-2 border-gray-200 rounded-lg hover:border-emerald-500 hover:bg-emerald-50 transition-all text-left group"
                    >
                      <TrendingUp className="w-8 h-8 text-blue-600 mb-3" />
                      <p className="font-semibold text-gray-900 group-hover:text-emerald-700">Encode Grades</p>
                      <p className="text-sm text-gray-600 mt-1">Input student grades</p>
                    </button>

                    <button
                      onClick={() => navigate('/teacher/announcements')}
                      className="p-4 border-2 border-gray-200 rounded-lg hover:border-emerald-500 hover:bg-emerald-50 transition-all text-left group"
                    >
                      <Megaphone className="w-8 h-8 text-blue-600 mb-3" />
                      <p className="font-semibold text-gray-900 group-hover:text-emerald-700">Post Announcement</p>
                      <p className="text-sm text-gray-600 mt-1">Share with students</p>
                    </button>

                    <button
                      onClick={() => navigate('/teacher/messages')}
                      className="p-4 border-2 border-gray-200 rounded-lg hover:border-emerald-500 hover:bg-emerald-50 transition-all text-left group"
                    >
                      <MessageSquare className="w-8 h-8 text-blue-600 mb-3" />
                      <p className="font-semibold text-gray-900 group-hover:text-emerald-700">Send Message</p>
                      <p className="text-sm text-gray-600 mt-1">Contact students</p>
                    </button>
                  </div>
                </div>
              </div>

              {/* Summary Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Total Classes */}
                <div className="bg-white rounded-xl p-6 border border-gray-200 shadow-sm hover:shadow-md transition-shadow">
                  <div className="flex items-center justify-between mb-4">
                    <div className="p-3 bg-emerald-50 rounded-lg">
                      <BookOpen className="w-6 h-6 text-emerald-600" />
                    </div>
                  </div>
                  <p className="text-gray-600 text-sm mb-1">Total Classes</p>
                  <p className="text-3xl font-bold text-gray-900">{classes.length}</p>
                </div>

                {/* Total Students */}
                <div className="bg-white rounded-xl p-6 border border-gray-200 shadow-sm hover:shadow-md transition-shadow">
                  <div className="flex items-center justify-between mb-4">
                    <div className="p-3 bg-blue-50 rounded-lg">
                      <Users className="w-6 h-6 text-blue-600" />
                    </div>
                  </div>
                  <p className="text-gray-600 text-sm mb-1">Total Students</p>
                  <p className="text-3xl font-bold text-gray-900">{totalStudents}</p>
                </div>
              </div>

              {/* Recent Activity */}
              <div className="space-y-6">
                {/* Recent Grades */}
                <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
                  <div className="p-6 border-b border-gray-200 flex items-center justify-between">
                    <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                      <TrendingUp className="w-5 h-5 text-emerald-600" />
                      Recently Updated Grades
                    </h3>
                  </div>
                  <div className="p-6">
                    <div className="space-y-4">
                      {recentGrades.map((grade) => (
                        <div key={grade.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
                          <div className="flex-1">
                            <p className="font-medium text-gray-900">{grade.studentName}</p>
                            <p className="text-sm text-gray-500">{grade.subject} • {new Date(grade.dateRecorded).toLocaleDateString()}</p>
                          </div>
                          <div className="text-right">
                            <p className="text-2xl font-bold text-emerald-600">{grade.grade}%</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Sidebar Column */}
            <div className="space-y-6">
              <DashboardCalendar />

              {/* Teaching Tasks */}
              <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
                <h3 className="text-sm font-bold text-gray-400 uppercase mb-4">Tasks & Deadlines</h3>
                <div className="space-y-4">
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 bg-blue-50 rounded flex items-center justify-center flex-shrink-0">
                      <ClipboardCheck className="w-4 h-4 text-blue-600" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-900">Final Grade Submission</p>
                      <p className="text-xs text-gray-500">Deadline: Jan 28, 2026</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 bg-emerald-50 rounded flex items-center justify-center flex-shrink-0">
                      <Users className="w-4 h-4 text-emerald-600" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-900">PTA Meeting</p>
                      <p className="text-xs text-gray-500">Feb 02, 2026 • 2:00 PM</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Motivational Card */}
              <div className="bg-emerald-600 rounded-xl p-6 text-white relative overflow-hidden">
                <div className="relative z-10">
                  <h4 className="font-bold mb-2">Teacher's Spotlight</h4>
                  <p className="text-sm text-emerald-50 mb-4">"Education is the most powerful weapon which you can use to change the world."</p>
                  <p className="text-xs text-emerald-200 italic">— Nelson Mandela</p>
                </div>
                <BookOpen className="absolute bottom-[-10px] right-[-10px] w-24 h-24 opacity-10 rotate-12" />
              </div>
            </div>
          </div>

          {/* Classes Overview */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
            <div className="p-6 border-b border-gray-200 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                <BookOpen className="w-5 h-5 text-emerald-600" />
                My Classes
              </h3>
              <button 
                onClick={() => navigate('/teacher/classes')}
                className="text-emerald-600 text-sm flex items-center gap-1 hover:gap-2 transition-all"
              >
                View all <ChevronRight className="w-4 h-4" />
              </button>
            </div>
            <div className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {classes.map((classItem) => (
                  <div
                    key={classItem.id}
                    onClick={() => navigate('/teacher/classes')}
                    className="p-4 border border-gray-200 rounded-lg hover:border-emerald-500 hover:shadow-md transition-all cursor-pointer"
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <p className="text-sm text-emerald-600 font-medium">{classItem.code}</p>
                        <h4 className="font-semibold text-gray-900 mt-1">{classItem.name}</h4>
                      </div>
                    </div>
                    <div className="space-y-2 text-sm text-gray-600">
                      <div className="flex items-center gap-2">
                        <Users className="w-4 h-4" />
                        <span>{classItem.studentCount} students</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}