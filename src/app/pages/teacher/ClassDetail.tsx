import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { TeacherSidebar } from '@/app/components/TeacherSidebar';
import { CustomSelect } from '@/app/components/admin/CustomSelect';
import { 
  Bell, 
  ArrowLeft,
  Users,
  Calendar,
  Clock,
  MapPin,
  BookOpen,
  TrendingUp,
  Search,
  Filter,
  Download,
  Mail,
  Phone,
  Award,
  AlertCircle,
  CheckCircle,
  ChevronDown,
  UserCheck,
  UserX
} from 'lucide-react';

interface Student {
  id: string;
  studentId: string;
  name: string;
  email: string;
  phone: string;
  currentGrade: number;
  attendance: number;
  status: 'Active' | 'Inactive';
}

interface ClassDetail {
  id: string;
  code: string;
  name: string;
  section: string;
  schedule: string;
  room: string;
  semester: string;
  students: Student[];
  totalSessions: number;
  completedSessions: number;
}

export function ClassDetail() {
  const navigate = useNavigate();
  const { id } = useParams();
  const [teacherName, setTeacherName] = useState('');
  const [notifications, setNotifications] = useState(5);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'Active' | 'Inactive'>('all');

  // Mock class data - in real app, fetch based on id
  const [classData] = useState<ClassDetail>({
    id: id || 'CLASS001',
    code: 'MATH 101',
    name: 'Advanced Mathematics',
    section: 'Section A',
    schedule: 'MWF 8:00-9:00 AM',
    room: 'Room 301',
    semester: 'First Semester 2026',
    totalSessions: 45,
    completedSessions: 12,
    students: [
      {
        id: '1',
        studentId: 'STU001',
        name: 'Juan Dela Cruz',
        email: 'juan.delacruz@example.com',
        phone: '+63 917 123 4567',
        currentGrade: 92,
        attendance: 95,
        status: 'Active'
      },
      {
        id: '2',
        studentId: 'STU002',
        name: 'Maria Santos',
        email: 'maria.santos@example.com',
        phone: '+63 917 234 5678',
        currentGrade: 88,
        attendance: 92,
        status: 'Active'
      },
      {
        id: '3',
        studentId: 'STU003',
        name: 'Pedro Reyes',
        email: 'pedro.reyes@example.com',
        phone: '+63 917 345 6789',
        currentGrade: 85,
        attendance: 88,
        status: 'Active'
      },
      {
        id: '4',
        studentId: 'STU004',
        name: 'Ana Garcia',
        email: 'ana.garcia@example.com',
        phone: '+63 917 456 7890',
        currentGrade: 95,
        attendance: 98,
        status: 'Active'
      },
      {
        id: '5',
        studentId: 'STU005',
        name: 'Carlos Mendoza',
        email: 'carlos.mendoza@example.com',
        phone: '+63 917 567 8901',
        currentGrade: 78,
        attendance: 75,
        status: 'Inactive'
      }
    ]
  });

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

  const filteredStudents = classData.students.filter(student => {
    const matchesSearch = student.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         student.studentId.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         student.email.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesFilter = filterStatus === 'all' || student.status === filterStatus;
    return matchesSearch && matchesFilter;
  });

  const classAverage = classData.students.length > 0
    ? Math.round(classData.students.reduce((sum, s) => sum + s.currentGrade, 0) / classData.students.length)
    : 0;

  const averageAttendance = classData.students.length > 0
    ? Math.round(classData.students.reduce((sum, s) => sum + s.attendance, 0) / classData.students.length)
    : 0;

  const getGradeColor = (grade: number) => {
    if (grade >= 90) return 'text-emerald-600';
    if (grade >= 80) return 'text-blue-600';
    if (grade >= 75) return 'text-blue-500';
    return 'text-red-600';
  };

  const getAttendanceColor = (attendance: number) => {
    if (attendance >= 90) return 'text-emerald-600';
    if (attendance >= 80) return 'text-blue-600';
    return 'text-red-600';
  };

  const handleExportStudentList = () => {
    alert('Exporting student list as CSV...');
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Loading class details...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex">
      <TeacherSidebar teacherName={teacherName} onLogout={handleLogout} />

      <main className="flex-1 overflow-y-auto custom-scrollbar">
        {/* Header */}
        <div className="bg-white border-b border-gray-200 sticky top-0 z-20">
          <div className="px-6 py-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-semibold text-gray-900">Class Details</h2>
              </div>
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

        <div className="p-6 space-y-6">
          {/* Back Button */}
          <button
            onClick={() => navigate('/teacher/classes')}
            className="flex items-center gap-2 text-emerald-600 hover:text-emerald-700 font-medium transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
            Back to Classes
          </button>

          {/* Class Header */}
          <div className="bg-gradient-to-r from-emerald-600 to-teal-600 rounded-2xl p-8 text-white shadow-lg">
            <div className="flex items-start justify-between mb-6">
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-3">
                  <div className="p-3 bg-white/20 backdrop-blur-sm rounded-xl">
                    <BookOpen className="w-8 h-8 text-white" />
                  </div>
                  <div>
                    <p className="text-emerald-100 text-sm font-medium">{classData.code}</p>
                    <h1 className="text-3xl font-bold">{classData.name}</h1>
                    <p className="text-emerald-100 text-lg">{classData.section}</p>
                  </div>
                </div>
              </div>
              <button
                onClick={handleExportStudentList}
                className="flex items-center gap-2 px-4 py-2 bg-white/20 hover:bg-white/30 rounded-lg transition-colors backdrop-blur-sm"
              >
                <Download className="w-4 h-4" />
                Export List
              </button>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              <div className="bg-white/10 backdrop-blur-sm rounded-lg p-3">
                <div className="flex items-center gap-2 mb-1">
                  <Users className="w-4 h-4 text-emerald-100" />
                  <p className="text-emerald-100 text-xs">Students</p>
                </div>
                <p className="text-2xl font-bold">{classData.students.length}</p>
              </div>
              <div className="bg-white/10 backdrop-blur-sm rounded-lg p-3">
                <div className="flex items-center gap-2 mb-1">
                  <TrendingUp className="w-4 h-4 text-emerald-100" />
                  <p className="text-emerald-100 text-xs">Class Average</p>
                </div>
                <p className="text-2xl font-bold">{classAverage}%</p>
              </div>
              <div className="bg-white/10 backdrop-blur-sm rounded-lg p-3">
                <div className="flex items-center gap-2 mb-1">
                  <CheckCircle className="w-4 h-4 text-emerald-100" />
                  <p className="text-emerald-100 text-xs">Avg Attendance</p>
                </div>
                <p className="text-2xl font-bold">{averageAttendance}%</p>
              </div>
              <div className="bg-white/10 backdrop-blur-sm rounded-lg p-3">
                <div className="flex items-center gap-2 mb-1">
                  <Clock className="w-4 h-4 text-emerald-100" />
                  <p className="text-emerald-100 text-xs">Schedule</p>
                </div>
                <p className="font-semibold text-sm">{classData.schedule}</p>
              </div>
              <div className="bg-white/10 backdrop-blur-sm rounded-lg p-3">
                <div className="flex items-center gap-2 mb-1">
                  <MapPin className="w-4 h-4 text-emerald-100" />
                  <p className="text-emerald-100 text-xs">Room</p>
                </div>
                <p className="font-semibold">{classData.room}</p>
              </div>
            </div>

            {/* Progress Bar */}
            <div className="mt-6">
              <div className="flex items-center justify-between mb-2">
                <p className="text-emerald-100 text-sm">Course Progress</p>
                <p className="text-white font-semibold">
                  {classData.completedSessions} / {classData.totalSessions} sessions
                </p>
              </div>
              <div className="w-full bg-white/20 rounded-full h-3">
                <div
                  className="bg-white h-3 rounded-full transition-all"
                  style={{ width: `${(classData.completedSessions / classData.totalSessions) * 100}%` }}
                />
              </div>
            </div>
          </div>

          {/* Student List Section */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center justify-between mb-4 gap-4 flex-wrap">
                <h3 className="text-lg font-semibold text-gray-900">Student List</h3>
                <div className="w-72">
                  <CustomSelect
                    value={filterStatus}
                    onChange={(value) => setFilterStatus(value as 'all' | 'Active' | 'Inactive')}
                    options={[
                      { value: 'all', label: 'All Students', icon: <Users className="w-5 h-5 text-gray-500" /> },
                      { value: 'Active', label: 'Active Students', icon: <UserCheck className="w-5 h-5 text-emerald-500" /> },
                      { value: 'Inactive', label: 'Inactive Students', icon: <UserX className="w-5 h-5 text-red-500" /> }
                    ]}
                    icon={<Filter className="w-5 h-5" />}
                    placeholder="Filter students"
                  />
                </div>
              </div>

              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search by name, ID, or email..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                />
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Student ID
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Name
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Contact
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Current Grade
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Attendance
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredStudents.map((student) => (
                    <tr key={student.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="text-sm font-medium text-emerald-600">{student.studentId}</span>
                      </td>
                      <td className="px-6 py-4">
                        <div>
                          <p className="text-sm font-medium text-gray-900">{student.name}</p>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2 text-xs text-gray-600">
                            <Mail className="w-3 h-3" />
                            {student.email}
                          </div>
                          <div className="flex items-center gap-2 text-xs text-gray-600">
                            <Phone className="w-3 h-3" />
                            {student.phone}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <Award className={`w-4 h-4 ${getGradeColor(student.currentGrade)}`} />
                          <span className={`text-sm font-semibold ${getGradeColor(student.currentGrade)}`}>
                            {student.currentGrade}%
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          {student.attendance >= 90 ? (
                            <CheckCircle className="w-4 h-4 text-emerald-600" />
                          ) : (
                            <AlertCircle className="w-4 h-4 text-red-600" />
                          )}
                          <span className={`text-sm font-semibold ${getAttendanceColor(student.attendance)}`}>
                            {student.attendance}%
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span
                          className={`px-2 py-1 text-xs font-medium rounded-full ${
                            student.status === 'Active'
                              ? 'bg-emerald-100 text-emerald-700'
                              : 'bg-gray-100 text-gray-700'
                          }`}
                        >
                          {student.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <button
                          onClick={() => navigate(`/teacher/grades`)}
                          className="text-emerald-600 hover:text-emerald-700 text-sm font-medium"
                        >
                          View Details
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {filteredStudents.length === 0 && (
              <div className="p-12 text-center">
                <Users className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-gray-900 mb-2">No students found</h3>
                <p className="text-gray-600">Try adjusting your search or filter criteria</p>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}