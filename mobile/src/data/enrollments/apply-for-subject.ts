import { supabase } from "../../lib/supabase";

export interface ApplyForSubjectArgs {
    subjectId: string;
}

export async function applyForSubject({ subjectId }: ApplyForSubjectArgs) {
    const { data: userData, error: userError } = await supabase.auth.getUser();
    if (userError || !userData?.user) throw new Error("Not authenticated");

    const { data, error } = await supabase
        .from('enrollments')
        .insert({
            subject_id: subjectId,
            student_id: userData.user.id,
            status: 'pending'
        })
        .select()
        .single();

    if (error) {
        throw error;
    }

    return data;
}
