import { useMutation, useQueryClient } from '@tanstack/react-query';
import { applyForSubject } from '../../../data/enrollments/apply-for-subject';
import { Alert } from 'react-native';

export function useApplySubjectMutation() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: applyForSubject,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['my-enrollments'] });
        },
    });
}
