import { supabase } from "../../lib/supabase";

export interface GetClassStudentsArgs {
    subjectId: string;
}

export interface ClassStudent {
    id: string;      // The profile ID
    enrollmentId: string;
    studentId: string;
    name: string;
    email: string;
    phone: string;
    grades: Record<string, any>;
    attendance: Record<string, any>;
    status: string;
}

export async function getClassStudents({ subjectId }: GetClassStudentsArgs): Promise<ClassStudent[]> {
    if (!subjectId) return [];

    const { data, error } = await supabase
        .from('enrollments')
        .select(`
            id,
            status,
            grade,
            attendance,
            student_id,
            profiles:student_id (
                id,
                first_name,
                last_name,
                middle_name
            )
        `)
        .eq('subject_id', subjectId);

    if (error) {
        throw error;
    }

    // Since we don't have email/phone in profiles yet (it's in auth.users), 
    // for a complete implementation, admin access is usually needed to get emails.
    // For now, we return what's in profiles and map appropriately.
    return (data || []).map((enrollment: any) => {
        const profile = enrollment.profiles || {};
        const fullName = `${profile.first_name || ''} ${profile.middle_name || ''} ${profile.last_name || ''}`.trim().replace(/\s+/g, ' ');
        
        return {
            id: profile.id || enrollment.student_id,
            enrollmentId: enrollment.id,
            studentId: enrollment.student_id,
            name: fullName || "Unknown Student",
            email: "student@example.com", // Placeholder since auth.users isn't joinable safely
            phone: "N/A",
            grades: enrollment.grade || {},
            attendance: enrollment.attendance || {},
            status: enrollment.status === "accepted" ? "Active" : 
                    enrollment.status === "pending" ? "Pending" : "Inactive"
        };
    });
}
