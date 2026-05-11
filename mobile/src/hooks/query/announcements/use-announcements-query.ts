import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { getAnnouncements, GetAnnouncementsArgs } from '../../../data/announcements/get-announcements';
import { supabase } from '../../../lib/supabase';

export function useAnnouncementsQuery(args: GetAnnouncementsArgs = {}) {
    const queryClient = useQueryClient();

    // Real-time: re-fetch when teacher/admin inserts or updates an announcement
    useEffect(() => {
        const channel = supabase
            .channel('school-announcements-rt')
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'school_announcements' },
                () => {
                    queryClient.invalidateQueries({ queryKey: ['announcements'] });
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [queryClient]);

    return useQuery({
        queryKey: ['announcements', args],
        queryFn: () => getAnnouncements(args),
        staleTime: 0,
        refetchOnMount: true,
        refetchOnWindowFocus: true,
    });
}
