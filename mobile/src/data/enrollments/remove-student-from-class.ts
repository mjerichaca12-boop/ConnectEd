import { supabase } from "../../lib/supabase";

export async function removeStudentFromClass({ enrollmentId }: { enrollmentId: string }) {
    const { error } = await supabase
        .from('enrollments')
        .delete()
        .eq('id', enrollmentId);

    if (error) throw error;
}
