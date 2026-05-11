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

    let query = supabase
        .from('assignments_activity')
        .select(`
            *,
            subjects:subject_id (
                id,
                code,
                name
            ),
            submissions (
                id,
                status,
                grade,
                teacher_comment,
                file_url
            )
        `);

    if (subjectId) {
        query = query.eq('subject_id', subjectId);
    } else {
        query = query.in('subject_id', approvedSubjectIds);
    }

    const { data, error } = await query;

    if (error) {
        if (error.code === 'PGRST205' || error.message?.toLowerCase().includes('not found')) {
            console.warn('[assignments] tables not found');
            return [];
        }
        throw error;
    }

    return (data || []).map(row => {
        // Filter submissions for this specific student
        // Note: the supabase join might return all submissions unless we filter, 
        // wait, we can't easily filter the inner join in supabase JS without RLS doing it.
        // But RLS on submissions says: "Students can view their own submissions." 
        // So it will automatically only return this student's submissions!
        const mySubmission = row.submissions?.[0];
        let status: Assignment['status'] = mySubmission?.status || "pending";

        if (!mySubmission && row.due_date && new Date(row.due_date) < new Date()) {
            status = "late";
        }

        return {
            id: row.id,
            subjectId: row.subject_id,
            subject: row.subjects?.code || "Unknown",
            title: row.title || "Subject Assignment",
            dueDate: row.due_date ? new Date(row.due_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : "TBA",
            status: status,
            instructions: row.description || "Please see subject details for more information.",
            file_url: row.file_url, // Original assignment file
            submission: mySubmission ? {
                id: mySubmission.id,
                file_url: mySubmission.file_url,
                grade: mySubmission.grade,
                teacher_comment: mySubmission.teacher_comment,
                status: mySubmission.status,
            } : null,
        };
    });
}
