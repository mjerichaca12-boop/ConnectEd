import { supabase } from "../../lib/supabase";
import { isSectionMatch, isGradeLevelMatch } from "../../utils/section-matcher";

export interface Subject {
    id: string;
    code: string;
    name: string;
    description: string;
    teacher_id: string;
    grade_level?: string | null;
    section?: string | null;
    profiles?: {
        first_name: string;
        last_name: string;
        middle_name?: string;
        suffix?: string;
        name_extension?: string;
    };
}

export async function getAllSubjects(): Promise<Subject[]> {
    const { data: userData } = await supabase.auth.getUser();
    const userId = userData?.user?.id;

    let studentSection = "";
    let studentGrade = "";
    let isStudent = false;

    if (userId) {
        try {
            const { data: profile } = await supabase
                .from('profiles')
                .select('id, section, year_level, role')
                .eq('id', userId)
                .maybeSingle();

            if (profile) {
                studentSection = profile.section || "";
                studentGrade = profile.year_level || "";
                isStudent = !profile.role || profile.role === 'student';
            }
        } catch (profErr) {
            console.warn('[getAllSubjects] profile fetch fallback:', profErr);
        }
    }

    let res = await supabase
        .from('subjects')
        .select(`
            id,
            code,
            name,
            description,
            teacher_id,
            grade_level,
            section,
            profiles:teacher_id (
                first_name,
                last_name,
                suffix
            )
        `);

    if (res.error && (res.error.code === '42703' || res.error.message?.includes('suffix') || res.error.message?.includes('section'))) {
        res = await supabase
            .from('subjects')
            .select(`
                id,
                code,
                name,
                description,
                teacher_id,
                grade_level,
                profiles:teacher_id (
                    first_name,
                    last_name
                )
            `);
    }

    if (res.error) {
        throw res.error;
    }

    const rows = (res.data || []) as Subject[];

    // If user is a student, filter strictly to subjects matching their section & grade level
    if (isStudent) {
        return rows.filter((sub: any) => {
            const subjectSection = sub.section;
            const subjectGrade = sub.grade_level;

            if (!isSectionMatch(studentSection, subjectSection)) {
                return false;
            }
            if (!isGradeLevelMatch(studentGrade, subjectGrade)) {
                return false;
            }
            return true;
        });
    }

    return rows;
}
