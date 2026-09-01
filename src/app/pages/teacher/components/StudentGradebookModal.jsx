import { X, Calendar, FileText, CheckCircle, AlertCircle, Clock, MessageSquare, ChevronDown, ChevronUp } from "lucide-react";
import React, { useMemo, useState } from "react";
import { computeDepEdStudentComputation, normalizeSubjectCategory } from "@/app/lib/depedGrading";

export function StudentGradebookModal({
  student,
  assessmentItems,
  submissions,
  onClose,
  grades,        // assessmentGradesMap: { assessmentId: { studentId: gradeValue } }
  statusMap,     // assessmentStatusMap: { assessmentId: { studentId: status } }
  feedbackMap,   // assessmentFeedbackMap: { assessmentId: { studentId: feedbackText } }
  studentOverallGrades,
  subjectCategory,
  gradingSettingsByCategory
}) {
  const [showComputation, setShowComputation] = useState(false);
  const studentId = student?.id || "";
  const studentName = student?.studentName || "";

  const resolvedSubjectCategory = normalizeSubjectCategory(subjectCategory || studentOverallGrades?.subjectCategory || "", studentName);
  const computation = useMemo(() => computeDepEdStudentComputation({
    assessmentItems,
    assessmentGradesMap: grades,
    assessmentStatusMap: statusMap,
    studentId,
    subjectCategory: resolvedSubjectCategory,
    gradingSettingsByCategory,
  }), [assessmentItems, grades, gradingSettingsByCategory, resolvedSubjectCategory, studentId, statusMap]);

  // Separate activities into submitted/graded and missing
  const submittedActivities = [];
  const missingActivities = [];

  assessmentItems.forEach((activity) => {
    const submission = submissions?.[activity.id]?.[student.id];
    const grade = grades?.[activity.id]?.[student.id];
    const status = statusMap?.[activity.id]?.[student.id] || submission?.status;
    const feedback = feedbackMap?.[activity.id]?.[student.id] || "";

    const isPlaceholder = submission?.responseText?.startsWith("Placeholder submission");
    const mappedActivity = {
      ...activity,
      score: grade,
      status: statusMap?.[activity.id]?.[student.id] || submission?.status || "Not Submitted",
      submitted_at: isPlaceholder ? null : submission?.submittedAt,
      content: isPlaceholder ? null : submission?.responseText,
      attachment: submission?.fileUrl ? { url: submission.fileUrl, name: submission.fileName } : null,
      feedback,
      isPlaceholder,
    };

    // Show in submitted if there's a submission OR a grade/status saved
    if (submission || (grade !== undefined && grade !== null) || (status && status !== "Not Submitted")) {
      submittedActivities.push(mappedActivity);
    } else {
      missingActivities.push(mappedActivity);
    }
  });

  // Sort activities by date
  submittedActivities.sort((a, b) => new Date(b.submitted_at || 0) - new Date(a.submitted_at || 0));
  missingActivities.sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));

  // Compute averages using the nested grades map
  const calculateAverage = (type) => {
    const filtered = assessmentItems.filter(a => {
      const aType = String(a.type || a.task_type || a.assessment_type || "Activity").toLowerCase();
      return aType.includes(type.toLowerCase());
    });
    if (filtered.length === 0) return 0;
    
    let totalScore = 0;
    let count = 0;
    filtered.forEach(a => {
      const grade = grades?.[a.id]?.[student.id];
      if (grade !== undefined && grade !== null && grade !== "") {
        totalScore += Number(grade || 0);
        count++;
      }
    });
    return count > 0 ? Math.round(totalScore / count) : 0;
  };

  const quizAvg = calculateAverage("quiz");
  const assignmentAvg = calculateAverage("assignment");
  const seatworkAvg = calculateAverage("seatwork") || calculateAverage("activity");

  if (!student) return null;

  const overallGrade = studentOverallGrades?.overallGrade || computation.finalGrade || 0;
  const quarterRows = [1, 2, 3, 4].map((quarterNumber) => {
    const summary = computation.quarters[`quarter${quarterNumber}`];
    return {
      quarterNumber,
      summary,
    };
  });

  const getStatusStyle = (status) => {
    switch (status) {
      case "Returned": return "bg-blue-50 text-blue-700 border-blue-200";
      case "Graded": return "bg-emerald-50 text-emerald-700 border-emerald-200";
      case "Passed": return "bg-emerald-50 text-emerald-700 border-emerald-200";
      case "Failed": return "bg-red-50 text-red-700 border-red-200";
      case "Submitted": return "bg-yellow-50 text-yellow-700 border-yellow-200";
      default: return "bg-gray-50 text-gray-600 border-gray-200";
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl w-full max-w-4xl max-h-[90vh] shadow-2xl flex flex-col border border-gray-100 overflow-hidden">
        
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-100 bg-gray-50/50">
          <div>
            <h2 className="text-xl font-bold text-gray-900">{student.studentName}</h2>
            <p className="text-sm text-gray-500 mt-1">
              LRN: {student.lrn || "N/A"} • Auto-Generated Gradebook
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-xl transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-8">
          
          {/* Summary Cards */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <div className="bg-emerald-50 rounded-xl p-4 border border-emerald-100">
              <p className="text-emerald-600 text-xs font-medium uppercase tracking-wider mb-1">Overall Grade</p>
              <div className="text-2xl font-bold text-emerald-900">{overallGrade}%</div>
            </div>
            <div className="bg-blue-50 rounded-xl p-4 border border-blue-100">
              <p className="text-blue-600 text-xs font-medium uppercase tracking-wider mb-1">Quarter 1</p>
              <div className="text-2xl font-bold text-blue-900">{computation.quarters.quarter1.quarterlyGrade}%</div>
            </div>
            <div className="bg-violet-50 rounded-xl p-4 border border-violet-100">
              <p className="text-violet-600 text-xs font-medium uppercase tracking-wider mb-1">Quarter 2</p>
              <div className="text-2xl font-bold text-violet-900">{computation.quarters.quarter2.quarterlyGrade}%</div>
            </div>
            <div className="bg-orange-50 rounded-xl p-4 border border-orange-100">
              <p className="text-orange-600 text-xs font-medium uppercase tracking-wider mb-1">Quarter 3</p>
              <div className="text-2xl font-bold text-orange-900">{computation.quarters.quarter3.quarterlyGrade}%</div>
            </div>
            <div className="bg-cyan-50 rounded-xl p-4 border border-cyan-100">
              <p className="text-cyan-600 text-xs font-medium uppercase tracking-wider mb-1">Quarter 4</p>
              <div className="text-2xl font-bold text-cyan-900">{computation.quarters.quarter4.quarterlyGrade}%</div>
            </div>
          </div>

          <div className="bg-gray-50 rounded-xl border border-gray-200 p-4">
            <button
              type="button"
              onClick={() => setShowComputation((value) => !value)}
              className="w-full flex items-center justify-between gap-3 text-left"
            >
              <div>
                <p className="text-sm font-semibold text-gray-900">View Grade Computation</p>
                <p className="text-xs text-gray-500 mt-1">{resolvedSubjectCategory} • Written Works {computation.quarters.quarter1.weights.writtenWorksWeight}% / Performance Tasks {computation.quarters.quarter1.weights.performanceTasksWeight}%</p>
              </div>
              {showComputation ? <ChevronUp className="w-5 h-5 text-gray-500" /> : <ChevronDown className="w-5 h-5 text-gray-500" />}
            </button>

            {showComputation && (
              <div className="mt-4 overflow-x-auto">
                <table className="w-full text-xs md:text-sm border-separate border-spacing-y-2">
                  <thead>
                    <tr className="text-left text-gray-500 uppercase tracking-wider">
                      <th className="px-3 py-2">Quarter</th>
                      <th className="px-3 py-2">Written Works</th>
                      <th className="px-3 py-2">Performance Tasks</th>
                      <th className="px-3 py-2">Initial Grade</th>
                      <th className="px-3 py-2">Quarterly Grade</th>
                    </tr>
                  </thead>
                  <tbody>
                    {quarterRows.map(({ quarterNumber, summary }) => (
                      <tr key={quarterNumber} className="bg-white rounded-xl shadow-sm border border-gray-200">
                        <td className="px-3 py-3 font-semibold text-gray-900">Q{quarterNumber}</td>
                        <td className="px-3 py-3 text-gray-700">
                          <div className="font-medium">Raw {summary.writtenWorks.rawScore} / {summary.writtenWorks.highestScore}</div>
                          <div className="text-gray-500">{summary.writtenWorks.percentageScore}% • Weighted {summary.writtenWorks.weightedScore}</div>
                        </td>
                        <td className="px-3 py-3 text-gray-700">
                          <div className="font-medium">Raw {summary.performanceTasks.rawScore} / {summary.performanceTasks.highestScore}</div>
                          <div className="text-gray-500">{summary.performanceTasks.percentageScore}% • Weighted {summary.performanceTasks.weightedScore}</div>
                        </td>
                        <td className="px-3 py-3 font-semibold text-gray-900">{summary.initialGrade}</td>
                        <td className="px-3 py-3 font-semibold text-emerald-700">{summary.quarterlyGrade}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Missing Activities */}
          {missingActivities.length > 0 && (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                <AlertCircle className="w-5 h-5 text-red-500" />
                Missing Activities
                <span className="bg-red-100 text-red-700 text-xs py-0.5 px-2 rounded-full font-medium">
                  {missingActivities.length}
                </span>
              </h3>
              <div className="grid gap-3">
                {missingActivities.map((activity) => (
                  <div key={activity.id} className="flex items-center justify-between p-4 rounded-xl border border-red-100 bg-red-50/30">
                    <div className="flex items-start gap-3">
                      <div className="p-2 bg-red-100 text-red-600 rounded-lg">
                        <FileText className="w-4 h-4" />
                      </div>
                      <div>
                        <h4 className="font-medium text-gray-900">{activity.title || "Untitled Activity"}</h4>
                        <div className="flex items-center gap-3 text-sm text-gray-500 mt-1">
                          <span className="capitalize">{activity.type || activity.task_type || activity.assessment_type || "Activity"}</span>
                          {activity.due_date && (
                            <span className="flex items-center gap-1">
                              <Calendar className="w-3.5 h-3.5" />
                              Due: {new Date(activity.due_date).toLocaleDateString()}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-red-100 text-red-700 text-xs font-medium border border-red-200">
                        Not Submitted
                      </span>
                      <div className="text-sm font-medium text-gray-900 mt-2">
                        0 / {activity.maxPoints || activity.total_points || 100} pts
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Submitted / Graded Activities */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
              <CheckCircle className="w-5 h-5 text-emerald-500" />
              Submitted &amp; Graded Activities
              <span className="bg-emerald-100 text-emerald-700 text-xs py-0.5 px-2 rounded-full font-medium">
                {submittedActivities.length}
              </span>
            </h3>
            
            {submittedActivities.length === 0 ? (
              <div className="p-8 text-center border-2 border-dashed border-gray-200 rounded-2xl bg-gray-50">
                <p className="text-gray-500">No submitted or graded activities found.</p>
              </div>
            ) : (
              <div className="grid gap-3">
                {submittedActivities.map((activity) => (
                  <div key={activity.id} className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
                    <div className="flex items-center justify-between p-4">
                      <div className="flex items-start gap-3">
                        <div className="p-2 bg-emerald-100 text-emerald-600 rounded-lg">
                          <CheckCircle className="w-4 h-4" />
                        </div>
                        <div>
                          <h4 className="font-medium text-gray-900">{activity.title || "Untitled Activity"}</h4>
                          <div className="flex items-center gap-3 text-sm text-gray-500 mt-1">
                            <span className="capitalize">{activity.type || activity.task_type || activity.assessment_type || "Activity"}</span>
                            <span className="flex items-center gap-1">
                              <Clock className="w-3.5 h-3.5" />
                              {activity.submitted_at
                                ? `Submitted: ${new Date(activity.submitted_at).toLocaleDateString()}`
                                : activity.isPlaceholder
                                  ? "Not submitted"
                                  : "Not submitted (Graded/Returned)"}
                            </span>
                          </div>
                          {activity.content && (
                            <p className="text-sm text-gray-600 mt-2 bg-gray-50 p-2 rounded-lg border border-gray-100 max-w-xl truncate">
                              {activity.content}
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="text-right shrink-0 ml-4">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium border ${getStatusStyle(activity.status)}`}>
                          {activity.status}
                        </span>
                        <div className="text-sm font-medium text-gray-900 mt-2">
                          {activity.score != null && activity.score !== "" ? (
                            <span className="text-emerald-600 font-semibold">{activity.score}</span>
                          ) : (
                            <span className="text-gray-400">Needs Grading</span>
                          )}
                          <span className="text-gray-400"> / {activity.maxPoints || activity.total_points || 100} pts</span>
                        </div>
                      </div>
                    </div>

                    {/* Feedback section */}
                    {activity.feedback && (
                      <div className="px-4 pb-4 border-t border-gray-100 bg-blue-50/30 pt-3">
                        <div className="flex items-start gap-2">
                          <MessageSquare className="w-3.5 h-3.5 text-blue-500 mt-0.5 shrink-0" />
                          <div>
                            <p className="text-[11px] text-blue-500 font-medium uppercase tracking-wider mb-1">Teacher Feedback</p>
                            <p className="text-sm text-gray-700">{activity.feedback}</p>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

        </div>
      </div>
    </div>
  );
}
