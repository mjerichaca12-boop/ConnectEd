import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { getSchoolEvents } from '../../../data/events/get-events';
import { supabase } from '../../../lib/supabase';

export function useEventsQuery(limit?: number) {
    const queryClient = useQueryClient();

    useEffect(() => {
        const channel = supabase
            .channel('school-events-rt')
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'school_events' },
                () => {
                    queryClient.invalidateQueries({ queryKey: ['school-events'] });
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [queryClient]);

    return useQuery({
        queryKey: ['school-events', limit],
        queryFn: () => getSchoolEvents(limit),
        staleTime: 1000 * 60 * 5, // 5 minutes
    });
}
