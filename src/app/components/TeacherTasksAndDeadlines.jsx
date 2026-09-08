import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { ClipboardCheck, Calendar, Clock, AlertCircle, CheckCircle, ChevronRight, FileText } from 'lucide-react';
import { supabase } from '@/app/lib/supabaseClient';
import { useAcademic } from "@/app/context/AcademicContext";
import { useTourPreview } from "@/app/hooks/useTourPreview";

export function TeacherTasksAndDeadlines({ teacherId, assignedSubjects = [] }) {
  const { activeSchoolYear, activeQuarter, viewMode } = useAcademic();
  const { isDemoMode } = useTourPreview();
  const navigate = useNavigate();
  const [assessments, setAssessments] = useState([]);
  const [submissions, setSubmissions] = useState([]);
  const [grades, setGrades] = useState([]);
  const [loading, setLoading] = useState(true);

  // Fetch initial data
  const fetchData = async () => {
    if (!teacherId || !assignedSubjects.length || !supabase) {
      setAssessments([]);
      setSubmissions([]);
      setGrades([]);
      setLoading(false);
      return;
    }

    try {
      const subjectIds = assignedSubjects.map(s => s.id);
      
      // 1. Fetch lessons for these subjects created by this teacher
      const { data: lessonsData } = await supabase
        .from('lessons')
        .select('id, subject_id, status, teacher_id')
        .in('subject_id', subjectIds)
        .eq('teacher_id', teacherId);

      const lessonIds = (lessonsData || []).map(l => String(l.id));

      // 2. Fetch Assignments & Quizzes by lesson_id
      const [{ data: assignmentsByLesson }, { data: quizzesByLesson }] = await Promise.all([
        lessonIds.length ? supabase.from('assignments').select('*').in('lesson_id', lessonIds) : Promise.resolve({ data: [] }),
        lessonIds.length ? supabase.from('quizzes').select('*').in('lesson_id', lessonIds) : Promise.resolve({ data: [] })
      ]);

      const rawTasksMap = new Map();
      const addRawTask = (task, type) => {
        if (!task || !task.id || rawTasksMap.has(String(task.id))) return;
        const lesson = (lessonsData || []).find(l => String(l.id) === String(task.lesson_id));
        const courseId = lesson ? lesson.subject_id : null;
        rawTasksMap.set(String(task.id), {
          ...task,
          course_id: courseId,
          assessment_type: type,
          deadline: task.due_date
        });
      };

      (assignmentsByLesson || []).forEach(a => addRawTask(a, 'assignment'));
      (quizzesByLesson || []).forEach(q => addRawTask(q, 'quiz'));

      const allTasks = Array.from(rawTasksMap.values());
      setAssessments(allTasks);

      const assessmentIds = allTasks.map(a => String(a.id));

      if (assessmentIds.length > 0) {
        // Fetch Submissions for these subjects/assessments
        const { data: subsData, error: subsError } = await supabase
          .from('teacher_assessment_submissions')
          .select('id, assessment_id, student_id, status, submitted_at')
          .eq('teacher_id', teacherId)
          .in('assessment_id', assessmentIds);

        if (subsError) {
          console.error("Error fetching submissions:", subsError);
        } else {
          setSubmissions(subsData || []);
        }

        // Fetch Grades for these subjects/assessments
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
  }, [teacherId, assignedSubjects, activeSchoolYear, activeQuarter, viewMode]);

  // Real-time Subscriptions & Window Event Listener
  useEffect(() => {
    if (!teacherId || !supabase) return;
    
    let isMounted = true;
    
    const existingChannels = supabase.getChannels ? supabase.getChannels() : [];
    existingChannels.forEach((c) => {
      if (c.topic?.includes(`teacher-tasks-${teacherId}`)) {
        try { supabase.removeChannel(c); } catch {}
      }
    });

    const channel = supabase.channel(`teacher-tasks-${teacherId}_${Date.now()}`);

    channel
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

    const handleGradeUpdated = () => {
      if (isMounted) fetchData();
    };
    window.addEventListener("connected-grade-updated", handleGradeUpdated);

    return () => {
      isMounted = false;
      window.removeEventListener("connected-grade-updated", handleGradeUpdated);
      try { supabase.removeChannel(channel); } catch {}
    };
  }, [teacherId]);

  const metrics = useMemo(() => {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const tomorrowStart = new Date(todayStart);
    tomorrowStart.setDate(tomorrowStart.getDate() + 1);

    let activeTotal = 0;
    let dueToday = 0;
    let upcoming = 0;
    let needsGrading = 0;

    assessments.forEach(task => {
      if (task.deadline) {
        const d = new Date(task.deadline);
        const isPast = d <= now;

        if (!isPast) {
          activeTotal++;
          upcoming++; // Any future due date is an upcoming task/deadline
        }

        if (d >= todayStart && d < tomorrowStart) {
          dueToday++;
        }
      } else {
        activeTotal++;
      }
    });

    // Needs grading: Real student submissions that have not yet been assigned a returned grade
    submissions.forEach(sub => {
      const grade = grades.find(g => String(g.assessment_id) === String(sub.assessment_id) && String(g.student_id) === String(sub.student_id));
      const hasReturnedGrade = grade && (grade.grade_value !== null && grade.grade_value !== undefined) && String(grade.status).toLowerCase() === 'returned';
      
      if (!hasReturnedGrade) {
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

  const MOCK_TASKS = [
    {
      id: "demo-t1",
      title: "Modyul 1: Seatwork 2 - Pagsusuri sa Kontemporaryong Isyu",
      className: "AP10 - Grade 10 Ruby",
      course_id: "demo-class-1",
      assessment_type: "assignment",
      deadline: new Date().toISOString(),
      gradedCount: 38,
      submissionCount: 42,
      computedStatus: "Needs Grading",
      statusColor: "bg-purple-50 text-purple-700 border-purple-200",
    },
    {
      id: "demo-t2",
      title: "Mathematics 7 Week 3 Practice Quiz",
      className: "MATH7 - Grade 7 Emerald",
      course_id: "demo-class-2",
      assessment_type: "quiz",
      deadline: new Date().toISOString(),
      gradedCount: 30,
      submissionCount: 38,
      computedStatus: "Due Today",
      statusColor: "bg-orange-50 text-orange-700 border-orange-200",
    },
    {
      id: "demo-t3",
      title: "Science 8 Laboratory Experiment Report 1",
      className: "SCI8 - Grade 8 Diamond",
      course_id: "demo-class-3",
      assessment_type: "assignment",
      deadline: new Date(Date.now() + 86400000 * 2).toISOString(),
      gradedCount: 10,
      submissionCount: 40,
      computedStatus: "Upcoming",
      statusColor: "bg-blue-50 text-blue-700 border-blue-200",
    },
    {
      id: "demo-t4",
      title: "English 9 Essay: Literary Analysis",
      className: "ENG9 - Grade 9 Sapphire",
      course_id: "demo-class-4",
      assessment_type: "assignment",
      deadline: new Date().toISOString(),
      gradedCount: 32,
      submissionCount: 36,
      computedStatus: "Needs Grading",
      statusColor: "bg-purple-50 text-purple-700 border-purple-200",
    },
  ];

  const activeMetrics = isDemoMode
    ? { activeTotal: 4, dueToday: 1, upcoming: 1, needsGrading: 2 }
    : metrics;

  const activeTaskList = isDemoMode ? MOCK_TASKS : taskList;

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
            <p className="text-2xl font-bold text-gray-900">{activeMetrics.activeTotal}</p>
            <p className="text-xs text-gray-500 font-medium uppercase tracking-wider mt-1">Total Tasks</p>
          </div>
          <div className="bg-orange-50 rounded-xl p-4 text-center border border-orange-100">
            <p className="text-2xl font-bold text-orange-700">{activeMetrics.dueToday}</p>
            <p className="text-xs text-orange-600 font-medium uppercase tracking-wider mt-1">Due Today</p>
          </div>
          <div className="bg-blue-50 rounded-xl p-4 text-center border border-blue-100">
            <p className="text-2xl font-bold text-blue-700">{activeMetrics.upcoming}</p>
            <p className="text-xs text-blue-600 font-medium uppercase tracking-wider mt-1">Upcoming (7d)</p>
          </div>
          <div className="bg-purple-50 rounded-xl p-4 text-center border border-purple-100">
            <p className="text-2xl font-bold text-purple-700">{activeMetrics.needsGrading}</p>
            <p className="text-xs text-purple-600 font-medium uppercase tracking-wider mt-1">Needs Grading</p>
          </div>
        </div>

        {/* Task List */}
        <div>
          <h4 className="text-sm font-bold text-gray-900 mb-3 flex items-center gap-2">
            Most Relevant Tasks
          </h4>
          
          {activeTaskList.length === 0 ? (
            <div className="text-center py-8 flex flex-col items-center justify-center border-2 border-dashed border-gray-100 rounded-xl">
              <div className="w-12 h-12 bg-gray-50 rounded-2xl flex items-center justify-center mx-auto mb-3">
                <CheckCircle className="w-6 h-6 text-gray-400" />
              </div>
              <p className="text-gray-900 font-bold">You're all caught up!</p>
              <p className="text-gray-500 text-sm mt-1">No pending tasks or deadlines.</p>
            </div>
          ) : (
            <div className="space-y-2.5 max-h-[340px] overflow-y-auto p-2.5 rounded-xl bg-gray-50/80 border border-gray-100 shadow-inner custom-scrollbar">
              {activeTaskList.map((task) => (
                <div
                  key={task.id}
                  onClick={() => navigate(`/teacher/class/${task.course_id}`)}
                  className="group flex flex-col p-3 rounded-xl border border-gray-100 bg-white hover:bg-gray-50 hover:border-gray-200 cursor-pointer transition-all gap-2 shadow-2xs hover:shadow-xs min-w-0 overflow-hidden"
                >
                  {/* Top Row: Icon + Title & Class Name */}
                  <div className="flex items-center gap-2.5 min-w-0 w-full">
                    <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center shrink-0 border border-blue-100 text-blue-600 group-hover:bg-blue-100 transition-colors">
                      <FileText className="w-4 h-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <h5 className="font-bold text-gray-900 text-xs leading-snug group-hover:text-blue-600 transition-colors truncate" title={task.title}>
                        {task.title}
                      </h5>
                      <p className="text-[11px] font-medium text-gray-500 truncate mt-0.5">
                        {task.className}
                      </p>
                    </div>
                  </div>

                  {/* Bottom Row: Metadata Badges & Status */}
                  <div className="flex flex-wrap items-center justify-between gap-1.5 pt-2 border-t border-gray-100/80 text-[11px] text-gray-500">
                    <div className="flex items-center gap-1.5 flex-1 min-w-0">
                      <Calendar className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                      <span className="truncate">{task.deadline ? new Date(task.deadline).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : 'No due date'}</span>
                      <span className="text-gray-300">•</span>
                      <span className="capitalize shrink-0">{task.assessment_type}</span>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0 ml-auto">
                      <span className="text-[10px] font-semibold text-gray-700 bg-gray-100 px-2 py-0.5 rounded-md whitespace-nowrap">
                        {task.gradedCount}/{task.submissionCount} Graded
                      </span>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md border ${task.statusColor} whitespace-nowrap`}>
                        {task.computedStatus}
                      </span>
                    </div>
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
