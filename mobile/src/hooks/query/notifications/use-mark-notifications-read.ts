import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../../lib/supabase';
import { markNotificationIdAsRead, markMultipleNotificationIdsAsRead } from '../../../data/notifications/notification-storage';

const isValidUuid = (value: unknown) =>
    typeof value === 'string' &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);

/**
 * Mutation to mark an individual notification item as read.
 */
export function useMarkNotificationItemReadMutation() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (notificationId: string) => {
            if (!notificationId) return null;

            const { data: userData } = await supabase.auth.getUser();
            const user = userData?.user ?? null;

            // 1. Always save into persistent AsyncStorage
            await markNotificationIdAsRead(notificationId, user?.id);

            // 2. If it's a native UUID (stored in notifications table), also update in Supabase
            if (isValidUuid(notificationId)) {
                try {
                    await supabase
                        .from('notifications')
                        .update({ is_read: true })
                        .eq('id', notificationId);
                } catch (e) {
                    console.warn('[Notifications] Failed to update DB notification read status:', e);
                }
            }

            return notificationId;
        },
        onMutate: async (notificationId: string) => {
            await queryClient.cancelQueries({ queryKey: ['my-notifications'] });
            const prev = queryClient.getQueryData<any[]>(['my-notifications']);
            if (prev) {
                queryClient.setQueryData<any[]>(['my-notifications'], old =>
                    (old || []).map(n => n.id === notificationId ? { ...n, is_read: true } : n)
                );
            }
            return { prev };
        },
        onError: (_err, _vars, context) => {
            if (context?.prev) {
                queryClient.setQueryData(['my-notifications'], context.prev);
            }
        },
        onSettled: () => {
            queryClient.invalidateQueries({ queryKey: ['my-notifications'] });
        },
    });
}

/**
 * Mutation to mark all notifications as read.
 */
export function useMarkNotificationsReadMutation() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (allNotificationIds?: string[]) => {
            const { data: userData } = await supabase.auth.getUser();
            const user = userData?.user ?? null;

            if (Array.isArray(allNotificationIds) && allNotificationIds.length > 0) {
                await markMultipleNotificationIdsAsRead(allNotificationIds, user?.id);
            }

            if (isValidUuid(user?.id)) {
                try {
                    await supabase
                        .from('notifications')
                        .update({ is_read: true })
                        .eq('user_id', user.id);
                } catch (e) {
                    console.warn('[Notifications] Failed to update all DB notifications to read:', e);
                }
            }

            return true;
        },
        onMutate: async () => {
            await queryClient.cancelQueries({ queryKey: ['my-notifications'] });
            const prev = queryClient.getQueryData<any[]>(['my-notifications']);
            if (prev) {
                queryClient.setQueryData<any[]>(['my-notifications'], old =>
                    (old || []).map(n => ({ ...n, is_read: true }))
                );
            }
            return { prev };
        },
        onError: (_err, _vars, context) => {
            if (context?.prev) {
                queryClient.setQueryData(['my-notifications'], context.prev);
            }
        },
        onSettled: () => {
            queryClient.invalidateQueries({ queryKey: ['my-notifications'] });
        },
    });
}
