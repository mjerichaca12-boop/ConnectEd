import { supabase } from "../../lib/supabase";

export interface EnrollmentWithSubject {
    id: string;
    student_id: string;
    subject_id: string;
    status: 'pending' | 'accepted' | 'rejected' | 'approved' | 'active' | 'Active';
    grade?: any;
    attendance?: any;
    section?: string; // <-- Expose section dynamically from view
    subjects: {
        id: string;
        code: string;
        name: string;
        description?: string | null;
        teacher_id: string;
        grade_level?: string | null; // <-- Expose grade level dynamically from subject
        schedule?: string | null;
        credits?: number | null;
        capacity?: number | string | null;
        enrolled?: number | string | null;
        profiles?: {
            first_name: string;
            last_name: string;
        };
    };
}

export async function getMyEnrollments(): Promise<EnrollmentWithSubject[]> {
    const { data: userData, error: userError } = await supabase.auth.getUser();
    if (userError || !userData?.user) throw new Error("Not authenticated");

    const { data, error } = await supabase
        .from('teacher_student_assignments')
        .select(`
            id,
            student_id,
            subject_id,
            status,
            grades,
            attendance,
            section,
            subjects:subject_id (
                id,
                code,
                name,
                description,
                teacher_id,
                grade_level,
                schedule,
                credits,
                capacity,
                enrolled,
                profiles:teacher_id (
                    first_name,
                    last_name
                )
            )
        `)
        .eq('student_id', userData.user.id);

    if (error) {
        // PGRST205 = table not found in schema cache (table may not exist yet)
        // PGRST116 = relationship not found
        // In these cases, return empty array gracefully instead of crashing
        if (
            error.code === 'PGRST205' ||
            error.code === 'PGRST116' ||
            error.code === '42P01' ||
            error.message?.toLowerCase().includes('does not exist') ||
            error.message?.toLowerCase().includes('schema cache')
        ) {
            console.warn('[assignments] Table not found or schema cache issue:', error.message);
            return [];
        }
        throw error;
    }

    return (data || []).map((e: any) => ({
        id: String(e.id),
        student_id: e.student_id,
        subject_id: e.subject_id,
        status: e.status?.toLowerCase() === 'active' ? 'accepted' : e.status?.toLowerCase(),
        grade: e.grades,
        attendance: e.attendance,
        section: e.section,
        subjects: e.subjects
    })) as any;
}
