import { useMutation, useQueryClient } from '@tanstack/react-query';
import { removeStudentFromClass } from '../../../data/enrollments/remove-student-from-class';

export function useRemoveStudentMutation(subjectId: string) {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: removeStudentFromClass,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['class-students', subjectId] });
            queryClient.invalidateQueries({ queryKey: ['teacher-subjects'] });
        },
    });
}
