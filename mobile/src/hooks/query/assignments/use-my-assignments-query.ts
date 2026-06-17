import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { getMyAssignments } from '../../../data/assignments/get-my-assignments';
import { supabase } from '../../../lib/supabase';

export function useMyAssignmentsQuery(filters?: { subjectId?: string }) {
    const queryClient = useQueryClient();
    const subjectId = filters?.subjectId;

    useEffect(() => {
        const channelName = subjectId ? `assignments-rt-${subjectId}` : 'assignments-rt-global';
        const channel = supabase
            .channel(channelName)
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'assignments_activity' },
                () => {
                    queryClient.invalidateQueries({ queryKey: ['my-assignments', subjectId] });
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [queryClient, subjectId]);

    const isSubjectIntent = 'subjectId' in (filters || {});
    const isSubjectReady = !!(subjectId && subjectId !== 'undefined' && subjectId !== '[id]');
    const isGlobalIntent = !isSubjectIntent;
    const isEnabled = isGlobalIntent || isSubjectReady;

    return useQuery({
        queryKey: ['my-assignments', subjectId],
        queryFn: () => getMyAssignments(subjectId),
        enabled: isEnabled,
        refetchOnMount: true,
        staleTime: 0,
    });
}
