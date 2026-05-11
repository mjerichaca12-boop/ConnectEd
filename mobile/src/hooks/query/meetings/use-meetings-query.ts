import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { getMeetings, GetMeetingsArgs } from '../../../data/meetings/get-meetings';
import { supabase } from '../../../lib/supabase';

export function useMeetingsQuery(args: GetMeetingsArgs = {}) {
    const queryClient = useQueryClient();

    useEffect(() => {
        const channel = supabase
            .channel('meetings-rt')
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'online_class_meetings' },
                () => {
                    queryClient.invalidateQueries({ queryKey: ['meetings'] });
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [queryClient]);

    return useQuery({
        queryKey: ['meetings', args],
        queryFn: () => getMeetings(args),
    });
}
