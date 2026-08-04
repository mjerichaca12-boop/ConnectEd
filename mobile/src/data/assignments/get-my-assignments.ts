import { supabase } from "../../lib/supabase";
import { Assignment } from "../../types";

export async function getMyAssignments(subjectId?: string): Promise<Assignment[]> {
    const { data: userData, error: userError } = await supabase.auth.getUser();
    if (userError || !userData?.user) throw new Error("Not authenticated");

    const { data: enrollments } = await supabase
        .from('enrollments')
        .select('subject_id')
        .eq('student_id', userData.user.id)
        .in('status', ['approved', 'accepted', 'active']);

    const approvedSubjectIds = enrollments?.map(e => e.subject_id).filter(Boolean) || [];

    const { data: taughtSubjects } = await supabase
        .from('subjects')
        .select('id')
        .eq('teacher_id', userData.user.id);
        
    const taughtSubjectIds = taughtSubjects?.map(s => s.id).filter(Boolean) || [];
    
    // Combine both so students see their classes and teachers see the classes they teach
    const allCourseIds = [...new Set([...approvedSubjectIds, ...taughtSubjectIds])];

    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    const isValidId = !!(subjectId && uuidRegex.test(subjectId));

    if (!isValidId && allCourseIds.length === 0) {
        return [];
    }

    // 1a. Fetch from direct assignments_activity table
    let tableQuery = supabase.from('assignments_activity').select('*');
    if (isValidId) {
        tableQuery = tableQuery.eq('course_id', subjectId);
    } else {
        tableQuery = tableQuery.in('course_id', allCourseIds);
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
        rpcQuery = rpcQuery.in('course_id', allCourseIds);
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
        classAsgQuery = classAsgQuery.in('course_id', allCourseIds);
    }
    const { data: classAsgData } = await classAsgQuery;

    // 1d. Fetch from class_materials table if available
    let materialsQuery = supabase.from('class_materials').select('*');
    const { data: materialsData } = await materialsQuery;

    // 1e. Fetch lessons to map lesson_id -> course_id (subject_id) for quizzes table
    let lessonsQuery = supabase.from('lessons').select('*');
    if (isValidId) {
        lessonsQuery = lessonsQuery.or(`subject_id.eq.${subjectId},course_id.eq.${subjectId}`);
    } else if (allCourseIds.length > 0) {
        lessonsQuery = lessonsQuery.or(`subject_id.in.(${allCourseIds.join(',')}),course_id.in.(${allCourseIds.join(',')})`);
    }
    const { data: lessonsData } = await lessonsQuery;

    const lessonToCourseMap = new Map<string, string>();
    const lessonDetailsMap = new Map<string, any>();
    const lessonIds: string[] = [];
    (lessonsData || []).forEach((l: any) => {
        if (l && l.id) {
            lessonIds.push(l.id);
            lessonDetailsMap.set(l.id, l);
            const courseId = l.subject_id || l.course_id;
            if (courseId) lessonToCourseMap.set(l.id, courseId);
        }
    });

    // 1f. Fetch from quizzes table using lesson_id, course_id, or select all
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

    // Merge datasets by ID
    const assignmentMap = new Map<string, any>();

    (rpcData || []).forEach((row: any) => {
        if (row && row.id) {
            assignmentMap.set(row.id, { ...row });
        }
    });

    [...(directData || []), ...(classAsgData || [])].forEach((row: any) => {
        if (row && row.id) {
            const existing = assignmentMap.get(row.id) || {};
            assignmentMap.set(row.id, {
                ...existing,
                ...row,
                course_id: row.course_id || existing.course_id,
                title: row.title || existing.title,
                description: row.description || existing.description,
                deadline: row.deadline || row.due_date || existing.deadline || existing.due_date,
                file_url: row.file_url || row.attachment_url || existing.file_url || existing.attachment_url,
                file_name: row.file_name || row.attachment_name || existing.file_name || existing.attachment_name,
                file_path: row.file_path || existing.file_path,
                assessment_type: row.assessment_type || row.type || existing.assessment_type || existing.type,
            });
        }
    });

    // Process and merge rows from quizzes table
    (quizzesData || []).forEach((row: any) => {
        if (row && row.id) {
            const mappedCourseId = row.course_id || row.subject_id || (row.lesson_id ? lessonToCourseMap.get(row.lesson_id) : null) || (isValidId ? subjectId : (allCourseIds[0] || subjectId));
            
            // Only include quiz if it belongs to valid target subject or global feed
            if (isValidId && mappedCourseId && String(mappedCourseId) !== String(subjectId)) {
                return;
            }

            const linkedLesson = row.lesson_id ? lessonDetailsMap.get(row.lesson_id) : null;

            // Extract real description/content from quiz row or linked lesson
            let quizDescription = row.questions || row.quiz_data || row.content || row.description || row.instructions;
            
            if (!quizDescription || quizDescription.trim().toUpperCase() === "EMPTY" || quizDescription.trim().toUpperCase() === "READ UPLOADED FILES.") {
                if (linkedLesson) {
                    quizDescription = linkedLesson.content || linkedLesson.description || quizDescription;
                }
            }

            const existing = assignmentMap.get(row.id) || {};
            assignmentMap.set(row.id, {
                ...existing,
                ...row,
                course_id: mappedCourseId || existing.course_id,
                subject_id: mappedCourseId || existing.subject_id || row.subject_id || row.course_id,
                title: row.title || (linkedLesson ? linkedLesson.title : null) || "Quiz",
                description: quizDescription || existing.description || "Please complete this quiz.",
                deadline: row.deadline || row.due_date || row.dueDate || existing.deadline || existing.due_date,
                file_url: row.file_url || row.attachment_url || (linkedLesson ? (linkedLesson.file_url || linkedLesson.attachment_url) : null) || existing.file_url || existing.attachment_url,
                file_name: row.file_name || row.attachment_name || (linkedLesson ? (linkedLesson.file_name || linkedLesson.title) : null) || existing.file_name || existing.attachment_name,
                file_path: row.file_path || existing.file_path,
                assessment_type: 'quiz',
            });
        }
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
        .eq('student_id', userData.user.id)
        .in('assessment_id', assignmentIds);

    if (resultsError) {
        console.warn(`[assignments] Grades fetch error (non-fatal) [Code: ${resultsError.code}]:`, resultsError.message);
    }

    // 3.5. Fetch feedback comments from submission_feedback table
    const { data: feedbacks, error: feedbacksError } = await supabase
        .from('submission_feedback')
        .select('comments, teacher_assessment_submissions!inner(assessment_id, student_id)')
        .eq('teacher_assessment_submissions.student_id', userData.user.id)
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
        .eq('student_id', userData.user.id)
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
        .eq('user_id', userData.user.id);

    const quizAttemptMap = new Map();
    (quizAttempts || []).forEach(att => {
        if (att && (att.quiz_id || att.assignment_id)) {
            quizAttemptMap.set(att.quiz_id || att.assignment_id, att);
        }
    });

    // Create lookup maps
    const resultsMap = new Map();
    (results || []).forEach(r => {
        resultsMap.set(r.assessment_id, r);
    });

    (quizAttempts || []).forEach(att => {
        const idKey = att.quiz_id || att.assignment_id;
        if (idKey && !resultsMap.has(idKey)) {
            resultsMap.set(idKey, {
                assessment_id: idKey,
                status: att.status || 'Graded',
                grade_value: att.score,
                feedback: `Quiz Score: ${att.score}% (${att.correct_count || 0}/${att.total_questions || 0})`
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

    return assignments.map((row: any) => {
        const myResult = resultsMap.get(row.id);
        const myAssessmentSub = assessmentSubMap.get(row.id);
        
        // Determine status
        let status: Assignment['status'] = "pending";
        
        const rawStatus = myResult?.status?.toLowerCase();
        
        if (rawStatus === 'returned') {
            status = 'returned';
        } else if (rawStatus === 'graded' || rawStatus === 'passed' || rawStatus === 'failed' || (myResult?.grade_value !== undefined && myResult?.grade_value !== null)) {
            status = 'graded';
        } else if (rawStatus === 'submitted' || myAssessmentSub) {
            status = 'submitted';
        }
        
        const dueDateRaw = row.deadline || row.due_date || row.dueDate;
        let dueDate = null;
        
        if (dueDateRaw) {
            // Replace space with T to ensure ISO8601 compliance for Hermes/JSC
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

        // Parse JSON file strings, handle objects or arrays if they exist
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
        } catch (e) {
            // Keep original values if not JSON
        }

        // Ensure file_url and file_name are strings or null
        if (fileUrl && typeof fileUrl !== 'string') fileUrl = String(fileUrl);
        if (fileName && typeof fileName !== 'string') fileName = String(fileName);

        return {
            id: row.id,
            subjectId: row.course_id,
            subject: subjectsMap.get(row.course_id) || "Subject", 
            title: row.title || "Assignment",
            dueDate: dueDate ? dueDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : "TBA",
            status: status as Assignment['status'],
            instructions: (typeof row.description === 'string' ? row.description : null) || "Please see subject details for more information.",
            file_url: fileUrl,
            file_name: fileName,
            assessment_type: (String(row.assessment_type || row.type || "assignment").trim().toLowerCase()) as Assignment['assessment_type'],
            submission: (myResult || myAssessmentSub) ? {
                id: myResult?.id || myAssessmentSub?.id || row.id, // Fallback to assignment id if not graded yet
                file_url: myAssessmentSub?.file_url || null,
                grade: myResult?.grade_value,
                teacher_comment: feedbackMap.get(row.id) || myResult?.feedback || null,
                status: myResult?.status || 'submitted',
                response_text: myAssessmentSub?.response_text || null,
            } : null,
        };
    });
}
