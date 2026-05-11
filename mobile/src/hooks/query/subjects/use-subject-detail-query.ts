import { useQuery } from '@tanstack/react-query';
import { getSubjectDetail } from '../../../data/subjects/get-subject-detail';

export function useSubjectDetailQuery(id: string) {
    return useQuery({
        queryKey: ['subjects', id],
        queryFn: () => getSubjectDetail(id),
        enabled: !!id,
    });
}
