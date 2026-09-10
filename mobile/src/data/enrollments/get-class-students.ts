import { supabase } from "../../lib/supabase";

export interface GetClassStudentsArgs {
    subjectId: string;
}

export interface ClassStudent {
    id: string;      // The profile ID
    enrollmentId: string;
    studentId: string;
    lrn?: string;
    avatarUrl?: string;
    name: string;
    email: string;
    phone: string;
    grades: Record<string, any>;
    status: string;
}

export async function getClassStudents({ subjectId }: GetClassStudentsArgs): Promise<ClassStudent[]> {
    if (!subjectId) return [];

    const { data: enrollmentRows, error } = await supabase
        .from('enrollments')
        .select(`
            id,
            status,
            grade,
            student_id,
            profiles:student_id (
                id,
                first_name,
                last_name,
                middle_name,
                lrn,
                avatar_url
            )
        `)
        .eq('subject_id', subjectId);

    if (error) {
        throw error;
    }

    const studentIds = (enrollmentRows || [])
        .map((e: any) => e.student_id)
        .filter(Boolean);

    let dbGradesMap = new Map<string, any>();
    if (studentIds.length > 0) {
        try {
            const { data: gradesData } = await supabase
                .from('teacher_student_grades')
                .select('*')
                .eq('subject_id', subjectId)
                .in('student_id', studentIds);

            (gradesData || []).forEach((row: any) => {
                if (row.student_id) {
                    dbGradesMap.set(String(row.student_id), row);
                }
            });
        } catch (err) {
            console.warn('[getClassStudents] Could not fetch teacher_student_grades:', err);
        }
    }

    return (enrollmentRows || []).map((enrollment: any) => {
        const profile = enrollment.profiles || {};
        const fullName = `${profile.first_name || ''} ${profile.middle_name || ''} ${profile.last_name || ''}`.trim().replace(/\s+/g, ' ');
        const sId = String(enrollment.student_id || profile.id || '');
        const dbGrade = dbGradesMap.get(sId);
        const enrollmentGrades = (typeof enrollment.grade === 'object' && enrollment.grade !== null) ? enrollment.grade : {};

        const mergedGrades: Record<string, any> = {
            ...enrollmentGrades,
            q1: Number(dbGrade?.quarter1_grade ?? enrollmentGrades?.q1 ?? 0),
            q2: Number(dbGrade?.quarter2_grade ?? enrollmentGrades?.q2 ?? 0),
            q3: Number(dbGrade?.quarter3_grade ?? enrollmentGrades?.q3 ?? 0),
            q4: Number(dbGrade?.quarter4_grade ?? enrollmentGrades?.q4 ?? 0),
            overall: Number(dbGrade?.overall_grade ?? enrollmentGrades?.overall ?? 0),
            quizAverage: Number(dbGrade?.quiz_average ?? enrollmentGrades?.quizAverage ?? 0),
            activityGrade: Number(dbGrade?.activity_grade ?? enrollmentGrades?.activityGrade ?? 0),
            assignmentGrade: Number(dbGrade?.assignment_grade ?? enrollmentGrades?.assignmentGrade ?? 0),
            examGrade: Number(dbGrade?.exam_grade ?? enrollmentGrades?.examGrade ?? 0),
            gradeComputation: dbGrade?.grade_computation ?? enrollmentGrades?.gradeComputation ?? null,
            subjectCategory: dbGrade?.subject_category ?? enrollmentGrades?.subjectCategory ?? 'Languages / AP / EsP',
        };

        return {
            id: profile.id || enrollment.student_id,
            enrollmentId: enrollment.id,
            studentId: enrollment.student_id,
            lrn: profile.lrn ? String(profile.lrn) : undefined,
            avatarUrl: profile.avatar_url ? String(profile.avatar_url) : undefined,
            name: fullName || "Unknown Student",
            email: "student@example.com",
            phone: "N/A",
            grades: mergedGrades,
            status: enrollment.status === "accepted" ? "Active" : 
                    enrollment.status === "pending" ? "Pending" : "Inactive"
        };
    });
}
