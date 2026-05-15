import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { getMaterials, GetMaterialsArgs } from '../../../data/materials/get-materials';
import { supabase } from '../../../lib/supabase';

export function useMaterialsQuery(args: GetMaterialsArgs) {
    const queryClient = useQueryClient();

    useEffect(() => {
        const channel = supabase
            .channel(`materials-rt-${args.subjectId || 'global'}`)
            .on(
                'postgres_changes',
                { 
                    event: '*', 
                    schema: 'public', 
                    table: 'class_materials', 
                    filter: args.subjectId ? `subject_id=eq.${args.subjectId}` : undefined 
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
        queryKey: ['materials', args.subjectId, args.teacherId],
        queryFn: () => getMaterials(args),
        enabled: !!(args.subjectId || args.teacherId),
    });
}
