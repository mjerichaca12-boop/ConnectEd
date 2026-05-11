import { supabase } from "../../lib/supabase";

export interface SchoolEvent {
    id: string;
    title: string;
    date: string;
    type: string;
    color: string;
    created_at: string;
}

export async function getSchoolEvents(limit?: number): Promise<SchoolEvent[]> {
    let query = supabase
        .from('school_events')
        .select('*')
        .order('date', { ascending: true });

    if (limit) {
        query = query.limit(limit);
    }

    const { data, error } = await query;

    if (error) {
        console.error('[events] Error fetching events:', error);
        return [];
    }

    return data || [];
}
