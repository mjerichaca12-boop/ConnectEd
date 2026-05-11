import { useQuery } from '@tanstack/react-query';
import { getClassStudents, GetClassStudentsArgs } from '../../../data/enrollments/get-class-students';

export function useClassStudentsQuery(args: GetClassStudentsArgs) {
    return useQuery({
        queryKey: ['class-students', args.subjectId],
        queryFn: () => getClassStudents(args),
        enabled: !!args.subjectId,
    });
}
