import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { TeacherSidebar } from '@/app/components/TeacherSidebar';
import { CustomSelect } from '@/app/components/admin/CustomSelect';
import { 
  Bell, 
  TrendingUp,
  TrendingDown,
  Save,
  Filter,
  Search,
  CheckCircle,
  Award,
  Target,
  BookOpen,
  Percent
} from 'lucide-react';

interface StudentGrade {
  id: string;
  studentId: string;
  studentName: string;
  midtermGrade: number;
  finalGrade: number;
  quizAverage: number;
  projectGrade: number;
  overallGrade: number;
  remarks: string;
}

interface ClassData {
  id: string;
  code: string;
  name: string;
}

export function GradesManagement() {
  const navigate = useNavigate();
  const [teacherName, setTeacherName] = useState('');
  const [schoolName, setSchoolName] = useState('');
  const [notifications, setNotifications] = useState(5);
  const [loading, setLoading] = useState(true);
  const [selectedClass, setSelectedClass] = useState('1');
  const [searchQuery, setSearchQuery] = useState('');
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const [classes] = useState<ClassData[]>([
    { id: '1', code: 'MATH101', name: 'Advanced Mathematics' },
    { id: '2', code: 'MATH102', name: 'Calculus I' },
    { id: '3', code: 'MATH201', name: 'Linear Algebra' },
  ]);

  const [studentGrades, setStudentGrades] = useState<StudentGrade[]>([
    { 
      id: '1', 
      studentId: 'STU-2026-001', 
      studentName: 'Juan Dela Cruz',
      midtermGrade: 92,
      finalGrade: 90,
      quizAverage: 88,
      projectGrade: 95,
      overallGrade: 91,
      remarks: 'Excellent'
    },
    { 
      id: '2', 
      studentId: 'STU-2026-002', 
      studentName: 'Maria Santos',
      midtermGrade: 88,
      finalGrade: 85,
      quizAverage: 90,
      projectGrade: 92,
      overallGrade: 89,
      remarks: 'Very Good'
    },
    { 
      id: '3', 
      studentId: 'STU-2026-003', 
      studentName: 'Pedro Garcia',
      midtermGrade: 95,
      finalGrade: 93,
      quizAverage: 96,
      projectGrade: 94,
      overallGrade: 95,
      remarks: 'Outstanding'
    },
    { 
      id: '4', 
      studentId: 'STU-2026-004', 
      studentName: 'Ana Rodriguez',
      midtermGrade: 90,
      finalGrade: 88,
      quizAverage: 92,
      projectGrade: 91,
      overallGrade: 90,
      remarks: 'Excellent'
    },
    { 
      id: '5', 
      studentId: 'STU-2026-005', 
      studentName: 'Carlos Reyes',
      midtermGrade: 85,
      finalGrade: 83,
      quizAverage: 87,
      projectGrade: 86,
      overallGrade: 85,
      remarks: 'Very Good'
    },
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

    setTimeout(() => setLoading(false), 600);
  }, [navigate]);

  const handleLogout = () => {
    localStorage.removeItem('currentUser');
    navigate('/school-selection');
  };

  const handleGradeChange = (studentId: string, field: keyof StudentGrade, value: number) => {
    setStudentGrades(prev => prev.map(student => {
      if (student.id === studentId) {
        const updated = { ...student, [field]: value };
        // Recalculate overall grade
        updated.overallGrade = Math.round(
          (updated.midtermGrade + updated.finalGrade + updated.quizAverage + updated.projectGrade) / 4
        );
        // Update remarks
        if (updated.overallGrade >= 90) updated.remarks = 'Outstanding';
        else if (updated.overallGrade >= 85) updated.remarks = 'Excellent';
        else if (updated.overallGrade >= 80) updated.remarks = 'Very Good';
        else if (updated.overallGrade >= 75) updated.remarks = 'Good';
        else updated.remarks = 'Needs Improvement';
        
        return updated;
      }
      return student;
    }));
    setHasUnsavedChanges(true);
  };

  const handleSave = () => {
    // Simulate save
    setSaveSuccess(true);
    setHasUnsavedChanges(false);
    setTimeout(() => setSaveSuccess(false), 3000);
  };

  const filteredGrades = studentGrades.filter(student =>
    student.studentName.toLowerCase().includes(searchQuery.toLowerCase()) ||
    student.studentId.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const selectedClassName = classes.find(c => c.id === selectedClass)?.name || '';

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Loading grades...</p>
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
                <h2 className="text-xl font-semibold text-gray-900">Grades Management</h2>
                <p className="text-sm text-gray-600">{schoolName}</p>
              </div>
              <div className="flex items-center gap-4">
                {hasUnsavedChanges && (
                  <span className="text-sm text-red-600 font-medium">Unsaved changes</span>
                )}
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
          {/* Header */}
          <div className="bg-gradient-to-r from-emerald-600 to-teal-600 rounded-2xl p-8 text-white shadow-lg">
            <h1 className="text-3xl font-bold mb-2">Encode Student Grades</h1>
            <p className="text-emerald-50">Manage and update student performance records</p>
          </div>

          {/* Grade Distribution Summary - Moved here */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-white rounded-xl p-6 border border-gray-200 shadow-sm">
              <div className="flex items-center gap-2 mb-2">
                <TrendingUp className="w-5 h-5 text-emerald-600" />
                <p className="text-gray-600 text-sm">Class Average</p>
              </div>
              <p className="text-3xl font-bold text-emerald-600">
                {Math.round(studentGrades.reduce((sum, s) => sum + s.overallGrade, 0) / studentGrades.length)}%
              </p>
            </div>
            <div className="bg-white rounded-xl p-6 border border-gray-200 shadow-sm">
              <div className="flex items-center gap-2 mb-2">
                <Award className="w-5 h-5 text-blue-600" />
                <p className="text-gray-600 text-sm">Highest Grade</p>
              </div>
              <p className="text-3xl font-bold text-blue-600">
                {Math.max(...studentGrades.map(s => s.overallGrade))}%
              </p>
            </div>
            <div className="bg-white rounded-xl p-6 border border-gray-200 shadow-sm">
              <div className="flex items-center gap-2 mb-2">
                <TrendingDown className="w-5 h-5 text-red-600" />
                <p className="text-gray-600 text-sm">Lowest Grade</p>
              </div>
              <p className="text-3xl font-bold text-red-600">
                {Math.min(...studentGrades.map(s => s.overallGrade))}%
              </p>
            </div>
            <div className="bg-white rounded-xl p-6 border border-gray-200 shadow-sm">
              <div className="flex items-center gap-2 mb-2">
                <Target className="w-5 h-5 text-emerald-600" />
                <p className="text-gray-600 text-sm">Passing Rate</p>
              </div>
              <p className="text-3xl font-bold text-emerald-600">
                {Math.round((studentGrades.filter(s => s.overallGrade >= 75).length / studentGrades.length) * 100)}%
              </p>
            </div>
          </div>

          {/* Save Success Message */}
          {saveSuccess && (
            <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4 flex items-center gap-3">
              <CheckCircle className="w-5 h-5 text-emerald-600" />
              <p className="text-emerald-700 font-medium">Grades saved successfully!</p>
            </div>
          )}

          {/* Filters */}
          <div className="bg-white rounded-xl p-6 border border-gray-200 shadow-sm space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  <Filter className="w-4 h-4 inline mr-2" />
                  Select Class
                </label>
                <CustomSelect
                  value={selectedClass}
                  onChange={setSelectedClass}
                  options={classes.map(classItem => ({
                    value: classItem.id,
                    label: `${classItem.code} - ${classItem.name}`,
                    icon: <BookOpen className="w-5 h-5 text-emerald-600" />
                  }))}
                  icon={<Filter className="w-5 h-5" />}
                  placeholder="Select a class"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  <Search className="w-4 h-4 inline mr-2" />
                  Search Student
                </label>
                <input
                  type="text"
                  placeholder="Search by name or ID..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
            </div>
          </div>

          {/* Grades Table */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="p-6 border-b border-gray-200 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">{selectedClassName}</h3>
                <p className="text-sm text-gray-600 mt-1">{filteredGrades.length} students</p>
              </div>
              <button
                onClick={handleSave}
                disabled={!hasUnsavedChanges}
                className="flex items-center gap-2 px-6 py-3 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-all shadow-sm hover:shadow-md disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:shadow-sm"
              >
                <Save className="w-4 h-4" />
                Save All Changes
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Student</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Midterm</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Final</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Quiz Avg</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Project</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Overall</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Remarks</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredGrades.map((student) => (
                    <tr key={student.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4">
                        <div>
                          <p className="font-medium text-gray-900">{student.studentName}</p>
                          <p className="text-xs text-gray-500">{student.studentId}</p>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <input
                          type="number"
                          min="0"
                          max="100"
                          value={student.midtermGrade}
                          onChange={(e) => handleGradeChange(student.id, 'midtermGrade', Number(e.target.value))}
                          className="w-20 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                        />
                      </td>
                      <td className="px-6 py-4">
                        <input
                          type="number"
                          min="0"
                          max="100"
                          value={student.finalGrade}
                          onChange={(e) => handleGradeChange(student.id, 'finalGrade', Number(e.target.value))}
                          className="w-20 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                        />
                      </td>
                      <td className="px-6 py-4">
                        <input
                          type="number"
                          min="0"
                          max="100"
                          value={student.quizAverage}
                          onChange={(e) => handleGradeChange(student.id, 'quizAverage', Number(e.target.value))}
                          className="w-20 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                        />
                      </td>
                      <td className="px-6 py-4">
                        <input
                          type="number"
                          min="0"
                          max="100"
                          value={student.projectGrade}
                          onChange={(e) => handleGradeChange(student.id, 'projectGrade', Number(e.target.value))}
                          className="w-20 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                        />
                      </td>
                      <td className="px-6 py-4">
                        <span className="px-3 py-1 rounded-full text-sm font-bold bg-emerald-50 text-emerald-600">
                          {student.overallGrade}%
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                          student.remarks === 'Outstanding' ? 'bg-emerald-100 text-emerald-700' :
                          student.remarks === 'Excellent' ? 'bg-blue-100 text-blue-700' :
                          student.remarks === 'Very Good' ? 'bg-emerald-50 text-emerald-600' :
                          'bg-blue-100 text-blue-700'
                        }`}>
                          {student.remarks}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}