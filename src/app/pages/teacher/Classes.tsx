import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { TeacherSidebar } from '@/app/components/TeacherSidebar';
import { 
  Bell, 
  BookOpen,
  Users,
  Search,
  Calendar,
  TrendingUp,
  Megaphone,
  X
} from 'lucide-react';

interface Student {
  id: string;
  studentId: string;
  name: string;
  email: string;
  currentGrade: number;
  attendanceRate: number;
}

interface ClassInfo {
  id: string;
  code: string;
  name: string;
  description: string;
  studentCount: number;
  semester: string;
  students: Student[];
}

export function Classes() {
  const navigate = useNavigate();
  const [teacherName, setTeacherName] = useState('');
  const [notifications, setNotifications] = useState(5);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedClass, setSelectedClass] = useState<ClassInfo | null>(null);
  const [studentSearchQuery, setStudentSearchQuery] = useState('');

  // Mock data
  const [classes] = useState<ClassInfo[]>([
    { 
      id: '1', 
      code: 'MATH101', 
      name: 'Advanced Mathematics',
      description: 'Advanced topics in calculus and algebra for senior high school students',
      studentCount: 32,
      semester: 'First Semester 2026',
      students: [
        { id: '1', studentId: 'STU-2026-001', name: 'Juan Dela Cruz', email: 'juan.delacruz@student.edu', currentGrade: 92, attendanceRate: 95 },
        { id: '2', studentId: 'STU-2026-002', name: 'Maria Santos', email: 'maria.santos@student.edu', currentGrade: 88, attendanceRate: 98 },
        { id: '3', studentId: 'STU-2026-003', name: 'Pedro Garcia', email: 'pedro.garcia@student.edu', currentGrade: 95, attendanceRate: 100 },
        { id: '4', studentId: 'STU-2026-004', name: 'Ana Rodriguez', email: 'ana.rodriguez@student.edu', currentGrade: 90, attendanceRate: 92 },
        { id: '5', studentId: 'STU-2026-005', name: 'Carlos Reyes', email: 'carlos.reyes@student.edu', currentGrade: 85, attendanceRate: 88 },
      ]
    },
    { 
      id: '2', 
      code: 'MATH102', 
      name: 'Calculus I',
      description: 'Introduction to differential and integral calculus',
      studentCount: 28,
      semester: 'First Semester 2026',
      students: [
        { id: '6', studentId: 'STU-2026-006', name: 'Lisa Tan', email: 'lisa.tan@student.edu', currentGrade: 91, attendanceRate: 96 },
        { id: '7', studentId: 'STU-2026-007', name: 'Miguel Cruz', email: 'miguel.cruz@student.edu', currentGrade: 87, attendanceRate: 94 },
        { id: '8', studentId: 'STU-2026-008', name: 'Sofia Gomez', email: 'sofia.gomez@student.edu', currentGrade: 93, attendanceRate: 100 },
      ]
    },
    { 
      id: '3', 
      code: 'MATH201', 
      name: 'Linear Algebra',
      description: 'Vector spaces, matrices, and linear transformations',
      studentCount: 25,
      semester: 'First Semester 2026',
      students: [
        { id: '9', studentId: 'STU-2026-009', name: 'Robert Lee', email: 'robert.lee@student.edu', currentGrade: 89, attendanceRate: 91 },
        { id: '10', studentId: 'STU-2026-010', name: 'Emma Wilson', email: 'emma.wilson@student.edu', currentGrade: 94, attendanceRate: 97 },
      ]
    },
  ]);

  useEffect(() => {
    const userData = localStorage.getItem('currentUser');

    if (!userData) {
      navigate('/login');
      return;
    }

    const user = JSON.parse(userData);
    if (user.role !== 'teacher') {
      navigate('/login');
      return;
    }

    setTeacherName(user.name);

    setTimeout(() => setLoading(false), 600);
  }, [navigate]);

  const handleLogout = () => {
    localStorage.removeItem('currentUser');
    navigate('/login');
  };

  const filteredClasses = classes.filter(classItem =>
    classItem.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    classItem.code.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredStudents = selectedClass?.students.filter(student =>
    student.name.toLowerCase().includes(studentSearchQuery.toLowerCase()) ||
    student.studentId.toLowerCase().includes(studentSearchQuery.toLowerCase()) ||
    student.email.toLowerCase().includes(studentSearchQuery.toLowerCase())
  ) || [];

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Loading classes...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex">
      <TeacherSidebar teacherName={teacherName} onLogout={handleLogout} />

      <main className="flex-1 overflow-y-auto custom-scrollbar">
        {/* Top Bar */}
        <div className="bg-white border-b border-gray-200 sticky top-0 z-20">
          <div className="px-6 py-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-semibold text-gray-900">Classes</h2>
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
          {!selectedClass ? (
            <>
              {/* Header */}
              <div className="bg-gradient-to-r from-emerald-600 to-teal-600 rounded-2xl p-8 text-white shadow-lg">
                <h1 className="text-3xl font-bold mb-2">My Classes</h1>
                <p className="text-emerald-50">First Semester 2026 • {classes.length} Classes</p>
              </div>

              {/* Search */}
              <div className="bg-white rounded-xl p-4 border border-gray-200 shadow-sm">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Search classes by name or code..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                  />
                </div>
              </div>

              {/* Classes Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredClasses.map((classItem) => (
                  <div
                    key={classItem.id}
                    onClick={() => navigate(`/teacher/class/${classItem.id}`)}
                    className="bg-white rounded-xl border border-gray-200 shadow-sm hover:shadow-lg transition-all duration-300 cursor-pointer group overflow-hidden"
                  >
                    <div className="bg-gradient-to-r from-emerald-600 to-teal-600 p-6">
                      <p className="text-emerald-100 text-sm font-medium">{classItem.code}</p>
                      <h3 className="text-white font-bold text-xl mt-1">{classItem.name}</h3>
                    </div>

                    <div className="p-6 space-y-4">
                      <p className="text-gray-600 text-sm line-clamp-2">{classItem.description}</p>

                      <div className="flex items-center gap-3 text-sm">
                        <div className="p-2 bg-emerald-50 rounded-lg">
                          <Users className="w-4 h-4 text-emerald-600" />
                        </div>
                        <div>
                          <p className="text-gray-500 text-xs">Enrolled Students</p>
                          <p className="text-gray-900 font-medium">{classItem.studentCount} students</p>
                        </div>
                      </div>

                      <button className="w-full px-4 py-3 bg-emerald-600 text-white rounded-lg transition-all hover:bg-emerald-700 font-medium">
                        View Class Details
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <>
              {/* Class Details View */}
              <div className="bg-gradient-to-r from-emerald-600 to-teal-600 rounded-2xl p-8 text-white shadow-lg">
                <button
                  onClick={() => setSelectedClass(null)}
                  className="mb-4 flex items-center gap-2 text-emerald-100 hover:text-white transition-colors"
                >
                  ← Back to Classes
                </button>
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-emerald-100 text-sm font-medium">{selectedClass.code}</p>
                    <h1 className="text-3xl font-bold mb-2">{selectedClass.name}</h1>
                    <p className="text-emerald-50">{selectedClass.description}</p>
                  </div>
                </div>
                <div className="mt-6">
                  <div className="flex items-center gap-2">
                    <Users className="w-5 h-5" />
                    <span>{selectedClass.studentCount} students</span>
                  </div>
                </div>
              </div>

              {/* Quick Actions */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <button
                  onClick={() => navigate('/teacher/attendance')}
                  className="p-6 bg-white border-2 border-gray-200 rounded-xl hover:border-emerald-500 hover:shadow-md transition-all text-left group"
                >
                  <Calendar className="w-8 h-8 text-emerald-600 mb-3" />
                  <p className="font-semibold text-gray-900 group-hover:text-emerald-700">Record Attendance</p>
                  <p className="text-sm text-gray-600 mt-1">Mark today's attendance for this class</p>
                </button>

                <button
                  onClick={() => navigate('/teacher/grades')}
                  className="p-6 bg-white border-2 border-gray-200 rounded-xl hover:border-emerald-500 hover:shadow-md transition-all text-left group"
                >
                  <TrendingUp className="w-8 h-8 text-blue-600 mb-3" />
                  <p className="font-semibold text-gray-900 group-hover:text-emerald-700">Encode Grades</p>
                  <p className="text-sm text-gray-600 mt-1">Input or update student grades</p>
                </button>

                <button
                  onClick={() => navigate('/teacher/announcements')}
                  className="p-6 bg-white border-2 border-gray-200 rounded-xl hover:border-emerald-500 hover:shadow-md transition-all text-left group"
                >
                  <Megaphone className="w-8 h-8 text-blue-600 mb-3" />
                  <p className="font-semibold text-gray-900 group-hover:text-emerald-700">Post Announcement</p>
                  <p className="text-sm text-gray-600 mt-1">Share updates with students</p>
                </button>
              </div>

              {/* Student List */}
              <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
                <div className="p-6 border-b border-gray-200">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold text-gray-900">Student List</h3>
                    <span className="text-sm text-gray-600">{selectedClass.students.length} students</span>
                  </div>

                  {/* Search */}
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                      type="text"
                      placeholder="Search students..."
                      value={studentSearchQuery}
                      onChange={(e) => setStudentSearchQuery(e.target.value)}
                      className="w-full pl-9 pr-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                    />
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Student ID</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Email</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Current Grade</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Attendance</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {filteredStudents.map((student) => (
                        <tr key={student.id} className="hover:bg-gray-50 transition-colors">
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-emerald-600">
                            {student.studentId}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 bg-emerald-600 rounded-full flex items-center justify-center text-white text-sm font-semibold">
                                {student.name.charAt(0)}
                              </div>
                              <span className="text-sm font-medium text-gray-900">{student.name}</span>
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                            {student.email}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className="px-3 py-1 rounded-full text-sm font-bold bg-emerald-50 text-emerald-600">
                              {student.currentGrade}%
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className="px-3 py-1 rounded-full text-sm font-bold bg-blue-50 text-blue-600">
                              {student.attendanceRate}%
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {filteredStudents.length === 0 && (
                  <div className="p-12 text-center">
                    <Users className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                    <p className="text-gray-600">No students found</p>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </main>
    </div>
  );
}