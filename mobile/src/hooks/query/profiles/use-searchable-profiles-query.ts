import { useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { getAllSearchableProfiles, SearchableProfile } from '../../../data/profiles/get-all-searchable-profiles';
import { supabase } from '../../../lib/supabase';

export function invalidateSearchableProfilesQuery(queryClient: any) {
    return queryClient.invalidateQueries({ queryKey: ['searchable-profiles'] });
}

export function useSearchableProfilesQuery() {
    const queryClient = useQueryClient();

    useEffect(() => {
        const channel = supabase
            .channel('realtime:searchable-profiles')
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'profiles' },
                () => {
                    queryClient.invalidateQueries({ queryKey: ['searchable-profiles'] });
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [queryClient]);

    return useQuery<SearchableProfile[]>({
        queryKey: ['searchable-profiles'],
        queryFn: getAllSearchableProfiles,
        refetchInterval: 5000, // Background auto-poll every 5s so new users always sync
        refetchOnWindowFocus: true,
        refetchOnReconnect: true,
        staleTime: 3000,
    });
}
