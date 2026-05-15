import { useQuery } from '@tanstack/react-query';
import { getTeacherSubjects } from '../../../data/subjects/get-teacher-subjects';

export function useTeacherSubjectsQuery() {
    return useQuery({
        queryKey: ['teacher-subjects'],
        queryFn: getTeacherSubjects,
    });
}
