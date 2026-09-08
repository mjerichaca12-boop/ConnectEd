import { supabase } from "../../lib/supabase";
import { formatTeacherName } from "../../utils/name-formatter";

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

    // 1. Fetch Subject Base Data (with suffix, fallback if column missing)
    let subjectRes = await supabase
        .from('subjects')
        .select(`
            *,
            profiles:teacher_id (
                first_name,
                last_name,
                suffix,
                email
            )
        `)
        .eq('id', id)
        .single();

    if (subjectRes.error && (subjectRes.error.code === '42703' || subjectRes.error.message?.includes('suffix'))) {
        subjectRes = await supabase
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
    }

    const { data: subjectData, error: subjectError } = subjectRes;

    if (subjectError) {
        if (subjectError.code === 'PGRST116') return null; // Not found
        throw subjectError;
    }

    let teacherProfile = subjectData.profiles as any;
    let teacherId = subjectData.teacher_id;
    let section: string | undefined = subjectData.section || undefined;

    // 2. Fetch enrollment/assignment for the active student to get the section
    if (userId) {
        let assignmentRes = await supabase
            .from('teacher_student_assignments')
            .select(`
                teacher_id,
                section,
                profiles:teacher_id (
                    first_name,
                    last_name,
                    suffix,
                    email
                )
            `)
            .eq('subject_id', id)
            .eq('student_id', userId)
            .maybeSingle();

        if (assignmentRes.error && (assignmentRes.error.code === '42703' || assignmentRes.error.message?.includes('suffix'))) {
            assignmentRes = await supabase
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
        }

        const assignmentData = assignmentRes.data;

        if (assignmentData) {
            section = assignmentData.section || section;
            // Optionally update teacher profile if dynamic assignments override is intended,
            // but prioritize canonical subjects.teacher_id as primary source of truth.
            if (assignmentData.profiles && assignmentData.teacher_id !== subjectData.teacher_id) {
                // Keep subjects.profiles as canonical, but allow teacher assignment fallback if no subject teacher is assigned
                if (!teacherProfile) {
                    teacherProfile = assignmentData.profiles;
                    teacherId = assignmentData.teacher_id;
                }
            }
        } else {
            // Check if teacher assignment exists for this teacher user
            const { data: teacherAssignment } = await supabase
                .from('teacher_student_assignments')
                .select('section')
                .eq('subject_id', id)
                .eq('teacher_id', userId)
                .maybeSingle();

            if (teacherAssignment?.section) {
                section = teacherAssignment.section || section;
            }
        }

        // Fallback to user profile section if still not found
        if (!section) {
            const { data: profileData } = await supabase
                .from('profiles')
                .select('section')
                .eq('id', userId)
                .maybeSingle();

            if (profileData?.section) {
                section = profileData.section;
            }
        }
    }

    const teacherName = formatTeacherName(teacherProfile) || "Unknown Teacher";

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
