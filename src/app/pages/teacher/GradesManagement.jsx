import { useEffect, useMemo, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { TeacherSidebar } from "@/app/components/TeacherSidebar";
import { CustomSelect } from "@/app/components/CustomSelect";
import { NotificationDropdown } from "@/app/components/NotificationDropdown";
import { teacherNotifications } from "@/app/components/NotificationDefault";
import { supabase } from "@/app/lib/supabaseClient";
import { LoadingScreen } from "@/app/components/LoadingScreen";
import {
  createDefaultGradeRecord,
  clampGradeValue,
  getGradeRemarks,
  calculateOverallGrade,
  resolveTeacherIdByEmail
} from "@/app/lib/teacherHelpers";
import {
  TrendingUp,
  TrendingDown,
  Save,
  Filter,
  Search,
  CheckCircle,
  Award,
  Target,
  Users,
  Download,
  FileSpreadsheet,
  ClipboardList,
  BookOpen,
  PenLine,
  ChevronDown,
  ChevronUp,
} from "lucide-react";

/* ─── pure helpers ────────────────────────────────────────────────── */
const exportToExcel = (studentGrades, className) => {
  const passedStudents = studentGrades.filter((s) => s.overallGrade >= 75);
  const failedStudents = studentGrades.filter((s) => s.overallGrade < 75);

  const rows = [
    ["ConnectEd – Grade Report"],
    [`Class: ${className}`],
    [`Generated: ${new Date().toLocaleString()}`],
    [],
    ["Student Name", "LRN", "Quizzes", "Activities", "Assignments", "Midterm", "Final", "Overall Grade", "Remarks"],
    ...studentGrades.map((s) => [
      s.studentName,
      s.studentId,
      s.quizAverage,
      s.activityGrade,
      s.projectGrade,
      s.midtermGrade,
      s.finalGrade,
      s.overallGrade,
      s.remarks,
    ]),
    [],
    [`Passed (≥ 75): ${passedStudents.length}`, "", "", "", "", "", "", "", ""],
    [`Failed (< 75): ${failedStudents.length}`, "", "", "", "", "", "", "", ""],
  ];

  const tsv = rows.map((row) => row.join("\t")).join("\n");
  const blob = new Blob([tsv], { type: "text/tab-separated-values" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `grades_${className.replace(/[^a-z0-9]/gi, "_")}_${new Date().toISOString().split("T")[0]}.xls`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};

/* ─── component ──────────────────────────────────────────────────── */
function GradesManagement() {
  const navigate = useNavigate();
  const [teacherName, setTeacherName] = useState("");
  const [notificationList, setNotificationList] = useState(teacherNotifications);
  const [loading, setLoading] = useState(true);
  const [teacherId, setTeacherId] = useState("");
  const [classes, setClasses] = useState([]);
  const [selectedClass, setSelectedClass] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saving, setSaving] = useState(false);
  const [studentGrades, setStudentGrades] = useState([]);
  const [gradesCache, setGradesCache] = useState({});
  const [activeView, setActiveView] = useState("all"); // "all" | "passed" | "failed"
  const [expandedStudent, setExpandedStudent] = useState(null);

  // Activity/Quiz/Assignment counts from DB
  const [classCounts, setClassCounts] = useState({ quizzes: 0, activities: 0, assignments: 0 });

  /* ─── fetch classes ─────────────────────────────────────────────── */
  const fetchClasses = useCallback(async (id) => {
    if (!supabase || !id) { setClasses([]); return; }
    const { data, error } = await supabase
      .from("subjects")
      .select("id, code, name, section")
      .eq("teacher_id", id)
      .order("code", { ascending: true });
    if (error) { console.error("Failed to load classes:", error); setClasses([]); return; }
    setClasses((data ?? []).map((item) => ({
      id: String(item.id),
      code: String(item.code || "").trim(),
      name: String(item.name || "Untitled Subject").trim(),
      section: String(item.section || "").trim() || "No section assigned",
    })));
  }, []);

  /* ─── fetch activity/quiz/assignment counts ─────────────────────── */
  const fetchClassCounts = useCallback(async (currentTeacherId, classId) => {
    if (!supabase || !currentTeacherId || !classId) { setClassCounts({ quizzes: 0, activities: 0, assignments: 0 }); return; }

    // Try to find the assignment table
    const CANDIDATES = ["assignments_activity", "class_assignments", "assignments", "teacher_assignments", "class_activities"];
    let tableName = "";
    for (const t of CANDIDATES) {
      const { error } = await supabase.from(t).select("id", { count: "exact", head: true });
      if (!error) { tableName = t; break; }
    }
    if (!tableName) { setClassCounts({ quizzes: 0, activities: 0, assignments: 0 }); return; }

    const { data, error } = await supabase
      .from(tableName)
      .select("*");

    if (error) { setClassCounts({ quizzes: 0, activities: 0, assignments: 0 }); return; }

    const rows = (data ?? []).filter((row) => {
      const rowCourseId = String(row?.course_id || row?.subject_id || row?.class_id || "").trim();
      return !classId || !rowCourseId || rowCourseId === classId;
    });

    const quizzes = rows.filter((r) => {
      const t = String(r?.type || r?.activity_type || r?.task_type || "").toLowerCase();
      return t === "quiz";
    }).length;
    const activities = rows.filter((r) => {
      const t = String(r?.type || r?.activity_type || r?.task_type || "").toLowerCase();
      return t === "activity";
    }).length;
    const assignments = rows.filter((r) => {
      const t = String(r?.type || r?.activity_type || r?.task_type || "").toLowerCase();
      return !t || t === "assignment";
    }).length;

    setClassCounts({ quizzes, activities, assignments });
  }, []);

  /* ─── fetch students + grades ───────────────────────────────────── */
  const fetchStudentsForClass = useCallback(async (currentTeacherId, classId) => {
    if (!supabase || !currentTeacherId || !classId) { setStudentGrades([]); return; }

    const { data: assignments, error: assignmentError } = await supabase
      .from("teacher_student_assignments")
      .select("student_id")
      .eq("teacher_id", currentTeacherId)
      .eq("subject_id", classId);

    if (assignmentError) { console.error("Failed to load class assignments:", assignmentError); setStudentGrades([]); return; }

    const studentIds = [...new Set((assignments ?? []).map((row) => String(row.student_id || "")).filter(Boolean))];
    if (studentIds.length === 0) { setStudentGrades([]); return; }

    const { data: studentRows, error: studentError } = await supabase
      .from("profiles")
      .select("id, first_name, middle_name, last_name, lrn")
      .eq("role", "student")
      .in("id", studentIds);

    if (studentError) { console.error("Failed to load students:", studentError); setStudentGrades([]); return; }

    const { data: gradeRows } = await supabase
      .from("teacher_student_grades")
      .select("student_id, midterm_grade, final_grade, quiz_average, project_grade, activity_grade")
      .eq("teacher_id", currentTeacherId)
      .eq("subject_id", classId)
      .in("student_id", studentIds);

    const persistedGradeMap = {};
    (gradeRows ?? []).forEach((row) => {
      const id = String(row.student_id || "");
      if (!id) return;
      persistedGradeMap[id] = {
        midtermGrade: clampGradeValue(row.midterm_grade),
        finalGrade: clampGradeValue(row.final_grade),
        quizAverage: clampGradeValue(row.quiz_average),
        projectGrade: clampGradeValue(row.project_grade),
        activityGrade: clampGradeValue(row.activity_grade ?? 0),
      };
    });

    const cacheForClass = gradesCache[classId] || {};
    const mapped = (studentRows ?? []).map((student) => {
      const studentId = String(student.id);
      const cached = cacheForClass[studentId] || persistedGradeMap[studentId] || { ...createDefaultGradeRecord(), activityGrade: 0 };
      const studentName = [student.first_name, student.middle_name, student.last_name]
        .map((part) => String(part || "").trim())
        .filter(Boolean)
        .join(" ")
        .trim() || "Student";

      const current = {
        id: studentId,
        studentName,
        studentId: String(student.lrn || "N/A"),
        midtermGrade: clampGradeValue(cached.midtermGrade),
        finalGrade: clampGradeValue(cached.finalGrade),
        quizAverage: clampGradeValue(cached.quizAverage),
        projectGrade: clampGradeValue(cached.projectGrade),
        activityGrade: clampGradeValue(cached.activityGrade ?? 0),
      };

      const overallGrade = calculateOverallGrade(current);
      return { ...current, overallGrade, remarks: getGradeRemarks(overallGrade) };
    });

    setGradesCache((prev) => ({
      ...prev,
      [classId]: { ...(prev[classId] || {}), ...persistedGradeMap },
    }));
    setStudentGrades(mapped);
  }, [gradesCache]);

  /* ─── init ──────────────────────────────────────────────────────── */
  useEffect(() => {
    const initialize = async () => {
      const userData = localStorage.getItem("currentUser");
      if (!userData) { navigate("/login"); return; }
      const user = JSON.parse(userData);
      if (user.role !== "teacher") { navigate("/login"); return; }
      setTeacherName(user.name);
      const resolvedTeacherId = await resolveTeacherIdByEmail(user.email);
      setTeacherId(resolvedTeacherId);
      await fetchClasses(resolvedTeacherId);
      setLoading(false);
    };
    initialize();
  }, [navigate, fetchClasses]);

  useEffect(() => {
    if (!teacherId || !selectedClass) { setStudentGrades([]); return; }
    fetchStudentsForClass(teacherId, selectedClass);
    fetchClassCounts(teacherId, selectedClass);
  }, [teacherId, selectedClass]);

  useEffect(() => {
    if (!saveSuccess) return;
    const timer = window.setTimeout(() => setSaveSuccess(false), 3000);
    return () => window.clearTimeout(timer);
  }, [saveSuccess]);

  /* ─── handlers ──────────────────────────────────────────────────── */
  const handleLogoutClick = () => { localStorage.removeItem("currentUser"); navigate("/login"); };

  const handleGradeChange = (studentId, field, value) => {
    const nextValue = clampGradeValue(value);
    setStudentGrades((prev) => prev.map((student) => {
      if (student.id !== studentId) return student;
      const updated = { ...student, [field]: nextValue };
      const overallGrade = calculateOverallGrade(updated);
      return { ...updated, overallGrade, remarks: getGradeRemarks(overallGrade) };
    }));
    setGradesCache((current) => {
      const classCache = { ...(current[selectedClass] || {}) };
      const existing = classCache[studentId] || { ...createDefaultGradeRecord(), activityGrade: 0 };
      classCache[studentId] = { ...existing, [field]: nextValue };
      return { ...current, [selectedClass]: classCache };
    });
    setHasUnsavedChanges(true);
  };

  const handleSave = async () => {
    if (!selectedClass || studentGrades.length === 0 || !teacherId || !supabase) return;
    try {
      setSaving(true);
      const payload = studentGrades.map((student) => ({
        teacher_id: teacherId,
        subject_id: selectedClass,
        student_id: student.id,
        midterm_grade: clampGradeValue(student.midtermGrade),
        final_grade: clampGradeValue(student.finalGrade),
        quiz_average: clampGradeValue(student.quizAverage),
        project_grade: clampGradeValue(student.projectGrade),
        activity_grade: clampGradeValue(student.activityGrade ?? 0),
        overall_grade: clampGradeValue(student.overallGrade),
        updated_at: new Date().toISOString(),
      }));
      const { error } = await supabase
        .from("teacher_student_grades")
        .upsert(payload, { onConflict: "teacher_id,subject_id,student_id" });
      if (error) { console.error("Failed to save grades:", error); return; }
      setSaveSuccess(true);
      setHasUnsavedChanges(false);
    } catch (error) {
      console.error("Unexpected save error:", error);
    } finally {
      setSaving(false);
    }
  };

  /* ─── derived ───────────────────────────────────────────────────── */
  const selectedClassName = useMemo(() => {
    const classItem = classes.find((item) => item.id === selectedClass);
    if (!classItem) return "";
    return `${classItem.code} - ${classItem.name} (${classItem.section})`;
  }, [classes, selectedClass]);

  const filteredByView = useMemo(() => {
    let base = studentGrades;
    if (activeView === "passed") base = base.filter((s) => s.overallGrade >= 75);
    if (activeView === "failed") base = base.filter((s) => s.overallGrade < 75);
    const search = searchQuery.toLowerCase();
    if (search) base = base.filter((s) => s.studentName.toLowerCase().includes(search) || s.studentId.toLowerCase().includes(search));
    return base;
  }, [studentGrades, activeView, searchQuery]);

  const classAverage = studentGrades.length > 0 ? Math.round(studentGrades.reduce((sum, item) => sum + item.overallGrade, 0) / studentGrades.length) : 0;
  const highestGrade = studentGrades.length > 0 ? Math.max(...studentGrades.map((item) => item.overallGrade)) : 0;
  const lowestGrade = studentGrades.length > 0 ? Math.min(...studentGrades.map((item) => item.overallGrade)) : 0;
  const passingCount = studentGrades.filter((s) => s.overallGrade >= 75).length;
  const failingCount = studentGrades.filter((s) => s.overallGrade < 75).length;
  const passingRate = studentGrades.length > 0 ? Math.round((passingCount / studentGrades.length) * 100) : 0;

  /* ─── render ────────────────────────────────────────────────────── */
  if (loading) return <LoadingScreen message="Loading grades..." />;

  return (
    <div className="min-h-screen bg-gray-950 flex">
      <TeacherSidebar teacherName={teacherName} onLogout={handleLogoutClick} />

      <main className="flex-1 overflow-y-auto scrollbar-hide">
        {/* Top bar */}
        <div className="bg-gray-900/60 border-b border-white/10 sticky top-0 z-20">
          <div className="px-6 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <h2 className="text-xl font-semibold text-white">Grades Management</h2>
                {hasUnsavedChanges && <span className="text-sm text-amber-400 font-medium animate-pulse">● Unsaved changes</span>}
              </div>
              <NotificationDropdown
                notifications={notificationList}
                onMarkAsRead={(id) => setNotificationList((prev) => prev.map((n) => (n.id === id ? { ...n, isRead: true } : n)))}
                onNotificationsChange={setNotificationList}
              />
            </div>
          </div>
        </div>

        <div className="p-6 space-y-6">
          {/* Hero */}
          <div className="bg-gradient-to-r from-emerald-600 via-teal-600 to-cyan-600 rounded-2xl p-8 text-white shadow-xl relative overflow-hidden">
            <div className="absolute inset-0 opacity-10" style={{ backgroundImage: "radial-gradient(circle at 80% 50%, white 1px, transparent 1px)", backgroundSize: "20px 20px" }} />
            <div className="relative flex items-center justify-between flex-wrap gap-4">
              <div>
                <h1 className="text-3xl font-bold mb-1">Grade Management</h1>
                <p className="text-emerald-50 text-sm">Grades auto-consolidate from class activities, quizzes &amp; assignments</p>
              </div>
              {selectedClass && (
                <div className="flex gap-3">
                  <button
                    onClick={() => exportToExcel(studentGrades, selectedClassName)}
                    disabled={studentGrades.length === 0}
                    className="flex items-center gap-2 px-5 py-2.5 bg-white/10 hover:bg-white/20 text-white rounded-xl border border-white/20 backdrop-blur-sm transition-all disabled:opacity-40 disabled:cursor-not-allowed font-medium text-sm"
                  >
                    <FileSpreadsheet className="w-4 h-4" />
                    Export Excel
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: "Class Average", value: `${classAverage}%`, icon: <TrendingUp className="w-5 h-5" />, color: "text-emerald-400", bg: "bg-emerald-500/10 border-emerald-500/20" },
              { label: "Highest Grade", value: `${highestGrade}%`, icon: <Award className="w-5 h-5" />, color: "text-blue-400", bg: "bg-blue-500/10 border-blue-500/20" },
              { label: "Lowest Grade", value: `${lowestGrade}%`, icon: <TrendingDown className="w-5 h-5" />, color: "text-red-400", bg: "bg-red-500/10 border-red-500/20" },
              { label: "Passing Rate", value: `${passingRate}%`, icon: <Target className="w-5 h-5" />, color: "text-purple-400", bg: "bg-purple-500/10 border-purple-500/20" },
            ].map(({ label, value, icon, color, bg }) => (
              <div key={label} className={`rounded-xl p-5 border ${bg}`}>
                <div className={`${color} mb-2`}>{icon}</div>
                <p className="text-gray-400 text-xs mb-1">{label}</p>
                <p className={`text-2xl font-bold ${color}`}>{value}</p>
              </div>
            ))}
          </div>

          {/* Activity / Quiz / Assignment counts */}
          {selectedClass && (
            <div className="grid grid-cols-3 gap-4">
              {[
                { label: "Quizzes", count: classCounts.quizzes, icon: <PenLine className="w-4 h-4" />, color: "text-violet-400", bg: "bg-violet-500/10 border-violet-500/20" },
                { label: "Activities", count: classCounts.activities, icon: <ClipboardList className="w-4 h-4" />, color: "text-orange-400", bg: "bg-orange-500/10 border-orange-500/20" },
                { label: "Assignments", count: classCounts.assignments, icon: <BookOpen className="w-4 h-4" />, color: "text-sky-400", bg: "bg-sky-500/10 border-sky-500/20" },
              ].map(({ label, count, icon, color, bg }) => (
                <div key={label} className={`rounded-xl p-4 border ${bg} flex items-center gap-4`}>
                  <div className={`p-2.5 rounded-lg bg-white/5 ${color}`}>{icon}</div>
                  <div>
                    <p className="text-gray-400 text-xs">{label} Posted</p>
                    <p className={`text-xl font-bold ${color}`}>{count}</p>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Success banner */}
          {saveSuccess && (
            <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-4 flex items-center gap-3">
              <CheckCircle className="w-5 h-5 text-emerald-400" />
              <p className="text-emerald-300 font-medium">Grades saved successfully!</p>
            </div>
          )}

          {/* Filters */}
          <div className="bg-gray-900/60 rounded-xl p-5 border border-white/10 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-2 uppercase tracking-wider">
                  <Filter className="w-3.5 h-3.5 inline mr-1.5" />
                  Select Subject / Section
                </label>
                {classes.length === 0 ? (
                  <div className="w-full px-4 py-3 border border-white/10 rounded-lg bg-black/20 text-gray-400 text-sm">No classes available</div>
                ) : (
                  <CustomSelect
                    value={selectedClass}
                    onChange={(value) => { setSelectedClass(value); setHasUnsavedChanges(false); setActiveView("all"); }}
                    placeholder="Select a class"
                    className="w-full"
                    options={classes.map((c) => ({ value: c.id, label: `${c.code} - ${c.name} (${c.section})` }))}
                  />
                )}
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-2 uppercase tracking-wider">
                  <Search className="w-3.5 h-3.5 inline mr-1.5" />
                  Search Student
                </label>
                <input
                  type="text"
                  placeholder="Search by name or LRN..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full px-4 py-3 bg-black/20 text-white placeholder-gray-500 border border-white/20 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 text-sm"
                />
              </div>
            </div>
          </div>

          {/* Grade Table */}
          {selectedClass && (
            <div className="bg-gray-900/60 rounded-xl border border-white/10 shadow-sm overflow-hidden">
              {/* Table header row */}
              <div className="p-5 border-b border-white/10 flex flex-wrap items-center justify-between gap-4">
                <div>
                  <h3 className="text-base font-semibold text-white">{selectedClassName || "Select a class to view grades"}</h3>
                  <p className="text-xs text-gray-400 mt-0.5">{filteredByView.length} student{filteredByView.length !== 1 ? "s" : ""}</p>
                </div>

                <div className="flex items-center gap-3 flex-wrap">
                  {/* Pass/Fail filter tabs */}
                  <div className="flex bg-black/20 rounded-lg p-1 border border-white/10">
                    {[
                      { key: "all", label: `All (${studentGrades.length})` },
                      { key: "passed", label: `Passed (${passingCount})`, color: "text-emerald-400" },
                      { key: "failed", label: `Failed (${failingCount})`, color: "text-red-400" },
                    ].map(({ key, label, color }) => (
                      <button
                        key={key}
                        onClick={() => setActiveView(key)}
                        className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${activeView === key ? "bg-white/10 text-white" : `text-gray-400 hover:text-white ${color || ""}`}`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>

                  <button
                    onClick={handleSave}
                    disabled={!hasUnsavedChanges || !selectedClass || saving}
                    className="flex items-center gap-2 px-5 py-2.5 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-all text-sm font-medium disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    <Save className="w-4 h-4" />
                    {saving ? "Saving…" : "Save All"}
                  </button>
                </div>
              </div>

              {filteredByView.length === 0 ? (
                <div className="p-12 text-center">
                  <Users className="w-12 h-12 text-gray-600 mx-auto mb-3" />
                  <p className="text-gray-500">{!selectedClass ? "Select a class to load students" : "No students found"}</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-black/20">
                      <tr>
                        <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Student</th>
                        <th className="px-5 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Quiz Avg</th>
                        <th className="px-5 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Activity</th>
                        <th className="px-5 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Assignment</th>
                        <th className="px-5 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Midterm</th>
                        <th className="px-5 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Final</th>
                        <th className="px-5 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Overall</th>
                        <th className="px-5 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Remarks</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {filteredByView.map((student) => {
                        const isPassed = student.overallGrade >= 75;
                        const isExpanded = expandedStudent === student.id;
                        return (
                          <tr key={student.id} className={`hover:bg-white/5 transition-colors ${!isPassed ? "bg-red-500/5" : ""}`}>
                            <td className="px-5 py-4">
                              <div className="flex items-center gap-3">
                                <div className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold text-white ${isPassed ? "bg-emerald-600" : "bg-red-600"}`}>
                                  {student.studentName.charAt(0)}
                                </div>
                                <div>
                                  <p className="font-medium text-white">{student.studentName}</p>
                                  <p className="text-xs text-gray-500">{student.studentId}</p>
                                </div>
                              </div>
                            </td>
                            {[
                              { field: "quizAverage", value: student.quizAverage, color: "ring-violet-500" },
                              { field: "activityGrade", value: student.activityGrade, color: "ring-orange-500" },
                              { field: "projectGrade", value: student.projectGrade, color: "ring-sky-500" },
                              { field: "midtermGrade", value: student.midtermGrade, color: "ring-emerald-500" },
                              { field: "finalGrade", value: student.finalGrade, color: "ring-emerald-500" },
                            ].map(({ field, value, color }) => (
                              <td key={field} className="px-5 py-4 text-center">
                                <input
                                  type="number"
                                  min="0"
                                  max="100"
                                  value={value}
                                  onChange={(e) => handleGradeChange(student.id, field, e.target.value)}
                                  className={`w-20 px-2 py-1.5 text-center bg-black/20 text-white border border-white/20 rounded-lg focus:outline-none focus:ring-2 ${color} text-sm`}
                                />
                              </td>
                            ))}
                            <td className="px-5 py-4 text-center">
                              <span className={`inline-block px-3 py-1.5 rounded-full text-sm font-bold ${isPassed ? "bg-emerald-500/20 text-emerald-400" : "bg-red-500/20 text-red-400"}`}>
                                {student.overallGrade}%
                              </span>
                            </td>
                            <td className="px-5 py-4 text-center">
                              <span className={`inline-block px-2.5 py-1 rounded-full text-xs font-semibold ${isPassed ? "bg-emerald-500/10 text-emerald-300 border border-emerald-500/20" : "bg-red-500/10 text-red-300 border border-red-500/20"}`}>
                                {student.remarks}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Summary footer */}
              {studentGrades.length > 0 && (
                <div className="p-4 border-t border-white/10 flex items-center justify-between bg-black/10 flex-wrap gap-3">
                  <div className="flex items-center gap-6 text-sm">
                    <div className="flex items-center gap-2">
                      <div className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
                      <span className="text-gray-400">Passed: <span className="text-emerald-400 font-semibold">{passingCount}</span></span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-2.5 h-2.5 rounded-full bg-red-400" />
                      <span className="text-gray-400">Failed: <span className="text-red-400 font-semibold">{failingCount}</span></span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-2.5 h-2.5 rounded-full bg-gray-400" />
                      <span className="text-gray-400">Total: <span className="text-white font-semibold">{studentGrades.length}</span></span>
                    </div>
                  </div>
                  <button
                    onClick={() => exportToExcel(studentGrades, selectedClassName)}
                    className="flex items-center gap-2 px-4 py-2 bg-emerald-600/20 hover:bg-emerald-600/30 border border-emerald-500/30 text-emerald-300 rounded-lg text-sm transition-all"
                  >
                    <Download className="w-4 h-4" />
                    Download Excel Report
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Empty state when no class selected */}
          {!selectedClass && (
            <div className="bg-gray-900/40 rounded-xl border border-white/5 p-16 text-center">
              <div className="w-16 h-16 bg-emerald-500/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <Award className="w-8 h-8 text-emerald-400" />
              </div>
              <h3 className="text-white font-semibold mb-1">Select a class to view grades</h3>
              <p className="text-gray-400 text-sm">Grades are automatically consolidated from activities, quizzes, and assignments.</p>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

export { GradesManagement };
