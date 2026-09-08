import { useMutation, useQueryClient } from '@tanstack/react-query';
import { deleteAssignment, DeleteAssignmentOptions } from '../../../data/assignments/delete-assignment';
import { Assignment } from '../../../types';

export function useDeleteAssignmentMutation() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async ({ id, filePaths, fileUrls }: { id: string } & DeleteAssignmentOptions) => {
            await deleteAssignment(id, { filePaths, fileUrls });
            return id;
        },
        onMutate: async ({ id }) => {
            // Cancel any outgoing refetches so they don't overwrite our optimistic update
            await queryClient.cancelQueries({ queryKey: ['my-assignments'] });

            // Snapshot the previous values
            const previousData = queryClient.getQueriesData<Assignment[]>({ queryKey: ['my-assignments'] });

            // Optimistically update all assignment queries
            queryClient.setQueriesData<Assignment[]>({ queryKey: ['my-assignments'] }, (old) => {
                if (!Array.isArray(old)) return old;
                return old.filter((item) => String(item.id) !== String(id));
            });

            return { previousData };
        },
        onError: (_err, _variables, context) => {
            // Roll back on error
            if (context?.previousData) {
                context.previousData.forEach(([queryKey, data]) => {
                    queryClient.setQueryData(queryKey, data);
                });
            }
        },
        onSettled: () => {
            // Always refetch to stay strictly in sync with database
            queryClient.invalidateQueries({ queryKey: ['my-assignments'] });
            queryClient.invalidateQueries({ queryKey: ['task-summary'] });
        },
    });
}
