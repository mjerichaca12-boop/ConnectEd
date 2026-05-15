import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { getCalendarEvents } from '../../../data/calendar/get-calendar-events';
import { supabase } from '../../../lib/supabase';

export function useCalendarEventsQuery() {
    const queryClient = useQueryClient();

    useEffect(() => {
        const channel = supabase
            .channel('calendar-rt')
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'school_calendar_events' },
                () => {
                    queryClient.invalidateQueries({ queryKey: ['calendar-events'] });
                    // Also invalidate notifications since new calendar event is a notification trigger
                    queryClient.invalidateQueries({ queryKey: ['notifications'] });
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [queryClient]);

    return useQuery({
        queryKey: ['calendar-events'],
        queryFn: getCalendarEvents,
    });
}
