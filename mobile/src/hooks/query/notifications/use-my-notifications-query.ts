import { useQuery } from '@tanstack/react-query';
import { getMyNotifications } from '../../../data/notifications/get-my-notifications';

export function useMyNotificationsQuery() {
    return useQuery({
        queryKey: ['my-notifications'],
        queryFn: getMyNotifications,
    });
}
