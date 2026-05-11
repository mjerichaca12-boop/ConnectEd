import { useMutation, useQueryClient } from '@tanstack/react-query';
import { updateStudentStatus } from '../../../data/enrollments/update-student-status';

export function useUpdateStudentStatusMutation(subjectId: string) {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: updateStudentStatus,
        onSuccess: () => {
            // Invalidate the query to refetch students with new status
            queryClient.invalidateQueries({ queryKey: ['class-students', subjectId] });
        },
    });
}
