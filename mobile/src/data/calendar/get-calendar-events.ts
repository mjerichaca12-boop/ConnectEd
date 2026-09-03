import { supabase } from "../../lib/supabase";
import { CalendarEvent } from "../../types";

/**
 * Retrieves all upcoming school calendar events from the database.
 * Orders the retrieved events chronologically by `event_date` and dynamically maps
 * curated, high-aesthetic color schemes according to the target audience.
 *
 * @returns {Promise<CalendarEvent[]>} List of mapped calendar events.
 */
export async function getCalendarEvents(): Promise<CalendarEvent[]> {
    const { data: userData } = await supabase.auth.getUser();
    const userId = userData?.user?.id;

    let query = supabase
        .from('school_calendar_events')
        .select('*')
        .order('event_date', { ascending: true });
    if (userId) {
        const { data: profile } = await supabase.from('profiles').select('role').eq('id', userId).single();
        const isStudent = profile?.role === 'student';
        if (isStudent) {
            query = query.in('target_audience', ['School-wide', 'Students']);
        }
    }

    const { data, error } = await query;

    if (error) {
        // Fallback for missing table during dev
        if (error.code === 'PGRST205' || error.message?.includes('not found')) {
            console.warn('[calendar] table school_calendar_events not found');
            return [];
        }
        throw error;
    }

    return (data || []).map(event => {
        // Dynamically assign vibrant, modern theme colors based on target audience
        let color = '#8B5CF6'; // Premium purple fallback
        const audience = event.target_audience;
        if (audience === 'School-wide') {
            color = '#3B82F6'; // Vibrant Blue
        } else if (audience === 'Students') {
            color = '#10B981'; // Sleek Forest Green
        } else if (audience === 'Teachers') {
            color = '#F59E0B'; // Warm Amber
        }

        return {
            id: String(event.id),
            date: event.event_date || '',
            title: event.title,
            type: event.target_audience || 'Event',
            description: event.description || '',
            color: color
        };
    });
}
