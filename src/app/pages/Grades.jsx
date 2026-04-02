import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Sidebar } from "@/app/components/Sidebar";
import { CustomSelect } from "@/app/components/admin/CustomSelect";
import {
  TrendingUp,
  TrendingDown,
  Award,
  Filter,
  Download,
  FileText,
  CheckCircle,
  AlertCircle,
  Target
} from "lucide-react";
function Grades() {
  const navigate = useNavigate();
  const [studentName, setStudentName] = useState("");
  const [loading, setLoading] = useState(true);
  const [selectedFilter, setSelectedFilter] = useState("all");
  const [grades] = useState([]);
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
    setTimeout(() => setLoading(false), 600);
  }, [navigate]);
  const handleLogout = () => {
    localStorage.removeItem("currentUser");
    navigate("/login");
  };
  const handleExportGrades = () => {
    const header = ["Subject Code", "Subject Name", "Type", "Grade", "Max Grade", "Remarks", "Date Recorded"];
    const rows = grades.map((g) => [
      g.subjectCode,
      g.subjectName,
      g.gradeType,
      String(g.grade),
      String(g.maxGrade),
      g.remarks,
      g.dateRecorded
    ]);
    const csv = [header, ...rows].map((row) => row.map((cell) => `"${cell.replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "grades-report.csv";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };
  const averageGrade = grades.length > 0 ? Math.round(grades.reduce((sum, g) => sum + g.grade, 0) / grades.length) : 0;
  const highestGrade = grades.length > 0 ? Math.max(...grades.map((g) => g.grade)) : 0;
  const lowestGrade = grades.length > 0 ? Math.min(...grades.map((g) => g.grade)) : 0;
  const gradesBySubject = grades.reduce((acc, grade) => {
    if (!acc[grade.subjectCode]) {
      acc[grade.subjectCode] = {
        subjectName: grade.subjectName,
        grades: []
      };
    }
    acc[grade.subjectCode].grades.push(grade);
    return acc;
  }, {});
  const getGradeColor = (grade) => {
    if (grade >= 90) return "text-emerald-600 bg-emerald-50";
    if (grade >= 80) return "text-blue-600 bg-blue-50";
    if (grade >= 75) return "text-blue-500 bg-blue-50";
    return "text-red-600 bg-red-50";
  };
  const getRemarksBadge = (remarks) => {
    const colors = {
      "Outstanding": "bg-emerald-100 text-emerald-700",
      "Excellent": "bg-blue-100 text-blue-700",
      "Very Good": "bg-emerald-50 text-emerald-600",
      "Good": "bg-emerald-50 text-emerald-600",
      "Fair": "bg-blue-50 text-blue-600"
    };
    return colors[remarks] || "bg-gray-100 text-gray-700";
  };
  if (loading) {
    return <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-600">Loading grades...</p>
        </div>
      </div>;
  }
  return <div className="min-h-screen bg-gray-50 flex">
      <Sidebar studentName={studentName} onLogout={handleLogout} />

      <main className="flex-1 overflow-y-auto scrollbar-hide">
        {
    /* Top Bar */
  }
        <div className="bg-white border-b border-gray-200 sticky top-0 z-20">
          <div className="px-6 py-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-semibold text-gray-900">Grades</h2>
              </div>
              <div className="flex items-center gap-4" />
            </div>
          </div>
        </div>

        {
    /* Content */
  }
        <div className="p-6 space-y-6">
          {
    /* Header Section */
  }
          <div className="bg-gradient-to-r from-emerald-600 to-teal-600 rounded-2xl p-8 text-white shadow-lg">
            <h1 className="text-3xl font-bold mb-2">Academic Performance</h1>
            <p className="text-emerald-50">1st Quarter 2026</p>
          </div>

          {
    /* Statistics Cards */
  }
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-white rounded-xl p-6 border border-gray-200 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <div className="p-3 bg-emerald-50 rounded-lg">
                  <Award className="w-6 h-6 text-emerald-600" />
                </div>
              </div>
              <p className="text-gray-600 text-sm mb-1">Average Grade</p>
              <p className="text-3xl font-bold text-gray-900">{averageGrade}%</p>
              <p className="text-emerald-600 text-sm mt-2 flex items-center gap-1">
                <TrendingUp className="w-4 h-4" />
                Excellent performance
              </p>
            </div>

            <div className="bg-white rounded-xl p-6 border border-gray-200 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <div className="p-3 bg-blue-50 rounded-lg">
                  <TrendingUp className="w-6 h-6 text-blue-600" />
                </div>
              </div>
              <p className="text-gray-600 text-sm mb-1">Highest Grade</p>
              <p className="text-3xl font-bold text-gray-900">{highestGrade}%</p>
              <p className="text-gray-500 text-sm mt-2">Outstanding achievement</p>
            </div>

            <div className="bg-white rounded-xl p-6 border border-gray-200 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <div className="p-3 bg-red-50 rounded-lg">
                  <TrendingDown className="w-6 h-6 text-red-600" />
                </div>
              </div>
              <p className="text-gray-600 text-sm mb-1">Lowest Grade</p>
              <p className="text-3xl font-bold text-gray-900">{lowestGrade}%</p>
              <p className="text-gray-500 text-sm mt-2">Room for improvement</p>
            </div>
          </div>

          {
    /* Filter and Export */
  }
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div className="w-72">
              <CustomSelect
    value={selectedFilter}
    onChange={setSelectedFilter}
    options={[
      { value: "all", label: "All Grades", icon: <FileText className="w-5 h-5 text-gray-500" /> },
      { value: "midterm", label: "Midterm", icon: <CheckCircle className="w-5 h-5 text-blue-500" /> },
      { value: "final", label: "Final", icon: <Target className="w-5 h-5 text-emerald-500" /> },
      { value: "quiz", label: "Quiz", icon: <AlertCircle className="w-5 h-5 text-blue-500" /> },
      { value: "project", label: "Project", icon: <Award className="w-5 h-5 text-emerald-500" /> }
    ]}
    icon={<Filter className="w-5 h-5" />}
    placeholder="Filter grades"
  />
            </div>

            <button
    onClick={handleExportGrades}
    className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors shadow-sm hover:shadow-md"
  >
              <Download className="w-4 h-4" />
              Export Report
            </button>
          </div>

          {
    /* Grades by Subject */
  }
          <div className="space-y-6">
            {Object.entries(gradesBySubject).map(([subjectCode, data]) => {
    const subjectAverage = Math.round(
      data.grades.reduce((sum, g) => sum + g.grade, 0) / data.grades.length
    );
    return <div key={subjectCode} className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                  <div className="bg-gradient-to-r from-emerald-50 to-teal-50 px-6 py-4 border-b border-gray-200">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="text-lg font-semibold text-gray-900">{data.subjectName}</h3>
                        <p className="text-sm text-gray-600">{subjectCode}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm text-gray-600">Subject Average</p>
                        <p className="text-2xl font-bold text-emerald-600">{subjectAverage}%</p>
                      </div>
                    </div>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Type</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Grade</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Remarks</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date Recorded</th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {data.grades.map((grade) => <tr key={grade.id} className="hover:bg-gray-50 transition-colors">
                            <td className="px-6 py-4 whitespace-nowrap">
                              <span className="text-sm font-medium text-gray-900">{grade.gradeType}</span>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="flex items-center gap-2">
                                <span className={`px-3 py-1 rounded-full text-sm font-bold ${getGradeColor(grade.grade)}`}>
                                  {grade.grade}/{grade.maxGrade}
                                </span>
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <span className={`px-3 py-1 rounded-full text-xs font-medium ${getRemarksBadge(grade.remarks)}`}>
                                {grade.remarks}
                              </span>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
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
  })}
          </div>
        </div>
      </main>
    </div>;
}
export {
  Grades
};
