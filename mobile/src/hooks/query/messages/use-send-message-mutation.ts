import { useMutation, useQueryClient } from '@tanstack/react-query';
import { sendMessage } from '../../../data/messages/get-messages';

export function useSendMessageMutation(targetId: string, isRoom: boolean = false) {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: ({ content, fileUrl, fileType, fileName }: { content: string, fileUrl?: string, fileType?: string, fileName?: string }) => 
            sendMessage(targetId, content, fileUrl, fileType, isRoom, fileName),
        onSuccess: (savedMessage) => {
            if (savedMessage) {
                queryClient.setQueryData(['conversation', targetId], (old: any[] = []) => {
                    if (!Array.isArray(old)) return [savedMessage];
                    if (old.some(m => m.id === savedMessage.id)) return old;
                    return [...old, savedMessage];
                });
            }
            queryClient.invalidateQueries({ queryKey: ['conversation', targetId] });
            queryClient.invalidateQueries({ queryKey: ['chat-list'] });
        },
    });
}
