import { supabase } from "../../lib/supabase";

export interface UpdateStudentStatusArgs {
    enrollmentId: string;
    status: 'pending' | 'accepted' | 'rejected';
}

export async function updateStudentStatus({ enrollmentId, status }: UpdateStudentStatusArgs) {
    const { data, error } = await supabase
        .from('enrollments')
        .update({ status })
        .eq('id', enrollmentId)
        .select(`
            *,
            subjects (
                name
            )
        `)
        .single();

    if (error) {
        throw error;
    }

    if (status === 'accepted' && data) {
        const subjectName = Array.isArray(data.subjects) 
            ? data.subjects[0]?.name 
            : (data.subjects as any)?.name || 'a class';
            
        // Fire and forget notification
        supabase.from('notifications').insert({
            user_id: data.student_id,
            title: `Your application to ${subjectName} was accepted!`,
            type: 'alert',
            is_read: false
        }).then();
    }

    if (error) {
        throw error;
    }

    return data;
}
