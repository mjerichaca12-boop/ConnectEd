import { supabase } from "../../lib/supabase";
import { Assignment } from "../../types";
import { classifyAssessment } from "../../utils/assessment-badge";
import { getMyEnrollments } from "../enrollments/get-my-enrollments";
import { isSectionMatch, isGradeLevelMatch } from "../../utils/section-matcher";

export async function getMyAssignments(subjectId?: string): Promise<Assignment[]> {
    const { data: userData, error: userError } = await supabase.auth.getUser();
    if (userError || !userData?.user) throw new Error("Not authenticated");

    const userId = userData.user.id;

    // 1. Fetch current student's profile to get assigned section, grade level, and role
    let studentSection = "";
    let studentGrade = "";
    let isTeacher = userData.user.user_metadata?.role === 'teacher';

    try {
        const { data: profile } = await supabase
            .from('profiles')
            .select('id, section, year_level, role')
            .eq('id', userId)
            .maybeSingle();

        if (profile) {
            studentSection = profile.section || "";
            studentGrade = profile.year_level || "";
            if (profile.role === 'teacher') {
                isTeacher = true;
            }
        }
    } catch (profErr) {
        console.warn('[assignments] profile fetch fallback:', profErr);
    }

    // 2. Fetch valid section-matched enrollments
    let sectionMatchedSubjectIds: string[] = [];
    try {
        const studentEnrollments = await getMyEnrollments();
        sectionMatchedSubjectIds = studentEnrollments
            .filter(e => {
                const st = (e.status || '').toLowerCase();
                return st === 'accepted' || st === 'approved' || st === 'active' || st === 'enrolled' || st === 'joined';
            })
            .map(e => e.subject_id)
            .filter(Boolean);
    } catch (e) {
        console.warn('[assignments] getMyEnrollments fallback:', e);
    }

    let approvedSubjectIds: string[] = [];
    if (sectionMatchedSubjectIds.length > 0) {
        approvedSubjectIds = [...new Set(sectionMatchedSubjectIds)];
    }

    // Also fetch directly from teacher_student_assignments
    try {
        const { data: tsaEnrollments } = await supabase
            .from('teacher_student_assignments')
            .select('subject_id, status')
            .eq('student_id', userId)
            .in('status', ['Active', 'active', 'accepted', 'approved', 'enrolled', 'Joined', 'joined', 'Pending', 'pending']);
        if (tsaEnrollments) {
            const tsaIds = tsaEnrollments.map((t: any) => t.subject_id).filter(Boolean);
            approvedSubjectIds = [...new Set([...approvedSubjectIds, ...tsaIds])];
        }
    } catch (tsaErr) {
        console.warn('[assignments] direct teacher_student_assignments fallback:', tsaErr);
    }

    // Fallback to legacy enrollments table with section and grade level validation
    try {
        const { data: legacyEnrollments } = await supabase
            .from('enrollments')
            .select('subject_id, status, subjects(id, section, grade_level)')
            .eq('student_id', userId)
            .in('status', ['approved', 'accepted', 'active', 'enrolled', 'joined', 'Active', 'Accepted']);

        if (legacyEnrollments) {
            const legIds = legacyEnrollments
                .filter((e: any) => {
                    if (isTeacher) return true;
                    const subSection = e.subjects?.section;
                    const subGrade = e.subjects?.grade_level;
                    if (subSection && !isSectionMatch(studentSection, subSection)) return false;
                    if (subGrade && !isGradeLevelMatch(studentGrade, subGrade)) return false;
                    return true;
                })
                .map((e: any) => e.subject_id)
                .filter(Boolean);
            approvedSubjectIds = [...new Set([...approvedSubjectIds, ...legIds])];
        }
    } catch (legErr) {
        console.warn('[assignments] legacyEnrollments fetch fallback:', legErr);
    }

    // Also get subjects taught if user is a teacher
    let taughtSubjectIds: string[] = [];
    try {
        const { data: taughtSubjects } = await supabase
            .from('subjects')
            .select('id')
            .eq('teacher_id', userId);
        taughtSubjectIds = taughtSubjects?.map(s => s.id).filter(Boolean) || [];
        if (taughtSubjectIds.length > 0) {
            isTeacher = true;
        }
    } catch (e) {}

    // Combine courses
    const allCourseIds = isTeacher
        ? [...new Set([...approvedSubjectIds, ...taughtSubjectIds])]
        : approvedSubjectIds;

    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    const isValidId = !!(subjectId && uuidRegex.test(subjectId));
    const isSubjectExplicit = subjectId && subjectId !== 'undefined' && subjectId !== '[id]';

    if (isSubjectExplicit && !isValidId) {
        console.log(`[assignments] Invalid subjectId provided: ${subjectId}`);
        return [];
    }

    // For students: if specific subject requested, it MUST be in their approved subjects
    if (!isTeacher) {
        if (isValidId && !allCourseIds.some(cid => String(cid).toLowerCase() === String(subjectId).toLowerCase())) {
            console.log(`[assignments] Student not enrolled in or section-mismatched for subject: ${subjectId}`);
            return [];
        }
        if (!isValidId && allCourseIds.length === 0) {
            return [];
        }
    } else {
        if (!isValidId && allCourseIds.length === 0) {
            return [];
        }
    }

    const targetCourseIds = isValidId ? [subjectId] : allCourseIds;

    // Helper to verify if a lesson is published / accessible to students
    const isLessonPublished = (lesson: any): boolean => {
        if (isTeacher) return true;
        if (!lesson) return true;
        if (lesson.is_published === false || lesson.published === false) return false;
        const lessonStatus = (lesson.status || '').toLowerCase().trim();
        if (lessonStatus === 'draft' || lessonStatus === 'archived' || lessonStatus === 'inactive') {
            return false;
        }
        if (lesson.scheduled_publish_at) {
            const schedDate = new Date(lesson.scheduled_publish_at);
            if (!isNaN(schedDate.getTime()) && schedDate > new Date()) {
                return false;
            }
        }
        return true;
    };

    // Helper to verify if an item is published and available
    const isItemPublished = (row: any, linkedLesson?: any): boolean => {
        if (isTeacher) return true; // Teachers can see drafts/scheduled items

        // If explicitly unpublished / draft
        if (row.is_published === false || row.published === false) return false;
        
        const rawStatus = (row.status || '').toLowerCase().trim();
        if (rawStatus === 'draft' || rawStatus === 'archived' || rawStatus === 'inactive') {
            return false;
        }

        // Check scheduled publish date
        if (rawStatus === 'scheduled' || row.scheduled_publish_at) {
            if (row.scheduled_publish_at) {
                const schedDate = new Date(row.scheduled_publish_at);
                if (!isNaN(schedDate.getTime()) && schedDate > new Date()) {
                    return false;
                }
            } else if (rawStatus === 'scheduled') {
                return false;
            }
        }

        // Check available_from (scheduled quiz availability window)
        if (row.available_from) {
            const availDate = new Date(row.available_from);
            if (!isNaN(availDate.getTime()) && availDate > new Date()) {
                return false;
            }
        }

        // If item is linked to a lesson, check if lesson is published
        if (linkedLesson && !isLessonPublished(linkedLesson)) {
            return false;
        }

        return true;
    };

    // Helper to verify section match on the row
    const doesItemMatchSection = (row: any): boolean => {
        if (isTeacher) return true;
        const rowSection = row.section || row.section_name;
        if (rowSection && !isSectionMatch(studentSection, rowSection)) {
            return false;
        }
        return true;
    };

    // 1a. Fetch from direct assignments_activity table
    let tableQuery = supabase.from('assignments_activity').select('*');
    if (isValidId) {
        tableQuery = tableQuery.eq('course_id', subjectId);
    } else {
        tableQuery = tableQuery.in('course_id', targetCourseIds);
    }
    const { data: directData, error: directError } = await tableQuery;
    if (directError) {
        console.warn('[assignments] direct assignments_activity error (non-fatal):', directError.message);
    }

    // 1b. Fetch from RPC get_my_assignments_activity
    let rpcQuery = supabase.rpc('get_my_assignments_activity');
    if (isValidId) {
        rpcQuery = rpcQuery.eq('course_id', subjectId);
    } else {
        rpcQuery = rpcQuery.in('course_id', targetCourseIds);
    }
    const { data: rpcData, error: rpcError } = await rpcQuery;
    if (rpcError) {
        console.warn('[assignments] RPC get_my_assignments_activity error (non-fatal):', rpcError.message);
    }

    // 1c. Fetch from class_assignments table if available
    let classAsgQuery = supabase.from('class_assignments').select('*');
    if (isValidId) {
        classAsgQuery = classAsgQuery.eq('course_id', subjectId);
    } else {
        classAsgQuery = classAsgQuery.in('course_id', targetCourseIds);
    }
    const { data: classAsgData } = await classAsgQuery;

    // 1d. Fetch from class_materials table if available
    let materialsQuery = supabase.from('class_materials').select('*');
    const { data: materialsData } = await materialsQuery;

    // 1e. Fetch lesson_activities junction mappings
    let lessonActivitiesQuery = supabase.from('lesson_activities').select('id, lesson_id, activity_type, activity_id, created_at');
    const { data: lessonActivitiesData } = await lessonActivitiesQuery;

    const activityToLessonMap = new Map<string, string>();
    const activityTypeMap = new Map<string, string>();
    (lessonActivitiesData || []).forEach((la: any) => {
        if (la && la.activity_id && la.lesson_id) {
            activityToLessonMap.set(la.activity_id, la.lesson_id);
            if (la.activity_type) {
                activityTypeMap.set(la.activity_id, la.activity_type);
            }
        }
    });

    // 1f. Fetch ALL relevant lessons to accurately map lesson_id -> course_id (subject_id)
    let lessonsData: any[] = [];
    try {
        const { data: lData, error: lErr } = await supabase.from('lessons').select('*');
        if (!lErr && lData) {
            lessonsData = lData;
        } else if (lErr) {
            console.warn('[assignments] lessons query fallback select(*):', lErr.message);
            const { data: minLData } = await supabase.from('lessons').select('id, subject_id');
            if (minLData) lessonsData = minLData;
        }
    } catch (e) {
        console.warn('[assignments] lessons query exception:', e);
    }

    const lessonToCourseMap = new Map<string, string>();
    const lessonDetailsMap = new Map<string, any>();
    (lessonsData || []).forEach((l: any) => {
        if (l && l.id) {
            lessonDetailsMap.set(l.id, l);
            const courseId = l.subject_id;
            if (courseId) lessonToCourseMap.set(l.id, courseId);
        }
    });

    // 1g. Fetch from quizzes table (created by teachers in lessons or courses)
    let quizzesData: any[] = [];
    try {
        let quizzesQuery = supabase.from('quizzes').select('*');
        const { data: qData, error: qErr } = await quizzesQuery;
        if (!qErr && qData) {
            quizzesData = qData;
        } else if (qErr) {
            console.warn('[assignments] quizzes table fetch info:', qErr.message);
        }
    } catch (e) {
        console.warn('[assignments] quizzes table query exception:', e);
    }

    // 1h. Fetch directly from assignments table (created by teachers in lessons)
    let directAssignmentsData: any[] = [];
    try {
        let asgQuery = supabase.from('assignments').select('*');
        const { data: aData, error: aErr } = await asgQuery;
        if (!aErr && aData) {
            directAssignmentsData = aData;
        } else if (aErr) {
            console.warn('[assignments] assignments table fetch info:', aErr.message);
        }
    } catch (e) {
        console.warn('[assignments] assignments table query exception:', e);
    }

    // Merge datasets by ID with STRICT subject and published verification
    const assignmentMap = new Map<string, any>();

    (rpcData || []).forEach((row: any) => {
        if (!row || !row.id) return;
        const resolvedLessonId = row.lesson_id || activityToLessonMap.get(row.id);
        const rowCourseId = row.course_id || row.subject_id || (resolvedLessonId ? lessonToCourseMap.get(resolvedLessonId) : null);
        if (!rowCourseId) return;
        if (isValidId && String(rowCourseId).toLowerCase() !== String(subjectId).toLowerCase()) return;
        if (!isValidId && !targetCourseIds.some(cid => String(cid).toLowerCase() === String(rowCourseId).toLowerCase())) return;

        const linkedLesson = resolvedLessonId ? lessonDetailsMap.get(resolvedLessonId) : null;
        if (!isItemPublished(row, linkedLesson)) return;
        if (!doesItemMatchSection(row)) return;

        assignmentMap.set(row.id, {
            ...row,
            course_id: rowCourseId,
            lesson_id: resolvedLessonId,
            assessment_type: classifyAssessment(row),
            created_at: row.created_at || new Date().toISOString(),
        });
    });

    [...(directData || []), ...(classAsgData || [])].forEach((row: any) => {
        if (!row || !row.id) return;
        const resolvedLessonId = row.lesson_id || activityToLessonMap.get(row.id);
        const rowCourseId = row.course_id || row.subject_id || (resolvedLessonId ? lessonToCourseMap.get(resolvedLessonId) : null);
        if (!rowCourseId) return;
        if (isValidId && String(rowCourseId).toLowerCase() !== String(subjectId).toLowerCase()) return;
        if (!isValidId && !targetCourseIds.some(cid => String(cid).toLowerCase() === String(rowCourseId).toLowerCase())) return;

        const linkedLesson = resolvedLessonId ? lessonDetailsMap.get(resolvedLessonId) : null;
        if (!isItemPublished(row, linkedLesson)) return;
        if (!doesItemMatchSection(row)) return;

        const existing = assignmentMap.get(row.id) || {};
        assignmentMap.set(row.id, {
            ...existing,
            ...row,
            course_id: rowCourseId,
            lesson_id: resolvedLessonId,
            title: row.title || existing.title,
            description: row.description || existing.description,
            deadline: row.deadline || row.due_date || existing.deadline || existing.due_date,
            file_url: row.file_url || row.attachment_url || existing.file_url || existing.attachment_url,
            file_name: row.file_name || row.attachment_name || existing.file_name || existing.attachment_name,
            file_path: row.file_path || existing.file_path,
            assessment_type: classifyAssessment(row) || existing.assessment_type,
            created_at: row.created_at || existing.created_at || new Date().toISOString(),
        });
    });

    // Process and merge rows from direct assignments table strictly mapped to their subject
    (directAssignmentsData || []).forEach((row: any) => {
        if (!row || !row.id) return;
        const resolvedLessonId = row.lesson_id || activityToLessonMap.get(row.id);
        const mappedCourseId = row.course_id || row.subject_id || (resolvedLessonId ? lessonToCourseMap.get(resolvedLessonId) : null);
        
        // STRICT FILTERING: Do NOT attach if it doesn't belong to this subject!
        if (!mappedCourseId) return;

        if (isValidId && String(mappedCourseId).toLowerCase() !== String(subjectId).toLowerCase()) {
            return;
        }

        if (!isValidId && !targetCourseIds.some(cid => String(cid).toLowerCase() === String(mappedCourseId).toLowerCase())) {
            return;
        }

        const linkedLesson = resolvedLessonId ? lessonDetailsMap.get(resolvedLessonId) : null;
        if (!isItemPublished(row, linkedLesson)) return;
        if (!doesItemMatchSection(row)) return;

        const activityType = activityTypeMap.get(row.id);
        const classifiedType = classifyAssessment({ ...row, activity_type: activityType || row.assignment_type });

        const existing = assignmentMap.get(row.id) || {};
        assignmentMap.set(row.id, {
            ...existing,
            ...row,
            course_id: mappedCourseId,
            subject_id: mappedCourseId,
            lesson_id: resolvedLessonId,
            title: row.title || (linkedLesson ? linkedLesson.title : null) || "Assignment",
            description: row.description || (linkedLesson ? (linkedLesson.content || linkedLesson.description) : null) || existing.description || "Please complete this assignment.",
            deadline: row.deadline || row.due_date || row.dueDate || existing.deadline || existing.due_date,
            file_url: row.file_url || row.attachment_url || (linkedLesson ? (linkedLesson.file_url || linkedLesson.attachment_url) : null) || existing.file_url || existing.attachment_url,
            file_name: row.file_name || row.attachment_name || (linkedLesson ? (linkedLesson.file_name || linkedLesson.title) : null) || existing.file_name || existing.attachment_name,
            file_path: row.file_path || existing.file_path,
            assessment_type: classifiedType,
            created_at: row.created_at || existing.created_at || new Date().toISOString(),
        });
    });

    // Process and merge rows from quizzes table strictly mapped to their subject
    (quizzesData || []).forEach((row: any) => {
        if (!row || !row.id) return;
        const resolvedLessonId = row.lesson_id || activityToLessonMap.get(row.id);
        const mappedCourseId = row.course_id || row.subject_id || (resolvedLessonId ? lessonToCourseMap.get(resolvedLessonId) : null);
        
        // STRICT FILTERING: Do NOT attach if it doesn't belong to this subject!
        if (!mappedCourseId) return;

        if (isValidId && String(mappedCourseId).toLowerCase() !== String(subjectId).toLowerCase()) {
            return;
        }

        if (!isValidId && !targetCourseIds.some(cid => String(cid).toLowerCase() === String(mappedCourseId).toLowerCase())) {
            return;
        }

        const linkedLesson = resolvedLessonId ? lessonDetailsMap.get(resolvedLessonId) : null;
        if (!isItemPublished(row, linkedLesson)) return;
        if (!doesItemMatchSection(row)) return;

        let quizDescription = row.questions || row.quiz_data || row.content || row.description || row.instructions;
        
        if (typeof quizDescription === 'string') {
            if (!quizDescription || quizDescription.trim().toUpperCase() === "EMPTY" || quizDescription.trim().toUpperCase() === "READ UPLOADED FILES.") {
                if (linkedLesson) {
                    quizDescription = linkedLesson.content || linkedLesson.description || linkedLesson.topic || quizDescription;
                }
            }
        } else if (Array.isArray(quizDescription)) {
            quizDescription = JSON.stringify(quizDescription);
        }

        const existing = assignmentMap.get(row.id) || {};
        assignmentMap.set(row.id, {
            ...existing,
            ...row,
            course_id: mappedCourseId,
            subject_id: mappedCourseId,
            lesson_id: resolvedLessonId,
            title: row.title || (linkedLesson ? linkedLesson.title : null) || "Quiz",
            description: quizDescription || existing.description || "Please complete this quiz.",
            deadline: row.deadline || row.due_date || row.dueDate || existing.deadline || existing.due_date,
            file_url: row.file_url || row.attachment_url || (linkedLesson ? (linkedLesson.file_url || linkedLesson.attachment_url) : null) || existing.file_url || existing.attachment_url,
            file_name: row.file_name || row.attachment_name || (linkedLesson ? (linkedLesson.file_name || linkedLesson.title) : null) || existing.file_name || existing.attachment_name,
            file_path: row.file_path || existing.file_path,
            assessment_type: 'quiz',
            created_at: row.created_at || existing.created_at || new Date().toISOString(),
        });
    });

    // Cross-reference class_materials to fill missing file_url for matching subject/title
    assignmentMap.forEach((asg) => {
        if (!asg.file_url && materialsData && materialsData.length > 0) {
            const mat = materialsData.find((m: any) => 
                (m.title && asg.title && m.title.trim().toLowerCase() === asg.title.trim().toLowerCase()) ||
                (m.subject && asg.subject && m.subject.trim().toLowerCase() === asg.subject.trim().toLowerCase())
            );
            if (mat && mat.file_url) {
                asg.file_url = mat.file_url;
                asg.file_name = mat.file_name || mat.title;
            }
        }
    });

    const assignments = Array.from(assignmentMap.values());
    console.log(`[assignments] Found ${assignments.length} total merged assignments.`);
    if (assignments.length === 0) return [];

    const assignmentIds = assignments.map((a: any) => a.id);

    // 2. Fetch grades/results for these assignments separately
    const { data: results, error: resultsError } = await supabase
        .from('teacher_assessment_grades')
        .select('id, assessment_id, status, grade_value, feedback')
        .eq('student_id', userId)
        .in('assessment_id', assignmentIds);

    if (resultsError) {
        console.warn(`[assignments] Grades fetch error (non-fatal) [Code: ${resultsError.code}]:`, resultsError.message);
    }

    // 3.5. Fetch feedback comments from submission_feedback table
    const { data: feedbacks, error: feedbacksError } = await supabase
        .from('submission_feedback')
        .select('comments, teacher_assessment_submissions!inner(assessment_id, student_id)')
        .eq('teacher_assessment_submissions.student_id', userId)
        .in('teacher_assessment_submissions.assessment_id', assignmentIds);

    if (feedbacksError) {
        console.warn(`[assignments] Feedback comments fetch error (non-fatal):`, feedbacksError.message);
    }

    const feedbackMap = new Map();
    if (!feedbacksError && feedbacks) {
        feedbacks.forEach((f: any) => {
            const sub = f.teacher_assessment_submissions;
            const assessmentId = Array.isArray(sub) ? sub[0]?.assessment_id : sub?.assessment_id;
            if (assessmentId) {
                feedbackMap.set(assessmentId, f.comments);
            }
        });
    }

    // 3.7. Fetch response text from teacher_assessment_submissions table
    const { data: assessmentSubmissions, error: assessmentSubmissionsError } = await supabase
        .from('teacher_assessment_submissions')
        .select('assessment_id, response_text, file_url, id')
        .eq('student_id', userId)
        .in('assessment_id', assignmentIds);

    if (assessmentSubmissionsError) {
        console.warn(`[assignments] Assessment submissions fetch error (non-fatal):`, assessmentSubmissionsError.message);
    }

    const assessmentSubMap = new Map();
    if (!assessmentSubmissionsError && assessmentSubmissions) {
        assessmentSubmissions.forEach(sub => {
            assessmentSubMap.set(sub.assessment_id, sub);
        });
    }

    // 3.8. Fetch attempts from quiz_attempts table if available
    const { data: quizAttempts } = await supabase
        .from('quiz_attempts')
        .select('*')
        .eq('student_id', userId);

    const quizAttemptMap = new Map();
    (quizAttempts || []).forEach(att => {
        if (att && (att.quiz_id || att.id)) {
            quizAttemptMap.set(att.quiz_id || att.id, att);
        }
    });

    // Create lookup maps
    const resultsMap = new Map();
    (results || []).forEach(r => {
        resultsMap.set(r.assessment_id, r);
    });

    (quizAttempts || []).forEach(att => {
        const idKey = att.quiz_id || att.id;
        if (idKey && !resultsMap.has(idKey)) {
            resultsMap.set(idKey, {
                assessment_id: idKey,
                status: att.status || 'Graded',
                grade_value: att.score,
                feedback: `Quiz Score: ${att.score}%`
            });
        }
    });

    // 4. Fetch subject names
    const uniqueCourseIds = [...new Set(assignments.map((a: any) => a.course_id))].filter(Boolean);
    const { data: subjectsData } = await supabase
        .from('subjects')
        .select('id, name')
        .in('id', uniqueCourseIds);
        
    const subjectsMap = new Map();
    (subjectsData || []).forEach(s => {
        subjectsMap.set(s.id, s.name);
    });

    const mappedAssignments = assignments.map((row: any) => {
        const myResult = resultsMap.get(row.id);
        const myAssessmentSub = assessmentSubMap.get(row.id);
        const myQuizAttempt = quizAttemptMap.get(row.id);
        
        // Determine status
        let status: Assignment['status'] = "pending";
        
        const rawStatus = myResult?.status?.toLowerCase();
        
        if (rawStatus === 'returned') {
            status = 'returned';
        } else if (rawStatus === 'graded' || rawStatus === 'passed' || rawStatus === 'failed' || (rawStatus !== 'pending' && myResult?.grade_value !== undefined && myResult?.grade_value !== null) || (myQuizAttempt && myQuizAttempt.score !== undefined && myQuizAttempt.score !== null)) {
            status = 'graded';
        } else if (rawStatus === 'submitted' || myAssessmentSub || myQuizAttempt) {
            status = 'submitted';
        }
        
        const dueDateRaw = row.deadline || row.due_date || row.dueDate;
        let dueDate = null;
        
        if (dueDateRaw) {
            const safeDateStr = typeof dueDateRaw === 'string' ? dueDateRaw.replace(' ', 'T') : dueDateRaw;
            const parsedDate = new Date(safeDateStr);
            if (!isNaN(parsedDate.getTime())) {
                dueDate = parsedDate;
            }
        }
        
        if (status === 'pending' && dueDate) {
            const checkDate = new Date(dueDate);
            checkDate.setHours(23, 59, 59, 999);
            if (checkDate < new Date()) {
                status = "late";
            }
        }

        let fileUrl = row.file_url || row.attachment_url || row.file_path || row.url || row.media_url;
        let fileName = row.file_name || row.attachment_name || row.name;

        try {
            if (Array.isArray(fileUrl)) {
                fileUrl = fileUrl[0] || null;
            } else if (typeof fileUrl === 'string') {
                const trimmed = fileUrl.trim();
                if (trimmed.startsWith('[') || trimmed.startsWith('{')) {
                    const parsed = JSON.parse(trimmed);
                    if (Array.isArray(parsed)) {
                        fileUrl = parsed[0] || null;
                    } else if (parsed && typeof parsed === 'object') {
                        fileUrl = parsed.url || parsed.file_url || parsed.publicUrl || parsed.path || fileUrl;
                    }
                }
            }
            if (fileUrl && typeof fileUrl === 'object') {
                fileUrl = fileUrl.url || fileUrl.file_url || fileUrl.publicUrl || fileUrl.path || null;
            }
            if (Array.isArray(fileName)) {
                fileName = fileName[0] || null;
            } else if (typeof fileName === 'string') {
                const trimmed = fileName.trim();
                if (trimmed.startsWith('[') || trimmed.startsWith('{')) {
                    const parsed = JSON.parse(trimmed);
                    if (Array.isArray(parsed)) {
                        fileName = parsed[0] || null;
                    } else if (parsed && typeof parsed === 'object') {
                        fileName = parsed.name || parsed.file_name || parsed.title || fileName;
                    }
                }
            }
            if (fileName && typeof fileName === 'object') {
                fileName = fileName.name || fileName.file_name || fileName.title || null;
            }
        } catch (e) {}

        if (fileUrl && typeof fileUrl !== 'string') fileUrl = String(fileUrl);
        if (fileName && typeof fileName !== 'string') fileName = String(fileName);

        const resolvedGrade = myResult?.grade_value !== undefined && myResult?.grade_value !== null
            ? myResult.grade_value
            : (myQuizAttempt?.score !== undefined && myQuizAttempt?.score !== null ? myQuizAttempt.score : null);

        const normalizedAssessmentType: Assignment['assessment_type'] = classifyAssessment(row);

        return {
            id: row.id,
            subjectId: row.course_id,
            subject: subjectsMap.get(row.course_id) || "Subject", 
            title: row.title || "Assignment",
            dueDate: dueDate ? dueDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : "TBA",
            rawDueDate: dueDate,
            created_at: row.created_at,
            status: status as Assignment['status'],
            instructions: (typeof row.description === 'string' ? row.description : null) || "Please see subject details for more information.",
            file_url: fileUrl,
            file_name: fileName,
            assessment_type: normalizedAssessmentType,
            submission: (myResult || myAssessmentSub || myQuizAttempt) ? {
                id: myResult?.id || myAssessmentSub?.id || myQuizAttempt?.id || row.id,
                file_url: myAssessmentSub?.file_url || null,
                grade: resolvedGrade,
                teacher_comment: feedbackMap.get(row.id) || myResult?.feedback || (myQuizAttempt ? `Quiz Score: ${myQuizAttempt.score}%` : null),
                status: myResult?.status || (myQuizAttempt ? 'graded' : 'submitted'),
                response_text: myAssessmentSub?.response_text || null,
            } : null,
        };
    });

    // Chronological sorting:
    // - Pending / Upcoming: nearest due date first, or newest created first
    // - Submitted / Graded / Late: most recent first
    mappedAssignments.sort((a: any, b: any) => {
        if (a.status === 'pending' && b.status !== 'pending') return -1;
        if (a.status !== 'pending' && b.status === 'pending') return 1;

        if (a.status === 'pending' && b.status === 'pending') {
            if (a.rawDueDate && b.rawDueDate) {
                const diff = new Date(a.rawDueDate).getTime() - new Date(b.rawDueDate).getTime();
                if (diff !== 0) return diff;
            } else if (a.rawDueDate && !b.rawDueDate) {
                return -1;
            } else if (!a.rawDueDate && b.rawDueDate) {
                return 1;
            }
            return new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime();
        }

        const dateA = new Date(a.rawDueDate || a.created_at || 0).getTime();
        const dateB = new Date(b.rawDueDate || b.created_at || 0).getTime();
        return dateB - dateA;
    });

    if (isValidId) {
        return mappedAssignments.filter((a: any) => a.subjectId && String(a.subjectId).toLowerCase() === String(subjectId).toLowerCase());
    }

    return mappedAssignments.filter((a: any) => a.subjectId && targetCourseIds.some(cid => String(cid).toLowerCase() === String(a.subjectId).toLowerCase()));
}
