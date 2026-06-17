import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { getAnnouncements, GetAnnouncementsArgs } from '../../../data/announcements/get-announcements';
import { supabase } from '../../../lib/supabase';

export function useAnnouncementsQuery(args: GetAnnouncementsArgs = {}) {
    const queryClient = useQueryClient();

    // Check if the caller intended to fetch subject-specific data (even if undefined momentarily)
    const isSubjectIntent = 'subjectId' in args;
    const isSubjectReady = !!(args.subjectId && args.subjectId !== 'undefined' && args.subjectId !== '[id]');
    const isGlobalIntent = !isSubjectIntent;
    
    // Only fetch if global is intended, or if subject intent is fully resolved
    const isEnabled = isGlobalIntent || isSubjectReady;

    // Real-time: re-fetch when teacher/admin inserts or updates an announcement
    useEffect(() => {
        const targetTable = args.subjectId ? 'class_announcements' : 'school_announcements';
        const channelName = args.subjectId ? `class-announcements-rt-${args.subjectId}` : 'school-announcements-rt';
        const filterStr = args.subjectId ? `class_id=eq.${args.subjectId}` : undefined;

        const channel = supabase
            .channel(channelName)
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: targetTable, filter: filterStr },
                () => {
                    queryClient.invalidateQueries({ queryKey: ['announcements'] });
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [queryClient, args.subjectId]);

    return useQuery({
        queryKey: ['announcements', args],
        queryFn: () => getAnnouncements(args),
        staleTime: 0,
        refetchOnMount: true,
        refetchOnWindowFocus: true,
        enabled: isEnabled,
    });
}
