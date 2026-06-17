import { supabase } from "../../lib/supabase";
import { Meeting } from "../../types";

export interface GetMeetingsArgs {
    subjectId?: string;
    limit?: number;
}

export async function getMeetings({ subjectId, limit }: GetMeetingsArgs = {}): Promise<Meeting[]> {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    const isValidId = !!(subjectId && uuidRegex.test(subjectId));

    if (subjectId && !isValidId) {
        // If subjectId was provided but invalid, return empty early
        console.warn(`[meetings] Invalid subjectId provided: ${subjectId}`);
        return [];
    }

    let query = supabase
        .from('online_class_meetings')
        .select('*')
        .order('scheduled_date', { ascending: true, nullsFirst: false })
        .order('scheduled_time', { ascending: true, nullsFirst: false });

    if (isValidId) {
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

    return (data || []).map(m => {
        let displayTime = m.time;
        if (!displayTime && m.scheduled_date) {
            displayTime = m.scheduled_time 
                ? `${m.scheduled_date} at ${String(m.scheduled_time).slice(0, 5)}`
                : `${m.scheduled_date}`;
        }
        if (!displayTime) {
            displayTime = "TBA";
        }

        return {
            id: String(m.id),
            subject: m.subject_code || m.subject || "Unknown",
            title: m.title,
            time: displayTime,
            duration: m.duration || (m.duration_minutes ? `${m.duration_minutes}m` : "1h"),
            subject_id: m.subject_id,
            meeting_link: m.meeting_link,
        };
    });
}
