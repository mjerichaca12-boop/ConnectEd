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

    if (approvedSubjectIds.length === 0) {
        return [];
    }

    // 1. Fetch assignments separately to avoid PGRST200 join errors
    // Use explicit columns to avoid any accidental 'subject_id' injection or schema cache issues
    let assignmentQuery = supabase
        .from('assignments_activity')
        .select('*');

    if (subjectId) {
        assignmentQuery = assignmentQuery.eq('course_id', subjectId);
    } else {
        assignmentQuery = assignmentQuery.in('course_id', approvedSubjectIds);
    }

    const { data: assignments, error: assignmentError } = await assignmentQuery;

    if (assignmentError) {
        console.error('[assignments] Assignment query error:', assignmentError);
        return [];
    }

    if (!assignments || assignments.length === 0) return [];

    // 2. Fetch grades/results for these assignments separately
    const assignmentIds = assignments.map(a => a.id);
    const { data: results, error: resultsError } = await supabase
        .from('teacher_assessment_grades')
        .select('id, assessment_id, status, grade_value, feedback')
        .eq('student_id', userData.user.id)
        .in('assessment_id', assignmentIds);

    if (resultsError) {
        console.warn('[assignments] Grades fetch error (non-fatal):', resultsError);
    }

    // Create a lookup map for results
    const resultsMap = new Map();
    (results || []).forEach(r => {
        resultsMap.set(r.assessment_id, r);
    });

    return assignments.map(row => {
        const myResult = resultsMap.get(row.id);
        let status: Assignment['status'] = myResult?.status?.toLowerCase() || "pending";

        // Normalize status names to match UI
        if (status === 'graded') status = 'submitted';
        
        const dueDate = row.deadline || row.due_date || row.dueDate;
        if (!myResult && dueDate && new Date(dueDate) < new Date()) {
            status = "late";
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
            subject: "Subject", // Will be refined by UI or another fetch if needed
            title: row.title || "Assignment",
            dueDate: dueDate ? new Date(dueDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : "TBA",
            status: status as Assignment['status'],
            instructions: row.description || "Please see subject details for more information.",
            file_url: fileUrl,
            file_name: fileName,
            submission: myResult ? {
                id: myResult.id,
                file_url: null,
                grade: myResult.grade_value,
                teacher_comment: myResult.feedback,
                status: myResult.status,
            } : null,
        };
    });
}
