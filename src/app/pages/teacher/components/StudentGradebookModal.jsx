import { X, Calendar, FileText, CheckCircle, AlertCircle, Clock } from "lucide-react";
import React from "react";

export function StudentGradebookModal({
  student,
  assessmentItems,
  submissions,
  onClose,
  grades
}) {
  if (!student) return null;

  // Separate activities into submitted and missing
  const submittedActivities = [];
  const missingActivities = [];

  assessmentItems.forEach((activity) => {
    const submission = submissions?.[activity.id];
    const grade = grades?.[activity.id];

    const mappedActivity = {
      ...activity,
      score: grade?.score,
      status: submission?.status || "Not Submitted",
      submitted_at: submission?.submitted_at,
      content: submission?.content,
      attachment: submission?.files?.[0]
    };

    if (submission) {
      submittedActivities.push(mappedActivity);
    } else {
      missingActivities.push(mappedActivity);
    }
  });

  // Sort activities by date
  submittedActivities.sort((a, b) => new Date(b.submitted_at || 0) - new Date(a.submitted_at || 0));
  missingActivities.sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));

  // Compute averages
  const calculateAverage = (type) => {
    const filtered = assessmentItems.filter(a => {
      const aType = String(a.type || a.task_type || a.assessment_type || "Activity").toLowerCase();
      return aType.includes(type.toLowerCase());
    });
    if (filtered.length === 0) return 0;
    
    let totalScore = 0;
    filtered.forEach(a => {
      const grade = grades?.[a.id];
      totalScore += Number(grade?.score || 0);
    });
    return Math.round(totalScore / filtered.length);
  };

  const quizAvg = calculateAverage("quiz");
  const assignmentAvg = calculateAverage("assignment");
  const seatworkAvg = calculateAverage("seatwork") || calculateAverage("activity");

  const overallGrade = grades?.overallGrade || 0;

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
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-emerald-50 rounded-xl p-4 border border-emerald-100">
              <p className="text-emerald-600 text-xs font-medium uppercase tracking-wider mb-1">Overall Grade</p>
              <div className="text-2xl font-bold text-emerald-900">{overallGrade}%</div>
            </div>
            <div className="bg-violet-50 rounded-xl p-4 border border-violet-100">
              <p className="text-violet-600 text-xs font-medium uppercase tracking-wider mb-1">Quizzes Avg</p>
              <div className="text-2xl font-bold text-violet-900">{quizAvg}</div>
            </div>
            <div className="bg-blue-50 rounded-xl p-4 border border-blue-100">
              <p className="text-blue-600 text-xs font-medium uppercase tracking-wider mb-1">Assignments Avg</p>
              <div className="text-2xl font-bold text-blue-900">{assignmentAvg}</div>
            </div>
            <div className="bg-orange-50 rounded-xl p-4 border border-orange-100">
              <p className="text-orange-600 text-xs font-medium uppercase tracking-wider mb-1">Seatworks Avg</p>
              <div className="text-2xl font-bold text-orange-900">{seatworkAvg}</div>
            </div>
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
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-red-100 text-red-700 text-xs font-medium">
                        Not Submitted
                      </span>
                      <div className="text-sm font-medium text-gray-900 mt-2">
                        0 / {activity.total_points || 100} pts
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Submitted Activities */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
              <CheckCircle className="w-5 h-5 text-emerald-500" />
              Submitted Activities
              <span className="bg-emerald-100 text-emerald-700 text-xs py-0.5 px-2 rounded-full font-medium">
                {submittedActivities.length}
              </span>
            </h3>
            
            {submittedActivities.length === 0 ? (
              <div className="p-8 text-center border-2 border-dashed border-gray-200 rounded-2xl bg-gray-50">
                <p className="text-gray-500">No submitted activities found.</p>
              </div>
            ) : (
              <div className="grid gap-3">
                {submittedActivities.map((activity) => (
                  <div key={activity.id} className="flex items-center justify-between p-4 rounded-xl border border-gray-200 bg-white shadow-sm">
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
                            Submitted: {new Date(activity.submitted_at).toLocaleDateString()}
                          </span>
                        </div>
                        {activity.content && (
                          <p className="text-sm text-gray-600 mt-2 bg-gray-50 p-2 rounded-lg border border-gray-100 max-w-xl truncate">
                            {activity.content}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-emerald-50 text-emerald-700 text-xs font-medium border border-emerald-200">
                        Submitted
                      </span>
                      <div className="text-sm font-medium text-gray-900 mt-2">
                        {activity.score != null ? (
                          <span className="text-emerald-600">{activity.score}</span>
                        ) : (
                          <span className="text-gray-400">Needs Grading</span>
                        )}
                        <span className="text-gray-400"> / {activity.total_points || 100} pts</span>
                      </div>
                    </div>
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
