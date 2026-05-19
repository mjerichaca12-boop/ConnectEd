import { supabase } from "../../lib/supabase";
import { CalendarEvent } from "../../types";

export async function getCalendarEvents(): Promise<CalendarEvent[]> {
    const { data, error } = await supabase
        .from('school_calendar_events')
        .select('*')
        .order('event_date', { ascending: true });

    if (error) {
        // Fallback for missing table during dev
        if (error.code === 'PGRST205' || error.message?.includes('not found')) {
            console.warn('[calendar] table school_calendar_events not found');
            return [];
        }
        throw error;
    }

    return (data || []).map(event => ({
        id: event.id,
        date: event.event_date,
        title: event.title,
        type: event.type || 'Event',
        description: event.description,
        color: event.color || '#3B82F6',
    }));
}
