import { useEffect, useMemo, useState } from "react";
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
  Users
} from "lucide-react";



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
      code: String(item.code || "").trim(),
      name: String(item.name || "Untitled Subject").trim(),
      section: String(item.section || "").trim() || "No section assigned"
    }));

    setClasses(mapped);
  };

  const fetchStudentsForClass = async (currentTeacherId, classId) => {
    if (!supabase || !currentTeacherId || !classId) {
      setStudentGrades([]);
      return;
    }

    const { data: assignments, error: assignmentError } = await supabase
      .from("teacher_student_assignments")
      .select("student_id")
      .eq("teacher_id", currentTeacherId)
      .eq("subject_id", classId);

    if (assignmentError) {
      console.error("Failed to load class assignments:", assignmentError);
      setStudentGrades([]);
      return;
    }

    const studentIds = [...new Set((assignments ?? []).map((row) => String(row.student_id || "")).filter(Boolean))];

    if (studentIds.length === 0) {
      setStudentGrades([]);
      return;
    }

    const { data: studentRows, error: studentError } = await supabase
      .from("profiles")
      .select("id, first_name, middle_name, last_name, lrn")
      .eq("role", "student")
      .in("id", studentIds);

    if (studentError) {
      console.error("Failed to load students:", studentError);
      setStudentGrades([]);
      return;
    }

    const { data: gradeRows, error: gradeError } = await supabase
      .from("teacher_student_grades")
      .select("student_id, midterm_grade, final_grade, quiz_average, project_grade")
      .eq("teacher_id", currentTeacherId)
      .eq("subject_id", classId)
      .in("student_id", studentIds);

    if (gradeError) {
      console.error("Failed to load encoded grades:", gradeError);
    }

    const persistedGradeMap = {};
    (gradeRows ?? []).forEach((row) => {
      const id = String(row.student_id || "");
      if (!id) return;
      persistedGradeMap[id] = {
        midtermGrade: clampGradeValue(row.midterm_grade),
        finalGrade: clampGradeValue(row.final_grade),
        quizAverage: clampGradeValue(row.quiz_average),
        projectGrade: clampGradeValue(row.project_grade)
      };
    });

    const cacheForClass = gradesCache[classId] || {};
    const mapped = (studentRows ?? []).map((student) => {
      const studentId = String(student.id);
      const cached = cacheForClass[studentId] || persistedGradeMap[studentId] || createDefaultGradeRecord();
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
        projectGrade: clampGradeValue(cached.projectGrade)
      };

      const overallGrade = calculateOverallGrade(current);
      return {
        ...current,
        overallGrade,
        remarks: getGradeRemarks(overallGrade)
      };
    });

    setGradesCache((current) => ({
      ...current,
      [classId]: {
        ...(current[classId] || {}),
        ...persistedGradeMap
      }
    }));

    setStudentGrades(mapped);
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
      const resolvedTeacherId = await resolveTeacherIdByEmail(user.email);
      setTeacherId(resolvedTeacherId);
      await fetchClasses(resolvedTeacherId);
      setLoading(false);
    };

    initialize();
  }, [navigate]);

  useEffect(() => {
    if (!teacherId || !selectedClass) {
      setStudentGrades([]);
      return;
    }

    fetchStudentsForClass(teacherId, selectedClass);
  }, [teacherId, selectedClass]);

  useEffect(() => {
    if (!supabase || !teacherId) return;

    const subjectsChannel = supabase
      .channel(`grades-subjects-${teacherId}`)
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
      .channel(`grades-assignments-${teacherId}`)
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
          if (selectedClass && (newSubjectId === selectedClass || oldSubjectId === selectedClass)) {
            fetchStudentsForClass(teacherId, selectedClass);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(subjectsChannel);
      supabase.removeChannel(assignmentsChannel);
    };
  }, [teacherId, selectedClass]);

  useEffect(() => {
    if (!saveSuccess) return;
    const timer = window.setTimeout(() => setSaveSuccess(false), 3000);
    return () => window.clearTimeout(timer);
  }, [saveSuccess]);

  const handleLogoutClick = () => {
    localStorage.removeItem("currentUser");
    navigate("/login");
  };

  const handleGradeChange = (studentId, field, value) => {
    const nextValue = clampGradeValue(value);

    setStudentGrades((prev) => prev.map((student) => {
      if (student.id !== studentId) return student;

      const updated = { ...student, [field]: nextValue };
      const overallGrade = calculateOverallGrade(updated);
      updated.overallGrade = overallGrade;
      updated.remarks = getGradeRemarks(overallGrade);
      return updated;
    }));

    setGradesCache((current) => {
      const classCache = { ...(current[selectedClass] || {}) };
      const existing = classCache[studentId] || createDefaultGradeRecord();
      classCache[studentId] = {
        ...existing,
        [field]: nextValue
      };

      return {
        ...current,
        [selectedClass]: classCache
      };
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
        overall_grade: clampGradeValue(student.overallGrade),
        updated_at: new Date().toISOString()
      }));

      const { error } = await supabase
        .from("teacher_student_grades")
        .upsert(payload, { onConflict: "teacher_id,subject_id,student_id" });

      if (error) {
        console.error("Failed to save grades:", error);
        return;
      }

      setSaveSuccess(true);
      setHasUnsavedChanges(false);
    } catch (error) {
      console.error("Unexpected save error:", error);
    } finally {
      setSaving(false);
    }
  };

  const filteredGrades = studentGrades.filter((student) => {
    const search = searchQuery.toLowerCase();
    return (
      student.studentName.toLowerCase().includes(search) ||
      student.studentId.toLowerCase().includes(search)
    );
  });

  const selectedClassName = useMemo(() => {
    const classItem = classes.find((item) => item.id === selectedClass);
    if (!classItem) return "";
    return `${classItem.code} - ${classItem.name} (${classItem.section})`;
  }, [classes, selectedClass]);

  const classAverage = studentGrades.length > 0
    ? Math.round(studentGrades.reduce((sum, item) => sum + item.overallGrade, 0) / studentGrades.length)
    : 0;
  const highestGrade = studentGrades.length > 0 ? Math.max(...studentGrades.map((item) => item.overallGrade)) : 0;
  const lowestGrade = studentGrades.length > 0 ? Math.min(...studentGrades.map((item) => item.overallGrade)) : 0;
  const passingRate = studentGrades.length > 0
    ? Math.round(
        (studentGrades.filter((item) => item.overallGrade >= 75).length /
          studentGrades.length) *
          100
      )
    : 0;

  if (loading) {
    return <LoadingScreen message="Loading grades..." />;
  }

  return (
    <div className="min-h-screen bg-gray-950 flex">
      <TeacherSidebar teacherName={teacherName} onLogout={handleLogoutClick} />

      <main className="flex-1 overflow-y-auto scrollbar-hide">
        <div className="bg-gray-900/60 border-b border-white/10 sticky top-0 z-20 relative">
          <div className="px-6 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <h2 className="text-xl font-semibold text-white">Grades Management</h2>
                {hasUnsavedChanges && <span className="text-sm text-red-600 font-medium">Unsaved changes</span>}
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
          <div className="bg-gradient-to-r from-emerald-600 to-teal-600 rounded-2xl p-8 text-white shadow-lg">
            <h1 className="text-3xl font-bold mb-2">Encode Student Grades</h1>
            <p className="text-emerald-50">Students are loaded from class enrollment assignments</p>
          </div>

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

          {saveSuccess && (
            <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4 flex items-center gap-3">
              <CheckCircle className="w-5 h-5 text-emerald-600" />
              <p className="text-emerald-700 font-medium">Grades saved successfully!</p>
            </div>
          )}

          <div className="bg-gray-900/60 rounded-xl p-6 border border-white/10 shadow-sm space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  <Filter className="w-4 h-4 inline mr-2" />
                  Select Subject / Section
                </label>
                {classes.length === 0 ? (
                  <div className="w-full px-4 py-3 border border-white/10 rounded-lg bg-black/20 text-gray-400 text-sm">
                    No classes available
                  </div>
                ) : (
                  <CustomSelect
                    value={selectedClass}
                    onChange={(value) => {
                      setSelectedClass(value);
                      setHasUnsavedChanges(false);
                    }}
                    placeholder="Select a class"
                    className="w-full"
                    options={classes.map((classItemOption) => ({
                      value: classItemOption.id,
                      label: `${classItemOption.code} - ${classItemOption.name} (${classItemOption.section})`
                    }))}
                  />
                )}
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
                disabled={!hasUnsavedChanges || !selectedClass || saving}
                className="flex items-center gap-2 px-6 py-3 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-all shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Save className="w-4 h-4" />
                {saving ? "Saving..." : "Save All Changes"}
              </button>
            </div>

            {filteredGrades.length === 0 ? (
              <div className="p-12 text-center">
                <Users className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-500">
                  {!selectedClass ? "Select a class to load students" : "No students enrolled"}
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
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
                    {filteredGrades.map((student) => (
                      <tr key={student.id} className="hover:bg-black/20">
                        <td className="px-6 py-4">
                          <p className="font-medium text-white">{student.studentName}</p>
                          <p className="text-xs text-gray-500">{student.studentId}</p>
                        </td>
                        <td className="px-6 py-4">
                          <input type="number" min="0" max="100" value={student.midtermGrade} onChange={(e) => handleGradeChange(student.id, "midtermGrade", e.target.value)} className="w-20 px-3 py-2 bg-black/20 text-white border border-white/20 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500" />
                        </td>
                        <td className="px-6 py-4">
                          <input type="number" min="0" max="100" value={student.finalGrade} onChange={(e) => handleGradeChange(student.id, "finalGrade", e.target.value)} className="w-20 px-3 py-2 bg-black/20 text-white border border-white/20 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500" />
                        </td>
                        <td className="px-6 py-4">
                          <input type="number" min="0" max="100" value={student.quizAverage} onChange={(e) => handleGradeChange(student.id, "quizAverage", e.target.value)} className="w-20 px-3 py-2 bg-black/20 text-white border border-white/20 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500" />
                        </td>
                        <td className="px-6 py-4">
                          <input type="number" min="0" max="100" value={student.projectGrade} onChange={(e) => handleGradeChange(student.id, "projectGrade", e.target.value)} className="w-20 px-3 py-2 bg-black/20 text-white border border-white/20 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500" />
                        </td>
                        <td className="px-6 py-4">
                          <span className="px-3 py-1 rounded-full text-sm font-bold bg-emerald-50 text-emerald-600">{student.overallGrade}%</span>
                        </td>
                        <td className="px-6 py-4">
                          <span className="px-3 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-700">{student.remarks}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}

export { GradesManagement };
