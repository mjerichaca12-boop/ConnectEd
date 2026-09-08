import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { getUnreadMessagesCount } from '../../../data/messages/get-unread-messages-count';
import { supabase } from '../../../lib/supabase';

export function useUnreadMessagesCountQuery() {
    const queryClient = useQueryClient();

    useEffect(() => {
        const channelName = `unread-messages-rt-${Date.now()}`;

        const invalidate = () => {
            queryClient.invalidateQueries({ queryKey: ['unread-messages-count'] });
            queryClient.invalidateQueries({ queryKey: ['chat-list'] });
        };

        const channel = supabase
            .channel(channelName)
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'messages' },
                invalidate
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [queryClient]);

    return useQuery({
        queryKey: ['unread-messages-count'],
        queryFn: getUnreadMessagesCount,
        refetchOnMount: true,
        refetchOnWindowFocus: true,
        refetchOnReconnect: true,
        refetchInterval: false,
        staleTime: 30000,
    });
}
