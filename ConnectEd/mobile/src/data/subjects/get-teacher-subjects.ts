import { supabase } from "../../lib/supabase";

export async function getTeacherSubjects() {
    const { data: userData, error: userError } = await supabase.auth.getUser();
    if (userError || !userData?.user) throw new Error("Not authenticated");

    const { data, error } = await supabase
        .from('subjects')
        .select(`
            id,
            name,
            code,
            description,
            created_at,
            enrollments (
                id,
                status
            )
        `)
        .eq('teacher_id', userData.user.id)
        .order('name');

    if (error) {
        throw error;
    }

    // Process enrollments locally to just return lengths to avoid massive network loads later
    return data.map(subject => ({
        ...subject,
        studentsCount: subject.enrollments?.filter((e: any) => e.status === 'accepted').length || 0,
        pendingCount: subject.enrollments?.filter((e: any) => e.status === 'pending').length || 0,
    }));
}
