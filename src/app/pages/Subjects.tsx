import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Sidebar } from '@/app/components/Sidebar';
import { 
  Bell, 
  BookOpen, 
  User,
  Calendar,
  Search,
  ChevronRight
} from 'lucide-react';

interface Subject {
  id: string;
  code: string;
  name: string;
  teacher: string;
  teacherId: string;
  description: string;
  credits: number;
  quarter: string;
}

export function Subjects() {
  const navigate = useNavigate();
  const [studentName, setStudentName] = useState('');
  const [notifications, setNotifications] = useState(3);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  // Mock data
  const [subjects] = useState<Subject[]>([
    { 
      id: '1', 
      code: 'MATH101', 
      name: 'Advanced Mathematics', 
      teacher: 'Ms. Sarah Rodriguez', 
      teacherId: 'T001',
      description: 'Advanced topics in calculus and algebra',
      credits: 3,
      quarter: '1st Quarter 2026'
    },
    { 
      id: '2', 
      code: 'ENG101', 
      name: 'English Literature', 
      teacher: 'Mr. David Santos', 
      teacherId: 'T002',
      description: 'Introduction to classical and modern literature',
      credits: 3,
      quarter: '1st Quarter 2026'
    },
    { 
      id: '3', 
      code: 'SCI101', 
      name: 'General Science', 
      teacher: 'Dr. Maria Cruz', 
      teacherId: 'T003',
      description: 'Fundamentals of biology, chemistry, and physics',
      credits: 4,
      quarter: '1st Quarter 2026'
    },
    { 
      id: '4', 
      code: 'FIL101', 
      name: 'Filipino Language', 
      teacher: 'Mrs. Elena Reyes', 
      teacherId: 'T004',
      description: 'Filipino language and literature',
      credits: 3,
      quarter: '1st Quarter 2026'
    },
    { 
      id: '5', 
      code: 'PE101', 
      name: 'Physical Education', 
      teacher: 'Coach Robert Tan', 
      teacherId: 'T005',
      description: 'Physical fitness and sports activities',
      credits: 2,
      quarter: '1st Quarter 2026'
    },
    { 
      id: '6', 
      code: 'CS101', 
      name: 'Computer Science Fundamentals', 
      teacher: 'Mr. James Garcia', 
      teacherId: 'T006',
      description: 'Introduction to programming and computer systems',
      credits: 4,
      quarter: '1st Quarter 2026'
    },
  ]);

  useEffect(() => {
    const userData = localStorage.getItem('currentUser');

    if (!userData) {
      navigate('/login');
      return;
    }

    const user = JSON.parse(userData);
    if (user.role !== 'student') {
      navigate('/login');
      return;
    }

    setStudentName(user.name);
    setTimeout(() => setLoading(false), 600);
  }, [navigate]);

  const handleLogout = () => {
    localStorage.removeItem('currentUser');
    navigate('/login');
  };

  const handleExportSubjects = () => {
    const header = ['Code', 'Name', 'Teacher', 'Credits', 'Quarter'];
    const rows = subjects.map((s) => [
      s.code,
      s.name,
      s.teacher,
      String(s.credits),
      s.quarter,
    ]);
    const csv = [header, ...rows]
      .map((row) => row.map((cell) => `"${cell.replace(/"/g, '""')}"`).join(','))
      .join('\n');

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'subjects-report.csv';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const filteredSubjects = subjects.filter(subject =>
    subject.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    subject.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
    subject.teacher.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Loading subjects...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex">
      <Sidebar studentName={studentName} onLogout={handleLogout} />

      <main className="flex-1 overflow-y-auto custom-scrollbar">
        {/* Top Bar */}
        <div className="bg-white border-b border-gray-200 sticky top-0 z-20">
          <div className="px-6 py-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-semibold text-gray-900">My Subjects</h2>
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
          {/* Header Section */}
          <div className="bg-gradient-to-r from-emerald-600 to-teal-600 rounded-2xl p-8 text-white shadow-lg">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-3xl font-bold mb-2">Enrolled Subjects</h1>
                <p className="text-emerald-50">1st Quarter 2026 • {subjects.length} Subjects</p>
              </div>
              <div className="hidden md:flex items-center gap-4">
                <div className="text-right">
                  <p className="text-emerald-100 text-sm">Total Credits</p>
                  <p className="text-3xl font-bold">{subjects.reduce((sum, s) => sum + s.credits, 0)}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Search Bar */}
          <div className="bg-white rounded-xl p-4 border border-gray-200 shadow-sm">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                placeholder="Search subjects, teachers, or codes..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
              />
            </div>
            <div className="mt-4 flex justify-end">
              <button
                onClick={handleExportSubjects}
                className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700 transition-colors"
              >
                <Download className="w-4 h-4" />
                Export Subjects
              </button>
            </div>
          </div>

          {/* Subjects Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredSubjects.map((subject) => (
              <div
                key={subject.id}
                className="bg-white rounded-xl border border-gray-200 shadow-sm hover:shadow-lg transition-all duration-300 cursor-pointer group overflow-hidden"
              >
                <div className="bg-gradient-to-r from-emerald-600 to-teal-600 p-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-emerald-100 text-sm font-medium">{subject.code}</p>
                      <h3 className="text-white font-bold text-lg mt-1">{subject.name}</h3>
                    </div>
                    <div className="bg-white/20 px-3 py-1 rounded-full">
                      <p className="text-white text-xs font-medium">{subject.credits} Credits</p>
                    </div>
                  </div>
                </div>

                <div className="p-6 space-y-4">
                  <p className="text-gray-600 text-sm line-clamp-2">{subject.description}</p>

                  <div className="space-y-3">
                    <div className="flex items-center gap-3 text-sm">
                      <div className="p-2 bg-emerald-50 rounded-lg">
                        <User className="w-4 h-4 text-emerald-600" />
                      </div>
                      <div>
                        <p className="text-gray-500 text-xs">Teacher</p>
                        <p className="text-gray-900 font-medium">{subject.teacher}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 text-sm">
                      <div className="p-2 bg-blue-50 rounded-lg">
                        <Calendar className="w-4 h-4 text-blue-600" />
                      </div>
                      <div>
                        <p className="text-gray-500 text-xs">Quarter</p>
                        <p className="text-gray-900 font-medium">{subject.quarter}</p>
                      </div>
                    </div>
                  </div>

                  <button 
                    onClick={() => navigate(`/subject/${subject.id}`)}
                    className="w-full mt-4 flex items-center justify-center gap-2 px-4 py-3 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-all duration-300 shadow-sm hover:shadow-md"
                  >
                    <span className="font-medium">View Details</span>
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Empty State */}
          {filteredSubjects.length === 0 && (
            <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
              <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <BookOpen className="w-8 h-8 text-gray-400" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">No subjects found</h3>
              <p className="text-gray-600">Try adjusting your search query</p>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}