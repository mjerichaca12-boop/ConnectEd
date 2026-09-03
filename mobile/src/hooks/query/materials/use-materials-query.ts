import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { getMaterials, GetMaterialsArgs } from '../../../data/materials/get-materials';
import { supabase } from '../../../lib/supabase';

export function useMaterialsQuery(args: GetMaterialsArgs) {
    const queryClient = useQueryClient();

    useEffect(() => {
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        const isValidUuid = !!(args.subjectId && uuidRegex.test(args.subjectId));

        const channelName = isValidUuid ? `materials-rt-${args.subjectId}` : 'materials-rt-global';
        const channel = supabase
            .channel(channelName)
            .on(
                'postgres_changes',
                { 
                    event: '*', 
                    schema: 'public', 
                    table: 'lesson_materials'
                },
                () => {
                    queryClient.invalidateQueries({ queryKey: ['materials', args.subjectId, args.teacherId] });
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [queryClient, args.subjectId, args.teacherId]);

    return useQuery({
        queryKey: ['materials', args.subjectId, args.teacherId, args.allowFallback],
        queryFn: () => getMaterials(args),
        enabled: !!(
            (args.subjectId && args.subjectId !== 'undefined' && args.subjectId !== '[id]') || 
            args.teacherId ||
            args.allowFallback !== false
        ),
        refetchOnMount: true,
        staleTime: 0,
    });
}
