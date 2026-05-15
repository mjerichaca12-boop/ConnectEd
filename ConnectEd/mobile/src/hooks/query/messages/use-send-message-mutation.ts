import { useMutation, useQueryClient } from '@tanstack/react-query';
import { sendMessage } from '../../../data/messages/get-messages';

export function useSendMessageMutation(targetId: string, isRoom: boolean = false) {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: ({ content, fileUrl, fileType }: { content: string, fileUrl?: string, fileType?: string }) => 
            sendMessage(targetId, content, fileUrl, fileType, isRoom),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['conversation', targetId] });
            queryClient.invalidateQueries({ queryKey: ['chat-list'] });
        },
    });
}
