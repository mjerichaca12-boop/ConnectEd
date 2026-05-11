import { useQuery } from '@tanstack/react-query';
import { getAllSearchableProfiles } from '../../../data/profiles/get-all-searchable-profiles';

export function useSearchableProfilesQuery() {
    return useQuery({
        queryKey: ['searchable-profiles'],
        queryFn: getAllSearchableProfiles,
        staleTime: 1000 * 60 * 5, // Cache for 5 minutes
    });
}
