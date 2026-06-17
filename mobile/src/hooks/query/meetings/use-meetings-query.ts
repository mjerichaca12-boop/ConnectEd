import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { getMeetings, GetMeetingsArgs } from '../../../data/meetings/get-meetings';
import { supabase } from '../../../lib/supabase';

export function useMeetingsQuery(args: GetMeetingsArgs = {}) {
    const queryClient = useQueryClient();

    // Check if the caller intended to fetch subject-specific data
    const isSubjectIntent = 'subjectId' in args;
    const isSubjectReady = !!(args.subjectId && args.subjectId !== 'undefined' && args.subjectId !== '[id]');
    const isGlobalIntent = !isSubjectIntent;
    
    // Only fetch if global is intended, or if subject intent is fully resolved
    const isEnabled = isGlobalIntent || isSubjectReady;

    useEffect(() => {
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        const isValidUuid = !!(args.subjectId && uuidRegex.test(args.subjectId));

        const channelName = isValidUuid ? `meetings-rt-${args.subjectId}` : 'meetings-rt-global';
        const filterStr = isValidUuid ? `subject_id=eq.${args.subjectId}` : undefined;

        const channel = supabase
            .channel(channelName)
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'online_class_meetings', filter: filterStr },
                () => {
                    queryClient.invalidateQueries({ queryKey: ['meetings', args.subjectId] });
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [queryClient, args.subjectId]);

    return useQuery({
        queryKey: ['meetings', args.subjectId, args.limit],
        queryFn: () => getMeetings(args),
        enabled: isEnabled,
        refetchOnMount: true,
        staleTime: 0,
    });
}
