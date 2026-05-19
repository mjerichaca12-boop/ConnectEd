import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { TeacherSidebar } from "@/app/components/TeacherSidebar";
import { supabase } from "@/app/lib/supabaseClient";
import { LoadingScreen } from "@/app/components/LoadingScreen";
import {
  Bell,
  Calendar,
  CheckCircle,
  XCircle,
  AlertCircle,
  Save,
  Search,
  Users,
  ChevronRight,
  Download,
  FileSpreadsheet,
} from "lucide-react";

/* ─── Excel export helper ──────────────────────────────────────────── */
const exportAttendanceToExcel = (students, selectedDate, className) => {
  const rows = [
    ["ConnectEd – Attendance Report"],
    [`Class: ${className}`],
    [`Date: ${selectedDate}`],
    [`Generated: ${new Date().toLocaleString()}`],
    [],
    ["Student Name", "LRN", "Status", "Remarks"],
    ...students.map((s) => [s.name, s.studentId, s.status || "Unmarked", s.remarks || ""]),
    [],
    [`Present: ${students.filter((s) => s.status === "Present").length}`],
    [`Absent: ${students.filter((s) => s.status === "Absent").length}`],
    [`Late: ${students.filter((s) => s.status === "Late").length}`],
    [`Unmarked: ${students.filter((s) => !s.status).length}`],
  ];

  const tsv = rows.map((row) => row.join("\t")).join("\n");
  const blob = new Blob([tsv], { type: "text/tab-separated-values" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `attendance_${className.replace(/[^a-z0-9]/gi, "_")}_${selectedDate}.xls`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};

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
    if (error) { console.error("Failed to resolve teacher profile:", error); return ""; }
    return String(data?.id || "");
  };

  const fetchClasses = async (id) => {
    if (!supabase || !id) { setClasses([]); return; }
    const { data, error } = await supabase
      .from("subjects")
      .select("id, code, name, section:grade_level")
      .eq("teacher_id", id)
      .order("code", { ascending: true });
    if (error) { console.error("Failed to load classes:", error); setClasses([]); return; }
    setClasses((data ?? []).map((item) => ({
      id: String(item.id),
      sectionName: String(item.section || "").trim() || "No section assigned",
      gradeLevel: `${item.code || "SUBJ"} - ${item.name || "Untitled Subject"}`,
      studentCount: 0,
    })));
  };

  const fetchStudentsForClass = async (currentTeacherId, classId, dateValue) => {
    if (!supabase || !currentTeacherId || !classId) { setStudents([]); return; }

    const { data: assignments, error: assignmentError } = await supabase
      .from("teacher_student_assignments")
      .select("student_id")
      .eq("teacher_id", currentTeacherId)
      .eq("subject_id", classId);

    if (assignmentError) { console.error("Failed to load assignments:", assignmentError); setStudents([]); return; }

    const studentIds = [...new Set((assignments ?? []).map((row) => String(row.student_id || "")).filter(Boolean))];
    if (studentIds.length === 0) { setStudents([]); return; }

    const { data: studentRows, error: studentError } = await supabase
      .from("profiles")
      .select("id, first_name, middle_name, last_name, lrn")
      .eq("role", "student")
      .in("id", studentIds);

    if (studentError) { console.error("Failed to load students:", studentError); setStudents([]); return; }

    const safeDate = String(dateValue || selectedDate || new Date().toISOString().split("T")[0]).trim();
    const cacheKey = `${classId}_${safeDate}`;
    const classCache = attendanceCache[cacheKey] || {};
    const { data: attendanceRows, error: attendanceError } = await supabase
      .from("teacher_student_attendance")
      .select("student_id, attendance_status, remarks")
      .eq("teacher_id", currentTeacherId)
      .eq("subject_id", classId)
      .eq("attendance_date", safeDate)
      .in("student_id", studentIds);

    if (attendanceError) {
      console.error("Failed to load attendance records:", attendanceError);
    }

    const persistedAttendanceMap = {};
    (attendanceRows ?? []).forEach((row) => {
      const id = String(row.student_id || "");
      if (!id) return;
      persistedAttendanceMap[id] = {
        status: String(row.attendance_status || "").trim() || null,
        remarks: String(row.remarks || "").trim(),
      };
    });

    const mapped = (studentRows ?? []).map((student) => {
      const studentId = String(student.id);
      const cached = classCache[studentId] || persistedAttendanceMap[studentId] || { status: null, remarks: "" };
      const name = [student.first_name, student.middle_name, student.last_name]
        .map((part) => String(part || "").trim())
        .filter(Boolean)
        .join(" ")
        .trim() || "Student";
      return { id: studentId, name, studentId: String(student.lrn || "N/A"), status: cached.status, remarks: cached.remarks };
    });

    setAttendanceCache((prev) => ({
      ...prev,
      [cacheKey]: {
        ...(prev[cacheKey] || {}),
        ...persistedAttendanceMap,
      },
    }));
    setStudents(mapped);
  };

  useEffect(() => {
    const initialize = async () => {
      const userData = localStorage.getItem("currentUser");
      if (!userData) { navigate("/login"); return; }
      const user = JSON.parse(userData);
      if (user.role !== "teacher") { navigate("/login"); return; }
      setTeacherName(user.name);
      const resolvedTeacherId = await resolveTeacherId(user.email);
      setTeacherId(resolvedTeacherId);
      await fetchClasses(resolvedTeacherId);
      setLoading(false);
    };
    initialize();
  }, [navigate]);

  useEffect(() => {
    if (!teacherId || !selectedClassId) { setStudents([]); return; }
    fetchStudentsForClass(teacherId, selectedClassId, selectedDate);
  }, [teacherId, selectedClassId, selectedDate]);

  useEffect(() => {
    if (!supabase || !teacherId) return;
    const subjectsChannel = supabase
      .channel(`attendance-subjects-${teacherId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "subjects" }, (payload) => {
        const newTeacherId = String(payload?.new?.teacher_id || "");
        const oldTeacherId = String(payload?.old?.teacher_id || "");
        if (newTeacherId === teacherId || oldTeacherId === teacherId) fetchClasses(teacherId);
      })
      .subscribe();

    const assignmentsChannel = supabase
      .channel(`attendance-assignments-${teacherId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "teacher_student_assignments", filter: `teacher_id=eq.${teacherId}` }, (payload) => {
        const newSubjectId = String(payload?.new?.subject_id || "");
        const oldSubjectId = String(payload?.old?.subject_id || "");
        if (selectedClassId && (newSubjectId === selectedClassId || oldSubjectId === selectedClassId)) {
          fetchStudentsForClass(teacherId, selectedClassId, selectedDate);
        }
      })
      .subscribe();

    return () => { supabase.removeChannel(subjectsChannel); supabase.removeChannel(assignmentsChannel); };
  }, [teacherId, selectedClassId, selectedDate]);

  useEffect(() => {
    if (!saveSuccess) return;
    const timer = window.setTimeout(() => setSaveSuccess(false), 3000);
    return () => window.clearTimeout(timer);
  }, [saveSuccess]);

  const handleLogout = () => { localStorage.removeItem("currentUser"); navigate("/login"); };

  const handleStatusChange = (studentId, status) => {
    if (!selectedClassId) return;
    const cacheKey = `${selectedClassId}_${selectedDate}`;
    setStudents((prev) => prev.map((student) => (student.id === studentId ? { ...student, status } : student)));
    setAttendanceCache((current) => {
      const classCache = { ...(current[cacheKey] || {}) };
      classCache[studentId] = { ...(classCache[studentId] || { status: null, remarks: "" }), status };
      return { ...current, [cacheKey]: classCache };
    });
    setHasUnsavedChanges(true);
  };

  const handleRemarksChange = (studentId, remarks) => {
    if (!selectedClassId) return;
    const cacheKey = `${selectedClassId}_${selectedDate}`;
    setStudents((prev) => prev.map((student) => (student.id === studentId ? { ...student, remarks } : student)));
    setAttendanceCache((current) => {
      const classCache = { ...(current[cacheKey] || {}) };
      classCache[studentId] = { ...(classCache[studentId] || { status: null, remarks: "" }), remarks };
      return { ...current, [cacheKey]: classCache };
    });
    setHasUnsavedChanges(true);
  };

  const handleMarkAllPresent = () => {
    if (!selectedClassId || students.length === 0) return;
    const cacheKey = `${selectedClassId}_${selectedDate}`;
    const studentIds = students.map((student) => student.id);
    setStudents((prev) => prev.map((student) => ({ ...student, status: "Present" })));
    setAttendanceCache((current) => {
      const classCache = { ...(current[cacheKey] || {}) };
      studentIds.forEach((studentId) => { classCache[studentId] = { ...(classCache[studentId] || { remarks: "" }), status: "Present" }; });
      return { ...current, [cacheKey]: classCache };
    });
    setHasUnsavedChanges(true);
  };

  const handleSave = async () => {
    if (!selectedClassId || students.length === 0 || !teacherId || !supabase) return;

    const validStatuses = new Set(["Present", "Absent", "Late"]);
    const attendancePayload = students
      .filter((student) => validStatuses.has(String(student.status || "").trim()))
      .map((student) => ({
        teacher_id: teacherId,
        subject_id: selectedClassId,
        student_id: student.id,
        attendance_date: selectedDate,
        attendance_status: String(student.status).trim(),
        remarks: String(student.remarks || "").trim(),
        updated_at: new Date().toISOString(),
      }));

    if (attendancePayload.length === 0) {
      toast.error("Select attendance status before saving.");
      return;
    }

    try {
      const { error } = await supabase
        .from("teacher_student_attendance")
        .upsert(attendancePayload, { onConflict: "teacher_id,subject_id,student_id,attendance_date" });

      if (error) {
        console.error("Failed to save attendance:", error);
        toast.error(error.message || "Failed to save attendance.");
        return;
      }

      await fetchStudentsForClass(teacherId, selectedClassId, selectedDate);
      setSaveSuccess(true);
      setHasUnsavedChanges(false);
      toast.success("Attendance saved successfully!");
    } catch (error) {
      console.error("Unexpected attendance save error:", error);
      toast.error(error?.message || "Failed to save attendance.");
    }
  };

  const handleSelectClass = (classId) => { setSelectedClassId(classId); setStudentSearchQuery(""); setHasUnsavedChanges(false); };
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
    return classItem.sectionName.toLowerCase().includes(query) || classItem.gradeLevel.toLowerCase().includes(query);
  });

  const filteredStudents = students.filter((student) => {
    const query = studentSearchQuery.toLowerCase();
    return student.name.toLowerCase().includes(query) || student.studentId.toLowerCase().includes(query);
  });

  const selectedClass = useMemo(() => classes.find((item) => item.id === selectedClassId) || null, [classes, selectedClassId]);
  const presentCount = students.filter((s) => s.status === "Present").length;
  const absentCount = students.filter((s) => s.status === "Absent").length;
  const lateCount = students.filter((s) => s.status === "Late").length;
  const unmarkedCount = students.filter((s) => !s.status).length;

  if (loading) return <LoadingScreen message="Loading attendance..." />;

  return (
    <div className="min-h-screen bg-gray-50 flex">
      <TeacherSidebar teacherName={teacherName} onLogout={handleLogout} />

      <main className="flex-1 overflow-y-auto scrollbar-hide lg:pl-64">
        {/* Top bar */}
        <div className="bg-white border-b border-gray-200 sticky top-0 z-20">
          <div className="px-6 py-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold text-gray-900">Attendance Management</h2>
              <div className="flex items-center gap-4">
                {hasUnsavedChanges && <span className="text-sm text-amber-400 font-medium animate-pulse">● Unsaved changes</span>}
                <button className="relative p-2 hover:bg-gray-50 rounded-lg transition-colors">
                  <Bell className="w-6 h-6 text-gray-600" />
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="p-6 space-y-6">
          {saveSuccess && (
            <div className="bg-green-50 border border-green-200 rounded-xl p-4 flex items-center gap-3">
              <CheckCircle className="w-5 h-5 text-green-600" />
              <p className="text-green-700 font-medium">Attendance saved successfully!</p>
            </div>
          )}

          {!selectedClass ? (
            <>
              {/* Hero */}
              <div className="bg-gradient-to-r from-green-600 via-teal-600 to-cyan-600 rounded-2xl p-8 text-white shadow-xl relative overflow-hidden">
                <div className="absolute inset-0 opacity-10" style={{ backgroundImage: "radial-gradient(circle at 80% 50%, white 1px, transparent 1px)", backgroundSize: "20px 20px" }} />
                <div className="relative">
                  <h1 className="text-3xl font-bold mb-1">Record Attendance</h1>
                  <p className="text-white/85 text-sm">Select a class below to track student attendance by date</p>
                </div>
              </div>

              {/* Filters */}
              <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-2 uppercase tracking-wider">
                      <Calendar className="w-3.5 h-3.5 inline mr-1.5" />Select Date
                    </label>
                    <input
                      type="date"
                      value={selectedDate}
                      onChange={(e) => setSelectedDate(e.target.value)}
                      className="w-full px-4 py-3 bg-gray-50 text-gray-900 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-2 uppercase tracking-wider">
                      <Search className="w-3.5 h-3.5 inline mr-1.5" />Search Class
                    </label>
                    <input
                      type="text"
                      placeholder="Search by subject code, name, or section..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full px-4 py-3 bg-gray-50 text-gray-900 placeholder-gray-500 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500 text-sm"
                    />
                  </div>
                </div>
              </div>

              {/* Class cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                {filteredClasses.map((classItem) => (
                  <div
                    key={classItem.id}
                    onClick={() => handleSelectClass(classItem.id)}
                    className="bg-white rounded-xl border border-gray-200 hover:border-green-500/50 hover:shadow-lg hover:shadow-green-500/10 transition-all duration-300 cursor-pointer group"
                  >
                    <div className="p-6">
                      <div className="flex items-start justify-between mb-4">
                        <div className="p-3 bg-green-50 rounded-xl group-hover:bg-green-500/20 transition-colors">
                          <Users className="w-6 h-6 text-green-600" />
                        </div>
                        <ChevronRight className="w-5 h-5 text-gray-500 group-hover:text-green-600 transition-colors" />
                      </div>
                      <h3 className="text-base font-semibold text-gray-900 mb-1">{classItem.gradeLevel}</h3>
                      <p className="text-sm text-gray-600 mb-4">{classItem.sectionName}</p>
                      <button className="w-full px-4 py-2.5 bg-green-50 hover:bg-green-100 text-green-700 border border-green-200 rounded-lg transition-all font-medium text-sm">
                        Record Attendance
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              {filteredClasses.length === 0 && (
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-16 text-center">
                  <div className="w-14 h-14 bg-green-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
                    <Users className="w-7 h-7 text-green-600" />
                  </div>
                  <h3 className="text-gray-900 font-semibold mb-1">No classes found</h3>
                  <p className="text-gray-600 text-sm">Create classes from the Classes section first.</p>
                </div>
              )}
            </>
          ) : (
            <>
              {/* Selected class hero */}
              <div className="bg-gradient-to-r from-green-600 via-teal-600 to-cyan-600 rounded-2xl p-8 text-white shadow-xl relative overflow-hidden">
                <div className="absolute inset-0 opacity-10" style={{ backgroundImage: "radial-gradient(circle at 80% 50%, white 1px, transparent 1px)", backgroundSize: "20px 20px" }} />
                <div className="relative flex items-center justify-between flex-wrap gap-4">
                  <div>
                    <button onClick={handleBackToClasses} className="mb-3 flex items-center gap-2 text-white/85 hover:text-white transition-colors text-sm">
                      ← Back to Classes
                    </button>
                    <h1 className="text-3xl font-bold mb-1">{selectedClass.gradeLevel}</h1>
                    <p className="text-white/85">{selectedClass.sectionName} · {new Date(selectedDate).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" })}</p>
                  </div>
                  <button
                    onClick={() => exportAttendanceToExcel(students, selectedDate, selectedClass.gradeLevel)}
                    disabled={students.length === 0}
                    className="flex items-center gap-2 px-5 py-2.5 bg-white/15 hover:bg-white/25 text-white rounded-xl border border-white/20 backdrop-blur-sm transition-all disabled:opacity-40 disabled:cursor-not-allowed font-medium text-sm"
                  >
                    <FileSpreadsheet className="w-4 h-4" />
                    Export Excel
                  </button>
                </div>
              </div>

              {/* Stats */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[
                  { label: "Present", count: presentCount, icon: <CheckCircle className="w-5 h-5" />, color: "text-green-600", bg: "bg-green-50 border-green-200" },
                  { label: "Absent", count: absentCount, icon: <XCircle className="w-5 h-5" />, color: "text-red-600", bg: "bg-red-50 border-red-200" },
                  { label: "Late", count: lateCount, icon: <AlertCircle className="w-5 h-5" />, color: "text-amber-600", bg: "bg-amber-50 border-amber-200" },
                  { label: "Unmarked", count: unmarkedCount, icon: <Calendar className="w-5 h-5" />, color: "text-gray-600", bg: "bg-gray-50 border-gray-200" },
                ].map(({ label, count, icon, color, bg }) => (
                  <div key={label} className={`rounded-xl p-5 border ${bg}`}>
                    <div className={`${color} mb-2`}>{icon}</div>
                    <p className="text-gray-600 text-xs mb-1">{label}</p>
                    <p className={`text-2xl font-bold ${color}`}>{count}</p>
                  </div>
                ))}
              </div>

              {/* Controls */}
              <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm">
                <div className="flex items-center justify-between flex-wrap gap-4">
                  <div className="flex-1 max-w-sm">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-600" />
                      <input
                        type="text"
                        placeholder="Search student by name or LRN..."
                        value={studentSearchQuery}
                        onChange={(e) => setStudentSearchQuery(e.target.value)}
                        className="w-full pl-10 pr-4 py-3 bg-gray-50 text-gray-900 placeholder-gray-500 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500 text-sm"
                      />
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <button
                      onClick={handleMarkAllPresent}
                      className="px-4 py-2.5 bg-green-50 hover:bg-green-100 text-green-700 border border-green-200 rounded-lg text-sm font-medium transition-all"
                    >
                      Mark All Present
                    </button>
                    <button
                      onClick={handleSave}
                      disabled={!hasUnsavedChanges}
                      className="flex items-center gap-2 px-5 py-2.5 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed text-sm font-medium"
                    >
                      <Save className="w-4 h-4" />
                      Save Attendance
                    </button>
                  </div>
                </div>
              </div>

              {/* Students table */}
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Student</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Remarks</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {filteredStudents.map((student) => (
                        <tr key={student.id} className="hover:bg-gray-50 transition-colors">
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-3">
                              <div className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold text-white ${
                                student.status === "Present" ? "bg-green-500" :
                                student.status === "Absent" ? "bg-red-500" :
                                student.status === "Late" ? "bg-amber-500" : "bg-gray-400"
                              }`}>
                                {student.name.charAt(0)}
                              </div>
                              <div>
                                <p className="font-medium text-gray-900">{student.name}</p>
                                <p className="text-xs text-gray-500">{student.studentId}</p>
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => handleStatusChange(student.id, "Present")}
                                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border transition-all text-xs font-medium ${student.status === "Present" ? "bg-green-600 border-green-600 text-white shadow-sm" : "bg-white border-gray-200 text-gray-600 hover:bg-green-50 hover:text-green-700 hover:border-green-200"}`}
                              >
                                <CheckCircle className="w-4 h-4" />Present
                              </button>
                              <button
                                onClick={() => handleStatusChange(student.id, "Absent")}
                                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border transition-all text-xs font-medium ${student.status === "Absent" ? "bg-red-600 border-red-600 text-white shadow-sm" : "bg-white border-gray-200 text-gray-600 hover:bg-red-50 hover:text-red-700 hover:border-red-200"}`}
                              >
                                <XCircle className="w-4 h-4" />Absent
                              </button>
                              <button
                                onClick={() => handleStatusChange(student.id, "Late")}
                                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border transition-all text-xs font-medium ${student.status === "Late" ? "bg-amber-600 border-amber-600 text-white shadow-sm" : "bg-white border-gray-200 text-gray-600 hover:bg-amber-50 hover:text-amber-700 hover:border-amber-200"}`}
                              >
                                <AlertCircle className="w-4 h-4" />Late
                              </button>
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <input
                              type="text"
                              placeholder="Add remarks..."
                              value={student.remarks}
                              onChange={(e) => handleRemarksChange(student.id, e.target.value)}
                              className="w-full px-3 py-2 text-sm bg-gray-50 text-gray-900 placeholder-gray-500 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500"
                            />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {filteredStudents.length === 0 && (
                  <div className="p-12 text-center">
                    <div className="w-14 h-14 bg-green-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
                      <Users className="w-7 h-7 text-green-600" />
                    </div>
                    <p className="text-gray-600">{selectedClassId ? "No students enrolled in this class" : "No students found"}</p>
                  </div>
                )}

                {/* Download footer */}
                {students.length > 0 && (
                  <div className="p-4 border-t border-gray-100 flex justify-end bg-gray-50">
                    <button
                      onClick={() => exportAttendanceToExcel(students, selectedDate, selectedClass.gradeLevel)}
                      className="flex items-center gap-2 px-4 py-2 bg-green-50 hover:bg-green-100 border border-green-200 text-green-700 rounded-lg text-sm transition-all"
                    >
                      <Download className="w-4 h-4" />
                      Download Attendance Report (.xls)
                    </button>
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
