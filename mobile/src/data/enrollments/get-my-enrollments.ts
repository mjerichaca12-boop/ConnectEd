import { supabase } from "../../lib/supabase";
import { isSectionMatch, isGradeLevelMatch } from "../../utils/section-matcher";

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
        section?: string | null;
        schedule?: string | null;
        credits?: number | null;
        capacity?: number | string | null;
        enrolled?: number | string | null;
        profiles?: {
            first_name: string;
            last_name: string;
            middle_name?: string;
            suffix?: string;
            name_extension?: string;
        };
    };
}

export async function getMyEnrollments(): Promise<EnrollmentWithSubject[]> {
    const { data: userData, error: userError } = await supabase.auth.getUser();
    if (userError || !userData?.user) throw new Error("Not authenticated");

    const userId = userData.user.id;

    // 1. Fetch current student's profile to get assigned section & grade level
    let studentSection = "";
    let studentGrade = "";
    let isStudent = true;

    try {
        const { data: profile } = await supabase
            .from('profiles')
            .select('id, section, year_level, role')
            .eq('id', userId)
            .maybeSingle();

        if (profile) {
            studentSection = profile.section || "";
            studentGrade = profile.year_level || "";
            if (profile.role && profile.role !== 'student') {
                isStudent = false;
            }
        }
    } catch (profErr) {
        console.warn('[getMyEnrollments] profile fetch fallback:', profErr);
    }

    // 2. Fetch assignments from teacher_student_assignments
    let res = await supabase
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
                section,
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
        .eq('student_id', userId);

    if (res.error && (res.error.code === '42703' || res.error.message?.includes('section'))) {
        // Fallback without subjects.section if column doesn't exist on subjects table
        res = await supabase
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
            .eq('student_id', userId);
    }

    const { data, error } = res;

    if (error) {
        // PGRST205 = table not found in schema cache
        // PGRST116 = relationship not found
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

    // 3. Filter by section and grade level parity for students
    const validRows = (data || []).filter((e: any) => {
        if (!isStudent) return true;

        const subjectSection = e.subjects?.section || e.section;
        const subjectGrade = e.subjects?.grade_level;

        // Verify section parity
        if (!isSectionMatch(studentSection, subjectSection)) {
            return false;
        }

        // Verify grade level parity
        if (!isGradeLevelMatch(studentGrade, subjectGrade)) {
            return false;
        }

        return true;
    });

    return validRows.map((e: any) => {
        const resolvedSection = e.subjects?.section || e.section || studentSection;
        return {
            id: String(e.id),
            student_id: e.student_id,
            subject_id: e.subject_id,
            status: e.status?.toLowerCase() === 'active' ? 'accepted' : e.status?.toLowerCase(),
            grade: e.grades,
            attendance: e.attendance,
            section: resolvedSection,
            subjects: e.subjects ? {
                ...e.subjects,
                section: resolvedSection,
            } : e.subjects
        };
    }) as any;
}
