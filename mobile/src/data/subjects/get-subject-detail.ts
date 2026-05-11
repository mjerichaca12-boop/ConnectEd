import { supabase } from "../../lib/supabase";

export interface SubjectDetail {
    id: string;
    code: string;
    name: string;
    description: string;
    teacher_id: string;
    teacher_name: string;
    teacher_email?: string;
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

    // 2. Fetch specific teacher from assignments if available (Priority)
    if (userId) {
        const { data: assignmentData } = await supabase
            .from('teacher_student_assignments')
            .select(`
                teacher_id,
                profiles:teacher_id (
                    first_name,
                    last_name,
                    email
                )
            `)
            .eq('subject_id', id)
            .eq('student_id', userId)
            .single();

        if (assignmentData?.profiles) {
            teacherProfile = assignmentData.profiles;
            teacherId = assignmentData.teacher_id;
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
    };
}
