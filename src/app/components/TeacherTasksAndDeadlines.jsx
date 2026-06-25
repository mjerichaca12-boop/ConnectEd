import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { ClipboardCheck, Calendar, Clock, AlertCircle, CheckCircle, ChevronRight, FileText } from 'lucide-react';
import { supabase } from '@/app/lib/supabaseClient';

export function TeacherTasksAndDeadlines({ teacherId, assignedSubjects = [] }) {
  const navigate = useNavigate();
  const [assessments, setAssessments] = useState([]);
  const [submissions, setSubmissions] = useState([]);
  const [grades, setGrades] = useState([]);
  const [loading, setLoading] = useState(true);

  // Fetch initial data
  const fetchData = async () => {
    if (!teacherId || !assignedSubjects.length || !supabase) {
      setLoading(false);
      return;
    }

    try {
      const subjectIds = assignedSubjects.map(s => s.id);
      
      // 1. Fetch lessons for these subjects (only Published ones are considered 'active' classes)
      const { data: lessonsData, error: lessonsError } = await supabase
        .from('lessons')
        .select('id, subject_id, status')
        .in('subject_id', subjectIds)
        .eq('status', 'Published');
      
      const lessonIds = (lessonsData || []).map(l => String(l.id));

      let allTasks = [];
      if (lessonIds.length > 0) {
        // Fetch Assignments
        const { data: assignmentsData } = await supabase
          .from('assignments')
          .select('*')
          .in('lesson_id', lessonIds);
        
        // Fetch Quizzes
        const { data: quizzesData } = await supabase
          .from('quizzes')
          .select('*')
          .in('lesson_id', lessonIds);

        const mapTask = (task, type) => {
          const lesson = (lessonsData || []).find(l => String(l.id) === String(task.lesson_id));
          return {
            ...task,
            course_id: lesson ? lesson.subject_id : null,
            assessment_type: type,
            deadline: task.due_date // Map due_date to deadline
          };
        };

        allTasks = [
          ...(assignmentsData || []).map(a => mapTask(a, 'assignment')),
          ...(quizzesData || []).map(q => mapTask(q, 'quiz'))
        ];
      }

      setAssessments(allTasks);

      const assessmentIds = allTasks.map(a => String(a.id));

      if (assessmentIds.length > 0) {
        // 2. Fetch Submissions
        const { data: subsData, error: subsError } = await supabase
          .from('teacher_assessment_submissions')
          .select('id, assessment_id, student_id, status')
          .eq('teacher_id', teacherId)
          .in('assessment_id', assessmentIds);

        if (subsError) {
          console.error("Error fetching submissions:", subsError);
        } else {
          setSubmissions(subsData || []);
        }

        // 3. Fetch Grades
        const { data: gradesData, error: gradesError } = await supabase
          .from('teacher_assessment_grades')
          .select('id, assessment_id, student_id, status, grade_value')
          .eq('teacher_id', teacherId)
          .in('assessment_id', assessmentIds);

        if (gradesError) {
          console.error("Error fetching grades:", gradesError);
        } else {
          setGrades(gradesData || []);
        }
      } else {
        setSubmissions([]);
        setGrades([]);
      }
    } catch (err) {
      console.error("Failed to load Tasks & Deadlines data:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [teacherId, assignedSubjects]);

  // Real-time Subscriptions
  useEffect(() => {
    if (!teacherId || !supabase) return;
    
    let isMounted = true;
    
    const channel = supabase.channel(`teacher-tasks-${teacherId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'assignments' }, () => {
        if (isMounted) fetchData();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'quizzes' }, () => {
        if (isMounted) fetchData();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'teacher_assessment_submissions', filter: `teacher_id=eq.${teacherId}` }, () => {
        if (isMounted) fetchData();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'teacher_assessment_grades', filter: `teacher_id=eq.${teacherId}` }, () => {
        if (isMounted) fetchData();
      })
      .subscribe();

    return () => {
      isMounted = false;
      supabase.removeChannel(channel);
    };
  }, [teacherId, assignedSubjects]);

  const metrics = useMemo(() => {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const tomorrowStart = new Date(todayStart);
    tomorrowStart.setDate(tomorrowStart.getDate() + 1);
    const next7DaysEnd = new Date(todayStart);
    next7DaysEnd.setDate(next7DaysEnd.getDate() + 8); // up to 7 days from tomorrow

    let activeTotal = 0;
    let dueToday = 0;
    let upcoming = 0;
    let needsGrading = 0;

    assessments.forEach(task => {
      const isPast = task.deadline ? new Date(task.deadline) < now : false;
      if (!isPast) activeTotal++;

      if (task.deadline) {
        const d = new Date(task.deadline);
        if (d >= todayStart && d < tomorrowStart) {
          dueToday++;
        } else if (d >= tomorrowStart && d < next7DaysEnd) {
          upcoming++;
        }
      }
    });

    // Needs grading: Submissions that don't have a returned grade
    submissions.forEach(sub => {
      const grade = grades.find(g => String(g.assessment_id) === String(sub.assessment_id) && String(g.student_id) === String(sub.student_id));
      const gradeStatus = grade?.status?.toLowerCase() || 'pending';
      const subStatus = sub?.status?.toLowerCase() || 'pending';
      const hasGradeValue = grade?.grade_value !== null && grade?.grade_value !== undefined;
      
      // If the submission is not returned, and it's not graded, it needs grading.
      // We will count it as needing grading if there is no grade, or if the grade status is pending.
      if (gradeStatus !== 'returned' && subStatus !== 'returned' && (!hasGradeValue || gradeStatus === 'pending')) {
        needsGrading++;
      }
    });

    return { activeTotal, dueToday, upcoming, needsGrading };
  }, [assessments, submissions, grades]);

  const taskList = useMemo(() => {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const tomorrowStart = new Date(todayStart);
    tomorrowStart.setDate(tomorrowStart.getDate() + 1);

    return assessments
      .map(task => {
        const subsForTask = submissions.filter(s => String(s.assessment_id) === String(task.id));
        const gradesForTask = grades.filter(g => String(g.assessment_id) === String(task.id));
        
        const submissionCount = subsForTask.length;
        const gradedCount = gradesForTask.filter(g => {
            const stat = g.status?.toLowerCase();
            return stat === 'graded' || stat === 'returned' || (g.grade_value !== null && g.grade_value !== undefined && stat !== 'pending');
        }).length;
        
        let status = "Active";
        let statusColor = "text-blue-600 bg-blue-50 border-blue-200";

        if (task.deadline) {
          const d = new Date(task.deadline);
          if (d < now) {
            status = "Overdue";
            statusColor = "text-red-600 bg-red-50 border-red-200";
          } else if (d >= todayStart && d < tomorrowStart) {
            status = "Due Today";
            statusColor = "text-orange-600 bg-orange-50 border-orange-200";
          }
        }

        if (submissionCount > 0 && gradedCount === submissionCount) {
          status = "Completed";
          statusColor = "text-green-600 bg-green-50 border-green-200";
        } else if (submissionCount > gradedCount) {
          status = "Needs Grading";
          statusColor = "text-purple-600 bg-purple-50 border-purple-200";
        }

        const subject = assignedSubjects.find(s => String(s.id) === String(task.course_id));

        return {
          ...task,
          className: subject ? `${subject.name} - ${subject.section}` : "Unknown Class",
          submissionCount,
          gradedCount,
          computedStatus: status,
          statusColor
        };
      })
      // Sort by deadline, nulls last, closest deadline first
      .sort((a, b) => {
        if (!a.deadline) return 1;
        if (!b.deadline) return -1;
        return new Date(a.deadline) - new Date(b.deadline);
      });
  }, [assessments, submissions, grades, assignedSubjects]);

  if (loading) {
    return (
      <div className="bg-white border border-gray-100 rounded-2xl p-6 shadow-sm flex items-center justify-center h-[400px]">
        <div className="flex flex-col items-center">
          <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mb-4" />
          <p className="text-gray-500 text-sm font-medium">Loading tasks...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden flex flex-col">
      <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
        <h3 className="text-gray-900 font-bold text-base flex items-center gap-2">
          <ClipboardCheck className="w-5 h-5 text-blue-500" />
          Tasks & Deadlines
        </h3>
        <button 
          onClick={() => navigate('/teacher/classes')}
          className="text-sm font-semibold text-blue-600 hover:text-blue-700 hover:underline flex items-center gap-1"
        >
          View All <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      <div className="p-6">
        {/* Metrics Row */}
        <div className="grid grid-cols-2 gap-4 mb-6">
          <div className="bg-gray-50 rounded-xl p-4 text-center border border-gray-100">
            <p className="text-2xl font-bold text-gray-900">{metrics.activeTotal}</p>
            <p className="text-xs text-gray-500 font-medium uppercase tracking-wider mt-1">Total Tasks</p>
          </div>
          <div className="bg-orange-50 rounded-xl p-4 text-center border border-orange-100">
            <p className="text-2xl font-bold text-orange-700">{metrics.dueToday}</p>
            <p className="text-xs text-orange-600 font-medium uppercase tracking-wider mt-1">Due Today</p>
          </div>
          <div className="bg-blue-50 rounded-xl p-4 text-center border border-blue-100">
            <p className="text-2xl font-bold text-blue-700">{metrics.upcoming}</p>
            <p className="text-xs text-blue-600 font-medium uppercase tracking-wider mt-1">Upcoming (7d)</p>
          </div>
          <div className="bg-purple-50 rounded-xl p-4 text-center border border-purple-100">
            <p className="text-2xl font-bold text-purple-700">{metrics.needsGrading}</p>
            <p className="text-xs text-purple-600 font-medium uppercase tracking-wider mt-1">Needs Grading</p>
          </div>
        </div>

        {/* Task List */}
        <div>
          <h4 className="text-sm font-bold text-gray-900 mb-3 flex items-center gap-2">
            Most Relevant Tasks
          </h4>
          
          {taskList.length === 0 ? (
            <div className="text-center py-8 flex flex-col items-center justify-center border-2 border-dashed border-gray-100 rounded-xl">
              <div className="w-12 h-12 bg-gray-50 rounded-2xl flex items-center justify-center mx-auto mb-3">
                <CheckCircle className="w-6 h-6 text-gray-400" />
              </div>
              <p className="text-gray-900 font-bold">You're all caught up!</p>
              <p className="text-gray-500 text-sm mt-1">No pending tasks or deadlines.</p>
            </div>
          ) : (
            <div className="space-y-3 max-h-[320px] overflow-y-auto p-3 pr-2 rounded-xl bg-gray-50/80 border border-gray-100 shadow-inner custom-scrollbar">
              {taskList.map(task => (
                <div 
                  key={task.id}
                  onClick={() => navigate(`/teacher/class/${task.course_id}`)}
                  className="group flex flex-col sm:flex-row sm:items-center justify-between p-4 rounded-xl border border-gray-100 bg-white hover:bg-gray-50 hover:border-gray-200 cursor-pointer transition-all gap-4 shadow-sm hover:shadow"
                >
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center shrink-0 border border-blue-100 text-blue-600 group-hover:bg-blue-100 transition-colors">
                      <FileText className="w-5 h-5" />
                    </div>
                    <div>
                      <h5 className="font-bold text-gray-900 text-sm leading-tight group-hover:text-blue-600 transition-colors">
                        {task.title}
                      </h5>
                      <div className="flex flex-wrap items-center gap-2 mt-1 text-xs text-gray-500">
                        <span className="font-medium text-gray-700">{task.className}</span>
                        <span>&bull;</span>
                        <span className="capitalize">{task.assessment_type}</span>
                        {task.deadline && (
                          <>
                            <span>&bull;</span>
                            <span className="flex items-center gap-1">
                              <Calendar className="w-3.5 h-3.5 text-gray-400" />
                              {new Date(task.deadline).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-4 sm:justify-end">
                    <div className="flex flex-col sm:items-end">
                      <span className="text-xs font-semibold text-gray-900 bg-gray-100 px-2.5 py-1 rounded-md">
                        {task.gradedCount} / {task.submissionCount} Graded
                      </span>
                    </div>
                    <span className={`text-[11px] font-bold px-2.5 py-1 rounded-md border ${task.statusColor} whitespace-nowrap`}>
                      {task.computedStatus}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
