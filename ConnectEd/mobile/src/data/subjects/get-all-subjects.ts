import { supabase } from "../../lib/supabase";

export interface Subject {
    id: string;
    code: string;
    name: string;
    description: string;
    teacher_id: string;
    profiles?: {
        first_name: string;
        last_name: string;
    };
}

export async function getAllSubjects(): Promise<Subject[]> {
    const { data, error } = await supabase
        .from('subjects')
        .select(`
            id,
            code,
            name,
            description,
            teacher_id,
            profiles:teacher_id (
                first_name,
                last_name
            )
        `);

    if (error) {
        throw error;
    }

    return data as any[];
}
