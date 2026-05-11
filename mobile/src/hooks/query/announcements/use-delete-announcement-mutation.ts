import { useMutation, useQueryClient } from '@tanstack/react-query';
import { deleteAnnouncement } from '../../../data/announcements/delete-announcement';

export function useDeleteAnnouncementMutation() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: deleteAnnouncement,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['announcements'] });
        },
    });
}
