import { useQuery } from '@tanstack/react-query';
import { getAllSubjects } from '../../../data/subjects/get-all-subjects';

export function useAllSubjectsQuery() {
    return useQuery({
        queryKey: ['all-subjects'],
        queryFn: getAllSubjects,
    });
}
