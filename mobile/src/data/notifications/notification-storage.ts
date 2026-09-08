import AsyncStorage from '@react-native-async-storage/async-storage';

const READ_NOTIFICATIONS_STORAGE_KEY = '@connected_read_notification_ids';

export async function getReadNotificationIds(userId?: string): Promise<Set<string>> {
    try {
        const key = userId ? `@connected_read_notification_ids_${userId}` : READ_NOTIFICATIONS_STORAGE_KEY;
        let json = await AsyncStorage.getItem(key);
        if (!json && userId) {
            // Check generic key for backward compatibility
            json = await AsyncStorage.getItem(READ_NOTIFICATIONS_STORAGE_KEY);
        }
        if (!json) return new Set();
        const ids = JSON.parse(json);
        return new Set(Array.isArray(ids) ? ids : []);
    } catch {
        return new Set();
    }
}

export async function markNotificationIdAsRead(id: string, userId?: string): Promise<void> {
    try {
        const key = userId ? `@connected_read_notification_ids_${userId}` : READ_NOTIFICATIONS_STORAGE_KEY;
        const ids = await getReadNotificationIds(userId);
        ids.add(id);
        const serialized = JSON.stringify(Array.from(ids));
        await AsyncStorage.setItem(key, serialized);
        if (userId) {
            await AsyncStorage.setItem(READ_NOTIFICATIONS_STORAGE_KEY, serialized);
        }
    } catch (e) {
        console.warn('[Notifications] Failed to save read ID:', e);
    }
}

export async function markMultipleNotificationIdsAsRead(newIds: string[], userId?: string): Promise<void> {
    try {
        const key = userId ? `@connected_read_notification_ids_${userId}` : READ_NOTIFICATIONS_STORAGE_KEY;
        const ids = await getReadNotificationIds(userId);
        newIds.forEach(id => ids.add(id));
        const serialized = JSON.stringify(Array.from(ids));
        await AsyncStorage.setItem(key, serialized);
        if (userId) {
            await AsyncStorage.setItem(READ_NOTIFICATIONS_STORAGE_KEY, serialized);
        }
    } catch (e) {
        console.warn('[Notifications] Failed to save read IDs:', e);
    }
}

export async function clearReadNotificationIds(userId?: string): Promise<void> {
    try {
        await AsyncStorage.removeItem(READ_NOTIFICATIONS_STORAGE_KEY);
        if (userId) {
            await AsyncStorage.removeItem(`@connected_read_notification_ids_${userId}`);
        }
    } catch (e) {
        console.warn('[Notifications] Failed to clear read notification IDs:', e);
    }
}
