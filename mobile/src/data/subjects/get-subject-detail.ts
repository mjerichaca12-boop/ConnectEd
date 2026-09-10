import { supabase } from "../../lib/supabase";
import { formatTeacherName } from "../../utils/name-formatter";
import { isSectionMatch, isGradeLevelMatch } from "../../utils/section-matcher";

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
    const teacherId = subjectData.teacher_id;
    let section: string | undefined = subjectData.section || undefined;

    // If teacher_id is set on subject but profile was not resolved, fetch profile directly
    if (teacherId && !teacherProfile) {
        let profRes = await supabase
            .from('profiles')
            .select('first_name, last_name, suffix, email')
            .eq('id', teacherId)
            .maybeSingle();

        if (profRes.error && (profRes.error.code === '42703' || profRes.error.message?.includes('suffix'))) {
            profRes = await supabase
                .from('profiles')
                .select('first_name, last_name, email')
                .eq('id', teacherId)
                .maybeSingle();
        }

        if (profRes.data) {
            teacherProfile = profRes.data;
        }
    }

    // 2. Fetch user profile and enrollment/assignment for section verification
    if (userId) {
        let profileData: any = null;
        try {
            const { data } = await supabase
                .from('profiles')
                .select('id, role, section, year_level')
                .eq('id', userId)
                .maybeSingle();
            profileData = data;
        } catch (e) {
            console.warn('[getSubjectDetail] profile fetch warning:', e);
        }

        const isStudent = !profileData?.role || profileData.role === 'student';

        const { data: assignmentData } = await supabase
            .from('teacher_student_assignments')
            .select('teacher_id, section')
            .eq('subject_id', id)
            .eq('student_id', userId)
            .maybeSingle();

        if (assignmentData?.section) {
            section = assignmentData.section || section;
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

        // Enforce Section & Grade Level Parity for students
        if (isStudent && profileData) {
            const studentSection = profileData.section || "";
            const studentGrade = profileData.year_level || "";
            const resolvedSubjectSection = subjectData.section || assignmentData?.section;
            const resolvedSubjectGrade = subjectData.grade_level;

            if (!isSectionMatch(studentSection, resolvedSubjectSection)) {
                console.log(`[getSubjectDetail] Blocked access: student section '${studentSection}' does not match subject section '${resolvedSubjectSection}'`);
                return null;
            }

            if (!isGradeLevelMatch(studentGrade, resolvedSubjectGrade)) {
                console.log(`[getSubjectDetail] Blocked access: student grade '${studentGrade}' does not match subject grade '${resolvedSubjectGrade}'`);
                return null;
            }
        }

        // Fallback to user profile section if still not set
        if (!section && profileData?.section) {
            section = profileData.section;
        }
    }

    const teacherName = teacherId
        ? (formatTeacherName(teacherProfile) || "Unknown Teacher")
        : "No teacher assigned";

    return {
        id: subjectData.id,
        code: subjectData.code,
        name: subjectData.name,
        description: subjectData.description,
        teacher_id: teacherId || "",
        teacher_name: teacherName,
        teacher_email: teacherId ? (teacherProfile?.email || "") : undefined,
        grade_level: subjectData.grade_level || undefined,
        schedule: subjectData.schedule || undefined,
        section: section,
    };
}
