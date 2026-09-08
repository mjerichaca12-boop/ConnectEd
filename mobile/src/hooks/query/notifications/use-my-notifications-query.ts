import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { getMyNotifications } from '../../../data/notifications/get-my-notifications';
import { supabase } from '../../../lib/supabase';

export function useMyNotificationsQuery() {
    const queryClient = useQueryClient();

    useEffect(() => {
        let isMounted = true;
        let channel: any = null;

        const setupRealtime = async () => {
            const { data } = await supabase.auth.getUser();
            const userId = data?.user?.id;
            if (!userId || !isMounted) return;

            const channelName = `notifications-rt-${userId}-${Date.now()}`;
            const invalidate = () => {
                queryClient.invalidateQueries({ queryKey: ['my-notifications'] });
            };

            channel = supabase
                .channel(channelName)
                .on('postgres_changes', { event: '*', schema: 'public', table: 'notifications' }, invalidate)
                .on('postgres_changes', { event: '*', schema: 'public', table: 'assignments_activity' }, invalidate)
                .on('postgres_changes', { event: '*', schema: 'public', table: 'assignments' }, invalidate)
                .on('postgres_changes', { event: '*', schema: 'public', table: 'quizzes' }, invalidate)
                .on('postgres_changes', { event: '*', schema: 'public', table: 'school_announcements' }, invalidate)
                .on('postgres_changes', { event: '*', schema: 'public', table: 'school_calendar_events' }, invalidate)
                .on('postgres_changes', { event: '*', schema: 'public', table: 'class_announcements' }, invalidate)
                .on('postgres_changes', { event: '*', schema: 'public', table: 'lessons' }, invalidate)
                .subscribe();
        };

        setupRealtime();

        return () => {
            isMounted = false;
            if (channel) {
                supabase.removeChannel(channel);
            }
        };
    }, [queryClient]);

    return useQuery({
        queryKey: ['my-notifications'],
        queryFn: getMyNotifications,
        refetchOnMount: true,
        refetchOnWindowFocus: true,
        refetchOnReconnect: true,
        refetchInterval: 5000,
        staleTime: 0,
    });
}
