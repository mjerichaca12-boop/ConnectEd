import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { TeacherSidebar } from "@/app/components/TeacherSidebar";
import { supabase } from "@/app/lib/supabaseClient";
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
  const [loading, setLoading] = useState(true);
  const [teacherId, setTeacherId] = useState("");
  const [selectedClassId, setSelectedClassId] = useState("");
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split("T")[0]);
  const [searchQuery, setSearchQuery] = useState("");
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [studentSearchQuery, setStudentSearchQuery] = useState("");
  const [classes, setClasses] = useState([]);
  const [students, setStudents] = useState([]);
  const [attendanceCache, setAttendanceCache] = useState({});
  const [saveSuccess, setSaveSuccess] = useState(false);

  const resolveTeacherId = async (email) => {
    if (!supabase || !email) return "";

    const normalizedEmail = String(email).trim().toLowerCase();
    const { data, error } = await supabase
      .from("profiles")
      .select("id")
      .ilike("email", normalizedEmail)
      .eq("role", "teacher")
      .limit(1)
      .maybeSingle();

    if (error) {
      console.error("Failed to resolve teacher profile:", error);
      return "";
    }

    return String(data?.id || "");
  };

  const fetchClasses = async (id) => {
    if (!supabase || !id) {
      setClasses([]);
      return;
    }

    const { data, error } = await supabase
      .from("subjects")
      .select("id, code, name, section")
      .eq("teacher_id", id)
      .order("code", { ascending: true });

    if (error) {
      console.error("Failed to load classes:", error);
      setClasses([]);
      return;
    }

    const mapped = (data ?? []).map((item) => ({
      id: String(item.id),
      sectionName: String(item.section || "").trim() || "No section assigned",
      gradeLevel: `${item.code || "SUBJ"} - ${item.name || "Untitled Subject"}`,
      studentCount: 0
    }));

    setClasses(mapped);
  };

  const fetchStudentsForClass = async (currentTeacherId, classId) => {
    if (!supabase || !currentTeacherId || !classId) {
      setStudents([]);
      return;
    }

    const { data: assignments, error: assignmentError } = await supabase
      .from("teacher_student_assignments")
      .select("student_id")
      .eq("teacher_id", currentTeacherId)
      .eq("subject_id", classId);

    if (assignmentError) {
      console.error("Failed to load assignments:", assignmentError);
      setStudents([]);
      return;
    }

    const studentIds = [...new Set((assignments ?? []).map((row) => String(row.student_id || "")).filter(Boolean))];

    if (studentIds.length === 0) {
      setStudents([]);
      return;
    }

    const { data: studentRows, error: studentError } = await supabase
      .from("profiles")
      .select("id, first_name, middle_name, last_name, lrn")
      .eq("role", "student")
      .in("id", studentIds);

    if (studentError) {
      console.error("Failed to load students:", studentError);
      setStudents([]);
      return;
    }

    const classCache = attendanceCache[classId] || {};
    const mapped = (studentRows ?? []).map((student) => {
      const studentId = String(student.id);
      const cached = classCache[studentId] || { status: null, remarks: "" };
      const name = [student.first_name, student.middle_name, student.last_name]
        .map((part) => String(part || "").trim())
        .filter(Boolean)
        .join(" ")
        .trim() || "Student";

      return {
        id: studentId,
        name,
        studentId: String(student.lrn || "N/A"),
        status: cached.status,
        remarks: cached.remarks
      };
    });

    setStudents(mapped);
  };

  useEffect(() => {
    const initialize = async () => {
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
      const resolvedTeacherId = await resolveTeacherId(user.email);
      setTeacherId(resolvedTeacherId);
      await fetchClasses(resolvedTeacherId);
      setLoading(false);
    };

    initialize();
  }, [navigate]);

  useEffect(() => {
    if (!teacherId || !selectedClassId) {
      setStudents([]);
      return;
    }

    fetchStudentsForClass(teacherId, selectedClassId);
  }, [teacherId, selectedClassId]);

  useEffect(() => {
    if (!supabase || !teacherId) return;

    const subjectsChannel = supabase
      .channel(`attendance-subjects-${teacherId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "subjects" },
        (payload) => {
          const newTeacherId = String(payload?.new?.teacher_id || "");
          const oldTeacherId = String(payload?.old?.teacher_id || "");
          if (newTeacherId === teacherId || oldTeacherId === teacherId) {
            fetchClasses(teacherId);
          }
        }
      )
      .subscribe();

    const assignmentsChannel = supabase
      .channel(`attendance-assignments-${teacherId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "teacher_student_assignments",
          filter: `teacher_id=eq.${teacherId}`
        },
        (payload) => {
          const newSubjectId = String(payload?.new?.subject_id || "");
          const oldSubjectId = String(payload?.old?.subject_id || "");
          if (selectedClassId && (newSubjectId === selectedClassId || oldSubjectId === selectedClassId)) {
            fetchStudentsForClass(teacherId, selectedClassId);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(subjectsChannel);
      supabase.removeChannel(assignmentsChannel);
    };
  }, [teacherId, selectedClassId]);

  useEffect(() => {
    if (!saveSuccess) return;
    const timer = window.setTimeout(() => setSaveSuccess(false), 3000);
    return () => window.clearTimeout(timer);
  }, [saveSuccess]);

  const handleLogout = () => {
    localStorage.removeItem("currentUser");
    navigate("/login");
  };

  const handleStatusChange = (studentId, status) => {
    if (!selectedClassId) return;

    setStudents((prev) => prev.map((student) => (student.id === studentId ? { ...student, status } : student)));
    setAttendanceCache((current) => {
      const classCache = { ...(current[selectedClassId] || {}) };
      classCache[studentId] = {
        ...(classCache[studentId] || { status: null, remarks: "" }),
        status
      };

      return {
        ...current,
        [selectedClassId]: classCache
      };
    });

    setHasUnsavedChanges(true);
  };

  const handleRemarksChange = (studentId, remarks) => {
    if (!selectedClassId) return;

    setStudents((prev) => prev.map((student) => (student.id === studentId ? { ...student, remarks } : student)));
    setAttendanceCache((current) => {
      const classCache = { ...(current[selectedClassId] || {}) };
      classCache[studentId] = {
        ...(classCache[studentId] || { status: null, remarks: "" }),
        remarks
      };

      return {
        ...current,
        [selectedClassId]: classCache
      };
    });

    setHasUnsavedChanges(true);
  };

  const handleMarkAllPresent = () => {
    if (!selectedClassId || students.length === 0) return;

    const studentIds = students.map((student) => student.id);
    setStudents((prev) => prev.map((student) => ({ ...student, status: "Present" })));
    setAttendanceCache((current) => {
      const classCache = { ...(current[selectedClassId] || {}) };
      studentIds.forEach((studentId) => {
        classCache[studentId] = {
          ...(classCache[studentId] || { remarks: "" }),
          status: "Present"
        };
      });

      return {
        ...current,
        [selectedClassId]: classCache
      };
    });

    setHasUnsavedChanges(true);
  };

  const handleSave = () => {
    if (!selectedClassId || students.length === 0) return;
    setSaveSuccess(true);
    setHasUnsavedChanges(false);
  };

  const handleSelectClass = (classId) => {
    setSelectedClassId(classId);
    setStudentSearchQuery("");
    setHasUnsavedChanges(false);
  };

  const handleBackToClasses = () => {
    if (hasUnsavedChanges) {
      const shouldProceed = window.confirm("You have unsaved changes. Are you sure you want to go back?");
      if (!shouldProceed) return;
    }

    setSelectedClassId("");
    setHasUnsavedChanges(false);
  };

  const filteredClasses = classes.filter((classItem) => {
    const query = searchQuery.toLowerCase();
    return (
      classItem.sectionName.toLowerCase().includes(query) ||
      classItem.gradeLevel.toLowerCase().includes(query)
    );
  });

  const filteredStudents = students.filter((student) => {
    const query = studentSearchQuery.toLowerCase();
    return (
      student.name.toLowerCase().includes(query) ||
      student.studentId.toLowerCase().includes(query)
    );
  });

  const selectedClass = useMemo(() => classes.find((item) => item.id === selectedClassId) || null, [classes, selectedClassId]);

  const presentCount = students.filter((student) => student.status === "Present").length;
  const absentCount = students.filter((student) => student.status === "Absent").length;
  const lateCount = students.filter((student) => student.status === "Late").length;
  const unmarkedCount = students.filter((student) => !student.status).length;

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-black/20">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-400">Loading attendance...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-950 flex">
      <TeacherSidebar teacherName={teacherName} onLogout={handleLogout} />

      <main className="flex-1 overflow-y-auto scrollbar-hide">
        <div className="bg-gray-900/60 border-b border-white/10 sticky top-0 z-20">
          <div className="px-6 py-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold text-white">Attendance Management</h2>
              <div className="flex items-center gap-4">
                {hasUnsavedChanges && <span className="text-sm text-red-600 font-medium">Unsaved changes</span>}
                {saveSuccess && <span className="text-sm text-emerald-500 font-medium">Attendance saved</span>}
                <button className="relative p-2 hover:bg-white/5 rounded-lg transition-colors">
                  <Bell className="w-6 h-6 text-gray-400" />
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="p-6 space-y-6">
          {!selectedClass ? (
            <>
              <div className="bg-gradient-to-r from-emerald-600 to-teal-600 rounded-2xl p-8 text-white shadow-lg">
                <h1 className="text-3xl font-bold mb-2">Record Attendance by Subject / Section</h1>
                <p className="text-emerald-50">Class and student lists come from enrollment assignments</p>
              </div>

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
                      Search Subject / Section
                    </label>
                    <input
                      type="text"
                      placeholder="Search by subject code, name, or section..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full px-4 py-3 bg-black/20 text-white placeholder-gray-500 border border-white/20 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredClasses.map((classItem) => (
                  <div
                    key={classItem.id}
                    onClick={() => handleSelectClass(classItem.id)}
                    className="bg-gray-900/60 rounded-xl border border-white/10 shadow-sm hover:shadow-lg hover:border-emerald-500 transition-all duration-300 cursor-pointer group"
                  >
                    <div className="p-6">
                      <div className="flex items-start justify-between mb-4">
                        <div className="p-3 bg-emerald-50 rounded-lg group-hover:bg-emerald-100 transition-colors">
                          <Users className="w-6 h-6 text-emerald-600" />
                        </div>
                        <ChevronRight className="w-5 h-5 text-gray-400 group-hover:text-emerald-600 transition-colors" />
                      </div>

                      <h3 className="text-lg font-semibold text-white mb-1">{classItem.gradeLevel}</h3>
                      <p className="text-sm text-gray-400 mb-4">{classItem.sectionName}</p>

                      <button className="w-full mt-4 px-4 py-3 bg-emerald-700 text-white rounded-lg hover:bg-emerald-600 transition-all font-medium">
                        Record Attendance
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              {filteredClasses.length === 0 && (
                <div className="bg-gray-900/60 rounded-xl border border-white/10 shadow-sm p-12 text-center">
                  <Users className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                  <p className="text-gray-400">No classes found</p>
                </div>
              )}
            </>
          ) : (
            <>
              <div className="bg-gradient-to-r from-emerald-600 to-teal-600 rounded-2xl p-8 text-white shadow-lg">
                <button onClick={handleBackToClasses} className="mb-4 flex items-center gap-2 text-emerald-100 hover:text-white transition-colors">
                  &larr; Back to Classes
                </button>
                <h1 className="text-3xl font-bold mb-2">{selectedClass.gradeLevel}</h1>
                <p className="text-emerald-50">{selectedClass.sectionName}</p>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-gray-900/60 rounded-xl p-4 border border-white/10 shadow-sm">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-emerald-50 rounded-lg"><CheckCircle className="w-5 h-5 text-emerald-600" /></div>
                    <div><p className="text-gray-400 text-xs">Present</p><p className="text-2xl font-bold text-emerald-600">{presentCount}</p></div>
                  </div>
                </div>
                <div className="bg-gray-900/60 rounded-xl p-4 border border-white/10 shadow-sm">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-red-50 rounded-lg"><XCircle className="w-5 h-5 text-red-600" /></div>
                    <div><p className="text-gray-400 text-xs">Absent</p><p className="text-2xl font-bold text-red-600">{absentCount}</p></div>
                  </div>
                </div>
                <div className="bg-gray-900/60 rounded-xl p-4 border border-white/10 shadow-sm">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-red-50 rounded-lg"><AlertCircle className="w-5 h-5 text-red-600" /></div>
                    <div><p className="text-gray-400 text-xs">Late</p><p className="text-2xl font-bold text-red-600">{lateCount}</p></div>
                  </div>
                </div>
                <div className="bg-gray-900/60 rounded-xl p-4 border border-white/10 shadow-sm">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-black/20 rounded-lg"><Calendar className="w-5 h-5 text-gray-400" /></div>
                    <div><p className="text-gray-400 text-xs">Unmarked</p><p className="text-2xl font-bold text-gray-400">{unmarkedCount}</p></div>
                  </div>
                </div>
              </div>

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
                    <button onClick={handleMarkAllPresent} className="px-4 py-3 bg-emerald-50 text-emerald-600 rounded-lg hover:bg-emerald-100 transition-colors text-sm font-medium whitespace-nowrap">
                      Mark All Present
                    </button>
                    <button onClick={handleSave} disabled={!hasUnsavedChanges} className="flex items-center gap-2 px-6 py-3 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium whitespace-nowrap">
                      <Save className="w-4 h-4" />
                      Save Attendance
                    </button>
                  </div>
                </div>
              </div>

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
                      {filteredStudents.map((student) => (
                        <tr key={student.id} className="hover:bg-black/20">
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 bg-emerald-600 rounded-full flex items-center justify-center text-white font-semibold">{student.name.charAt(0)}</div>
                              <div>
                                <p className="font-medium text-white">{student.name}</p>
                                <p className="text-xs text-gray-500">{student.studentId}</p>
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-2">
                              <button onClick={() => handleStatusChange(student.id, "Present")} className={`p-2 rounded-lg transition-all ${student.status === "Present" ? "bg-emerald-600 text-white shadow-md" : "bg-white/5 text-gray-400 hover:bg-emerald-50 hover:text-emerald-600"}`} title="Present"><CheckCircle className="w-5 h-5" /></button>
                              <button onClick={() => handleStatusChange(student.id, "Absent")} className={`p-2 rounded-lg transition-all ${student.status === "Absent" ? "bg-red-600 text-white shadow-md" : "bg-white/5 text-gray-400 hover:bg-red-50 hover:text-red-600"}`} title="Absent"><XCircle className="w-5 h-5" /></button>
                              <button onClick={() => handleStatusChange(student.id, "Late")} className={`p-2 rounded-lg transition-all ${student.status === "Late" ? "bg-red-600 text-white shadow-md" : "bg-white/5 text-gray-400 hover:bg-red-50 hover:text-red-600"}`} title="Late"><AlertCircle className="w-5 h-5" /></button>
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <input type="text" placeholder="Add remarks..." value={student.remarks} onChange={(e) => handleRemarksChange(student.id, e.target.value)} className="w-full px-3 py-2 text-sm bg-black/20 text-white placeholder-gray-500 border border-white/20 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500" />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {filteredStudents.length === 0 && (
                  <div className="p-12 text-center">
                    <Users className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                    <p className="text-gray-400">{selectedClassId ? "No students enrolled" : "No students found"}</p>
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

export { AttendanceManagement };
