import { supabase } from "../../lib/supabase";
import { Meeting } from "../../types";

export interface GetMeetingsArgs {
    subjectId?: string;
    limit?: number;
}

export async function getMeetings({ subjectId, limit }: GetMeetingsArgs = {}): Promise<Meeting[]> {
    let query = supabase
        .from('online_class_meetings')
        .select('*')
        .order('time', { ascending: true });

    if (subjectId) {
        query = query.eq('subject_id', subjectId);
    }

    if (limit) {
        query = query.limit(limit);
    }

    const { data, error } = await query;

    if (error) {
        if (error.code === 'PGRST205' || error.message?.includes('not found')) {
            console.warn('[meetings] table online_class_meetings not found');
            return [];
        }
        throw error;
    }

    return (data || []).map(m => ({
        id: m.id,
        subject: m.subject_code || m.subject || "Unknown",
        title: m.title,
        time: m.time,
        duration: m.duration || "1h",
        subject_id: m.subject_id,
        meeting_link: m.meeting_link,
    }));
}
