import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { getMyEnrollments } from '../../../data/enrollments/get-my-enrollments';
import { supabase } from '../../../lib/supabase';

export function useMyEnrollmentsQuery() {
    const queryClient = useQueryClient();

    // Real-time: when teacher adds/updates student enrollment → auto-refetch
    useEffect(() => {
        let channel: ReturnType<typeof supabase.channel> | null = null;

        // Only subscribe if we can — ignore subscription errors silently
        try {
            channel = supabase
                .channel('my-enrollments-rt')
                .on(
                    'postgres_changes',
                    { event: '*', schema: 'public', table: 'teacher_student_assignments' },
                    () => {
                        queryClient.invalidateQueries({ queryKey: ['my-enrollments'] });
                    }
                )
                .subscribe();
        } catch (err) {
            // Table doesn't exist yet — subscription will fail silently
        }

        return () => {
            if (channel) {
                supabase.removeChannel(channel).catch(() => {/* ignore */});
            }
        };
    }, [queryClient]);

    return useQuery({
        queryKey: ['my-enrollments'],
        queryFn: getMyEnrollments,
        staleTime: 0,
        refetchOnMount: true,
        refetchOnWindowFocus: true,
        // Never throw to the error boundary — return empty data instead
        retry: 1,
        retryDelay: 2000,
    });
}
