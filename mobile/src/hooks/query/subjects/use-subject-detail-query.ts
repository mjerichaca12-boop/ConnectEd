import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { getSubjectDetail } from '../../../data/subjects/get-subject-detail';
import { supabase } from '../../../lib/supabase';

export function useSubjectDetailQuery(id: string) {
    const queryClient = useQueryClient();

    useEffect(() => {
        if (!id) return;
        let channel: ReturnType<typeof supabase.channel> | null = null;

        try {
            channel = supabase
                .channel(`subject-detail-rt-${id}`)
                .on(
                    'postgres_changes',
                    { event: '*', schema: 'public', table: 'subjects', filter: `id=eq.${id}` },
                    () => {
                        queryClient.invalidateQueries({ queryKey: ['subjects', id] });
                    }
                )
                .on(
                    'postgres_changes',
                    { event: '*', schema: 'public', table: 'teacher_student_assignments', filter: `subject_id=eq.${id}` },
                    () => {
                        queryClient.invalidateQueries({ queryKey: ['subjects', id] });
                    }
                )
                .on(
                    'postgres_changes',
                    { event: '*', schema: 'public', table: 'profiles' },
                    () => {
                        queryClient.invalidateQueries({ queryKey: ['subjects', id] });
                    }
                )
                .subscribe();
        } catch (err) {
            // Subscription fallback
        }

        return () => {
            if (channel) {
                supabase.removeChannel(channel).catch(() => {/* ignore */});
            }
        };
    }, [id, queryClient]);

    return useQuery({
        queryKey: ['subjects', id],
        queryFn: () => getSubjectDetail(id),
        enabled: !!id,
        staleTime: 0,
        refetchOnMount: true,
        refetchOnWindowFocus: true,
    });
}
