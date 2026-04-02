import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { TeacherSidebar } from "@/app/components/TeacherSidebar";
import {
  Bell,
  Calendar,
  CheckCircle,
  XCircle,
  AlertCircle,
  Save,
  Search,
  Users,
  ChevronRight
} from "lucide-react";
function AttendanceManagement() {
  const navigate = useNavigate();
  const [teacherName, setTeacherName] = useState("");
  const [notifications, setNotifications] = useState(0);
  const [loading, setLoading] = useState(true);
  const [selectedSection, setSelectedSection] = useState(null);
  const [selectedDate, setSelectedDate] = useState((/* @__PURE__ */ new Date()).toISOString().split("T")[0]);
  const [searchQuery, setSearchQuery] = useState("");
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [studentSearchQuery, setStudentSearchQuery] = useState("");
  const [sections] = useState([]);
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
  const handleStatusChange = (studentId, status) => {
    if (!selectedSection) return;
    setSelectedSection((prev) => {
      if (!prev) return null;
      return {
        ...prev,
        students: prev.students.map(
          (student) => student.id === studentId ? { ...student, status } : student
        )
      };
    });
    setHasUnsavedChanges(true);
  };
  const handleRemarksChange = (studentId, remarks) => {
    if (!selectedSection) return;
    setSelectedSection((prev) => {
      if (!prev) return null;
      return {
        ...prev,
        students: prev.students.map(
          (student) => student.id === studentId ? { ...student, remarks } : student
        )
      };
    });
    setHasUnsavedChanges(true);
  };
  const handleMarkAllPresent = () => {
    if (!selectedSection) return;
    setSelectedSection((prev) => {
      if (!prev) return null;
      return {
        ...prev,
        students: prev.students.map((student) => ({ ...student, status: "Present" }))
      };
    });
    setHasUnsavedChanges(true);
  };
  const handleSave = () => {
    alert("Attendance saved successfully!");
    setHasUnsavedChanges(false);
  };
  const handleSelectSection = (section) => {
    setSelectedSection(section);
    setStudentSearchQuery("");
    setHasUnsavedChanges(false);
  };
  const handleBackToSections = () => {
    if (hasUnsavedChanges) {
      if (confirm("You have unsaved changes. Are you sure you want to go back?")) {
        setSelectedSection(null);
        setHasUnsavedChanges(false);
      }
    } else {
      setSelectedSection(null);
    }
  };
  const filteredSections = sections.filter(
    (section) => section.sectionName.toLowerCase().includes(searchQuery.toLowerCase()) || section.gradeLevel.toLowerCase().includes(searchQuery.toLowerCase())
  );
  const filteredStudents = selectedSection?.students.filter(
    (student) => student.name.toLowerCase().includes(studentSearchQuery.toLowerCase()) || student.studentId.toLowerCase().includes(studentSearchQuery.toLowerCase())
  ) || [];
  const presentCount = selectedSection?.students.filter((s) => s.status === "Present").length || 0;
  const absentCount = selectedSection?.students.filter((s) => s.status === "Absent").length || 0;
  const lateCount = selectedSection?.students.filter((s) => s.status === "Late").length || 0;
  const unmarkedCount = selectedSection?.students.filter((s) => s.status === null).length || 0;
  if (loading) {
    return <div className="min-h-screen flex items-center justify-center bg-black/20">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-400">Loading attendance...</p>
        </div>
      </div>;
  }
  return <div className="min-h-screen bg-gray-950 flex">
      <TeacherSidebar teacherName={teacherName} onLogout={handleLogout} />

      <main className="flex-1 overflow-y-auto scrollbar-hide">
        {
    /* Top Bar */
  }
        <div className="bg-gray-900/60 border-b border-white/10 sticky top-0 z-20">
          <div className="px-6 py-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-semibold text-white">Attendance Management</h2>
              </div>
              <div className="flex items-center gap-4">
                {hasUnsavedChanges && <span className="text-sm text-red-600 font-medium">Unsaved changes</span>}
                <button className="relative p-2 hover:bg-white/5 rounded-lg transition-colors">
                  <Bell className="w-6 h-6 text-gray-400" />
                  
                </button>
              </div>
            </div>
          </div>
        </div>

        {
    /* Content */
  }
        <div className="p-6 space-y-6">
          {!selectedSection ? <>
              {
    /* Header */
  }
              <div className="bg-gradient-to-r from-emerald-600 to-teal-600 rounded-2xl p-8 text-white shadow-lg">
                <h1 className="text-3xl font-bold mb-2">Record Attendance by Section</h1>
                <p className="text-emerald-50">Select a section to mark attendance</p>
              </div>

              {
    /* Date Selection */
  }
              <div className="bg-gray-900/60 rounded-xl p-6 border border-white/10 shadow-sm">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      <Calendar className="w-4 h-4 inline mr-2" />
                      Select Date
                    </label>
                    <input
    type="date"
    value={selectedDate}
    onChange={(e) => setSelectedDate(e.target.value)}
    className="w-full px-4 py-3 bg-black/20 text-white border border-white/20 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
  />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      <Search className="w-4 h-4 inline mr-2" />
                      Search Section
                    </label>
                    <input
    type="text"
    placeholder="Search by grade or section name..."
    value={searchQuery}
    onChange={(e) => setSearchQuery(e.target.value)}
    className="w-full px-4 py-3 bg-black/20 text-white placeholder-gray-500 border border-white/20 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
  />
                  </div>
                </div>
              </div>

              {
    /* Sections Grid */
  }
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredSections.map((section) => <div
    key={section.id}
    onClick={() => handleSelectSection(section)}
    className="bg-gray-900/60 rounded-xl border border-white/10 shadow-sm hover:shadow-lg hover:border-emerald-500 transition-all duration-300 cursor-pointer group"
  >
                    <div className="p-6">
                      <div className="flex items-start justify-between mb-4">
                        <div className="p-3 bg-emerald-50 rounded-lg group-hover:bg-emerald-100 transition-colors">
                          <Users className="w-6 h-6 text-emerald-600" />
                        </div>
                        <ChevronRight className="w-5 h-5 text-gray-400 group-hover:text-emerald-600 transition-colors" />
                      </div>

                      <h3 className="text-lg font-semibold text-white mb-1">{section.sectionName}</h3>
                      <p className="text-sm text-gray-400 mb-4">{section.gradeLevel}</p>

                      <div className="flex items-center gap-2 text-sm text-gray-400">
                        <Users className="w-4 h-4" />
                        <span>{section.studentCount} students</span>
                      </div>

                      <button className="w-full mt-4 px-4 py-3 bg-emerald-700 text-white rounded-lg hover:bg-emerald-600 transition-all shadow-sm hover:shadow-md group-hover:shadow-lg font-medium">
                        Record Attendance
                      </button>
                    </div>
                  </div>)}
              </div>

              {filteredSections.length === 0 && <div className="bg-gray-900/60 rounded-xl border border-white/10 shadow-sm p-12 text-center">
                  <Users className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                  <p className="text-gray-400">No sections found</p>
                </div>}
            </> : <>
              {
    /* Section Attendance Header */
  }
              <div className="bg-gradient-to-r from-emerald-600 to-teal-600 rounded-2xl p-8 text-white shadow-lg">
                <button
    onClick={handleBackToSections}
    className="mb-4 flex items-center gap-2 text-emerald-100 hover:text-white transition-colors"
  >
                  ÃƒÂ¢Ã¢â‚¬Â Ã‚Â Back to Sections
                </button>
                <h1 className="text-3xl font-bold mb-2">{selectedSection.gradeLevel} - {selectedSection.sectionName}</h1>
                <p className="text-emerald-50">
                  {new Date(selectedDate).toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric"
  })}
                </p>
              </div>

              {
    /* Summary Cards */
  }
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-gray-900/60 rounded-xl p-4 border border-white/10 shadow-sm">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-emerald-50 rounded-lg">
                      <CheckCircle className="w-5 h-5 text-emerald-600" />
                    </div>
                    <div>
                      <p className="text-gray-400 text-xs">Present</p>
                      <p className="text-2xl font-bold text-emerald-600">{presentCount}</p>
                    </div>
                  </div>
                </div>

                <div className="bg-gray-900/60 rounded-xl p-4 border border-white/10 shadow-sm">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-red-50 rounded-lg">
                      <XCircle className="w-5 h-5 text-red-600" />
                    </div>
                    <div>
                      <p className="text-gray-400 text-xs">Absent</p>
                      <p className="text-2xl font-bold text-red-600">{absentCount}</p>
                    </div>
                  </div>
                </div>

                <div className="bg-gray-900/60 rounded-xl p-4 border border-white/10 shadow-sm">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-red-50 rounded-lg">
                      <AlertCircle className="w-5 h-5 text-red-600" />
                    </div>
                    <div>
                      <p className="text-gray-400 text-xs">Late</p>
                      <p className="text-2xl font-bold text-red-600">{lateCount}</p>
                    </div>
                  </div>
                </div>

                <div className="bg-gray-900/60 rounded-xl p-4 border border-white/10 shadow-sm">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-black/20 rounded-lg">
                      <Calendar className="w-5 h-5 text-gray-400" />
                    </div>
                    <div>
                      <p className="text-gray-400 text-xs">Unmarked</p>
                      <p className="text-2xl font-bold text-gray-400">{unmarkedCount}</p>
                    </div>
                  </div>
                </div>
              </div>

              {
    /* Actions */
  }
              <div className="bg-gray-900/60 rounded-xl p-6 border border-white/10 shadow-sm">
                <div className="flex items-center justify-between flex-wrap gap-4">
                  <div className="flex-1">
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      <Search className="w-4 h-4 inline mr-2" />
                      Search Student
                    </label>
                    <input
    type="text"
    placeholder="Search by name or ID..."
    value={studentSearchQuery}
    onChange={(e) => setStudentSearchQuery(e.target.value)}
    className="w-full px-4 py-3 bg-black/20 text-white placeholder-gray-500 border border-white/20 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
  />
                  </div>

                  <div className="flex items-end gap-4">
                    <button
    onClick={handleMarkAllPresent}
    className="px-4 py-3 bg-emerald-50 text-emerald-600 rounded-lg hover:bg-emerald-100 transition-colors text-sm font-medium whitespace-nowrap"
  >
                      Mark All Present
                    </button>
                    <button
    onClick={handleSave}
    disabled={!hasUnsavedChanges}
    className="flex items-center gap-2 px-6 py-3 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium whitespace-nowrap"
  >
                      <Save className="w-4 h-4" />
                      Save Attendance
                    </button>
                  </div>
                </div>
              </div>

              {
    /* Attendance Table */
  }
              <div className="bg-gray-900/60 rounded-xl border border-white/10 shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-black/20">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Student</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Remarks</th>
                      </tr>
                    </thead>
                    <tbody className="bg-gray-900/60 divide-y divide-white/10">
                      {filteredStudents.map((student) => <tr key={student.id} className="hover:bg-black/20">
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 bg-emerald-600 rounded-full flex items-center justify-center text-white font-semibold">
                                {student.name.charAt(0)}
                              </div>
                              <div>
                                <p className="font-medium text-white">{student.name}</p>
                                <p className="text-xs text-gray-500">{student.studentId}</p>
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-2">
                              <button
    onClick={() => handleStatusChange(student.id, "Present")}
    className={`p-2 rounded-lg transition-all ${student.status === "Present" ? "bg-emerald-600 text-white shadow-md" : "bg-white/5 text-gray-400 hover:bg-emerald-50 hover:text-emerald-600"}`}
    title="Present"
  >
                                <CheckCircle className="w-5 h-5" />
                              </button>
                              <button
    onClick={() => handleStatusChange(student.id, "Absent")}
    className={`p-2 rounded-lg transition-all ${student.status === "Absent" ? "bg-red-600 text-white shadow-md" : "bg-white/5 text-gray-400 hover:bg-red-50 hover:text-red-600"}`}
    title="Absent"
  >
                                <XCircle className="w-5 h-5" />
                              </button>
                              <button
    onClick={() => handleStatusChange(student.id, "Late")}
    className={`p-2 rounded-lg transition-all ${student.status === "Late" ? "bg-red-600 text-white shadow-md" : "bg-white/5 text-gray-400 hover:bg-red-50 hover:text-red-600"}`}
    title="Late"
  >
                                <AlertCircle className="w-5 h-5" />
                              </button>
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <input
    type="text"
    placeholder="Add remarks..."
    value={student.remarks}
    onChange={(e) => handleRemarksChange(student.id, e.target.value)}
    className="w-full px-3 py-2 text-sm bg-black/20 text-white placeholder-gray-500 border border-white/20 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
  />
                          </td>
                        </tr>)}
                    </tbody>
                  </table>
                </div>

                {filteredStudents.length === 0 && <div className="p-12 text-center">
                    <Users className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                    <p className="text-gray-400">No students found</p>
                  </div>}
              </div>
            </>}
        </div>
      </main>
    </div>;
}
export {
  AttendanceManagement
};
