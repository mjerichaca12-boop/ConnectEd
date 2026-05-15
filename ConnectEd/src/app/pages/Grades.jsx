import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Sidebar } from "@/app/components/Sidebar";
import { CustomSelect } from "@/app/components/CustomSelect";
import { supabase } from "@/app/lib/supabaseClient";
import {
  TrendingUp,
  TrendingDown,
  Award,
  Filter,
  Download,
  FileText,
  CheckCircle,
  AlertCircle,
  Target,
  BookOpen
} from "lucide-react";

function Grades() {
  const navigate = useNavigate();
  const [studentName, setStudentName] = useState("");
  const [studentId, setStudentId] = useState("");
  const [loading, setLoading] = useState(true);
  const [selectedFilter, setSelectedFilter] = useState("all");
  const [grades, setGrades] = useState([]);
  const [subjects, setSubjects] = useState([]);

  const getGradeRemarks = (overallGrade) => {
    if (overallGrade >= 90) return "Outstanding";
    if (overallGrade >= 85) return "Excellent";
    if (overallGrade >= 80) return "Very Good";
    if (overallGrade >= 75) return "Good";
    return "Needs Improvement";
  };

  const fetchGradesData = useCallback(async (currentStudentId) => {
    try {
      // 1. Fetch subject enrollments
      const { data: assignments, error: assignError } = await supabase
        .from("teacher_student_assignments")
        .select("subject_id, subjects(id, code, name, section)")
        .eq("student_id", currentStudentId);

      if (assignError) throw assignError;

      const subjectList = assignments.map(a => a.subjects);
      setSubjects(subjectList);

      // 2. Fetch term grades from teacher_student_grades
      const { data: summaryGrades, error: summaryError } = await supabase
        .from("teacher_student_grades")
        .select("*")
        .eq("student_id", currentStudentId);

      if (summaryError) throw summaryError;

      // 3. Fetch assessment-specific grades
      const { data: assessmentGrades, error: assessError } = await supabase
        .from("teacher_assessment_grades")
        .select("*, subjects(code, name)")
        .eq("student_id", currentStudentId);

      if (assessError) throw assessError;

      // Combine and normalize
      const combinedGrades = [];

      // Add term summary rows
      summaryGrades.forEach(sg => {
        const subject = subjectList.find(s => s.id === sg.subject_id);
        if (!subject) return;

        if (sg.term1_grade > 0) {
          combinedGrades.push({
            id: `sg-t1-${sg.id}`,
            subjectId: sg.subject_id,
            subjectCode: subject.code,
            subjectName: subject.name,
            gradeType: "Term 1 Final",
            designation: "Exam",
            term: "Term 1",
            grade: sg.term1_grade,
            maxGrade: 100,
            remarks: getGradeRemarks(sg.term1_grade),
            dateRecorded: sg.updated_at || sg.created_at
          });
        }
        if (sg.term2_grade > 0) {
          combinedGrades.push({
            id: `sg-t2-${sg.id}`,
            subjectId: sg.subject_id,
            subjectCode: subject.code,
            subjectName: subject.name,
            gradeType: "Term 2 Final",
            designation: "Exam",
            term: "Term 2",
            grade: sg.term2_grade,
            maxGrade: 100,
            remarks: getGradeRemarks(sg.term2_grade),
            dateRecorded: sg.updated_at || sg.created_at
          });
        }
        if (sg.term3_grade > 0) {
          combinedGrades.push({
            id: `sg-t3-${sg.id}`,
            subjectId: sg.subject_id,
            subjectCode: subject.code,
            subjectName: subject.name,
            gradeType: "Term 3 Final",
            designation: "Exam",
            term: "Term 3",
            grade: sg.term3_grade,
            maxGrade: 100,
            remarks: getGradeRemarks(sg.term3_grade),
            dateRecorded: sg.updated_at || sg.created_at
          });
        }
      });

      // Add assessment detail rows
      assessmentGrades.forEach(ag => {
        combinedGrades.push({
          id: ag.id,
          subjectId: ag.subject_id,
          subjectCode: ag.subjects?.code || "N/A",
          subjectName: ag.subjects?.name || "N/A",
          gradeType: ag.assessment_title || "Assessment",
          designation: ag.designation || (ag.assessment_type === 'quiz' ? 'Quiz' : 'Activity'),
          term: ag.term || "Term 1",
          grade: ag.grade_value,
          maxGrade: ag.max_points || 100,
          remarks: ag.status || "Graded",
          dateRecorded: ag.updated_at || ag.created_at
        });
      });

      setGrades(combinedGrades);
    } catch (err) {
      console.error("Error loading grades:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const userData = localStorage.getItem("currentUser");
    if (!userData) {
      navigate("/login");
      return;
    }
    const user = JSON.parse(userData);
    if (user.role !== "student") {
      navigate("/login");
      return;
    }
    setStudentName(user.name);
    setStudentId(user.id);
    fetchGradesData(user.id);
  }, [navigate, fetchGradesData]);

  const handleLogout = () => {
    localStorage.removeItem("currentUser");
    navigate("/login");
  };

  const handleExportGrades = () => {
    const header = ["Subject Code", "Subject Name", "Term", "Designation", "Type", "Grade", "Max Grade", "Remarks", "Date Recorded"];
    const rows = filteredGrades.map((g) => [
      g.subjectCode,
      g.subjectName,
      g.term,
      g.designation,
      g.gradeType,
      String(g.grade),
      String(g.maxGrade),
      g.remarks,
      g.dateRecorded
    ]);
    const csv = [header, ...rows].map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `Grades_Report_${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const filteredGrades = grades.filter(g => {
    if (selectedFilter === "all") return true;
    if (selectedFilter === "term1") return g.term === "Term 1";
    if (selectedFilter === "term2") return g.term === "Term 2";
    if (selectedFilter === "term3") return g.term === "Term 3";
    if (selectedFilter === "quiz") return g.designation === "Quiz";
    if (selectedFilter === "activity") return g.designation === "Activity";
    if (selectedFilter === "assignment") return g.designation === "Assignment";
    if (selectedFilter === "exam") return g.designation === "Exam";
    return true;
  });

  const averageGrade = filteredGrades.length > 0 ? Math.round(filteredGrades.reduce((sum, g) => sum + (g.grade / g.maxGrade * 100), 0) / filteredGrades.length) : 0;
  const highestGrade = filteredGrades.length > 0 ? Math.round(Math.max(...filteredGrades.map((g) => g.grade / g.maxGrade * 100))) : 0;
  const lowestGrade = filteredGrades.length > 0 ? Math.round(Math.min(...filteredGrades.map((g) => g.grade / g.maxGrade * 100))) : 0;

  const gradesBySubject = filteredGrades.reduce((acc, grade) => {
    if (!acc[grade.subjectCode]) {
      acc[grade.subjectCode] = {
        subjectName: grade.subjectName,
        grades: []
      };
    }
    acc[grade.subjectCode].grades.push(grade);
    return acc;
  }, {});

  const getGradeColor = (grade, max) => {
    const percentage = (grade / max) * 100;
    if (percentage >= 90) return "text-emerald-600 bg-emerald-50";
    if (percentage >= 80) return "text-blue-600 bg-blue-50";
    if (percentage >= 75) return "text-blue-500 bg-blue-50";
    return "text-red-600 bg-red-50";
  };

  const getRemarksBadge = (remarks) => {
    const r = String(remarks).toLowerCase();
    if (r.includes("outstanding") || r.includes("passed")) return "bg-emerald-100 text-emerald-700";
    if (r.includes("excellent") || r.includes("graded")) return "bg-blue-100 text-blue-700";
    if (r.includes("good") || r.includes("returned")) return "bg-emerald-50 text-emerald-600";
    if (r.includes("needs improvement") || r.includes("failed")) return "bg-red-100 text-red-700";
    return "bg-gray-100 text-gray-700";
  };

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-600">Loading your grades...</p>
        </div>
      </div>;
  }

  return <div className="min-h-screen bg-gray-50 flex">
      <Sidebar studentName={studentName} onLogout={handleLogout} />

      <main className="flex-1 overflow-y-auto scrollbar-hide lg:pl-64">
        {/* Top Bar */}
        <div className="bg-white border-b border-gray-200 sticky top-0 z-20">
          <div className="px-6 py-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-semibold text-green-900">Academic Records</h2>
              </div>
              <div className="flex items-center gap-4">
                 <span className="text-sm text-gray-500 hidden md:block">School Year 2026-2027</span>
              </div>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Header Section */}
          <div className="bg-gradient-to-r from-emerald-600 to-teal-600 rounded-2xl p-8 text-white shadow-lg relative overflow-hidden">
            <div className="absolute top-0 right-0 p-8 opacity-10">
                <BookOpen className="w-32 h-32" />
            </div>
            <div className="relative z-10">
                <h1 className="text-3xl font-bold mb-2">Academic Performance</h1>
                <p className="text-emerald-50">View your progress across all terms and assessments</p>
            </div>
          </div>

          {/* Statistics Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-white rounded-xl p-6 border border-gray-200 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <div className="p-3 bg-emerald-50 rounded-lg">
                  <Award className="w-6 h-6 text-emerald-600" />
                </div>
              </div>
              <p className="text-gray-600 text-sm mb-1">Overall Average</p>
              <p className="text-3xl font-bold text-green-900">{averageGrade}%</p>
              <p className="text-emerald-600 text-sm mt-2 flex items-center gap-1">
                <TrendingUp className="w-4 h-4" />
                {averageGrade >= 75 ? "Consistent progress" : "Keep pushing forward"}
              </p>
            </div>

            <div className="bg-white rounded-xl p-6 border border-gray-200 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <div className="p-3 bg-blue-50 rounded-lg">
                  <Target className="w-6 h-6 text-blue-600" />
                </div>
              </div>
              <p className="text-gray-600 text-sm mb-1">Highest Score</p>
              <p className="text-3xl font-bold text-green-900">{highestGrade}%</p>
              <p className="text-gray-500 text-sm mt-2">Peak performance</p>
            </div>

            <div className="bg-white rounded-xl p-6 border border-gray-200 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <div className="p-3 bg-red-50 rounded-lg">
                  <TrendingDown className="w-6 h-6 text-red-600" />
                </div>
              </div>
              <p className="text-gray-600 text-sm mb-1">Lowest Score</p>
              <p className="text-3xl font-bold text-green-900">{lowestGrade}%</p>
              <p className="text-gray-500 text-sm mt-2">Area for growth</p>
            </div>
          </div>

          {/* Filter and Export */}
          <div className="flex items-center justify-between gap-4 flex-wrap bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
            <div className="w-full md:w-80">
              <CustomSelect
                value={selectedFilter}
                onChange={setSelectedFilter}
                options={[
                  { value: "all", label: "All Terms & Types", icon: <FileText className="w-5 h-5 text-gray-500" /> },
                  { value: "term1", label: "Term 1", icon: <CheckCircle className="w-5 h-5 text-emerald-500" /> },
                  { value: "term2", label: "Term 2", icon: <CheckCircle className="w-5 h-5 text-emerald-500" /> },
                  { value: "term3", label: "Term 3", icon: <CheckCircle className="w-5 h-5 text-emerald-500" /> },
                  { value: "quiz", label: "Quizzes Only", icon: <AlertCircle className="w-5 h-5 text-blue-500" /> },
                  { value: "activity", label: "Activities Only", icon: <Award className="w-5 h-5 text-orange-500" /> },
                  { value: "assignment", label: "Assignments Only", icon: <Target className="w-5 h-5 text-purple-500" /> },
                  { value: "exam", label: "Exams Only", icon: <Award className="w-5 h-5 text-red-500" /> }
                ]}
                icon={<Filter className="w-5 h-5 text-gray-400" />}
                placeholder="Filter by term or type"
              />
            </div>

            <button
                onClick={handleExportGrades}
                className="flex items-center gap-2 px-6 py-2.5 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 transition-all shadow-sm font-medium"
            >
              <Download className="w-4 h-4" />
              Download Report
            </button>
          </div>

          {/* Grades by Subject */}
          <div className="space-y-8">
            {Object.entries(gradesBySubject).length === 0 ? (
                <div className="bg-white rounded-2xl p-12 border border-dashed border-gray-300 text-center">
                    <AlertCircle className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-green-900">No grades found</h3>
                    <p className="text-gray-500">Records will appear once your teachers have posted them.</p>
                </div>
            ) : (
                Object.entries(gradesBySubject).map(([subjectCode, data]) => {
                    const subjectAverage = Math.round(
                      data.grades.reduce((sum, g) => sum + (g.grade / g.maxGrade * 100), 0) / data.grades.length
                    );
                    return <div key={subjectCode} className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
                        <div className="bg-gradient-to-r from-emerald-50 to-teal-50 px-6 py-5 border-b border-gray-200">
                            <div className="flex items-center justify-between">
                            <div>
                                <h3 className="text-lg font-bold text-green-900">{data.subjectName}</h3>
                                <p className="text-sm font-medium text-emerald-700">{subjectCode}</p>
                            </div>
                            <div className="text-right">
                                <p className="text-xs text-gray-500 uppercase tracking-wider font-semibold mb-1">Subject Average</p>
                                <p className="text-3xl font-bold text-green-600">{subjectAverage}%</p>
                            </div>
                            </div>
                        </div>

                        <div className="overflow-x-auto">
                            <table className="w-full">
                            <thead className="bg-gray-50">
                                <tr>
                                <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Term</th>
                                <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Category</th>
                                <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Title/Assessment</th>
                                <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider text-center">Score</th>
                                <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Status</th>
                                <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Date</th>
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-100">
                                {data.grades.map((grade) => <tr key={grade.id} className="hover:bg-gray-50 transition-colors">
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full uppercase">
                                            {grade.term}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <span className={`text-xs font-bold px-2.5 py-1 rounded-full uppercase ${
                                            grade.designation === 'Quiz' ? 'bg-blue-50 text-blue-700' :
                                            grade.designation === 'Exam' ? 'bg-red-50 text-red-700' :
                                            grade.designation === 'Assignment' ? 'bg-purple-50 text-purple-700' :
                                            'bg-orange-50 text-orange-700'
                                        }`}>
                                            {grade.designation}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4">
                                    <span className="text-sm font-semibold text-green-900">{grade.gradeType}</span>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-center">
                                    <div className="flex flex-col items-center">
                                        <span className={`px-4 py-1.5 rounded-xl text-sm font-bold ${getGradeColor(grade.grade, grade.maxGrade)}`}>
                                        {grade.grade} / {grade.maxGrade}
                                        </span>
                                        <span className="text-[10px] text-gray-400 mt-1 font-medium">{Math.round((grade.grade/grade.maxGrade)*100)}%</span>
                                    </div>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                    <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-tight ${getRemarksBadge(grade.remarks)}`}>
                                        {grade.remarks}
                                    </span>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 font-medium">
                                    {new Date(grade.dateRecorded).toLocaleDateString("en-US", {
                                        month: "short",
                                        day: "numeric",
                                        year: "numeric"
                                    })}
                                    </td>
                                </tr>)}
                            </tbody>
                            </table>
                        </div>
                        </div>;
                })
            )}
          </div>
        </div>
      </main>
    </div>;
}

export {
  Grades
};

