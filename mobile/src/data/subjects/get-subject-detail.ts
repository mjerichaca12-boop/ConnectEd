import { supabase } from "../../lib/supabase";

export interface SubjectDetail {
    id: string;
    code: string;
    name: string;
    description: string;
    teacher_id: string;
    teacher_name: string;
    teacher_email?: string;
    grade_level?: string;
    schedule?: string;
    section?: string;
}

export async function getSubjectDetail(id: string): Promise<SubjectDetail | null> {
    const { data: userData } = await supabase.auth.getUser();
    const userId = userData?.user?.id;

    // 1. Fetch Subject Base Data
    const { data: subjectData, error: subjectError } = await supabase
        .from('subjects')
        .select(`
            *,
            profiles:teacher_id (
                first_name,
                last_name,
                email
            )
        `)
        .eq('id', id)
        .single();

    if (subjectError) {
        if (subjectError.code === 'PGRST116') return null; // Not found
        throw subjectError;
    }

    let teacherProfile = subjectData.profiles as any;
    let teacherId = subjectData.teacher_id;
    let section: string | undefined = undefined;

    // 2. Fetch enrollment/assignment for the active student to get the section
    if (userId) {
        const { data: assignmentData } = await supabase
            .from('teacher_student_assignments')
            .select(`
                teacher_id,
                section,
                profiles:teacher_id (
                    first_name,
                    last_name,
                    email
                )
            `)
            .eq('subject_id', id)
            .eq('student_id', userId)
            .maybeSingle();

        if (assignmentData) {
            section = assignmentData.section || undefined;
            // Optionally update teacher profile if dynamic assignments override is intended,
            // but prioritize canonical subjects.teacher_id as primary source of truth.
            if (assignmentData.profiles && assignmentData.teacher_id !== subjectData.teacher_id) {
                // Keep subjects.profiles as canonical, but allow teacher assignment fallback if no subject teacher is assigned
                if (!teacherProfile) {
                    teacherProfile = assignmentData.profiles;
                    teacherId = assignmentData.teacher_id;
                }
            }
        }
    }

    const teacherName = teacherProfile 
        ? `${teacherProfile.first_name || ''} ${teacherProfile.last_name || ''}`.trim() 
        : "Unknown Teacher";

    return {
        id: subjectData.id,
        code: subjectData.code,
        name: subjectData.name,
        description: subjectData.description,
        teacher_id: teacherId,
        teacher_name: teacherName,
        teacher_email: teacherProfile?.email,
        grade_level: subjectData.grade_level || undefined,
        schedule: subjectData.schedule || undefined,
        section: section,
    };
}
