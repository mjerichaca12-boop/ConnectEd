import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { TeacherSidebar } from "../../components/TeacherSidebar";
import { NotificationDropdown } from "../../components/NotificationDropdown";
import { teacherNotifications } from "../../components/NotificationDefault";
import {
  TrendingUp,
  TrendingDown,
  Save,
  Filter,
  Search,
  CheckCircle,
  Award,
  Target,
  Users
} from "lucide-react";
function GradesManagement() {
  const navigate = useNavigate();
  const [teacherName, setTeacherName] = useState("");
  const [notificationList, setNotificationList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedClass, setSelectedClass] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [classes] = useState([]);
  const [studentGrades, setStudentGrades] = useState([]);
  useEffect(() => {
    const userData = localStorage.getItem("currentUser");
    if (!userData) {
      navigate("/login");
      return;
    }
    const user = JSON.parse(userData);
    if (user.role !== "teacher") {
      navigate("/login");
      return;
    }
    setTeacherName(user.name);
    setTimeout(() => setLoading(false), 600);
  }, [navigate]);
  const handleLogout = () => {
    localStorage.removeItem("currentUser");
    navigate("/login");
  };
  const handleGradeChange = (studentId, field, value) => {
    setStudentGrades((prev) => prev.map((student) => {
      if (student.id === studentId) {
        const updated = { ...student, [field]: value };
        updated.overallGrade = Math.round(
          (updated.midtermGrade + updated.finalGrade + updated.quizAverage + updated.projectGrade) / 4
        );
        if (updated.overallGrade >= 90) updated.remarks = "Outstanding";
        else if (updated.overallGrade >= 85) updated.remarks = "Excellent";
        else if (updated.overallGrade >= 80) updated.remarks = "Very Good";
        else if (updated.overallGrade >= 75) updated.remarks = "Good";
        else updated.remarks = "Needs Improvement";
        return updated;
      }
      return student;
    }));
    setHasUnsavedChanges(true);
  };
  const handleSave = () => {
    setSaveSuccess(true);
    setHasUnsavedChanges(false);
    setTimeout(() => setSaveSuccess(false), 3e3);
  };
  const filteredGrades = studentGrades.filter(
    (student) => student.studentName.toLowerCase().includes(searchQuery.toLowerCase()) || student.studentId.toLowerCase().includes(searchQuery.toLowerCase())
  );
  const selectedClassName = classes.find((c) => c.id === selectedClass)?.name || "";
  const classAverage = studentGrades.length > 0 ? Math.round(studentGrades.reduce((sum, s) => sum + s.overallGrade, 0) / studentGrades.length) : 0;
  const highestGrade = studentGrades.length > 0 ? Math.max(...studentGrades.map((s) => s.overallGrade)) : 0;
  const lowestGrade = studentGrades.length > 0 ? Math.min(...studentGrades.map((s) => s.overallGrade)) : 0;
  const passingRate = studentGrades.length > 0 ? Math.round(studentGrades.filter((s) => s.overallGrade >= 75).length / studentGrades.length * 100) : 0;
  if (loading) {
    return <div className="min-h-screen flex items-center justify-center bg-black/20">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-400">Loading grades...</p>
        </div>
      </div>;
  }
  return <div className="min-h-screen bg-gray-950 flex">
      <TeacherSidebar teacherName={teacherName} onLogout={handleLogout} />

      <main className="flex-1 overflow-y-auto scrollbar-hide">
        {
    /* Top Bar */
  }
        <div className="bg-gray-900/60 border-b border-white/10 sticky top-0 z-20 relative">
          <div className="px-6 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <h2 className="text-xl font-semibold text-white">Grades Management</h2>
                {hasUnsavedChanges && <span className="text-sm text-red-600 font-medium">Unsaved changes</span>}
              </div>
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
    /* Header */
  }
          <div className="bg-gradient-to-r from-emerald-600 to-teal-600 rounded-2xl p-8 text-white shadow-lg">
            <h1 className="text-3xl font-bold mb-2">Encode Student Grades</h1>
            <p className="text-emerald-50">Manage and update student performance records</p>
          </div>

          {
    /* Grade Distribution Summary */
  }
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-gray-900/60 rounded-xl p-6 border border-white/10 shadow-sm">
              <div className="flex items-center gap-2 mb-2">
                <TrendingUp className="w-5 h-5 text-emerald-600" />
                <p className="text-gray-400 text-sm">Class Average</p>
              </div>
              <p className="text-3xl font-bold text-emerald-600">{classAverage}%</p>
            </div>
            <div className="bg-gray-900/60 rounded-xl p-6 border border-white/10 shadow-sm">
              <div className="flex items-center gap-2 mb-2">
                <Award className="w-5 h-5 text-blue-600" />
                <p className="text-gray-400 text-sm">Highest Grade</p>
              </div>
              <p className="text-3xl font-bold text-blue-600">{highestGrade}%</p>
            </div>
            <div className="bg-gray-900/60 rounded-xl p-6 border border-white/10 shadow-sm">
              <div className="flex items-center gap-2 mb-2">
                <TrendingDown className="w-5 h-5 text-red-600" />
                <p className="text-gray-400 text-sm">Lowest Grade</p>
              </div>
              <p className="text-3xl font-bold text-red-600">{lowestGrade}%</p>
            </div>
            <div className="bg-gray-900/60 rounded-xl p-6 border border-white/10 shadow-sm">
              <div className="flex items-center gap-2 mb-2">
                <Target className="w-5 h-5 text-emerald-600" />
                <p className="text-gray-400 text-sm">Passing Rate</p>
              </div>
              <p className="text-3xl font-bold text-emerald-600">{passingRate}%</p>
            </div>
          </div>

          {
    /* Save Success Message */
  }
          {saveSuccess && <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4 flex items-center gap-3">
              <CheckCircle className="w-5 h-5 text-emerald-600" />
              <p className="text-emerald-700 font-medium">Grades saved successfully!</p>
            </div>}

          {
    /* Filters */
  }
          <div className="bg-gray-900/60 rounded-xl p-6 border border-white/10 shadow-sm space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  <Filter className="w-4 h-4 inline mr-2" />
                  Select Class
                </label>
                {classes.length === 0 ? <div className="w-full px-4 py-3 bg-black/20 text-white placeholder-gray-500 border border-white/10 rounded-lg bg-black/20 text-gray-400 text-sm">
                    No classes available
                  </div> : <select
    value={selectedClass}
    onChange={(e) => setSelectedClass(e.target.value)}
    className="w-full px-4 py-3 bg-black/20 text-white placeholder-gray-500 border border-white/20 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
  >
                    <option value="">Select a class</option>
                    {classes.map((classItem) => <option key={classItem.id} value={classItem.id}>
                        {classItem.code} - {classItem.name}
                      </option>)}
                  </select>}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  <Search className="w-4 h-4 inline mr-2" />
                  Search Student
                </label>
                <input
    type="text"
    placeholder="Search by name or ID..."
    value={searchQuery}
    onChange={(e) => setSearchQuery(e.target.value)}
    className="w-full px-4 py-3 bg-black/20 text-white placeholder-gray-500 border border-white/20 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
  />
              </div>
            </div>
          </div>

          {
    /* Grades Table */
  }
          <div className="bg-gray-900/60 rounded-xl border border-white/10 shadow-sm overflow-hidden">
            <div className="p-6 border-b border-white/10 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold text-white">
                  {selectedClassName || "Select a class to view grades"}
                </h3>
                <p className="text-sm text-gray-400 mt-1">{filteredGrades.length} students</p>
              </div>
              <button
    onClick={handleSave}
    disabled={!hasUnsavedChanges}
    className="flex items-center gap-2 px-6 py-3 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-all shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
  >
                <Save className="w-4 h-4" />
                Save All Changes
              </button>
            </div>

            {filteredGrades.length === 0 ? <div className="p-12 text-center">
                <Users className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-500">
                  {classes.length === 0 ? "No classes assigned yet" : "No students found for this class"}
                </p>
              </div> : <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-black/20">
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
                  <tbody className="bg-gray-900/60 divide-y divide-white/10">
                    {filteredGrades.map((student) => <tr key={student.id} className="hover:bg-black/20">
                        <td className="px-6 py-4">
                          <p className="font-medium text-white">{student.studentName}</p>
                          <p className="text-xs text-gray-500">{student.studentId}</p>
                        </td>
                        <td className="px-6 py-4">
                          <input type="number" min="0" max="100" value={student.midtermGrade} onChange={(e) => handleGradeChange(student.id, "midtermGrade", Number(e.target.value))} className="w-20 px-3 py-2 bg-black/20 text-white placeholder-gray-500 border border-white/20 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500" />
                        </td>
                        <td className="px-6 py-4">
                          <input type="number" min="0" max="100" value={student.finalGrade} onChange={(e) => handleGradeChange(student.id, "finalGrade", Number(e.target.value))} className="w-20 px-3 py-2 bg-black/20 text-white placeholder-gray-500 border border-white/20 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500" />
                        </td>
                        <td className="px-6 py-4">
                          <input type="number" min="0" max="100" value={student.quizAverage} onChange={(e) => handleGradeChange(student.id, "quizAverage", Number(e.target.value))} className="w-20 px-3 py-2 bg-black/20 text-white placeholder-gray-500 border border-white/20 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500" />
                        </td>
                        <td className="px-6 py-4">
                          <input type="number" min="0" max="100" value={student.projectGrade} onChange={(e) => handleGradeChange(student.id, "projectGrade", Number(e.target.value))} className="w-20 px-3 py-2 bg-black/20 text-white placeholder-gray-500 border border-white/20 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500" />
                        </td>
                        <td className="px-6 py-4">
                          <span className="px-3 py-1 rounded-full text-sm font-bold bg-emerald-50 text-emerald-600">{student.overallGrade}%</span>
                        </td>
                        <td className="px-6 py-4">
                          <span className={`px-3 py-1 rounded-full text-xs font-medium ${student.remarks === "Outstanding" ? "bg-emerald-100 text-emerald-700" : student.remarks === "Excellent" ? "bg-blue-100 text-blue-700" : student.remarks === "Very Good" ? "bg-emerald-50 text-emerald-600" : "bg-blue-100 text-blue-700"}`}>
                            {student.remarks}
                          </span>
                        </td>
                      </tr>)}
                  </tbody>
                </table>
              </div>}
          </div>
        </div>
      </main>
    </div>;
}
export {
  GradesManagement
};
