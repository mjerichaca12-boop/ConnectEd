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
        middle_name?: string;
        suffix?: string;
        name_extension?: string;
    };
}

export async function getAllSubjects(): Promise<Subject[]> {
    let res = await supabase
        .from('subjects')
        .select(`
            id,
            code,
            name,
            description,
            teacher_id,
            profiles:teacher_id (
                first_name,
                last_name,
                suffix
            )
        `);

    if (res.error && (res.error.code === '42703' || res.error.message?.includes('suffix'))) {
        res = await supabase
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
    }

    if (res.error) {
        throw res.error;
    }

    return res.data as any[];
}
