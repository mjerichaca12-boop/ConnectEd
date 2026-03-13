import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Sidebar } from '@/app/components/Sidebar';
import { 
  Bell, 
  Book, 
  Calendar, 
  Clock, 
  User, 
  FileText, 
  Download,
  Video,
  File,
  CheckCircle,
  ArrowLeft,
  BookOpen,
  Award,
  Users,
  MapPin
} from 'lucide-react';

interface Module {
  id: string;
  title: string;
  description: string;
  type: 'video' | 'document' | 'quiz';
  completed: boolean;
  dueDate?: string;
}

interface Subject {
  id: string;
  code: string;
  name: string;
  teacher: string;
  teacherId: string;
  description: string;
  credits: number;
  quarter: string;
  room: string;
  enrolled: number;
  capacity: number;
  syllabus: string;
  objectives: string[];
  grading: {
    component: string;
    percentage: number;
  }[];
  modules: Module[];
}

export function SubjectDetail() {
  const navigate = useNavigate();
  const { id } = useParams();
  const [studentName, setStudentName] = useState('');
  const [schoolName, setSchoolName] = useState('');
  const [notifications, setNotifications] = useState(3);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'overview' | 'modules' | 'grades'>('overview');

  // Mock subject data - in real app, fetch based on id
  const [subject] = useState<Subject>({
    id: id || 'MATH101',
    code: 'MATH 101',
    name: 'Advanced Mathematics',
    teacher: 'Dr. Maria Santos',
    teacherId: 'T001',
    description: 'Advanced topics in calculus and algebra including differential equations, complex analysis, and linear transformations.',
    credits: 3,
    quarter: '1st Quarter 2026',
    room: 'Room 301, Math Building',
    enrolled: 35,
    capacity: 40,
    syllabus: 'https://example.com/syllabus.pdf',
    objectives: [
      'Understand and apply advanced calculus concepts',
      'Solve complex differential equations',
      'Master linear algebra transformations',
      'Develop analytical and problem-solving skills'
    ],
    grading: [
      { component: 'Quizzes', percentage: 20 },
      { component: 'Assignments', percentage: 20 },
      { component: 'Midterm Exam', percentage: 25 },
      { component: 'Final Exam', percentage: 35 }
    ],
    modules: [
      {
        id: 'M1',
        title: 'Introduction to Differential Equations',
        description: 'Learn the fundamentals of differential equations and their applications',
        type: 'video',
        completed: true
      },
      {
        id: 'M2',
        title: 'Linear Transformations',
        description: 'Understanding linear transformations in vector spaces',
        type: 'document',
        completed: true
      },
      {
        id: 'M3',
        title: 'Quiz 1: Differential Equations',
        description: 'Assessment covering modules 1-2',
        type: 'quiz',
        completed: false,
        dueDate: '2026-02-15'
      },
      {
        id: 'M4',
        title: 'Complex Analysis Introduction',
        description: 'Introduction to complex numbers and complex functions',
        type: 'video',
        completed: false,
        dueDate: '2026-02-20'
      }
    ]
  });

  useEffect(() => {
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
      setSchoolName(JSON.parse(schoolData).name);
    }

    setTimeout(() => setLoading(false), 600);
  }, [navigate]);

  const handleLogout = () => {
    localStorage.removeItem('currentUser');
    navigate('/school-selection');
  };

  const getModuleIcon = (type: string) => {
    switch (type) {
      case 'video': return <Video className="w-5 h-5" />;
      case 'document': return <FileText className="w-5 h-5" />;
      case 'quiz': return <Award className="w-5 h-5" />;
      default: return <File className="w-5 h-5" />;
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Loading subject details...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex">
      <Sidebar studentName={studentName} onLogout={handleLogout} />

      <main className="flex-1 overflow-y-auto custom-scrollbar">
        {/* Header */}
        <div className="bg-white border-b border-gray-200 sticky top-0 z-20">
          <div className="px-6 py-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-semibold text-gray-900">Subject Details</h2>
                <p className="text-sm text-gray-600">{schoolName}</p>
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
            onClick={() => navigate('/subjects')}
            className="flex items-center gap-2 text-emerald-600 hover:text-emerald-700 font-medium transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
            Back to Subjects
          </button>

          {/* Subject Header */}
          <div className="bg-gradient-to-r from-emerald-600 to-teal-600 rounded-2xl p-8 text-white shadow-lg">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-3">
                  <div className="p-3 bg-white/20 backdrop-blur-sm rounded-xl">
                    <Book className="w-8 h-8 text-white" />
                  </div>
                  <div>
                    <p className="text-emerald-100 text-sm font-medium">{subject.code}</p>
                    <h1 className="text-3xl font-bold">{subject.name}</h1>
                  </div>
                </div>
                <p className="text-emerald-50 text-lg mb-4">{subject.description}</p>
                
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mt-6">
                  <div className="bg-white/10 backdrop-blur-sm rounded-lg p-3">
                    <div className="flex items-center gap-2 mb-1">
                      <User className="w-4 h-4 text-emerald-100" />
                      <p className="text-emerald-100 text-xs">Teacher</p>
                    </div>
                    <p className="font-semibold">{subject.teacher}</p>
                  </div>
                  <div className="bg-white/10 backdrop-blur-sm rounded-lg p-3">
                    <div className="flex items-center gap-2 mb-1">
                      <MapPin className="w-4 h-4 text-emerald-100" />
                      <p className="text-emerald-100 text-xs">Room</p>
                    </div>
                    <p className="font-semibold text-sm">{subject.room}</p>
                  </div>
                  <div className="bg-white/10 backdrop-blur-sm rounded-lg p-3">
                    <div className="flex items-center gap-2 mb-1">
                      <Award className="w-4 h-4 text-emerald-100" />
                      <p className="text-emerald-100 text-xs">Credits</p>
                    </div>
                    <p className="font-semibold">{subject.credits} Units</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Tabs */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
            <div className="border-b border-gray-200">
              <div className="flex gap-6 px-6">
                <button
                  onClick={() => setActiveTab('overview')}
                  className={`py-4 border-b-2 font-medium transition-colors ${
                    activeTab === 'overview'
                      ? 'border-emerald-600 text-emerald-600'
                      : 'border-transparent text-gray-600 hover:text-gray-900'
                  }`}
                >
                  Overview
                </button>
                <button
                  onClick={() => setActiveTab('modules')}
                  className={`py-4 border-b-2 font-medium transition-colors ${
                    activeTab === 'modules'
                      ? 'border-emerald-600 text-emerald-600'
                      : 'border-transparent text-gray-600 hover:text-gray-900'
                  }`}
                >
                  Modules & Materials
                </button>
                <button
                  onClick={() => setActiveTab('grades')}
                  className={`py-4 border-b-2 font-medium transition-colors ${
                    activeTab === 'grades'
                      ? 'border-emerald-600 text-emerald-600'
                      : 'border-transparent text-gray-600 hover:text-gray-900'
                  }`}
                >
                  Grading System
                </button>
              </div>
            </div>

            <div className="p-6">
              {/* Overview Tab */}
              {activeTab === 'overview' && (
                <div className="space-y-6">
                  {/* Learning Objectives */}
                  <div>
                    <div className="flex items-center gap-2 mb-4">
                      <BookOpen className="w-5 h-5 text-emerald-600" />
                      <h3 className="text-lg font-semibold text-gray-900">Learning Objectives</h3>
                    </div>
                    <ul className="space-y-3">
                      {subject.objectives.map((objective, index) => (
                        <li key={index} className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
                          <CheckCircle className="w-5 h-5 text-emerald-600 flex-shrink-0 mt-0.5" />
                          <span className="text-gray-700">{objective}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  {/* Class Info */}
                  <div>
                    <div className="flex items-center gap-2 mb-4">
                      <Users className="w-5 h-5 text-emerald-600" />
                      <h3 className="text-lg font-semibold text-gray-900">Class Information</h3>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="p-4 bg-gray-50 rounded-lg">
                        <p className="text-sm text-gray-600 mb-1">Quarter</p>
                        <p className="font-semibold text-gray-900">{subject.quarter}</p>
                      </div>
                      <div className="p-4 bg-gray-50 rounded-lg">
                        <p className="text-sm text-gray-600 mb-1">Class Size</p>
                        <p className="font-semibold text-gray-900">
                          {subject.enrolled} / {subject.capacity} students
                        </p>
                        <div className="w-full bg-gray-200 rounded-full h-2 mt-2">
                          <div 
                            className="bg-emerald-600 h-2 rounded-full transition-all"
                            style={{ width: `${(subject.enrolled / subject.capacity) * 100}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Syllabus Download */}
                  <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-lg">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <FileText className="w-6 h-6 text-emerald-600" />
                        <div>
                          <p className="font-semibold text-gray-900">Course Syllabus</p>
                          <p className="text-sm text-gray-600">Complete course outline and requirements</p>
                        </div>
                      </div>
                      <button className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors">
                        <Download className="w-4 h-4" />
                        Download
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Modules Tab */}
              {activeTab === 'modules' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold text-gray-900">Course Modules</h3>
                    <div className="text-sm text-gray-600">
                      {subject.modules.filter(m => m.completed).length} / {subject.modules.length} completed
                    </div>
                  </div>
                  {subject.modules.map((module) => (
                    <div
                      key={module.id}
                      className={`p-4 border rounded-lg transition-all hover:shadow-md ${
                        module.completed
                          ? 'bg-emerald-50 border-emerald-200'
                          : 'bg-white border-gray-200'
                      }`}
                    >
                      <div className="flex items-start gap-4">
                        <div className={`p-3 rounded-lg ${
                          module.completed ? 'bg-emerald-100' : 'bg-gray-100'
                        }`}>
                          {getModuleIcon(module.type)}
                        </div>
                        <div className="flex-1">
                          <div className="flex items-start justify-between">
                            <div>
                              <h4 className="font-semibold text-gray-900 mb-1">{module.title}</h4>
                              <p className="text-sm text-gray-600 mb-2">{module.description}</p>
                              {module.dueDate && (
                                <div className="flex items-center gap-2 text-sm text-gray-600">
                                  <Calendar className="w-4 h-4" />
                                  Due: {new Date(module.dueDate).toLocaleDateString()}
                                </div>
                              )}
                            </div>
                            {module.completed ? (
                              <div className="flex items-center gap-2 text-emerald-600">
                                <CheckCircle className="w-5 h-5" />
                                <span className="text-sm font-medium">Completed</span>
                              </div>
                            ) : (
                              <button className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors text-sm">
                                Start
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Grades Tab */}
              {activeTab === 'grades' && (
                <div className="space-y-6">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">Grading Breakdown</h3>
                    <div className="space-y-3">
                      {subject.grading.map((item, index) => (
                        <div key={index} className="p-4 bg-gray-50 rounded-lg">
                          <div className="flex items-center justify-between mb-2">
                            <span className="font-medium text-gray-900">{item.component}</span>
                            <span className="text-emerald-600 font-semibold">{item.percentage}%</span>
                          </div>
                          <div className="w-full bg-gray-200 rounded-full h-2">
                            <div
                              className="bg-emerald-600 h-2 rounded-full transition-all"
                              style={{ width: `${item.percentage}%` }}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                    <p className="text-sm text-blue-800">
                      <strong>Note:</strong> Your current grades and performance will be visible in the Grades section.
                      Make sure to complete all assignments and assessments on time.
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}