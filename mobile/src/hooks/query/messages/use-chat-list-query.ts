import { useQuery } from '@tanstack/react-query';
import { getMyChats } from '../../../data/messages/get-my-chats';

export function useChatListQuery() {
    return useQuery({
        queryKey: ['chat-list'],
        queryFn: getMyChats,
    });
}
