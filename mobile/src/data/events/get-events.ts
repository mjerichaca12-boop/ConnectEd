import { supabase } from "../../lib/supabase";

export interface SchoolEvent {
    id: string;
    title: string;
    date: string;       // mapped from event_date
    type: string;       // mapped from target_audience
    color: string;      // derived from target_audience
    description?: string;
    created_at: string;
}

/** Map target_audience to a display color */
function audienceColor(audience: string | null): string {
    switch (audience) {
        case 'Teachers':   return '#3B82F6'; // blue
        case 'Students':   return '#10B981'; // green
        default:           return '#F59E0B'; // amber – School-wide or unknown
    }
}

/**
 * Fetches upcoming school events from the `school_calendar_events` table.
 * Columns are mapped so that callers can access `.date`, `.type`, and `.color`
 * as if the old `school_events` schema were still in use.
 *
 * @param limit - Optional cap on the number of results returned.
 */
export async function getSchoolEvents(limit?: number): Promise<SchoolEvent[]> {
    let query = supabase
        .from('school_calendar_events')
        .select('id, title, event_date, event_time, target_audience, description, created_at')
        .order('event_date', { ascending: true });

    if (limit) {
        query = query.limit(limit);
    }

    const { data, error } = await query;

    if (error) {
        console.error('[events] Error fetching events:', error);
        return [];
    }

    return (data ?? []).map((row) => ({
        id:          String(row.id),
        title:       row.title,
        date:        row.event_date,   // keep the same field name the UI expects
        type:        row.target_audience ?? 'Event',
        color:       audienceColor(row.target_audience),
        description: row.description ?? undefined,
        created_at:  row.created_at,
    }));
}
