import { describe, it, expect, vi, beforeEach } from 'vitest';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { 
    getReadNotificationIds, 
    markNotificationIdAsRead, 
    markMultipleNotificationIdsAsRead 
} from '../notification-storage';

vi.mock('@react-native-async-storage/async-storage', () => {
    let store: Record<string, string> = {};
    return {
        default: {
            getItem: vi.fn(async (key: string) => store[key] || null),
            setItem: vi.fn(async (key: string, value: string) => {
                store[key] = value;
            }),
            clear: vi.fn(async () => {
                store = {};
            }),
        }
    };
});

describe('notification-storage', () => {
    beforeEach(async () => {
        await AsyncStorage.clear();
        vi.clearAllMocks();
    });

    it('should return empty Set when no notifications are marked as read', async () => {
        const ids = await getReadNotificationIds();
        expect(ids).toBeInstanceOf(Set);
        expect(ids.size).toBe(0);
    });

    it('should save and return individual read notification ID', async () => {
        await markNotificationIdAsRead('act-12345');
        const ids = await getReadNotificationIds();
        expect(ids.has('act-12345')).toBe(true);
        expect(ids.size).toBe(1);
    });

    it('should save and return multiple read notification IDs', async () => {
        await markMultipleNotificationIdsAsRead(['act-1', 'ann-2', 'ev-3']);
        const ids = await getReadNotificationIds();
        expect(ids.has('act-1')).toBe(true);
        expect(ids.has('ann-2')).toBe(true);
        expect(ids.has('ev-3')).toBe(true);
        expect(ids.size).toBe(3);
    });

    it('should preserve previously marked read IDs when adding new ones', async () => {
        await markNotificationIdAsRead('first-id');
        await markNotificationIdAsRead('second-id');
        const ids = await getReadNotificationIds();
        expect(ids.has('first-id')).toBe(true);
        expect(ids.has('second-id')).toBe(true);
        expect(ids.size).toBe(2);
    });
});
