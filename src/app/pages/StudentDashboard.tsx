import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Sidebar } from '@/app/components/Sidebar';
import { 
  Bell, 
  BookOpen, 
  TrendingUp, 
  Calendar, 
  Megaphone,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
  ArrowRight,
  GraduationCap
} from 'lucide-react';
import { DashboardCalendar } from '@/app/components/DashboardCalendar';

// Mock data types
interface Subject {
  id: string;
  code: string;
  name: string;
  teacher: string;
}

interface Grade {
  id: string;
  subjectName: string;
  value: number;
  dateRecorded: string;
}

interface AttendanceRecord {
  id: string;
  subject: string;
  status: 'Present' | 'Absent' | 'Late';
  date: string;
}

interface Announcement {
  id: string;
  title: string;
  preview: string;
  timestamp: string;
  isRead: boolean;
}

export function StudentDashboard() {
  const navigate = useNavigate();
  const [studentName, setStudentName] = useState('');
  const [schoolName, setSchoolName] = useState('');
  const [notifications, setNotifications] = useState(3);
  const [loading, setLoading] = useState(true);

  // Mock data
  const [subjects] = useState<Subject[]>([
    { id: '1', code: 'MATH101', name: 'Mathematics', teacher: 'Ms. Rodriguez' },
    { id: '2', code: 'ENG101', name: 'English Literature', teacher: 'Mr. Santos' },
    { id: '3', code: 'SCI101', name: 'General Science', teacher: 'Dr. Cruz' },
    { id: '4', code: 'FIL101', name: 'Filipino', teacher: 'Mrs. Reyes' },
  ]);

  const [recentGrades] = useState<Grade[]>([
    { id: '1', subjectName: 'Mathematics', value: 92, dateRecorded: '2026-01-14' },
    { id: '2', subjectName: 'English Literature', value: 88, dateRecorded: '2026-01-13' },
    { id: '3', subjectName: 'General Science', value: 95, dateRecorded: '2026-01-12' },
  ]);

  const [recentAttendance] = useState<AttendanceRecord[]>([
    { id: '1', subject: 'Mathematics', status: 'Present', date: '2026-01-16' },
    { id: '2', subject: 'English Literature', status: 'Present', date: '2026-01-15' },
    { id: '3', subject: 'General Science', status: 'Late', date: '2026-01-15' },
    { id: '4', subject: 'Filipino', status: 'Present', date: '2026-01-14' },
  ]);

  const [announcements] = useState<Announcement[]>([
    { id: '1', title: 'Mid-term Examinations Schedule', preview: 'The mid-term examinations will be held from January 20-24, 2026...', timestamp: '2 hours ago', isRead: false },
    { id: '2', title: 'Library Hours Extended', preview: 'Starting next week, library hours will be extended until 8:00 PM...', timestamp: '1 day ago', isRead: false },
    { id: '3', title: 'Sports Fest Registration', preview: 'Annual Sports Festival registration is now open. Sign up by...', timestamp: '2 days ago', isRead: true },
  ]);

  useEffect(() => {
    // Check if user is logged in
    const userData = localStorage.getItem('currentUser');
    const schoolData = localStorage.getItem('selectedSchool');

    if (!userData) {
      navigate('/school-selection');
      return;
    }

    const user = JSON.parse(userData);
    if (user.role !== 'student') {
      navigate('/school-selection');
      return;
    }

    setStudentName(user.name);
    if (schoolData) {
      const school = JSON.parse(schoolData);
      setSchoolName(school.name);
    }

    // Simulate loading
    setTimeout(() => setLoading(false), 800);
  }, [navigate]);

  const handleLogout = () => {
    localStorage.removeItem('currentUser');
    navigate('/school-selection');
  };

  // Calculate statistics
  const averageGrade = recentGrades.length > 0
    ? Math.round(recentGrades.reduce((sum, g) => sum + g.value, 0) / recentGrades.length)
    : 0;

  const attendanceRate = recentAttendance.length > 0
    ? Math.round((recentAttendance.filter(a => a.status === 'Present').length / recentAttendance.length) * 100)
    : 0;

  const unreadAnnouncements = announcements.filter(a => !a.isRead).length;

  const getAttendanceIcon = (status: string) => {
    switch (status) {
      case 'Present':
        return <CheckCircle className="w-4 h-4 text-emerald-600" />;
      case 'Absent':
        return <XCircle className="w-4 h-4 text-red-600" />;
      case 'Late':
        return <AlertCircle className="w-4 h-4 text-red-600" />;
      default:
        return null;
    }
  };

  const getAttendanceColor = (status: string) => {
    switch (status) {
      case 'Present':
        return 'text-emerald-600 bg-emerald-50';
      case 'Absent':
        return 'text-red-600 bg-red-50';
      case 'Late':
        return 'text-red-600 bg-red-50';
      default:
        return 'text-gray-600 bg-gray-50';
    }
  };

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

      {/* Sidebar */}
      <Sidebar studentName={studentName} onLogout={handleLogout} />

      {/* Main Content */}
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
            <h1 className="text-3xl font-bold mb-2">Welcome, {studentName}!</h1>
            <p className="text-emerald-50">Here is your academic overview</p>
          </div>

          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {/* Total Subjects */}
            <div className="bg-white rounded-xl p-6 border border-gray-200 shadow-sm hover:shadow-md transition-shadow">
              <div className="flex items-center justify-between mb-4">
                <div className="p-3 bg-emerald-50 rounded-lg">
                  <BookOpen className="w-6 h-6 text-emerald-600" />
                </div>
              </div>
              <p className="text-gray-600 text-sm mb-1">Total Subjects</p>
              <p className="text-3xl font-bold text-gray-900">{subjects.length}</p>
            </div>

            {/* Average Grade */}
            <div className="bg-white rounded-xl p-6 border border-gray-200 shadow-sm hover:shadow-md transition-shadow">
              <div className="flex items-center justify-between mb-4">
                <div className="p-3 bg-blue-50 rounded-lg">
                  <TrendingUp className="w-6 h-6 text-blue-600" />
                </div>
              </div>
              <p className="text-gray-600 text-sm mb-1">Average Grade</p>
              <p className="text-3xl font-bold text-gray-900">{averageGrade}%</p>
            </div>

            {/* Attendance Rate */}
            <div className="bg-white rounded-xl p-6 border border-gray-200 shadow-sm hover:shadow-md transition-shadow">
              <div className="flex items-center justify-between mb-4">
                <div className="p-3 bg-blue-50 rounded-lg">
                  <Calendar className="w-6 h-6 text-blue-600" />
                </div>
              </div>
              <p className="text-gray-600 text-sm mb-1">Attendance Rate</p>
              <p className="text-3xl font-bold text-gray-900">{attendanceRate}%</p>
            </div>

            {/* Unread Announcements */}
            <div className="bg-white rounded-xl p-6 border border-gray-200 shadow-sm hover:shadow-md transition-shadow">
              <div className="flex items-center justify-between mb-4">
                <div className="p-3 bg-blue-50 rounded-lg">
                  <Megaphone className="w-6 h-6 text-blue-600" />
                </div>
              </div>
              <p className="text-gray-600 text-sm mb-1">Unread Announcements</p>
              <p className="text-3xl font-bold text-gray-900">{unreadAnnouncements}</p>
            </div>
          </div>

          {/* Main Layout Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-6">
              {/* Recent Grades */}
              <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
                <div className="p-6 border-b border-gray-200">
                  <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                    <TrendingUp className="w-5 h-5 text-emerald-600" />
                    Recent Grades
                  </h3>
                </div>
                <div className="p-6">
                  <div className="space-y-4">
                    {recentGrades.map((grade) => (
                      <div key={grade.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
                        <div className="flex-1">
                          <p className="font-medium text-gray-900">{grade.subjectName}</p>
                          <p className="text-sm text-gray-500">{new Date(grade.dateRecorded).toLocaleDateString()}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-2xl font-bold text-emerald-600">{grade.value}%</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Recent Attendance */}
              <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
                <div className="p-6 border-b border-gray-200">
                  <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                    <Calendar className="w-5 h-5 text-emerald-600" />
                    Recent Attendance
                  </h3>
                </div>
                <div className="p-6">
                  <div className="space-y-4">
                    {recentAttendance.map((record) => (
                      <div key={record.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
                        <div className="flex-1">
                          <p className="font-medium text-gray-900">{record.subject}</p>
                          <p className="text-sm text-gray-500">{new Date(record.date).toLocaleDateString()}</p>
                        </div>
                        <div className={`flex items-center gap-2 px-3 py-1 rounded-full ${getAttendanceColor(record.status)}`}>
                          {getAttendanceIcon(record.status)}
                          <span className="text-sm font-medium">{record.status}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Sidebar Column */}
            <div className="space-y-6">
              <DashboardCalendar />
              
              {/* Learning Progress Card */}
              <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
                <h3 className="text-sm font-bold text-gray-400 uppercase mb-4">Learning Progress</h3>
                <div className="space-y-4">
                  <div>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-gray-600">Curriculum Completion</span>
                      <span className="font-bold text-emerald-600">75%</span>
                    </div>
                    <div className="w-full bg-gray-100 h-2 rounded-full overflow-hidden">
                      <div className="bg-emerald-600 h-full rounded-full" style={{ width: '75%' }}></div>
                    </div>
                  </div>
                  <div>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-gray-600">Attendance Goal</span>
                      <span className="font-bold text-blue-600">92%</span>
                    </div>
                    <div className="w-full bg-gray-100 h-2 rounded-full overflow-hidden">
                      <div className="bg-blue-600 h-full rounded-full" style={{ width: '92%' }}></div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Quick Info */}
              <div className="bg-emerald-600 rounded-xl p-6 text-white">
                <div className="flex items-center gap-3 mb-4">
                  <GraduationCap className="w-8 h-8 opacity-80" />
                  <h4 className="font-bold">Academic Status</h4>
                </div>
                <p className="text-sm text-emerald-100 mb-4">You are currently in good academic standing. Keep up the great work!</p>
                <button 
                  onClick={() => navigate('/grades')}
                  className="w-full py-2 bg-white/20 hover:bg-white/30 rounded-lg text-sm font-medium transition-colors"
                >
                  View Full Report
                </button>
              </div>
            </div>
          </div>

          {/* Subject List Preview */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
            <div className="p-6 border-b border-gray-200 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                <BookOpen className="w-5 h-5 text-emerald-600" />
                My Subjects
              </h3>
              <button 
                onClick={() => navigate('/subjects')}
                className="text-emerald-600 hover:text-emerald-700 text-sm font-medium flex items-center gap-1"
              >
                View All
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Code</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Subject Name</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Teacher</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {subjects.map((subject) => (
                    <tr key={subject.id} className="hover:bg-gray-50 cursor-pointer transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="text-sm font-medium text-emerald-600">{subject.code}</span>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-sm font-medium text-gray-900">{subject.name}</span>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-sm text-gray-600">{subject.teacher}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Announcements Preview */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
            <div className="p-6 border-b border-gray-200 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                <Megaphone className="w-5 h-5 text-emerald-600" />
                Latest Announcements
              </h3>
              <button 
                onClick={() => navigate('/announcements')}
                className="text-emerald-600 hover:text-emerald-700 text-sm font-medium flex items-center gap-1"
              >
                View All
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
            <div className="p-6">
              <div className="space-y-4">
                {announcements.map((announcement) => (
                  <div 
                    key={announcement.id} 
                    className={`p-4 rounded-lg border transition-all hover:shadow-md cursor-pointer ${
                      announcement.isRead ? 'bg-gray-50 border-gray-200' : 'bg-emerald-50 border-emerald-200'
                    }`}
                  >
                    <div className="flex items-start justify-between mb-2">
                      <h4 className="font-semibold text-gray-900 flex items-center gap-2">
                        {announcement.title}
                        {!announcement.isRead && (
                          <span className="w-2 h-2 bg-emerald-600 rounded-full"></span>
                        )}
                      </h4>
                      <span className="text-xs text-gray-500">{announcement.timestamp}</span>
                    </div>
                    <p className="text-sm text-gray-600">{announcement.preview}</p>
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