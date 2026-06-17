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

    // 1. Fetch assignments separately to avoid PGRST200 join errors
    // Use the RPC function to bypass the strict Row Level Security
    let assignmentQuery = supabase.rpc('get_my_assignments_activity');

    if (isValidId) {
        console.log(`[assignments] Fetching for specific subjectId: ${subjectId}`);
        assignmentQuery = assignmentQuery.eq('course_id', subjectId);
    } else if (subjectId && subjectId !== 'undefined' && subjectId !== '[id]') {
        // If subjectId was provided but is not a placeholder and is invalid, return empty
        console.warn(`[assignments] Invalid subjectId provided: ${subjectId}`);
        return [];
    } else {
        console.log(`[assignments] Fetching global feed. allCourseIds count: ${allCourseIds.length}`);
        assignmentQuery = assignmentQuery.in('course_id', allCourseIds);
    }

    const { data: assignments, error: assignmentError } = await assignmentQuery;

    if (assignmentError) {
        console.error('[assignments] Assignment query error:', assignmentError);
        throw new Error(assignmentError.message || JSON.stringify(assignmentError));
    }

    console.log(`[assignments] Found ${assignments?.length || 0} assignments.`);

    if (!assignments || assignments.length === 0) return [];

    const assignmentIds = assignments.map((a: any) => a.id);

    // 2. Fetch submissions for these assignments
    const { data: submissions, error: submissionsError } = await supabase
        .from('submissions')
        .select('assignment_id, file_url')
        .eq('user_id', userData.user.id)
        .in('assignment_id', assignmentIds);

    if (submissionsError) {
        console.warn(`[assignments] Submissions fetch error (non-fatal) [Code: ${submissionsError.code}]:`, submissionsError.message);
    }

    // 3. Fetch grades/results for these assignments separately
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

    // Create lookup maps
    const resultsMap = new Map();
    (results || []).forEach(r => {
        resultsMap.set(r.assessment_id, r);
    });

    const submissionsMap = new Map();
    (submissions || []).forEach(s => {
        submissionsMap.set(s.assignment_id, s);
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
        const mySubmission = submissionsMap.get(row.id);
        
        // Determine status
        let status: Assignment['status'] = "pending";
        
        const rawStatus = myResult?.status?.toLowerCase();
        
        if (rawStatus === 'graded' || rawStatus === 'returned') {
            status = 'submitted'; // Or 'graded' if we want to distinguish
        } else if (rawStatus === 'submitted' || (mySubmission && mySubmission.file_url)) {
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

        // Parse JSON file strings if they exist
        let fileUrl = row.file_url;
        let fileName = row.file_name;

        try {
            if (typeof fileUrl === 'string' && fileUrl.startsWith('[')) {
                const urls = JSON.parse(fileUrl);
                fileUrl = urls[0] || null;
            }
            if (typeof fileName === 'string' && fileName.startsWith('[')) {
                const names = JSON.parse(fileName);
                fileName = names[0] || null;
            }
        } catch (e) {
            // Keep original values if not JSON
        }

        return {
            id: row.id,
            subjectId: row.course_id,
            subject: subjectsMap.get(row.course_id) || "Subject", 
            title: row.title || "Assignment",
            dueDate: dueDate ? dueDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : "TBA",
            status: status as Assignment['status'],
            instructions: row.description || "Please see subject details for more information.",
            file_url: fileUrl,
            file_name: fileName,
            submission: (myResult || mySubmission) ? {
                id: myResult?.id || row.id, // Fallback to assignment id if not graded yet
                file_url: mySubmission?.file_url || null,
                grade: myResult?.grade_value,
                teacher_comment: feedbackMap.get(row.id) || myResult?.feedback || null,
                status: myResult?.status || 'submitted',
            } : null,
        };
    });
}
